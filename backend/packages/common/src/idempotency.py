"""Idempotency-Key helper for mutating endpoints.

Pattern: an authenticated client passes a unique `Idempotency-Key`
header on POST /wallet/deposit / POST /wallet/withdraw / POST /orders.
We hash (user_id || header) and look it up against a unique row in
`idempotency_keys`. First call stores the cached response body+status;
any retry of the same key returns that exact same response from cache,
so a network-blip retry never creates a second deposit / withdrawal /
order.

Pattern intentionally lives outside FastAPI middleware — call it
explicitly from each handler so the cached body is exactly the
response shape that handler returns. Middleware-level interception
makes it easy to cache a serialised pydantic model that doesn't quite
match the on-the-wire JSON.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .models import IdempotencyKey


_HEADER = "Idempotency-Key"


def _hash(user_id: UUID | str | None, header_value: str) -> str:
    raw = f"{user_id or 'anon'}::{header_value}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def get_cached_response(
    request: Request,
    *,
    scope: str,
    user_id: UUID | None,
    db: AsyncSession,
) -> Response | None:
    """Return a cached Response if this Idempotency-Key was already used
    by this user under this scope. Returns None when:
      - no header was provided (caller proceeds normally)
      - header was provided but never seen before (caller proceeds and
        should call `store_response` afterwards)
    """
    header_value = (request.headers.get(_HEADER) or "").strip()
    if not header_value:
        return None
    if len(header_value) < 8 or len(header_value) > 200:
        raise HTTPException(
            status_code=400,
            detail="Idempotency-Key must be 8–200 characters.",
        )

    key_hash = _hash(user_id, header_value)
    res = await db.execute(
        select(IdempotencyKey).where(
            IdempotencyKey.scope == scope,
            IdempotencyKey.key_hash == key_hash,
        )
    )
    row = res.scalar_one_or_none()
    if row is None:
        return None
    return Response(
        content=row.response_json,
        status_code=row.response_status,
        media_type="application/json",
        headers={"Idempotency-Replay": "true"},
    )


async def store_response(
    request: Request,
    *,
    scope: str,
    user_id: UUID | None,
    response_json: Any,
    status_code: int = 200,
    db: AsyncSession,
) -> None:
    """Persist `response_json` against the request's Idempotency-Key so
    a retry returns the same body. No-op when the client didn't send
    a header. Safe to call after the mutation has already committed —
    a UNIQUE-constraint clash means another concurrent caller stored
    a row first, in which case the next retry will see theirs."""
    header_value = (request.headers.get(_HEADER) or "").strip()
    if not header_value:
        return
    body = json.dumps(response_json, default=str)
    db.add(IdempotencyKey(
        scope=scope,
        key_hash=_hash(user_id, header_value),
        user_id=user_id,
        response_status=status_code,
        response_json=body,
    ))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
