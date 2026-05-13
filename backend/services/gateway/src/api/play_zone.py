"""Play Zone API — Spin & Win, Lottery, Bidding (user + admin endpoints)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import get_current_user, require_admin
from packages.common.src.database import get_db
from packages.common.src.models import LotteryRound, BiddingRound

from ..services import play_zone_service

router = APIRouter()


class BidRequest(BaseModel):
    amount: Decimal = Field(gt=0)


# ─── Admin payloads ─────────────────────────────────────────────────


class CreateLotteryRoundRequest(BaseModel):
    slug: str = Field(min_length=3, max_length=80)
    prize_label: str = Field(min_length=1, max_length=120)
    prize_kind: Literal["xp", "ac", "cashback", "external"]
    prize_amount: Decimal = Field(default=Decimal("0"), ge=0)
    ticket_cost_ac: Decimal = Field(default=Decimal("100"), gt=0)
    draws_at: datetime
    opens_at: Optional[datetime] = None


class CreateBiddingRoundRequest(BaseModel):
    slug: str = Field(min_length=3, max_length=80)
    prize_label: str = Field(min_length=1, max_length=120)
    prize_kind: Literal["xp", "ac", "cashback", "external"]
    prize_amount: Decimal = Field(default=Decimal("0"), ge=0)
    min_bid_ac: Decimal = Field(default=Decimal("100"), gt=0)
    closes_at: datetime
    opens_at: Optional[datetime] = None


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


# ─── Admin endpoints (require role in {admin, super_admin}) ─────────
# Operators previously had to INSERT lottery_rounds / bidding_rounds via
# psql; these endpoints let the admin frontend manage rounds without
# DB-shell access. All paths are role-gated by `require_admin`.


@router.post("/admin/lottery/rounds", status_code=201)
async def admin_create_lottery_round(
    req: CreateLotteryRoundRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if req.draws_at <= datetime.utcnow().replace(tzinfo=req.draws_at.tzinfo):
        raise HTTPException(status_code=400, detail="draws_at_must_be_future")
    rnd = LotteryRound(
        slug=req.slug,
        prize_label=req.prize_label,
        prize_kind=req.prize_kind,
        prize_amount=req.prize_amount,
        ticket_cost_ac=req.ticket_cost_ac,
        draws_at=req.draws_at,
        opens_at=req.opens_at or datetime.utcnow(),
        state="open",
    )
    db.add(rnd)
    await db.commit()
    await db.refresh(rnd)
    return {"id": str(rnd.id), "slug": rnd.slug, "state": rnd.state, "draws_at": rnd.draws_at.isoformat()}


@router.post("/admin/lottery/rounds/{round_id}/cancel")
async def admin_cancel_lottery_round(
    round_id: UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rnd = (await db.execute(
        select(LotteryRound).where(LotteryRound.id == round_id).with_for_update()
    )).scalar_one_or_none()
    if rnd is None:
        raise HTTPException(status_code=404, detail="round_not_found")
    if rnd.state != "open":
        raise HTTPException(status_code=409, detail="round_not_open")
    # Refund all tickets bought so far so we don't strand AC.
    refunded = await play_zone_service.refund_lottery_round(db, rnd)
    rnd.state = "cancelled"
    await db.commit()
    return {"id": str(rnd.id), "state": rnd.state, "tickets_refunded": refunded}


@router.post("/admin/bidding/rounds", status_code=201)
async def admin_create_bidding_round(
    req: CreateBiddingRoundRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if req.closes_at <= datetime.utcnow().replace(tzinfo=req.closes_at.tzinfo):
        raise HTTPException(status_code=400, detail="closes_at_must_be_future")
    rnd = BiddingRound(
        slug=req.slug,
        prize_label=req.prize_label,
        prize_kind=req.prize_kind,
        prize_amount=req.prize_amount,
        min_bid_ac=req.min_bid_ac,
        closes_at=req.closes_at,
        opens_at=req.opens_at or datetime.utcnow(),
        state="open",
    )
    db.add(rnd)
    await db.commit()
    await db.refresh(rnd)
    return {"id": str(rnd.id), "slug": rnd.slug, "state": rnd.state, "closes_at": rnd.closes_at.isoformat()}


@router.post("/admin/bidding/rounds/{round_id}/cancel")
async def admin_cancel_bidding_round(
    round_id: UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rnd = (await db.execute(
        select(BiddingRound).where(BiddingRound.id == round_id).with_for_update()
    )).scalar_one_or_none()
    if rnd is None:
        raise HTTPException(status_code=404, detail="round_not_found")
    if rnd.state != "open":
        raise HTTPException(status_code=409, detail="round_not_open")
    refunded = await play_zone_service.refund_bidding_round(db, rnd)
    rnd.state = "cancelled"
    await db.commit()
    return {"id": str(rnd.id), "state": rnd.state, "bids_refunded": refunded}
