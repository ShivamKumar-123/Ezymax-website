"""Read 14-bar ATR per instrument from Redis.

Phase 1: market-data service does not yet write the cache, so callers
fall back to a flat default (~0.001 = ~10 pips on EUR/USD). Phase 2
adds the real ATR computation upstream.
"""
from __future__ import annotations

import logging

from ..redis_client import redis_client

logger = logging.getLogger("insurance.volatility")

DEFAULT_ATR = 0.001


def _key(symbol: str) -> str:
    return f"atr:{symbol.upper()}:14"


async def get_atr(symbol: str) -> float:
    """Return the cached 14-bar ATR for `symbol`, or the default if missing."""
    try:
        raw = await redis_client.get(_key(symbol))
        if raw is None:
            return DEFAULT_ATR
        return float(raw)
    except Exception as exc:  # broad: redis hiccup must never break a quote
        logger.debug("ATR fetch failed for %s: %s", symbol, exc)
        return DEFAULT_ATR
