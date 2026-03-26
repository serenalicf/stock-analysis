import asyncio
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

from data.twelve_data import fetch_technical_indicators
from data.finnhub_data import fetch_finnhub_data
from data.yfinance_data import fetch_support_resistance
from data import cache as _cache
from scoring import compute_score

load_dotenv()

app = FastAPI(title="Stock Signal Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class WatchlistRequest(BaseModel):
    tickers: List[str]

class AnalysisResult(BaseModel):
    ticker: str
    score: float
    signal: str
    breakdown: dict
    indicators: dict
    analyst: dict
    sentiment: dict
    support_resistance: dict
    cached: bool = False
    error: Optional[str] = None


# ── Static / SPA ──────────────────────────────────────────────────────────────

STATIC_DIR = Path("static")
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

@app.get("/")
async def serve_index():
    idx = STATIC_DIR / "index.html"
    return FileResponse(idx) if idx.exists() else {
        "message": "Run `npm run build` inside frontend/ then restart."
    }

@app.get("/health")
async def health():
    return {"status": "ok", "cache": _cache.stats()}

@app.get("/cache/stats")
async def cache_stats():
    return _cache.stats()

@app.delete("/cache/clear")
async def cache_clear(symbol: Optional[str] = None):
    if symbol:
        for prefix in ("td:", "fh:", "sr:"):
            _cache.invalidate(f"{prefix}{symbol.upper()}")
        return {"cleared": symbol.upper()}
    _cache._store.clear()
    return {"cleared": "all"}


# ── Analysis ──────────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=List[AnalysisResult])
async def analyze_watchlist(request: WatchlistRequest):
    if len(request.tickers) > 20:
        raise HTTPException(400, "Max 20 tickers per request")
    tasks = [_analyze_single(t.upper().strip()) for t in request.tickers]
    return await asyncio.gather(*tasks)


async def _analyze_single(ticker: str) -> AnalysisResult:
    try:
        # Check if all three sources are already cached
        was_cached = all(
            _cache.get(f"{p}{ticker}") is not None
            for p in ("td:", "fh:", "sr:")
        )

        indicators, finnhub, sr = await asyncio.gather(
            fetch_technical_indicators(ticker),
            fetch_finnhub_data(ticker),
            fetch_support_resistance(ticker),
        )

        score, breakdown, signal = compute_score(indicators, finnhub, sr)

        return AnalysisResult(
            ticker=ticker,
            score=round(score, 1),
            signal=signal,
            breakdown=breakdown,
            indicators=indicators,
            analyst=finnhub.get("analyst", {}),
            sentiment=finnhub.get("sentiment", {}),
            support_resistance=sr,
            cached=was_cached,
        )

    except Exception as exc:
        return AnalysisResult(
            ticker=ticker, score=0, signal="ERROR",
            breakdown={}, indicators={}, analyst={},
            sentiment={}, support_resistance={},
            error=str(exc),
        )

# Catch-all SPA routing (must be last)
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith(("analyze","health","cache")):
        raise HTTPException(404)
    idx = STATIC_DIR / "index.html"
    return FileResponse(idx) if idx.exists() else HTTPException(404)
