"""AI Strategy execution engine.

Every TICK_INTERVAL seconds (leader-locked across gateway workers), walks all
running AIStrategyInstances, and for each one evaluates its DSL on the most
recent CLOSED bar of its symbol/timeframe. Signals execute through the
CANONICAL paths — trading_service.place_order / close_position — so AI trades
get commission, margin locks, market-hours and stale-tick checks, IB
distribution, A-book forwarding, and audit rows exactly like manual trades.
This engine decides only *when*; it never re-implements *how*.

Safety rails per instance:
  - last_eval_bar_ts baseline: a freshly deployed instance never trades on a
    historical bar — it arms on the current closed bar and acts from the next.
  - max_open_positions / max_trades_per_day from the DSL risk block.
  - Order rejections (insufficient margin, market closed, stale price) are
    recorded on the instance; ERROR_LIMIT consecutive failures flip it to
    'error' and it stops trading until the user redeploys.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.engine_lock import engine_lock
from packages.common.src.models import (
    AIStrategyInstance, AIStrategyTrade, Position, TradingAccount,
)
from packages.common.src.bars_store import TF_SECONDS, read_bars
from packages.common.src.price_cache import price_cache
from packages.common.src.schemas import PlaceOrderRequest, ClosePositionRequest
from packages.common.src.strategy_dsl import (
    Bars, StrategyDSL, entry_signal, exit_signal,
)

logger = logging.getLogger("gateway.ai_strategy")

TICK_INTERVAL = 20
ERROR_LIMIT = 10
LOOKBACK_EXTRA_BARS = 60


class _EngineRequest:
    """Minimal stand-in for fastapi.Request — place_order only reads
    request.headers.get('user-agent') for the audit log."""
    headers: dict = {"user-agent": "ai-strategy-engine"}


class AIStrategyEngine:
    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        asyncio.create_task(self._run())
        logger.info("AI strategy engine started (tick=%ds)", TICK_INTERVAL)

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                async with engine_lock("ai_strategy", ttl_seconds=TICK_INTERVAL * 3) as is_leader:
                    if is_leader:
                        await self._tick()
            except Exception as e:
                logger.error("AI strategy engine tick error: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)

    async def _tick(self):
        async with AsyncSessionLocal() as db:
            instance_ids = (await db.execute(
                select(AIStrategyInstance.id)
                .where(AIStrategyInstance.status == "running")
            )).scalars().all()
        for iid in instance_ids:
            try:
                # One session per instance so a failure can't poison the batch.
                async with AsyncSessionLocal() as db:
                    await self._process_instance(iid, db)
            except Exception as e:
                logger.error("AI instance %s crashed: %s", iid, e, exc_info=True)

    async def _process_instance(self, instance_id, db: AsyncSession):
        instance = (await db.execute(
            select(AIStrategyInstance)
            .where(AIStrategyInstance.id == instance_id)
            .with_for_update()
        )).scalar_one_or_none()
        if not instance or instance.status != "running":
            return

        try:
            dsl = StrategyDSL.model_validate(instance.dsl_snapshot)
        except Exception as e:
            await self._record_error(db, instance, f"invalid DSL snapshot: {e}", fatal=True)
            return

        tf_seconds = TF_SECONDS[dsl.timeframe]
        now = int(datetime.now(timezone.utc).timestamp())
        warmup = dsl.warmup_bars()
        from_ts = now - (warmup + LOOKBACK_EXTRA_BARS) * tf_seconds

        raw_bars = await read_bars(
            db, dsl.symbol, dsl.timeframe,
            from_ts=from_ts, to_ts=now, limit=warmup + LOOKBACK_EXTRA_BARS + 5,
        )
        # Only fully CLOSED bars — drop the in-progress one.
        closed = [b for b in raw_bars if int(b["time"]) + tf_seconds <= now]
        if len(closed) < warmup + 2:
            return  # not enough history yet; try again next tick

        bars = Bars(closed)
        last_ts = bars.ts[-1]

        # Arm on first sight: never act on a bar that predates the deploy.
        if not instance.last_eval_bar_ts:
            instance.last_eval_bar_ts = last_ts
            await db.commit()
            return
        if last_ts <= instance.last_eval_bar_ts:
            return  # no new closed bar since last evaluation

        instance.last_eval_bar_ts = last_ts
        await db.commit()  # claim the bar before doing slow work

        i = len(bars) - 1

        # ── Exits first ──────────────────────────────────────────────────
        open_links = (await db.execute(
            select(AIStrategyTrade, Position)
            .join(Position, Position.id == AIStrategyTrade.position_id)
            .where(
                AIStrategyTrade.instance_id == instance.id,
                Position.status == "open",
            )
        )).all()

        from ..services import trading_service

        for link, pos in open_links:
            side = pos.side.value if hasattr(pos.side, "value") else str(pos.side)
            if exit_signal(dsl, bars, i, side):
                try:
                    await trading_service.close_position(
                        pos.id, ClosePositionRequest(),
                        user_id=instance.user_id, db=db,
                        close_reason_override="ai_strategy",
                    )
                    logger.info("[AI] exit %s %s pos=%s instance=%s",
                                dsl.symbol, side, pos.id, instance.id)
                except Exception as e:
                    detail = getattr(e, "detail", str(e))
                    logger.warning("[AI] exit failed pos=%s: %s", pos.id, detail)

        # ── Entry ────────────────────────────────────────────────────────
        sig = entry_signal(dsl, bars, i)
        if sig is None:
            await self._record_success(db, instance)
            return

        # Count from DB (exits above may have closed some).
        open_count = (await db.execute(
            select(func.count(Position.id))
            .join(AIStrategyTrade, AIStrategyTrade.position_id == Position.id)
            .where(AIStrategyTrade.instance_id == instance.id, Position.status == "open")
        )).scalar() or 0
        if open_count >= dsl.risk.max_open_positions:
            return

        day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today = (await db.execute(
            select(func.count(AIStrategyTrade.id)).where(
                AIStrategyTrade.instance_id == instance.id,
                AIStrategyTrade.created_at >= day_start,
            )
        )).scalar() or 0
        if today >= dsl.risk.max_trades_per_day:
            return

        account = await db.get(TradingAccount, instance.account_id)
        if not account or not account.is_active:
            await self._record_error(db, instance, "trading account inactive", fatal=True)
            return

        # SL/TP from the live quote (≈ fill price) so place_order's level
        # validation is consistent with the actual fill.
        sl = tp = None
        tick_raw = await price_cache.get(dsl.symbol)
        if tick_raw:
            try:
                tick = json.loads(tick_raw)
                ref = Decimal(str(tick["ask"] if sig == "buy" else tick["bid"]))
                direction = Decimal("1") if sig == "buy" else Decimal("-1")
                if dsl.risk.stop_loss_pct:
                    sl = ref * (1 - direction * Decimal(str(dsl.risk.stop_loss_pct)) / 100)
                if dsl.risk.take_profit_pct:
                    tp = ref * (1 + direction * Decimal(str(dsl.risk.take_profit_pct)) / 100)
            except (KeyError, ValueError):
                pass

        req = PlaceOrderRequest(
            account_id=instance.account_id,
            symbol=dsl.symbol,
            order_type="market",
            side=sig,
            lots=Decimal(str(dsl.risk.lots)),
            stop_loss=sl,
            take_profit=tp,
            comment=f"AI Strategy [{str(instance.strategy_id)[:8]}]",
        )
        try:
            result = await trading_service.place_order(
                req=req, request=_EngineRequest(),
                user_id=instance.user_id, ip_address=None, db=db,
            )
        except Exception as e:
            detail = getattr(e, "detail", str(e))
            await self._record_error(db, instance, f"order rejected: {detail}")
            return

        db.add(AIStrategyTrade(
            instance_id=instance.id,
            strategy_id=instance.strategy_id,
            user_id=instance.user_id,
            order_id=result.get("id"),
            position_id=result.get("position_id"),
            side=sig,
            lots=Decimal(str(dsl.risk.lots)),
            signal_bar_ts=last_ts,
        ))
        instance.trades_count = (instance.trades_count or 0) + 1
        instance.error_count = 0
        instance.last_error = None
        await db.commit()
        logger.info("[AI] entry %s %s %.2f lots instance=%s pos=%s",
                    sig.upper(), dsl.symbol, dsl.risk.lots,
                    instance.id, result.get("position_id"))

    async def _record_success(self, db: AsyncSession, instance: AIStrategyInstance):
        if instance.error_count:
            instance.error_count = 0
            await db.commit()

    async def _record_error(self, db: AsyncSession, instance: AIStrategyInstance,
                            message: str, fatal: bool = False):
        instance.error_count = (instance.error_count or 0) + 1
        instance.last_error = message[:2000]
        if fatal or instance.error_count >= ERROR_LIMIT:
            instance.status = "error"
            instance.stopped_at = datetime.now(timezone.utc)
            logger.warning("[AI] instance %s stopped: %s", instance.id, message)
        await db.commit()


ai_strategy_engine = AIStrategyEngine()
