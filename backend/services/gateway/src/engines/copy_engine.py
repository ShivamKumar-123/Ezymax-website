"""Copy Trade Engine — Replicates master trades to investor sub-accounts.

Architecture:
- Manager trades one master TradingAccount; positions live as Position rows.
- This engine polls ~every 2s, diffs master open positions vs in-memory snapshot,
  opens/closes child positions on each linked investor account.
- Lot scaling is driven by InvestorAllocation.copy_type (signal | pamm | mam), not mixed.
- Master positions are never modified by this engine.

Performance fee runs on close only (see _close_copy).
"""
import asyncio
import json
import logging
import unittest
from decimal import Decimal
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID
from collections import defaultdict
from typing import Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    MasterAccount, InvestorAllocation, CopyTrade, Position, PositionStatus,
    TradingAccount, TradeHistory, Transaction,
)
from packages.common.src.redis_client import redis_client, PriceChannel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("copy-engine")

MIN_COPY_LOT = 0.01
COPY_COMMENT_PREFIX = "Copy of master position "


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
        self._master_positions: dict[str, set[str]] = defaultdict(set)

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
            return None, "below_min_lot_0_01"
        return rounded, None

    async def start(self):
        self._running = True
        logger.info("Copy Trade Engine started")
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    masters = await db.execute(
                        select(MasterAccount).where(
                            MasterAccount.status.in_(["approved", "active"]),
                            MasterAccount.followers_count > 0,
                        )
                    )
                    for master in masters.scalars().all():
                        await self.process_master(master, db)
                    await db.commit()
            except Exception as e:
                logger.error("Copy engine error: %s", e, exc_info=True)

            await asyncio.sleep(2)

    async def _sum_active_allocation_pool(self, master_id: UUID, db: AsyncSession) -> float:
        q = await db.execute(
            select(func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0)).where(
                InvestorAllocation.master_id == master_id,
                InvestorAllocation.status == "active",
            )
        )
        return float(q.scalar() or 0)

    async def process_master(self, master: MasterAccount, db: AsyncSession) -> None:
        """One full sync cycle for a single master: read, diff, open/close children."""
        master_id_str = str(master.id)

        master_positions_q = await db.execute(
            select(Position).where(
                Position.account_id == master.account_id,
                Position.status == PositionStatus.OPEN,
            )
        )
        master_open = {}
        for p in master_positions_q.scalars().all():
            if p.comment and COPY_COMMENT_PREFIX in (p.comment or ""):
                continue
            if p.comment and "Copy of master" in p.comment:
                continue
            master_open[str(p.id)] = p
        current_master_pos_ids = set(master_open.keys())
        prev_master_pos_ids = self._master_positions.get(master_id_str, set())

        investors = await db.execute(
            select(InvestorAllocation).where(
                InvestorAllocation.master_id == master.id,
                InvestorAllocation.status == "active",
            )
        )
        active_investors = investors.scalars().all()
        if not active_investors:
            logger.debug("process_master skip master=%s: no active allocations", master_id_str)
            self._master_positions[master_id_str] = current_master_pos_ids
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

        new_positions = current_master_pos_ids - prev_master_pos_ids
        closed_positions = prev_master_pos_ids - current_master_pos_ids

        for pos_id in new_positions:
            master_pos = master_open[pos_id]
            for investor in active_investors:
                investor_account = await db.get(TradingAccount, investor.investor_account_id)
                if not investor_account or not investor_account.is_active:
                    logger.info(
                        "Skip copy open: inactive or missing investor account allocation=%s",
                        investor.id,
                    )
                    continue
                await self._open_copy(
                    master,
                    master_pos,
                    investor,
                    investor_account,
                    master_account,
                    total_pool,
                    db,
                )

        for closed_id in closed_positions:
            copies = await db.execute(
                select(CopyTrade).where(
                    CopyTrade.master_position_id == UUID(closed_id),
                    CopyTrade.status == "open",
                )
            )
            for copy in copies.scalars().all():
                await self._close_copy(copy, master, db)

        self._master_positions[master_id_str] = current_master_pos_ids

    async def _open_copy(
        self,
        master: MasterAccount,
        master_pos: Position,
        investor: InvestorAllocation,
        investor_account: TradingAccount,
        master_account: TradingAccount,
        total_pool: float,
        db: AsyncSession,
    ):
        instrument = master_pos.instrument
        if not instrument:
            logger.warning("Skip copy open: no instrument on master position %s", master_pos.id)
            return

        existing_q = await db.execute(
            select(CopyTrade).where(
                CopyTrade.master_position_id == master_pos.id,
                CopyTrade.investor_allocation_id == investor.id,
                CopyTrade.status == "open",
            )
        )
        if existing_q.scalar_one_or_none():
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

        contract_size = float(instrument.contract_size or 100000)
        required_margin = Decimal(
            str(copy_lots * contract_size * float(master_pos.open_price) / investor_account.leverage)
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

        position = Position(
            account_id=investor_account.id,
            instrument_id=master_pos.instrument_id,
            side=side_val,
            status=PositionStatus.OPEN.value,
            lots=Decimal(str(copy_lots)),
            open_price=master_pos.open_price,
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

    async def _close_copy(self, copy: CopyTrade, master: MasterAccount, db: AsyncSession):
        investor_pos = await db.get(Position, copy.investor_position_id)
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

        tick_data = await redis_client.get(PriceChannel.tick_key(instrument.symbol))
        if not tick_data:
            logger.warning("Close copy: no tick for %s, deferring", instrument.symbol)
            return

        tick = json.loads(tick_data)
        side_val = investor_pos.side.value if hasattr(investor_pos.side, "value") else str(investor_pos.side)
        close_price = Decimal(str(tick["bid"])) if side_val == "buy" else Decimal(str(tick["ask"]))
        contract_size = instrument.contract_size or Decimal("100000")

        if side_val == "buy":
            gross_profit = (close_price - investor_pos.open_price) * investor_pos.lots * contract_size
        else:
            gross_profit = (investor_pos.open_price - close_price) * investor_pos.lots * contract_size

        performance_fee = Decimal("0")
        admin_fee = Decimal("0")
        if gross_profit > 0:
            perf_pct = master.performance_fee_pct or Decimal("0")
            performance_fee = gross_profit * perf_pct / Decimal("100")
            admin_pct = master.admin_commission_pct or Decimal("0")
            admin_fee = performance_fee * admin_pct / Decimal("100")

        net_profit = gross_profit - performance_fee

        investor_pos.status = PositionStatus.CLOSED.value
        investor_pos.close_price = close_price
        investor_pos.profit = net_profit
        investor_pos.closed_at = datetime.now(timezone.utc)

        investor_account = await db.get(TradingAccount, investor_pos.account_id)
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
            master_account = await db.get(TradingAccount, master.account_id)
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
                    db.add(
                        Transaction(
                            user_id=master.user_id,
                            account_id=master_account.id,
                            type="commission",
                            amount=admin_fee,
                            balance_after=master_account.balance,
                            reference_id=investor_pos.id,
                            description=f"Admin commission ({master.admin_commission_pct}%) from copy trade performance fee",
                        )
                    )

        copy.status = "closed"

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


class _ComputeLotSizeTests(unittest.TestCase):
    """Covers PAMM pool math, MAM scaling, Signal ratio, zero-pool, min-lot guards."""

    def _accounts(self, m_eq, i_eq):
        master = SimpleNamespace(equity=Decimal(str(m_eq)), balance=Decimal(str(m_eq)))
        inv = SimpleNamespace(equity=Decimal(str(i_eq)), balance=Decimal(str(i_eq)))
        return master, inv

    def test_signal_equity_ratio(self):
        ma, ia = self._accounts(10000, 2500)
        alloc = SimpleNamespace(allocation_amount=100, allocation_pct=None, copy_type="signal")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=0, copy_type="signal")
        self.assertIsNone(err)
        self.assertEqual(lots, 0.25)

    def test_signal_zero_investor_equity(self):
        ma, ia = self._accounts(10000, 0)
        alloc = SimpleNamespace(allocation_amount=100, allocation_pct=None, copy_type="signal")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=0, copy_type="signal")
        self.assertIsNone(lots)
        self.assertEqual(err, "signal_zero_investor_equity")

    def test_signal_zero_master_equity(self):
        ma, ia = self._accounts(0, 5000)
        alloc = SimpleNamespace(allocation_amount=100, allocation_pct=None, copy_type="signal")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=0, copy_type="signal")
        self.assertIsNone(lots)
        self.assertEqual(err, "signal_zero_master_equity")

    def test_pamm_pool_share(self):
        ma, ia = self._accounts(1, 1)
        alloc = SimpleNamespace(allocation_amount=3000, allocation_pct=None, copy_type="pamm")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=10000, copy_type="pamm")
        self.assertIsNone(err)
        self.assertEqual(lots, 0.3)

    def test_pamm_zero_pool(self):
        ma, ia = self._accounts(1, 1)
        alloc = SimpleNamespace(allocation_amount=100, allocation_pct=None, copy_type="pamm")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=0, copy_type="pamm")
        self.assertIsNone(lots)
        self.assertEqual(err, "pamm_zero_total_pool")

    def test_mam_volume_scaling(self):
        ma, ia = self._accounts(1, 1)
        alloc = SimpleNamespace(allocation_amount=5000, allocation_pct=Decimal("150"), copy_type="mam")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=10000, copy_type="mam")
        self.assertIsNone(err)
        self.assertEqual(lots, 0.75)

    def test_mam_zero_allocation_pct(self):
        ma, ia = self._accounts(1, 1)
        alloc = SimpleNamespace(allocation_amount=5000, allocation_pct=Decimal("0"), copy_type="mam")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=10000, copy_type="mam")
        self.assertIsNone(lots)
        self.assertEqual(err, "mam_zero_allocation_pct")

    def test_below_min_lot(self):
        ma, ia = self._accounts(10000, 10)
        alloc = SimpleNamespace(allocation_amount=100, allocation_pct=None, copy_type="signal")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=0, copy_type="signal")
        self.assertIsNone(lots)
        self.assertEqual(err, "below_min_lot_0_01")


if __name__ == "__main__":
    unittest.main()
