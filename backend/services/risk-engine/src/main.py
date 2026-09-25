"""Risk Engine — Margin monitoring, stop-out, exposure tracking.

Continuously monitors all open positions and accounts for:
- Margin level breaches (margin call at 80%, stop-out at 50%)
- Stop-out execution (close positions if margin level drops below threshold)
- Exposure monitoring (admin's B-book risk per instrument)

Rollover/swap charging does NOT live here. The gateway's overnight_fee_engine
is the single authority: it resolves the same SwapConfig chain via
resolve_swap_rate, is idempotent (positions.last_swap_at), leader-locked, and
writes Transaction audit rows. A second SwapConfig-based calculator used to run
in this service at 21:00 UTC with none of those guards — the same position
could be charged by both engines in one night — so it was removed.
"""
import asyncio
import json
import logging
from decimal import Decimal
from datetime import datetime, timezone
from collections import defaultdict

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    Position, PositionStatus, TradingAccount, Instrument,
    OrderSide, Notification, Transaction, TradeHistory, User,
)
from packages.common.src.redis_client import redis_client, PriceChannel, is_tick_stale
from packages.common.src.row_locks import lock_account
from packages.common.src.kafka_client import produce_event, KafkaTopics
from packages.common.src.config import get_settings
from packages.common.src import corecen_trade_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("risk-engine")

try:
    from packages.common.src.instrumentation import init_sentry
    init_sentry("risk-engine")
except Exception:
    pass

settings = get_settings()

# Demo accounts are practice money — they auto-refill back to the standard
# balance once they're flat and below the floor (see the NBP sweep).
DEMO_REFILL_BALANCE = Decimal("10000")
DEMO_REFILL_FLOOR = Decimal("100")


