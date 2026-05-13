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
from packages.common.src.models import User, Employee

security = HTTPBearer()
settings = get_settings()

EMPLOYEE_ROLE_PERMISSIONS = {
    "super_admin": {"*"},
    "trade_manager": {
        "trades.view", "trades.modify", "trades.close", "trades.create",
        "positions.view", "orders.view", "users.view",
        "social.view", "social.manage",
    },
    "support": {
        "tickets.view", "tickets.reply", "tickets.assign",
        "users.view", "deposits.view", "withdrawals.view",
        "kyc.view", "kyc.manage",
        "audit_logs.view",
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

    result = await db.execute(
        select(User).where(
            User.id == uuid.UUID(admin_id),
            User.role.in_(["admin", "super_admin"]),
            User.status == "active",
        )
    )
    admin = result.scalar_one_or_none()
    if admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin user not found or inactive")

    return admin


def require_permission(permission: str):
    """FastAPI dependency factory that checks if the current admin has the required permission."""
    async def _check(
        admin: User = Depends(get_current_admin),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        # Full admins (role 'admin' or 'super_admin') bypass per-permission checks.
        if admin.role in ("admin", "super_admin"):
            return admin

        result = await db.execute(
            select(Employee).where(Employee.user_id == admin.id, Employee.is_active == True)
        )
        employee = result.scalar_one_or_none()
        if employee:
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
