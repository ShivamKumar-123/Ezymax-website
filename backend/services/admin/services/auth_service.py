"""Admin Auth Service — login, refresh, me."""
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select, func, update as sql_update
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import (
    verify_password, hash_token, _session_is_active, invalidate_session_cache,
)
from packages.common.src.config import get_settings
from packages.common.src.models import User, Employee, UserSession
from packages.common.src.admin_schemas import AdminLoginRequest, AdminLoginResponse, AdminRefreshRequest
from dependencies import EMPLOYEE_ROLE_PERMISSIONS

logger = logging.getLogger("uvicorn.error")
settings = get_settings()


def create_admin_token(admin_id: str, role: str, sid: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.ADMIN_JWT_EXPIRY_HOURS)
    payload = {
        "admin_id": admin_id,
        "role": str(role),
        "type": "admin",
        "exp": expire,
        "iat": now,
    }
    # H-ADMIN-1: bind the token to a revocable user_sessions row so logout /
    # password-change can kill it server-side (see get_current_admin).
    if sid is not None:
        payload["sid"] = sid
    try:
        return jwt.encode(payload, settings.ADMIN_JWT_SECRET, algorithm=settings.ADMIN_JWT_ALGORITHM)
    except jwt.PyJWTError as e:
        logger.error("Admin JWT encode failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error (JWT)",
        ) from e


async def _enforce_admin_host_isolation(admin: User, host: str | None, db: AsyncSession) -> None:
    """White-label admin-host rules (login-time; cookies are host-only so a
    session never travels between admin hosts):

      * admin.<broker-domain>  → only that broker (and brokers in its
        subtree) may sign in; the platform super-admin is also allowed
        (support/debug). Anyone else is refused.
      * platform / unknown host → a broker whose custom domain is LIVE is
        refused with a pointer to their own admin domain (they must never
        work out of admin.swisscresta.com once their panel exists). A
        broker with no live domain yet may still use the platform host —
        otherwise a fresh tenant could never log in to set things up.
    """
    from packages.common.src.config import get_settings as _gs
    if not _gs().BRANDING_ENABLED or not host:
        return
    from packages.common.src import broker_tenancy
    from packages.common.src.models import BrokerProfile
    from packages.common.src.models.broker import DOMAIN_STATUS_READY

    h = host.strip().lower().split(":", 1)[0]
    tenant_profile = None
    if h.startswith("admin."):
        apex = h[len("admin."):]
        tenant_profile = (
            await db.execute(
                select(BrokerProfile).where(
                    BrokerProfile.custom_domain == apex,
                    BrokerProfile.custom_domain_status == DOMAIN_STATUS_READY,
                    BrokerProfile.is_suspended.is_(False),
                )
            )
        ).scalar_one_or_none()

    if tenant_profile is not None:
        if admin.role == "super_admin":
            return
        owner_id = tenant_profile.user_id
        if admin.id == owner_id or owner_id in (admin.broker_ancestry or []):
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This admin portal belongs to a different broker.",
        )

    # Platform / unrecognised host.
    if admin.role == "broker":
        from packages.common.src import broker_tenancy as _bt
        profile = await _bt.get_broker_profile(db, admin.id)
        if (
            profile is not None
            and profile.custom_domain
            and profile.custom_domain_status == DOMAIN_STATUS_READY
            and not profile.is_suspended
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Please sign in on your own admin portal: "
                    f"https://admin.{profile.custom_domain}"
                ),
            )


async def admin_login(
    body: AdminLoginRequest, db: AsyncSession, host: str | None = None
) -> AdminLoginResponse:
    email_norm = (body.email or "").strip().lower()
    if not email_norm:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    try:
        result = await db.execute(
            select(User).where(
                func.lower(User.email) == email_norm,
                # "broker" = white-label tenant admin (scoped panel access).
                User.role.in_(["admin", "super_admin", "broker"]),
            )
        )
    except (OperationalError, DBAPIError) as e:
        logger.exception("Database error on admin login")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from e

    admin = result.scalar_one_or_none()

    if admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    password_ok = verify_password(body.password, admin.password_hash)
    if not password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if admin.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")

    if admin.role == "broker":
        # Suspended tenants (rental lapsed, ToS breach) get a clear message
        # at the door instead of a generic 403 on every subsequent call.
        from packages.common.src import broker_tenancy
        profile = await broker_tenancy.get_broker_profile(db, admin.id)
        if profile is None or profile.is_suspended:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Broker account is suspended — contact the platform",
            )

    # White-label host isolation (tenant admin domains vs platform host).
    await _enforce_admin_host_isolation(admin, host, db)

    # Mint a revocable session: sid → user_sessions row, so logout / password
    # change can kill this token server-side (H-ADMIN-1).
    sid = uuid4()
    token = create_admin_token(str(admin.id), admin.role, sid=str(sid))
    db.add(UserSession(
        id=sid,
        user_id=admin.id,
        token_hash=hash_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.ADMIN_JWT_EXPIRY_HOURS),
    ))
    await db.commit()

    return AdminLoginResponse(
        access_token=token,
        admin_id=str(admin.id),
        role=admin.role,
        first_name=admin.first_name,
        last_name=admin.last_name,
    )