class RiskEngine:
    def __init__(self):
        self._running = False
        self._margin_call_sent: set[str] = set()

    async def start(self):
        self._running = True
        logger.info("Risk Engine started")

        await asyncio.gather(
            self._margin_monitor(),
            self._exposure_monitor(),
            self._negative_balance_protection(),
        )

    async def stop(self):
        self._running = False

    async def _margin_monitor(self):
        """Monitor margin levels for all accounts with open positions."""
        logger.info("Margin monitor started")
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(TradingAccount).where(
                            TradingAccount.margin_used > 0,
                            TradingAccount.is_active == True,
                        )
                    )
                    accounts = result.scalars().all()

                    for account in accounts:
                        positions_result = await db.execute(
                            select(Position).where(
                                Position.account_id == account.id,
                                Position.status == PositionStatus.OPEN,
                            )
                        )
                        positions = positions_result.scalars().all()
                        if not positions:
                            continue

                        unrealized_pnl = Decimal("0")
                        for pos in positions:
                            tick_data = await redis_client.get(PriceChannel.tick_key(pos.instrument.symbol))
                            if not tick_data:
                                continue
                            tick = json.loads(tick_data)
                            # Stale-price guard: don't let a frozen/refresher
                            # quote drive a stop-out decision. Skipping the
                            # position (treats its float as 0 for this tick) is
                            # the fail-safe direction — we never stop-out on
                            # dead-feed prices.
                            if is_tick_stale(tick):
                                continue
                            # Value the float on the MID, not the spread-adjusted
                            # bid/ask. bid/ask move with the platform spread, so a
                            # spread change — including an admin widening it while
                            # the market never moved — would drop the float and
                            # margin level and could force a stop-out the real
                            # market never warranted. The mid ties the stop-out
                            # decision to genuine price movement only. (An actual
                            # stop-out still books at the real bid/ask in
                            # _execute_stop_out — the user pays the spread on a
                            # forced close; it just cannot be TRIGGERED by spread.)
                            current_price = (Decimal(str(tick["bid"])) + Decimal(str(tick["ask"]))) / Decimal("2")

                            if pos.side == OrderSide.BUY:
                                pnl = (current_price - pos.open_price) * pos.lots * pos.instrument.contract_size
                            else:
                                pnl = (pos.open_price - current_price) * pos.lots * pos.instrument.contract_size
                            from packages.common.src.trading_service import quote_to_account_pnl, cross_rate_for
                            pnl = quote_to_account_pnl(
                                pnl,
                                getattr(pos.instrument, "base_currency", None),
                                getattr(pos.instrument, "quote_currency", None),
                                current_price,
                                symbol=getattr(pos.instrument, "symbol", None),
                                cross_rate=await cross_rate_for(pos.instrument),
                            )
                            unrealized_pnl += pnl

                        equity = account.balance + account.credit + unrealized_pnl
                        margin_level = (equity / account.margin_used * 100) if account.margin_used > 0 else Decimal("9999")

                        account.equity = equity
                        account.free_margin = equity - account.margin_used
                        account.margin_level = margin_level

                        from packages.common.src.settings_store import get_float_setting
                        stop_out = await get_float_setting("stop_out_level", settings.STOP_OUT_LEVEL)
                        margin_call = await get_float_setting("margin_call_level", settings.MARGIN_CALL_LEVEL)

                        if margin_level <= Decimal(str(stop_out)):
                            await self._execute_stop_out(account, positions, db)

                        elif margin_level <= Decimal(str(margin_call)):
                            acct_key = str(account.id)
                            if acct_key not in self._margin_call_sent:
                                self._margin_call_sent.add(acct_key)
                                notif = Notification(
                                    user_id=account.user_id,
                                    title="Margin Call Warning",
                                    message=f"Your margin level is at {margin_level:.1f}%. Please add funds or close positions.",
                                    type="margin_call",
                                )
                                db.add(notif)

                                await redis_client.publish(f"account:{account.id}", json.dumps({
                                    "type": "margin_call",
                                    "margin_level": str(margin_level),
                                }))

                                # Email the user — fire-and-forget, never blocks
                                # the risk loop on SMTP latency.
                                if not bool(account.is_demo):
                                    await self._send_margin_call_email(
                                        account=account,
                                        margin_level=margin_level,
                                        equity=equity,
                                        used_margin=account.margin_used,
                                        free_margin=account.free_margin,
                                        db=db,
                                    )
                        else:
                            self._margin_call_sent.discard(str(account.id))

                    await db.commit()

            except Exception as e:
                logger.error(f"Margin monitor error: {e}")

            await asyncio.sleep(1)

    async def _execute_stop_out(self, account: TradingAccount, positions: list[Position], db: AsyncSession):
        """Close positions until margin level is restored above stop-out."""
        logger.warning(f"Stop-out triggered for account {account.account_number}")

        # Lock the account row FOR UPDATE before mutating balance — otherwise a
        # concurrent close (manual, SL/TP) on the same account can lose-update the
        # balance. Same session, so this locks the row the loaded object maps to.
        locked_account = await lock_account(db, account.id)
        if locked_account is not None:
            account = locked_account

        closed_count = 0
        realized_pnl = Decimal("0")

        sorted_positions = sorted(positions, key=lambda p: p.profit)

        for pos in sorted_positions:
            tick_data = await redis_client.get(PriceChannel.tick_key(pos.instrument.symbol))
            if not tick_data:
                continue

            tick = json.loads(tick_data)
            # Stale-price guard: never close a position at a frozen/refresher
            # price during a stop-out. Leaving it open is safer than booking a
            # loss at a dead-feed quote.
            if is_tick_stale(tick):
                continue
            close_price = Decimal(str(tick["bid"])) if pos.side == OrderSide.BUY else Decimal(str(tick["ask"]))

            if pos.side == OrderSide.BUY:
                profit = (close_price - pos.open_price) * pos.lots * pos.instrument.contract_size
            else:
                profit = (pos.open_price - close_price) * pos.lots * pos.instrument.contract_size
            from packages.common.src.trading_service import quote_to_account_pnl, cross_rate_for
            profit = quote_to_account_pnl(
                profit,
                getattr(pos.instrument, "base_currency", None),
                getattr(pos.instrument, "quote_currency", None),
                close_price,
                symbol=getattr(pos.instrument, "symbol", None),
                cross_rate=await cross_rate_for(pos.instrument),
            )

            pos.status = PositionStatus.CLOSED
            pos.close_price = close_price
            pos.profit = profit
            pos.closed_at = datetime.now(timezone.utc)
            pos.comment = "Auto-closed by STOP OUT"

            account.balance += profit
            margin_release = (pos.lots * pos.instrument.contract_size * pos.open_price) / Decimal(str(account.leverage))
            account.margin_used = max(Decimal("0"), account.margin_used - margin_release)
            account.equity = account.balance + account.credit
            account.free_margin = account.equity - account.margin_used

            # Durable audit trail — every close path MUST write TradeHistory +
            # Transaction in the same session as the balance mutation. This
            # path used to write neither, which is exactly the hole the
            # gateway's _heal_missing_trade_history() loop was papering over
            # (it fabricated rows minutes later with a WARNING).
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
                close_reason="stop_out",
                opened_at=pos.created_at,
                closed_at=pos.closed_at,
            ))
            db.add(Transaction(
                user_id=account.user_id,
                account_id=pos.account_id,
                type="profit" if profit >= 0 else "loss",
                amount=profit,
                balance_after=account.balance,
                reference_id=pos.id,
                description=(
                    f"Stop-out: {pos.instrument.symbol} "
                    f"{pos.side.value if hasattr(pos.side, 'value') else pos.side} "
                    f"{pos.lots} lots @ {close_price}"
                ),
            ))
            db.add(Notification(
                user_id=account.user_id,
                title=f"Stop Out — {pos.instrument.symbol}",
                message=(
                    f"Position closed by stop-out at {close_price} | "
                    f"P&L: {'+' if profit >= 0 else ''}{float(profit):.2f}"
                ),
                type="margin_call",
            ))
            # NOTE: bonus wagering release (wallet_service.release_bonuses_after_trade)
            # lives in the gateway package and is not importable from this service;
            # stop-out lots therefore don't feed the bonus FIFO. Known gap.

            closed_count += 1
            realized_pnl += profit

            await redis_client.publish(f"account:{account.id}", json.dumps({
                "type": "stop_out",
                "position_id": str(pos.id),
                "symbol": pos.instrument.symbol,
                "profit": str(profit),
            }))

            logger.info(f"Stop-out closed {pos.instrument.symbol} {pos.side.value}, profit: {profit}")

            # ── A-Book: forward stop-out close to Corecen LP ─────────────
            # Decimal preserved — corecen_trade_client stringifies it
            # exactly, so the LP's record matches ours digit-for-digit.
            _pos_id = str(pos.id)
            _cp = close_price
            _pnl = profit
            _is_demo = bool(account.is_demo)

            async def _forward_stopout(pid=_pos_id, cp=_cp, pnl=_pnl, is_demo=_is_demo):
                # Demo account stop-outs never hit LP.
                if is_demo:
                    return
                try:
                    async with AsyncSessionLocal() as bg_db:
                        u = (await bg_db.execute(
                            select(User).where(User.id == account.user_id)
                        )).scalar_one_or_none()
                        if u and (u.book_type or "B") == "A":
                            await corecen_trade_client.forward_trade_close(
                                position_id=pid, close_price=cp,
                                pnl=pnl, closed_by="STOP_OUT",
                            )
                except Exception as exc:
                    logger.error("[A-BOOK] Stop-out close forward failed: %s", exc)

            asyncio.create_task(_forward_stopout())

            margin_level = (account.equity / account.margin_used * 100) if account.margin_used > 0 else Decimal("9999")
            from packages.common.src.settings_store import get_float_setting as _gfs
            _so = await _gfs("stop_out_level", settings.STOP_OUT_LEVEL)
            if margin_level > Decimal(str(_so)):
                break

        # After the stop-out loop ends — email the user a summary. Skipped on
        # demo accounts, and on the no-op case where nothing was actually
        # closed (defensive — shouldn't happen but cheap to guard).
        if closed_count > 0 and not bool(account.is_demo):
            await self._send_stop_out_email(
                account=account,
                closed_count=closed_count,
                realized_pnl=realized_pnl,
                new_equity=account.equity,
                db=db,
            )

    async def _send_margin_call_email(
        self,
        *,
        account: TradingAccount,
        margin_level: Decimal,
        equity: Decimal,
        used_margin: Decimal,
        free_margin: Decimal,
        db: AsyncSession,
    ) -> None:
        try:
            from packages.common.src.smtp_mail import (
                send_email, smtp_configured, fire_and_forget,
            )
            if not smtp_configured():
                return
            user_q = await db.execute(select(User).where(User.id == account.user_id))
            user = user_q.scalar_one_or_none()
            if not user or not user.email:
                return
            from packages.common.src.email_templates import render_margin_call
            st = get_settings()
            subject, html, text = render_margin_call(
                first_name=user.first_name,
                account_number=account.account_number,
                margin_level_pct=float(margin_level),
                equity=equity,
                used_margin=used_margin,
                free_margin=free_margin,
                currency=account.currency or "USD",
                trader_app_url=getattr(st, "TRADER_APP_URL", None) or "https://trade.swisscresta.com",
            )
            fire_and_forget(send_email(user.email, subject, html, text=text))
        except Exception as e:
            logger.debug("margin call email failed acct=%s: %s", account.account_number, e)

    async def _send_stop_out_email(
        self,
        *,
        account: TradingAccount,
        closed_count: int,
        realized_pnl: Decimal,
        new_equity: Decimal,
        db: AsyncSession,
    ) -> None:
        try:
            from packages.common.src.smtp_mail import (
                send_email, smtp_configured, fire_and_forget,
            )
            if not smtp_configured():
                return
            user_q = await db.execute(select(User).where(User.id == account.user_id))
            user = user_q.scalar_one_or_none()
            if not user or not user.email:
                return
            from packages.common.src.email_templates import render_stop_out
            st = get_settings()
            subject, html, text = render_stop_out(
                first_name=user.first_name,
                account_number=account.account_number,
                closed_count=closed_count,
                realized_pnl=realized_pnl,
                new_equity=new_equity,
                currency=account.currency or "USD",
                trader_app_url=getattr(st, "TRADER_APP_URL", None) or "https://trade.swisscresta.com",
            )
            fire_and_forget(send_email(user.email, subject, html, text=text))
        except Exception as e:
            logger.debug("stop-out email failed acct=%s: %s", account.account_number, e)

    async def _negative_balance_protection(self):
        """Zero out negative balances once an account is flat (standard
        retail-broker NBP). A stop-out at the 50% margin level can still
        overshoot below zero — price gaps, fast moves, or (historically) a
        feed-stale window where the guard rightly refused to close at dead
        prices. Once every position is closed and the balance is negative,
        the deficit is written off with a proper `adjustment` Transaction so
        the ledger explains the correction instead of the balance silently
        changing. Runs for demo and live alike; the B-book house absorbs
        the live-side deficit (that's what NBP means)."""
        logger.info("Negative balance protection started")
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    rows = (await db.execute(
                        select(TradingAccount).where(
                            TradingAccount.balance < 0,
                            TradingAccount.is_active == True,  # noqa: E712
                        ).with_for_update(skip_locked=True)
                    )).scalars().all()
                    for account in rows:
                        open_count = (await db.execute(
                            select(func.count(Position.id)).where(
                                Position.account_id == account.id,
                                Position.status == PositionStatus.OPEN,
                            )
                        )).scalar() or 0
                        if open_count:
                            continue  # still has exposure — wait until flat
                        deficit = -account.balance
                        account.balance = Decimal("0")
                        account.equity = account.credit or Decimal("0")
                        account.margin_used = Decimal("0")
                        account.free_margin = account.equity
                        account.margin_level = Decimal("0")
                        db.add(Transaction(
                            user_id=account.user_id,
                            account_id=account.id,
                            type="adjustment",
                            amount=deficit,
                            balance_after=Decimal("0"),
                            description="Negative balance protection: deficit written off",
                        ))
                        db.add(Notification(
                            user_id=account.user_id,
                            title="Negative balance corrected",
                            message=(
                                f"Account {account.account_number}: a negative "
                                f"balance of {float(-deficit):.2f} was reset to "
                                f"0.00 under negative balance protection."
                            ),
                            type="margin_call",
                        ))
                        logger.warning(
                            "NBP: account %s deficit %.2f written off",
                            account.account_number, float(deficit),
                        )
                    await db.commit()

                # ── Demo auto-refill ──────────────────────────────────
                # A practice account should never stay broke: once a demo
                # account is flat and its balance has fallen below the
                # refill floor, top it back up to the standard demo
                # balance — with a ledger row, like every balance change.
                async with AsyncSessionLocal() as db:
                    demo_rows = (await db.execute(
                        select(TradingAccount).where(
                            TradingAccount.is_demo == True,  # noqa: E712
                            TradingAccount.is_active == True,  # noqa: E712
                            TradingAccount.balance < DEMO_REFILL_FLOOR,
                        ).with_for_update(skip_locked=True)
                    )).scalars().all()
                    for account in demo_rows:
                        open_count = (await db.execute(
                            select(func.count(Position.id)).where(
                                Position.account_id == account.id,
                                Position.status == PositionStatus.OPEN,
                            )
                        )).scalar() or 0
                        if open_count:
                            continue
                        top_up = DEMO_REFILL_BALANCE - account.balance
                        if top_up <= 0:
                            continue
                        account.balance = DEMO_REFILL_BALANCE
                        account.equity = DEMO_REFILL_BALANCE + (account.credit or Decimal("0"))
                        account.margin_used = Decimal("0")
                        account.free_margin = account.equity
                        db.add(Transaction(
                            user_id=account.user_id,
                            account_id=account.id,
                            type="adjustment",
                            amount=top_up,
                            balance_after=account.balance,
                            description="Demo auto-refill: practice balance restored",
                        ))
                        db.add(Notification(
                            user_id=account.user_id,
                            title="Demo balance refilled",
                            message=(
                                f"Demo account {account.account_number} was "
                                f"topped back up to "
                                f"${float(DEMO_REFILL_BALANCE):,.0f} so you "
                                f"can keep practicing."
                            ),
                            type="margin_call",
                        ))
                        logger.info(
                            "Demo refill: account %s topped up by %.2f",
                            account.account_number, float(top_up),
                        )
                    await db.commit()
            except Exception as e:
                logger.error(f"NBP sweep error: {e}")
            await asyncio.sleep(60)

    async def _exposure_monitor(self):
        """Track the admin's net exposure per instrument (B-book risk)."""
        logger.info("Exposure monitor started")
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(Position).where(Position.status == PositionStatus.OPEN)
                    )
                    positions = result.scalars().all()

                    exposure: dict[str, dict] = defaultdict(lambda: {"long_lots": Decimal("0"), "short_lots": Decimal("0"), "long_value": Decimal("0"), "short_value": Decimal("0")})

                    for pos in positions:
                        symbol = pos.instrument.symbol
                        tick_data = await redis_client.get(PriceChannel.tick_key(symbol))
                        if not tick_data:
                            continue
                        tick = json.loads(tick_data)
                        mid_price = (Decimal(str(tick["bid"])) + Decimal(str(tick["ask"]))) / 2
                        value = pos.lots * pos.instrument.contract_size * mid_price

                        if pos.side == OrderSide.BUY:
                            exposure[symbol]["long_lots"] += pos.lots
                            exposure[symbol]["long_value"] += value
                        else:
                            exposure[symbol]["short_lots"] += pos.lots
                            exposure[symbol]["short_value"] += value

                    exposure_data = {}
                    for symbol, data in exposure.items():
                        net_lots = data["long_lots"] - data["short_lots"]
                        net_value = data["long_value"] - data["short_value"]
                        exposure_data[symbol] = {
                            "long_lots": str(data["long_lots"]),
                            "short_lots": str(data["short_lots"]),
                            "long_value": str(data["long_value"]),
                            "short_value": str(data["short_value"]),
                            "net_lots": str(net_lots),
                            "net_value": str(net_value),
                            "admin_exposure": str(-net_value),
                        }

                    await redis_client.set("exposure:summary", json.dumps(exposure_data))

            except Exception as e:
                logger.error(f"Exposure monitor error: {e}")

            await asyncio.sleep(5)

async def main():
    engine = RiskEngine()
    try:
        await engine.start()
    except KeyboardInterrupt:
        await engine.stop()


if __name__ == "__main__":
    asyncio.run(main())
