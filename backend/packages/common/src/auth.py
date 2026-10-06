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
from .wallet_placeholder import is_wallet_placeholder_email

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


# bcrypt only consumes the first 72 bytes of its input. bcrypt<5 silently
# truncates longer passwords; bcrypt>=5 raises. We refuse to SET a longer
# password (explicit error instead of silent truncation) and, on VERIFY,
# feed bcrypt the same 72-byte prefix older versions hashed — so accounts
# created before the limit keep working on any bcrypt version.
BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    raw = password.encode("utf-8")
    if len(raw) > BCRYPT_MAX_BYTES:
        raise ValueError("Password is too long (maximum 72 bytes).")
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        raw = (password or "").encode("utf-8")[:BCRYPT_MAX_BYTES]
        return bcrypt.checkpw(raw, hashed.encode("utf-8"))
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


# `typ` claim of the short-lived admin impersonation HAND-OFF token (minted by
# the admin service, redeemed once at /auth/impersonate/redeem). Never a
# session token on its own.
IMPERSONATION_HANDOFF_TYP = "impersonation"


async def verify_session_token(token: Optional[str]) -> Optional[dict]:
    """Non-raising twin of get_current_user's token checks for transports
    that cannot use the dependency (WebSocket handshakes). Returns
    {user_id, role, amr, sid} or None when the token is missing, invalid,
    sid-less, a hand-off token, its session was revoked, or the account is
    disabled."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        sid = payload.get("sid")
        if not sid or payload.get("typ") == IMPERSONATION_HANDOFF_TYP:
            return None
        user_id = UUID(str(payload["sub"]))
        user_status = await _get_user_status(user_id)
        if user_status is None or user_status in _BLOCKED_USER_STATUSES:
            return None
        if not await _session_is_active(sid):
            return None
        return {
            "user_id": user_id,
            "role": payload.get("role", "user"),
            "amr": payload.get("amr"),
            "sid": sid,
        }
    except Exception:
        return None


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
    # D5: every legitimate session token carries a `sid` (all trader tokens are
    # minted by issue_auth_json_response — password / Google / wallet / demo /
    # register / refresh / impersonation-redeem — for web, desktop and mobile).
    # A sid-less token is either pre-H-AUTH-3 (long expired) or a raw admin
    # impersonation HAND-OFF token (typ=impersonation / impersonated_by), which
    # is only valid as input to /auth/impersonate/redeem. Used directly as a
    # Bearer it would be an un-revocable session — refuse it.
    sid = payload.get("sid")
    if not sid or payload.get("typ") == IMPERSONATION_HANDOFF_TYP:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        user_id = UUID(str(payload["sub"]))
    except (KeyError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_status = await _get_user_status(user_id)
    if user_status is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found")
    if user_status in _BLOCKED_USER_STATUSES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    # H-AUTH-3: reject a token whose session was revoked.
    if not await _session_is_active(sid):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session ended. Please sign in again.")
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
        "role": payload.get("role", "user"),
        # How this session was established: "login", "derived" (refresh),
        # "impersonation" (admin support).
        "amr": payload.get("amr"),
        # This request's session id — lets "sign out other devices" style
        # actions keep the caller's own session.
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


async def require_not_demo(current_user: dict = Depends(get_current_user)) -> dict:
    """Fence identity / credential / money-request routes off from demo logins.

    `/auth/demo-login` gives anonymous visitors sessions on a shared demo user
    row; any route that mutates that identity (profile, push tokens, support
    tickets, business/provider applications) would let one visitor act on
    every other. Demo logins are for practice trades only."""
    user_id = current_user["user_id"]
    is_demo = None
    cache_key = f"user_is_demo:{user_id}"
    redis = None
    try:
        from .redis_client import redis_client as redis
        cached = await redis.get(cache_key)
        if cached is not None:
            v = cached.decode() if isinstance(cached, bytes) else str(cached)
            is_demo = v == "1"
    except Exception:
        redis = None
    if is_demo is None:
        from sqlalchemy import select
        from .database import AsyncSessionLocal
        from .models import User
        async with AsyncSessionLocal() as db:
            is_demo = bool(
                (await db.execute(select(User.is_demo).where(User.id == user_id))).scalar_one_or_none()
            )
        if redis is not None:
            try:
                await redis.set(cache_key, "1" if is_demo else "0", ex=60)
            except Exception:
                pass
    if is_demo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action is not available on a demo login. Create an account to continue.",
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

    is_placeholder = is_wallet_placeholder_email(user.email)
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
