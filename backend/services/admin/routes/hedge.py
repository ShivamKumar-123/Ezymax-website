"""Hedged Trades — standalone admin section.

Read views gated by ``hedge.view``; the two blocking actions require
``hedge.manage`` (demo_admin is read-only, enforced by require_permission).
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import require_permission
from packages.common.src.database import get_db
from packages.common.src.models import User
from services import hedge_service

router = APIRouter(prefix="/hedge", tags=["Hedged Trades"])


def _ip(request: Request) -> str | None:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get("/live")
async def live_hedges(
    symbol: str | None = Query(None),
    country: str | None = Query(None),
    search: str | None = Query(None),
    admin: User = Depends(require_permission("hedge.view")),
    db: AsyncSession = Depends(get_db),
):
    """Per-client hedges: accounts currently holding both sides of an instrument."""
    return await hedge_service.live_hedges(db, symbol=symbol, country=country, search=search)


@router.get("/exposure")
async def book_exposure(
    admin: User = Depends(require_permission("hedge.view")),
    db: AsyncSession = Depends(get_db),
):
    """Per-instrument client long/short + house net exposure."""
    return await hedge_service.book_exposure(db)


@router.get("/history")
async def hedge_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: str | None = Query(None),
    admin: User = Depends(require_permission("hedge.view")),
    db: AsyncSession = Depends(get_db),
):
    """Closed hedge episodes (going-forward history from the recorder engine)."""
    return await hedge_service.hedge_history(db, page=page, per_page=per_page, search=search)


@router.post("/block-trade/{position_id}")
async def block_trade(
    position_id: UUID,
    request: Request,
    admin: User = Depends(require_permission("hedge.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Force-close one position (block a specific trade)."""
    return await hedge_service.block_trade(db, position_id, admin.id, _ip(request))


@router.post("/block-account/{account_id}")
async def block_account(
    account_id: UUID,
    request: Request,
    admin: User = Depends(require_permission("hedge.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Suspend trading for the account's owner (block the trading account)."""
    return await hedge_service.block_account(db, account_id, admin.id, _ip(request))
