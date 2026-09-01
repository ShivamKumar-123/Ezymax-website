"""Admin Auth Service — login, refresh, me."""
import logging
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import verify_password
from packages.common.src.config import get_settings
from packages.common.src.models import User, Employee
from packages.common.src.admin_schemas import AdminLoginRequest, AdminLoginResponse, AdminRefreshRequest
from dependencies import EMPLOYEE_ROLE_PERMISSIONS

logger = logging.getLogger("uvicorn.error")
settings = get_settings()


def create_admin_token(admin_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.ADMIN_JWT_EXPIRY_HOURS)
    payload = {
        "admin_id": admin_id,
        "role": str(role),
        "type": "admin",
        "exp": expire,
        "iat": now,
    }
    try:
        return jwt.encode(payload, settings.ADMIN_JWT_SECRET, algorithm=settings.ADMIN_JWT_ALGORITHM)
    except jwt.PyJWTError as e:
        logger.error("Admin JWT encode failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error (JWT)",
        ) from e


async def admin_login(body: AdminLoginRequest, db: AsyncSession) -> AdminLoginResponse:
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

    token = create_admin_token(str(admin.id), admin.role)

    return AdminLoginResponse(
        access_token=token,
        admin_id=str(admin.id),
        role=admin.role,
        first_name=admin.first_name,
        last_name=admin.last_name,
    )


async def admin_refresh(body: AdminRefreshRequest, db: AsyncSession) -> AdminLoginResponse:
    try:
        payload = jwt.decode(
            body.access_token,
            settings.ADMIN_JWT_SECRET,
            algorithms=[settings.ADMIN_JWT_ALGORITHM],
            options={"verify_exp": False},
        )
        if payload.get("type") != "admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

        admin_id = payload.get("admin_id")
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

    token = create_admin_token(str(admin.id), admin.role)
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
    await db.commit()
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
