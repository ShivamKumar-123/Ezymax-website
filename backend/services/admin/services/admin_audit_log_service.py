"""Admin Audit Log Service — paginated listing of admin-side actions.

This reads the `audit_logs` table populated by `write_audit_log` from
admin code paths (bonus changes, user impersonation, fund grants, etc.).
For trader-side activity (login, logout, order placement) see
`user_audit_log_service` which reads `user_audit_logs`.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import AuditLog, User
from packages.common.src.admin_schemas import PaginatedResponse, AdminAuditLogOut

_log = logging.getLogger("uvicorn.error")


def _apply_filters(
    stmt,
    *,
    admin_id: uuid.UUID | None,
    action: str | None,
    entity_type: str | None,
    date_from: date | None,
    date_to: date | None,
):
    if admin_id:
        stmt = stmt.where(AuditLog.admin_id == admin_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if date_from:
        stmt = stmt.where(AuditLog.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        stmt = stmt.where(AuditLog.created_at <= datetime.combine(date_to, time.max, tzinfo=timezone.utc))
    return stmt


async def list_admin_audit_logs(
    page: int,
    per_page: int,
    admin_id: uuid.UUID | None,
    action: str | None,
    entity_type: str | None,
    date_from: date | None,
    date_to: date | None,
    db: AsyncSession,
) -> PaginatedResponse:
    base = select(AuditLog, User).join(User, AuditLog.admin_id == User.id, isouter=True)
    base = _apply_filters(
        base, admin_id=admin_id, action=action, entity_type=entity_type,
        date_from=date_from, date_to=date_to,
    )

    count_q = select(func.count()).select_from(
        _apply_filters(
            select(AuditLog), admin_id=admin_id, action=action, entity_type=entity_type,
            date_from=date_from, date_to=date_to,
        ).subquery()
    )
    total = (await db.execute(count_q)).scalar() or 0

    base = base.order_by(AuditLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(base)).all()

    items = [
        AdminAuditLogOut(
            id=str(log.id),
            admin_id=str(log.admin_id) if log.admin_id else None,
            admin_email=(u.email if u else None),
            admin_name=(
                f"{(u.first_name or '').strip()} {(u.last_name or '').strip()}".strip() or None
                if u else None
            ),
            action=log.action,
            entity_type=log.entity_type,
            entity_id=str(log.entity_id) if log.entity_id else None,
            old_values=log.old_values,
            new_values=log.new_values,
            ip_address=str(log.ip_address) if log.ip_address else None,
            created_at=log.created_at,
        )
        for log, u in rows
    ]

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def list_distinct_actions(db: AsyncSession) -> list[str]:
    """Distinct action strings seen in the audit log — used to populate
    the filter dropdown on the admin browser so admins don't have to
    guess action names."""
    rows = (await db.execute(
        select(AuditLog.action).distinct().order_by(AuditLog.action)
    )).all()
    return [r[0] for r in rows if r[0]]
