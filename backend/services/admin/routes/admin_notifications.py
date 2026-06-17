"""Admin alert inbox — the topbar notification bell.

A shared team queue of suspicious-activity alerts (shared-IP collisions,
coordinated trading, …) raised by the gateway RMS detectors. Any
authenticated admin can read it; marking read is a team-wide ack.

Reads only need a valid admin session (get_current_admin) so every role
sees the bell. Mark-read is a mutation, so demo_admin is blocked by the
read-only middleware automatically.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError, DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import get_current_admin
from packages.common.src.database import get_db
from packages.common.src.models import User

router = APIRouter(prefix="/notifications", tags=["Admin Notifications"])


def _missing(exc: BaseException) -> bool:
    msg = f"{getattr(exc, 'orig', None) or exc}".lower()
    return "admin_notifications" in msg and ("does not exist" in msg or "undefinedtable" in msg)


@router.get("/unread-count")
async def unread_count(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        n = (await db.execute(text(
            "SELECT count(*) FROM admin_notifications WHERE is_read = false"
        ))).scalar() or 0
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        if _missing(exc):
            return {"unread": 0}
        raise
    return {"unread": int(n)}


@router.get("/feed")
async def feed(
    limit: int = Query(30, ge=1, le=100),
    unread_only: bool = Query(False),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    where = "WHERE is_read = false" if unread_only else ""
    try:
        rows = (await db.execute(text(
            f"""
            SELECT id, category, severity, title, body, meta, action_url, is_read, created_at
            FROM admin_notifications
            {where}
            ORDER BY created_at DESC
            LIMIT :limit
            """
        ), {"limit": limit})).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        if _missing(exc):
            return {"items": []}
        raise
    items = [
        {
            "id": str(m["id"]),
            "category": m["category"],
            "severity": m["severity"],
            "title": m["title"],
            "body": m["body"],
            "meta": m["meta"],
            "action_url": m["action_url"],
            "is_read": bool(m["is_read"]),
            "created_at": m["created_at"].isoformat() if m["created_at"] else None,
        }
        for m in (r._mapping for r in rows)
    ]
    return {"items": items}


@router.post("/{notif_id}/read")
async def mark_read(
    notif_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(text(
        "UPDATE admin_notifications SET is_read = true, read_by = :by, read_at = :now "
        "WHERE id = :id AND is_read = false"
    ), {"by": admin.id, "now": datetime.now(timezone.utc), "id": notif_id})
    await db.commit()
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(text(
        "UPDATE admin_notifications SET is_read = true, read_by = :by, read_at = :now "
        "WHERE is_read = false"
    ), {"by": admin.id, "now": datetime.now(timezone.utc)})
    await db.commit()
    return {"ok": True, "marked": res.rowcount or 0}
