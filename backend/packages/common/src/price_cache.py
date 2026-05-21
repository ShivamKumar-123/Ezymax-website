"""In-memory tick cache fed by Redis pub/sub.

Why this exists
---------------
Every gateway request that needs a price was doing:

    tick_json = await redis_client.get(PriceChannel.tick_key(symbol))

That's a network round-trip to Redis (~1–5 ms) for every symbol the
handler touches. A user opening Portfolio with 50 open positions
serialised 50 of those — 50–250 ms of dead time per page. With this
cache the same data is served from a process-local dict in
microseconds, and Redis stays cold for reads.

How it works
------------
- Background task subscribes to `PriceChannel.PRICE_CHANNEL` (one
  global channel where market-data publishes every tick).
- On each pub/sub message we store the raw JSON string in
  `_cache[symbol]`.
- Callers ask for `await price_cache.get(symbol)` which returns the
  same JSON string `redis_client.get(...)` would have. On cache miss
  (symbol never seen) we fall through to Redis exactly once so first
  hits aren't blocked by a slow tick.
- Caller-side parsing (`json.loads(tick_data)`) is unchanged — the
  cache returns the same string shape so the migration is a one-line
  swap at each call site.

Lifecycle
---------
- `await price_cache.start()` — call once at gateway boot, before
  accepting HTTP traffic. Cancellable; no-op if already running.
- `await price_cache.stop()` — call from the shutdown hook so the
  background task exits cleanly.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from typing import Optional

from .redis_client import PriceChannel, redis_client

logger = logging.getLogger("price_cache")


class PriceCache:
    """Process-local, pub/sub-fed tick cache.

    Thread-safety: not needed — gateway is single-process asyncio. The
    dict mutations are atomic at Python bytecode level for assignment.
    """

    def __init__(self) -> None:
        self._cache: dict[str, str] = {}
        self._task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        """Spawn the pub/sub subscriber. Idempotent."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._listen_loop(), name="price_cache_listener")
        logger.info("price_cache: subscriber started")

    async def stop(self) -> None:
        """Cancel the background subscriber."""
        self._running = False
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None
        logger.info("price_cache: subscriber stopped")

    async def get(self, symbol: str) -> Optional[str]:
        """Return the JSON tick string for ``symbol``, or None.

        Same return shape as ``redis_client.get(PriceChannel.tick_key(s))``
        so call sites only need to swap the line. Falls through to Redis
        on cache miss (first request for a symbol before any tick has
        been seen on pub/sub).
        """
        sym = (symbol or "").upper()
        if not sym:
            return None
        cached = self._cache.get(sym)
        if cached is not None:
            return cached
        # Cold miss: pull from Redis once and warm the cache. Avoids
        # blanking the UI for symbols that haven't ticked since gateway
        # boot.
        try:
            raw = await redis_client.get(PriceChannel.tick_key(sym))
        except Exception as exc:
            logger.debug("price_cache: Redis fallback failed for %s: %s", sym, exc)
            return None
        if raw is not None:
            self._cache[sym] = raw
        return raw

    async def _listen_loop(self) -> None:
        """Subscribe to the global price channel and copy ticks into
        the local map. Auto-reconnects on Redis disconnect."""
        backoff = 1.0
        while self._running:
            pubsub = None
            try:
                pubsub = redis_client.pubsub(ignore_subscribe_messages=True)
                await pubsub.subscribe(PriceChannel.PRICE_CHANNEL)
                logger.info(
                    "price_cache: subscribed to channel '%s'",
                    PriceChannel.PRICE_CHANNEL,
                )
                backoff = 1.0  # reset on successful subscribe
                async for msg in pubsub.listen():
                    if not self._running:
                        break
                    if msg is None:
                        continue
                    data = msg.get("data")
                    if not isinstance(data, str):
                        continue
                    # The publisher serialises {"symbol", "bid", "ask",
                    # "timestamp", "spread"} as JSON. We only need the
                    # symbol to index — store the raw string so readers
                    # see exactly what Redis would have returned.
                    try:
                        parsed = json.loads(data)
                        sym = (parsed.get("symbol") or "").upper()
                    except (json.JSONDecodeError, AttributeError):
                        continue
                    if sym:
                        self._cache[sym] = data
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning(
                    "price_cache: subscriber error: %s — reconnect in %.0fs",
                    exc, backoff,
                )
                await asyncio.sleep(backoff)
                backoff = min(30.0, backoff * 2)
            finally:
                if pubsub is not None:
                    with contextlib.suppress(Exception):
                        await pubsub.unsubscribe(PriceChannel.PRICE_CHANNEL)
                    with contextlib.suppress(Exception):
                        await pubsub.aclose()


# Module-level singleton — every gateway import shares the same cache.
price_cache = PriceCache()
