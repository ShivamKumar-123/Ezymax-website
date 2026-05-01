"""Rewards engine — XP / Artha Coins / Power Score, missions, store, leaderboard.

Mission progress is incremented by call sites (e.g. trading_service.close_position
calls `mark_progress(user_id, "place_trades", 1, db)`). Users claim rewards
explicitly through the API once a mission's progress >= target.
"""
from __future__ import annotations

import logging
import uuid as uuid_lib
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    RewardsUserState, RewardsMission, RewardsUserMissionProgress,
    RewardStoreItem, RewardsTransaction,
    User, TradeHistory, TradingAccount,
    Referral,
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
    if period in ("bonus", "flash", "achievement"):
        # One-shot per user — single row per (user, mission) regardless of when.
        return "lifetime"
    return when.strftime("%Y-%m-%d")


# Day 7 streak reward (per Repeatable_task.docx "REWARD DAY"): 50 XP + 20 AC.
STREAK_BONUS_DAYS = 7
STREAK_BONUS_XP = 50
STREAK_BONUS_AC = Decimal("20")
# Daily login itself awards a small XP nudge (Day 1: +5 XP per the doc).
STREAK_DAILY_XP = 5


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
    today = date.today()
    last = state.last_streak_date
    # The visible streak count is the on-record value, but if the user has skipped
    # a day the streak is *effectively* broken — show 0 until they check in again.
    visible_streak = int(state.streak_count or 0)
    if last is not None and (today - last).days > 1:
        visible_streak = 0
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
        "streak_count": visible_streak,
        "streak_checked_in_today": last is not None and last == today,
        "streak_bonus_days": STREAK_BONUS_DAYS,
        "streak_bonus_xp": STREAK_BONUS_XP,
        "streak_bonus_ac": float(STREAK_BONUS_AC),
    }


# ─────────────────────────────────────────────────────────────────────
# Daily login streak
# ─────────────────────────────────────────────────────────────────────

async def daily_login_check_in(db: AsyncSession, user_id) -> dict:
    """Idempotent per UTC day. Increments the streak if the user checked in
    yesterday (or starts a fresh streak otherwise). Awards a flat XP nudge
    every day plus a bigger bonus on day 7 (then resets to 0 so the cycle
    repeats). Caller commits."""
    state = await _get_or_create_state(db, user_id)
    today = date.today()
    last = state.last_streak_date

    if last == today:
        # Already checked in — return current state without granting again.
        return {
            "streak_count": int(state.streak_count or 0),
            "checked_in_today": True,
            "xp_earned": 0,
            "ac_earned": 0.0,
            "bonus_awarded": False,
        }

    if last is not None and (today - last).days == 1:
        new_streak = int(state.streak_count or 0) + 1
    else:
        # First-ever check-in OR user skipped a day → restart at 1.
        new_streak = 1

    xp_gain = STREAK_DAILY_XP
    ac_gain = Decimal("0")
    bonus = False
    if new_streak >= STREAK_BONUS_DAYS:
        xp_gain += STREAK_BONUS_XP
        ac_gain += STREAK_BONUS_AC
        bonus = True
        new_streak = 0  # reset so the user can begin a fresh 7-day cycle tomorrow

    state.streak_count = new_streak
    state.last_streak_date = today
    state.xp = int(state.xp or 0) + xp_gain
    state.ac_balance = Decimal(str(state.ac_balance or 0)) + ac_gain
    state.last_updated = datetime.now(timezone.utc)

    db.add(RewardsTransaction(
        user_id=user_id, type="streak_check_in",
        xp_delta=xp_gain, ac_delta=ac_gain,
        source=f"streak_day_{new_streak if new_streak else STREAK_BONUS_DAYS}",
    ))
    return {
        "streak_count": new_streak,
        "checked_in_today": True,
        "xp_earned": xp_gain,
        "ac_earned": float(ac_gain),
        "bonus_awarded": bonus,
        "new_xp": int(state.xp),
        "new_ac_balance": float(state.ac_balance),
    }


# ─────────────────────────────────────────────────────────────────────
# Core ledger helper — every XP/AC/PS mutation funnels through this so
# RewardsTransaction stays a complete audit trail.
# ─────────────────────────────────────────────────────────────────────

