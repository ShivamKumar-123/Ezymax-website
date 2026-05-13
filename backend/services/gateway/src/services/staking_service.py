"""Staking service — open / withdraw / claim positions, daily reward accrual.

Money flow (no on-chain layer in this build):
  Open  : user.main_wallet_balance -= principal; if trading_bonus_active,
          a 'staking_bonus' credit equal to principal × bonus_bps / 10000
          is added to a tagged TradingAccount (one is auto-created per
          opening if needed).
  Daily : a scheduler hits accrue_daily(), which inserts a reward row per
          active position for the just-elapsed 24h window.
  Claim : sums unpaid rows, marks them paid, credits user.main_wallet_balance.
  Exit  : flexible plans only; restores principal to the wallet.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    StakingPlan, StakingPosition, StakingRewardAccrual,
    User, TradingAccount, Referral, RewardsTransaction, RewardsUserState,
    Transaction,
)

logger = logging.getLogger("staking_service")


# ─── Staking referral payout (XP_Reward_mechanism slide 17 / table 9) ─
# When a user opens a stake, the upline gets a one-time USD payout based
# on stake amount (NOT on rewards). 10 levels deep, total max 30% of the
# principal — paid into the upline's main_wallet_balance.
STAKING_REFERRAL_PCT = [
    Decimal("0.10"),   # L1
    Decimal("0.05"),   # L2
    Decimal("0.03"),   # L3
    Decimal("0.02"),   # L4
    Decimal("0.02"),   # L5
    Decimal("0.02"),   # L6
    Decimal("0.02"),   # L7
    Decimal("0.015"),  # L8
    Decimal("0.015"),  # L9
    Decimal("0.01"),   # L10
]


async def _distribute_staking_referral(
    db: AsyncSession,
    leaf_user_id: UUID,
    principal: Decimal,
    position_id: UUID,
) -> None:
    """Walk up to 10 levels of the Referral chain from the staker and credit
    each ancestor a one-time USD payout. Failures are non-fatal — they're
    logged but the stake itself is not rolled back."""
    if principal <= 0:
        return
    current = leaf_user_id
    visited: set = set()
    for level_idx in range(10):
        row = (await db.execute(
            select(Referral).where(Referral.referred_id == current).limit(1)
        )).scalar_one_or_none()
        if row is None:
            break
        ancestor_id = row.referrer_id
        if ancestor_id in visited or ancestor_id == leaf_user_id:
            break
        visited.add(ancestor_id)

        share = STAKING_REFERRAL_PCT[level_idx]
        payout = (principal * share).quantize(Decimal("0.01"))
        if payout <= 0:
            current = ancestor_id
            continue

        # Lock + credit the ancestor's main_wallet_balance.
        anc = (await db.execute(
            select(User).where(User.id == ancestor_id).with_for_update()
        )).scalar_one_or_none()
        if anc is None:
            break
        anc.main_wallet_balance = Decimal(str(anc.main_wallet_balance or 0)) + payout

        # Audit row in rewards_transactions (no XP/AC change — pure USD).
        # We log it via type='staking_referral_l{N}' so reports can group by level.
        db.add(RewardsTransaction(
            user_id=ancestor_id,
            type=f"staking_referral_l{level_idx + 1}",
            xp_delta=0,
            ac_delta=Decimal("0"),
            source="staking_open",
            reference_id=position_id,
        ))
        current = ancestor_id


# ─── Catalogue ───────────────────────────────────────────────────────

async def list_plans(db: AsyncSession) -> list[dict]:
    rows = (await db.execute(
        select(StakingPlan)
        .where(StakingPlan.is_active.is_(True))
        .order_by(StakingPlan.display_order, StakingPlan.label)
    )).scalars().all()
    return [_serialize_plan(p) for p in rows]


def _serialize_plan(p: StakingPlan) -> dict:
    return {
        "id": str(p.id),
        "slug": p.slug,
        "label": p.label,
        "description": p.description or "",
        "mode": p.mode,
        "lock_months": p.lock_months,
        "apy_bps": int(p.apy_bps or 0),
        "apy_pct": (int(p.apy_bps or 0)) / 100.0,
        "min_amount": float(p.min_amount or 0),
        "trading_bonus_multiplier_bps": int(p.trading_bonus_multiplier_bps or 0),
        "trading_bonus_pct": (int(p.trading_bonus_multiplier_bps or 0)) / 100.0,
    }


# ─── Positions ───────────────────────────────────────────────────────

async def list_positions(db: AsyncSession, user_id: UUID) -> list[dict]:
    rows = (await db.execute(
        select(StakingPosition, StakingPlan)
        .join(StakingPlan, StakingPlan.id == StakingPosition.plan_id)
        .where(StakingPosition.user_id == user_id)
        .order_by(StakingPosition.started_at.desc())
    )).all()
    out: list[dict] = []
    for pos, plan in rows:
        # Fast unpaid total without loading every accrual row.
        unpaid_q = await db.execute(
            select(func.coalesce(func.sum(StakingRewardAccrual.reward_amount), 0))
            .where(
                StakingRewardAccrual.position_id == pos.id,
                StakingRewardAccrual.paid_at.is_(None),
            )
        )
        unpaid = Decimal(str(unpaid_q.scalar() or 0))
        paid_q = await db.execute(
            select(func.coalesce(func.sum(StakingRewardAccrual.reward_amount), 0))
            .where(
                StakingRewardAccrual.position_id == pos.id,
                StakingRewardAccrual.paid_at.isnot(None),
            )
        )
        paid = Decimal(str(paid_q.scalar() or 0))
        out.append({
            "id": str(pos.id),
            "plan": _serialize_plan(plan),
            "principal": float(pos.principal or 0),
            "started_at": pos.started_at.isoformat(),
            "unlocks_at": pos.unlocks_at.isoformat() if pos.unlocks_at else None,
            "state": pos.state,
            "trading_bonus_active": bool(pos.trading_bonus_active),
            "trading_bonus_credited": float(pos.trading_bonus_credited or 0),
            "rewards_unpaid": float(unpaid),
            "rewards_paid": float(paid),
        })
    return out


async def open_position(
    db: AsyncSession,
    user_id: UUID,
    plan_id: UUID,
    amount: Decimal,
    use_trading_bonus: bool,
) -> dict:
    """Debit the user's main wallet, create the position, optionally credit
    the trading bonus to a tagged trading account."""
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount_must_be_positive")

    plan = (await db.execute(
        select(StakingPlan).where(StakingPlan.id == plan_id, StakingPlan.is_active.is_(True))
    )).scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="plan_not_found")
    if amount < Decimal(str(plan.min_amount or 0)):
        raise HTTPException(
            status_code=400,
            detail=f"min_amount {float(plan.min_amount):.2f}",
        )
    if use_trading_bonus and plan.mode != "locked":
        raise HTTPException(status_code=400, detail="trading_bonus_locked_only")

    # Lock the user row to prevent concurrent debits / withdrawals.
    user = (await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user_not_found")
    bal = Decimal(str(user.main_wallet_balance or 0))
    if bal < amount:
        raise HTTPException(status_code=402, detail="insufficient_wallet_balance")

    # Compute unlocks_at for locked plans.
    started = datetime.now(timezone.utc)
    unlocks_at = None
    if plan.mode == "locked":
        # 30-day month approximation is fine — display copy still says "1/2/3 Year".
        unlocks_at = started + timedelta(days=30 * int(plan.lock_months or 12))

    # Trading bonus credit
    bonus_amount = Decimal("0")
    if use_trading_bonus and int(plan.trading_bonus_multiplier_bps or 0) > 0:
        bonus_amount = (amount * Decimal(str(plan.trading_bonus_multiplier_bps))) / Decimal("10000")

    # Debit principal
    user.main_wallet_balance = bal - amount

    pos = StakingPosition(
        user_id=user_id,
        plan_id=plan.id,
        principal=amount,
        started_at=started,
        unlocks_at=unlocks_at,
        state="active",
        trading_bonus_active=bool(use_trading_bonus and bonus_amount > 0),
        trading_bonus_credited=bonus_amount,
        last_accrued_at=started,
    )
    db.add(pos)
    await db.flush()

    # Credit trading bonus to the user's primary live trading account (or the
    # most recently active one). If they have none, skip the credit — the user
    # can re-bind the bonus later via support; the position record still notes
    # the credited amount so accounting is intact.
    if pos.trading_bonus_active and bonus_amount > 0:
        ta = (await db.execute(
            select(TradingAccount)
            .where(
                TradingAccount.user_id == user_id,
                TradingAccount.is_active.is_(True),
                TradingAccount.is_demo.is_(False),
            )
            .order_by(TradingAccount.created_at.desc())
            .limit(1)
        )).scalar_one_or_none()
        if ta is not None:
            ta.credit = (ta.credit or Decimal("0")) + bonus_amount
            ta.equity = (ta.equity or Decimal("0")) + bonus_amount
            ta.free_margin = (ta.free_margin or Decimal("0")) + bonus_amount
        else:
            logger.warning(
                "stake %s opened with trading_bonus_active but no live trading account exists for user %s",
                pos.id, user_id,
            )

    # Staking referral payout — best-effort; never block the stake.
    try:
        await _distribute_staking_referral(db, leaf_user_id=user_id, principal=amount, position_id=pos.id)
    except Exception as _e:
        logger.warning("staking referral distribution failed for position %s: %s", pos.id, _e)

    return {
        "position_id": str(pos.id),
        "principal": float(pos.principal),
        "trading_bonus_credited": float(pos.trading_bonus_credited or 0),
        "unlocks_at": pos.unlocks_at.isoformat() if pos.unlocks_at else None,
        "new_wallet_balance": float(user.main_wallet_balance),
    }


async def withdraw_position(db: AsyncSession, user_id: UUID, position_id: UUID) -> dict:
    """Flexible plans only. Restores the principal to the user's wallet."""
    pos = (await db.execute(
        select(StakingPosition, StakingPlan)
        .join(StakingPlan, StakingPlan.id == StakingPosition.plan_id)
        .where(StakingPosition.id == position_id, StakingPosition.user_id == user_id)
    )).one_or_none()
    if pos is None:
        raise HTTPException(status_code=404, detail="position_not_found")
    position, plan = pos

    if position.state != "active":
        raise HTTPException(status_code=409, detail="position_not_active")
    if plan.mode == "locked":
        now = datetime.now(timezone.utc)
        if not position.unlocks_at or now < position.unlocks_at:
            raise HTTPException(status_code=403, detail="position_locked")

    # Refund principal to the wallet.
    user = (await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user_not_found")
    user.main_wallet_balance = Decimal(str(user.main_wallet_balance or 0)) + Decimal(str(position.principal))
    position.state = "withdrawn"
    position.ended_at = datetime.now(timezone.utc)

    return {
        "position_id": str(position.id),
        "refunded": float(position.principal),
        "new_wallet_balance": float(user.main_wallet_balance),
    }


async def claim_rewards(db: AsyncSession, user_id: UUID, position_id: UUID) -> dict:
    """Sweep all unpaid accrual rows on a position into the user's wallet."""
    pos = (await db.execute(
        select(StakingPosition).where(
            StakingPosition.id == position_id,
            StakingPosition.user_id == user_id,
        )
    )).scalar_one_or_none()
    if pos is None:
        raise HTTPException(status_code=404, detail="position_not_found")

    rows = (await db.execute(
        select(StakingRewardAccrual)
        .where(
            StakingRewardAccrual.position_id == pos.id,
            StakingRewardAccrual.paid_at.is_(None),
        )
        .with_for_update()
    )).scalars().all()
    if not rows:
        return {"position_id": str(pos.id), "claimed": 0.0, "row_count": 0}

    total = Decimal("0")
    now = datetime.now(timezone.utc)
    for r in rows:
        total += Decimal(str(r.reward_amount or 0))
        r.paid_at = now

    user = (await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user_not_found")
    user.main_wallet_balance = Decimal(str(user.main_wallet_balance or 0)) + total

    return {
        "position_id": str(pos.id),
        "claimed": float(total),
        "row_count": len(rows),
        "new_wallet_balance": float(user.main_wallet_balance),
    }


# ─── Daily accrual scheduler ─────────────────────────────────────────

async def weekly_digest(db: AsyncSession, now: Optional[datetime] = None) -> int:
    """For every user with at least one staking accrual in the trailing 7
    days, fire a weekly summary email. Idempotent only on the engine side
    (this function emails every time it's called)."""
    now = now or datetime.now(timezone.utc)
    period_end = now.replace(hour=0, minute=0, second=0, microsecond=0)
    period_start = period_end - timedelta(days=7)

    # Per-user totals across active staking positions.
    rows = (await db.execute(
        select(
            StakingPosition.user_id.label("user_id"),
            func.sum(StakingRewardAccrual.reward_amount).label("earned"),
            func.sum(StakingPosition.principal).label("principal"),
            func.max(StakingPlan.apy_bps).label("apy_bps"),
        )
        .select_from(StakingRewardAccrual)
        .join(StakingPosition, StakingPosition.id == StakingRewardAccrual.position_id)
        .join(StakingPlan, StakingPlan.id == StakingPosition.plan_id)
        .where(
            StakingRewardAccrual.period_start >= period_start,
            StakingRewardAccrual.period_end <= period_end,
        )
        .group_by(StakingPosition.user_id)
    )).all()

    if not rows:
        return 0

    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import render_staking_digest
        from packages.common.src.config import get_settings
    except Exception as e:
        logger.warning("staking digest setup failed: %s", e)
        return 0

    if not smtp_configured():
        return 0

    sent = 0
    app_url = (get_settings().TRADER_APP_URL or "https://trade.fxartha.com")
    period_label = "Weekly"
    period_end_str = period_end.strftime("%Y-%m-%d")

    for r in rows:
        user_id = r.user_id
        earned = Decimal(str(r.earned or 0))
        principal = Decimal(str(r.principal or 0))
        apy_bps = int(r.apy_bps or 0)
        apy_pct = apy_bps / 100.0
        if earned <= 0:
            continue
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if not user or not user.email:
            continue
        subject, html, text = render_staking_digest(
            first_name=user.first_name,
            period_label=period_label,
            accrued_amount=earned,
            staked_principal=principal,
            apy_pct=apy_pct,
            period_end=period_end_str,
            currency="USD",
            trader_app_url=app_url,
        )
        fire_and_forget(send_email(user.email, subject, html, text=text))
        sent += 1
    return sent


async def accrue_daily(db: AsyncSession, now: Optional[datetime] = None) -> int:
    """Insert one accrual row per active position for the just-elapsed 24h
    window. Idempotent: the unique index on (position_id, period_start,
    period_end) means double-firing the cron doesn't create duplicates.
    Returns the number of new rows."""
    now = now or datetime.now(timezone.utc)
    period_end = now.replace(hour=0, minute=0, second=0, microsecond=0)
    period_start = period_end - timedelta(days=1)

    rows = (await db.execute(
        select(StakingPosition, StakingPlan)
        .join(StakingPlan, StakingPlan.id == StakingPosition.plan_id)
        .where(StakingPosition.state == "active")
    )).all()
    inserted = 0
    for pos, plan in rows:
        if pos.started_at >= period_end:
            continue  # opened during this window — accrue starts next cycle
        # Daily reward = principal × apy / 365.
        apy = Decimal(int(plan.apy_bps or 0)) / Decimal("10000")
        reward = (Decimal(str(pos.principal)) * apy) / Decimal("365")
        if reward <= 0:
            continue
        # Skip if a row already exists for this window (idempotency belt + braces).
        exists_q = await db.execute(
            select(func.count())
            .select_from(StakingRewardAccrual)
            .where(
                StakingRewardAccrual.position_id == pos.id,
                StakingRewardAccrual.period_start == period_start,
                StakingRewardAccrual.period_end == period_end,
            )
        )
        if (exists_q.scalar() or 0) > 0:
            continue
        db.add(StakingRewardAccrual(
            position_id=pos.id,
            period_start=period_start,
            period_end=period_end,
            reward_amount=reward.quantize(Decimal("0.01")),
        ))
        pos.last_accrued_at = period_end
        inserted += 1
    return inserted


# ─── Trading-bonus withdrawal guard ───────────────────────────────────

async def locked_principal_total(db: AsyncSession, user_id: UUID) -> Decimal:
    """Sum of principal across active locked positions whose trading_bonus is
    on. The withdrawal pipeline subtracts this from main_wallet_balance before
    deciding what's withdrawable."""
    q = await db.execute(
        select(func.coalesce(func.sum(StakingPosition.principal), 0))
        .where(
            StakingPosition.user_id == user_id,
            StakingPosition.state == "active",
            StakingPosition.trading_bonus_active.is_(True),
        )
    )
    return Decimal(str(q.scalar() or 0))
