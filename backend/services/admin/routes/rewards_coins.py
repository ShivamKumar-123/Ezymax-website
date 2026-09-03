"""Admin editor for user reward-coin balances (FXA / XP / PS).

A dedicated page to view EVERY user's FXA coin balance (FXA = ``ac_balance`` in
``rewards_user_state``) alongside XP and PS, and edit any of them. Each change is
written to ``rewards_transactions`` (type='adjust', source='admin_edit:<admin>')
so a manual edit is auditable and consistent with how coins are normally credited.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import get_current_admin
from packages.common.src.database import get_db
from packages.common.src.models import RewardsTransaction, RewardsUserState, User

router = APIRouter(prefix="/rewards-coins", tags=["Admin · Rewards Coins"])


def _row(u: User, st: Optional[RewardsUserState]) -> dict:
    name = " ".join(p for p in [u.first_name, u.last_name] if p).strip() or (u.email or "")
    return {
        "user_id": str(u.id),
        "name": name,
        "email": u.email or "",
        "fxa": float(st.ac_balance) if st and st.ac_balance is not None else 0.0,
        "xp": int(st.xp) if st else 0,
        "ps": int(st.ps) if st else 0,
    }


@router.get("")
async def list_user_coins(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
) -> dict:
    """Every user with their FXA / XP / PS, searchable by email or name."""
    base = select(User, RewardsUserState).join(
        RewardsUserState, RewardsUserState.user_id == User.id, isouter=True,
    )
    count_q = select(func.count(User.id))
    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        cond = or_(
            func.lower(User.email).like(s),
            func.lower(func.coalesce(User.first_name, "")).like(s),
            func.lower(func.coalesce(User.last_name, "")).like(s),
        )
        base = base.where(cond)
        count_q = count_q.where(cond)
    total = (await db.execute(count_q)).scalar() or 0
    base = base.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(base)).all()
    return {
        "items": [_row(u, st) for (u, st) in rows],
        "total": int(total),
        "page": page,
        "per_page": per_page,
    }


class UpdateCoinsRequest(BaseModel):
    fxa: Optional[float] = None   # absolute new FXA (ac_balance)
    xp: Optional[int] = None      # absolute new XP
    ps: Optional[int] = None      # absolute new PS


@router.put("/{user_id}")
async def update_user_coins(
    user_id: UUID,
    req: UpdateCoinsRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Set a user's FXA / XP / PS to absolute values. Missing state is created;
    the net change is logged to the rewards ledger."""
    if req.fxa is None and req.xp is None and req.ps is None:
        raise HTTPException(status_code=400, detail="Nothing to update")

    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")

    st = (await db.execute(
        select(RewardsUserState).where(RewardsUserState.user_id == user_id).with_for_update()
    )).scalar_one_or_none()
    if st is None:
        st = RewardsUserState(user_id=user_id)
        db.add(st)
        await db.flush()

    ac_delta = Decimal("0")
    if req.fxa is not None:
        new_ac = Decimal(str(req.fxa)).quantize(Decimal("0.01"))
        if new_ac < 0:
            raise HTTPException(status_code=400, detail="FXA cannot be negative")
        ac_delta = new_ac - Decimal(str(st.ac_balance or 0))
        st.ac_balance = new_ac

    xp_delta = 0
    if req.xp is not None:
        if req.xp < 0:
            raise HTTPException(status_code=400, detail="XP cannot be negative")
        xp_delta = int(req.xp) - int(st.xp or 0)
        st.xp = int(req.xp)

    if req.ps is not None:
        if req.ps < 0:
            raise HTTPException(status_code=400, detail="PS cannot be negative")
        st.ps = int(req.ps)

    st.last_updated = datetime.now(timezone.utc)

    if ac_delta != 0 or xp_delta != 0:
        db.add(RewardsTransaction(
            user_id=user_id, type="adjust",
            xp_delta=xp_delta, ac_delta=ac_delta,
            source=f"admin_edit:{admin.email or admin.id}"[:60],
        ))

    await db.commit()
    await db.refresh(st)
    return _row(u, st)
