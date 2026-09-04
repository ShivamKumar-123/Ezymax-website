"""Admin editor for reward tasks (missions).

``rewards_missions`` is the shared task catalogue behind the trader's Rewards →
Tasks screen: daily / weekly / bonus / flash / achievement entries, each with a
target count and a payout (``xp_reward`` XP and ``ac_reward`` FXA coins).

Until now those rows could only be changed with SQL, so a task's wording or its
daily earning could not be tuned from the admin panel. This exposes list / edit
/ create / delete over the same model the gateway reads, so a change here is
picked up by the next listing a user loads — no deploy needed.

Editing a task changes what future completions pay; it never touches coins that
were already credited (those live in ``rewards_transactions``).
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import get_current_admin
from packages.common.src.database import get_db
from packages.common.src.models import RewardsMission, RewardsUserMissionProgress, User

router = APIRouter(prefix="/rewards-tasks", tags=["Admin · Rewards Tasks"])

# Mirrors the values the gateway's rewards_service filters on.
PERIODS = {"daily", "weekly", "bonus", "flash", "achievement"}


def _row(m: RewardsMission) -> dict:
    return {
        "id": str(m.id),
        "slug": m.slug,
        "period": m.period,
        "title": m.title,
        "description": m.description,
        "action_kind": m.action_kind,
        "target_count": int(m.target_count or 0),
        "xp_reward": int(m.xp_reward or 0),
        # ac_reward is the FXA payout — named "ac" in the schema from before the
        # coin was rebranded to FXA.
        "fxa_reward": float(m.ac_reward) if m.ac_reward is not None else 0.0,
        "is_active": bool(m.is_active),
        "display_order": int(m.display_order or 0),
        "streak_day": int(m.streak_day) if m.streak_day is not None else None,
        "starts_at": m.starts_at.isoformat() if m.starts_at else None,
        "expires_at": m.expires_at.isoformat() if m.expires_at else None,
    }


@router.get("")
async def list_tasks(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    period: Optional[str] = Query(None, description="daily | weekly | bonus | flash | achievement"),
    search: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
) -> dict:
    """The whole catalogue, newest-ordered by period then display_order."""
    q = select(RewardsMission)
    if period:
        if period not in PERIODS:
            raise HTTPException(status_code=400, detail=f"Unknown period '{period}'")
        q = q.where(RewardsMission.period == period)
    if active is not None:
        q = q.where(RewardsMission.is_active.is_(active))
    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        q = q.where(or_(
            func.lower(RewardsMission.title).like(s),
            func.lower(RewardsMission.slug).like(s),
            func.lower(RewardsMission.description).like(s),
        ))
    q = q.order_by(RewardsMission.period, RewardsMission.display_order, RewardsMission.title)
    rows = (await db.execute(q)).scalars().all()
    return {"items": [_row(m) for m in rows], "total": len(rows), "periods": sorted(PERIODS)}


class TaskPayload(BaseModel):
    """Every field optional on update; create validates the required ones."""
    slug: Optional[str] = None
    period: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    action_kind: Optional[str] = None
    target_count: Optional[int] = None
    xp_reward: Optional[int] = None
    fxa_reward: Optional[float] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    streak_day: Optional[int] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


def _apply(m: RewardsMission, req: TaskPayload) -> None:
    """Copy the provided fields onto the row, validating as we go."""
    if req.period is not None:
        if req.period not in PERIODS:
            raise HTTPException(status_code=400, detail=f"Unknown period '{req.period}'")
        m.period = req.period
    if req.title is not None:
        if not req.title.strip():
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        m.title = req.title.strip()[:120]
    if req.description is not None:
        m.description = req.description.strip()
    if req.action_kind is not None:
        if not req.action_kind.strip():
            raise HTTPException(status_code=400, detail="Action kind cannot be empty")
        m.action_kind = req.action_kind.strip()[:40]
    if req.target_count is not None:
        if req.target_count < 1:
            raise HTTPException(status_code=400, detail="Target count must be at least 1")
        m.target_count = int(req.target_count)
    if req.xp_reward is not None:
        if req.xp_reward < 0:
            raise HTTPException(status_code=400, detail="XP reward cannot be negative")
        m.xp_reward = int(req.xp_reward)
    if req.fxa_reward is not None:
        if req.fxa_reward < 0:
            raise HTTPException(status_code=400, detail="FXA reward cannot be negative")
        m.ac_reward = Decimal(str(req.fxa_reward)).quantize(Decimal("0.01"))
    if req.is_active is not None:
        m.is_active = bool(req.is_active)
    if req.display_order is not None:
        m.display_order = int(req.display_order)
    if req.streak_day is not None:
        # 0 / null both mean "show every day"; the listing filter treats NULL
        # as unrestricted, so normalise 0 to NULL rather than storing it.
        if req.streak_day and not 1 <= req.streak_day <= 7:
            raise HTTPException(status_code=400, detail="Streak day must be 1-7 (or empty)")
        m.streak_day = int(req.streak_day) or None
    if req.starts_at is not None:
        m.starts_at = req.starts_at
    if req.expires_at is not None:
        m.expires_at = req.expires_at
    if m.starts_at and m.expires_at and m.expires_at <= m.starts_at:
        raise HTTPException(status_code=400, detail="Expiry must be after the start time")


@router.put("/{task_id}")
async def update_task(
    task_id: UUID,
    req: TaskPayload,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    m = (await db.execute(
        select(RewardsMission).where(RewardsMission.id == task_id).with_for_update()
    )).scalar_one_or_none()
    if m is None:
        raise HTTPException(status_code=404, detail="Task not found")
    # Slug is the stable key the seeder and any hard-coded hooks match on, so
    # it is deliberately NOT editable here.
    _apply(m, req)
    await db.commit()
    await db.refresh(m)
    return {"ok": True, "task": _row(m)}


@router.post("")
async def create_task(
    req: TaskPayload,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    missing = [f for f in ("slug", "period", "title", "action_kind") if not getattr(req, f)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required field(s): {', '.join(missing)}")
    slug = req.slug.strip().lower()[:60]
    clash = (await db.execute(select(RewardsMission).where(RewardsMission.slug == slug))).scalar_one_or_none()
    if clash is not None:
        raise HTTPException(status_code=409, detail=f"A task with slug '{slug}' already exists")

    m = RewardsMission(
        slug=slug,
        period=req.period,
        title=(req.title or "").strip()[:120],
        description=(req.description or "").strip(),
        action_kind=(req.action_kind or "").strip()[:40],
        target_count=1,
        xp_reward=0,
        ac_reward=Decimal("0"),
        is_active=True if req.is_active is None else bool(req.is_active),
        display_order=0,
    )
    _apply(m, req)
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return {"ok": True, "task": _row(m)}


@router.delete("/{task_id}")
async def delete_task(
    task_id: UUID,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    force: bool = Query(False, description="Delete even though users have progress on it"),
) -> dict:
    """Delete a task. Refuses by default when users already have progress on it
    — deactivating (is_active=false) hides it from the app without destroying
    that history. `force=true` cascades the progress rows away."""
    m = (await db.execute(select(RewardsMission).where(RewardsMission.id == task_id))).scalar_one_or_none()
    if m is None:
        raise HTTPException(status_code=404, detail="Task not found")

    used = (await db.execute(
        select(func.count()).select_from(RewardsUserMissionProgress)
        .where(RewardsUserMissionProgress.mission_id == task_id)
    )).scalar() or 0
    if used and not force:
        raise HTTPException(
            status_code=409,
            detail=(
                f"{used} user(s) have progress on this task. Deactivate it instead, "
                "or re-send with force=true to delete that progress too."
            ),
        )

    await db.delete(m)
    await db.commit()
    return {"ok": True, "deleted": str(task_id), "progress_rows_removed": int(used)}
