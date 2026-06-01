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
) -> tuple[str, datetime]:
    # Timezone-aware UTC: avoids asyncpg/timestamptz issues and PyJWT edge cases with naive datetimes.
    now = datetime.now(timezone.utc)
    expires = now + (expires_delta or timedelta(minutes=settings.JWT_ACCESS_EXPIRY_MINUTES))
    payload = {
        "sub": user_id,
        "role": role,
        # Realm marker — the trader gateway issues "trader"; the admin
        # service issues "admin". decode_token() rejects mismatches so a
        # leaked trader secret can never mint an admin token (and vice
        # versa, even though they're nominally separate secrets).
        "type": "trader",
        "exp": expires,
        "iat": now,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expires


def decode_token(token: str, *, expected_type: str = "trader") -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    # Tokens issued before this change have no "type" claim. Treat absent
    # type as "trader" so existing sessions keep working through deploy.
    # "user" is accepted as a legacy alias for "trader" — older impersonation
    # tokens in the wild use it; they expire within 2h of the rollout.
    token_type = payload.get("type", "trader")
    if expected_type == "trader" and token_type == "user":
        token_type = "trader"
    if token_type != expected_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token realm")
    return payload


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


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    token = _extract_bearer_token(request, credentials)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(token)
    user_id = UUID(payload["sub"])
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
    }


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

    is_placeholder = (user.email or "").lower().endswith("@wallet.fxartha.local")
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
