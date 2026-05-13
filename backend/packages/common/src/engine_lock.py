"""Distributed leader-election for background engines.

Why this exists
---------------
The gateway runs with ``uvicorn --workers N`` (currently 2 in
``docker-compose.prod.yml``). Each worker is a separate OS process and
each starts a copy of the gateway lifespan, which means each background
engine (SL/TP, overnight-fee, staking, copy, etc.) has *N* concurrent
instances. Without coordination, two workers detecting the same trigger
on the same row both write side-effect rows (duplicate TradeHistory,
duplicate Transactions, double-charged swap, etc.).

The fix is a classic Redis SETNX leader lock: at the top of every
engine tick, only the worker that wins the SETNX runs the tick body;
the rest immediately return. The lock auto-expires after a TTL so a
crashed worker can't deadlock the engine forever.

Usage
-----
::

    async def _tick(self):
        async with engine_lock("sltp", ttl_seconds=10) as is_leader:
            if not is_leader:
                return
            await self._do_work()

Failure mode
------------
If Redis is unreachable, ``engine_lock`` yields ``False`` (fail-closed)
so no worker runs the tick. We'd rather skip an engine tick than
double-process under degraded infra. Engines are non-critical for the
few seconds Redis is typically unreachable; correctness > availability
here.

TTL guidance
------------
TTL should be longer than the maximum expected tick duration, but
short enough that crash-recovery is fast:

* High-frequency ticks (1-5 s):     ttl_seconds=10
* Medium ticks (30-60 s):           ttl_seconds=120
* Hourly / nightly engines:         ttl_seconds=300-600
"""
from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from .redis_client import redis_client

logger = logging.getLogger("engine_lock")

_LOCK_PREFIX = "engine_lock:"

# Lua script that releases the lock ONLY if we still own it. Without
# this, a slow worker whose TTL expired could be racing a different
# worker that grabbed the (now-free) lock — and a naive DEL would yank
# the new holder's lock out from under them. The CAS check makes the
# release idempotent and safe under TTL expiry.
_RELEASE_LUA = """
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
"""


@asynccontextmanager
async def engine_lock(name: str, ttl_seconds: int = 60) -> AsyncIterator[bool]:
    """Acquire a distributed lock for one engine tick.

    Yields ``True`` if this worker is the leader for this tick (caller
    should do the work), ``False`` if another worker holds the lock
    (caller should skip).

    Args:
        name: engine identifier, e.g. ``"sltp"`` or ``"overnight_fee"``.
        ttl_seconds: auto-release time-to-live. Should be greater than
            the maximum expected tick duration. See module docstring.
    """
    key = f"{_LOCK_PREFIX}{name}"
    token = uuid.uuid4().hex
    acquired = False
    try:
        try:
            # SET key token NX EX ttl  -> returns True if we set it.
            acquired = bool(await redis_client.set(key, token, nx=True, ex=ttl_seconds))
        except Exception as exc:
            # Redis unreachable / connection blip -> fail-closed.
            logger.warning("engine_lock(%s): redis acquire failed (%s); skipping tick", name, exc)
            acquired = False
        yield acquired
    finally:
        if acquired:
            try:
                await redis_client.eval(_RELEASE_LUA, 1, key, token)
            except Exception as exc:
                # Release failed -> the lock will simply expire after
                # TTL on its own; no integrity problem. Log so ops
                # notices a pattern of Redis flakiness.
                logger.warning("engine_lock(%s): redis release failed (%s)", name, exc)
