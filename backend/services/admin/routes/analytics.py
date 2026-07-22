from datetime import datetime

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from services import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _parse_date(value: str | None, *, end: bool = False) -> datetime | None:
    """Parse a YYYY-MM-DD (or full ISO) filter bound. `end=True` pushes a
    bare date to the end of that day so the range is inclusive."""
    if not value or not value.strip():
        return None
    v = value.strip()
    try:
        if len(v) == 10:  # YYYY-MM-DD
            dt = datetime.fromisoformat(v)
            return dt.replace(hour=23, minute=59, second=59) if end else dt
        return datetime.fromisoformat(v)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}")


@router.get("/dashboard")
async def analytics_dashboard(
    admin: User = Depends(require_permission("analytics.view")),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.analytics_dashboard(db=db)


@router.get("/exposure")
async def get_exposure(
    admin: User = Depends(require_permission("analytics.view")),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.get_exposure(db=db)


@router.get("/platform-pnl")
async def platform_pnl_detail(
    admin: User = Depends(require_permission("analytics.view")),
    db: AsyncSession = Depends(get_db),
):
    """Comprehensive Platform P&L breakdown: trade-mirror, brokerage
    commission, swap, and copy/MAM commissions across Today/Week/
    Month/All Time, plus the 10 users who've cost the platform the
    most and the 10 who've earned the platform the most, plus a
    30-row "what moved the needle" list of recent big trades."""
    return await analytics_service.platform_pnl_detail(db=db)


@router.get("/user-pnl")
async def user_pnl_breakdown(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: str | None = Query(None),
    sort_by: str = Query("net_pnl"),
    sort_dir: str = Query("desc"),
    period: str = Query("all", pattern="^(today|week|month|all)$"),
    admin: User = Depends(require_permission("analytics.view")),
    db: AsyncSession = Depends(get_db),
):
    """Per-user trade P&L breakdown. Lists every user that closed a
    trade — optionally filtered to a period (today / week / month /
    all) so the analytics period cards drill into exactly the users
    active in that window, with their profit, loss, and broker fees
    (commission + swap). Paginated, searchable by email / name. Each
    row links from the frontend to /admin/users/[id] for the full
    ledger drill-down."""
    return await analytics_service.list_user_pnl_breakdown(
        db=db, page=page, per_page=per_page, search=search,
        sort_by=sort_by, sort_dir=sort_dir, period=period,
    )


@router.get("/commission-breakdown")
async def commission_breakdown(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    admin: User = Depends(require_permission("analytics.view")),
    db: AsyncSession = Depends(get_db),
):
    """Per-user drill-down behind the "Admin Commission (Total)" card:
    spread + charges + swap the platform earned from each non-demo user's
    trades. Grand totals reconcile to the card. Searchable by email/name,
    filterable by a Position created-at date window, paginated."""
    return await analytics_service.commission_breakdown(
        db=db, page=page, per_page=per_page, search=search,
        date_from=_parse_date(date_from), date_to=_parse_date(date_to, end=True),
    )


@router.get("/user-revenue")
async def user_revenue_breakdown(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: str | None = Query(None),
    sort: str = Query("net_revenue"),
    order: str = Query("desc"),
    admin: User = Depends(require_permission("analytics.view")),
    db: AsyncSession = Depends(get_db),
):
    """Per-user business breakdown — one row per non-demo user with their
    deposits, withdrawals, net deposit, lots, realized P&L, trade count,
    gross brokerage, IB commission and net revenue (brokerage − IB). Powers
    the "Revenue by user" drill-down on the Analytics page; each row links to
    /admin/users/[id]. Sortable by any money column, searchable by email/name."""
    return await analytics_service.user_revenue_breakdown(
        db=db, page=page, per_page=per_page, search=search, sort=sort, order=order,
    )
