"""Algo Signal Executor — shared logic for executing algo signals on master accounts.

Used by both the gateway webhook (auto-execute) and admin service (manual execute).
"""
import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    AlgoSignal, MasterAccount, TradingAccount, Instrument,
    Position, PositionStatus, Order, TradeHistory,
)
from packages.common.src.redis_client import redis_client, PriceChannel

logger = logging.getLogger("algo_executor")


async def execute_signal(signal: AlgoSignal, db: AsyncSession) -> dict:
    """Execute a signal on all algo-enabled master accounts."""
    masters_q = await db.execute(
        select(MasterAccount).where(
            MasterAccount.algo_enabled == True,
            MasterAccount.status.in_(["approved", "active"]),
        )
    )
    masters = masters_q.scalars().all()

    if not masters:
        signal.status = "executed"
        signal.executed_at = datetime.now(timezone.utc)
        signal.masters_executed = 0
        signal.execution_details = {"error": "No algo-enabled masters found"}
        return {"masters_executed": 0, "details": []}

    details = []
    executed_count = 0

    for master in masters:
        account = await db.get(TradingAccount, master.account_id)
        try:
            if signal.action in ("BUY", "SELL"):
                result = await _open_trade_on_master(signal, master, account, db)
            else:
                result = await _close_trades_on_master(signal, master, account, db)

            details.append(result)
            if result.get("status") in ("filled", "closed"):
                executed_count += 1
        except Exception as e:
            logger.error("[ALGO] Failed on master %s: %s", master.id, e, exc_info=True)
            details.append({
                "master_id": str(master.id),
                "account_number": account.account_number if account else "?",
                "status": "error",
                "error": str(e),
            })

    signal.status = "executed"
    signal.executed_at = datetime.now(timezone.utc)
    signal.masters_executed = executed_count
    signal.execution_details = details

    logger.info("[ALGO] Signal %s executed on %d/%d masters", signal.id, executed_count, len(masters))
    return {"masters_executed": executed_count, "details": details}


async def _open_trade_on_master(
    signal: AlgoSignal, master: MasterAccount, account: TradingAccount | None, db: AsyncSession,
) -> dict:
    """Place a market order on the master's trading account."""
    if not account or not account.is_active:
        return {"master_id": str(master.id), "status": "skipped", "reason": "account_inactive"}

    instrument_q = await db.execute(
        select(Instrument).where(Instrument.symbol == signal.symbol)
    )
    instrument = instrument_q.scalar_one_or_none()
    if not instrument:
        return {"master_id": str(master.id), "status": "skipped", "reason": f"instrument {signal.symbol} not found"}

    base_volume = float(signal.volume or 0)
    multiplier = float(master.algo_volume_multiplier or 1)
    lots = round(base_volume * multiplier, 2)
    if lots < 0.01:
        return {"master_id": str(master.id), "status": "skipped", "reason": "lots below minimum"}

    tick_data = await redis_client.get(PriceChannel.tick_key(signal.symbol))
    if not tick_data:
        return {"master_id": str(master.id), "status": "skipped", "reason": "no_price_data"}

    tick = json.loads(tick_data)
    side = signal.action.lower()
    fill_price = Decimal(str(tick["ask"])) if side == "buy" else Decimal(str(tick["bid"]))
    contract_size = instrument.contract_size or Decimal("100000")
    required_margin = Decimal(str(lots)) * contract_size * fill_price / Decimal(str(account.leverage))

    if required_margin > (account.free_margin or Decimal("0")):
        return {"master_id": str(master.id), "status": "skipped", "reason": "insufficient_margin"}

    order = Order(
        account_id=account.id,
        instrument_id=instrument.id,
        order_type="market",
        side=side,
        status="filled",
        lots=Decimal(str(lots)),
        filled_price=fill_price,
        filled_at=datetime.now(timezone.utc),
        stop_loss=signal.stop_loss,
        take_profit=signal.take_profit,
        commission=Decimal("0"),
        comment=f"Algo signal {signal.id}",
    )
    db.add(order)
    await db.flush()

    position = Position(
        account_id=account.id,
        instrument_id=instrument.id,
        order_id=order.id,
        side=side,
        status=PositionStatus.OPEN.value,
        lots=Decimal(str(lots)),
        open_price=fill_price,
        stop_loss=signal.stop_loss,
        take_profit=signal.take_profit,
        comment=f"Algo signal {signal.id}",
    )
    db.add(position)
    await db.flush()

    account.margin_used = (account.margin_used or Decimal("0")) + required_margin
    account.free_margin = account.equity - account.margin_used

    logger.info(
        "[ALGO] Opened %s %s %.2f lots @ %s on master %s (%s)",
        side.upper(), signal.symbol, lots, fill_price,
        master.id, account.account_number,
    )
    return {
        "master_id": str(master.id),
        "account_number": account.account_number,
        "status": "filled",
        "position_id": str(position.id),
        "lots": lots,
        "price": float(fill_price),
    }


