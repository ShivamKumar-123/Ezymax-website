"""White-label broker (tenant) management routes.

Access model (port of stock4x):
  * super_admin — full broker management incl. rental terms + suspension
    (the platform owner's rental controls; employees never see this).
  * broker with sub_brokers=view — sees its own sub-broker list.
  * broker with sub_brokers=edit — mints/manages sub-brokers, never with
    permissions above its own (cap enforced in the service).
"""
import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import User
from packages.common.src import broker_tenancy
from packages.common.src.models.broker import (
    BROKER_SECTIONS, PERMISSION_EDIT, PERMISSION_VIEW, permission_at_least,
)
from dependencies import get_current_admin
from services import broker_service

router = APIRouter(prefix="/brokers", tags=["Brokers"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


async def _require_broker_surface(admin: User, db: AsyncSession, min_level: str) -> User:
    """Platform SUPER-ADMIN always passes; broker actors need
    sub_brokers ≥ level. Plain role="admin" users are employees —
    tenant management is the platform owner's surface, never theirs."""
    if admin.role == "super_admin":
        return admin
    if admin.role == "broker":
        profile = await broker_tenancy.get_broker_profile(db, admin.id)
        level = broker_tenancy.broker_permission_level(profile, "sub_brokers")
        if permission_at_least(level, min_level):
            return admin
    raise HTTPException(status_code=403, detail="Broker management not granted")


class CreateBrokerRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    first_name: str = ""
    last_name: str = ""
    brand_name: str = ""
    permissions: dict[str, str] = Field(default_factory=dict)
    rental_plan: str = ""
    rental_amount: Decimal = Decimal("0")
    rental_currency: str = "USD"
    rental_period: str = "monthly"
    rental_next_due: date | None = None
    rental_notes: str = ""


class UpdateBrokerRequest(BaseModel):
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    brand_name: str | None = None


class PermissionsRequest(BaseModel):
    permissions: dict[str, str]


class RentalRequest(BaseModel):
    rental_plan: str | None = None
    rental_amount: Decimal | None = None
    rental_currency: str | None = None
    rental_period: str | None = None
    rental_next_due: date | None = None
    rental_notes: str | None = None


class SuspendRequest(BaseModel):
    reason: str = ""


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8)


class AssignUserRequest(BaseModel):
    user_id: uuid.UUID


@router.get("/sections")
async def permission_sections(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """The grantable sections + this actor's cap (for the create/edit UI)."""
    await _require_broker_surface(admin, db, PERMISSION_VIEW)
    actor_profile = (
        await broker_tenancy.get_broker_profile(db, admin.id)
        if admin.role == "broker" else None
    )
    return {
        "sections": list(BROKER_SECTIONS),
        "levels": ["off", "view", "edit"],
        "max_grantable": broker_tenancy.max_grantable_permissions(admin, actor_profile),
    }


@router.get("")
async def list_brokers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await _require_broker_surface(admin, db, PERMISSION_VIEW)
    return await broker_service.list_brokers(
        db, admin, page=page, per_page=per_page, search=search
    )


@router.post("")
async def create_broker(
    body: CreateBrokerRequest,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await _require_broker_surface(admin, db, PERMISSION_EDIT)
    return await broker_service.create_broker(
        db, admin,
        email=body.email,
        password=body.password,
        first_name=body.first_name,
        last_name=body.last_name,
        permissions=body.permissions,
        brand_name=body.brand_name,
        rental_plan=body.rental_plan,
        rental_amount=body.rental_amount,
        rental_currency=body.rental_currency,
        rental_period=body.rental_period,
        rental_next_due=body.rental_next_due,
        rental_notes=body.rental_notes or None,
        ip_address=_client_ip(request),
    )


@router.get("/{broker_id}")
async def broker_detail(
    broker_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await _require_broker_surface(admin, db, PERMISSION_VIEW)
    return await broker_service.get_broker_detail(db, admin, broker_id)


@router.put("/{broker_id}")
async def update_broker(
    broker_id: uuid.UUID,
    body: UpdateBrokerRequest,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await _require_broker_surface(admin, db, PERMISSION_EDIT)
    return await broker_service.update_broker(
        db, admin, broker_id, body.model_dump(exclude_unset=True),
        ip_address=_client_ip(request),
    )


@router.put("/{broker_id}/permissions")
async def update_permissions(
    broker_id: uuid.UUID,
    body: PermissionsRequest,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await _require_broker_surface(admin, db, PERMISSION_EDIT)
    return await broker_service.update_broker_permissions(
        db, admin, broker_id, body.permissions, ip_address=_client_ip(request)
    )


@router.put("/{broker_id}/rental")
async def update_rental(
    broker_id: uuid.UUID,
    body: RentalRequest,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    # Platform-only; enforced again in the service.
    return await broker_service.update_rental(
        db, admin, broker_id,
        body.model_dump(exclude_unset=True),
        ip_address=_client_ip(request),
    )


@router.post("/{broker_id}/suspend")
async def suspend_broker(
    broker_id: uuid.UUID,
    body: SuspendRequest,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await broker_service.set_suspended(
        db, admin, broker_id, True, reason=body.reason, ip_address=_client_ip(request)
    )


@router.post("/{broker_id}/unsuspend")
async def unsuspend_broker(
    broker_id: uuid.UUID,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await broker_service.set_suspended(
        db, admin, broker_id, False, ip_address=_client_ip(request)
    )


@router.post("/{broker_id}/reset-password")
async def reset_broker_password(
    broker_id: uuid.UUID,
    body: ResetPasswordRequest,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await _require_broker_surface(admin, db, PERMISSION_EDIT)
    return await broker_service.reset_password(
        db, admin, broker_id, body.new_password, ip_address=_client_ip(request)
    )


@router.post("/{broker_id}/assign-user")
async def assign_user_to_broker(
    broker_id: uuid.UUID,
    body: AssignUserRequest,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await _require_broker_surface(admin, db, PERMISSION_EDIT)
    return await broker_service.assign_user(
        db, admin, broker_id, body.user_id, ip_address=_client_ip(request)
    )
