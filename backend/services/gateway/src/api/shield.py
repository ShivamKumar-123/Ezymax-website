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
from packages.common.src.insurance.shield import PERIOD_DAYS

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
    return {"plans": [_plan_dict(p) for p in rows]}


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


@router.get("/claims")
async def list_claims(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(InsuranceShieldClaim)
        .where(InsuranceShieldClaim.user_id == current_user["user_id"])
        .order_by(desc(InsuranceShieldClaim.created_at))
        .limit(max(1, min(limit, 200)))
    )).scalars().all()
    return {
        "claims": [
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
    }
