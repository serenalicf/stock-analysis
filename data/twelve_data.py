"""
twelve_data.py
==============
• Fetches OHLCV via /time_series (3 calls: daily/weekly/monthly + 1 price)
• Computes all indicators locally with pure numpy — zero extra deps
• Results cached for 60 minutes to eliminate repeat API calls
"""

import os
import asyncio
import httpx
import logging
import numpy as np
from data import cache as _cache

logger = logging.getLogger(__name__)

BASE_URL    = "https://api.twelvedata.com"
MAX_RETRIES = 3
RETRY_DELAY = 10.0   # seconds after a 429
CACHE_TTL   = 3600   # 1 hour

# Keep outputsize modest — free plan has a daily credit limit
TIMEFRAMES = {
    "daily":   {"interval": "1day",   "outputsize": 252},   # ~1 trading year
    "weekly":  {"interval": "1week",  "outputsize": 104},   # 2 years
    "monthly": {"interval": "1month", "outputsize": 36},    # 3 years
}


def _apikey() -> str:
    k = os.getenv("TWELVE_DATA_API_KEY", "").strip()
    if not k:
        raise ValueError("TWELVE_DATA_API_KEY not set in .env")
    return k


# ── HTTP ──────────────────────────────────────────────────────────────────────

async def _fetch_series(client: httpx.AsyncClient,
                        symbol: str, interval: str, outputsize: int) -> list:
    for attempt in range(MAX_RETRIES + 1):
        try:
            r = await client.get(
                f"{BASE_URL}/time_series",
                params={
                    "symbol":     symbol,
                    "interval":   interval,
                    "outputsize": outputsize,
                    "apikey":     _apikey(),
                    "type":       "stock",   # explicit — avoids forex/crypto ambiguity
                },
                timeout=30,
            )
            data = r.json()

            # Rate limited
            if r.status_code == 429 or data.get("code") == 429:
                wait = RETRY_DELAY * (attempt + 1)
                if attempt < MAX_RETRIES:
                    logger.warning("TwelveData rate-limit %s %s — waiting %.0fs", symbol, interval, wait)
                    await asyncio.sleep(wait)
                    continue
                logger.error("TwelveData rate-limit not recovered for %s %s", symbol, interval)
                return []

            # API-level error (bad symbol, auth, etc.)
            if data.get("status") == "error":
                logger.warning("TwelveData API error %s %s: %s", symbol, interval, data.get("message", "?"))
                return []

            values = data.get("values", [])
            if not values:
                logger.warning("TwelveData returned 0 bars for %s %s", symbol, interval)
                return []

            logger.debug("TwelveData %s %s → %d bars", symbol, interval, len(values))
            return values

        except Exception as exc:
            if attempt < MAX_RETRIES:
                await asyncio.sleep(2 ** attempt)
                continue
            logger.error("TwelveData exception %s %s: %s", symbol, interval, exc)
            return []
    return []


async def _fetch_price(client: httpx.AsyncClient, symbol: str) -> float:
    for attempt in range(MAX_RETRIES + 1):
        try:
            r = await client.get(
                f"{BASE_URL}/price",
                params={"symbol": symbol, "apikey": _apikey(), "type": "stock"},
                timeout=10,
            )
            data = r.json()
            if r.status_code == 429 or data.get("code") == 429:
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(RETRY_DELAY)
                    continue
                return 0.0
            p = data.get("price")
            return float(p) if p else 0.0
        except Exception:
            if attempt < MAX_RETRIES:
                await asyncio.sleep(1)
                continue
            return 0.0
    return 0.0


# ── Indicator maths (pure numpy) ─────────────────────────────────────────────

def _col(bars: list, key: str) -> np.ndarray:
    """bars newest-first → oldest-first float array, NaN on bad values."""
    out = []
    for b in reversed(bars):
        try:
            v = b.get(key)
            out.append(float(v) if v not in (None, "", "null") else float("nan"))
        except Exception:
            out.append(float("nan"))
    return np.array(out, dtype=np.float64)


def _ema(a: np.ndarray, n: int) -> np.ndarray:
    out = np.full(len(a), np.nan)
    valid = np.where(~np.isnan(a))[0]
    if len(valid) < n:
        return out
    start = valid[n - 1]
    out[start] = float(np.nanmean(a[valid[0]: start + 1]))
    k = 2.0 / (n + 1)
    for i in range(start + 1, len(a)):
        prev = out[i - 1]
        out[i] = float(a[i]) * k + prev * (1 - k) if not np.isnan(a[i]) else prev
    return out


def _last(a: np.ndarray) -> float | None:
    if len(a) == 0:
        return None
    v = float(a[-1])
    return round(v, 4) if not np.isnan(v) else None


