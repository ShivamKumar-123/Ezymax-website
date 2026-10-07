"""Admin CRUD for the Spin & Win wheel (spin_wheel_prizes) + the per-spin cost.

Edits every wheel slot the trader sees under Earn -> Play Zone -> Spin: label,
win weight (probability), payout kind/amount, ordering and active state — plus
the AC cost per spin (stored as the `play_spin_cost_ac` system setting so it is
retunable without a deploy).
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import get_current_admin
from packages.common.src.database import get_db
from packages.common.src.models import SpinWheelPrize, SystemSetting, User
from packages.common.src.settings_store import (
    get_float_setting, invalidate_cache as invalidate_settings_cache,
)

router = APIRouter(prefix="/spin-wheel", tags=["Admin · Spin & Win"])

PAYOUT_KINDS = ("xp", "ac", "cashback", "nothing")
COST_KEY = "play_spin_cost_ac"


def _prize_dict(r: SpinWheelPrize) -> dict:
    return {
        "id": str(r.id),
        "slug": r.slug,
        "label": r.label,
        "weight": int(r.weight or 0),
        "payout_kind": r.payout_kind,
        "payout_amount": float(r.payout_amount or 0),
        "display_order": int(r.display_order or 0),
        "is_active": bool(r.is_active),
    }


@router.get("/prizes")
async def list_prizes(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    rows = (await db.execute(
        select(SpinWheelPrize).order_by(
            SpinWheelPrize.display_order, SpinWheelPrize.label
        )
    )).scalars().all()
    prizes = [_prize_dict(r) for r in rows]
    total_weight = sum(p["weight"] for p in prizes if p["is_active"])
    # Surface each active slot's win probability so admins can balance the wheel.
    for p in prizes:
        p["win_pct"] = (
            round(100.0 * p["weight"] / total_weight, 2)
            if (p["is_active"] and total_weight > 0) else 0.0
        )
    return {
        "prizes": prizes,
        "payout_kinds": list(PAYOUT_KINDS),
        "spin_cost_ac": await get_float_setting(COST_KEY, 30.0),
    }


class PrizeUpdate(BaseModel):
    id: UUID
    label: Optional[str] = None
    weight: Optional[int] = None
    payout_kind: Optional[str] = None
    payout_amount: Optional[float] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class PrizesUpdateRequest(BaseModel):
    prizes: list[PrizeUpdate]


@router.put("/prizes")
async def update_prizes(
    body: PrizesUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    updated = 0
    for upd in body.prizes:
        if upd.payout_kind is not None and upd.payout_kind not in PAYOUT_KINDS:
            raise HTTPException(status_code=400, detail=f"invalid_payout_kind:{upd.payout_kind}")
        prize = (await db.execute(
            select(SpinWheelPrize).where(SpinWheelPrize.id == upd.id)
        )).scalar_one_or_none()
        if prize is None:
            continue
        if upd.label is not None:
            prize.label = upd.label
        if upd.weight is not None:
            prize.weight = max(0, int(upd.weight))
        if upd.payout_kind is not None:
            prize.payout_kind = upd.payout_kind
        if upd.payout_amount is not None:
            prize.payout_amount = Decimal(str(upd.payout_amount))
        if upd.display_order is not None:
            prize.display_order = int(upd.display_order)
        if upd.is_active is not None:
            prize.is_active = bool(upd.is_active)
        updated += 1
    await db.commit()
    return {"updated": updated}


class PrizeCreate(BaseModel):
    slug: str
    label: str
    weight: int = 1
    payout_kind: str
    payout_amount: float = 0
    display_order: int = 0
    is_active: bool = True


@router.post("/prizes")
async def create_prize(
    body: PrizeCreate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if body.payout_kind not in PAYOUT_KINDS:
        raise HTTPException(status_code=400, detail="invalid_payout_kind")
    slug = body.slug.strip().lower().replace(" ", "-")
    if not slug:
        raise HTTPException(status_code=400, detail="slug_required")
    exists = (await db.execute(
        select(SpinWheelPrize).where(SpinWheelPrize.slug == slug)
    )).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status_code=409, detail="slug_exists")
    prize = SpinWheelPrize(
        id=uuid.uuid4(),
        slug=slug,
        label=body.label,
        weight=max(0, int(body.weight)),
        payout_kind=body.payout_kind,
        payout_amount=Decimal(str(body.payout_amount)),
        display_order=int(body.display_order),
        is_active=bool(body.is_active),
    )
    db.add(prize)
    await db.commit()
    return {"prize": _prize_dict(prize)}


@router.delete("/prizes/{prize_id}")
async def delete_prize(
    prize_id: UUID,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    prize = (await db.execute(
        select(SpinWheelPrize).where(SpinWheelPrize.id == prize_id)
    )).scalar_one_or_none()
    if prize is None:
        raise HTTPException(status_code=404, detail="not_found")
    try:
        await db.delete(prize)
        await db.commit()
    except IntegrityError:
        # Referenced by past spin results — deactivate instead of hard-delete.
        await db.rollback()
        prize.is_active = False
        await db.commit()
        return {"deleted": False, "deactivated": True}
    return {"deleted": True}


class ConfigRequest(BaseModel):
    spin_cost_ac: float


@router.put("/config")
async def update_config(
    body: ConfigRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if body.spin_cost_ac < 0:
        raise HTTPException(status_code=400, detail="invalid_cost")
    existing = (await db.execute(
        select(SystemSetting).where(SystemSetting.key == COST_KEY)
    )).scalar_one_or_none()
    if existing is None:
        db.add(SystemSetting(
            key=COST_KEY, value=body.spin_cost_ac,
            description="Ezymax Coins charged per Spin & Win spin",
            updated_by=admin.id, updated_at=datetime.now(timezone.utc),
        ))
    else:
        existing.value = body.spin_cost_ac
        existing.updated_by = admin.id
        existing.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await invalidate_settings_cache()
    return {"spin_cost_ac": body.spin_cost_ac}
