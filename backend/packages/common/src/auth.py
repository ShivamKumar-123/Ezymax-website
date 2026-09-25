"""JWT authentication and password utilities."""
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(
    user_id: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
    sid: Optional[str] = None,
    amr: Optional[str] = None,
) -> tuple[str, datetime]:
    # Timezone-aware UTC: avoids asyncpg/timestamptz issues and PyJWT edge cases with naive datetimes.
    now = datetime.now(timezone.utc)
    expires = now + (expires_delta or timedelta(minutes=settings.JWT_ACCESS_EXPIRY_MINUTES))
    payload = {
        "sub": user_id,
        "role": role,
        "exp": expires,
        "iat": now,
    }
    # H-AUTH-3: sid binds the token to a user_sessions row so it can be revoked
    # server-side (logout / password reset / ban) and rejected on the next
    # request; amr records HOW the session was established (login vs bootstrap).
    if sid is not None:
        payload["sid"] = sid
    if amr is not None:
        payload["amr"] = amr
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expires


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _extract_bearer_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials],
) -> Optional[str]:
    if credentials and credentials.scheme.lower() == "bearer" and credentials.credentials:
        return credentials.credentials
    st = get_settings()
    return request.cookies.get(st.ACCESS_TOKEN_COOKIE_NAME)


# Statuses that immediately revoke API access. A JWT alone must not keep a
# banned account alive for the remaining token lifetime (up to 45 minutes) —
# the admin "ban" button has to take effect on the next request.
_BLOCKED_USER_STATUSES = frozenset({"banned", "blocked", "suspended"})
_USER_STATUS_CACHE_TTL_S = 30


async def _get_user_status(user_id: UUID) -> Optional[str]:
    """Current `users.status`, Redis-cached for a few seconds.

    The cache keeps the per-request cost of ban enforcement at one Redis GET
    instead of one Postgres SELECT; a ban therefore takes effect within
    _USER_STATUS_CACHE_TTL_S seconds instead of the token lifetime. Redis
    errors fall through to Postgres — enforcement never silently disables.
    """
    cache_key = f"user_status:{user_id}"
    redis = None
    try:
        from .redis_client import redis_client as redis
        cached = await redis.get(cache_key)
        if cached:
            return cached.decode() if isinstance(cached, bytes) else str(cached)
    except Exception:
        pass

    from sqlalchemy import select

    from .database import AsyncSessionLocal
    from .models import User

    async with AsyncSessionLocal() as db:
        status_val = (
            await db.execute(select(User.status).where(User.id == user_id))
        ).scalar_one_or_none()
    if status_val is not None and redis is not None:
        try:
            await redis.set(cache_key, status_val, ex=_USER_STATUS_CACHE_TTL_S)
        except Exception:
            pass
    return status_val


_SESSION_CACHE_TTL_S = 15


async def _session_is_active(sid: str) -> bool:
    """H-AUTH-3: is the user_sessions row for this token's sid still active?
    Redis-cached briefly (like the status cache) so revocation — logout, password
    reset, ban — takes effect within a few seconds instead of the token lifetime.
    Redis errors fall through to Postgres so enforcement never silently disables.
    A missing session row counts as revoked."""
    cache_key = f"session_active:{sid}"
    redis = None
    try:
        from .redis_client import redis_client as redis
        cached = await redis.get(cache_key)
        if cached is not None:
            v = cached.decode() if isinstance(cached, bytes) else str(cached)
            return v == "1"
    except Exception:
        pass

    from sqlalchemy import select
    from .database import AsyncSessionLocal
    from .models import UserSession

    try:
        sid_uuid = UUID(str(sid))
    except (ValueError, TypeError):
        return False
    async with AsyncSessionLocal() as db:
        is_active = (
            await db.execute(select(UserSession.is_active).where(UserSession.id == sid_uuid))
        ).scalar_one_or_none()
    active = bool(is_active)
    if redis is not None:
        try:
            await redis.set(cache_key, "1" if active else "0", ex=_SESSION_CACHE_TTL_S)
        except Exception:
            pass
    return active


