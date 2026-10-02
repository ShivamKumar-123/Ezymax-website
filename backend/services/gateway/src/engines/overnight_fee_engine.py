"""Overnight leverage fee engine.

Per Trading_Mechanism.docx:
  Fully funded (leverage = 1)  → no overnight fee.
  Leveraged trades             → 0.01% per day on the borrowed portion only.
  Borrowed portion             = notional × (L − 1) / L
  Daily charge                 = borrowed_portion × 0.0001

Skipped:
  - swap_free instruments (InstrumentConfig.swap_free = TRUE)
  - swap_free account groups (Islamic; AccountGroup.swap_free = TRUE)
  - leverage <= 1 (no borrowed portion)

Idempotency: each position has positions.last_swap_at; the engine charges
when (now - last_swap_at) >= 24h, and only one charge fires per 24h window
even if the engine ticks more often.

Section F (correct at N workers / replicas, bounded memory):
  * leader-locked tick (engine_lock "overnight_fee", renewing lease);
  * keyset batches of BATCH_SIZE candidate ids, one session + commit per batch
    (no single transaction holding every open position's lock for minutes);
  * lock order: trading ACCOUNT first (canonical order), then its due
    positions ``FOR UPDATE SKIP LOCKED`` (a position being closed right now is
    skipped and picked up next tick), and ``last_swap_at`` is RE-CHECKED on
    the locked row so a concurrent / previous charge can never double-debit.
"""
import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.instrumentation import spawn
from packages.common.src.database import WorkerSessionLocal
from packages.common.src.engine_lock import engine_lock
from packages.common.src.row_locks import lock_account
from packages.common.src.models import (
    AccountGroup, Position, PositionStatus, Transaction, User,
)
from packages.common.src.instrument_pricing import (
    resolve_swap_rate, DEFAULT_SWAP_DAILY_RATE,
)

logger = logging.getLogger("overnight-fee-engine")

# Kept as a module-level alias for back-compat with existing log lines;
# actual per-position rate is resolved per tick via ``resolve_swap_rate``.
DAILY_RATE = DEFAULT_SWAP_DAILY_RATE
TICK_INTERVAL = 3600  # check hourly so a deploy mid-day catches up cleanly
BATCH_SIZE = 500

# Engine sessions never carry the API statement_timeout. Module-level name so
# tests can patch it.
AsyncSessionLocal = WorkerSessionLocal


