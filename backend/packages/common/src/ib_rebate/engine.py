"""IB rebate settlement engine (Milele-style, accrual).

`settle_ib_rebates(db)` recomputes, for the given calendar month, every active
IB's tier from that month's eligible closed lots + active clients, applies the
tier rate to the *whole* month's lots, and pays the delta over what was already
settled — so reaching a higher tier retro-pays the difference. Upline masters
then earn a capped override on each IB's own-rebate delta.

Idempotent: safe to run repeatedly (daily job or manual). Each run only pays the
newly-earned delta, so double-runs never double-pay.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    IbRebatePeriod, IbRebateSettlement, IBProfile, Referral, TradeHistory,
    TradingAccount, Transaction, User, Deposit,
)
from .config import IbRebateConfig, load_config

logger = logging.getLogger("ib_rebate.engine")

_8 = Decimal("0.00000001")
_KYC_OK = ("verified", "approved")
_DEPOSIT_OK = ("completed", "approved", "confirmed", "success", "credited")


def _money(d: Decimal) -> Decimal:
    return d.quantize(_8, rounding=ROUND_HALF_UP)


def current_period() -> str:
    n = datetime.now(timezone.utc)
    return f"{n.year:04d}-{n.month:02d}"


def _period_bounds(period: str) -> tuple[datetime, datetime]:
    y, m = period.split("-")
    y, m = int(y), int(m)
    start = datetime(y, m, 1, tzinfo=timezone.utc)
    end = datetime(y + 1, 1, 1, tzinfo=timezone.utc) if m == 12 else datetime(y, m + 1, 1, tzinfo=timezone.utc)
    return start, end


async def _referred_user_ids(db: AsyncSession, ib_id) -> list:
    rows = (await db.execute(
        select(Referral.referred_id).where(Referral.ib_profile_id == ib_id)
    )).scalars().all()
    return [r for r in rows if r is not None]


async def _per_trader_lots(db: AsyncSession, user_ids: list, start, end) -> dict:
    """user_id -> closed lots this period (real accounts only)."""
    if not user_ids:
        return {}
    rows = (await db.execute(
        select(TradingAccount.user_id, func.coalesce(func.sum(TradeHistory.lots), 0))
        .join(TradeHistory, TradeHistory.account_id == TradingAccount.id)
        .where(
            TradingAccount.user_id.in_(user_ids),
            TradingAccount.is_demo.is_(False),
            TradeHistory.closed_at >= start,
            TradeHistory.closed_at < end,
        )
        .group_by(TradingAccount.user_id)
    )).all()
    return {uid: Decimal(str(lots or 0)) for uid, lots in rows}


async def _funded_user_ids(db: AsyncSession, user_ids: list) -> set:
    if not user_ids:
        return set()
    rows = (await db.execute(
        select(Deposit.user_id).where(
            Deposit.user_id.in_(user_ids),
            Deposit.status.in_(_DEPOSIT_OK),
        ).distinct()
    )).scalars().all()
    return set(rows)


async def _kyc_ok_user_ids(db: AsyncSession, user_ids: list) -> set:
    if not user_ids:
        return set()
    rows = (await db.execute(
        select(User.id).where(User.id.in_(user_ids), User.kyc_status.in_(_KYC_OK))
    )).scalars().all()
    return set(rows)


async def _credit_ib(
    db: AsyncSession, ib: IBProfile, amount: Decimal, description: str,
) -> Optional[uuid.UUID]:
    """Credit the IB's main wallet (24h-to-IB-wallet model) + audit Transaction."""
    user = (await db.execute(
        select(User).where(User.id == ib.user_id).with_for_update()
    )).scalar_one_or_none()
    if user is None:
        return None
    prev = Decimal(str(user.main_wallet_balance or 0))
    new_balance = prev + amount
    user.main_wallet_balance = new_balance
    tx = Transaction(
        id=uuid.uuid4(),
        user_id=ib.user_id,
        account_id=None,
        type="ib_commission",
        amount=amount,
        balance_after=new_balance,
        reference_id=ib.id,
        description=description[:255],
    )
    db.add(tx)
    await db.flush()
    return tx.id


async def _get_or_create_period(db: AsyncSession, ib_id, period: str) -> IbRebatePeriod:
    row = (await db.execute(
        select(IbRebatePeriod).where(
            IbRebatePeriod.ib_id == ib_id, IbRebatePeriod.period == period
        ).with_for_update()
    )).scalar_one_or_none()
    if row is None:
        row = IbRebatePeriod(id=uuid.uuid4(), ib_id=ib_id, period=period)
        db.add(row)
        await db.flush()
    return row


