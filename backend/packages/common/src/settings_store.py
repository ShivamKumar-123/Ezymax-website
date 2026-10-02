"""System Settings Store — reads admin settings from DB with Redis caching.

Section F (hot path):
  * a 2 s in-process copy in front of Redis (most callers read the same few
    keys on every request / engine tick);
  * negative caching — a key that does not exist in ``system_settings`` is
    remembered (in-process and in Redis) instead of hitting Postgres on every
    call, which is what happened for every unset setting before;
  * ``invalidate_cache()`` also publishes on ``SETTINGS_RELOAD_CHANNEL`` and
    every process that wired ``bust_local_cache`` to that channel (the gateway
    does, via the pub/sub hub) drops its in-process copy immediately.
"""
import json
import logging
import time
from typing import Any

from .redis_client import redis_client

logger = logging.getLogger("settings-store")

CACHE_KEY = "system_settings_cache"
CACHE_TTL = 5
LOCAL_TTL = 2.0
SETTINGS_RELOAD_CHANNEL = "config:settings:reload"

# Sentinel stored for "row does not exist" (never a legitimate JSON value).
_MISSING_JSON = '{"__missing__": true}'
_MISSING = object()

# key -> (value | _MISSING, monotonic expiry)
_local: dict[str, tuple[Any, float]] = {}


def bust_local_cache(*_args, **_kwargs) -> None:
    """Drop the in-process copy (pub/sub bust callback; signature-agnostic)."""
    _local.clear()


def _local_get(key: str):
    hit = _local.get(key)
    if hit is None:
        return None
    if hit[1] < time.monotonic():
        _local.pop(key, None)
        return None
    return hit


def _local_put(key: str, value: Any) -> None:
    _local[key] = (value, time.monotonic() + LOCAL_TTL)


def _decode(cached: str) -> Any:
    if cached == _MISSING_JSON:
        return _MISSING
    try:
        return json.loads(cached)
    except (json.JSONDecodeError, TypeError):
        return cached


async def get_system_setting(key: str, default: Any = None) -> Any:
    hit = _local_get(key)
    if hit is not None:
        return default if hit[0] is _MISSING else hit[0]

    try:
        cached = await redis_client.hget(CACHE_KEY, key)
        if cached is not None:
            val = _decode(cached)
            _local_put(key, val)
            return default if val is _MISSING else val
    except Exception:
        pass

    try:
        from .database import AsyncSessionLocal
        from .models import SystemSetting
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
            setting = result.scalar_one_or_none()
        val = setting.value if setting else _MISSING
        try:
            await redis_client.hset(CACHE_KEY, key, _MISSING_JSON if val is _MISSING else json.dumps(val))
            await redis_client.expire(CACHE_KEY, CACHE_TTL)
        except Exception:
            pass
        _local_put(key, val)
        return default if val is _MISSING else val
    except Exception as e:
        logger.error(f"Failed to read setting {key}: {e}")

    return default


async def get_bool_setting(key: str, default: bool = False) -> bool:
    val = await get_system_setting(key, default)
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("true", "1", "yes")
    return bool(val)


async def get_float_setting(key: str, default: float = 0.0) -> float:
    val = await get_system_setting(key, default)
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


async def get_int_setting(key: str, default: int = 0) -> int:
    val = await get_system_setting(key, default)
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return default


async def invalidate_cache():
    bust_local_cache()
    try:
        await redis_client.delete(CACHE_KEY)
    except Exception:
        pass
    try:
        await redis_client.publish(SETTINGS_RELOAD_CHANNEL, "1")
    except Exception:
        pass
