"""Ezymex Shield — aggregate period-plan claim engine.

Separate from the per-trade engine in `claims.py`. Wired into
`trading_service.close_position` right after `maybe_pay`, inside the same
transaction as the close, so any Shield payout commits atomically with it.

Handbook model:
  * User holds at most one ACTIVE period plan (Daily / Weekly / Monthly).
  * Every eligible losing trade closed during the plan window adds its absolute
    realized loss to `cumulative_eligible_loss`.
  * After each such trade the *target* total payout is recomputed:
        target = MIN(cumulative_eligible_loss × coverage%, max_payout)
    and only the delta over what was already paid is credited now:
        incremental = target − coverage_used
  * When coverage_used reaches max_payout the plan is `exhausted`.

Eligibility gates (handbook anti-abuse, realized-only):
  * plan active and not past `expires_at`
  * trade closed in loss
  * trade was OPENED after the plan activated (pre-existing-position exclusion)
  * trade held ≥ SHIELD_MIN_DURATION_SECONDS (no scalp-and-claim)
  * no open opposite-side hedge on the same instrument at close time
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    InsuranceShieldClaim, InsuranceShieldEvent, Position, TradeHistory,
    TradingAccount, Transaction, User, UserInsuranceShield,
)
from .claims import _hedge_exists

logger = logging.getLogger("insurance.shield")

# period → coverage window length in days
PERIOD_DAYS = {"daily": 1, "weekly": 7, "monthly": 30}

# Minimum hold before a losing trade is eligible (seconds). Mirrors the per-trade
# 5-minute rule from the handbook.
SHIELD_MIN_DURATION_SECONDS = 300

# Handbook default catalog: (period, tier, coverage_pct, max_payout, premium).
# Seeded into insurance_shield_plans on startup; admin may edit afterwards.
SHIELD_PLAN_DEFAULTS: list[tuple[str, str, int, int, int]] = [
    ("daily",   "basic", 20,   200,  19),
    ("daily",   "plus",  30,   500,  45),
    ("daily",   "pro",   40,  2000, 149),
    ("daily",   "elite", 50,  5000, 399),
    ("weekly",  "basic", 20,   500,  39),
    ("weekly",  "plus",  30,  1000,  79),
    ("weekly",  "pro",   40,  5000, 299),
    ("weekly",  "elite", 50, 10000, 699),
    ("monthly", "basic", 20,  1000,  89),
    ("monthly", "plus",  30,  2500, 199),
    ("monthly", "pro",   40,  7500, 549),
    ("monthly", "elite", 50, 15000, 999),
]

_CENTS = Decimal("0.01")


def _money(d: Decimal) -> Decimal:
    return d.quantize(_CENTS, rounding=ROUND_HALF_UP)


async def _log_event(
    db: AsyncSession, *, shield_id, user_id, kind: str, detail: str,
) -> None:
    db.add(InsuranceShieldEvent(
        id=uuid.uuid4(),
        user_insurance_id=shield_id,
        user_id=user_id,
        type=kind,
        detail=detail[:1000],
    ))


async def settle_shield_on_close(
    *,
    db: AsyncSession,
    position: Position,
    history: TradeHistory,
) -> Optional[InsuranceShieldClaim]:
    """If the position's owner holds an active Shield plan and this close is an
    eligible loss, accumulate it and credit the incremental capped payout.

    Called inside the close transaction, immediately after the per-trade
    `maybe_pay`. Swallows all exceptions — a Shield failure must never block the
    close or the per-trade payout.
    """
    try:
        # Resolve the owning user from the account.
        acct = (await db.execute(
            select(TradingAccount).where(TradingAccount.id == position.account_id)
        )).scalar_one_or_none()
        if acct is None:
            return None
        user_id = acct.user_id

        # Lock the user's active Shield plan for this transaction.
        shield = (await db.execute(
            select(UserInsuranceShield)
            .where(
                UserInsuranceShield.user_id == user_id,
                UserInsuranceShield.status == "active",
            )
            .with_for_update()
        )).scalar_one_or_none()
        if shield is None:
            return None  # No active Shield — nothing to do.

        now = datetime.now(timezone.utc)

        # Expired? Flip status and stop (no payout on a lapsed plan).
        if shield.expires_at is not None and now > shield.expires_at:
            shield.status = "expired"
            await _log_event(
                db, shield_id=shield.id, user_id=user_id,
                kind="expired", detail="plan window closed before this trade",
            )
            return None

        # Realized loss only.
        profit = Decimal(str(history.profit or 0))
        if profit >= 0:
            return None

        # Pre-existing-position exclusion: the trade must have been OPENED after
        # the plan started. Prevents insuring positions that were already losing.
        opened = history.opened_at
        if opened is not None and shield.activated_at is not None:
            op = opened if opened.tzinfo else opened.replace(tzinfo=timezone.utc)
            act = shield.activated_at if shield.activated_at.tzinfo else shield.activated_at.replace(tzinfo=timezone.utc)
            if op < act:
                await _log_event(
                    db, shield_id=shield.id, user_id=user_id,
                    kind="claim_denied", detail="pre_existing_position",
                )
                return None

        # Minimum hold.
        closed = history.closed_at or now
        if opened is not None:
            op = opened if opened.tzinfo else opened.replace(tzinfo=timezone.utc)
            cl = closed if closed.tzinfo else closed.replace(tzinfo=timezone.utc)
            if (cl - op).total_seconds() < SHIELD_MIN_DURATION_SECONDS:
                await _log_event(
                    db, shield_id=shield.id, user_id=user_id,
                    kind="claim_denied", detail="min_duration",
                )
                return None

        # Hedge guard — an open opposite-side position neutralised the loss.
        if await _hedge_exists(db=db, position=position):
            await _log_event(
                db, shield_id=shield.id, user_id=user_id,
                kind="claim_denied", detail="hedge",
            )
            return None

        # ── Aggregate accounting ────────────────────────────────────────────
        loss_abs = _money(-profit)
        coverage_frac = Decimal(str(shield.coverage_pct)) / Decimal("100")
        max_payout = Decimal(str(shield.max_payout))
        coverage_used = Decimal(str(shield.coverage_used or 0))

        new_cumulative = _money(Decimal(str(shield.cumulative_eligible_loss or 0)) + loss_abs)
        shield.cumulative_eligible_loss = new_cumulative  # always track the loss

        target_total = min(_money(new_cumulative * coverage_frac), max_payout)
        incremental = _money(target_total - coverage_used)

        if incremental <= 0:
            # Cap already reached (or rounding) — record the eligible loss, no pay.
            db.add(InsuranceShieldClaim(
                id=uuid.uuid4(),
                user_insurance_id=shield.id,
                user_id=user_id,
                position_id=position.id,
                trade_loss=loss_abs,
                cumulative_eligible_loss=new_cumulative,
                payout_amount=Decimal("0"),
                transaction_id=None,
                status="rejected",
            ))
            await _log_event(
                db, shield_id=shield.id, user_id=user_id,
                kind="claim_denied", detail="cap_exhausted",
            )
            if coverage_used >= max_payout:
                shield.status = "exhausted"
            return None

        # Credit the user's main wallet.
        user = (await db.execute(
            select(User).where(User.id == user_id).with_for_update()
        )).scalar_one_or_none()
        if user is None:
            return None
        prev = Decimal(str(user.main_wallet_balance or 0))
        new_balance = prev + incremental
        user.main_wallet_balance = new_balance

        tx = Transaction(
            id=uuid.uuid4(),
            user_id=user_id,
            account_id=None,
            type="insurance_payout",
            amount=incremental,
            balance_after=new_balance,
            reference_id=shield.id,
            description=(
                f"Shield payout — {str(shield.tier).title()} {str(shield.period).title()} "
                f"({float(shield.coverage_pct):.0f}% of ${float(new_cumulative):.2f} loss, "
                f"cap ${float(max_payout):.0f})"
            ),
        )
        db.add(tx)
        await db.flush()  # tx.id

        new_used = _money(coverage_used + incremental)
        shield.coverage_used = new_used
        if new_used >= max_payout:
            shield.status = "exhausted"

        claim = InsuranceShieldClaim(
            id=uuid.uuid4(),
            user_insurance_id=shield.id,
            user_id=user_id,
            position_id=position.id,
            trade_loss=loss_abs,
            cumulative_eligible_loss=new_cumulative,
            payout_amount=incremental,
            transaction_id=tx.id,
            status="paid",
        )
        db.add(claim)

        await _log_event(
            db, shield_id=shield.id, user_id=user_id,
            kind="claim_paid",
            detail=(
                f"loss={loss_abs} cumulative={new_cumulative} "
                f"paid={incremental} used={new_used}/{max_payout}"
            ),
        )
        logger.info(
            "Shield payout shield=%s user=%s incremental=%s used=%s/%s",
            shield.id, user_id, incremental, new_used, max_payout,
        )
        return claim

    except Exception as exc:  # never break the close
        logger.exception("settle_shield_on_close failed: %s", exc)
        return None
