"""Admin endpoints for Play Zone scheduling — Lottery + Bidding rounds.

Reads/writes the same tables the gateway uses; just exposed under the
admin service so the admin frontend can manage rounds without an
ops-only psql session. Auth uses the existing admin JWT via
`require_permission`. Cancellation refunds participants 100% so admins
can kill a misconfigured round without stranding user AC.
"""
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import (
    BiddingRound, Bid, LotteryRound, LotteryTicket,
    RewardsTransaction, RewardsUserState, User,
)
from dependencies import require_permission

router = APIRouter(prefix="/play-zone", tags=["Play Zone (admin)"])


# ─── Schemas ────────────────────────────────────────────────────────


class CreateLotteryRoundRequest(BaseModel):
    slug: str = Field(min_length=3, max_length=80)
    prize_label: str = Field(min_length=1, max_length=120)
    prize_kind: str  # xp|ac|cashback|external
    prize_amount: Decimal = Field(default=Decimal("0"), ge=0)
    ticket_cost_ac: Decimal = Field(default=Decimal("100"), gt=0)
    draws_at: datetime


class CreateBiddingRoundRequest(BaseModel):
    slug: str = Field(min_length=3, max_length=80)
    prize_label: str = Field(min_length=1, max_length=120)
    prize_kind: str
    prize_amount: Decimal = Field(default=Decimal("0"), ge=0)
    min_bid_ac: Decimal = Field(default=Decimal("100"), gt=0)
    closes_at: datetime


# ─── Lottery ────────────────────────────────────────────────────────


