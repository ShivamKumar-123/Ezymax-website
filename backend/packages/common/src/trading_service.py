"""Trading Service — Reusable business logic extracted from route handlers.

Keeps route files thin by centralising price fetching, account validation,
margin calculations, and position P&L computation.
"""
import json
import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import (
    Instrument, InstrumentConfig, Order, OrderSide, OrderStatus,
    Position, PositionStatus, TradingAccount,
)
from .redis_client import redis_client, PriceChannel

logger = logging.getLogger("trading_service")


class TradingServiceError(Exception):
    """Raised when a trading operation cannot proceed."""

    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


# ─── Price ────────────────────────────────────────────────────────────────

async def get_current_price(symbol: str) -> tuple[Decimal, Decimal]:
    """Fetch the latest bid/ask from Redis. Raises TradingServiceError if unavailable."""
    tick_data = await redis_client.get(PriceChannel.tick_key(symbol))
    if not tick_data:
        raise TradingServiceError(f"No price available for {symbol}")
    tick = json.loads(tick_data)
    return Decimal(str(tick["bid"])), Decimal(str(tick["ask"]))


# ─── Account ──────────────────────────────────────────────────────────────

async def validate_account(
    account_id: UUID,
    user_id: UUID,
    db: AsyncSession,
    *,
    load_group: bool = True,
) -> TradingAccount:
    """Load and validate a trading account belongs to the user and is active."""
    query = select(TradingAccount).where(
        TradingAccount.id == account_id,
        TradingAccount.user_id == user_id,
    )
    if load_group:
        query = query.options(selectinload(TradingAccount.account_group))

    result = await db.execute(query)
    account = result.scalar_one_or_none()
    if not account:
        raise TradingServiceError("Account not found", 404)
    if not account.is_active:
        raise TradingServiceError("Account is not active", 403)
    return account


# ─── Instrument ───────────────────────────────────────────────────────────

async def get_instrument(symbol: str, db: AsyncSession) -> Instrument:
    """Load an active instrument by symbol."""
    result = await db.execute(
        select(Instrument).where(
            Instrument.symbol == symbol.upper(),
            Instrument.is_active == True,
        )
    )
    instrument = result.scalar_one_or_none()
    if not instrument:
        raise TradingServiceError(f"Instrument {symbol} not found", 404)
    return instrument


async def get_instrument_config(instrument_id: UUID, db: AsyncSession) -> InstrumentConfig | None:
    """Load instrument-specific config (spread, commission, etc.)."""
    result = await db.execute(
        select(InstrumentConfig).where(InstrumentConfig.instrument_id == instrument_id)
    )
    return result.scalar_one_or_none()


# ─── Margin ───────────────────────────────────────────────────────────────

def calc_margin(
    lots: Decimal,
    price: Decimal,
    contract_size: Decimal,
    leverage: int,
) -> Decimal:
    """Calculate required margin for a position."""
    return (lots * contract_size * price) / Decimal(str(leverage))


def calc_free_margin(account: TradingAccount) -> Decimal:
    """Return the free margin available for new trades."""
    equity = account.balance + account.credit
    return equity - account.margin_used


# ─── P&L ──────────────────────────────────────────────────────────────────

def calc_position_pnl(
    side: OrderSide,
    open_price: Decimal,
    current_price: Decimal,
    lots: Decimal,
    contract_size: Decimal,
) -> Decimal:
    """Calculate unrealised P&L for a single position."""
    if side == OrderSide.BUY:
        return (current_price - open_price) * lots * contract_size
    return (open_price - current_price) * lots * contract_size


async def calc_account_equity(
    account: TradingAccount,
    db: AsyncSession,
) -> tuple[Decimal, Decimal]:
    """Return (equity, unrealised_pnl) for an account based on live prices."""
    result = await db.execute(
        select(Position)
        .options(selectinload(Position.instrument))
        .where(
            Position.account_id == account.id,
            Position.status == PositionStatus.OPEN,
        )
    )
    positions = result.scalars().all()

    unrealised = Decimal("0")
    for pos in positions:
        try:
            bid, ask = await get_current_price(pos.instrument.symbol)
            price = bid if pos.side == OrderSide.BUY else ask
            unrealised += calc_position_pnl(
                pos.side, pos.open_price, price,
                pos.lots, pos.instrument.contract_size,
            )
        except TradingServiceError:
            continue

    equity = account.balance + account.credit + unrealised
    return equity, unrealised