class OvernightFeeEngine:
    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        logger.info("Overnight fee engine started (rate=%s/day, tick=%ds)", DAILY_RATE, TICK_INTERVAL)
        spawn(self._run(), name="overnight_fee_engine")

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                # Leader-election: with N workers / replicas only one process
                # charges the daily swap. The lease renews itself while the
                # batches run; the per-row locking below keeps it safe even if
                # two processes ever overlapped.
                async with engine_lock("overnight_fee", ttl_seconds=300) as lease:
                    if lease:
                        n = await run_overnight_fees(lease=lease)
                        if n:
                            logger.info("Overnight fee: charged %d positions", n)
            except Exception as e:
                logger.error("Overnight fee engine error: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)


def _due_clause(cutoff: datetime):
    return or_(Position.last_swap_at.is_(None), Position.last_swap_at <= cutoff)


async def _due_candidates(
    db: AsyncSession, cutoff: datetime, after_id, limit: int,
) -> list[tuple]:
    """Next keyset page of (position_id, account_id) due for a charge. No locks."""
    q = (
        select(Position.id, Position.account_id)
        .where(Position.status == PositionStatus.OPEN, _due_clause(cutoff))
        .order_by(Position.id)
        .limit(limit)
    )
    if after_id is not None:
        q = q.where(Position.id > after_id)
    return [(r[0], r[1]) for r in (await db.execute(q)).all()]


async def run_overnight_fees(
    now: Optional[datetime] = None, *, batch_size: int = BATCH_SIZE, lease=None,
) -> int:
    """Charge every due position in keyset batches, one session per batch."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)
    total = 0
    after_id = None
    while True:
        if lease is not None and getattr(lease, "lost", False):
            logger.error("overnight fee: leadership lost mid-run — stopping")
            break
        async with AsyncSessionLocal() as db:
            cands = await _due_candidates(db, cutoff, after_id, batch_size)
            if not cands:
                break
            after_id = cands[-1][0]
            total += await _charge_batch(db, cands, now)
            await db.commit()
        if len(cands) < batch_size:
            break
    return total


async def charge_due_positions(db: AsyncSession, now: Optional[datetime] = None) -> int:
    """Back-compat single-session entry point: charge every due position using
    the caller's session (caller commits). Same locking as the batch runner."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)
    total = 0
    after_id = None
    while True:
        cands = await _due_candidates(db, cutoff, after_id, BATCH_SIZE)
        if not cands:
            break
        after_id = cands[-1][0]
        total += await _charge_batch(db, cands, now)
        if len(cands) < BATCH_SIZE:
            break
    return total


async def _charge_batch(db: AsyncSession, cands: list[tuple], now: datetime) -> int:
    cutoff = now - timedelta(hours=24)
    by_account: dict = defaultdict(list)
    for pos_id, account_id in cands:
        if account_id is not None:
            by_account[account_id].append(pos_id)

    charged = 0
    # Canonical lock order: accounts ascending, each account BEFORE its positions.
    for account_id in sorted(by_account.keys(), key=str):
        account = await lock_account(db, account_id)
        if account is None:
            continue
        positions = (await db.execute(
            select(Position)
            .where(
                Position.id.in_(by_account[account_id]),
                Position.account_id == account_id,
            )
            .with_for_update(skip_locked=True)
            .execution_options(populate_existing=True)
        )).scalars().all()
        if not positions:
            continue

        ag: AccountGroup | None = account.account_group
        is_islamic = False
        if account.user_id is not None:
            is_islamic = bool((await db.execute(
                select(User.is_islamic).where(User.id == account.user_id)
            )).scalar_one_or_none())

        for pos in positions:
            # Re-check on the LOCKED row: still open and still due.
            st = pos.status.value if hasattr(pos.status, "value") else str(pos.status)
            if st != "open":
                continue
            last = pos.last_swap_at
            if last is not None and last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if last is not None and last > cutoff:
                continue  # already charged by a concurrent / previous run
            opened = pos.created_at
            if opened is not None and opened.tzinfo is None:
                opened = opened.replace(tzinfo=timezone.utc)
            if last is None and opened is not None and opened > cutoff:
                continue  # open < 24h — not due yet

            # Skip swap-free account groups (Islamic group).
            if ag is not None and bool(ag.swap_free):
                pos.last_swap_at = now  # mark seen so we don't re-walk it every tick
                continue
            # Users who self-identify as Islamic are exempt.
            if is_islamic:
                pos.last_swap_at = now
                continue

            leverage = int(account.leverage or 1)
            if leverage <= 1:
                # Account-level fully-funded — never charged.
                pos.last_swap_at = now
                continue

            instrument = pos.instrument
            if instrument is None:
                continue
            contract_size = Decimal(str(instrument.contract_size or "100000"))
            notional = Decimal(str(pos.lots or 0)) * Decimal(str(pos.open_price or 0)) * contract_size
            if notional <= 0:
                pos.last_swap_at = now
                continue

            # Resolve the daily swap rate via the full SwapConfig priority chain
            # (user → account_group → instrument → segment → default →
            # InstrumentConfig → hardcoded fallback). Side is "long" for BUY.
            raw_side = pos.side.value if hasattr(pos.side, "value") else str(pos.side or "long")
            pos_side = raw_side.lower()
            rate, is_swap_free = await resolve_swap_rate(
                db, instrument,
                "long" if pos_side in ("buy", "long") else "short",
                user_id=account.user_id,
                account_group_id=account.account_group_id,
            )
            if is_swap_free or rate <= 0:
                pos.last_swap_at = now
                continue

            borrowed_fraction = (Decimal(leverage - 1) / Decimal(leverage))
            fee = (notional * borrowed_fraction * rate).quantize(Decimal("0.00000001"))
            if fee <= 0:
                pos.last_swap_at = now
                continue

            # Account row is locked (above) — apply the fee, mark the position,
            # and write the audit Transaction.
            new_balance = (Decimal(str(account.balance or 0))) - fee
            account.balance = new_balance
            account.equity = new_balance + Decimal(str(account.credit or 0))
            account.free_margin = account.equity - Decimal(str(account.margin_used or 0))
            pos.swap = (Decimal(str(pos.swap or 0))) - fee  # swap is conventionally negative
            pos.last_swap_at = now

            db.add(Transaction(
                user_id=account.user_id,
                account_id=account.id,
                type="swap",
                amount=-fee,
                balance_after=new_balance,
                reference_id=pos.id,
                description=f"Overnight fee {rate * 100}% × borrowed {borrowed_fraction:.4f} × notional {notional:.2f}",
            ))
            charged += 1

    return charged


overnight_fee_engine = OvernightFeeEngine()
