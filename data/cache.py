"""
cache.py  —  simple in-memory TTL cache (no extra dependencies)
"""
import time
import asyncio
import logging
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)

_store: dict[str, tuple[float, Any]] = {}   # key → (expires_at, value)
_locks: dict[str, asyncio.Lock]       = {}


def _lock(key: str) -> asyncio.Lock:
    if key not in _locks:
        _locks[key] = asyncio.Lock()
    return _locks[key]


def get(key: str) -> Any | None:
    entry = _store.get(key)
    if entry and time.monotonic() < entry[0]:
        return entry[1]
    return None


def set(key: str, value: Any, ttl_seconds: int) -> None:
    _store[key] = (time.monotonic() + ttl_seconds, value)


def invalidate(key: str) -> None:
    _store.pop(key, None)


def stats() -> dict:
    now = time.monotonic()
    live = {k: round(v[0] - now, 0) for k, v in _store.items() if v[0] > now}
    return {"cached_keys": len(live), "entries": live}


async def get_or_fetch(
    key: str,
    fetch_fn: Callable[[], Awaitable[Any]],
    ttl_seconds: int,
) -> Any:
    """
    Return cached value if fresh, otherwise call fetch_fn(), cache and return result.
    Uses per-key lock to prevent duplicate in-flight requests (cache stampede).
    """
    cached = get(key)
    if cached is not None:
        logger.debug("Cache HIT  %s", key)
        return cached

    async with _lock(key):
        # Double-check after acquiring lock
        cached = get(key)
        if cached is not None:
            logger.debug("Cache HIT (post-lock) %s", key)
            return cached

        logger.debug("Cache MISS %s — fetching", key)
        result = await fetch_fn()
        set(key, result, ttl_seconds)
        return result
