"""Staking API."""
from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import get_current_user
from packages.common.src.database import get_db

from ..services import staking_service

router = APIRouter()


class OpenPositionRequest(BaseModel):
    plan_id: UUID
    amount: Decimal = Field(gt=0)
    use_trading_bonus: bool = False


@router.get("/plans")
async def list_plans(
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Public catalogue of staking plans."""
    return await staking_service.list_plans(db)


@router.get("/positions")
async def list_positions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    return await staking_service.list_positions(db, current_user["user_id"])


@router.post("/positions")
async def open_position(
    req: OpenPositionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await staking_service.open_position(
        db, current_user["user_id"], req.plan_id, req.amount, req.use_trading_bonus,
    )
    await db.commit()
    return res


@router.post("/positions/{position_id}/withdraw")
async def withdraw_position(
    position_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await staking_service.withdraw_position(db, current_user["user_id"], position_id)
    await db.commit()
    return res


@router.post("/positions/{position_id}/claim-rewards")
async def claim_rewards(
    position_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await staking_service.claim_rewards(db, current_user["user_id"], position_id)
    await db.commit()
    return res
