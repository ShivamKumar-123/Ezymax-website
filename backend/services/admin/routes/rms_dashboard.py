"""RMS Risk Dashboard (Module 1) — executive risk & financial summary.

Read-only, gated by ``rms.view`` (super_admin + risk_manager). The client
polls this every 5-10s per the RMS spec.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import require_permission
from packages.common.src.database import get_db
from packages.common.src.models import User
from services import rms_dashboard_service, rms_positions_service

router = APIRouter(prefix="/rms-dashboard", tags=["RMS Dashboard"])


@router.get("/overview")
async def risk_overview(
    admin: User = Depends(require_permission("rms.view")),
    db: AsyncSession = Depends(get_db),
):
    return await rms_dashboard_service.risk_overview(db)


@router.get("/positions")
async def live_positions(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    symbol: str | None = Query(None),
    side: str | None = Query(None, pattern="^(buy|sell)$"),
    book_type: str | None = Query(None, pattern="^(A|B)$"),
    country: str | None = Query(None),
    search: str | None = Query(None),
    include_demo: bool = Query(False),
    admin: User = Depends(require_permission("rms.view")),
    db: AsyncSession = Depends(get_db),
):
    """Module 2 — Live Position Monitor: every open position with live
    current price + floating P/L, filterable."""
    return await rms_positions_service.live_positions(
        db, page=page, per_page=per_page, symbol=symbol, side=side,
        book_type=book_type, country=country, search=search, include_demo=include_demo,
    )
