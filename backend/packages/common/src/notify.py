"""In-app notification helper — DB row + Redis pub/sub fan-out.

Pure in-app surface. Email delivery lives in `smtp_mail.py` + the
`email_templates/` package — keep them separate so a notification never
implicitly fires a transactional email and vice versa.
"""
import json
import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from .models import Notification
from .redis_client import redis_client

logger = logging.getLogger("notify")

TYPES = {
    "trade": "trade",
    "sl_hit": "trade",
    "tp_hit": "trade",
    "order": "trade",
    "deposit": "wallet",
    "withdrawal": "wallet",
    "admin_fund": "wallet",
    "login": "security",
    "system": "system",
}


async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    title: str,
    message: str,
    notif_type: str = "info",
    action_url: str | None = None,
    commit: bool = True,
):
    """Insert a Notification row and publish to Redis so any open WebSocket
    subscribed to `notifications:{user_id}` receives it. The `commit` flag
    lets the caller batch the insert with surrounding work — e.g. when a
    trade-close handler is mid-transaction we want the notification to
    land or roll back atomically with the position update."""
    n = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
        action_url=action_url,
    )
    db.add(n)
    if commit:
        await db.flush()

    try:
        await redis_client.publish(f"notifications:{user_id}", json.dumps({
            "type": "notification",
            "id": str(n.id),
            "title": title,
            "message": message,
            "notif_type": notif_type,
        }))
    except Exception:
        # Pub/sub is best-effort: a Redis blip must not roll back the
        # caller's transaction. The DB row is what survives — clients
        # reconcile on the next /notifications fetch.
        pass

    return n
