"""
yfinance_data.py
================
Calls Yahoo Finance APIs directly via httpx — no yfinance library dependency.

Yahoo Finance broke their v8 chart endpoint for many server environments
in 2024/2025 due to cookie/crumb auth changes. This module handles auth
properly:

  Step 1 — GET https://fc.yahoo.com  → sets an A1/B cookie
  Step 2 — GET https://query2.finance.yahoo.com/v1/test/getcrumb
            (with that cookie) → returns a crumb string
  Step 3 — GET the v8/finance/chart endpoint with crumb as query param

If the crumb flow fails, falls back to the older v7 /finance/download
endpoint which uses simpler auth. Both endpoints return OHLCV data.

Results cached 60 minutes.
"""

import asyncio
import logging
from functools import partial

import httpx
import numpy as np
from data import cache as _cache

logger    = logging.getLogger(__name__)
CACHE_TTL = 3600   # 1 hour

# Yahoo Finance endpoints
_CRUMB_INIT = "https://fc.yahoo.com"
_CRUMB_URL  = "https://query2.finance.yahoo.com/v1/test/getcrumb"
_CHART_URL  = "https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
_DL_URL     = "https://query1.finance.yahoo.com/v7/finance/download/{symbol}"

_HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept":          "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Origin":          "https://finance.yahoo.com",
    "Referer":         "https://finance.yahoo.com/",
}

# Module-level crumb cache (shared across all requests in the process)
_crumb_cache: dict = {"crumb": None, "cookies": None}


async def _get_crumb(client: httpx.AsyncClient) -> tuple[str | None, dict]:
    """Fetch Yahoo Finance crumb + cookies needed for chart API calls."""
    try:
        # Step 1: hit fc.yahoo.com to get initial cookies
        r1 = await client.get(_CRUMB_INIT, headers=_HEADERS, timeout=10, follow_redirects=True)
        cookies = dict(r1.cookies)

        # Step 2: get crumb using those cookies
        r2 = await client.get(
            _CRUMB_URL,
            headers={**_HEADERS, "Cookie": "; ".join(f"{k}={v}" for k, v in cookies.items())},
            timeout=10,
        )
        crumb = r2.text.strip()
        if crumb and len(crumb) > 4:
            logger.debug("Yahoo crumb obtained: %s…", crumb[:8])
            return crumb, cookies
    except Exception as e:
        logger.debug("Crumb fetch failed: %s", e)
    return None, {}


async def _fetch_chart(client: httpx.AsyncClient, symbol: str,
                       crumb: str, cookies: dict) -> list[dict] | None:
    """
    Fetch 1 year of daily OHLCV from Yahoo v8 chart endpoint.
    Returns list of bar dicts [{date, open, high, low, close, volume}] or None.
    """
    import time
    end   = int(time.time())
    start = end - 365 * 24 * 3600

    try:
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
        r = await client.get(
            _CHART_URL.format(symbol=symbol),
            params={
                "period1":  start,
                "period2":  end,
                "interval": "1d",
                "crumb":    crumb,
                "events":   "div,splits",
            },
            headers={**_HEADERS, "Cookie": cookie_str},
            timeout=20,
            follow_redirects=True,
        )

        if r.status_code != 200:
            logger.warning("Yahoo chart %s → HTTP %d", symbol, r.status_code)
            return None

        data = r.json()
        result = data.get("chart", {}).get("result")
        if not result:
            err = data.get("chart", {}).get("error", {})
            logger.warning("Yahoo chart error for %s: %s", symbol, err)
            return None

        res       = result[0]
        ts        = res.get("timestamp", [])
        q         = res.get("indicators", {}).get("quote", [{}])[0]
        adj_close = res.get("indicators", {}).get("adjclose", [{}])
        closes    = (adj_close[0].get("adjclose") if adj_close else None) or q.get("close", [])

        if not ts or not closes:
            return None

        bars = []
        for i, t in enumerate(ts):
            try:
                c = closes[i]
                h = q.get("high",  [])[i] if i < len(q.get("high",  [])) else None
                l = q.get("low",   [])[i] if i < len(q.get("low",   [])) else None
                o = q.get("open",  [])[i] if i < len(q.get("open",  [])) else None
                if c is None or h is None or l is None:
                    continue
                bars.append({"close": c, "high": h, "low": l, "open": o})
            except (IndexError, TypeError):
                continue

        logger.debug("Yahoo chart %s → %d bars", symbol, len(bars))
        return bars if len(bars) >= 20 else None

    except Exception as e:
        logger.warning("Yahoo chart exception for %s: %s", symbol, e)
        return None


async def _fetch_csv_fallback(client: httpx.AsyncClient, symbol: str) -> list[dict] | None:
    """
    Fallback: Yahoo v7 /finance/download — returns CSV, simpler auth.
    Works for most tickers even when v8 fails.
    """
    import time, io, csv
    end   = int(time.time())
    start = end - 366 * 24 * 3600

    try:
        r = await client.get(
            _DL_URL.format(symbol=symbol),
            params={"period1": start, "period2": end, "interval": "1d", "events": "history"},
            headers=_HEADERS,
            timeout=20,
            follow_redirects=True,
        )
        if r.status_code != 200 or not r.text.strip():
            return None

        reader = csv.DictReader(io.StringIO(r.text))
        bars   = []
        for row in reader:
            try:
                bars.append({
                    "close": float(row.get("Adj Close") or row.get("Close") or 0),
                    "high":  float(row.get("High", 0)),
                    "low":   float(row.get("Low",  0)),
                    "open":  float(row.get("Open", 0)),
                })
            except (ValueError, TypeError):
                continue

        logger.debug("Yahoo CSV %s → %d bars", symbol, len(bars))
        return bars if len(bars) >= 20 else None

    except Exception as e:
        logger.warning("Yahoo CSV fallback failed for %s: %s", symbol, e)
        return None