async def admin_refresh(body: AdminRefreshRequest, db: AsyncSession) -> AdminLoginResponse:
    try:
        # H-ADMIN-1: verify_exp=True. Previously an EXPIRED admin token could be
        # refreshed indefinitely, so a single leaked (even long-expired) token
        # granted permanent access. Refresh now only re-issues while the current
        # 8h token is still valid (a sliding session).
        # DECISION: this replaces the insecure "refresh any expired token" flow.
        # A full refresh-token table with rotation (per H-ADMIN-1) is tracked as
        # an open item in REMEDIATION.md; it would let sessions outlive the 8h
        # access token without weakening expiry verification.
        payload = jwt.decode(
            body.access_token,
            settings.ADMIN_JWT_SECRET,
            algorithms=[settings.ADMIN_JWT_ALGORITHM],
            options={"verify_exp": True},
        )
        if payload.get("type") != "admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

        admin_id = payload.get("admin_id")
        old_sid = payload.get("sid")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired, please sign in again")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(
        select(User).where(
            User.id == admin_id,
            User.role.in_(["admin", "super_admin", "broker"]),
            User.status == "active",
        )
    )
    admin = result.scalar_one_or_none()
    if admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin not found")

    new_exp = datetime.now(timezone.utc) + timedelta(hours=settings.ADMIN_JWT_EXPIRY_HOURS)
    if old_sid:
        # A revoked session must NOT be refreshable — a logged-out / stolen token
        # cannot be resurrected. Fail OPEN only on an infra error, never lock out.
        try:
            still_active = await _session_is_active(old_sid)
        except Exception:
            still_active = True
        if not still_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked, please sign in again")
        token = create_admin_token(str(admin.id), admin.role, sid=old_sid)
        await db.execute(
            sql_update(UserSession).where(UserSession.id == UUID(str(old_sid)))
            .values(token_hash=hash_token(token), expires_at=new_exp)
        )
        await db.commit()
        await invalidate_session_cache(old_sid)
    else:
        # Grandfathered token (minted before sessions existed) — upgrade it to a
        # revocable session on refresh so it becomes killable going forward.
        sid = uuid4()
        token = create_admin_token(str(admin.id), admin.role, sid=str(sid))
        db.add(UserSession(
            id=sid, user_id=admin.id, token_hash=hash_token(token), expires_at=new_exp,
        ))
        await db.commit()
    return AdminLoginResponse(
        access_token=token,
        admin_id=str(admin.id),
        role=admin.role,
        first_name=admin.first_name,
        last_name=admin.last_name,
    )


async def change_admin_password(admin: User, current_password: str, new_password: str, db: AsyncSession) -> dict:
    if not verify_password(current_password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")
    from packages.common.src.auth import hash_password
    admin.password_hash = hash_password(new_password)
    # Kill every existing session for this admin so a changed password
    # invalidates any outstanding (possibly stolen) token immediately.
    sids = (await db.execute(
        select(UserSession.id).where(
            UserSession.user_id == admin.id, UserSession.is_active == True,  # noqa: E712
        )
    )).scalars().all()
    await db.execute(
        sql_update(UserSession).where(UserSession.user_id == admin.id).values(is_active=False)
    )
    await db.commit()
    for _sid in sids:
        await invalidate_session_cache(str(_sid))
    return {"message": "Password changed successfully"}


async def get_admin_me(admin: User, db: AsyncSession) -> dict:
    employee_role = None
    permissions = set()

    if admin.role == "super_admin":
        employee_role = "super_admin"
        permissions = {"*"}
    elif admin.role == "broker":
        # White-label tenant: expose the tri-state section grants so the
        # admin frontend can build the (scoped) sidebar. Expressed in the
        # same "<section>.<action>" vocabulary the frontend already gates
        # on: view granted at VIEW+, mutations granted at EDIT.
        from packages.common.src import broker_tenancy
        from packages.common.src.models.broker import (
            PERMISSION_EDIT, PERMISSION_VIEW, permission_at_least,
        )
        profile = await broker_tenancy.get_broker_profile(db, admin.id)
        broker_perms: set[str] = set()
        levels = (profile.permissions or {}) if profile else {}
        _view_map = {
            "users": ["users.view"],
            "kyc": ["kyc.view"],
            "deposits": ["deposits.view"],
            "withdrawals": ["withdrawals.view"],
            "trades": ["trades.view", "positions.view", "orders.view"],
            "transactions": ["transactions.view"],
            "sub_brokers": ["sub_brokers.view"],
        }
        _edit_map = {
            "users": ["users.ban", "users.block_trading"],
            "kyc": ["kyc.manage"],
            "deposits": ["deposits.approve", "deposits.reject"],
            "withdrawals": ["withdrawals.approve", "withdrawals.reject"],
            "sub_brokers": ["sub_brokers.manage"],
        }
        for section, level in levels.items():
            if permission_at_least(level, PERMISSION_VIEW):
                broker_perms.update(_view_map.get(section, []))
            if permission_at_least(level, PERMISSION_EDIT):
                broker_perms.update(_edit_map.get(section, []))
        return {
            "id": str(admin.id),
            "email": admin.email,
            "first_name": admin.first_name,
            "last_name": admin.last_name,
            "role": admin.role,
            "employee_role": "broker",
            "permissions": sorted(broker_perms),
            "broker_permission_levels": levels,
            "brand_name": profile.brand_name if profile else None,
            "logo_url": profile.logo_url if profile else None,
            "partner_code": profile.partner_code if profile else None,
        }
    else:
        emp_q = await db.execute(
            select(Employee).where(Employee.user_id == admin.id, Employee.is_active == True)
        )
        emp = emp_q.scalar_one_or_none()
        if emp:
            employee_role = emp.role
            permissions = EMPLOYEE_ROLE_PERMISSIONS.get(emp.role, set())

    return {
        "id": str(admin.id),
        "email": admin.email,
        "first_name": admin.first_name,
        "last_name": admin.last_name,
        "role": admin.role,
        "employee_role": employee_role,
        "permissions": list(permissions),
    }
