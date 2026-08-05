import uuid

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from services import waitlist_service

router = APIRouter(prefix="/waitlist", tags=["Waitlist"])


class RejectRequest(BaseModel):
    reason: str


@router.get("/pending")
async def list_pending(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("waitlist.view")),
    db: AsyncSession = Depends(get_db),
):
    return await waitlist_service.list_pending(page=page, per_page=per_page, db=db)


@router.get("/approved")
async def list_approved(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("waitlist.view")),
    db: AsyncSession = Depends(get_db),
):
    return await waitlist_service.list_approved(page=page, per_page=per_page, db=db)


@router.get("/rejected")
async def list_rejected(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("waitlist.view")),
    db: AsyncSession = Depends(get_db),
):
    return await waitlist_service.list_rejected(page=page, per_page=per_page, db=db)


@router.post("/{request_id}/approve")
async def approve(
    request_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("waitlist.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await waitlist_service.approve_request(
        request_id=request_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{request_id}/reject")
async def reject(
    request_id: uuid.UUID,
    body: RejectRequest,
    request: Request,
    admin: User = Depends(require_permission("waitlist.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await waitlist_service.reject_request(
        request_id=request_id, reason=body.reason, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