def _rsi(c: np.ndarray, p: int = 14) -> float | None:
    if len(c) < p + 2:
        return None
    d    = np.diff(c)
    gain = np.where(d > 0, d, 0.0)
    loss = np.where(d < 0, -d, 0.0)
    ag, al = float(np.mean(gain[:p])), float(np.mean(loss[:p]))
    for i in range(p, len(gain)):
        ag = (ag * (p - 1) + gain[i]) / p
        al = (al * (p - 1) + loss[i]) / p
    return round(100.0 if al == 0 else 100 - 100 / (1 + ag / al), 4)


def _macd(c: np.ndarray, fast=12, slow=26, sig=9):
    if len(c) < slow + sig + 1:
        return None, None, None
    ef = _ema(c, fast)
    es = _ema(c, slow)
    ml = ef - es
    sl = _ema(ml, sig)
    return _last(ml), _last(sl), _last(ml - sl)


def _adx(hi: np.ndarray, lo: np.ndarray, cl: np.ndarray, p: int = 14) -> float | None:
    n = len(cl)
    if n < p * 2 + 3:
        return None
    tr = np.zeros(n); pdm = np.zeros(n); mdm = np.zeros(n)
    for i in range(1, n):
        tr[i]  = max(hi[i]-lo[i], abs(hi[i]-cl[i-1]), abs(lo[i]-cl[i-1]))
        up, dn = hi[i]-hi[i-1], lo[i-1]-lo[i]
        pdm[i] = up if (up > dn and up > 0) else 0.0
        mdm[i] = dn if (dn > up and dn > 0) else 0.0

    def wilder(x):
        w = np.zeros(n)
        w[p] = x[1:p+1].sum()
        for i in range(p+1, n):
            w[i] = w[i-1] - w[i-1]/p + x[i]
        return w

    atr = wilder(tr)
    with np.errstate(divide="ignore", invalid="ignore"):
        pdi = np.where(atr>0, 100*wilder(pdm)/atr, 0.0)
        mdi = np.where(atr>0, 100*wilder(mdm)/atr, 0.0)
        dsum = pdi + mdi
        dx   = np.where(dsum>0, 100*np.abs(pdi-mdi)/dsum, 0.0)
    adx = np.zeros(n)
    adx[2*p] = float(np.mean(dx[p:2*p+1]))
    for i in range(2*p+1, n):
        adx[i] = (adx[i-1]*(p-1) + dx[i]) / p
    v = adx[-1]
    return round(float(v), 4) if v > 0 else None


def _bbands(c: np.ndarray, p: int = 20, mult: float = 2.0):
    if len(c) < p:
        return None, None, None
    w   = c[-p:]
    mid = float(np.mean(w))
    std = float(np.std(w, ddof=0))
    return round(mid+mult*std,4), round(mid,4), round(mid-mult*std,4)


def _compute_tf(bars: list) -> dict:
    empty = {k: None for k in
             ["rsi","macd","macd_signal","macd_hist","adx",
              "bb_upper","bb_mid","bb_lower","ema20","ema50","ema200"]}
    if not bars:
        return empty
    c = _col(bars, "close");  h = _col(bars, "high");  lo = _col(bars, "low")
    # Drop leading NaNs
    first_ok = int(np.argmax(~np.isnan(c))) if np.any(~np.isnan(c)) else len(c)
    c = c[first_ok:]; h = h[first_ok:]; lo = lo[first_ok:]
    if len(c) < 5:
        return empty
    mv, sv, hv = _macd(c)
    bu, bm, bl = _bbands(c)
    return {
        "rsi":         _rsi(c),
        "macd":        mv,
        "macd_signal": sv,
        "macd_hist":   hv,
        "adx":         _adx(h, lo, c),
        "bb_upper":    bu,
        "bb_mid":      bm,
        "bb_lower":    bl,
        "ema20":       _last(_ema(c, 20)),
        "ema50":       _last(_ema(c, 50)),
        "ema200":      _last(_ema(c, 200)),
    }


# ── Public entry point (cached) ───────────────────────────────────────────────

async def _fetch_all(symbol: str) -> dict:
    async with httpx.AsyncClient() as client:
        daily, weekly, monthly, price = await asyncio.gather(
            _fetch_series(client, symbol, "1day",   252),
            _fetch_series(client, symbol, "1week",  104),
            _fetch_series(client, symbol, "1month",  36),
            _fetch_price(client, symbol),
        )

    # Price fallback to latest daily close
    if price == 0.0 and daily:
        try:
            price = float(daily[0].get("close", 0) or 0)
        except Exception:
            pass

    errors: dict = {}
    tfs:    dict = {}
    for name, bars in [("daily", daily), ("weekly", weekly), ("monthly", monthly)]:
        if not bars:
            errors[name] = "No data returned — verify API key and symbol"
        tfs[name] = _compute_tf(bars)

    return {"price": round(price, 2), "timeframes": tfs, "fetch_errors": errors}


async def fetch_technical_indicators(symbol: str) -> dict:
    return await _cache.get_or_fetch(
        f"td:{symbol}",
        lambda: _fetch_all(symbol),
        CACHE_TTL,
    )
