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
)
from packages.common.src.redis_client import redis_client, PriceChannel, is_tick_stale
from packages.common.src.instrument_pricing import resolve_commission
from packages.common.src.ib_commission import distribute_ib_commission
from packages.common.src.market_hours import is_market_open
from packages.common.src.settings_store import get_bool_setting
from packages.common.src.trading_service import quote_to_account_pnl, cross_rate_for

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

    async def _monitor_pending_orders(self):
        """Monitor and trigger pending orders when price conditions are met."""
        logger.info("Pending order monitor started")
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    # H-TRADE-9: lock the pending rows with SKIP LOCKED so that
                    # with multiple engine workers each row is processed by
                    # exactly one worker — rows another worker already holds are
                    # skipped this pass instead of being double-filled.
                    result = await db.execute(
                        select(Order).where(Order.status == OrderStatus.PENDING)
                        .with_for_update(skip_locked=True)
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
        # Maintenance mode blocks pending fills exactly like it blocks
        # market orders in the gateway. The order stays pending and will
        # fill on the first tick after maintenance ends (if still valid).
        if await get_bool_setting("maintenance_mode", False):
            return

        # H-TRADE-9: re-check status before filling. The row is held under the
        # monitor's SKIP LOCKED lock, but this guards against a status change
        # applied earlier in the same batch (expiry) or a stale in-memory copy.
        if order.status != OrderStatus.PENDING:
            return

        # Lock the account row: a pending fill races concurrent gateway
        # market orders on the same account, and both paths read + rewrite
        # margin_used/balance. The gateway's place_order takes the same
        # FOR UPDATE lock, so the two serialize instead of double-spending
        # the margin pool. Released at the outer loop's commit.
        locked_q = await db.execute(
            select(TradingAccount)
            .where(TradingAccount.id == order.account_id)
            .with_for_update()
        )
        account = locked_q.scalar_one_or_none()
        if not account or not account.is_active:
            order.status = OrderStatus.REJECTED
            return

        instrument = await db.get(Instrument, order.instrument_id)

        # Never fill into a closed market (mirrors the gateway's market-order
        # check). Ticks shouldn't arrive while closed, but the stale-quote
        # refresher and crypto side-feeds make this worth an explicit guard.
        segment_name = instrument.segment.name if instrument.segment else ""
        market_open, _closed_reason = is_market_open(
            instrument.symbol, segment_name, instrument.trading_hours
        )
        if not market_open:
            return

        # Redis quotes already include platform spread (symmetric).
        fill_price = ask if order.side == OrderSide.BUY else bid
        margin = (order.lots * instrument.contract_size * fill_price) / Decimal(str(account.leverage))

        # Margin check against RECOMPUTED values, not the stored
        # account.free_margin — the exact figure the gateway's place_order
        # deliberately distrusts (it drifts/sticks over many trades). Same
        # recipe: open margin re-summed from open positions, unrealized P&L
        # from live ticks with cross-rate conversion.
        open_pos_q = await db.execute(
            select(Position).where(
                Position.account_id == account.id,
                Position.status == PositionStatus.OPEN,
            )
        )
        open_positions = open_pos_q.scalars().all()
        open_margin = Decimal("0")
        unrealized_pnl = Decimal("0")
        for pos in open_positions:
            p_inst = pos.instrument
            cs = (p_inst.contract_size if p_inst else None) or Decimal("100000")
            open_margin += (pos.lots * cs * pos.open_price) / Decimal(str(account.leverage))
            if not p_inst:
                continue
            tick_data = await redis_client.get(PriceChannel.tick_key(p_inst.symbol))
            if not tick_data:
                continue
            tick = json.loads(tick_data)
            if is_tick_stale(tick):
                continue
            sv = pos.side.value if hasattr(pos.side, "value") else str(pos.side)
            cp = Decimal(str(tick["bid"])) if sv == "buy" else Decimal(str(tick["ask"]))
            if sv == "buy":
                pos_pnl = (cp - pos.open_price) * pos.lots * cs
            else:
                pos_pnl = (pos.open_price - cp) * pos.lots * cs
            unrealized_pnl += quote_to_account_pnl(
                pos_pnl,
                getattr(p_inst, "base_currency", None),
                getattr(p_inst, "quote_currency", None),
                cp,
                symbol=p_inst.symbol,
                cross_rate=await cross_rate_for(p_inst),
            )

        real_equity = (account.balance or Decimal("0")) + (account.credit or Decimal("0")) + unrealized_pnl
        real_free_margin = real_equity - open_margin
        if margin > real_free_margin:
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