@router.get("/lottery/rounds")
async def list_lottery_rounds(
    admin: User = Depends(require_permission("*")),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(LotteryRound).order_by(desc(LotteryRound.draws_at)).limit(100)
    )).scalars().all()
    return [
        {
            "id": str(r.id),
            "slug": r.slug,
            "prize_label": r.prize_label,
            "prize_kind": r.prize_kind,
            "prize_amount": float(r.prize_amount or 0),
            "ticket_cost_ac": float(r.ticket_cost_ac or 0),
            "opens_at": r.opens_at.isoformat() if r.opens_at else None,
            "draws_at": r.draws_at.isoformat(),
            "state": r.state,
            "ticket_count": int(r.ticket_count or 0),
            "winning_ticket_id": str(r.winning_ticket_id) if r.winning_ticket_id else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/lottery/rounds", status_code=201)
async def create_lottery_round(
    req: CreateLotteryRoundRequest,
    admin: User = Depends(require_permission("*")),
    db: AsyncSession = Depends(get_db),
):
    if req.prize_kind not in ("xp", "ac", "cashback", "external"):
        raise HTTPException(status_code=400, detail="invalid_prize_kind")
    now = datetime.now(timezone.utc)
    if req.draws_at <= now:
        raise HTTPException(status_code=400, detail="draws_at_must_be_future")
    rnd = LotteryRound(
        slug=req.slug,
        prize_label=req.prize_label,
        prize_kind=req.prize_kind,
        prize_amount=req.prize_amount,
        ticket_cost_ac=req.ticket_cost_ac,
        draws_at=req.draws_at,
        opens_at=now,
        state="open",
    )
    db.add(rnd)
    await db.commit()
    await db.refresh(rnd)
    return {"id": str(rnd.id), "slug": rnd.slug, "state": rnd.state, "draws_at": rnd.draws_at.isoformat()}


@router.post("/lottery/rounds/{round_id}/cancel")
async def cancel_lottery_round(
    round_id: UUID,
    admin: User = Depends(require_permission("*")),
    db: AsyncSession = Depends(get_db),
):
    rnd = (await db.execute(
        select(LotteryRound).where(LotteryRound.id == round_id).with_for_update()
    )).scalar_one_or_none()
    if rnd is None:
        raise HTTPException(status_code=404, detail="round_not_found")
    if rnd.state != "open":
        raise HTTPException(status_code=409, detail="round_not_open")

    tickets = (await db.execute(
        select(LotteryTicket).where(LotteryTicket.round_id == rnd.id)
    )).scalars().all()
    refunds_by_user: dict = {}
    for t in tickets:
        refunds_by_user[t.user_id] = refunds_by_user.get(t.user_id, Decimal("0")) + Decimal(str(t.ac_paid or 0))
    now = datetime.now(timezone.utc)
    for uid, total in refunds_by_user.items():
        s = (await db.execute(
            select(RewardsUserState).where(RewardsUserState.user_id == uid).with_for_update()
        )).scalar_one_or_none()
        if s is None:
            s = RewardsUserState(user_id=uid)
            db.add(s)
            await db.flush()
        s.ac_balance = Decimal(str(s.ac_balance or 0)) + total
        s.last_updated = now
        db.add(RewardsTransaction(
            user_id=uid, type="lottery_refund",
            xp_delta=0, ac_delta=total,
            source=rnd.slug, reference_id=rnd.id,
        ))
    rnd.state = "cancelled"
    await db.commit()
    return {"id": str(rnd.id), "state": rnd.state, "tickets_refunded": len(tickets)}


# ─── Bidding ────────────────────────────────────────────────────────


@router.get("/bidding/rounds")
async def list_bidding_rounds(
    admin: User = Depends(require_permission("*")),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(BiddingRound).order_by(desc(BiddingRound.closes_at)).limit(100)
    )).scalars().all()
    return [
        {
            "id": str(r.id),
            "slug": r.slug,
            "prize_label": r.prize_label,
            "prize_kind": r.prize_kind,
            "prize_amount": float(r.prize_amount or 0),
            "min_bid_ac": float(r.min_bid_ac or 0),
            "opens_at": r.opens_at.isoformat() if r.opens_at else None,
            "closes_at": r.closes_at.isoformat(),
            "state": r.state,
            "bid_count": int(r.bid_count or 0),
            "winning_bid_id": str(r.winning_bid_id) if r.winning_bid_id else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/bidding/rounds", status_code=201)
async def create_bidding_round(
    req: CreateBiddingRoundRequest,
    admin: User = Depends(require_permission("*")),
    db: AsyncSession = Depends(get_db),
):
    if req.prize_kind not in ("xp", "ac", "cashback", "external"):
        raise HTTPException(status_code=400, detail="invalid_prize_kind")
    now = datetime.now(timezone.utc)
    if req.closes_at <= now:
        raise HTTPException(status_code=400, detail="closes_at_must_be_future")
    rnd = BiddingRound(
        slug=req.slug,
        prize_label=req.prize_label,
        prize_kind=req.prize_kind,
        prize_amount=req.prize_amount,
        min_bid_ac=req.min_bid_ac,
        closes_at=req.closes_at,
        opens_at=now,
        state="open",
    )
    db.add(rnd)
    await db.commit()
    await db.refresh(rnd)
    return {"id": str(rnd.id), "slug": rnd.slug, "state": rnd.state, "closes_at": rnd.closes_at.isoformat()}


@router.post("/bidding/rounds/{round_id}/cancel")
async def cancel_bidding_round(
    round_id: UUID,
    admin: User = Depends(require_permission("*")),
    db: AsyncSession = Depends(get_db),
):
    rnd = (await db.execute(
        select(BiddingRound).where(BiddingRound.id == round_id).with_for_update()
    )).scalar_one_or_none()
    if rnd is None:
        raise HTTPException(status_code=404, detail="round_not_found")
    if rnd.state != "open":
        raise HTTPException(status_code=409, detail="round_not_open")

    bids = (await db.execute(
        select(Bid).where(Bid.round_id == rnd.id)
    )).scalars().all()
    refunds_by_user: dict = {}
    for b in bids:
        amt = Decimal(str(b.ac_amount or 0))
        b.refunded_ac = amt
        refunds_by_user[b.user_id] = refunds_by_user.get(b.user_id, Decimal("0")) + amt
    now = datetime.now(timezone.utc)
    for uid, total in refunds_by_user.items():
        s = (await db.execute(
            select(RewardsUserState).where(RewardsUserState.user_id == uid).with_for_update()
        )).scalar_one_or_none()
        if s is None:
            s = RewardsUserState(user_id=uid)
            db.add(s)
            await db.flush()
        s.ac_balance = Decimal(str(s.ac_balance or 0)) + total
        s.last_updated = now
        db.add(RewardsTransaction(
            user_id=uid, type="bid_cancel_refund",
            xp_delta=0, ac_delta=total,
            source=rnd.slug, reference_id=rnd.id,
        ))
    rnd.state = "cancelled"
    await db.commit()
    return {"id": str(rnd.id), "state": rnd.state, "bids_refunded": len(bids)}
