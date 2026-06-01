"""Notifications API — List, Mark Read, Unread Count."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.cache import cache_get, cache_invalidate, cache_set
from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from ..services import notification_service

router = APIRouter()

# /unread-count is polled every 2-5s from the top-nav bell. 15s of
# staleness is fine UX — new notifications surface within one poll
# cycle while DB load drops by ~10x.
_UNREAD_COUNT_TTL = 15


@router.get("/")
async def list_notifications(
    unread_only: bool = False,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await notification_service.list_notifications(
        user_id=current_user["user_id"], unread_only=unread_only,
        page=page, per_page=per_page, db=db,
    )


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["user_id"]
    result = await notification_service.mark_as_read(
        user_id=user_id, notification_id=notification_id, db=db,
    )
    # Make the bell badge respond immediately rather than waiting out
    # the 15s TTL on the cached count.
    await cache_invalidate("notif_unread", str(user_id))
    return result


@router.put("/read-all")
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["user_id"]
    result = await notification_service.mark_all_read(user_id=user_id, db=db)
    await cache_invalidate("notif_unread", str(user_id))
    return result


@router.get("/unread-count")
async def unread_count(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["user_id"]
    cached = await cache_get("notif_unread", str(user_id))
    if cached is not None:
        return cached
    result = await notification_service.unread_count(user_id=user_id, db=db)
    await cache_set("notif_unread", str(user_id), result, ttl_seconds=_UNREAD_COUNT_TTL)
    return result
