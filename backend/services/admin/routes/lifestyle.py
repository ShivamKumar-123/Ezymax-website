"""Admin queue for PS-gated lifestyle redemptions.

Lifestyle items (smartphones, Dubai trips, branded merch) are bought
with AC + gated by the user's PS. They require manual fulfillment, so
this queue gives ops a single place to track each redemption from
queued → processing → shipped → delivered (or cancelled).
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import (
    LifestyleFulfillment, RewardStoreItem, User,
)
from dependencies import require_permission

router = APIRouter(prefix="/lifestyle-fulfillments", tags=["Lifestyle Fulfillment"])


class UpdateRequest(BaseModel):
    status: Optional[str] = Field(default=None)
    tracking_number: Optional[str] = Field(default=None, max_length=120)
    shipping_address: Optional[str] = None
    note: Optional[str] = None


@router.get("")
async def list_fulfillments(
    status: Optional[str] = None,
    admin: User = Depends(require_permission("*")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LifestyleFulfillment, RewardStoreItem, User).join(
        RewardStoreItem, RewardStoreItem.id == LifestyleFulfillment.item_id,
    ).join(
        User, User.id == LifestyleFulfillment.user_id,
    )
    if status:
        stmt = stmt.where(LifestyleFulfillment.status == status)
    stmt = stmt.order_by(desc(LifestyleFulfillment.requested_at)).limit(200)
    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": str(f.id),
            "user_id": str(f.user_id),
            "user_email": u.email,
            "user_name": " ".join(filter(None, [u.first_name, u.last_name])) or u.email,
            "item_label": item.label,
            "item_slug": item.slug,
            "ac_paid": float(f.ac_paid or 0),
            "user_ps_at_redeem": int(f.user_ps_at_redeem or 0),
            "shipping_address": f.shipping_address,
            "tracking_number": f.tracking_number,
            "status": f.status,
            "note": f.note,
            "requested_at": f.requested_at.isoformat() if f.requested_at else None,
            "shipped_at": f.shipped_at.isoformat() if f.shipped_at else None,
            "delivered_at": f.delivered_at.isoformat() if f.delivered_at else None,
            "cancelled_at": f.cancelled_at.isoformat() if f.cancelled_at else None,
        }
        for (f, item, u) in rows
    ]


@router.patch("/{fulfillment_id}")
async def update_fulfillment(
    fulfillment_id: UUID,
    req: UpdateRequest,
    admin: User = Depends(require_permission("*")),
    db: AsyncSession = Depends(get_db),
):
    f = (await db.execute(
        select(LifestyleFulfillment)
        .where(LifestyleFulfillment.id == fulfillment_id)
        .with_for_update()
    )).scalar_one_or_none()
    if f is None:
        raise HTTPException(status_code=404, detail="not_found")

    if req.tracking_number is not None:
        f.tracking_number = req.tracking_number
    if req.shipping_address is not None:
        f.shipping_address = req.shipping_address
    if req.note is not None:
        f.note = req.note

    if req.status is not None:
        if req.status not in ("queued", "processing", "shipped", "delivered", "cancelled"):
            raise HTTPException(status_code=400, detail="invalid_status")
        now = datetime.now(timezone.utc)
        prev = f.status
        f.status = req.status
        f.handled_by = admin.id
        if req.status == "processing" and not f.processed_at:
            f.processed_at = now
        if req.status == "shipped" and not f.shipped_at:
            f.shipped_at = now
        if req.status == "delivered" and not f.delivered_at:
            f.delivered_at = now
        if req.status == "cancelled" and not f.cancelled_at:
            f.cancelled_at = now

    await db.commit()
    await db.refresh(f)
    return {"id": str(f.id), "status": f.status, "tracking_number": f.tracking_number}
