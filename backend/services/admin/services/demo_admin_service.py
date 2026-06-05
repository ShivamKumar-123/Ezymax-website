"""Super-admin tools for managing read-only `demo_admin` user accounts.

A `demo_admin` is a user with role='demo_admin' who can navigate the
admin panel but cannot mutate any data (enforced by require_permission
+ AdminReadOnlyMiddleware, see services/admin/dependencies.py +
services/admin/main.py).

These accounts are typically handed out for client demos, prospect
walkthroughs, or internal training. Each one is just a `users` row —
the same User model regular admins use — so deletion, password
rotation, and audit-log linkage all "just work" without a separate
schema.

Endpoint surface (super_admin only):
  * list_demo_admins(db)        — fetch all demo_admin rows
  * create_demo_admin(...)      — create or refresh one by email
  * delete_demo_admin(...)      — soft-disable (status='disabled') or
                                  hard-delete depending on the flag
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import hash_password
from packages.common.src.models import User
from dependencies import write_audit_log


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_DEMO_ROLE = "demo_admin"


def _require_super_admin(admin: User) -> None:
    if admin.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin can manage demo accounts.",
        )


def _row(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "status": u.status,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


async def list_demo_admins(*, admin: User, db: AsyncSession) -> dict:
    _require_super_admin(admin)
    rows = (await db.execute(
        select(User).where(User.role == _DEMO_ROLE).order_by(User.created_at.desc())
    )).scalars().all()
    return {"items": [_row(u) for u in rows]}


async def create_demo_admin(
    *,
    email: str,
    password: str,
    first_name: Optional[str],
    last_name: Optional[str],
    admin: User,
    ip_address: Optional[str],
    db: AsyncSession,
) -> dict:
    """Create or refresh a demo_admin by email.

    If `email` already exists as a demo_admin, the password is updated
    and the row is re-activated. If it exists as a different role, we
    refuse — re-using a regular trader's account for demo viewing
    would let them browse internal data they shouldn't see.
    """
    _require_super_admin(admin)
    email_norm = (email or "").strip().lower()
    if not _EMAIL_RE.match(email_norm):
        raise HTTPException(status_code=400, detail="Invalid email")
    if not password or len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters",
        )

    existing = (await db.execute(
        select(User).where(User.email == email_norm)
    )).scalar_one_or_none()

    if existing and existing.role != _DEMO_ROLE:
        raise HTTPException(
            status_code=409,
            detail=(
                "An account with this email already exists with a different "
                "role. Use a fresh email for demo access."
            ),
        )

    pwd_hash = hash_password(password)
    if existing:
        existing.password_hash = pwd_hash
        existing.first_name = (first_name or "Demo").strip() or "Demo"
        existing.last_name = (last_name or "Viewer").strip() or "Viewer"
        existing.status = "active"
        existing.updated_at = datetime.now(timezone.utc)
        target = existing
        action = "demo_admin.refresh"
    else:
        target = User(
            email=email_norm,
            password_hash=pwd_hash,
            first_name=(first_name or "Demo").strip() or "Demo",
            last_name=(last_name or "Viewer").strip() or "Viewer",
            role=_DEMO_ROLE,
            status="active",
            kyc_status="approved",   # bypass KYC gates — they aren't trading
        )
        db.add(target)
        await db.flush()
        action = "demo_admin.create"

    await write_audit_log(
        db, admin.id, action, "user", target.id,
        new_values={"email": email_norm, "role": _DEMO_ROLE},
        ip_address=ip_address,
    )
    await db.commit()
    return _row(target)


async def delete_demo_admin(
    *,
    demo_admin_id: uuid.UUID,
    hard: bool,
    admin: User,
    ip_address: Optional[str],
    db: AsyncSession,
) -> dict:
    """Disable (default) or hard-delete a demo_admin row.

    Soft-disable flips status to 'disabled' — the row stays for audit
    purposes and can be re-enabled by re-creating with the same email.
    Hard delete removes the row entirely; only allow when there's no
    audit history pinned to this user.
    """
    _require_super_admin(admin)
    target = (await db.execute(
        select(User).where(User.id == demo_admin_id, User.role == _DEMO_ROLE)
    )).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Demo admin not found")

    if hard:
        await db.delete(target)
        action = "demo_admin.delete"
    else:
        target.status = "disabled"
        target.updated_at = datetime.now(timezone.utc)
        action = "demo_admin.disable"

    await write_audit_log(
        db, admin.id, action, "user", target.id,
        new_values={"email": target.email, "hard": hard},
        ip_address=ip_address,
    )
    await db.commit()
    return {"id": str(demo_admin_id), "deleted": hard, "status": "disabled" if not hard else "deleted"}
