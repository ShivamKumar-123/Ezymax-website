"""B-Book Matching Engine — All orders execute against the house book.

This is the core execution engine. In a B-Book model:
- Market orders fill immediately at current bid/ask
- Pending orders (limit, stop, stop-limit) are monitored and triggered when price conditions are met
- No external liquidity — the admin/house is the counterparty to every trade
- Executable bid/ask in Redis already include platform spread (market-data service)
"""
import asyncio
import json
import logging
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    Order, OrderType, OrderSide, OrderStatus,
    Position, PositionStatus, TradingAccount, Instrument,
    SpreadConfig,
)
from packages.common.src.redis_client import redis_client, PriceChannel, is_tick_stale
from packages.common.src.instrument_pricing import resolve_commission
from packages.common.src.ib_commission import distribute_ib_commission

logger = logging.getLogger("b-book-engine")


class MatchingEngine:
    """Fills pending (limit/stop/stop-limit) orders against live ticks.

    SL/TP monitoring deliberately does NOT live here. The gateway's
    sltp_engine is the single SL/TP authority: it locks rows
    (FOR UPDATE SKIP LOCKED), closes at the exact SL/TP price (MT5
    semantics) and writes TradeHistory + Transaction rows. A second
    monitor in this service used to race it with none of those
    guarantees — phantom closes at market price with no history rows.
    """

    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        logger.info("B-Book Matching Engine started")
        await self._monitor_pending_orders()

    async def stop(self):
        self._running = False

    async def _get_price(self, symbol: str) -> Optional[tuple[Decimal, Decimal]]:
        tick_data = await redis_client.get(PriceChannel.tick_key(symbol))
        if not tick_data:
            return None
        tick = json.loads(tick_data)
        # A stale quote (dead feed / refresher republish) must never trigger
        # a pending-order fill — same rule every enforcement path follows.
        if is_tick_stale(tick):
            return None
        return Decimal(str(tick["bid"])), Decimal(str(tick["ask"]))

    async def _get_spread_markup(self, instrument_id, user_id, segment_id, db: AsyncSession) -> Decimal:
        """Resolve spread markup using the config hierarchy: user > instrument > segment > default."""
        for scope, sid, iid, uid in [
            ("user", None, None, user_id),
            ("instrument", None, instrument_id, None),
            ("segment", segment_id, None, None),
            ("default", None, None, None),
        ]:
            query = select(SpreadConfig).where(
                SpreadConfig.scope == scope,
                SpreadConfig.is_enabled == True,
            )
            if uid:
                query = query.where(SpreadConfig.user_id == uid)
            if iid:
                query = query.where(SpreadConfig.instrument_id == iid)
            if sid:
                query = query.where(SpreadConfig.segment_id == sid)

            result = await db.execute(query)
            config = result.scalar_one_or_none()
            if config:
                return config.value

        return Decimal("0")

    async def _monitor_pending_orders(self):
        """Monitor and trigger pending orders when price conditions are met."""
        logger.info("Pending order monitor started")
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(Order).where(Order.status == OrderStatus.PENDING)
                    )
                    pending_orders = result.scalars().all()

                    for order in pending_orders:
                        if order.expires_at and datetime.now(timezone.utc) > order.expires_at:
                            order.status = OrderStatus.EXPIRED
                            await db.commit()
                            continue

                        price_data = await self._get_price(order.instrument.symbol)
                        if not price_data:
                            continue

                        bid, ask = price_data
                        triggered = False

                        if order.order_type == OrderType.LIMIT:
                            if order.side == OrderSide.BUY and ask <= order.price:
                                triggered = True
                            elif order.side == OrderSide.SELL and bid >= order.price:
                                triggered = True

                        elif order.order_type == OrderType.STOP:
                            if order.side == OrderSide.BUY and ask >= order.price:
                                triggered = True
                            elif order.side == OrderSide.SELL and bid <= order.price:
                                triggered = True

                        elif order.order_type == OrderType.STOP_LIMIT:
                            if order.side == OrderSide.BUY and ask >= order.price:
                                if order.stop_limit_price and ask <= order.stop_limit_price:
                                    triggered = True
                            elif order.side == OrderSide.SELL and bid <= order.price:
                                if order.stop_limit_price and bid >= order.stop_limit_price:
                                    triggered = True

                        if triggered:
                            await self._execute_pending_order(order, bid, ask, db)

                    await db.commit()

            except Exception as e:
                logger.error(f"Pending order monitor error: {e}")

            await asyncio.sleep(0.1)

    async def _execute_pending_order(self, order: Order, bid: Decimal, ask: Decimal, db: AsyncSession):
        account = await db.get(TradingAccount, order.account_id)
        if not account or not account.is_active:
            order.status = OrderStatus.REJECTED
            return

        instrument = await db.get(Instrument, order.instrument_id)
        # Redis quotes already include platform spread (symmetric).
        fill_price = ask if order.side == OrderSide.BUY else bid
        margin = (order.lots * instrument.contract_size * fill_price) / Decimal(str(account.leverage))

        if margin > account.free_margin:
            order.status = OrderStatus.REJECTED
            return

        # Use the SAME resolver as the gateway's market-order path so a pending
        # fill is charged identically to a market order. The previous local
        # _get_commission() only checked user > instrument > segment > default
        # and silently charged $0 whenever commission was configured at the
        # account-group level (tier default) — i.e. for most accounts.
        commission = await resolve_commission(
            db,
            instrument,
            order.lots,
            fill_price,
            user_id=account.user_id,
            account_group_id=account.account_group_id,
        )

        order.status = OrderStatus.FILLED
        order.filled_price = fill_price
        order.filled_at = datetime.now(timezone.utc)
        order.commission = commission

        position = Position(
            account_id=account.id,
            instrument_id=instrument.id,
            order_id=order.id,
            side=order.side,
            lots=order.lots,
            open_price=fill_price,
            stop_loss=order.stop_loss,
            take_profit=order.take_profit,
            status=PositionStatus.OPEN,
            commission=commission,
        )
        db.add(position)

        account.margin_used += margin
        account.balance = (account.balance or Decimal("0")) - commission
        account.equity = (account.balance or Decimal("0")) + (account.credit or Decimal("0"))
        account.free_margin = account.equity - account.margin_used

        # A filled pending order is a real trade — pay the IB chain just like a
        # market order does (gateway). Previously pending fills skipped this
        # entirely, so referred users who traded via limit/stop generated no IB
        # commission. Best-effort: never let a distribution error block the fill;
        # the outer monitor loop owns the commit.
        try:
            await distribute_ib_commission(
                db, account.user_id, order.id, order.lots, instrument.symbol,
            )
        except Exception as e:
            logger.error(f"IB commission distribution failed for order {order.id}: {e}")

        logger.info(f"Pending order {order.id} executed: {instrument.symbol} {order.side.value} @ {fill_price}")

        await redis_client.publish(f"account:{account.id}", json.dumps({
            "type": "order_filled",
            "order_id": str(order.id),
            "symbol": instrument.symbol,
            "side": order.side.value,
            "price": str(fill_price),
            "lots": str(order.lots),
        }))
