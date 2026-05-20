"""Small SQLAlchemy helpers for the most-repeated query patterns.

These exist to cut noise — they don't add behaviour, just compress the
4-line "select(X).where(X.id == y).with_for_update() → scalar_one_or_none()"
ritual into one call. Migrate callsites opportunistically when you're
already in the file for another reason; there's no value in a sweep PR.
"""
from __future__ import annotations

from typing import Any, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


async def fetch_for_update(
    db: AsyncSession,
    model: type[T],
    *,
    skip_locked: bool = False,
    **filters: Any,
) -> T | None:
    """Lock + fetch a single row matching `filters` (or None).

    `with_for_update()` takes a Postgres row-level lock until the
    transaction commits, so concurrent writes to the same row queue up
    behind this one. Use whenever you're about to read-modify-write the
    same row inside a transaction.

    Examples:
        user = await fetch_for_update(db, User, id=user_id)
        position = await fetch_for_update(db, Position, id=pid, status="open")

    `skip_locked=True` skips rows already locked by other transactions
    instead of waiting — useful for worker queues that want to avoid
    pile-ups (e.g., the SL/TP engine reading positions in batches).
    """
    if not filters:
        raise ValueError("fetch_for_update requires at least one filter")

    stmt = select(model)
    for key, val in filters.items():
        stmt = stmt.where(getattr(model, key) == val)
    stmt = stmt.with_for_update(skip_locked=skip_locked).limit(1)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def fetch_by_id_for_update(
    db: AsyncSession,
    model: type[T],
    row_id: UUID | str | int,
    *,
    skip_locked: bool = False,
) -> T | None:
    """Convenience for the most common case: lock-by-primary-key.
    Equivalent to `fetch_for_update(db, model, id=row_id)`."""
    return await fetch_for_update(db, model, id=row_id, skip_locked=skip_locked)