async def _award(
    db: AsyncSession,
    user_id,
    *,
    xp: int = 0,
    ac: Decimal = Decimal("0"),
    ps: int = 0,
    type: str,
    source: str,
    reference_id=None,
) -> None:
    """Add XP/AC/PS to a user's state and write a RewardsTransaction row.
    Caller is responsible for db.commit() — typically batched with the
    underlying event (trade close, signup, etc.)."""
    if xp <= 0 and ac <= 0 and ps <= 0:
        return
    state_q = await db.execute(
        select(RewardsUserState).where(RewardsUserState.user_id == user_id).with_for_update()
    )
    state = state_q.scalar_one_or_none()
    if state is None:
        state = RewardsUserState(user_id=user_id)
        db.add(state)
        await db.flush()
    if xp:
        state.xp = int(state.xp or 0) + int(xp)
    if ac:
        state.ac_balance = Decimal(str(state.ac_balance or 0)) + Decimal(str(ac))
    if ps:
        state.ps = int(state.ps or 0) + int(ps)
    state.last_updated = datetime.now(timezone.utc)

    db.add(RewardsTransaction(
        user_id=user_id, type=type,
        xp_delta=int(xp), ac_delta=Decimal(str(ac)),
        source=source, reference_id=reference_id,
    ))


# ─────────────────────────────────────────────────────────────────────
# Trading-volume rewards (XP_Reward_mechanism slide 3)
# Per $1,000 traded → 10 XP, 5 AC, 1000 PS for the trader themselves.
# Then the same notional flows through the 10-level referral chain.
# ─────────────────────────────────────────────────────────────────────

XP_PER_1K_USD = 10
AC_PER_1K_USD = Decimal("5")
PS_PER_1K_USD = 1000

# Slide 5 / table 1: 10-level XP/AC/PS distribution from downline trades.
# Indexed L1..L10 → fraction of the trader's earned XP/AC/PS the upline
# receives. Numbers add up to 100% so the whole pool is distributed.
REFERRAL_LEVEL_PCT = [
    Decimal("0.35"),  # L1
    Decimal("0.15"),  # L2
    Decimal("0.10"),  # L3
    Decimal("0.10"),  # L4
    Decimal("0.05"),  # L5
    Decimal("0.05"),  # L6
    Decimal("0.05"),  # L7
    Decimal("0.05"),  # L8
    Decimal("0.05"),  # L9
    Decimal("0.05"),  # L10
]

# Slide 18 / table 4: XP-tier-gated referral depth. A referrer's own XP
# decides how deep into their downline they can earn from.
def _referral_depth_cap_for_xp(xp: int) -> int:
    if xp >= 7000:  return 10  # Elite
    if xp >= 3000:  return 8   # Pro
    if xp >= 1000:  return 6   # Skilled
    if xp >= 300:   return 4   # Active
    return 2                    # Starter


async def award_trading_volume_rewards(
    db: AsyncSession,
    user_id,
    notional_usd: Decimal,
    *,
    reference_id=None,
) -> None:
    """Credit the trader for their trade volume + walk the referral chain
    crediting their uplines. Idempotent only via call-site discipline:
    intended to fire exactly once per trade close."""
    if notional_usd <= 0:
        return
    # The trader's own slice.
    blocks = (notional_usd / Decimal("1000"))
    own_xp = int(blocks * XP_PER_1K_USD)
    own_ac = (blocks * AC_PER_1K_USD).quantize(Decimal("0.01"))
    own_ps = int(blocks * PS_PER_1K_USD)
    if own_xp <= 0 and own_ac <= 0 and own_ps <= 0:
        return
    await _award(
        db, user_id,
        xp=own_xp, ac=own_ac, ps=own_ps,
        type="trade_volume",
        source="trade_close",
        reference_id=reference_id,
    )
    # Walk uplines.
    await _distribute_to_referral_chain(
        db,
        leaf_user_id=user_id,
        base_xp=own_xp,
        base_ac=own_ac,
        base_ps=own_ps,
        type_prefix="referral_trade",
        source="trade_close",
        reference_id=reference_id,
    )


