"""Public trading instrument catalog with effective charges (active + enabled only)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from ..services import trading_catalog_service

router = APIRouter(prefix="/trading", tags=["Trading catalog"])


@router.get("/my-spread-overrides")
async def my_spread_overrides(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Per-user spread overrides for the logged-in user so the terminal can show
    them their own spread (keyed by symbol; user-global override under "*")."""
    return await trading_catalog_service.list_user_spread_overrides(
        db, current_user["user_id"],
    )


@router.get("/instruments")
async def list_trading_instruments(
    db: AsyncSession = Depends(get_db),
    segment: str | None = Query(None, description="Filter by segment name e.g. forex"),
):
    return await trading_catalog_service.list_trading_instruments(
        segment=segment, db=db,
    )


@router.get("/instruments/{symbol}")
async def get_trading_instrument(symbol: str, db: AsyncSession = Depends(get_db)):
    return await trading_catalog_service.get_trading_instrument(
        symbol=symbol, db=db,
    )
