"""Shared trader-credential helpers (Section D hardening).

Small, dependency-light building blocks used by the gateway auth paths:

  * ``redis_cap``            — atomic INCR+EXPIRE counter with an explicit
                               fail-closed / fail-open choice (the per-IP
                               ``rate_limit_http`` cannot express per-email or
                               per-user caps that survive IP rotation).
  * ``verify_totp_once``     — TOTP verification with replay protection: a
                               Redis "last accepted time-step" compare-and-set
                               per user, so a code observed once (shoulder
                               surf, phishing proxy, log) cannot be replayed
                               inside its 30-90 s validity window.
  * ``dummy_password_check`` — burns one bcrypt verification for unknown
                               accounts so login timing does not reveal
                               whether an email is registered.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger("user_credentials")

# bcrypt only looks at the first 72 BYTES of a password (UTF-8 encoded).
BCRYPT_MAX_PASSWORD_BYTES = 72

TOTP_PERIOD_S = 30
TOTP_VALID_WINDOW = 1  # accept the previous / current / next 30 s step


def _redis():
    from .redis_client import redis_client
    return redis_client


# ─── Atomic counters ─────────────────────────────────────────────────────


async def redis_cap(
    key: str,
    limit: int,
    window_s: int,
    *,
    fail_closed: bool = True,
    detail: str = "Too many attempts. Please try again later.",
    client=None,
) -> int:
    """Count one hit on ``key`` and refuse (429) once ``limit`` is exceeded
    within ``window_s``. INCR is atomic, so concurrent requests can never
    both observe the last free slot.

    Redis unavailable → 503 when ``fail_closed`` (security caps such as the
    password-reset budget must not silently disappear), otherwise the hit is
    allowed and 0 is returned."""
    try:
        r = client if client is not None else _redis()
        n = int(await r.incr(key))
        if n == 1:
            await r.expire(key, int(window_s))
    except Exception as e:  # pragma: no cover - exercised via stubs
        if fail_closed:
            logger.warning("redis_cap(%s) unavailable — failing closed: %s", key.split(":")[0], e)
            raise HTTPException(
                status_code=503,
                detail="Service temporarily unavailable. Please try again shortly.",
            )
        return 0
    if n > limit:
        raise HTTPException(status_code=429, detail=detail)
    return n


# ─── TOTP with replay protection ─────────────────────────────────────────

# KEYS[1] = last-step key, ARGV[1] = candidate step, ARGV[2] = ttl seconds.
# Accept only a step strictly greater than the last accepted one.
_TOTP_CAS_LUA = """
local last = tonumber(redis.call('GET', KEYS[1]) or '-1')
local cand = tonumber(ARGV[1])
if cand <= last then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[2]))
return 1
"""


def _matching_totp_step(secret: str, code: str, now: Optional[float] = None) -> Optional[int]:
    """Return the time-step counter whose TOTP equals ``code`` (within the
    ±1 step window), or None. Constant-time comparison per candidate."""
    import hmac

    import pyotp

    code = (code or "").strip().replace(" ", "")
    if not code.isdigit() or len(code) != 6:
        return None
    totp = pyotp.TOTP(secret)
    t = time.time() if now is None else now
    base = int(t // TOTP_PERIOD_S)
    match = None
    for off in range(-TOTP_VALID_WINDOW, TOTP_VALID_WINDOW + 1):
        step = base + off
        if hmac.compare_digest(totp.generate_otp(step), code):
            match = step  # keep looping — timing independent of which step matched
    return match


# Process-local fallback for the replay check while Redis is unreachable.
# Blocks replay within this worker; Redis is authoritative across workers.
_LOCAL_LAST_STEP: dict[str, int] = {}


def _local_cas(key: str, step: int) -> bool:
    if len(_LOCAL_LAST_STEP) > 50_000:
        _LOCAL_LAST_STEP.clear()
    if step <= _LOCAL_LAST_STEP.get(key, -1):
        return False
    _LOCAL_LAST_STEP[key] = step
    return True


async def verify_totp_once(
    user_id, secret: str, code: str, *, scope: str = "user", client=None,
) -> bool:
    """True iff ``code`` is a valid TOTP for ``secret`` AND its time-step is
    newer than the last step accepted for this user (replay blocked).

    The compare-and-set runs atomically in Redis (Lua). When Redis is
    unreachable it degrades to a per-process last-step map (still blocks
    replay on this worker) instead of locking every 2FA user out."""
    if not secret:
        return False
    step = _matching_totp_step(secret, code)
    if step is None:
        return False
    key = f"totp_last_step:{scope}:{user_id}"
    ttl = TOTP_PERIOD_S * (2 * TOTP_VALID_WINDOW + 2)
    # The local map is always updated too, so a Redis outage that starts
    # right after an accept still remembers the step on this worker.
    local_ok = _local_cas(key, step)
    try:
        r = client if client is not None else _redis()
        if hasattr(r, "eval"):
            ok = await r.eval(_TOTP_CAS_LUA, 1, key, str(step), str(ttl))
        else:  # minimal stubs: GET + SET (tests only)
            last = await r.get(key)
            last_i = int(last) if last is not None else -1
            ok = 0
            if step > last_i:
                await r.set(key, str(step), ex=ttl)
                ok = 1
        return bool(int(ok or 0)) and local_ok
    except Exception as e:
        logger.warning("TOTP replay check: Redis unavailable, using local fallback: %s", e)
        return local_ok


# ─── Enumeration resistance ──────────────────────────────────────────────

_DUMMY_HASH: Optional[str] = None


def dummy_password_check(password: str) -> None:
    """Spend the same bcrypt work as a real verification so a missing
    account is not distinguishable by response time."""
    global _DUMMY_HASH
    from .auth import hash_password, verify_password
    try:
        if _DUMMY_HASH is None:
            _DUMMY_HASH = hash_password("dummy-password-for-timing-only")
        verify_password(password or "", _DUMMY_HASH)
    except Exception:
        pass


def password_within_bcrypt_limit(password: str) -> bool:
    return len((password or "").encode("utf-8")) <= BCRYPT_MAX_PASSWORD_BYTES
