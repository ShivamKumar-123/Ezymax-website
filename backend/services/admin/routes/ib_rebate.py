"""Admin control for the Milele-style IB rebate model.

Edit the tier ladder / overrides / active-client rules, switch the payout model
between 'instant' (legacy) and 'accrual' (this model), run a settlement pass on
demand, and view the current period + recent settlements.
"""
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import get_current_admin
from packages.common.src.database import get_db
from packages.common.src.models import (
    IbRebatePeriod, IbRebateSettlement, IBProfile, SystemSetting, User,
)
from packages.common.src.settings_store import invalidate_cache as invalidate_settings_cache
from packages.common.src.ib_rebate import load_config, settle_ib_rebates, current_period

router = APIRouter(prefix="/ib-rebate", tags=["Admin · IB Rebate"])

_KEYS = (
    "ib_commission_model", "ib_rebate_tiers", "ib_override_pcts",
    "ib_override_cap_pct", "ib_override_max_levels", "ib_active_client_min_lots",
    "ib_active_require_kyc", "ib_active_require_deposit", "ib_rebate_all_instruments",
)


@router.get("/config")
async def get_config(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    cfg = await load_config()
    return {
        "model": cfg.model,
        "tiers": cfg.tiers,
        "override_pcts": cfg.override_pcts,
        "override_cap_pct": cfg.override_cap_pct,
        "override_max_levels": cfg.override_max_levels,
        "active_min_lots": cfg.active_min_lots,
        "active_require_kyc": cfg.active_require_kyc,
        "active_require_deposit": cfg.active_require_deposit,
        "all_instruments": cfg.all_instruments,
    }


class ConfigUpdate(BaseModel):
    model: Optional[str] = None                 # 'instant' | 'accrual'
    tiers: Optional[list[dict]] = None
    override_pcts: Optional[list[float]] = None
    override_cap_pct: Optional[float] = None
    override_max_levels: Optional[int] = None
    active_min_lots: Optional[float] = None
    active_require_kyc: Optional[bool] = None
    active_require_deposit: Optional[bool] = None
    all_instruments: Optional[bool] = None


async def _upsert(db: AsyncSession, admin_id, key: str, value: Any) -> None:
    row = (await db.execute(
        select(SystemSetting).where(SystemSetting.key == key)
    )).scalar_one_or_none()
    if row is None:
        db.add(SystemSetting(key=key, value=value, updated_by=admin_id, updated_at=datetime.now(timezone.utc)))
    else:
        row.value = value
        row.updated_by = admin_id
        row.updated_at = datetime.now(timezone.utc)


@router.put("/config")
async def update_config(
    body: ConfigUpdate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    mapping = {
        "ib_commission_model": body.model,
        "ib_rebate_tiers": body.tiers,
        "ib_override_pcts": body.override_pcts,
        "ib_override_cap_pct": body.override_cap_pct,
        "ib_override_max_levels": body.override_max_levels,
        "ib_active_client_min_lots": body.active_min_lots,
        "ib_active_require_kyc": body.active_require_kyc,
        "ib_active_require_deposit": body.active_require_deposit,
        "ib_rebate_all_instruments": body.all_instruments,
    }
    applied = {}
    for key, value in mapping.items():
        if value is None:
            continue
        if key == "ib_commission_model" and value not in ("instant", "accrual"):
            continue
        await _upsert(db, admin.id, key, value)
        applied[key] = value
    await db.commit()
    await invalidate_settings_cache()
    return {"applied": applied}


@router.post("/run")
async def run_settlement(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    period: Optional[str] = None,
    force: bool = True,
) -> dict:
    """Run one settlement pass now. `force=True` runs even in 'instant' mode
    (for a dry look); when the model is 'accrual' it pays real deltas."""
    summary = await settle_ib_rebates(db, period=period, force=force)
    return summary


@router.get("/periods")
async def periods(
    period: Optional[str] = None,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Per-IB rebate state for a period (default current month)."""
    period = period or current_period()
    rows = (await db.execute(
        select(IbRebatePeriod, IBProfile, User)
        .join(IBProfile, IBProfile.id == IbRebatePeriod.ib_id)
        .join(User, User.id == IBProfile.user_id)
        .where(IbRebatePeriod.period == period)
        .order_by(desc(IbRebatePeriod.own_target))
    )).all()
    out = []
    tot_own = tot_ovr = 0.0
    for p, ib, user in rows:
        out.append({
            "ib_id": str(ib.id),
            "referral_code": ib.referral_code,
            "name": user.full_name or user.email,
            "tier": p.tier,
            "eligible_lots": float(p.eligible_lots or 0),
            "active_clients": int(p.active_clients or 0),
            "rate_per_lot": float(p.rate_per_lot or 0),
            "own_target": float(p.own_target or 0),
            "own_settled": float(p.own_settled or 0),
            "override_settled": float(p.override_settled or 0),
        })
        tot_own += float(p.own_settled or 0)
        tot_ovr += float(p.override_settled or 0)
    return {
        "period": period,
        "rows": out,
        "totals": {"own_settled": tot_own, "override_settled": tot_ovr, "ibs": len(out)},
    }


@router.get("/settlements")
async def settlements(
    limit: int = 100,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    rows = (await db.execute(
        select(IbRebateSettlement, IBProfile.referral_code)
        .join(IBProfile, IBProfile.id == IbRebateSettlement.ib_id)
        .order_by(desc(IbRebateSettlement.created_at))
        .limit(max(1, min(limit, 500)))
    )).all()
    return {
        "settlements": [
            {
                "id": str(s.id),
                "referral_code": code,
                "period": s.period,
                "kind": s.kind,
                "level": int(s.level or 0),
                "amount": float(s.amount or 0),
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s, code in rows
        ]
    }
