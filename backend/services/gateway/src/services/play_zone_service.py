"""Play Zone — Spin & Win logic.

Each spin debits a fixed AC cost (SPIN_COST_AC) from the user, draws a prize
weighted by the SpinWheelPrize.weight column, and credits the payout to the
user's rewards state. Every spin is recorded in spin_results.

Lottery + Bidding were removed (product decision, July 2026); their tables
remain in the DB as historical records only.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    RewardsUserState, RewardsTransaction, SpinResult, SpinWheelPrize,
)

logger = logging.getLogger("play_zone_service")

# Default cost per spin, in Artha Coins (XP_Reward_mechanism doc = 30 ARTC).
# The live value is the `play_spin_cost_ac` system setting so admins can retune
# it without a deploy; this constant is only the fallback.
SPIN_COST_AC = Decimal("30")


async def get_spin_cost() -> Decimal:
    """Live per-spin AC cost — admin-editable via the `play_spin_cost_ac`
    system setting, falling back to SPIN_COST_AC."""
    from packages.common.src.settings_store import get_float_setting

    val = await get_float_setting("play_spin_cost_ac", float(SPIN_COST_AC))
    return Decimal(str(val))


# ─── Catalogue ───────────────────────────────────────────────────────

async def list_spin_prizes(db: AsyncSession) -> list[dict]:
    rows = (await db.execute(
        select(SpinWheelPrize)
        .where(SpinWheelPrize.is_active.is_(True))
        .order_by(SpinWheelPrize.display_order, SpinWheelPrize.label)
    )).scalars().all()
    total_weight = sum(int(r.weight or 0) for r in rows) or 1
    return [
        {
            "id": str(r.id),
            "slug": r.slug,
            "label": r.label,
            "weight": int(r.weight or 0),
            "probability": (int(r.weight or 0) / total_weight),
            "payout_kind": r.payout_kind,
            "payout_amount": float(r.payout_amount or 0),
            "display_order": int(r.display_order or 0),
        }
        for r in rows
    ]


# ─── Spin ────────────────────────────────────────────────────────────

def _draw_prize(prizes: list[SpinWheelPrize]) -> SpinWheelPrize:
    """Cryptographically secure weighted draw (so this never becomes a
    predictability complaint when payouts get bigger)."""
    weights = [max(0, int(p.weight or 0)) for p in prizes]
    total = sum(weights)
    if total <= 0:
        # No active prizes — caller should have already returned 503, but be
        # defensive in case of misconfiguration.
        raise HTTPException(status_code=503, detail="spin_unavailable")
    pick = secrets.randbelow(total)
    upto = 0
    for p, w in zip(prizes, weights):
        upto += w
        if pick < upto:
            return p
    return prizes[-1]


async def spin(db: AsyncSession, user_id) -> dict:
    """Debit SPIN_COST_AC from the user, draw a weighted prize, credit the
    payout, write an audit row. Caller commits."""
    state_q = await db.execute(
        select(RewardsUserState).where(RewardsUserState.user_id == user_id).with_for_update()
    )
    state = state_q.scalar_one_or_none()
    if state is None:
        state = RewardsUserState(user_id=user_id)
        db.add(state)
        await db.flush()
    spin_cost = await get_spin_cost()
    bal = Decimal(str(state.ac_balance or 0))
    if bal < spin_cost:
        raise HTTPException(status_code=402, detail="insufficient_ac")

    prizes = (await db.execute(
        select(SpinWheelPrize).where(SpinWheelPrize.is_active.is_(True))
    )).scalars().all()
    if not prizes:
        raise HTTPException(status_code=503, detail="spin_unavailable")

    chosen = _draw_prize(prizes)

    # Debit cost first, then credit payout — keeping this in one transaction
    # so a partial failure can't leave the user paying without a result row.
    state.ac_balance = bal - spin_cost
    payout_amount = Decimal(str(chosen.payout_amount or 0))
    if chosen.payout_kind == "xp":
        state.xp = int(state.xp or 0) + int(payout_amount)
        xp_delta = int(payout_amount)
        ac_delta = -spin_cost
    elif chosen.payout_kind in ("ac", "cashback"):
        state.ac_balance = Decimal(str(state.ac_balance)) + payout_amount
        xp_delta = 0
        ac_delta = -spin_cost + payout_amount
    else:  # nothing
        xp_delta = 0
        ac_delta = -spin_cost
    state.last_updated = datetime.now(timezone.utc)

    db.add(SpinResult(
        user_id=user_id,
        prize_id=chosen.id,
        ac_cost=spin_cost,
        payout_kind=chosen.payout_kind,
        payout_amount=payout_amount,
    ))
    db.add(RewardsTransaction(
        user_id=user_id, type="spin",
        xp_delta=xp_delta, ac_delta=ac_delta,
        source=chosen.slug, reference_id=chosen.id,
    ))

    return {
        "prize_id": str(chosen.id),
        "label": chosen.label,
        "payout_kind": chosen.payout_kind,
        "payout_amount": float(payout_amount),
        "ac_cost": float(spin_cost),
        "new_xp": int(state.xp or 0),
        "new_ac_balance": float(state.ac_balance or 0),
    }


# ─── Recent results (small ticker on the page) ──────────────────────

async def recent_results(db: AsyncSession, user_id, limit: int = 10) -> list[dict]:
    rows = (await db.execute(
        select(SpinResult, SpinWheelPrize.label)
        .join(SpinWheelPrize, SpinWheelPrize.id == SpinResult.prize_id)
        .where(SpinResult.user_id == user_id)
        .order_by(desc(SpinResult.awarded_at))
        .limit(max(1, min(int(limit), 50)))
    )).all()
    return [
        {
            "id": str(r.SpinResult.id),
            "label": r.label,
            "payout_kind": r.SpinResult.payout_kind,
            "payout_amount": float(r.SpinResult.payout_amount or 0),
            "ac_cost": float(r.SpinResult.ac_cost or 0),
            "awarded_at": r.SpinResult.awarded_at.isoformat(),
        }
        for r in rows
    ]
