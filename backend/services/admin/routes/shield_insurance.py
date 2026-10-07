"""Admin endpoints for Ezymax Shield — aggregate period-plan insurance.

Separate from the per-trade insurance admin in `insurance.py`. Lets admins
edit the plan catalog (coverage / cap / premium / active) and view the reserve
dashboard (premium collected vs claims paid, loss ratio, active plans).
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import get_current_admin
from packages.common.src.database import get_db
from packages.common.src.models import (
    InsuranceShieldClaim, InsuranceShieldPlan, User, UserInsuranceShield,
)

router = APIRouter(prefix="/shield-insurance", tags=["Admin · Shield Insurance"])

_PERIOD_ORDER = {"daily": 0, "weekly": 1, "monthly": 2}
_TIER_ORDER = {"basic": 0, "plus": 1, "pro": 2, "elite": 3}


@router.get("/plans")
async def list_plans(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Full catalog (including inactive) for admin editing."""
    rows = (await db.execute(select(InsuranceShieldPlan))).scalars().all()
    rows = sorted(
        rows,
        key=lambda p: (_PERIOD_ORDER.get(p.period, 9), _TIER_ORDER.get(p.tier, 9)),
    )
    return {
        "plans": [
            {
                "id": str(p.id),
                "code": p.code,
                "period": p.period,
                "tier": p.tier,
                "coverage_pct": float(p.coverage_pct),
                "max_payout": float(p.max_payout),
                "premium": float(p.premium),
                "is_active": bool(p.is_active),
            }
            for p in rows
        ]
    }


class ShieldPlanUpdate(BaseModel):
    id: UUID
    coverage_pct: Optional[float] = None
    max_payout: Optional[float] = None
    premium: Optional[float] = None
    is_active: Optional[bool] = None


class ShieldPlansUpdateRequest(BaseModel):
    plans: list[ShieldPlanUpdate]


@router.put("/plans")
async def update_plans(
    body: ShieldPlansUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Edit coverage / cap / premium / active for existing plans. Only editable
    fields are touched; period/tier/code are immutable (they define the plan)."""
    updated = 0
    for upd in body.plans:
        plan = (await db.execute(
            select(InsuranceShieldPlan).where(InsuranceShieldPlan.id == upd.id)
        )).scalar_one_or_none()
        if plan is None:
            continue
        if upd.coverage_pct is not None:
            plan.coverage_pct = Decimal(str(upd.coverage_pct))
        if upd.max_payout is not None:
            plan.max_payout = Decimal(str(upd.max_payout))
        if upd.premium is not None:
            plan.premium = Decimal(str(upd.premium))
        if upd.is_active is not None:
            plan.is_active = bool(upd.is_active)
        plan.updated_at = datetime.now(timezone.utc)
        updated += 1
    await db.commit()
    return {"updated": updated}


@router.get("/stats")
async def stats(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Reserve dashboard: premium collected vs claims paid over 24h / 7d / all,
    plus loss ratio, active-plan count, and top claimants."""
    now = datetime.now(timezone.utc)
    windows = {"24h": now - timedelta(days=1), "7d": now - timedelta(days=7), "all": None}

    out: dict[str, Any] = {}
    for label, since in windows.items():
        prem_q = select(func.coalesce(func.sum(UserInsuranceShield.premium_paid), 0))
        if since is not None:
            prem_q = prem_q.where(UserInsuranceShield.activated_at >= since)
        premium = Decimal(str((await db.execute(prem_q)).scalar_one() or 0))

        pay_q = select(func.coalesce(func.sum(InsuranceShieldClaim.payout_amount), 0)).where(
            InsuranceShieldClaim.status == "paid"
        )
        if since is not None:
            pay_q = pay_q.where(InsuranceShieldClaim.created_at >= since)
        payouts = Decimal(str((await db.execute(pay_q)).scalar_one() or 0))

        plans_sold = (await db.execute(
            select(func.count(UserInsuranceShield.id))
            .where(*([UserInsuranceShield.activated_at >= since] if since is not None else []))
        )).scalar_one()
        claims_paid = (await db.execute(
            select(func.count(InsuranceShieldClaim.id))
            .where(InsuranceShieldClaim.status == "paid",
                   *([InsuranceShieldClaim.created_at >= since] if since is not None else []))
        )).scalar_one()

        out[label] = {
            "plans_sold": int(plans_sold or 0),
            "claims_paid": int(claims_paid or 0),
            "premium_collected": float(premium),
            "payouts": float(payouts),
            "reserve_balance": float(premium - payouts),
            "loss_ratio": float(payouts / premium) if premium > 0 else 0.0,
        }

    active_plans = (await db.execute(
        select(func.count(UserInsuranceShield.id)).where(UserInsuranceShield.status == "active")
    )).scalar_one()
    out["active_plans"] = int(active_plans or 0)

    top_q = await db.execute(
        select(InsuranceShieldClaim.user_id, func.sum(InsuranceShieldClaim.payout_amount).label("total"))
        .where(InsuranceShieldClaim.status == "paid")
        .group_by(InsuranceShieldClaim.user_id)
        .order_by(func.sum(InsuranceShieldClaim.payout_amount).desc())
        .limit(10)
    )
    out["top_claimants"] = [
        {"user_id": str(uid), "total_payout": float(total or 0)}
        for uid, total in top_q.all()
    ]
    return out
