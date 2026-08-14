"""Admin CRUD for the Rewards Store catalog (reward_store_items).

Lets admins edit every store item the trader sees under /earn/store — label,
description, category, AC price, PS requirement, ordering and active state —
plus create and remove items.
"""
import uuid
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
from packages.common.src.models import RewardStoreItem, User

router = APIRouter(prefix="/reward-store", tags=["Admin · Reward Store"])

CATEGORIES = ("cashback", "bonus", "perk", "tool", "lifestyle")


def _item_dict(r: RewardStoreItem) -> dict:
    payload = dict(r.payload or {})
    return {
        "id": str(r.id),
        "slug": r.slug,
        "category": r.category,
        "label": r.label,
        "description": r.description or "",
        "ac_price": float(r.ac_price),
        "is_active": bool(r.is_active),
        "display_order": int(r.display_order or 0),
        "min_ps": int(payload.get("min_ps") or 0),
        "fulfillment": str(payload.get("fulfillment") or ""),
    }


@router.get("/items")
async def list_items(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Every store item (including inactive), ordered as the trader sees them."""
    rows = (await db.execute(
        select(RewardStoreItem).order_by(
            RewardStoreItem.display_order, RewardStoreItem.label
        )
    )).scalars().all()
    return {"items": [_item_dict(r) for r in rows], "categories": list(CATEGORIES)}


class ItemUpdate(BaseModel):
    id: UUID
    label: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    ac_price: Optional[float] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    min_ps: Optional[int] = None
    fulfillment: Optional[str] = None


class ItemsUpdateRequest(BaseModel):
    items: list[ItemUpdate]


@router.put("/items")
async def update_items(
    body: ItemsUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Bulk-edit items. Only provided fields change; PS/fulfillment live on the
    JSONB payload so the ladder can be re-balanced without a code change."""
    updated = 0
    for upd in body.items:
        if upd.category is not None and upd.category not in CATEGORIES:
            raise HTTPException(status_code=400, detail=f"invalid_category:{upd.category}")
        item = (await db.execute(
            select(RewardStoreItem).where(RewardStoreItem.id == upd.id)
        )).scalar_one_or_none()
        if item is None:
            continue
        if upd.label is not None:
            item.label = upd.label
        if upd.description is not None:
            item.description = upd.description
        if upd.category is not None:
            item.category = upd.category
        if upd.ac_price is not None:
            item.ac_price = Decimal(str(upd.ac_price))
        if upd.is_active is not None:
            item.is_active = bool(upd.is_active)
        if upd.display_order is not None:
            item.display_order = int(upd.display_order)
        if upd.min_ps is not None or upd.fulfillment is not None:
            p = dict(item.payload or {})
            if upd.min_ps is not None:
                p["min_ps"] = int(upd.min_ps)
            if upd.fulfillment is not None:
                p["fulfillment"] = upd.fulfillment
            item.payload = p  # new object → tracked by SQLAlchemy
        updated += 1
    await db.commit()
    return {"updated": updated}


class ItemCreate(BaseModel):
    slug: str
    category: str
    label: str
    description: Optional[str] = ""
    ac_price: float
    is_active: bool = True
    display_order: int = 0
    min_ps: Optional[int] = None
    fulfillment: Optional[str] = None


@router.post("/items")
async def create_item(
    body: ItemCreate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if body.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="invalid_category")
    slug = body.slug.strip().lower().replace(" ", "-")
    if not slug:
        raise HTTPException(status_code=400, detail="slug_required")
    exists = (await db.execute(
        select(RewardStoreItem).where(RewardStoreItem.slug == slug)
    )).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status_code=409, detail="slug_exists")

    payload: dict = {}
    if body.min_ps is not None:
        payload["min_ps"] = int(body.min_ps)
    if body.fulfillment:
        payload["fulfillment"] = body.fulfillment

    item = RewardStoreItem(
        id=uuid.uuid4(),
        slug=slug,
        category=body.category,
        label=body.label,
        description=body.description or "",
        ac_price=Decimal(str(body.ac_price)),
        payload=payload,
        is_active=bool(body.is_active),
        display_order=int(body.display_order),
    )
    db.add(item)
    await db.commit()
    return {"item": _item_dict(item)}


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: UUID,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    item = (await db.execute(
        select(RewardStoreItem).where(RewardStoreItem.id == item_id)
    )).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="not_found")
    try:
        await db.delete(item)
        await db.commit()
    except IntegrityError:
        # Referenced by a lifestyle fulfillment — can't hard-delete. Deactivate.
        await db.rollback()
        item.is_active = False
        await db.commit()
        return {"deleted": False, "deactivated": True}
    return {"deleted": True}
