"""
main.py
=======
Two analysis endpoints:

  POST /analyze
    Classic: waits for all three sources, returns complete JSON array.
    Best for: cached results (instant), watchlist batch runs.

  GET /analyze/stream?tickers=AAPL,META
    Server-Sent Events: streams one JSON event per source as it completes.
    Best for: first-time fetches — browser renders progressively.
    Event order: finnhub (~1.5s) → sr (~3s) → indicators+score (~4s)

The frontend uses /analyze/stream for new tickers and /analyze for cached ones.
"""

import asyncio
import json
import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator
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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sse(event: str, data: dict) -> str:
    """Format a Server-Sent Event frame."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _is_fully_cached(ticker: str) -> bool:
    return all(_cache.get(f"{p}{ticker}") is not None for p in ("td:", "fh:", "sr:"))


# ── Classic batch endpoint (best for cached / watchlist runs) ─────────────────

@app.post("/analyze", response_model=List[AnalysisResult])
async def analyze_watchlist(request: WatchlistRequest):
    if len(request.tickers) > 20:
        raise HTTPException(400, "Max 20 tickers per request")
    tasks = [_analyze_single(t.upper().strip()) for t in request.tickers]
    return await asyncio.gather(*tasks)


async def _analyze_single(ticker: str) -> AnalysisResult:
    try:
        was_cached = _is_fully_cached(ticker)
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


# ── Streaming endpoint (SSE — best for first-time uncached fetches) ───────────

@app.get("/analyze/stream")
async def analyze_stream(tickers: str = Query(..., description="Comma-separated tickers")):
    """
    Server-Sent Events endpoint. Streams partial results per ticker as each
    data source completes. The browser can render each section immediately.

    Event types emitted per ticker:
      partial   — finnhub data ready (analyst + sentiment, ~1.5s)
      partial   — support/resistance ready (~3s)
      complete  — indicators + final score ready (~4s)
      error     — fetch failed for this ticker

    Final event:
      done      — all tickers finished
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:20]
    if not ticker_list:
        raise HTTPException(400, "No valid tickers provided")

    async def event_stream() -> AsyncGenerator[str, None]:
        # Keep-alive comment so browsers don't time out immediately
        yield ": keep-alive\n\n"

        # Run all tickers concurrently; each ticker streams its own events
        async def stream_one(ticker: str):
            events: list[str] = []
            try:
                # Fire all three sources concurrently using tasks so we can
                # yield partial results as each one finishes
                fh_task  = asyncio.create_task(fetch_finnhub_data(ticker))
                sr_task  = asyncio.create_task(fetch_support_resistance(ticker))
                td_task  = asyncio.create_task(fetch_technical_indicators(ticker))

                # Finnhub usually fastest — yield analyst + sentiment first
                finnhub = await fh_task
                events.append(_sse("partial", {
                    "ticker":    ticker,
                    "section":   "sentiment",
                    "analyst":   finnhub.get("analyst", {}),
                    "sentiment": finnhub.get("sentiment", {}),
                }))

                # S/R next
                sr = await sr_task
                events.append(_sse("partial", {
                    "ticker":           ticker,
                    "section":          "support_resistance",
                    "support_resistance": sr,
                }))

                # Indicators last — then we can compute the final score
                indicators = await td_task
                score, breakdown, signal = compute_score(indicators, finnhub, sr)
                events.append(_sse("complete", {
                    "ticker":             ticker,
                    "score":              round(score, 1),
                    "signal":             signal,
                    "breakdown":          breakdown,
                    "indicators":         indicators,
                    "analyst":            finnhub.get("analyst", {}),
                    "sentiment":          finnhub.get("sentiment", {}),
                    "support_resistance": sr,
                    "cached":             False,
                }))

            except Exception as exc:
                events.append(_sse("error", {"ticker": ticker, "error": str(exc)}))

            return events

        # Run all tickers, collect their event lists
        all_event_lists = await asyncio.gather(*[stream_one(t) for t in ticker_list])

        # Yield all events in source-completion order
        # (finnhub events for all tickers, then sr events, then complete events)
        for event_list in all_event_lists:
            for event in event_list:
                yield event

        yield _sse("done", {"tickers": ticker_list})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",   # disables nginx buffering
        },
    )


# ── Catch-all SPA routing (must be last) ──────────────────────────────────────

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith(("analyze", "health", "cache")):
        raise HTTPException(404)
    idx = STATIC_DIR / "index.html"
    return FileResponse(idx) if idx.exists() else HTTPException(404)