async def _close_trades_on_master(
    signal: AlgoSignal, master: MasterAccount, account: TradingAccount | None, db: AsyncSession,
) -> dict:
    """Close all open positions for the given symbol on master account."""
    if not account:
        return {"master_id": str(master.id), "status": "skipped", "reason": "account_missing"}

    positions_q = await db.execute(
        select(Position).join(Instrument).where(
            Position.account_id == master.account_id,
            Position.status == PositionStatus.OPEN,
            Instrument.symbol == signal.symbol,
        )
    )
    positions = positions_q.scalars().all()

    if not positions:
        return {
            "master_id": str(master.id),
            "account_number": account.account_number,
            "status": "skipped",
            "reason": "no_open_positions",
        }

    tick_data = await redis_client.get(PriceChannel.tick_key(signal.symbol))
    if not tick_data:
        return {"master_id": str(master.id), "status": "skipped", "reason": "no_price_data"}

    tick = json.loads(tick_data)
    closed_count = 0

    for pos in positions:
        instrument = pos.instrument
        if not instrument:
            continue

        side_val = pos.side.value if hasattr(pos.side, "value") else str(pos.side)
        close_price = Decimal(str(tick["bid"])) if side_val == "buy" else Decimal(str(tick["ask"]))
        contract_size = instrument.contract_size or Decimal("100000")

        if side_val == "buy":
            profit = (close_price - pos.open_price) * pos.lots * contract_size
        else:
            profit = (pos.open_price - close_price) * pos.lots * contract_size

        pos.status = PositionStatus.CLOSED.value
        pos.close_price = close_price
        pos.profit = profit
        pos.closed_at = datetime.now(timezone.utc)

        if account:
            account.balance = (account.balance or Decimal("0")) + profit
            margin_release = (pos.lots * contract_size * pos.open_price) / Decimal(str(account.leverage))
            account.margin_used = max(Decimal("0"), (account.margin_used or Decimal("0")) - margin_release)
            account.equity = account.balance + (account.credit or Decimal("0"))
            account.free_margin = account.equity - account.margin_used

        db.add(TradeHistory(
            position_id=pos.id,
            account_id=pos.account_id,
            instrument_id=pos.instrument_id,
            side=pos.side,
            lots=pos.lots,
            open_price=pos.open_price,
            close_price=close_price,
            swap=pos.swap or Decimal("0"),
            commission=pos.commission or Decimal("0"),
            profit=profit,
            close_reason="algo_close",
            opened_at=pos.created_at,
            closed_at=datetime.now(timezone.utc),
        ))
        closed_count += 1

    logger.info("[ALGO] Closed %d positions for %s on master %s", closed_count, signal.symbol, master.id)
    return {
        "master_id": str(master.id),
        "account_number": account.account_number,
        "status": "closed",
        "closed_count": closed_count,
    }