async def settle_ib_rebates(
    db: AsyncSession,
    period: Optional[str] = None,
    cfg: Optional[IbRebateConfig] = None,
    force: bool = False,
) -> dict:
    """Run one settlement pass for `period` (default current month).

    `force=True` runs even if the model isn't 'accrual' (used by the admin
    "run now" button / dry checks). Returns a small summary.
    """
    cfg = cfg or await load_config()
    if cfg.model != "accrual" and not force:
        return {"skipped": "model_not_accrual", "model": cfg.model}

    period = period or current_period()
    start, end = _period_bounds(period)

    ibs = (await db.execute(
        select(IBProfile).where(IBProfile.is_active.is_(True))
    )).scalars().all()
    by_id = {ib.id: ib for ib in ibs}

    # ── Pass 1: compute each IB's lots / active clients / tier / target ──────
    stats: dict = {}  # ib_id -> {"active_clients": int, "tier": str, "period_row": row, "own_delta": Decimal}
    for ib in ibs:
        referred = await _referred_user_ids(db, ib.id)
        per_trader = await _per_trader_lots(db, referred, start, end)
        eligible_lots = sum(per_trader.values(), Decimal("0"))

        # active clients: >= min lots (+ optional kyc / deposit gates)
        lot_ok = {uid for uid, lots in per_trader.items() if lots >= Decimal(str(cfg.active_min_lots))}
        active_ids = set(lot_ok)
        if cfg.active_require_kyc and active_ids:
            active_ids &= await _kyc_ok_user_ids(db, list(active_ids))
        if cfg.active_require_deposit and active_ids:
            active_ids &= await _funded_user_ids(db, list(active_ids))
        active_clients = len(active_ids)

        # tier + rate — a per-IB custom rate overrides the ladder ("Custom desk").
        custom = ib.custom_commission_per_lot
        if custom is not None and Decimal(str(custom)) > 0:
            tier, rate = "custom", Decimal(str(custom))
        else:
            tier, rate = cfg.tier_for(eligible_lots, active_clients)

        own_target = _money(eligible_lots * rate)
        row = await _get_or_create_period(db, ib.id, period)
        own_delta = own_target - Decimal(str(row.own_settled or 0))
        if own_delta < 0:
            own_delta = Decimal("0")  # never claw back within a month

        row.eligible_lots = eligible_lots
        row.active_clients = active_clients
        row.tier = tier
        row.rate_per_lot = rate
        row.own_target = own_target

        stats[ib.id] = {
            "active_clients": active_clients,
            "tier": tier,
            "period_row": row,
            "own_delta": _money(own_delta),
        }

    # ── Pass 2: pay own-rebate deltas + upline overrides ────────────────────
    total_own = Decimal("0")
    total_override = Decimal("0")
    paid_ibs = 0

    for ib in ibs:
        s = stats[ib.id]
        own_delta: Decimal = s["own_delta"]
        if own_delta <= 0:
            continue

        row: IbRebatePeriod = s["period_row"]
        tx_id = await _credit_ib(
            db, ib, own_delta,
            f"IB rebate — {s['tier'].title()} ({period}) {float(row.eligible_lots):.2f} lots",
        )
        db.add(IbRebateSettlement(
            id=uuid.uuid4(), ib_id=ib.id, period=period, kind="own", level=0,
            source_ib_id=None, amount=own_delta, transaction_id=tx_id,
        ))
        row.own_settled = _money(Decimal(str(row.own_settled or 0)) + own_delta)
        total_own += own_delta
        paid_ibs += 1

        # Upline overrides on this IB's own delta.
        remaining_cap = Decimal(str(cfg.override_cap_pct))
        level = 1
        ancestor_id = ib.parent_ib_id
        seen = {ib.id}
        while (
            ancestor_id is not None
            and ancestor_id in by_id
            and ancestor_id not in seen
            and level <= cfg.override_max_levels
            and remaining_cap > 0
        ):
            seen.add(ancestor_id)
            ancestor = by_id[ancestor_id]
            a_stats = stats.get(ancestor_id, {})
            pct = Decimal(str(cfg.override_pct_for_level(level)))
            pct = min(pct, remaining_cap)

            # Gates: L1 master needs >=1 active direct client; L2+ needs Builder+.
            eligible = True
            if level == 1 and int(a_stats.get("active_clients", 0)) < 1:
                eligible = False
            if level >= 2 and str(a_stats.get("tier", "starter")) not in ("builder", "pro", "custom"):
                eligible = False

            if eligible and pct > 0:
                amt = _money(own_delta * pct / Decimal("100"))
                if amt > 0:
                    a_tx = await _credit_ib(
                        db, ancestor, amt,
                        f"IB override L{level} on {ib.referral_code or ib.id} ({period})",
                    )
                    db.add(IbRebateSettlement(
                        id=uuid.uuid4(), ib_id=ancestor.id, period=period,
                        kind="override", level=level, source_ib_id=ib.id,
                        amount=amt, transaction_id=a_tx,
                    ))
                    a_row = a_stats.get("period_row")
                    if a_row is not None:
                        a_row.override_settled = _money(Decimal(str(a_row.override_settled or 0)) + amt)
                    total_override += amt

            remaining_cap -= pct
            level += 1
            ancestor_id = ancestor.parent_ib_id

    await db.commit()
    summary = {
        "period": period,
        "ibs_processed": len(ibs),
        "ibs_paid": paid_ibs,
        "own_paid": float(total_own),
        "override_paid": float(total_override),
    }
    logger.info("IB rebate settlement %s", summary)
    return summary
