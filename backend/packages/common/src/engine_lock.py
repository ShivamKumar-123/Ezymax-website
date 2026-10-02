"""Distributed leader-election for background engines (v2).

Why this exists
---------------
The gateway runs with ``uvicorn --workers N`` (currently 2 in
``docker-compose.prod.yml``) and, horizontally scaled, as several replicas.
Each process starts a copy of every background engine (SL/TP, overnight fee,
copy, statements …). Without coordination two processes detecting the same
trigger on the same row both write side-effect rows (duplicate TradeHistory,
duplicate Transactions, double-charged swap, …).

v2 semantics
------------
* **Renewing lease.** While the tick body runs, a background task renews the
  lease every ``ttl/3`` seconds, so a tick that runs longer than the TTL does
  not silently lose leadership to a second process mid-tick. If a renewal
  finds the lease gone (Redis flush / clock skew / partition) ``lease.lost``
  flips to True and an error is logged — long bodies may check it between
  batches and stop early.
* **Fencing counter.** Every fresh acquisition INCRs
  ``engine_lock:fence:{name}``; the value is exposed as ``lease.fence``.
  A strictly increasing token lets a write path reject a stale leader.
* **Sticky leadership.** The lease is NOT released at the end of a tick: the
  same process renews it on its next tick (owner check by a per-process
  token). Leadership therefore stays on one process instead of ping-ponging
  between workers every tick — which mattered for engines that keep per-cycle
  state — and moves only when the leader stops ticking (crash / shutdown /
  stall) for longer than the TTL. ``release_all()`` (called from the lifespan
  shutdown hook) hands leadership over immediately on a graceful stop.
* **Fail-closed.** If Redis is unreachable the lease is falsy and no process
  runs the tick (skip > double-process).

Usage (unchanged)
-----------------
::

    async with engine_lock("sltp", ttl_seconds=10) as is_leader:
        if not is_leader:
            return
        await self._do_work()

``is_leader`` is an :class:`EngineLease` that is truthy only for the leader.

TTL guidance
------------
* High-frequency ticks (1-5 s):     ttl_seconds=10
* Medium ticks (30-60 s):           ttl_seconds=120
* Hourly / nightly engines:         ttl_seconds=300-600
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from . import redis_client as _rc

logger = logging.getLogger("engine_lock")

_LOCK_PREFIX = "engine_lock:"
_FENCE_PREFIX = "engine_lock:fence:"

# One owner token per process: sticky leadership means "this process", not
# "this tick". pid + random so a forked worker never inherits its parent's.
_PROCESS_TOKEN = f"{os.getpid()}:{uuid.uuid4().hex}"
_held: set[str] = set()
# Names whose tick body is executing in THIS process right now. The owner
# token is per process, so without this two coroutines of the same process
# could both "renew" and run the same engine concurrently.
_active: set[str] = set()

# KEYS[1]=lock KEYS[2]=fence  ARGV[1]=token ARGV[2]=ttl_ms
# -> {1, fence} acquired fresh | {2, fence} renewed (already ours) | {0, 0} busy
_ACQUIRE_LUA = """
local cur = redis.call('get', KEYS[1])
if cur == ARGV[1] then
  redis.call('pexpire', KEYS[1], ARGV[2])
  local f = redis.call('get', KEYS[2])
  return {2, tonumber(f) or 0}
end
if cur then
  return {0, 0}
end
redis.call('set', KEYS[1], ARGV[1], 'PX', ARGV[2])
local f = redis.call('incr', KEYS[2])
return {1, f}
"""

# Renew only if still ours.
_RENEW_LUA = """
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
else
  return 0
end
"""

# Release only if still ours (CAS) — a stale holder can never delete the next
# leader's lock.
_RELEASE_LUA = """
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
"""


class EngineLease:
    """Result of an ``engine_lock`` acquisition. Truthy only for the leader."""

    __slots__ = ("name", "acquired", "fence", "lost", "renewed")

    def __init__(self, name: str, acquired: bool, fence: int = 0, renewed: bool = False):
        self.name = name
        self.acquired = acquired
        self.fence = fence
        self.lost = False
        self.renewed = renewed

    def __bool__(self) -> bool:
        return bool(self.acquired) and not self.lost

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"EngineLease({self.name!r}, acquired={self.acquired}, fence={self.fence}, lost={self.lost})"


def _client():
    # Resolved at call time so tests can swap redis_client.redis_client.
    return _rc.redis_client


async def _try_acquire(name: str, ttl_ms: int) -> EngineLease:
    key = f"{_LOCK_PREFIX}{name}"
    res = await _client().eval(
        _ACQUIRE_LUA, 2, key, f"{_FENCE_PREFIX}{name}", _PROCESS_TOKEN, ttl_ms,
    )
    code = int(res[0]) if res else 0
    fence = int(res[1]) if res and len(res) > 1 and res[1] is not None else 0
    if code in (1, 2):
        _held.add(name)
        return EngineLease(name, True, fence, renewed=(code == 2))
    return EngineLease(name, False)


async def _renew_loop(lease: EngineLease, ttl_ms: int) -> None:
    key = f"{_LOCK_PREFIX}{lease.name}"
    interval = max(0.5, ttl_ms / 3000.0)
    while True:
        await asyncio.sleep(interval)
        try:
            ok = await _client().eval(_RENEW_LUA, 1, key, _PROCESS_TOKEN, ttl_ms)
        except Exception as exc:
            # Transient Redis blip: keep trying; the lease survives until TTL.
            logger.warning("engine_lock(%s): renew failed (%s)", lease.name, exc)
            continue
        if not ok:
            lease.lost = True
            _held.discard(lease.name)
            logger.error(
                "engine_lock(%s): lease LOST mid-tick (fence=%s) — another "
                "process may now lead; stop writing", lease.name, lease.fence,
            )
            return


@asynccontextmanager
async def engine_lock(name: str, ttl_seconds: int = 60) -> AsyncIterator[EngineLease]:
    """Acquire (or renew) the leader lease for one engine tick.

    Yields a truthy :class:`EngineLease` when this process leads, a falsy one
    otherwise (including when Redis is unreachable — fail-closed)."""
    ttl_ms = max(1000, int(float(ttl_seconds) * 1000))
    if name in _active:
        # Same engine already running in this process — never double-run.
        yield EngineLease(name, False)
        return
    try:
        lease = await _try_acquire(name, ttl_ms)
    except Exception as exc:
        logger.warning("engine_lock(%s): redis acquire failed (%s); skipping tick", name, exc)
        lease = EngineLease(name, False)

    renew_task: asyncio.Task | None = None
    if lease.acquired:
        _active.add(name)
        try:
            renew_task = asyncio.create_task(_renew_loop(lease, ttl_ms))
        except RuntimeError:
            renew_task = None
    try:
        yield lease
    finally:
        if lease.acquired:
            _active.discard(name)
        if renew_task is not None:
            renew_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await renew_task
        # Sticky: keep the lease (it expires on its own if we stop ticking).


async def release(name: str) -> None:
    """Release ``name`` if this process holds it (CAS)."""
    try:
        await _client().eval(_RELEASE_LUA, 1, f"{_LOCK_PREFIX}{name}", _PROCESS_TOKEN)
    except Exception as exc:
        logger.warning("engine_lock(%s): redis release failed (%s)", name, exc)
    _held.discard(name)


async def release_all() -> None:
    """Graceful shutdown: hand every lease this process holds back now, so a
    peer takes over on its next tick instead of waiting out the TTL."""
    for name in list(_held):
        await release(name)
