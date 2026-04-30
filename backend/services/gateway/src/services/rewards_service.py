"""Rewards engine — XP / Artha Coins / Power Score, missions, store, leaderboard.

Mission progress is incremented by call sites (e.g. trading_service.close_position
calls `mark_progress(user_id, "place_trades", 1, db)`). Users claim rewards
explicitly through the API once a mission's progress >= target.
"""
from __future__ import annotations

import logging
import uuid as uuid_lib
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    RewardsUserState, RewardsMission, RewardsUserMissionProgress,
    RewardStoreItem, RewardsTransaction,
    User, TradeHistory, TradingAccount,
)

logger = logging.getLogger("rewards_service")


# Level thresholds: cumulative XP needed to enter level N (index 0 = level 1).
LEVEL_THRESHOLDS = [0, 500, 1500, 3000, 5000, 8000, 12000, 18000, 26000, 36000]
LEVEL_LABELS = [
    "Novice", "Apprentice", "Skilled Trader", "Veteran", "Expert",
    "Master", "Champion", "Legend", "Sovereign", "Mythic",
]
RANK_LABEL_BY_PS = [
    (0,        "Newcomer"),
    (10_000,   "Active Trader"),
    (50_000,   "Reward Hunter"),
    (125_000,  "Elite Reward Hunter"),
    (500_000,  "Reward Royalty"),
]


def _level_for_xp(xp: int) -> tuple[int, str, int, int]:
    """Returns (level, label, xp_into_level, xp_needed_to_next)."""
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        next_threshold = LEVEL_THRESHOLDS[i + 1] if i + 1 < len(LEVEL_THRESHOLDS) else None
        if next_threshold is None or xp < next_threshold:
            label = LEVEL_LABELS[i] if i < len(LEVEL_LABELS) else "Mythic"
            into = xp - threshold
            need = (next_threshold - threshold) if next_threshold else 0
            return i + 1, label, into, need
    return len(LEVEL_THRESHOLDS), "Mythic", 0, 0


def _rank_for_ps(ps: int) -> str:
    label = "Newcomer"
    for threshold, lbl in RANK_LABEL_BY_PS:
        if ps >= threshold:
            label = lbl
    return label


def _next_ps_milestone(ps: int) -> tuple[int, str]:
    for threshold, lbl in RANK_LABEL_BY_PS:
        if ps < threshold:
            return threshold, lbl
    return ps, "Reward Royalty"


def _period_key(period: str, when: Optional[datetime] = None) -> str:
    when = when or datetime.now(timezone.utc)
    if period == "daily":
        return when.strftime("%Y-%m-%d")
    if period == "weekly":
        iso = when.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}"
    return when.strftime("%Y-%m-%d")


# ─────────────────────────────────────────────────────────────────────
# State
# ─────────────────────────────────────────────────────────────────────

async def _get_or_create_state(db: AsyncSession, user_id) -> RewardsUserState:
    state = (await db.execute(
        select(RewardsUserState).where(RewardsUserState.user_id == user_id)
    )).scalar_one_or_none()
    if state is None:
        state = RewardsUserState(user_id=user_id)
        db.add(state)
        await db.flush()
    return state


async def get_state(db: AsyncSession, user_id) -> dict:
    state = await _get_or_create_state(db, user_id)
    xp = int(state.xp or 0)
    ps = int(state.ps or 0)
    level, label, into, need = _level_for_xp(xp)
    next_ps, next_ps_label = _next_ps_milestone(ps)
    return {
        "level": level,
        "level_label": label,
        "xp": xp,
        "xp_into_level": into,
        "xp_for_next_level": need,
        "ac_balance": float(state.ac_balance or 0),
        "ps": ps,
        "ps_rank": _rank_for_ps(ps),
        "ps_next_milestone": next_ps,
        "ps_next_milestone_label": next_ps_label,
    }


# ─────────────────────────────────────────────────────────────────────
# Missions
# ─────────────────────────────────────────────────────────────────────

