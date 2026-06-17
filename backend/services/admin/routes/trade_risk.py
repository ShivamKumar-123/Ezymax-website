"""Trade Risk (RMS) — at-risk open trades + coordinated-trading detection.

Read-only desk view for the B-book risk team. Gated by ``rms.view``
(super_admin + risk_manager).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import require_permission
from packages.common.src.database import get_db
from packages.common.src.models import User
from services import trade_risk_service

router = APIRouter(prefix="/trade-risk", tags=["Trade Risk / RMS"])


@router.get("/summary")
async def trade_risk_summary(
    window_min: int = Query(5, ge=1, le=240),
    min_users: int = Query(3, ge=2, le=100),
    lookback_hours: int = Query(24, ge=1, le=168),
    admin: User = Depends(require_permission("rms.view")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_risk_service.summary(db, window_min, min_users, lookback_hours)


@router.get("/at-risk")
async def at_risk_trades(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    bucket: str | None = Query(None, pattern="^(critical|warning|caution)$"),
    include_demo: bool = Query(False),
    admin: User = Depends(require_permission("rms.view")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_risk_service.at_risk_trades(
        db, page=page, per_page=per_page, bucket=bucket, include_demo=include_demo,
    )


@router.get("/clusters")
async def coordinated_clusters(
    window_min: int = Query(5, ge=1, le=240),
    min_users: int = Query(3, ge=2, le=100),
    lookback_hours: int = Query(24, ge=1, le=168),
    admin: User = Depends(require_permission("rms.view")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_risk_service.coordinated_clusters(
        db, window_min=window_min, min_users=min_users, lookback_hours=lookback_hours,
    )
