"""Copy Trade Engine — Replicates master trades to investor sub-accounts.

Architecture:
- Manager trades one master TradingAccount; positions live as Position rows.
- This engine polls ~every 1s and reconciles master open positions against the
  DURABLE CopyTrade table (no in-memory snapshot): every (open master position,
  active allocation) pair without a CopyTrade row in ANY status is mirrored
  once; mirrors whose master position closed are closed by the orphan sweeps.
  Pairs that were attempted but skipped (e.g. insufficient margin) are recorded
  in Redis so they are not retried every second -- exactly like the old
  one-shot diff, but shared by every worker / replica.
- Lot scaling is driven by InvestorAllocation.copy_type (signal | pamm | mam), not mixed.
- Master positions are never modified by this engine.

Performance fee runs on close only (see _close_copy).
"""
import asyncio
import json
import logging
from decimal import Decimal
from datetime import datetime, timezone
from uuid import UUID
from typing import Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.instrumentation import spawn
from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    MasterAccount, InvestorAllocation, CopyTrade, Position, PositionStatus,
    TradingAccount, TradeHistory, Transaction, Order,
)
from packages.common.src.redis_client import redis_client
from packages.common.src.price_cache import price_cache
from packages.common.src.admin_fees import credit_admin_fee
from packages.common.src.copy_fees import apply_hwm_fee
from packages.common.src.engine_lock import engine_lock
from packages.common.src.row_locks import for_update, lock_account, lock_user
from packages.common.src.notify import create_notification

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("copy-engine")

MIN_COPY_LOT = 0.01
COPY_COMMENT_PREFIX = "Copy of master position "
# Cluster-wide lock key so only one gateway worker processes copy trades at a
# time — with --workers=N each worker would otherwise duplicate every mirror.
COPY_ENGINE_LOCK_KEY = "copy_engine:cycle_lock"
COPY_ENGINE_LOCK_TTL = 10
# A master position this young (and opened after the follower joined) is a
# real-time mirror at the master's own entry; anything older is a catch-up at
# the CURRENT market price (C-TRADE-3). Covers a leader failover (lock TTL).
FRESH_MIRROR_WINDOW_SEC = 15
# Redis set per master position of allocation ids already ATTEMPTED (opened or
# deliberately skipped) so a skip isn't retried every cycle by any worker.
CONSIDERED_KEY_PREFIX = "copy_engine:considered:"
CONSIDERED_TTL_SEC = 30 * 24 * 3600


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def is_catch_up(master_pos, allocation, now: Optional[datetime] = None) -> bool:
    """True when the follower must enter at the CURRENT market price: the
    master position predates the allocation, or is older than the real-time
    mirror window (engine was down / leader changed / follower just joined)."""
    now = now or datetime.now(timezone.utc)
    opened = _aware(getattr(master_pos, "created_at", None))
    if opened is None:
        return True
    joined = _aware(getattr(allocation, "created_at", None))
    if joined is not None and opened < joined:
        return True
    return (now - opened).total_seconds() > FRESH_MIRROR_WINDOW_SEC


def resolve_copy_type(allocation: InvestorAllocation, master: MasterAccount) -> str:
    """Effective copy mode: stored copy_type, else legacy inference from master.master_type."""
    raw = allocation.copy_type
    if raw:
        s = str(raw).strip().lower()
        if s in ("signal", "pamm", "mam"):
            return s
    mt = (master.master_type or "signal_provider").lower()
    if mt == "pamm":
        return "pamm"
    if mt == "mamm":
        return "mam"
    return "signal"