async def _distribute_to_referral_chain(
    db: AsyncSession,
    *,
    leaf_user_id,
    base_xp: int,
    base_ac: Decimal,
    base_ps: int,
    type_prefix: str,
    source: str,
    reference_id=None,
) -> None:
    """Walk up the Referral chain from leaf_user_id (the actor whose
    activity is being distributed). For each ancestor, award them
    base × REFERRAL_LEVEL_PCT[level] *if* their own XP tier covers this
    depth (XP-tier-gated referral depth)."""
    current = leaf_user_id
    visited: set = set()  # cycle guard — referral table is user-modifiable
    for level_idx in range(10):
        # Find the user who referred `current`.
        row = (await db.execute(
            select(Referral).where(Referral.referred_id == current).limit(1)
        )).scalar_one_or_none()
        if row is None:
            break
        ancestor_id = row.referrer_id
        if ancestor_id in visited or ancestor_id == leaf_user_id:
            break
        visited.add(ancestor_id)

        # Look up the ancestor's XP to apply the depth cap.
        anc_xp = (await db.execute(
            select(RewardsUserState.xp).where(RewardsUserState.user_id == ancestor_id)
        )).scalar_one_or_none()
        cap = _referral_depth_cap_for_xp(int(anc_xp or 0))
        if (level_idx + 1) > cap:
            # Ancestor isn't qualified to earn at this depth — skip them but
            # keep walking, since L+1 ancestors at deeper depth still get
            # nothing (their cap is no looser than this one's).
            current = ancestor_id
            continue

        share = REFERRAL_LEVEL_PCT[level_idx]
        anc_xp_award = int(Decimal(base_xp) * share)
        anc_ac_award = (Decimal(base_ac) * share).quantize(Decimal("0.01"))
        anc_ps_award = int(Decimal(base_ps) * share)
        await _award(
            db, ancestor_id,
            xp=anc_xp_award, ac=anc_ac_award, ps=anc_ps_award,
            type=f"{type_prefix}_l{level_idx + 1}",
            source=source,
            reference_id=reference_id,
        )
        current = ancestor_id


# ─────────────────────────────────────────────────────────────────────
# Signup referral bonus (XP_Reward_mechanism slide 4)
# Direct + flat: when a referred user signs up, the IB referrer gets a
# one-time +30 XP / +20 AC / +500 PS — same shape as the daily
# refer_friend mission so it's not double-paying the IB.
# ─────────────────────────────────────────────────────────────────────

SIGNUP_REFERRAL_XP = 30
SIGNUP_REFERRAL_AC = Decimal("20")
SIGNUP_REFERRAL_PS = 500


async def award_signup_referral_bonus(
    db: AsyncSession,
    referrer_user_id,
    referred_user_id,
) -> None:
    """Credit the IB referrer when a downline signs up. Caller commits."""
    await _award(
        db, referrer_user_id,
        xp=SIGNUP_REFERRAL_XP,
        ac=SIGNUP_REFERRAL_AC,
        ps=SIGNUP_REFERRAL_PS,
        type="referral_signup",
        source="signup",
        reference_id=referred_user_id,
    )


# ─────────────────────────────────────────────────────────────────────
# Missions
# ─────────────────────────────────────────────────────────────────────

_VALID_PERIODS = ("daily", "weekly", "bonus", "flash", "achievement")


async def list_missions(db: AsyncSession, user_id, period: str) -> list[dict]:
    if period not in _VALID_PERIODS:
        raise HTTPException(status_code=400, detail="invalid_period")
    now = datetime.now(timezone.utc)
    pkey = _period_key(period, now)
    stmt = (
        select(RewardsMission)
        .where(RewardsMission.is_active.is_(True), RewardsMission.period == period)
    )
    # Flash missions auto-hide once expires_at is past. Other periods ignore expiry.
    if period == "flash":
        stmt = stmt.where(or_(RewardsMission.expires_at.is_(None), RewardsMission.expires_at > now))
    # Daily missions can be tagged with streak_day (1..7) per the
    # Repeatable_task.docx 7-day cycle. Show only the missions matching the
    # user's current streak day, plus all day-agnostic ones (streak_day NULL).
    if period == "daily":
        state = (await db.execute(
            select(RewardsUserState).where(RewardsUserState.user_id == user_id)
        )).scalar_one_or_none()
        # Map streak_count → today's day-of-cycle:
        #   0 (fresh / just-reset) → 1
        #   1..7 → as-is
        sc = int(state.streak_count or 0) if state else 0
        current_day = sc if sc >= 1 else 1
        stmt = stmt.where(or_(
            RewardsMission.streak_day.is_(None),
            RewardsMission.streak_day == current_day,
        ))
    stmt = stmt.order_by(RewardsMission.display_order, RewardsMission.title)
    missions = (await db.execute(stmt)).scalars().all()
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
            "expires_at": m.expires_at.isoformat() if m.expires_at else None,
            "streak_day": int(m.streak_day) if m.streak_day is not None else None,
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

    # Lifestyle rewards (smartphone, Dubai trip, etc.) are PS-gated. The PS
    # threshold is stored on the item's payload so admins can re-balance the
    # ladder without a code change.
    payload = dict(item.payload or {})
    fulfillment_kind = "instant"
    if (item.category or "").lower() == "lifestyle":
        min_ps = int(payload.get("min_ps") or 0)
        if int(state.ps or 0) < min_ps:
            raise HTTPException(status_code=403, detail="insufficient_ps")
        fulfillment_kind = str(payload.get("fulfillment") or "manual")

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
        "fulfillment": fulfillment_kind,
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
