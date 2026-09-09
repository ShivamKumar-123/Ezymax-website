"""FXArtha Shield API — aggregate period-plan trade insurance.

Separate product from the per-trade micro-insurance in `insurance.py`.

  GET  /plans     — catalog of purchasable plans (grouped by period)
  GET  /status    — the caller's active plan + usage, plus recent history
  POST /purchase  — buy a plan (one active per user; `replace` swaps it)
  GET  /claims    — the caller's Shield settlement records

The claim payouts themselves happen passively inside `close_position`
(`insurance.shield.settle_shield_on_close`); this router only sells plans and
reports state.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import get_current_user
from packages.common.src.database import get_db
from packages.common.src.models import (
    InsuranceShieldClaim, InsuranceShieldEvent, InsuranceShieldPlan,
    UserInsuranceShield,
)
from packages.common.src.insurance.shield import PERIOD_DAYS, SHIELD_MIN_DURATION_SECONDS

from ..services import wallet_service

router = APIRouter()

_PERIOD_ORDER = {"daily": 0, "weekly": 1, "monthly": 2}
_TIER_ORDER = {"basic": 0, "plus": 1, "pro": 2, "elite": 3}


class ShieldPurchaseRequest(BaseModel):
    plan_id: uuid.UUID | None = None
    code: str | None = None
    replace: bool = False


def _plan_dict(p: InsuranceShieldPlan) -> dict:
    return {
        "id": str(p.id),
        "code": p.code,
        "period": p.period,
        "tier": p.tier,
        "coverage_pct": float(p.coverage_pct),
        "max_payout": float(p.max_payout),
        "premium": float(p.premium),
    }


def _shield_dict(s: UserInsuranceShield) -> dict:
    used = float(s.coverage_used or 0)
    cap = float(s.max_payout or 0)
    return {
        "id": str(s.id),
        "period": s.period,
        "tier": s.tier,
        "coverage_pct": float(s.coverage_pct),
        "max_payout": cap,
        "premium_paid": float(s.premium_paid or 0),
        "cumulative_eligible_loss": float(s.cumulative_eligible_loss or 0),
        "coverage_used": used,
        "coverage_remaining": max(0.0, cap - used),
        "status": s.status,
        "activated_at": s.activated_at.isoformat() if s.activated_at else None,
        "expires_at": s.expires_at.isoformat() if s.expires_at else None,
    }


@router.get("/plans")
async def list_plans(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(InsuranceShieldPlan).where(InsuranceShieldPlan.is_active.is_(True))
    )).scalars().all()
    rows = sorted(
        rows,
        key=lambda p: (_PERIOD_ORDER.get(p.period, 9), _TIER_ORDER.get(p.tier, 9)),
    )
    # Ship the eligibility rules with the catalogue rather than letting the
    # clients hardcode them. The five-minute hold is a constant in the engine;
    # if the desk ever changes it, copy that repeats it from memory starts
    # lying to the buyer — which is exactly the sort of thing people notice
    # only after they have paid a premium and been refused.
    return {
        "plans": [_plan_dict(p) for p in rows],
        "rules": {
            "min_hold_seconds": SHIELD_MIN_DURATION_SECONDS,
            "items": [
                {
                    "title": "The trade has to be closed",
                    "body": "Cover settles on realised loss. A position still open, however far down, is not covered yet.",
                },
                {
                    "title": f"Hold it at least {SHIELD_MIN_DURATION_SECONDS // 60} minutes",
                    "body": f"Measured from open to close. A trade closed under {SHIELD_MIN_DURATION_SECONDS // 60} minutes is skipped entirely.",
                },
                {
                    "title": "Open it after buying the plan",
                    "body": "Positions already open when the plan starts are not covered — you cannot insure a trade that is already losing.",
                },
                {
                    "title": "No opposite trade open on the same symbol",
                    "body": "Checked at the moment you close, on that account. Holding a BUY and a SELL on one symbol means the loss on one is offset by the gain on the other, so there is nothing to cover.",
                },
            ],
            # Rule 4 is the one people get wrong, because the answer depends on
            # something the sentence does not mention: which position you close
            # first. Spelling it out with real numbers is the difference
            # between a rule someone reads and a rule someone understands.
            "example": {
                "title": "If you hold both sides",
                "intro": (
                    "Say you hold BUY 2 lots and SELL 3 lots on XAUUSD. The sizes make no "
                    "difference — the check only asks whether an opposite position is still open."
                ),
                "rows": [
                    {
                        "action": "Close the SELL while the BUY is open",
                        "result": "Refused. An opposite position was open against it.",
                        "covered": False,
                    },
                    {
                        "action": "Then close the BUY",
                        "result": "Nothing is open against it now, so it is judged on its own.",
                        "covered": True,
                    },
                    {
                        "action": "Or close the BUY first, in profit",
                        "result": "A winning trade is never a claim, so Shield does not look at it.",
                        "covered": False,
                    },
                    {
                        "action": "Then close the SELL at a loss",
                        "result": "Nothing is open against it — this loss can be covered.",
                        "covered": True,
                    },
                ],
                "footer": (
                    "Whichever side you close last is the only one that can be covered. "
                    "That holds even if both sides lose: the first one closed is refused, "
                    "the second can be covered. A partial close does not help — whatever "
                    "is left open still blocks the other side."
                ),
            },
            # The detail that decides real outcomes and was written down
            # nowhere: the hedge test runs per close, so with two opposing
            # positions the one closed LAST is the only one that can be
            # covered. Two traders with identical positions and identical
            # losses get different answers purely from the order they closed
            # in. Better they read that here than discover it after paying.
            "notes": [
                {
                    "title": "Only the last one closed can be covered",
                    "body": "Closing order matters when you hold both sides of a symbol. Close the first and the other is still open, so that one is refused; close the second and nothing is open against it, so it can be covered. A partial close does not help — the remainder still counts as open.",
                },
                {
                    "title": "A refused trade does not count at all",
                    "body": "Its loss is not added to your cumulative total either, so it neither pays out nor moves you toward the cap.",
                },
                {
                    "title": "Cover is on your cumulative loss, not per trade",
                    "body": "Every eligible loss in the window adds up, and each payout tops you up to your coverage share of that running total.",
                },
                {
                    "title": "Payouts arrive on their own",
                    "body": "Nothing to claim or file. The amount lands in your main wallet the moment the trade closes, and shows in Cover activity below.",
                },
                {
                    "title": "The cap is for the whole window",
                    "body": "Once total payouts reach the plan cap, the plan is spent — further losses in that window are not covered.",
                },
                {
                    "title": "Cover ends when the window does",
                    "body": "A plan protects only trades closed before it expires. The premium is not refunded if you never claim.",
                },
            ],
        },
    }


@router.get("/status")
async def status(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["user_id"]

    active = (await db.execute(
        select(UserInsuranceShield)
        .where(
            UserInsuranceShield.user_id == user_id,
            UserInsuranceShield.status == "active",
        )
        .order_by(desc(UserInsuranceShield.activated_at))
    )).scalars().first()

    # Auto-expire a lapsed plan on read so status is always honest.
    if active is not None and active.expires_at is not None:
        now = datetime.now(timezone.utc)
        exp = active.expires_at if active.expires_at.tzinfo else active.expires_at.replace(tzinfo=timezone.utc)
        if now > exp:
            active.status = "expired"
            await db.commit()
            active = None

    history = (await db.execute(
        select(UserInsuranceShield)
        .where(UserInsuranceShield.user_id == user_id)
        .order_by(desc(UserInsuranceShield.activated_at))
        .limit(20)
    )).scalars().all()

    return {
        "active": _shield_dict(active) if active is not None else None,
        "history": [_shield_dict(s) for s in history],
    }


@router.post("/purchase")
async def purchase(
    req: ShieldPurchaseRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["user_id"]

    # Resolve the plan.
    stmt = select(InsuranceShieldPlan).where(InsuranceShieldPlan.is_active.is_(True))
    if req.plan_id is not None:
        stmt = stmt.where(InsuranceShieldPlan.id == req.plan_id)
    elif req.code:
        stmt = stmt.where(InsuranceShieldPlan.code == req.code)
    else:
        raise HTTPException(status_code=400, detail="plan_id_or_code_required")
    plan = (await db.execute(stmt)).scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="plan_not_found")

    now = datetime.now(timezone.utc)

    # One active plan per user. Lock existing active row.
    existing = (await db.execute(
        select(UserInsuranceShield)
        .where(
            UserInsuranceShield.user_id == user_id,
            UserInsuranceShield.status == "active",
        )
        .with_for_update()
    )).scalar_one_or_none()

    if existing is not None:
        exp = existing.expires_at if (existing.expires_at and existing.expires_at.tzinfo) else (
            existing.expires_at.replace(tzinfo=timezone.utc) if existing.expires_at else None
        )
        lapsed = exp is not None and now > exp
        if lapsed:
            existing.status = "expired"
        elif req.replace:
            existing.status = "replaced"
            db.add(InsuranceShieldEvent(
                id=uuid.uuid4(), user_insurance_id=existing.id, user_id=user_id,
                type="replace", detail=f"replaced by {plan.code}",
            ))
        else:
            raise HTTPException(status_code=409, detail="plan_already_active")

    days = PERIOD_DAYS.get(plan.period, 1)
    premium = Decimal(str(plan.premium))

    shield = UserInsuranceShield(
        id=uuid.uuid4(),
        user_id=user_id,
        plan_id=plan.id,
        period=plan.period,
        tier=plan.tier,
        coverage_pct=Decimal(str(plan.coverage_pct)),
        max_payout=Decimal(str(plan.max_payout)),
        premium_paid=premium,
        cumulative_eligible_loss=Decimal("0"),
        coverage_used=Decimal("0"),
        status="active",
        activated_at=now,
        expires_at=now + timedelta(days=days),
    )
    db.add(shield)
    await db.flush()

    # Charge the premium (raises 402 if the wallet is short — the flush above is
    # rolled back with the request, so no orphan plan is left behind).
    await wallet_service.charge_insurance_fee(
        db=db,
        user_id=user_id,
        amount=premium,
        policy_id=shield.id,
        description=(
            f"Shield plan — {plan.tier.title()} {plan.period.title()} "
            f"({float(plan.coverage_pct):.0f}% cover, cap ${float(plan.max_payout):.0f})"
        ),
    )

    db.add(InsuranceShieldEvent(
        id=uuid.uuid4(), user_insurance_id=shield.id, user_id=user_id,
        type="purchase", detail=f"{plan.code} premium ${float(premium):.2f}",
    ))
    await db.commit()

    return {"shield": _shield_dict(shield)}


# A denial is recorded as an EVENT, not a claim row, so a trade that missed a
# gate left no trace anywhere the trader could see: they lost money, got
# nothing, and the claim list stayed empty. These are the plain-English
# reasons, keyed by the `detail` the engine writes.
DENIAL_REASONS: dict[str, str] = {
    "min_duration": "Held under 5 minutes — Shield needs a trade open at least that long.",
    "pre_existing_position": "Opened before this plan started, so it was not covered.",
    "hedge": "An opposite position on the same symbol was open, which cancelled the loss.",
    "cap_exhausted": "This plan had already paid out its maximum.",
}


@router.get("/claims")
async def list_claims(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["user_id"]
    capped = max(1, min(limit, 200))

    rows = (await db.execute(
        select(InsuranceShieldClaim)
        .where(InsuranceShieldClaim.user_id == user_id)
        .order_by(desc(InsuranceShieldClaim.created_at))
        .limit(capped)
    )).scalars().all()

    # Denials + payouts from the audit trail. Without these the trader can only
    # see settlements that paid, which is exactly the case they are NOT asking
    # about when they come looking.
    events = (await db.execute(
        select(InsuranceShieldEvent)
        .where(
            InsuranceShieldEvent.user_id == user_id,
            InsuranceShieldEvent.type.in_(
                ("claim_denied", "claim_paid", "expired", "purchase", "replace", "cancelled")
            ),
        )
        .order_by(desc(InsuranceShieldEvent.created_at))
        .limit(capped)
    )).scalars().all()

    claims = [
        {
            "id": str(c.id),
            "position_id": str(c.position_id) if c.position_id else None,
            "trade_loss": float(c.trade_loss),
            "cumulative_eligible_loss": float(c.cumulative_eligible_loss),
            "payout_amount": float(c.payout_amount),
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in rows
    ]

    total_paid = sum(c["payout_amount"] for c in claims)
    denied = [e for e in events if e.type == "claim_denied"]

    return {
        "claims": claims,
        "events": [
            {
                "id": str(e.id),
                "type": e.type,
                "detail": e.detail,
                "reason": DENIAL_REASONS.get((e.detail or "").strip())
                if e.type == "claim_denied" else None,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
        "summary": {
            "total_paid": round(total_paid, 2),
            "paid_count": sum(1 for c in claims if c["payout_amount"] > 0),
            "denied_count": len(denied),
        },
    }
