"""Tiny Redis-backed JSON cache for read-only hot endpoints.

The dashboard polls `/auth/me`, `/notifications/unread-count` and a few
other read endpoints every 2-5 seconds. With 1k concurrent users that's
500+ qps against Postgres for data that changes at most once a minute.
This module caches the JSON-serialisable response per (scope, key) with
a short TTL so the second-through-Nth hit in a TTL window doesn't touch
the database.

Design choices:
  * Fail-open. Any Redis error returns None on read / no-op on write so
    a Redis blip doesn't take the app down — the endpoint just degrades
    back to DB-every-poll.
  * TTL is bounded by the freshness the UI needs. /auth/me users can
    tolerate 30s staleness (the AuthProvider sends a heartbeat every
    60s anyway). /notifications/unread-count: 15s — fast enough that a
    new notification surfaces within one poll cycle.
  * No proactive invalidation. Mutations that change the cached value
    rely on TTL expiry; we don't try to be cleverly consistent because
    the windows are short and the cached fields aren't financially
    critical (no "balance" or "open positions").

Anything in the financial hot path (balances, orders, positions) is NOT
cached here — those endpoints must read DB-of-record on every request.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from .redis_client import redis_client

logger = logging.getLogger("cache")


def _make_key(scope: str, key: str) -> str:
    return f"rcache:{scope}:{key}"


async def cache_get(scope: str, key: str) -> Optional[Any]:
    """Return the cached value or None if absent / Redis unreachable."""
    try:
        raw = await redis_client.get(_make_key(scope, key))
    except Exception as e:
        # Fail-open — caller falls back to source-of-truth.
        logger.debug("cache_get %s/%s failed: %s", scope, key, e)
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except Exception:
        # Corrupt entry; drop it so the next caller refetches.
        try:
            await redis_client.delete(_make_key(scope, key))
        except Exception:
            pass
        return None


async def cache_set(scope: str, key: str, value: Any, *, ttl_seconds: int) -> None:
    """Best-effort write — silently no-ops on Redis error."""
    try:
        await redis_client.set(
            _make_key(scope, key),
            json.dumps(value, default=str),
            ex=ttl_seconds,
        )
    except Exception as e:
        logger.debug("cache_set %s/%s failed: %s", scope, key, e)


async def cache_invalidate(scope: str, key: str) -> None:
    """Drop a single cache entry — call from mutation paths that need
    bypass-staleness semantics. Fail-open."""
    try:
        await redis_client.delete(_make_key(scope, key))
    except Exception:
        pass