async def _download_bars(symbol: str) -> list[dict] | None:
    """
    Try v8 chart API first (with crumb auth), then v7 CSV fallback.
    Returns list of bar dicts oldest-first, or None on total failure.
    """
    async with httpx.AsyncClient() as client:
        # Use cached crumb if available
        crumb   = _crumb_cache["crumb"]
        cookies = _crumb_cache["cookies"] or {}

        if not crumb:
            crumb, cookies = await _get_crumb(client)
            if crumb:
                _crumb_cache["crumb"]   = crumb
                _crumb_cache["cookies"] = cookies

        # Try v8 chart with crumb
        if crumb:
            bars = await _fetch_chart(client, symbol, crumb, cookies)
            if bars:
                return bars
            # Crumb may have expired — refresh once
            logger.info("Refreshing Yahoo crumb for %s", symbol)
            crumb, cookies = await _get_crumb(client)
            if crumb:
                _crumb_cache["crumb"]   = crumb
                _crumb_cache["cookies"] = cookies
                bars = await _fetch_chart(client, symbol, crumb, cookies)
                if bars:
                    return bars

        # Fallback to CSV
        logger.info("Falling back to Yahoo CSV for %s", symbol)
        return await _fetch_csv_fallback(client, symbol)


# ── S/R computation ───────────────────────────────────────────────────────────

def _compute_sr_from_bars(symbol: str, bars: list[dict]) -> dict:
    """Compute support/resistance levels from a list of OHLC bar dicts."""
    closes = np.array([b["close"] for b in bars], dtype=float)
    highs  = np.array([b["high"]  for b in bars], dtype=float)
    lows   = np.array([b["low"]   for b in bars], dtype=float)

    # Remove NaN rows
    mask   = ~(np.isnan(closes) | np.isnan(highs) | np.isnan(lows))
    closes, highs, lows = closes[mask], highs[mask], lows[mask]
    n = len(closes)

    if n < 20:
        return {"error": f"Only {n} valid bars for '{symbol}' — need 20+"}

    current = float(closes[-1])
    h52     = float(np.max(highs))
    l52     = float(np.min(lows))

    # Pivot point detection
    w       = 3 if n < 80 else 5
    res_pts = [h52]
    sup_pts = [l52]

    for i in range(w, n - w):
        if highs[i] >= float(np.max(highs[i - w: i + w + 1])):
            res_pts.append(float(highs[i]))
        if lows[i] <= float(np.min(lows[i - w: i + w + 1])):
            sup_pts.append(float(lows[i]))

    def cluster(pts: list) -> list:
        if not pts:
            return []
        pts    = sorted(set(round(p, 4) for p in pts))
        groups = [[pts[0]]]
        for p in pts[1:]:
            ref = groups[-1][-1]
            if ref > 0 and (p - ref) / ref < 0.015:
                groups[-1].append(p)
            else:
                groups.append([p])
        return [round(float(np.mean(g)), 2) for g in groups]

    resistances = cluster(res_pts)
    supports    = cluster(sup_pts)

    above = [r for r in resistances if r > current * 1.002]
    below = [s for s in supports    if s < current * 0.998]

    nearest_res = min(above, default=round(h52, 2))
    nearest_sup = max(below, default=round(l52, 2))

    return {
        "current_price":      round(current, 2),
        "nearest_resistance": round(nearest_res, 2),
        "nearest_support":    round(nearest_sup, 2),
        "dist_to_resistance": round((nearest_res - current) / current * 100, 2),
        "dist_to_support":    round((current - nearest_sup) / current * 100, 2),
        "high_52w":           round(h52, 2),
        "low_52w":            round(l52, 2),
        "pct_from_52w_high":  round((current - h52) / h52 * 100, 2),
        "pct_from_52w_low":   round((current - l52) / l52 * 100, 2),
        "top_resistances":    sorted(above)[:5] if above else [round(h52, 2)],
        "top_supports":       sorted(below, reverse=True)[:5] if below else [round(l52, 2)],
    }


async def _fetch_and_compute(symbol: str) -> dict:
    try:
        bars = await _download_bars(symbol)
        if not bars:
            return {
                "error": (
                    f"Could not retrieve price data for '{symbol}' from Yahoo Finance. "
                    "Verify the ticker symbol is correct (e.g. GOOGL not GOOGLE). "
                    "If correct, Yahoo Finance may be temporarily throttling — "
                    "cached data will be used on the next request."
                )
            }
        return _compute_sr_from_bars(symbol, bars)
    except Exception as exc:
        logger.error("S/R error %s: %s", symbol, exc, exc_info=True)
        return {"error": str(exc)}


async def fetch_support_resistance(symbol: str) -> dict:
    return await _cache.get_or_fetch(
        f"sr:{symbol}",
        lambda: _fetch_and_compute(symbol),
        CACHE_TTL,
    )
