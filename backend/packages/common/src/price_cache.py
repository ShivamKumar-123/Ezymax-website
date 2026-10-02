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
- Fed from `PriceChannel.PRICE_CHANNEL` (one global channel where
  market-data publishes every tick) — either through the process-wide
  pub/sub hub (`start(hub=...)`, gateway) or its own listener.
- Callers ask for `await price_cache.get(symbol)` which returns the
  same JSON string `redis_client.get(...)` would have.
- Section F: every entry carries the monotonic time it was last refreshed.
  An entry older than PRICE_CACHE_STALE_SEC (listener stalled, pub/sub
  connection silently dead, symbol quiet) is re-read from Redis instead of
  being served forever; the re-read result refreshes the entry, so a closed
  market costs at most one Redis GET per symbol per window.

Lifecycle
---------
- `await price_cache.start()` — call once at gateway boot, before
  accepting HTTP traffic. Idempotent.
- `await price_cache.stop()` — call from the shutdown hook.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
from typing import Optional

from .redis_client import PriceChannel, redis_client

logger = logging.getLogger("price_cache")


def _stale_after() -> float:
    try:
        from .config import get_settings
        return float(getattr(get_settings(), "PRICE_CACHE_STALE_SEC", 5.0) or 5.0)
    except Exception:
        return 5.0


class PriceCache:
    """Process-local, pub/sub-fed tick cache (single-threaded asyncio)."""

    def __init__(self) -> None:
        # symbol -> (raw JSON, monotonic time it was stored)
        self._entries: dict[str, tuple[str, float]] = {}
        self._task: Optional[asyncio.Task] = None
        self._hub_sub = None
        self._running = False

    # Back-compat view: symbol -> raw JSON.
    @property
    def _cache(self) -> dict[str, str]:
        return {k: v[0] for k, v in self._entries.items()}

    async def start(self, hub=None) -> None:
        """Start feeding the cache. With ``hub`` the process-wide pub/sub hub
        is used (no extra Redis connection); otherwise a private listener."""
        if self._running:
            return
        self._running = True
        if hub is not None:
            self._hub_sub = hub.subscribe(PriceChannel.PRICE_CHANNEL, self._on_hub_message)
            logger.info("price_cache: fed by pubsub hub")
            return
        self._task = asyncio.create_task(self._listen_loop(), name="price_cache_listener")
        logger.info("price_cache: subscriber started")

    async def stop(self) -> None:
        self._running = False
        if self._hub_sub is not None:
            self._hub_sub.close()
            self._hub_sub = None
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None
        logger.info("price_cache: subscriber stopped")

    def ingest(self, symbol: str, raw: str) -> None:
        sym = (symbol or "").upper()
        if sym and isinstance(raw, str):
            self._entries[sym] = (raw, time.monotonic())

    def _on_hub_message(self, _channel, raw, parsed) -> None:
        if parsed is None:
            return
        self.ingest(str(parsed.get("symbol") or ""), raw)

    async def get(self, symbol: str) -> Optional[str]:
        """Return the JSON tick string for ``symbol``, or None.

        Same return shape as ``redis_client.get(PriceChannel.tick_key(s))``.
        Falls through to Redis on a miss or a stale entry."""
        sym = (symbol or "").upper()
        if not sym:
            return None
        entry = self._entries.get(sym)
        now = time.monotonic()
        if entry is not None and (now - entry[1]) < _stale_after():
            return entry[0]
        try:
            raw = await redis_client.get(PriceChannel.tick_key(sym))
        except Exception as exc:
            logger.debug("price_cache: Redis fallback failed for %s: %s", sym, exc)
            # Redis down: an old cached value beats nothing (same as before).
            return entry[0] if entry is not None else None
        if raw is not None:
            self._entries[sym] = (raw, now)
            return raw
        # Live tick expired — e.g. forex/indices whose market is closed over the
        # weekend. Serve the durable last-known price so the UI shows the last
        # price instead of "-". Deliberately NOT cached: keep re-checking tick:
        # so the moment a live quote returns we pick it up.
        if entry is not None:
            self._entries.pop(sym, None)
        try:
            return await redis_client.get(PriceChannel.last_price_key(sym))
        except Exception as exc:
            logger.debug("price_cache: last_price fallback failed for %s: %s", sym, exc)
            return None

    async def _listen_loop(self) -> None:
        """Private listener (processes without the hub). Auto-reconnects."""
        from .redis_client import redis_pubsub_client
        backoff = 1.0
        while self._running:
            pubsub = None
            try:
                pubsub = redis_pubsub_client.pubsub(ignore_subscribe_messages=True)
                await pubsub.subscribe(PriceChannel.PRICE_CHANNEL)
                backoff = 1.0
                async for msg in pubsub.listen():
                    if not self._running:
                        break
                    if msg is None:
                        continue
                    data = msg.get("data")
                    if not isinstance(data, str):
                        continue
                    try:
                        sym = (json.loads(data).get("symbol") or "").upper()
                    except (json.JSONDecodeError, AttributeError):
                        continue
                    self.ingest(sym, data)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning(
                    "price_cache: subscriber error: %s — reconnect in %.0fs", exc, backoff,
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
