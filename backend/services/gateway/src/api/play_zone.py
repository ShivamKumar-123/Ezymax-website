"""Play Zone API — Spin & Win, Lottery, Bidding."""
from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import get_current_user
from packages.common.src.database import get_db

from ..services import play_zone_service

router = APIRouter()


class BidRequest(BaseModel):
    amount: Decimal = Field(gt=0)


@router.get("/spin/prizes")
async def list_spin_prizes(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    prizes = await play_zone_service.list_spin_prizes(db)
    return {
        "cost_ac": float(play_zone_service.SPIN_COST_AC),
        "prizes": prizes,
    }


@router.post("/spin")
async def do_spin(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await play_zone_service.spin(db, current_user["user_id"])
    await db.commit()
    return res


@router.get("/spin/recent")
async def recent_spins(
    limit: int = 10,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    return await play_zone_service.recent_results(db, current_user["user_id"], limit=limit)


# ─── Lottery ────────────────────────────────────────────────────────


@router.get("/lottery/rounds")
async def list_lottery(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    return await play_zone_service.list_lottery_rounds(db, current_user["user_id"])


@router.post("/lottery/{round_id}/buy")
async def buy_ticket(
    round_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await play_zone_service.buy_lottery_ticket(db, current_user["user_id"], round_id)
    await db.commit()
    return res


# ─── Bidding ────────────────────────────────────────────────────────


@router.get("/bidding/rounds")
async def list_bidding(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    return await play_zone_service.list_bidding_rounds(db, current_user["user_id"])


@router.post("/bidding/{round_id}/bid")
async def place_bid(
    round_id: UUID,
    req: BidRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await play_zone_service.place_bid(db, current_user["user_id"], round_id, req.amount)
    await db.commit()
    return res
