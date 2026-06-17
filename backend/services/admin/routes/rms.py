"""RMS / IP-management — superadmin IP risk monitoring.

Surfaces each user's IP + geo, shared-IP collisions (2+ users on one
IP), a live geo-map of users, and the RMS alert queue. Read endpoints
require ``rms.view``; mutating an alert's review status requires
``rms.manage``. super_admin bypasses both via '*'.
"""
import uuid
from fastapi import APIRouter, Depends, Query, Request

from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import require_permission, get_current_admin, write_audit_log
from packages.common.src.database import get_db
from packages.common.src.models import User
from packages.common.src.admin_schemas import RmsAlertUpdate
from services import rms_service

router = APIRouter(prefix="/rms", tags=["RMS / IP Management"])


@router.get("/summary")
async def rms_summary(
    admin: User = Depends(require_permission("rms.view")),
    db: AsyncSession = Depends(get_db),
):
    return await rms_service.summary(db)


@router.get("/ips")
async def list_user_ips(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    search: str | None = Query(None),
    shared_only: bool = Query(False),
    country: str | None = Query(None),
    admin: User = Depends(require_permission("rms.view")),
    db: AsyncSession = Depends(get_db),
):
    return await rms_service.list_user_ips(
        db, page=page, per_page=per_page, search=search,
        shared_only=shared_only, country=country,
    )


@router.get("/shared-ips")
async def list_shared_ips(
    status: str | None = Query(None),
    admin: User = Depends(require_permission("rms.view")),
    db: AsyncSession = Depends(get_db),
):
    return await rms_service.list_shared_ips(db, status_filter=status)


@router.get("/map")
async def map_points(
    limit: int = Query(2000, ge=1, le=5000),
    admin: User = Depends(require_permission("rms.view")),
    db: AsyncSession = Depends(get_db),
):
    return await rms_service.map_points(db, limit=limit)


@router.get("/alerts")
async def list_alerts(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status: str | None = Query(None),
    admin: User = Depends(require_permission("rms.view")),
    db: AsyncSession = Depends(get_db),
):
    return await rms_service.list_alerts(db, page=page, per_page=per_page, status_filter=status)


@router.patch("/alerts/{alert_id}")
async def update_alert(
    alert_id: uuid.UUID,
    body: RmsAlertUpdate,
    request: Request,
    admin: User = Depends(require_permission("rms.manage")),
    db: AsyncSession = Depends(get_db),
):
    result = await rms_service.update_alert(
        db, alert_id=alert_id, status=body.status, notes=body.notes, admin_id=admin.id,
    )
    ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)
    await write_audit_log(
        db, admin_id=admin.id, action=f"rms_alert_{body.status}",
        entity_type="rms_alert", entity_id=alert_id,
        new_values={"status": body.status, "notes": body.notes}, ip_address=ip,
    )
    await db.commit()
    return result
