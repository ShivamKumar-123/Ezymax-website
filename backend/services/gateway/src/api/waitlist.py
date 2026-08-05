"""Public waitlist API — invite-only access requests from the landing site.

A visitor submits (full name, email, phone). We store a `WaitlistRequest`
row in `pending`; an admin later approves/rejects it from the admin panel.
No account or password is created here — that happens on admin approval.
"""
import logging

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import WaitlistRequest, User

logger = logging.getLogger("waitlist_api")

router = APIRouter()


class WaitlistJoinRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=20)


@router.post("/", status_code=201)
async def join_waitlist(
    req: WaitlistJoinRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Public: submit a waitlist request. Idempotent per email — resubmitting
    an email that's already pending/approved returns its current status rather
    than creating a duplicate row."""
    # 5 submissions per IP per 10 min — well above organic, stops spam.
    from ..services.auth_service import rate_limit_http
    rate_limit_http(request, "waitlist_join", 5, 600.0)

    email = req.email.lower().strip()

    # Already a full account? Tell them to just log in.
    existing_user = (
        await db.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if existing_user is not None:
        return {"status": "approved", "message": "An account already exists for this email."}

    # Existing waitlist row (most recent) — don't duplicate.
    existing = (
        await db.execute(
            select(WaitlistRequest)
            .where(WaitlistRequest.email == email)
            .order_by(WaitlistRequest.created_at.desc())
        )
    ).scalars().first()

    if existing is not None and existing.status in ("pending", "approved"):
        return {"status": existing.status, "message": "You're already on the waitlist."}

    row = WaitlistRequest(
        full_name=req.full_name.strip(),
        email=email,
        phone=(req.phone or "").strip() or None,
        status="pending",
    )
    db.add(row)
    await db.commit()
    return {"status": "pending", "message": "You've been added to the waitlist."}


@router.get("/status")
async def waitlist_status(
    email: EmailStr = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Public: current status for an email so the landing can gate its UI.
    Returns one of: none | pending | approved | rejected. An existing full
    account counts as `approved` (they can log in)."""
    addr = str(email).lower().strip()

    existing_user = (
        await db.execute(select(User).where(User.email == addr))
    ).scalar_one_or_none()
    if existing_user is not None:
        return {"status": "approved"}

    row = (
        await db.execute(
            select(WaitlistRequest)
            .where(WaitlistRequest.email == addr)
            .order_by(WaitlistRequest.created_at.desc())
        )
    ).scalars().first()

    return {"status": row.status if row is not None else "none"}
