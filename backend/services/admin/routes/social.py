import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from services import social_service
# Copy-trade commission ledger queries live in packages.common because
# both the gateway (master self-view) and the admin (per-master and
# per-follower drill-downs) need them. Single source of truth — same
# Transaction joins, same anonymisation rules.
from packages.common.src import copy_earnings as copy_earnings_service

router = APIRouter(prefix="/social", tags=["Social Trading"])


class ApproveRequest(BaseModel):
    # Platform's cut of the master's performance fee, in percent.
    # 0–50% range matches the performance-fee API constraint at
    # `/copy` so admin can't accidentally set "200%" and zero-out
    # every master's payout. NULL keeps the existing value when
    # updating an already-approved master.
    admin_commission_pct: Optional[float] = Field(default=None, ge=0, le=50)
    max_investors: Optional[int] = Field(default=None, ge=0)
    master_type: Optional[str] = None


class RejectRequest(BaseModel):
    reason: Optional[str] = None


@router.get("/master-requests")
async def list_master_requests(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("social.view")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.list_master_requests(page=page, per_page=per_page, db=db)


@router.post("/master-requests/{master_id}/approve")
async def approve_master_request(
    master_id: uuid.UUID,
    body: ApproveRequest,
    request: Request,
    admin: User = Depends(require_permission("social.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.approve_master_request(
        master_id=master_id,
        admin_commission_pct=body.admin_commission_pct,
        max_investors=body.max_investors,
        master_type=body.master_type,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/master-requests/{master_id}/reject")
async def reject_master_request(
    master_id: uuid.UUID,
    body: RejectRequest,
    request: Request,
    admin: User = Depends(require_permission("social.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.reject_master_request(
        master_id=master_id, reason=body.reason,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/masters")
async def list_masters(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("social.view")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.list_masters(page=page, per_page=per_page, db=db)


@router.put("/masters/{master_id}")
async def update_master_settings(
    master_id: uuid.UUID,
    body: ApproveRequest,
    request: Request,
    admin: User = Depends(require_permission("social.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.update_master_settings(
        master_id=master_id,
        admin_commission_pct=body.admin_commission_pct,
        max_investors=body.max_investors,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/masters/{master_id}")
async def delete_master(
    master_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("social.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.delete_master(
        master_id=master_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/pamm-analytics")
async def pamm_analytics(
    admin: User = Depends(require_permission("social.view")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.pamm_analytics(db=db)


@router.post("/pamm/{master_id}/distribute-profit")
async def distribute_pamm_profit(
    master_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("social.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.distribute_pamm_profit(
        master_id=master_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


# ─── Per-master commission drill-down ─────────────────────────────────
@router.get("/masters/{master_id}/commissions")
async def master_commission_history(
    master_id: uuid.UUID,
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_permission("social.view")),
    db: AsyncSession = Depends(get_db),
):
    """Every commission row tied to ONE master account, plus the matching
    admin (platform) fee on each trade. Returns aggregate totals
    alongside the paginated items so the page header doesn't need a
    second call."""
    return await copy_earnings_service.get_master_commission_history(
        master_id=master_id,
        db=db,
        from_date=from_date,
        to_date=to_date,
        page=page,
        per_page=per_page,
    )


# ─── Per-follower paid-fees view (for support tickets) ────────────────
@router.get("/users/{user_id}/copy-fees-paid")
async def user_copy_fees_paid(
    user_id: uuid.UUID,
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    """Every copy-trade fee THIS user paid, with which master collected
    each share. Use case: support ticket 'why was this commission
    debited from my account?'."""
    return await copy_earnings_service.get_user_copy_fees_paid(
        user_id=user_id,
        db=db,
        from_date=from_date,
        to_date=to_date,
        page=page,
        per_page=per_page,
    )
