"""Play Zone — Spin & Win logic.

Each spin debits a fixed AC cost (SPIN_COST_AC) from the user, draws a prize
weighted by the SpinWheelPrize.weight column, and credits the payout to the
user's rewards state. Every spin is recorded in spin_results.

Lottery + Bidding will live alongside this module in Phase 6.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    RewardsUserState, RewardsTransaction, SpinResult, SpinWheelPrize,
    LotteryRound, LotteryTicket, BiddingRound, Bid,
)
from sqlalchemy import func as _func

logger = logging.getLogger("play_zone_service")

# Fixed cost per spin, in Artha Coins. Surface in the UI; matches the
# XP_Reward_mechanism doc (30 ARTC).
SPIN_COST_AC = Decimal("30")


# ─── Catalogue ───────────────────────────────────────────────────────

async def list_spin_prizes(db: AsyncSession) -> list[dict]:
    rows = (await db.execute(
        select(SpinWheelPrize)
        .where(SpinWheelPrize.is_active.is_(True))
        .order_by(SpinWheelPrize.display_order, SpinWheelPrize.label)
    )).scalars().all()
    total_weight = sum(int(r.weight or 0) for r in rows) or 1
    return [
        {
            "id": str(r.id),
            "slug": r.slug,
            "label": r.label,
            "weight": int(r.weight or 0),
            "probability": (int(r.weight or 0) / total_weight),
            "payout_kind": r.payout_kind,
            "payout_amount": float(r.payout_amount or 0),
            "display_order": int(r.display_order or 0),
        }
        for r in rows
    ]


# ─── Spin ────────────────────────────────────────────────────────────

def _draw_prize(prizes: list[SpinWheelPrize]) -> SpinWheelPrize:
    """Cryptographically secure weighted draw (so this never becomes a
    predictability complaint when payouts get bigger)."""
    weights = [max(0, int(p.weight or 0)) for p in prizes]
    total = sum(weights)
    if total <= 0:
        # No active prizes — caller should have already returned 503, but be
        # defensive in case of misconfiguration.
        raise HTTPException(status_code=503, detail="spin_unavailable")
    pick = secrets.randbelow(total)
    upto = 0
    for p, w in zip(prizes, weights):
        upto += w
        if pick < upto:
            return p
    return prizes[-1]


async def spin(db: AsyncSession, user_id) -> dict:
    """Debit SPIN_COST_AC from the user, draw a weighted prize, credit the
    payout, write an audit row. Caller commits."""
    state_q = await db.execute(
        select(RewardsUserState).where(RewardsUserState.user_id == user_id).with_for_update()
    )
    state = state_q.scalar_one_or_none()
    if state is None:
        state = RewardsUserState(user_id=user_id)
        db.add(state)
        await db.flush()
    bal = Decimal(str(state.ac_balance or 0))
    if bal < SPIN_COST_AC:
        raise HTTPException(status_code=402, detail="insufficient_ac")

    prizes = (await db.execute(
        select(SpinWheelPrize).where(SpinWheelPrize.is_active.is_(True))
    )).scalars().all()
    if not prizes:
        raise HTTPException(status_code=503, detail="spin_unavailable")

    chosen = _draw_prize(prizes)

    # Debit cost first, then credit payout — keeping this in one transaction
    # so a partial failure can't leave the user paying without a result row.
    state.ac_balance = bal - SPIN_COST_AC
    payout_amount = Decimal(str(chosen.payout_amount or 0))
    if chosen.payout_kind == "xp":
        state.xp = int(state.xp or 0) + int(payout_amount)
        xp_delta = int(payout_amount)
        ac_delta = -SPIN_COST_AC
    elif chosen.payout_kind in ("ac", "cashback"):
        state.ac_balance = Decimal(str(state.ac_balance)) + payout_amount
        xp_delta = 0
        ac_delta = -SPIN_COST_AC + payout_amount
    else:  # nothing
        xp_delta = 0
        ac_delta = -SPIN_COST_AC
    state.last_updated = datetime.now(timezone.utc)

    db.add(SpinResult(
        user_id=user_id,
        prize_id=chosen.id,
        ac_cost=SPIN_COST_AC,
        payout_kind=chosen.payout_kind,
        payout_amount=payout_amount,
    ))
    db.add(RewardsTransaction(
        user_id=user_id, type="spin",
        xp_delta=xp_delta, ac_delta=ac_delta,
        source=chosen.slug, reference_id=chosen.id,
    ))

    return {
        "prize_id": str(chosen.id),
        "label": chosen.label,
        "payout_kind": chosen.payout_kind,
        "payout_amount": float(payout_amount),
        "ac_cost": float(SPIN_COST_AC),
        "new_xp": int(state.xp or 0),
        "new_ac_balance": float(state.ac_balance or 0),
    }


# ─── Recent results (small ticker on the page) ──────────────────────

# ─── Lottery ─────────────────────────────────────────────────────────


async def list_lottery_rounds(db: AsyncSession, user_id) -> list[dict]:
    """All open + recently-closed rounds. Annotates with the caller's
    ticket count so the UI can show 'You hold 3 tickets'."""
    rows = (await db.execute(
        select(LotteryRound)
        .where(LotteryRound.state.in_(("open", "drawing", "closed")))
        .order_by(desc(LotteryRound.draws_at))
        .limit(20)
    )).scalars().all()
    if not rows:
        return []

    my_q = await db.execute(
        select(LotteryTicket.round_id, _func.count())
        .where(LotteryTicket.user_id == user_id, LotteryTicket.round_id.in_([r.id for r in rows]))
        .group_by(LotteryTicket.round_id)
    )
    my_count = {rid: int(cnt) for (rid, cnt) in my_q.all()}

    out = []
    for r in rows:
        out.append({
            "id": str(r.id),
            "slug": r.slug,
            "prize_label": r.prize_label,
            "prize_kind": r.prize_kind,
            "prize_amount": float(r.prize_amount or 0),
            "ticket_cost_ac": float(r.ticket_cost_ac or 0),
            "draws_at": r.draws_at.isoformat(),
            "state": r.state,
            "ticket_count": int(r.ticket_count or 0),
            "my_tickets": my_count.get(r.id, 0),
            "winning_ticket_id": str(r.winning_ticket_id) if r.winning_ticket_id else None,
        })
    return out


async def buy_lottery_ticket(db: AsyncSession, user_id, round_id) -> dict:
    """Debit ticket_cost_ac from user's AC balance, insert a LotteryTicket,
    increment round.ticket_count. Caller commits."""
    rnd = (await db.execute(
        select(LotteryRound).where(LotteryRound.id == round_id).with_for_update()
    )).scalar_one_or_none()
    if rnd is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="round_not_found")
    if rnd.state != "open":
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail="round_not_open")
    if rnd.draws_at <= datetime.now(timezone.utc):
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail="round_expired")

    cost = Decimal(str(rnd.ticket_cost_ac or 0))
    state_q = await db.execute(
        select(RewardsUserState).where(RewardsUserState.user_id == user_id).with_for_update()
    )
    state = state_q.scalar_one_or_none()
    if state is None:
        state = RewardsUserState(user_id=user_id)
        db.add(state)
        await db.flush()
    bal = Decimal(str(state.ac_balance or 0))
    if bal < cost:
        from fastapi import HTTPException
        raise HTTPException(status_code=402, detail="insufficient_ac")

    state.ac_balance = bal - cost
    state.last_updated = datetime.now(timezone.utc)

    ticket = LotteryTicket(round_id=rnd.id, user_id=user_id, ac_paid=cost)
    db.add(ticket)
    rnd.ticket_count = int(rnd.ticket_count or 0) + 1

    db.add(RewardsTransaction(
        user_id=user_id, type="lottery_ticket",
        xp_delta=0, ac_delta=-cost,
        source=rnd.slug, reference_id=rnd.id,
    ))

    return {
        "round_id": str(rnd.id),
        "ticket_count_total": int(rnd.ticket_count),
        "ac_spent": float(cost),
        "new_ac_balance": float(state.ac_balance),
    }


async def refund_lottery_round(db: AsyncSession, rnd: LotteryRound) -> int:
    """Refund every ticket purchase on a round and write a ledger row.
    Used by admin cancel. Caller commits."""
    tickets = (await db.execute(
        select(LotteryTicket).where(LotteryTicket.round_id == rnd.id)
    )).scalars().all()
    if not tickets:
        return 0
    refunds_by_user: dict = {}
    for t in tickets:
        refunds_by_user[t.user_id] = refunds_by_user.get(t.user_id, Decimal("0")) + Decimal(str(t.ac_paid or 0))
    now = datetime.now(timezone.utc)
    for uid, total in refunds_by_user.items():
        s_q = await db.execute(
            select(RewardsUserState).where(RewardsUserState.user_id == uid).with_for_update()
        )
        s = s_q.scalar_one_or_none()
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
    return len(tickets)


async def refund_bidding_round(db: AsyncSession, rnd: BiddingRound) -> int:
    """Refund every bid on a round at 100% (admin cancel) — distinct from
    the close-with-50%-refund path. Caller commits."""
    bids = (await db.execute(
        select(Bid).where(Bid.round_id == rnd.id)
    )).scalars().all()
    if not bids:
        return 0
    refunds_by_user: dict = {}
    for b in bids:
        amt = Decimal(str(b.ac_amount or 0))
        b.refunded_ac = amt
        refunds_by_user[b.user_id] = refunds_by_user.get(b.user_id, Decimal("0")) + amt
    now = datetime.now(timezone.utc)
    for uid, total in refunds_by_user.items():
        s_q = await db.execute(
            select(RewardsUserState).where(RewardsUserState.user_id == uid).with_for_update()
        )
        s = s_q.scalar_one_or_none()
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
    return len(bids)


async def close_due_lottery_rounds(db: AsyncSession, now: Optional[datetime] = None) -> int:
    """Cron-friendly: pick a winner for every round whose draws_at has passed
    and is still 'open'. Credits the prize to the winner. Returns the
    number of rounds closed. Idempotent — only acts on state='open'."""
    now = now or datetime.now(timezone.utc)
    due = (await db.execute(
        select(LotteryRound)
        .where(LotteryRound.state == "open", LotteryRound.draws_at <= now)
        .with_for_update(skip_locked=True)
    )).scalars().all()
    closed = 0
    for rnd in due:
        rnd.state = "drawing"
        # Tickets weighted equally; pick one uniformly at random.
        tickets = (await db.execute(
            select(LotteryTicket).where(LotteryTicket.round_id == rnd.id)
        )).scalars().all()
        if not tickets:
            rnd.state = "closed"  # no entrants; just close
            closed += 1
            continue
        winning = tickets[secrets.randbelow(len(tickets))]
        rnd.winning_ticket_id = winning.id

        # Credit prize to the winner.
        ws_q = await db.execute(
            select(RewardsUserState).where(RewardsUserState.user_id == winning.user_id).with_for_update()
        )
        ws = ws_q.scalar_one_or_none()
        if ws is None:
            ws = RewardsUserState(user_id=winning.user_id)
            db.add(ws)
            await db.flush()
        amt = Decimal(str(rnd.prize_amount or 0))
        if rnd.prize_kind == "xp":
            ws.xp = int(ws.xp or 0) + int(amt)
            xp_delta, ac_delta = int(amt), Decimal("0")
        elif rnd.prize_kind in ("ac", "cashback"):
            ws.ac_balance = Decimal(str(ws.ac_balance or 0)) + amt
            xp_delta, ac_delta = 0, amt
        else:  # external — admin handles fulfillment
            xp_delta, ac_delta = 0, Decimal("0")
        ws.last_updated = now

        db.add(RewardsTransaction(
            user_id=winning.user_id, type="lottery_win",
            xp_delta=xp_delta, ac_delta=ac_delta,
            source=rnd.slug, reference_id=rnd.id,
        ))
        rnd.state = "closed"
        closed += 1
    return closed


# ─── Bidding ────────────────────────────────────────────────────────


async def list_bidding_rounds(db: AsyncSession, user_id) -> list[dict]:
    rows = (await db.execute(
        select(BiddingRound)
        .where(BiddingRound.state.in_(("open", "closed")))
        .order_by(desc(BiddingRound.closes_at))
        .limit(20)
    )).scalars().all()
    if not rows:
        return []

    # Highest bid per round (for display) + the user's own highest bid.
    top_q = await db.execute(
        select(Bid.round_id, _func.max(Bid.ac_amount))
        .where(Bid.round_id.in_([r.id for r in rows]))
        .group_by(Bid.round_id)
    )
    top_by_round = {rid: Decimal(str(amt or 0)) for (rid, amt) in top_q.all()}

    my_q = await db.execute(
        select(Bid.round_id, _func.max(Bid.ac_amount))
        .where(Bid.user_id == user_id, Bid.round_id.in_([r.id for r in rows]))
        .group_by(Bid.round_id)
    )
    my_by_round = {rid: Decimal(str(amt or 0)) for (rid, amt) in my_q.all()}

    out = []
    for r in rows:
        out.append({
            "id": str(r.id),
            "slug": r.slug,
            "prize_label": r.prize_label,
            "prize_kind": r.prize_kind,
            "prize_amount": float(r.prize_amount or 0),
            "min_bid_ac": float(r.min_bid_ac or 0),
            "closes_at": r.closes_at.isoformat(),
            "state": r.state,
            "bid_count": int(r.bid_count or 0),
            "current_top_ac": float(top_by_round.get(r.id, Decimal("0"))),
            "my_top_ac": float(my_by_round.get(r.id, Decimal("0"))),
            "winning_bid_id": str(r.winning_bid_id) if r.winning_bid_id else None,
        })
    return out


async def place_bid(db: AsyncSession, user_id, round_id, amount: Decimal) -> dict:
    rnd = (await db.execute(
        select(BiddingRound).where(BiddingRound.id == round_id).with_for_update()
    )).scalar_one_or_none()
    if rnd is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="round_not_found")
    if rnd.state != "open":
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail="round_not_open")
    if rnd.closes_at <= datetime.now(timezone.utc):
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail="round_expired")
    if amount < Decimal(str(rnd.min_bid_ac or 0)):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"min_bid_ac_{int(rnd.min_bid_ac or 0)}")

    state_q = await db.execute(
        select(RewardsUserState).where(RewardsUserState.user_id == user_id).with_for_update()
    )
    state = state_q.scalar_one_or_none()
    if state is None:
        state = RewardsUserState(user_id=user_id)
        db.add(state)
        await db.flush()
    bal = Decimal(str(state.ac_balance or 0))
    if bal < amount:
        from fastapi import HTTPException
        raise HTTPException(status_code=402, detail="insufficient_ac")

    state.ac_balance = bal - amount
    state.last_updated = datetime.now(timezone.utc)

    bid = Bid(round_id=rnd.id, user_id=user_id, ac_amount=amount)
    db.add(bid)
    rnd.bid_count = int(rnd.bid_count or 0) + 1

    db.add(RewardsTransaction(
        user_id=user_id, type="bid_placed",
        xp_delta=0, ac_delta=-amount,
        source=rnd.slug, reference_id=rnd.id,
    ))

    return {
        "round_id": str(rnd.id),
        "bid_id": "(pending-flush)",
        "bid_amount": float(amount),
        "new_ac_balance": float(state.ac_balance),
    }


async def close_due_bidding_rounds(db: AsyncSession, now: Optional[datetime] = None) -> int:
    """Cron: close bidding rounds whose closes_at has passed. The single
    highest bid wins (ties broken by earliest placed_at). Losers are refunded
    50% of the AC they bid (per XP_Reward_mechanism slide 10)."""
    now = now or datetime.now(timezone.utc)
    due = (await db.execute(
        select(BiddingRound)
        .where(BiddingRound.state == "open", BiddingRound.closes_at <= now)
        .with_for_update(skip_locked=True)
    )).scalars().all()
    closed = 0
    for rnd in due:
        bids = (await db.execute(
            select(Bid)
            .where(Bid.round_id == rnd.id)
            .order_by(desc(Bid.ac_amount), Bid.placed_at)
        )).scalars().all()
        if not bids:
            rnd.state = "closed"
            closed += 1
            continue

        winner = bids[0]
        rnd.winning_bid_id = winner.id

        # Credit prize to winner.
        ws_q = await db.execute(
            select(RewardsUserState).where(RewardsUserState.user_id == winner.user_id).with_for_update()
        )
        ws = ws_q.scalar_one_or_none()
        if ws is None:
            ws = RewardsUserState(user_id=winner.user_id)
            db.add(ws)
            await db.flush()
        amt = Decimal(str(rnd.prize_amount or 0))
        if rnd.prize_kind == "xp":
            ws.xp = int(ws.xp or 0) + int(amt)
            xp_delta, ac_delta = int(amt), Decimal("0")
        elif rnd.prize_kind in ("ac", "cashback"):
            ws.ac_balance = Decimal(str(ws.ac_balance or 0)) + amt
            xp_delta, ac_delta = 0, amt
        else:
            xp_delta, ac_delta = 0, Decimal("0")
        ws.last_updated = now
        db.add(RewardsTransaction(
            user_id=winner.user_id, type="bid_win",
            xp_delta=xp_delta, ac_delta=ac_delta,
            source=rnd.slug, reference_id=rnd.id,
        ))

        # Refund 50% of every losing bid. Each user's refunds sum into a
        # single ledger row so the audit log isn't noisy.
        refunds_by_user: dict = {}
        for b in bids[1:]:
            refund = (Decimal(str(b.ac_amount)) / Decimal("2")).quantize(Decimal("0.01"))
            b.refunded_ac = refund
            refunds_by_user[b.user_id] = refunds_by_user.get(b.user_id, Decimal("0")) + refund

        for uid, total_refund in refunds_by_user.items():
            us_q = await db.execute(
                select(RewardsUserState).where(RewardsUserState.user_id == uid).with_for_update()
            )
            us = us_q.scalar_one_or_none()
            if us is None:
                us = RewardsUserState(user_id=uid)
                db.add(us)
                await db.flush()
            us.ac_balance = Decimal(str(us.ac_balance or 0)) + total_refund
            us.last_updated = now
            db.add(RewardsTransaction(
                user_id=uid, type="bid_refund",
                xp_delta=0, ac_delta=total_refund,
                source=rnd.slug, reference_id=rnd.id,
            ))

        rnd.state = "closed"
        closed += 1
    return closed


# ─── Recent results (small ticker on the page) ──────────────────────

async def recent_results(db: AsyncSession, user_id, limit: int = 10) -> list[dict]:
    rows = (await db.execute(
        select(SpinResult, SpinWheelPrize.label)
        .join(SpinWheelPrize, SpinWheelPrize.id == SpinResult.prize_id)
        .where(SpinResult.user_id == user_id)
        .order_by(desc(SpinResult.awarded_at))
        .limit(max(1, min(int(limit), 50)))
    )).all()
    return [
        {
            "id": str(r.SpinResult.id),
            "label": r.label,
            "payout_kind": r.SpinResult.payout_kind,
            "payout_amount": float(r.SpinResult.payout_amount or 0),
            "ac_cost": float(r.SpinResult.ac_cost or 0),
            "awarded_at": r.SpinResult.awarded_at.isoformat(),
        }
        for r in rows
    ]
