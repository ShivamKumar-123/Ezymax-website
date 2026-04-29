"""Claim eligibility + payout for insured positions.

Wired into `trading_service.close_position` immediately before its final
`db.commit()` so the close + payout are atomic.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    InsurancePolicy, InsuranceClaim, Position, TradeHistory,
    Transaction, User,
)
from .config import InsuranceConfig, load_config
from .volatility import get_atr

logger = logging.getLogger("insurance.claims")

# Returned by evaluate_claim when the trade isn't eligible.
class _Denied(Exception):
    def __init__(self, reason: str):
        self.reason = reason


async def _hedge_exists(*, db: AsyncSession, position: Position) -> bool:
    """Any other open position on the same instrument by this account on the
    opposite side? If so, the close was effectively neutralised by a hedge."""
    q = await db.execute(
        select(Position.id).where(
            Position.account_id == position.account_id,
            Position.instrument_id == position.instrument_id,
            Position.id != position.id,
            Position.status.in_(("open", "partially_closed")),
            Position.side != position.side,
        ).limit(1)
    )
    return q.scalar_one_or_none() is not None


async def _user_claims_today(
    *, db: AsyncSession, user_id, since: datetime,
) -> tuple[int, Decimal, Optional[datetime]]:
    """Returns (count, total_payout, last_paid_at) for the given window."""
    q = await db.execute(
        select(
            func.count(InsuranceClaim.id),
            func.coalesce(func.sum(InsuranceClaim.claim_amount), 0),
            func.max(InsuranceClaim.paid_at),
        ).where(
            InsuranceClaim.user_id == user_id,
            InsuranceClaim.paid_at >= since,
        )
    )
    row = q.one()
    return int(row[0]), Decimal(str(row[1])), row[2]


async def evaluate_claim(
    *,
    db: AsyncSession,
    policy: InsurancePolicy,
    position: Position,
    history: TradeHistory,
    cfg: Optional[InsuranceConfig] = None,
) -> tuple[bool, Decimal, str]:
    """Run every gate. Returns (eligible, claim_amount, reason).
    `claim_amount` is 0 when not eligible; `reason` describes the denial.
    """
    cfg = cfg or await load_config()

    if not cfg.enabled:
        return False, Decimal("0"), "insurance_disabled"

    if cfg.news_blackout_until and datetime.now(timezone.utc) < cfg.news_blackout_until:
        return False, Decimal("0"), "news_blackout"

    if policy.status != "active":
        return False, Decimal("0"), f"policy_{policy.status}"

    profit = Decimal(str(history.profit or 0))
    if profit >= 0:
        return False, Decimal("0"), "not_a_loss"

    # Trade duration ≥ min seconds
    opened = history.opened_at
    closed = history.closed_at
    if opened and closed:
        if (closed - opened).total_seconds() < cfg.min_trade_duration_seconds:
            return False, Decimal("0"), "min_duration"

    # ATR floor (extreme-vol kill switch)
    symbol = (position.instrument.symbol if position.instrument else "")
    atr = await get_atr(symbol)
    if atr < cfg.atr_floor:
        return False, Decimal("0"), "vol_too_low"

    # Hedge check
    if await _hedge_exists(db=db, position=position):
        return False, Decimal("0"), "hedge"

    # Anti-abuse — daily caps + cooldown
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    cooldown_window = now - timedelta(hours=cfg.cooldown_hours)

    count_24h, payout_24h, last_paid = await _user_claims_today(
        db=db, user_id=policy.user_id, since=day_ago,
    )
    if count_24h >= cfg.daily_claim_limit:
        return False, Decimal("0"), "daily_claim_limit"
    if last_paid and last_paid >= cooldown_window:
        return False, Decimal("0"), "cooldown"

    # Compute claim
    loss_abs = -profit
    coverage_frac = Decimal(str(policy.coverage_pct)) / Decimal("100")
    raw_claim = loss_abs * coverage_frac
    claim_amount = min(raw_claim, Decimal(str(policy.max_cap)))

    # Cap by remaining daily payout headroom
    remaining = Decimal(str(cfg.daily_payout_limit)) - payout_24h
    if remaining <= 0:
        return False, Decimal("0"), "daily_payout_limit"
    if claim_amount > remaining:
        claim_amount = remaining

    if claim_amount <= 0:
        return False, Decimal("0"), "zero_payout"

    return True, claim_amount.quantize(Decimal("0.01")), "eligible"


async def maybe_pay(
    *,
    db: AsyncSession,
    position: Position,
    history: TradeHistory,
) -> Optional[InsuranceClaim]:
    """Look up the active policy for `position` and, if eligible, record a
    claim + credit the user's main wallet. Designed to be called inside
    the same transaction as the position close, immediately before commit.

    Any unhandled exception is caught and logged — the close itself must
    still complete even if the payout fails.
    """
    try:
        cfg = await load_config()

        # Try lock the policy row inside the same transaction.
        pol_q = await db.execute(
            select(InsurancePolicy)
            .where(InsurancePolicy.position_id == position.id)
            .with_for_update()
        )
        policy = pol_q.scalar_one_or_none()
        if policy is None:
            return None  # No insurance — nothing to do.

        eligible, claim_amount, reason = await evaluate_claim(
            db=db, policy=policy, position=position, history=history, cfg=cfg,
        )

        if not eligible:
            policy.status = "denied" if reason in (
                "hedge", "min_duration", "cooldown", "daily_claim_limit",
                "daily_payout_limit", "vol_too_low", "news_blackout",
                "insurance_disabled",
            ) else "expired"
            policy.settled_at = datetime.now(timezone.utc)
            logger.info(
                "Insurance claim denied for policy=%s reason=%s",
                policy.id, reason,
            )
            return None

        # Credit wallet
        user_q = await db.execute(
            select(User).where(User.id == policy.user_id).with_for_update()
        )
        user = user_q.scalar_one_or_none()
        if user is None:
            return None
        prev = Decimal(str(user.main_wallet_balance or 0))
        new_balance = prev + claim_amount
        user.main_wallet_balance = new_balance

        tx = Transaction(
            id=uuid.uuid4(),
            user_id=policy.user_id,
            account_id=None,
            type="insurance_payout",
            amount=claim_amount,
            balance_after=new_balance,
            reference_id=policy.id,
            description=(
                f"Trade insurance payout — {policy.tier.title()} tier "
                f"({float(policy.coverage_pct):.0f}% of ${float(-history.profit):.2f} loss)"
            ),
        )
        db.add(tx)
        await db.flush()  # tx.id available

        claim = InsuranceClaim(
            id=uuid.uuid4(),
            policy_id=policy.id,
            user_id=policy.user_id,
            loss_amount=-Decimal(str(history.profit)),
            claim_amount=claim_amount,
            transaction_id=tx.id,
            paid_at=datetime.now(timezone.utc),
        )
        db.add(claim)

        policy.status = "claimed"
        policy.settled_at = claim.paid_at

        logger.info(
            "Insurance claim paid policy=%s user=%s amount=%s",
            policy.id, policy.user_id, claim_amount,
        )
        return claim

    except Exception as exc:  # never break the close
        logger.exception("maybe_pay failed: %s", exc)
        return None
