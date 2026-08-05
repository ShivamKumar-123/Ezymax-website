"""Admin waitlist service — review invite requests, approve/reject.

On approval we mark the request approved and email the applicant a welcome
message with links to the register + login pages (they create their own
account on the trader app). Mirrors the KYC review flow (kyc_service.py).
"""
import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import WaitlistRequest
from dependencies import write_audit_log


async def _list_by_status(status: str, page: int, per_page: int, db: AsyncSession) -> dict:
    query = select(WaitlistRequest).where(WaitlistRequest.status == status)
    total = (await db.execute(
        select(func.count()).select_from(query.subquery())
    )).scalar() or 0

    query = query.order_by(WaitlistRequest.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(query)).scalars().all()

    items = [
        {
            "id": str(r.id),
            "full_name": r.full_name,
            "email": r.email,
            "phone": r.phone,
            "status": r.status,
            "rejection_reason": r.rejection_reason,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    return {"items": items, "total": total, "page": page, "per_page": per_page}


async def list_pending(page: int, per_page: int, db: AsyncSession) -> dict:
    return await _list_by_status("pending", page, per_page, db)


async def list_approved(page: int, per_page: int, db: AsyncSession) -> dict:
    return await _list_by_status("approved", page, per_page, db)


async def list_rejected(page: int, per_page: int, db: AsyncSession) -> dict:
    return await _list_by_status("rejected", page, per_page, db)


async def approve_request(
    request_id: uuid.UUID,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    row = (await db.execute(
        select(WaitlistRequest).where(WaitlistRequest.id == request_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Waitlist request not found")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    row.status = "approved"
    row.reviewed_by = admin_id
    row.reviewed_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "approve_waitlist", "waitlist", request_id,
        new_values={"email": row.email, "status": "approved"},
        ip_address=ip_address,
    )
    await db.commit()

    # Welcome email with register + login links.
    try:
        from packages.common.src.smtp_mail import send_email, smtp_configured, fire_and_forget
        from packages.common.src.email_templates import render_waitlist_approved
        from packages.common.src.config import get_settings
        if smtp_configured() and row.email:
            settings = get_settings()
            subject, html, text = render_waitlist_approved(
                full_name=row.full_name,
                email=row.email,
                trader_app_url=getattr(settings, "TRADER_APP_URL", "https://trade.fxartha.com"),
            )
            fire_and_forget(send_email(row.email, subject, html, text=text))
    except Exception:
        pass

    return {"message": "Waitlist request approved"}


async def reject_request(
    request_id: uuid.UUID,
    reason: str,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    row = (await db.execute(
        select(WaitlistRequest).where(WaitlistRequest.id == request_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Waitlist request not found")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    row.status = "rejected"
    row.reviewed_by = admin_id
    row.reviewed_at = datetime.utcnow()
    row.rejection_reason = reason

    await write_audit_log(
        db, admin_id, "reject_waitlist", "waitlist", request_id,
        new_values={"status": "rejected", "reason": reason},
        ip_address=ip_address,
    )
    await db.commit()

    try:
        from packages.common.src.smtp_mail import send_email, smtp_configured, fire_and_forget
        from packages.common.src.email_templates import render_waitlist_rejected
        if smtp_configured() and row.email:
            subject, html, text = render_waitlist_rejected(full_name=row.full_name, reason=reason)
            fire_and_forget(send_email(row.email, subject, html, text=text))
    except Exception:
        pass

    return {"message": "Waitlist request rejected"}
