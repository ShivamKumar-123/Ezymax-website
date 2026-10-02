"""Small in-process TTL caches with single-flight loading.

For hot, read-mostly endpoints whose data changes rarely (instrument lists,
market status, trading catalog, branding by domain, leaderboards, sentiment,
admin dashboard tiles). Each process keeps its own short-lived copy; a cache
is never authoritative for money or permissions — use it only for display
data where a few seconds of staleness is acceptable.

    instruments_cache = TTLCache("instruments", ttl=10.0, maxsize=64)

    async def list_x(segment):
        return await instruments_cache.get_or_load(
            ("list", segment), lambda: _load_from_db(segment),
        )

* single-flight: concurrent misses for the same key share ONE load;
* bounded (oldest entry evicted past ``maxsize``);
* ``invalidate()`` / ``bust_all()`` for pub/sub-driven busting (the gateway
  wires ``config:instruments:reload`` to bust instrument caches).
"""
from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from typing import Any, Awaitable, Callable, Hashable

_registry: dict[str, "TTLCache"] = {}


class _LoadFailed(Exception):
    """Signals waiters that the shared load did not produce a value."""


class TTLCache:
    def __init__(self, name: str, ttl: float, maxsize: int = 256) -> None:
        self.name = name
        self.ttl = float(ttl)
        self.maxsize = int(maxsize)
        self._data: "OrderedDict[Hashable, tuple[float, Any]]" = OrderedDict()
        self._inflight: dict[Hashable, asyncio.Future] = {}
        self.hits = 0
        self.misses = 0
        _registry[name] = self

    def get(self, key: Hashable, default: Any = None) -> Any:
        hit = self._data.get(key)
        if hit is None or hit[0] < time.monotonic():
            return default
        return hit[1]

    def set(self, key: Hashable, value: Any) -> None:
        self._data[key] = (time.monotonic() + self.ttl, value)
        self._data.move_to_end(key)
        while len(self._data) > self.maxsize:
            self._data.popitem(last=False)

    def invalidate(self, key: Hashable | None = None) -> None:
        if key is None:
            self._data.clear()
        else:
            self._data.pop(key, None)

    async def get_or_load(self, key: Hashable, loader: Callable[[], Awaitable[Any]]) -> Any:
        hit = self._data.get(key)
        if hit is not None and hit[0] >= time.monotonic():
            self.hits += 1
            return hit[1]
        self.misses += 1
        fut = self._inflight.get(key)
        if fut is not None:
            try:
                return await asyncio.shield(fut)
            except _LoadFailed:
                # The leader's load failed (or its request was cancelled) —
                # load for ourselves rather than inherit someone else's error.
                return await loader()
        loop = asyncio.get_running_loop()
        fut = loop.create_future()
        self._inflight[key] = fut
        try:
            value = await loader()
        except BaseException:
            self._inflight.pop(key, None)
            if not fut.done():
                fut.set_exception(_LoadFailed())
                # Mark retrieved so a waiter-less failure doesn't log noise.
                fut.exception()
            raise
        self._inflight.pop(key, None)
        self.set(key, value)
        if not fut.done():
            fut.set_result(value)
        return value


def bust_all(*_args, **_kwargs) -> None:
    """Clear every registered cache (pub/sub callback; signature-agnostic)."""
    for c in _registry.values():
        c.invalidate()


def get_cache(name: str) -> TTLCache | None:
    return _registry.get(name)
