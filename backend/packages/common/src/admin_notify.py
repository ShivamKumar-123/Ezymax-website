"""Admin alert inbox helper — DB row + Redis fan-out.

Any suspicious-activity detector calls ``admin_notify()`` to raise an
alert for the admin team. It inserts an ``admin_notifications`` row
(deduped on ``dedup_key`` so a recurring signal doesn't spam the bell)
and publishes to the ``admin:alerts`` Redis channel for live push.

Best-effort and self-contained: opens its own session, never raises
into the caller. A detector loop must never die because the alert
write hiccuped.
"""
import json
import logging
from typing import Any, Optional

from sqlalchemy import text

from .database import AsyncSessionLocal
from .redis_client import redis_client

logger = logging.getLogger("admin_notify")


async def admin_notify(
    *,
    category: str,
    title: str,
    body: str = "",
    severity: str = "medium",
    meta: Optional[dict[str, Any]] = None,
    action_url: Optional[str] = None,
    dedup_key: Optional[str] = None,
) -> bool:
    """Insert an admin notification (deduped) and publish to Redis.

    Returns True if a NEW row was inserted (i.e. the alert is fresh and
    worth a live toast), False if it was a dedup no-op or failed.
    """
    inserted = False
    try:
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                text(
                    """
                    INSERT INTO admin_notifications
                        (id, category, severity, title, body, meta, action_url, dedup_key, is_read, created_at)
                    VALUES
                        (gen_random_uuid(), :category, :severity, :title, :body,
                         CAST(:meta AS jsonb), :action_url, :dedup_key, false, now())
                    ON CONFLICT (dedup_key) DO NOTHING
                    RETURNING id
                    """
                ),
                {
                    "category": category, "severity": severity, "title": title,
                    "body": body, "meta": json.dumps(meta or {}),
                    "action_url": action_url, "dedup_key": dedup_key,
                },
            )
            row = res.first()
            await db.commit()
            inserted = row is not None
    except Exception as exc:
        logger.warning("admin_notify insert failed (%s): %s", category, exc)
        return False

    # Live push — best-effort. Only publish on a genuinely new alert so
    # we don't re-toast a deduped repeat.
    if inserted:
        try:
            await redis_client.publish("admin:alerts", json.dumps({
                "type": "admin_notification",
                "category": category,
                "severity": severity,
                "title": title,
                "body": body,
                "action_url": action_url,
            }))
        except Exception:
            pass
    return inserted
