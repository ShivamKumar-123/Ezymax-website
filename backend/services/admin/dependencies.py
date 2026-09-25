import uuid
from datetime import datetime
from functools import wraps
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.database import get_db
from packages.common.src.models import User, Employee, BrokerProfile
from packages.common.src import broker_tenancy
from packages.common.src.models.broker import (
    PERMISSION_VIEW, PERMISSION_EDIT, permission_at_least,
)

security = HTTPBearer()
settings = get_settings()

EMPLOYEE_ROLE_PERMISSIONS = {
    "super_admin": {"*"},
    "trade_manager": {
        "trades.view", "trades.modify", "trades.close", "trades.create",
        "positions.view", "orders.view", "users.view",
        "social.view", "social.manage",
    },
    # Support = support desk only. Deposits/withdrawals/KYC/audit access
    # is NOT part of the default — grant per-employee via extra
    # permissions (shield icon on the Employees page) when needed.
    "support": {
        "tickets.view", "tickets.reply", "tickets.assign",
        "users.view",
    },
    "finance": {
        "deposits.view", "deposits.approve", "deposits.reject",
        "withdrawals.view", "withdrawals.approve", "withdrawals.reject",
        "users.view", "users.add_fund", "users.deduct_fund",
        "banks.view", "banks.create", "banks.update",
        "ib.view",
        "kyc.view", "kyc.manage",
    },
    "risk_manager": {
        "trades.view", "positions.view", "users.view",
        "users.ban", "users.block_trading", "users.kill_switch",
        "analytics.view", "exposure.view",
        "audit_logs.view",
    },
    "marketing": {
        "banners.view", "banners.create", "banners.update", "banners.delete",
        "bonus.view", "bonus.create", "bonus.update",
        "ib.view", "ib.manage",
    },
}


ADMIN_COOKIE_NAME = "fx_admin"


async def get_current_admin(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the active admin from EITHER an HttpOnly cookie (preferred —
    no XSS-readable token) OR a Bearer header (legacy clients). The
    cookie path is what the new admin frontend uses; the header path
    is retained so cron / scripts that already mint a token via /login
    keep working until they migrate."""
    token: str | None = None
    cookie_token = request.cookies.get(ADMIN_COOKIE_NAME)
    if cookie_token:
        token = cookie_token
    elif credentials is not None:
        token = credentials.credentials
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(
            token,
            settings.ADMIN_JWT_SECRET,
            algorithms=[settings.ADMIN_JWT_ALGORITHM],
        )
        if payload.get("type") != "admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")
        admin_id = payload.get("admin_id")
        if admin_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    # H-ADMIN-1: reject a token whose admin session was revoked (logout /
    # password change). Tokens minted before sessions existed carry no sid and
    # are grandfathered (they lapse within the 8h lifetime). Fail OPEN on an
    # infra error so a Redis/DB blip can never lock every admin out.
    sid = payload.get("sid")
    if sid:
        from packages.common.src.auth import _session_is_active
        try:
            _sess_ok = await _session_is_active(sid)
        except Exception:
            _sess_ok = True
        if not _sess_ok:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked, please sign in again")

    result = await db.execute(
        select(User).where(
            User.id == uuid.UUID(admin_id),
            # White-label brokers authenticate against the same admin panel
            # with a scoped, permission-gated view of THEIR user pool only.
            User.role.in_(["admin", "super_admin", "broker"]),
            User.status == "active",
        )
    )
    admin = result.scalar_one_or_none()
    if admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin user not found or inactive")

    if admin.role == "broker":
        # A suspended tenant (rental lapsed, ToS breach, …) loses admin
        # access immediately — checked per request, not just at login.
        profile = await broker_tenancy.get_broker_profile(db, admin.id)
        if profile is None or profile.is_suspended:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Broker account is suspended — contact the platform",
            )

    return admin


async def require_super_admin(
    admin: User = Depends(get_current_admin),
) -> User:
    """Gate for super-admin-only surfaces (settings, employee management).
    Employees authenticate as role="admin" users, so get_current_admin
    alone does NOT keep them out."""
    if admin.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return admin


# ── White-label broker permission mapping ─────────────────────────────
# Maps the existing fine-grained permission strings onto the broker
# tri-state sections (off/view/edit). A permission that maps to None is
# NEVER available to brokers regardless of grants — platform-only
# surfaces (config, banks, banners, IB, social, settings, employees…).
# Rule of thumb: ".view" needs VIEW, any mutation needs EDIT, and the
# target row must additionally sit inside the broker's pool (enforced
# by the scoped routes via broker_scope_ids / assert_broker_scope).
_BROKER_SECTION_MAP: dict[str, str | None] = {
    "users": "users",
    "kyc": "kyc",
    "deposits": "deposits",
    "withdrawals": "withdrawals",
    "trades": "trades",
    "positions": "trades",
    "orders": "trades",
    "transactions": "transactions",
}

# Mutations too destructive to ever delegate to a tenant, even at EDIT.
_BROKER_DENIED_PERMISSIONS = {
    "users.delete", "users.impersonate", "users.kill_switch",
    "trades.create", "trades.manage",
}


def _broker_allows(profile: BrokerProfile | None, permission: str) -> bool:
    if permission in _BROKER_DENIED_PERMISSIONS:
        return False
    section_key, _, action = permission.partition(".")
    section = _BROKER_SECTION_MAP.get(section_key)
    if section is None:
        return False
    needed = PERMISSION_VIEW if action == "view" else PERMISSION_EDIT
    return permission_at_least(
        broker_tenancy.broker_permission_level(profile, section), needed
    )


def require_permission(permission: str):
    """FastAPI dependency factory that checks if the current admin has the required permission."""
    async def _check(
        admin: User = Depends(get_current_admin),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        # Only super admins bypass per-permission checks. Employees are
        # stored as role="admin" users WITH an employees row (so they can
        # pass admin login) — letting role "admin" bypass here would give
        # every support/finance employee unrestricted backend access.
        if admin.role == "super_admin":
            return admin

        if admin.role == "broker":
            profile = await broker_tenancy.get_broker_profile(db, admin.id)
            if _broker_allows(profile, permission):
                return admin
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' not granted to your broker account",
            )

        result = await db.execute(
            select(Employee).where(Employee.user_id == admin.id, Employee.is_active == True)
        )
        employee = result.scalar_one_or_none()
        # C-ADMIN-2: no "role=admin without an ACTIVE employees row = full
        # admin" fallthrough. Such a user now gets 403; access requires an
        # active employees row that grants the permission (or super_admin,
        # handled above). See docs/audit/REMEDIATION.md for the query that
        # finds any role='admin' users left without an employees row.
        if employee is not None:
            role_perms = EMPLOYEE_ROLE_PERMISSIONS.get(employee.role, set())
            extra = set(employee.extra_permissions or [])
            effective = role_perms | extra
            if "*" in effective or permission in effective:
                return admin

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' required",
        )
    return _check


# ── White-label pool scoping ──────────────────────────────────────────

def require_platform_permission(permission: str):
    """Like require_permission, but NEVER satisfied by a broker account —
    for platform-wide surfaces (A/B book management, LP settings) that
    share permission strings with tenant-scoped pages but must stay the
    platform's alone."""
    inner = require_permission(permission)

    async def _check(admin: User = Depends(inner)) -> User:
        if admin.role == "broker":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This section is platform-only",
            )
        return admin
    return _check