async def list_missions(db: AsyncSession, user_id, period: str) -> list[dict]:
    now = datetime.now(timezone.utc)
    pkey = _period_key(period, now)
    missions = (await db.execute(
        select(RewardsMission)
        .where(RewardsMission.is_active.is_(True), RewardsMission.period == period)
        .order_by(RewardsMission.display_order, RewardsMission.title)
    )).scalars().all()
    if not missions:
        return []
    progress_rows = (await db.execute(
        select(RewardsUserMissionProgress).where(
            RewardsUserMissionProgress.user_id == user_id,
            RewardsUserMissionProgress.period_key == pkey,
            RewardsUserMissionProgress.mission_id.in_([m.id for m in missions]),
        )
    )).scalars().all()
    by_mission = {p.mission_id: p for p in progress_rows}
    out = []
    for m in missions:
        p = by_mission.get(m.id)
        progress = int(p.progress) if p else 0
        completed = bool(p and p.completed_at)
        claimed = bool(p and p.claimed_at)
        out.append({
            "id": str(m.id),
            "slug": m.slug,
            "title": m.title,
            "description": m.description,
            "action_kind": m.action_kind,
            "target": int(m.target_count),
            "progress": progress,
            "xp_reward": int(m.xp_reward),
            "ac_reward": float(m.ac_reward),
            "completed": completed,
            "claimed": claimed,
            "period_key": pkey,
        })
    return out


async def claim_mission(db: AsyncSession, user_id, mission_id) -> dict:
    mission = (await db.execute(
        select(RewardsMission).where(RewardsMission.id == mission_id, RewardsMission.is_active.is_(True))
    )).scalar_one_or_none()
    if mission is None:
        raise HTTPException(status_code=404, detail="mission_not_found")
    pkey = _period_key(mission.period)
    progress = (await db.execute(
        select(RewardsUserMissionProgress).where(
            RewardsUserMissionProgress.user_id == user_id,
            RewardsUserMissionProgress.mission_id == mission.id,
            RewardsUserMissionProgress.period_key == pkey,
        ).with_for_update()
    )).scalar_one_or_none()
    if progress is None or int(progress.progress) < int(mission.target_count):
        raise HTTPException(status_code=409, detail="not_completed")
    if progress.claimed_at is not None:
        raise HTTPException(status_code=409, detail="already_claimed")

    state = await _get_or_create_state(db, user_id)
    state.xp = int(state.xp or 0) + int(mission.xp_reward)
    state.ac_balance = (Decimal(str(state.ac_balance or 0)) + Decimal(str(mission.ac_reward)))
    # Mission completion also bumps PS — flat 100 per claim, gives the rank a meaningful curve.
    state.ps = int(state.ps or 0) + 100
    state.last_updated = datetime.now(timezone.utc)

    progress.claimed_at = datetime.now(timezone.utc)
    db.add(RewardsTransaction(
        user_id=user_id, type="mission_claim",
        xp_delta=int(mission.xp_reward), ac_delta=Decimal(str(mission.ac_reward)),
        source=mission.slug, reference_id=mission.id,
    ))
    await db.commit()
    return {
        "xp_earned": int(mission.xp_reward),
        "ac_earned": float(mission.ac_reward),
        "new_xp": int(state.xp),
        "new_ac_balance": float(state.ac_balance),
        "new_ps": int(state.ps),
    }


async def mark_progress(
    db: AsyncSession,
    user_id,
    action_kind: str,
    increment: int = 1,
) -> None:
    """Increment progress on every active mission whose action_kind matches.
    Idempotent w.r.t. already-completed missions in the same period.
    Designed to be called inside the same transaction as the underlying event
    (e.g. trade close) — caller is responsible for db.commit().
    """
    if increment <= 0:
        return
    missions = (await db.execute(
        select(RewardsMission).where(
            RewardsMission.is_active.is_(True),
            RewardsMission.action_kind == action_kind,
        )
    )).scalars().all()
    if not missions:
        return
    now = datetime.now(timezone.utc)
    for m in missions:
        pkey = _period_key(m.period, now)
        prog = (await db.execute(
            select(RewardsUserMissionProgress).where(
                RewardsUserMissionProgress.user_id == user_id,
                RewardsUserMissionProgress.mission_id == m.id,
                RewardsUserMissionProgress.period_key == pkey,
            )
        )).scalar_one_or_none()
        if prog is None:
            prog = RewardsUserMissionProgress(
                user_id=user_id, mission_id=m.id, period_key=pkey,
                progress=0, updated_at=now,
            )
            db.add(prog)
        if prog.completed_at is not None:
            continue
        prog.progress = int(prog.progress or 0) + int(increment)
        prog.updated_at = now
        if prog.progress >= int(m.target_count):
            prog.progress = int(m.target_count)
            prog.completed_at = now


