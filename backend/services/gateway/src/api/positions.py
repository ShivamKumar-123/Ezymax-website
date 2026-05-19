"""Positions API — View, modify SL/TP, close & partial close (MT5-like)."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import Position, TradingAccount, Instrument
from packages.common.src.schemas import ClosePositionRequest, ModifyPositionRequest
from packages.common.src.auth import get_current_user
from ..services import trading_service

router = APIRouter()


@router.get("/sentiment")
async def market_sentiment(
    symbol: str = Query(..., min_length=1, max_length=20),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Platform-wide buy vs sell sentiment for one symbol.

    Aggregates every currently-open position across all LIVE trading
    accounts (demo excluded so retail-vs-broker P&L isn't polluted by
    paper trades) and returns the share of open *positions* on each
    side. Identity is never exposed — just the percentages and the
    distinct-trader count for context.

    Falls back to a neutral 50/50 when no positions are open so the
    gauge widget can render a stable resting state instead of NaN.
    """
    sym = symbol.strip().upper()
    if not sym:
        raise HTTPException(status_code=400, detail="symbol required")

    inst_row = (await db.execute(
        select(Instrument.id).where(func.upper(Instrument.symbol) == sym).limit(1)
    )).first()
    if not inst_row:
        return {"symbol": sym, "buy_pct": 50.0, "sell_pct": 50.0, "total_traders": 0}
    inst_id = inst_row[0]

    rows = (await db.execute(
        select(Position.side, func.count(Position.id))
        .join(TradingAccount, TradingAccount.id == Position.account_id)
        .where(
            Position.instrument_id == inst_id,
            Position.status == "open",
            TradingAccount.is_demo.is_(False),
        )
        .group_by(Position.side)
    )).all()

    buy = 0
    sell = 0
    for side_val, count in rows:
        # `side` can be a SQLAlchemy enum value or raw string depending on driver.
        s = str(getattr(side_val, "value", side_val) or "").lower()
        if s == "buy":
            buy = int(count or 0)
        elif s == "sell":
            sell = int(count or 0)

    total = buy + sell
    if total <= 0:
        return {"symbol": sym, "buy_pct": 50.0, "sell_pct": 50.0, "total_traders": 0}

    buy_pct = round(buy * 100.0 / total, 1)
    sell_pct = round(100.0 - buy_pct, 1)

    # Distinct-trader count for the "N traders" footer — bounded query so
    # we don't load every position row twice.
    distinct = (await db.execute(
        select(func.count(func.distinct(TradingAccount.user_id)))
        .select_from(Position)
        .join(TradingAccount, TradingAccount.id == Position.account_id)
        .where(
            Position.instrument_id == inst_id,
            Position.status == "open",
            TradingAccount.is_demo.is_(False),
        )
    )).scalar() or 0

    return {
        "symbol": sym,
        "buy_pct": buy_pct,
        "sell_pct": sell_pct,
        "total_traders": int(distinct),
    }


@router.get("/")
async def list_positions(
    account_id: UUID,
    status: str = "open",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trading_service.list_positions(
        account_id=account_id, user_id=current_user["user_id"],
        status=status, db=db,
    )


@router.put("/{position_id}")
async def modify_position(
    position_id: UUID,
    req: ModifyPositionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trading_service.modify_position(
        position_id=position_id, req=req,
        user_id=current_user["user_id"], db=db,
    )


@router.post("/{position_id}/close")
async def close_position(
    position_id: UUID,
    req: ClosePositionRequest = ClosePositionRequest(),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trading_service.close_position(
        position_id=position_id, req=req,
        user_id=current_user["user_id"], db=db,
    )