async def invalidate_session_cache(sid) -> None:
    """Best-effort bust of the session-active cache so a revoke is instant."""
    try:
        from .redis_client import redis_client as redis
        await redis.delete(f"session_active:{sid}")
    except Exception:
        pass


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    token = _extract_bearer_token(request, credentials)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(token)
    user_id = UUID(payload["sub"])
    user_status = await _get_user_status(user_id)
    if user_status is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found")
    if user_status in _BLOCKED_USER_STATUSES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    # H-AUTH-3: reject a token whose session was revoked. Tokens minted before
    # this change carry no sid and are grandfathered (they expire within the
    # access-token lifetime); every new token carries a sid.
    sid = payload.get("sid")
    if sid and not await _session_is_active(sid):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session ended. Please sign in again.")
    # The raw admin-impersonation token (impersonated_by, no sid) is only valid as
    # input to /auth/impersonate/redeem → bootstrap. Used directly as a Bearer it
    # would be a 2h, un-revocable, un-flagged session — refuse it.
    if payload.get("impersonated_by") and not sid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    # Mark the user as online for ~5 minutes after this request. The admin
    # users list reads these keys to render an online/offline indicator.
    # 5 minutes is generous enough that brief idle stretches (reading a
    # dashboard, looking at a chart) don't make a user appear to drop off
    # while still rolling forward whenever they touch any authed endpoint.
    # The AuthProvider in the trader app also fires a /auth/me heartbeat
    # every 60s as a safety net for pages that don't poll API on their own.
    # Fire-and-forget so a Redis blip never breaks an authenticated request.
    try:
        from .redis_client import redis_client
        await redis_client.set(f"presence:user:{user_id}", "1", ex=300)
    except Exception:
        pass
    return {
        "user_id": user_id,
        "role": payload["role"],
        # How this session was established: "login", "derived" (refresh),
        # "impersonation" (admin support), or None (legacy token).
        "amr": payload.get("amr"),
        # This request's session id (None for legacy tokens) — lets "sign out
        # other devices" style actions keep the caller's own session.
        "sid": sid,
    }


# Sessions that must NOT perform money-out / account-security actions. An admin
# impersonating a user for support can view and trade-support, but must never
# withdraw, change the payout wallet, touch 2FA/password, or mint API keys.
_RESTRICTED_AMR = {"impersonation"}


async def require_full_session(current_user: dict = Depends(get_current_user)) -> dict:
    """Like get_current_user, but refuses restricted (impersonation) sessions.
    Use on withdrawal / wallet-link / 2FA / password / API-key endpoints."""
    if current_user.get("amr") in _RESTRICTED_AMR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action is not allowed in an impersonation session.",
        )
    return current_user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


async def require_onboarded(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Server-side onboarding gate.

    Blocks every trading / deposit / withdraw / wallet API for users
    who haven't completed onboarding (profile + verified email + linked
    wallet). The frontend OnboardingGate enforces this in the UI; this
    dependency enforces it server-side so the rule cannot be bypassed
    by hitting the API directly.

    Demo accounts and staff (admin / super_admin / employee roles) are
    exempt — same exemption already applied in get_me.

    Reads users.email_verified + users.wallet_address + users.is_demo +
    role + the same profile-field set used by get_me to keep the two
    decisions in sync. Single SELECT — cheap to add to every protected
    endpoint.
    """
    role = current_user.get("role")
    if role in ("admin", "super_admin", "employee"):
        return current_user

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession  # noqa: F401  (annotation hint only)
    from .database import AsyncSessionLocal
    from .models import User

    async with AsyncSessionLocal() as db:
        user = (await db.execute(
            select(User).where(User.id == current_user["user_id"])
        )).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Account not found.")
    if bool(getattr(user, "is_demo", False)):
        return current_user

    is_placeholder = (user.email or "").lower().endswith("@wallet.swisscresta.local")
    profile_complete = bool(
        (user.first_name or "").strip()
        and (user.last_name or "").strip()
        and (user.phone or "").strip()
        and (user.country or "").strip()
        and (user.address or "").strip()
        and (user.city or "").strip()
        and (user.state or "").strip()
        and (user.postal_code or "").strip()
        and user.date_of_birth is not None
    )
    wallet_linked = bool((user.wallet_address or "").strip())
    email_verified = bool(getattr(user, "email_verified", False))

    # Wallet linking gate — mirror of WALLET_LINK_REQUIRED in
    # auth_service.get_me and OnboardingGate.tsx. Temporarily False
    # while the wallet feature is still being completed; per-action
    # wallet checks (e.g. wallet required for withdrawal) still apply
    # independently of this flag.
    WALLET_LINK_REQUIRED = False
    wallet_ok = wallet_linked if WALLET_LINK_REQUIRED else True
    placeholder_block = is_placeholder if WALLET_LINK_REQUIRED else False

    if profile_complete and wallet_ok and email_verified and not placeholder_block:
        return current_user

    # 428 Precondition Required is the closest standard status code for
    # "you need to do something else first". The frontend already maps
    # 401/403/428 to "show me the gate" — this lands cleanly.
    raise HTTPException(
        status_code=428,
        detail="ONBOARDING_INCOMPLETE",
    )


async def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    return current_user
