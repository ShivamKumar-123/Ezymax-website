"""Play Zone API — Spin & Win.

Lottery and Bidding were removed (product decision, July 2026). Their
tables (lottery_rounds/lottery_tickets/bidding_rounds/bids) are kept as
historical records; no endpoints or engines touch them anymore.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import get_current_user
from packages.common.src.database import get_db

from ..services import play_zone_service

router = APIRouter()


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
