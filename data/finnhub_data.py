"""
finnhub_data.py
===============
Free-tier Finnhub endpoints only:
  /stock/recommendation    ✓ free
  /company-news            ✓ free
  /stock/basic-financials  ✓ free  (requires follow_redirects=True)

Dropped:
  /stock/price-target      ✗ moved to premium (returns 403)
  /news-sentiment          ✗ premium
  /stock/social-sentiment  ✗ premium

Key fixes vs previous version:
  - httpx client created with follow_redirects=True  (fixes 302 on basic-financials)
  - Safe JSON parsing — never calls .json() on empty/redirect bodies
  - Dropped /stock/price-target entirely (always 403 on free plan)

Sentiment derived from news headline keyword scoring.
Results cached for 30 minutes.
"""

import os
import re
import asyncio
import logging
import httpx
from datetime import datetime, timedelta
from data import cache as _cache

logger    = logging.getLogger(__name__)
BASE      = "https://finnhub.io/api/v1"
CACHE_TTL = 1800   # 30 minutes

# ── Sentiment keyword lists ───────────────────────────────────────────────────

_BULL = {
    "beat", "beats", "surpass", "surge", "soar", "rally", "jump", "jumps",
    "gain", "gains", "rise", "rises", "rose", "record", "strong", "upgrade",
    "outperform", "positive", "profit", "profits", "revenue", "growth",
    "expand", "partnership", "deal", "win", "wins", "bullish", "boost",
    "improve", "breakout", "raised", "raises", "above", "exceeds", "exceeded",
    "buyback", "dividend", "acquire", "acquisition", "launch", "launches",
    "innovative", "momentum", "opportunity", "optimistic", "recovery",
}
_BEAR = {
    "miss", "misses", "disappoint", "disappoints", "drop", "drops", "fall",
    "falls", "decline", "declines", "crash", "plunge", "loss", "losses",
    "weak", "downgrade", "underperform", "negative", "cut", "cuts", "layoff",
    "layoffs", "recall", "investigation", "lawsuit", "fine", "fined", "below",
    "warning", "bearish", "concern", "risk", "risks", "slump", "restructure",
    "bankruptcy", "default", "resign", "probe", "fraud", "restatement",
    "slowdown", "headwinds", "uncertainty", "volatile", "pressure",
}


def _score(text: str) -> int:
    words = set(re.findall(r"\b[a-z]+\b", text.lower()))
    b, r = len(words & _BULL), len(words & _BEAR)
    if b > r: return  1
    if r > b: return -1
    return 0


def _apikey() -> str:
    k = os.getenv("FINNHUB_API_KEY", "").strip()
    if not k:
        raise ValueError("FINNHUB_API_KEY not set in .env")
    return k


# ── Safe HTTP helper ──────────────────────────────────────────────────────────

async def _get(client: httpx.AsyncClient, path: str, params: dict,
               default, retries: int = 2):
    """
    GET request with:
      - follow_redirects (fixes 302 on basic-financials)
      - safe JSON parsing (never crashes on empty body)
      - graceful handling of 403/429/non-200
    """
    p = {**params, "token": _apikey()}
    for attempt in range(retries + 1):
        try:
            r = await client.get(
                f"{BASE}{path}", params=p, timeout=15,
                follow_redirects=True,
            )

            # Rate limit
            if r.status_code == 429:
                wait = 5 * (attempt + 1)
                if attempt < retries:
                    logger.warning("Finnhub 429 %s — sleeping %ds", path, wait)
                    await asyncio.sleep(wait)
                    continue
                return default

            # Premium / forbidden
            if r.status_code == 403:
                logger.info("Finnhub 403 %s — premium endpoint, skipping", path)
                return default

            if r.status_code != 200:
                logger.warning("Finnhub %d %s", r.status_code, path)
                return default

            # Safe JSON parse — body can be empty even on 200
            body = r.text.strip()
            if not body:
                logger.warning("Finnhub empty body on %s", path)
                return default

            return r.json()

        except Exception as exc:
            if attempt < retries:
                await asyncio.sleep(2 ** attempt)
                continue
            logger.error("Finnhub exception %s: %s", path, exc)
            return default

    return default


# ── Main fetch ────────────────────────────────────────────────────────────────

async def _fetch_all(symbol: str) -> dict:
    today     = datetime.today()
    month_ago = today - timedelta(days=30)
    fmt       = "%Y-%m-%d"

    async with httpx.AsyncClient() as client:
        rec, news, basics = await asyncio.gather(
            _get(client, "/stock/recommendation",   {"symbol": symbol}, default=[]),
            _get(client, "/company-news",           {
                "symbol": symbol,
                "from":   month_ago.strftime(fmt),
                "to":     today.strftime(fmt),
            }, default=[]),
            _get(client, "/stock/basic-financials", {"symbol": symbol, "metric": "all"}, default={}),
        )

    # ── Analyst ratings ──────────────────────────────────────────────────────
    analyst: dict = {}
    if isinstance(rec, list) and len(rec) > 0:
        r0 = rec[0]
        sb  = int(r0.get("strongBuy",  0) or 0)
        b   = int(r0.get("buy",        0) or 0)
        h   = int(r0.get("hold",       0) or 0)
        s   = int(r0.get("sell",       0) or 0)
        ss  = int(r0.get("strongSell", 0) or 0)
        total   = sb + b + h + s + ss
        bullish = sb + b
        bearish = s  + ss
        analyst = {
            "strong_buy":  sb, "buy": b, "hold": h,
            "sell": s, "strong_sell": ss,
            "total":       total,
            "bullish_pct": round(bullish / total * 100, 1) if total else 0,
            "bearish_pct": round(bearish / total * 100, 1) if total else 0,
        }

    # ── Basic financials ─────────────────────────────────────────────────────
    financials: dict = {}
    if isinstance(basics, dict) and isinstance(basics.get("metric"), dict):
        m = basics["metric"]
        def _f(key):
            v = m.get(key)
            return float(v) if v is not None else None
        financials = {
            "pe_ttm":         _f("peTTM"),
            "eps_ttm":        _f("epsTTM"),
            "revenue_growth": _f("revenueGrowthTTMYoy"),
            "beta":           _f("beta"),
            "52w_high_finn":  _f("52WeekHigh"),
            "52w_low_finn":   _f("52WeekLow"),
        }

    # ── News sentiment (derived from headlines) ───────────────────────────────
    if isinstance(news, list) and len(news) > 0:
        scores = [_score(str(a.get("headline", "")) + " " + str(a.get("summary", "")))
                  for a in news]
        total  = len(scores)
        n_bull = scores.count(1)
        n_bear = scores.count(-1)
        n_neut = scores.count(0)
        sentiment = {
            "recent_count":    total,
            "bullish_pct":     round(n_bull / total, 4),
            "bearish_pct":     round(n_bear / total, 4),
            "neutral_pct":     round(n_neut / total, 4),
            "sentiment_score": round((n_bull - n_bear) / total, 4),
            "source":          "headline_keywords",
        }
    else:
        sentiment = {
            "recent_count":    0,
            "bullish_pct":     0.0,
            "bearish_pct":     0.0,
            "neutral_pct":     1.0,
            "sentiment_score": 0.0,
            "source":          "no_news",
        }

    return {"analyst": analyst, "sentiment": sentiment, "financials": financials}


async def fetch_finnhub_data(symbol: str) -> dict:
    return await _cache.get_or_fetch(
        f"fh:{symbol}",
        lambda: _fetch_all(symbol),
        CACHE_TTL,
    )