async def broker_scope_ids(
    admin: User, db: AsyncSession
) -> list[uuid.UUID] | None:
    """None = unscoped (platform admins keep their existing full view).
    For a broker actor: the explicit list of client user ids in their
    pool (subtree incl. sub-brokers' clients). An empty pool returns a
    sentinel list with one impossible id so callers' IN() filters match
    nothing instead of everything."""
    if admin.role != "broker":
        return None
    ids = await broker_tenancy.scoped_client_ids(db, admin)
    return ids or [uuid.UUID(int=0)]


async def assert_broker_scope(
    admin: User, target_user_id: uuid.UUID, db: AsyncSession
) -> User:
    """403s when a broker actor targets a user outside their pool.
    Platform admins pass through unchanged."""
    try:
        return await broker_tenancy.assert_user_in_broker_scope(db, admin, target_user_id)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


async def write_audit_log(
    db: AsyncSession,
    admin_id: uuid.UUID,
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    """Insert one row into the admin audit log.

    CONTRACT: this function does NOT commit. The audit insert MUST share
    the caller's transaction with whatever financial mutation it
    documents — otherwise a crash between the audit write and the
    mutation commit would leave one of them orphaned. We only flush, so
    the caller's eventual db.commit() (or db.rollback() on error) is
    the single decision point. Do NOT add db.commit() here under any
    circumstance — the C4 concern from the security audit is exactly
    that.

    Defence in depth: any free-floating Decimal in the JSON payload is
    coerced to a string here so JSONB stores its exact representation
    instead of a lossy float — see H10."""
    from decimal import Decimal as _D
    from packages.common.src.models import AuditLog

    def _safe(d):
        if d is None:
            return None
        return {k: (str(v) if isinstance(v, _D) else v) for k, v in d.items()}

    log = AuditLog(
        admin_id=admin_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=_safe(old_values),
        new_values=_safe(new_values),
        ip_address=ip_address,
    )
    db.add(log)
    await db.flush()
