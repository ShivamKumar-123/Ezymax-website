"""Paginated admin-action audit (bonus changes, fund grants, impersonations, …)."""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import require_permission
from packages.common.src.database import get_db
from packages.common.src.models import User
from services import admin_audit_log_service

router = APIRouter(prefix="/admin-audit-logs", tags=["Admin audit logs"])


@router.get("")
async def list_admin_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    admin_id: uuid.UUID | None = Query(None),
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    admin: User = Depends(require_permission("audit_logs.view")),
    db: AsyncSession = Depends(get_db),
):
    return await admin_audit_log_service.list_admin_audit_logs(
        page=page, per_page=per_page, admin_id=admin_id, action=action,
        entity_type=entity_type, date_from=date_from, date_to=date_to, db=db,
    )


@router.get("/actions")
async def list_distinct_actions(
    admin: User = Depends(require_permission("audit_logs.view")),
    db: AsyncSession = Depends(get_db),
):
    """Returns the set of distinct `action` values present in the log so
    the UI can populate its action filter dropdown without hard-coding."""
    return await admin_audit_log_service.list_distinct_actions(db)