# ─────────────────────────────────────────────────────────────────────
# Store
# ─────────────────────────────────────────────────────────────────────

async def list_store(db: AsyncSession, category: Optional[str] = None) -> list[dict]:
    stmt = select(RewardStoreItem).where(RewardStoreItem.is_active.is_(True))
    if category and category != "all":
        stmt = stmt.where(RewardStoreItem.category == category)
    stmt = stmt.order_by(RewardStoreItem.display_order, RewardStoreItem.label)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": str(r.id),
            "slug": r.slug,
            "category": r.category,
            "label": r.label,
            "description": r.description,
            "ac_price": float(r.ac_price),
        }
        for r in rows
    ]


async def redeem(db: AsyncSession, user_id, item_id) -> dict:
    item = (await db.execute(
        select(RewardStoreItem).where(RewardStoreItem.id == item_id, RewardStoreItem.is_active.is_(True))
    )).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="item_not_found")
    state_q = await db.execute(
        select(RewardsUserState).where(RewardsUserState.user_id == user_id).with_for_update()
    )
    state = state_q.scalar_one_or_none()
    if state is None:
        state = RewardsUserState(user_id=user_id)
        db.add(state)
        await db.flush()
    bal = Decimal(str(state.ac_balance or 0))
    price = Decimal(str(item.ac_price))
    if bal < price:
        raise HTTPException(status_code=402, detail="insufficient_ac")
    state.ac_balance = bal - price
    state.last_updated = datetime.now(timezone.utc)
    db.add(RewardsTransaction(
        user_id=user_id, type="redeem",
        xp_delta=0, ac_delta=-price,
        source=item.slug, reference_id=item.id,
    ))
    await db.commit()
    return {
        "redeemed": item.label,
        "ac_spent": float(price),
        "new_ac_balance": float(state.ac_balance),
    }


# ─────────────────────────────────────────────────────────────────────
# Leaderboard
# ─────────────────────────────────────────────────────────────────────

async def leaderboard(db: AsyncSession, kind: str = "traders", limit: int = 10) -> list[dict]:
    """`kind=traders` → top by realised P&L over last 30 days from trade_history.
       `kind=earners` → top by AC balance from rewards_user_state."""
    if kind == "earners":
        rows = (await db.execute(
            select(RewardsUserState.user_id, RewardsUserState.ac_balance, User.email, User.first_name, User.last_name)
            .join(User, User.id == RewardsUserState.user_id)
            .order_by(desc(RewardsUserState.ac_balance))
            .limit(limit)
        )).all()
        return [
            {
                "rank": i + 1,
                "user_id": str(uid),
                "name": _display_name(first, last, email),
                "ac_balance": float(ac or 0),
            }
            for i, (uid, ac, email, first, last) in enumerate(rows)
        ]

    # traders — sum realised profit over last 30d, group by user.
    from datetime import timedelta
    since = datetime.now(timezone.utc) - timedelta(days=30)
    rows = (await db.execute(
        select(
            User.id, User.email, User.first_name, User.last_name,
            func.coalesce(func.sum(TradeHistory.profit), 0).label("pnl"),
        )
        .join(TradingAccount, TradingAccount.id == TradeHistory.account_id)
        .join(User, User.id == TradingAccount.user_id)
        .where(TradeHistory.closed_at >= since)
        .group_by(User.id, User.email, User.first_name, User.last_name)
        .order_by(desc("pnl"))
        .limit(limit)
    )).all()
    return [
        {
            "rank": i + 1,
            "user_id": str(uid),
            "name": _display_name(first, last, email),
            "roi_30d_usd": float(pnl or 0),
        }
        for i, (uid, email, first, last, pnl) in enumerate(rows)
    ]


def _display_name(first: Optional[str], last: Optional[str], email: str) -> str:
    if first and last:
        return f"{first} {last[:1]}."
    if first:
        return first
    return (email or "").split("@")[0]