class CopyTradeEngine:
    def __init__(self):
        self._running = False
        # (master_position_id, allocation_id) pairs attempted this cycle --
        # recorded in Redis only AFTER the cycle commits.
        self._pending_considered: list[tuple[str, str]] = []
        # Real-time WS events queued during a cycle and published to the
        # follower's `account:{id}` channel AFTER db.commit() — so the
        # follower's terminal refreshes open positions + history the instant
        # a copy opens/closes, instead of only on a manual page refresh.
        # Published post-commit to avoid a read-before-commit race in the
        # follower's refreshPositions() call.
        self._pending_events: list[tuple[str, str]] = []

    @staticmethod
    def compute_lot_size(
        master_lots: float,
        master_account: TradingAccount,
        investor_allocation: InvestorAllocation,
        investor_account: TradingAccount,
        *,
        total_pool: float,
        copy_type: str,
    ) -> Tuple[Optional[float], Optional[str]]:
        """
        Raw scaled lots for one investor, rounded to 2 decimals.
        Returns (lots, None) or (None, skip_reason).
        """
        ml = float(master_lots or 0)
        if ml <= 0:
            return None, "zero_master_lots"

        ct = (copy_type or "signal").lower()

        if ct == "signal":
            inv_eq = float(investor_account.equity or investor_account.balance or 0)
            if inv_eq <= 0:
                return None, "signal_zero_investor_equity"
            mst_eq = float(master_account.equity or master_account.balance or 0)
            if mst_eq <= 0:
                return None, "signal_zero_master_equity"
            raw = ml * (inv_eq / mst_eq)
        elif ct == "pamm":
            if total_pool <= 0:
                return None, "pamm_zero_total_pool"
            amt = float(investor_allocation.allocation_amount or 0)
            raw = ml * (amt / total_pool)
        elif ct == "mam":
            if total_pool <= 0:
                return None, "mam_zero_total_pool"
            pct = (
                float(investor_allocation.allocation_pct)
                if investor_allocation.allocation_pct is not None
                else 100.0
            )
            if pct == 0:
                return None, "mam_zero_allocation_pct"
            amt = float(investor_allocation.allocation_amount or 0)
            pool_share_lots = ml * (amt / total_pool)
            raw = pool_share_lots * (pct / 100.0)
        else:
            return None, f"unknown_copy_type:{ct}"

        rounded = round(raw, 2)
        if rounded < MIN_COPY_LOT:
            # The proportional size rounds below the platform's minimum lot —
            # e.g. a master trading 0.01 lots with a follower whose equity is
            # smaller than the master's. Skipping here left followers with NO
            # mirrored trade at all (the reported "master trade not copying"
            # bug). Clamp up to the minimum tradeable lot so the position is
            # still copied; the follower accepts slightly higher proportional
            # exposure as the cost of participating at small sizes. The
            # downstream free-margin check in _open_copy still rejects the open
            # if the account genuinely can't afford even 0.01 lots.
            return MIN_COPY_LOT, None
        return rounded, None

    async def start(self):
        self._running = True
        logger.info("Copy Trade Engine started")
        spawn(self._run(), name="copy_engine")

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                # Cluster-wide leader lock — prevents duplicate mirroring
                # when gateway runs with `--workers N`. Migrated from a
                # hand-rolled `SET NX + DELETE` to the shared engine_lock
                # utility, which uses a CAS-style Lua release so a slow
                # tick whose TTL expires can't accidentally delete the
                # next holder's lock.
                async with engine_lock("copy_engine", ttl_seconds=COPY_ENGINE_LOCK_TTL) as is_leader:
                    if not is_leader:
                        await asyncio.sleep(1)
                        continue

                    self._pending_events = []  # fresh per cycle
                    self._pending_considered = []
                    async with AsyncSessionLocal() as db:
                        # Global orphan sweep — close any follower mirror whose
                        # master position is already closed, even if the master
                        # has no active followers left (e.g. last investor
                        # withdrew while master still had open positions).
                        await self._global_orphan_sweep(db)

                        # Select masters that ACTUALLY have an active follower,
                        # computed live via EXISTS — never the denormalised
                        # master.followers_count counter. That counter drifts
                        # out of sync (double-decrements on stop/withdraw, admin
                        # resets to 0, legacy backfills — see fix_pending_copies.py
                        # and the "actual count from allocations, not stale
                        # counter" notes in every read path). When it drifts to 0
                        # while a follower is still active, the old query skipped
                        # the master entirely and NO trades were ever mirrored —
                        # the reported "master trade not copying" bug. EXISTS is
                        # also still efficient: masters with no active allocation
                        # are filtered in SQL, not loaded and early-returned.
                        masters = await db.execute(
                            select(MasterAccount).where(
                                MasterAccount.status.in_(["approved", "active"]),
                                select(InvestorAllocation.id)
                                .where(
                                    InvestorAllocation.master_id == MasterAccount.id,
                                    InvestorAllocation.status == "active",
                                )
                                .exists(),
                            )
                        )
                        for master in masters.scalars().all():
                            await self.process_master(master, db)
                        await db.commit()
                    # Durably committed — now fan out the real-time events so
                    # followers' terminals update without a manual refresh.
                    await self._flush_events()
                    await self._flush_considered()
            except Exception as e:
                logger.error("Copy engine error: %s", e, exc_info=True)
                self._pending_events = []  # don't publish a half-rolled-back cycle
                self._pending_considered = []

            await asyncio.sleep(1)

    async def _flush_events(self) -> None:
        """Publish queued follower-facing WS events (post-commit, best-effort)."""
        events, self._pending_events = self._pending_events, []
        for channel, payload in events:
            try:
                await redis_client.publish(channel, payload)
            except Exception as e:
                logger.warning("copy-engine publish failed on %s: %s", channel, e)

    async def _flush_considered(self) -> None:
        """Record attempted pairs (post-commit, best-effort, one round trip)."""
        pairs, self._pending_considered = self._pending_considered, []
        if not pairs:
            return
        try:
            pipe = redis_client.pipeline(transaction=False)
            for mpos, alloc in pairs:
                key = f"{CONSIDERED_KEY_PREFIX}{mpos}"
                pipe.sadd(key, alloc)
                pipe.expire(key, CONSIDERED_TTL_SEC)
            await pipe.execute()
        except Exception as e:
            # Worst case a skipped pair is re-attempted next cycle; a pair that
            # WAS opened is still deduped by its CopyTrade row.
            logger.warning("copy-engine: recording considered pairs failed: %s", e)

    async def _load_considered(self, master_pos_ids: list[str]) -> set[tuple[str, str]]:
        if not master_pos_ids:
            return set()
        try:
            pipe = redis_client.pipeline(transaction=False)
            for mpos in master_pos_ids:
                pipe.smembers(f"{CONSIDERED_KEY_PREFIX}{mpos}")
            results = await pipe.execute()
        except Exception as e:
            # Fail closed: without the record we can't tell a deliberate skip
            # from a never-tried pair, so skip opens this cycle.
            logger.warning("copy-engine: loading considered pairs failed: %s", e)
            raise
        out: set[tuple[str, str]] = set()
        for mpos, members in zip(master_pos_ids, results):
            for alloc in members or ():
                out.add((mpos, alloc.decode() if isinstance(alloc, bytes) else str(alloc)))
        return out

    async def _global_orphan_sweep(self, db: AsyncSession) -> None:
        """Close any open CopyTrade whose master Position is already closed,
        regardless of which master it belongs to. Guarantees stuck follower
        mirrors recover even if the master has been deactivated or has zero
        active followers now."""
        q = await db.execute(
            select(CopyTrade, MasterAccount)
            .join(Position, CopyTrade.master_position_id == Position.id)
            .join(InvestorAllocation, CopyTrade.investor_allocation_id == InvestorAllocation.id)
            .join(MasterAccount, InvestorAllocation.master_id == MasterAccount.id)
            .where(
                CopyTrade.status == "open",
                Position.status != "open",
            )
        )
        rows = list(q.all())
        if not rows:
            return
        logger.info("Global orphan sweep: closing %d stuck copy mirror(s)", len(rows))
        for copy, master in rows:
            try:
                await self._close_copy(copy, master, db)
            except Exception as e:
                logger.error("Global orphan sweep failed for copy=%s: %s", copy.id, e)

    async def _sum_active_allocation_pool(self, master_id: UUID, db: AsyncSession) -> float:
        q = await db.execute(
            select(func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0)).where(
                InvestorAllocation.master_id == master_id,
                InvestorAllocation.status == "active",
            )
        )
        return float(q.scalar() or 0)

    async def process_master(self, master: MasterAccount, db: AsyncSession) -> None:
        """One full sync cycle for a single master, reconciled against the DB.

        No in-memory snapshot: a pair (open master position, active
        allocation) is mirrored iff no CopyTrade row exists for it in ANY
        status and it hasn't already been attempted (Redis "considered" set).
        A leader change, restart or second replica therefore can never
        re-open a copy the follower already had, nor miss one."""
        master_id_str = str(master.id)

        master_positions_q = await db.execute(
            select(Position).where(
                Position.account_id == master.account_id,
                Position.status == PositionStatus.OPEN,
            )
        )
        master_open: dict[str, Position] = {}
        for p in master_positions_q.scalars().all():
            if p.comment and COPY_COMMENT_PREFIX in (p.comment or ""):
                continue
            if p.comment and "Copy of master" in p.comment:
                continue
            master_open[str(p.id)] = p

        investors = await db.execute(
            select(InvestorAllocation).where(
                InvestorAllocation.master_id == master.id,
                InvestorAllocation.status == "active",
            )
        )
        active_investors = investors.scalars().all()
        if not active_investors:
            logger.debug("process_master skip master=%s: no active allocations", master_id_str)
            return

        master_account = await db.get(TradingAccount, master.account_id)
        if not master_account:
            logger.warning("process_master skip master=%s: master trading account missing", master_id_str)
            return

        total_pool = await self._sum_active_allocation_pool(master.id, db)
        if total_pool <= 0 and any(
            resolve_copy_type(inv, master) in ("pamm", "mam") for inv in active_investors
        ):
            logger.warning(
                "process_master master=%s: total_pool=0, skipping PAMM/MAM opens this cycle",
                master_id_str,
            )

        if master_open:
            # Batch: every existing mirror (ANY status) of these master
            # positions, in one query.
            existing_q = await db.execute(
                select(CopyTrade.master_position_id, CopyTrade.investor_allocation_id).where(
                    CopyTrade.master_position_id.in_([p.id for p in master_open.values()])
                )
            )
            existing_pairs = {(str(mp), str(ia)) for mp, ia in existing_q.all()}
            considered = await self._load_considered(list(master_open.keys()))
            now = datetime.now(timezone.utc)

            for investor in active_investors:
                # PAMM investors pool on the master account -- no sub-account opens.
                if resolve_copy_type(investor, master) == "pamm":
                    continue
                alloc_key = str(investor.id)
                todo = [
                    (pid, mp) for pid, mp in master_open.items()
                    if (pid, alloc_key) not in existing_pairs
                    and (pid, alloc_key) not in considered
                ]
                if not todo:
                    continue
                investor_account = await db.get(TradingAccount, investor.investor_account_id)
                if not investor_account or not investor_account.is_active:
                    # Not ready yet -- retried next cycle (not marked considered).
                    logger.info(
                        "Skip copy open: inactive or missing investor account allocation=%s",
                        investor.id,
                    )
                    continue
                for pid, master_pos in todo:
                    await self._open_copy(
                        master,
                        master_pos,
                        investor,
                        investor_account,
                        master_account,
                        total_pool,
                        db,
                        catch_up=is_catch_up(master_pos, investor, now),
                    )
                    self._pending_considered.append((pid, alloc_key))
                    if investor.status != "active":
                        break  # paused by the drawdown guard inside _open_copy

        # -- Close mirrors whose master position is no longer open ------------
        # (replaces the old in-memory "closed since last cycle" diff; also
        # self-heals closes that happened while the engine was not running).
        orphan_copies_q = await db.execute(
            select(CopyTrade)
            .join(Position, CopyTrade.master_position_id == Position.id)
            .where(
                Position.account_id == master.account_id,
                CopyTrade.status == "open",
                Position.status != "open",
            )
        )
        orphans = list(orphan_copies_q.scalars().all())
        if orphans:
            logger.info(
                "process_master master=%s: found %d orphaned copy(ies) to close",
                master_id_str, len(orphans),
            )
        for copy in orphans:
            logger.info(
                "Closing orphaned copy: copy_id=%s investor_allocation=%s master_pos=%s",
                copy.id, copy.investor_allocation_id, copy.master_position_id,
            )
            await self._close_copy(copy, master, db)

    async def _open_copy(
        self,
        master: MasterAccount,
        master_pos: Position,
        investor: InvestorAllocation,
        investor_account: TradingAccount,
        master_account: TradingAccount,
        total_pool: float,
        db: AsyncSession,
        catch_up: bool = False,
    ):
        instrument = master_pos.instrument
        if not instrument:
            logger.warning("Skip copy open: no instrument on master position %s", master_pos.id)
            return

        # Dedupe against a CopyTrade in ANY status (open OR closed): once a
        # pair has been mirrored it is never mirrored again -- the old
        # status=="open" filter re-opened a copy the follower had already
        # closed whenever a fresh leader re-seeded. Backed by the unique index
        # uq_copy_trades_master_pos_alloc (migration 0076).
        existing_q = await db.execute(
            select(CopyTrade.id).where(
                CopyTrade.master_position_id == master_pos.id,
                CopyTrade.investor_allocation_id == investor.id,
            ).limit(1)
        )
        if existing_q.scalar_one_or_none():
            return

        # Max-drawdown safety stop: if cumulative loss as a percentage of
        # the allocation principal exceeds the follower's configured
        # threshold, pause this allocation and skip the open. Status flips
        # to "paused_drawdown" so the engine stops opening new copies on
        # this allocation; existing open copies continue and may recover.
        # The follower can manually re-activate from the social UI once
        # they're comfortable.
        if investor.max_drawdown_pct is not None and investor.max_drawdown_pct > 0:
            principal = Decimal(str(investor.allocation_amount or 0))
            profit = Decimal(str(investor.total_profit or 0))
            if principal > 0 and profit < 0:
                drawdown_pct = (-profit / principal) * Decimal("100")
                if drawdown_pct >= Decimal(str(investor.max_drawdown_pct)):
                    investor.status = "paused_drawdown"
                    logger.warning(
                        "Allocation %s paused: drawdown %.2f%% >= cap %.2f%%",
                        investor.id, float(drawdown_pct), float(investor.max_drawdown_pct),
                    )
                    try:
                        await create_notification(
                            db,
                            investor.investor_user_id,
                            title="Copy trading paused — drawdown limit hit",
                            message=(
                                f"Your copy of this master was paused after a "
                                f"{float(drawdown_pct):.1f}% loss (your limit: "
                                f"{float(investor.max_drawdown_pct):.1f}%). "
                                "No new trades will be copied. You can resume from /social."
                            ),
                            notif_type="copy_trade",
                            action_url="/social",
                            commit=False,
                        )
                    except Exception:
                        pass
                    return

        side_val = master_pos.side.value if hasattr(master_pos.side, "value") else str(master_pos.side)
        master_lots = float(master_pos.lots or 0)

        ct = resolve_copy_type(investor, master)
        base_lots, skip_reason = self.compute_lot_size(
            master_lots,
            master_account,
            investor,
            investor_account,
            total_pool=total_pool,
            copy_type=ct,
        )
        if base_lots is None:
            logger.info(
                "Skip copy open: allocation=%s master_pos=%s copy_type=%s reason=%s",
                investor.id,
                master_pos.id,
                ct,
                skip_reason,
            )
            return

        copy_lots = float(base_lots)
        lot_step = float(instrument.lot_step or Decimal("0.01"))
        copy_lots = max(lot_step, round(copy_lots / lot_step) * lot_step)

        min_lot = float(instrument.min_lot or Decimal("0.01"))
        max_lot = float(instrument.max_lot or Decimal("100"))
        copy_lots = max(min_lot, min(copy_lots, max_lot))

        if copy_lots < MIN_COPY_LOT:
            logger.info(
                "Skip copy open: allocation=%s master_pos=%s post_step_lots=%s below min %s",
                investor.id,
                master_pos.id,
                copy_lots,
                MIN_COPY_LOT,
            )
            return

        if investor.max_lot_override and copy_lots > float(investor.max_lot_override):
            copy_lots = float(investor.max_lot_override)

        # C-TRADE-3: a follower joining while the master position is ALREADY
        # open (catch-up seeding) must enter at the CURRENT market price, not
        # the master's original entry — otherwise they instantly inherit the
        # master's accrued unrealised P&L (a phantom gain/loss). A real-time
        # mirror (catch_up=False) uses the master's open price, which is ~now.
        open_price = master_pos.open_price
        if catch_up:
            tick_data = await price_cache.get(instrument.symbol)
            if tick_data:
                try:
                    tick = json.loads(tick_data)
                    open_price = Decimal(str(tick["ask"])) if side_val == "buy" else Decimal(str(tick["bid"]))
                except (json.JSONDecodeError, KeyError, ValueError):
                    open_price = master_pos.open_price
            else:
                logger.warning(
                    "Catch-up copy open for %s: no live tick, falling back to master open_price",
                    instrument.symbol,
                )

        # Lock the follower account and re-read it before the free-margin check
        # and the margin update (a concurrent manual trade / transfer on the
        # same account would otherwise lose-update margin_used).
        locked_acct = await lock_account(db, investor_account.id)
        if locked_acct is not None:
            investor_account = locked_acct

        contract_size = float(instrument.contract_size or 100000)
        required_margin = Decimal(
            str(copy_lots * contract_size * float(open_price) / investor_account.leverage)
        )

        if required_margin > (investor_account.free_margin or Decimal("0")):
            logger.warning(
                "Insufficient margin for copy: investor_account=%s allocation=%s master_pos=%s",
                investor.investor_account_id,
                investor.id,
                master_pos.id,
            )
            return

        comment = f"{COPY_COMMENT_PREFIX}{master_pos.id}"

        # Create an Order row so the copy trade is first-class in trading history
        # and so IBCommission.source_trade_id (FK → orders.id) can reference it.
        order = Order(
            account_id=investor_account.id,
            instrument_id=master_pos.instrument_id,
            order_type="market",
            side=side_val,
            status="filled",
            lots=Decimal(str(copy_lots)),
            filled_price=open_price,
            filled_at=datetime.now(timezone.utc),
            commission=Decimal("0"),
            comment=comment,
        )
        db.add(order)
        await db.flush()

        position = Position(
            account_id=investor_account.id,
            instrument_id=master_pos.instrument_id,
            order_id=order.id,
            side=side_val,
            status=PositionStatus.OPEN.value,
            lots=Decimal(str(copy_lots)),
            open_price=open_price,
            stop_loss=master_pos.stop_loss,
            take_profit=master_pos.take_profit,
            comment=comment,
        )
        db.add(position)
        await db.flush()

        copy_record = CopyTrade(
            master_position_id=master_pos.id,
            investor_allocation_id=investor.id,
            investor_position_id=position.id,
            ratio=Decimal(str(copy_lots / master_lots)) if master_lots > 0 else Decimal("1"),
            status="open",
        )
        db.add(copy_record)

        investor_account.margin_used = (investor_account.margin_used or Decimal("0")) + required_margin
        investor_account.free_margin = investor_account.equity - investor_account.margin_used

        # Copy trades count as real trading volume — flow IB commission up the
        # investor's referrer chain (same rate as regular trades).
        try:
            from .ib_engine import distribute_ib_commission
            await distribute_ib_commission(
                db,
                investor_account.user_id,
                order.id,
                Decimal(str(copy_lots)),
                instrument.symbol,
            )
        except Exception as e:
            logger.error(
                "IB commission distribute failed for copy trade investor=%s order=%s: %s",
                investor.id, order.id, e,
            )

        logger.info(
            "Copy opened: %s %s %s lots investor=%s master_pos=%s copy_type=%s (master %s lots)",
            instrument.symbol,
            side_val,
            copy_lots,
            investor_account.account_number,
            master_pos.id,
            ct,
            master_lots,
        )

        # Notify the follower's terminal so the new copy position appears live
        # (flushed after commit in _run).
        self._pending_events.append((
            f"account:{investor_account.id}",
            json.dumps({
                "type": "position_opened",
                "position_id": str(position.id),
                "symbol": instrument.symbol,
                "side": side_val,
                "lots": str(copy_lots),
                "open_price": str(open_price),
            }),
        ))

    async def _close_copy(self, copy: CopyTrade, master: MasterAccount, db: AsyncSession):
        # Lock the mirror position FIRST (same order as every other close path:
        # position → account) and refresh it from the row, so a concurrent
        # manual / SL-TP close that already closed it is seen and we never
        # write a second TradeHistory / P&L credit.
        investor_pos = (await db.execute(
            for_update(select(Position).where(Position.id == copy.investor_position_id))
        )).scalar_one_or_none()
        if not investor_pos:
            copy.status = "closed"
            logger.info("Close copy: investor position missing, marking copy closed")
            return

        pos_status = investor_pos.status.value if hasattr(investor_pos.status, "value") else str(investor_pos.status)
        if pos_status != "open":
            copy.status = "closed"
            return

        instrument = investor_pos.instrument
        if not instrument:
            copy.status = "closed"
            logger.warning("Close copy: no instrument on investor position %s", investor_pos.id)
            return

        side_val = investor_pos.side.value if hasattr(investor_pos.side, "value") else str(investor_pos.side)
        close_price = None

        # Prefer the live tick so in-progress closes mirror the master's
        # exit price tightly.
        tick_data = await price_cache.get(instrument.symbol)
        if tick_data:
            try:
                tick = json.loads(tick_data)
                close_price = Decimal(str(tick["bid"])) if side_val == "buy" else Decimal(str(tick["ask"]))
            except (json.JSONDecodeError, KeyError, ValueError):
                close_price = None

        # Orphan catch-up (gateway restart, market closed, tick expired): the
        # master has already closed — use the master position's own close_price
        # so the follower books out at the same level instead of getting stuck
        # forever waiting for a tick.
        if close_price is None:
            master_pos = await db.get(Position, copy.master_position_id)
            if master_pos and master_pos.close_price is not None:
                close_price = master_pos.close_price
                logger.info(
                    "Close copy: using master close_price=%s for %s (no live tick)",
                    close_price, instrument.symbol,
                )

        # Last resort: close at the investor's own open price (zero P&L) rather
        # than leave the position stuck open indefinitely.
        if close_price is None:
            close_price = investor_pos.open_price
            logger.warning(
                "Close copy: no tick and no master close_price for %s — closing at open_price (zero P&L)",
                instrument.symbol,
            )

        contract_size = instrument.contract_size or Decimal("100000")

        if side_val == "buy":
            gross_profit = (close_price - investor_pos.open_price) * investor_pos.lots * contract_size
        else:
            gross_profit = (investor_pos.open_price - close_price) * investor_pos.lots * contract_size
        from packages.common.src.trading_service import quote_to_account_pnl, cross_rate_for
        gross_profit = quote_to_account_pnl(
            gross_profit,
            getattr(instrument, "base_currency", None),
            getattr(instrument, "quote_currency", None),
            close_price,
            symbol=getattr(instrument, "symbol", None),
            cross_rate=await cross_rate_for(instrument),
        )

        # High-water mark: charge only on profit ABOVE the follower's
        # previous peak, so losses must be earned back before the master
        # is paid again (compute_hwm_fee also advances the mark).
        performance_fee = Decimal("0")
        admin_fee = Decimal("0")
        alloc_for_fee = await db.get(InvestorAllocation, copy.investor_allocation_id)
        if alloc_for_fee is not None:
            performance_fee = apply_hwm_fee(
                alloc_for_fee, gross_profit, master.performance_fee_pct or Decimal("0")
            )
            if performance_fee > 0:
                admin_pct = master.admin_commission_pct or Decimal("0")
                admin_fee = performance_fee * admin_pct / Decimal("100")

        net_profit = gross_profit - performance_fee

        investor_pos.status = PositionStatus.CLOSED.value
        investor_pos.close_price = close_price
        investor_pos.profit = net_profit
        investor_pos.closed_at = datetime.now(timezone.utc)

        # C-TRADE-4 / A12: lock order USERS (ascending id) → ACCOUNTS (ascending
        # id). When a performance fee moves money between follower and master,
        # both users are locked first; then the follower's mirror account and
        # (fee only) the master pool account, in ascending id order, so two
        # closes touching the same pair can never deadlock on lock order.
        fee_user_ids = set()
        if performance_fee > 0:
            if alloc_for_fee is not None and alloc_for_fee.investor_user_id:
                fee_user_ids.add(alloc_for_fee.investor_user_id)
            if master.user_id:
                fee_user_ids.add(master.user_id)
        for uid in sorted(fee_user_ids, key=str):
            await lock_user(db, uid)
        acct_ids = {investor_pos.account_id}
        if performance_fee > 0 and master.account_id:
            acct_ids.add(master.account_id)
        locked_accounts = {}
        for aid in sorted(acct_ids, key=str):
            locked_accounts[aid] = await lock_account(db, aid)
        investor_account = locked_accounts.get(investor_pos.account_id)
        if investor_account:
            investor_account.balance = (investor_account.balance or Decimal("0")) + net_profit
            margin_release = (investor_pos.lots * contract_size * investor_pos.open_price) / Decimal(
                str(investor_account.leverage)
            )
            investor_account.margin_used = max(
                Decimal("0"), (investor_account.margin_used or Decimal("0")) - margin_release
            )
            investor_account.equity = investor_account.balance + (investor_account.credit or Decimal("0"))
            investor_account.free_margin = investor_account.equity - investor_account.margin_used

        alloc = await db.get(InvestorAllocation, copy.investor_allocation_id)
        if alloc:
            alloc.total_profit = (alloc.total_profit or Decimal("0")) + net_profit

        history = TradeHistory(
            position_id=investor_pos.id,
            account_id=investor_pos.account_id,
            instrument_id=investor_pos.instrument_id,
            side=investor_pos.side,
            lots=investor_pos.lots,
            open_price=investor_pos.open_price,
            close_price=close_price,
            swap=investor_pos.swap or Decimal("0"),
            commission=investor_pos.commission or Decimal("0"),
            profit=net_profit,
            close_reason="copy_close",
            opened_at=investor_pos.created_at,
            closed_at=datetime.now(timezone.utc),
        )
        db.add(history)

        if investor_account and investor_account.user_id:
            if performance_fee > 0:
                db.add(
                    Transaction(
                        user_id=investor_account.user_id,
                        account_id=investor_account.id,
                        type="commission",
                        amount=-performance_fee,
                        balance_after=investor_account.balance,
                        reference_id=investor_pos.id,
                        description=f"Performance fee ({master.performance_fee_pct}%) on copy trade",
                    )
                )

        if performance_fee > 0:
            # Master pool row was locked above (ascending-id order with the
            # follower's account) before crediting its performance-fee share.
            master_account = locked_accounts.get(master.account_id)
            if master_account:
                master_share = performance_fee - admin_fee
                master_account.balance = (master_account.balance or Decimal("0")) + master_share
                master_account.equity = master_account.balance + (master_account.credit or Decimal("0"))
                master_account.free_margin = master_account.equity - (master_account.margin_used or Decimal("0"))

                db.add(
                    Transaction(
                        user_id=master.user_id,
                        account_id=master_account.id,
                        type="ib_commission",
                        amount=master_share,
                        balance_after=master_account.balance,
                        reference_id=investor_pos.id,
                        description="Performance fee earned from copy trade",
                    )
                )

                if admin_fee > 0:
                    await credit_admin_fee(
                        db, admin_fee,
                        description=f"Platform commission ({master.admin_commission_pct}%) from master {master_account.account_number} copy trade",
                        reference_id=investor_pos.id,
                    )
                    # XP_Reward_mechanism slide 6: 50% of the platform's
                    # copy-trade cut is redistributed across the follower's
                    # 10-level referral chain. Best-effort — failure here
                    # must not roll back the trade close.
                    try:
                        from ..services.social_service import distribute_copy_trade_platform_fee
                        await distribute_copy_trade_platform_fee(
                            db,
                            follower_user_id=alloc.investor_user_id,
                            platform_fee=admin_fee,
                            reference_id=investor_pos.id,
                        )
                    except Exception as _e:
                        logger.warning("copy-trade fee network distribution failed: %s", _e)

                # Update master's total fee earned
                master.total_fee_earned = (master.total_fee_earned or Decimal("0")) + master_share

        copy.status = "closed"

        # Notify the follower's terminal so the closed copy leaves the open
        # list and lands in Closed Positions live — same payload shape the
        # SL/TP + manual-close paths use (flushed after commit in _run).
        self._pending_events.append((
            f"account:{investor_pos.account_id}",
            json.dumps({
                "type": "position_closed",
                "position_id": str(investor_pos.id),
                "reason": "copy_close",
                "profit": str(net_profit),
                "close_price": str(close_price),
            }),
        ))

        logger.info(
            "Copy closed: %s %s %s lots | gross=%s perf_fee=%s net=%s master_pos=%s",
            instrument.symbol,
            side_val,
            investor_pos.lots,
            gross_profit,
            performance_fee,
            net_profit,
            copy.master_position_id,
        )


copy_engine = CopyTradeEngine()
