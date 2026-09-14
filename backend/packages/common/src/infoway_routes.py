"""Where each platform symbol is quoted on Infoway.

Infoway serves each asset class on its own business (socket + REST path) with
its own code convention, verified live against the WebSocket and batch_kline:

    forex / metals / energy / indices -> common  + identity code
    crypto                            -> crypto  + <BASE>USDT
    US stocks                         -> stock   + <TICKER>.US

The segment decides the business, so a symbol added from the admin panel is
routed correctly without anyone editing a hardcoded list. market-data derives
the routes from the database and publishes them to Redis; the chart-history
REST client in the gateway reads them back, so both sides agree on the code.
"""
from __future__ import annotations

import logging
import time
from typing import Dict, Optional, Tuple

logger = logging.getLogger("infoway_routes")

ROUTES_KEY = "infoway:routes"

# Platform symbols whose Infoway code differs from the symbol itself.
CODE_OVERRIDE = {"NATGAS": "NGAS", "US100": "NAS100"}

_ROUTES_TTL_SEC = 60.0
_cache: Dict[str, Tuple[str, str]] = {}
_loaded_at = 0.0


def route_for(symbol: str, segment: Optional[str]) -> Tuple[str, str]:
    """Return (business, infoway_code) for a platform symbol in a segment."""
    s = (symbol or "").strip().upper()
    seg = (segment or "").strip().lower()
    if seg == "crypto":
        base = s[:-3] if s.endswith("USD") else s
        return "crypto", base + "USDT"
    if seg in ("stocks", "stock"):
        return "stock", s + ".US"
    return "common", CODE_OVERRIDE.get(s, s)


async def publish_routes(routes: Dict[str, Tuple[str, str]]) -> None:
    """Replace the shared route table in one transaction."""
    if not routes:
        return
    from .redis_client import redis_client

    pipe = redis_client.pipeline(transaction=True)
    pipe.delete(ROUTES_KEY)
    pipe.hset(ROUTES_KEY, mapping={s: f"{b}|{c}" for s, (b, c) in routes.items()})
    await pipe.execute()


async def cached_routes() -> Dict[str, Tuple[str, str]]:
    """The route table market-data published, refreshed at most once a minute.

    Returns the last good table on a Redis failure — a chart request should
    fall back to the built-in routing, never error.
    """
    global _cache, _loaded_at
    now = time.monotonic()
    if now - _loaded_at < _ROUTES_TTL_SEC:
        return _cache
    _loaded_at = now
    try:
        from .redis_client import redis_client

        raw = await redis_client.hgetall(ROUTES_KEY)
        parsed: Dict[str, Tuple[str, str]] = {}
        for k, v in (raw or {}).items():
            k = k.decode() if isinstance(k, bytes) else k
            v = v.decode() if isinstance(v, bytes) else v
            business, _, code = str(v).partition("|")
            if business and code:
                parsed[str(k).upper()] = (business, code)
        if parsed:
            _cache = parsed
    except Exception as exc:  # noqa: BLE001
        logger.debug("route table read failed: %s", exc)
    return _cache
