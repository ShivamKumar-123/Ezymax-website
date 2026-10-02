"""Idempotency-Key helper for mutating endpoints.

Pattern: an authenticated client passes a unique `Idempotency-Key`
header on a mutating POST. We hash (user_id || header) and key a row in
`idempotency_keys` (UNIQUE (scope, key_hash)).

Section F — claim-first (safe with N workers / replicas)
--------------------------------------------------------
The old flow was "SELECT; if absent run the handler; INSERT the response".
Two concurrent requests with the same key both saw "absent" and BOTH ran the
handler (two Razorpay orders, two deposits …); the UNIQUE clash only fired
afterwards. Now:

1. ``get_cached_response`` first CLAIMS the key: ``INSERT … ON CONFLICT DO
   NOTHING RETURNING`` a placeholder row (``response_status = 0``) and commits
   it in its OWN short session, so the claim is visible cluster-wide before the
   handler runs and is independent of the handler's transaction.
2. The loser of the race sees the existing row:
     * finished (status != 0)  → the stored response is replayed;
     * still in progress       → **409 Conflict** (retry later);
     * an abandoned claim (in progress for > ``CLAIM_STALE_SECONDS``, e.g. the
       winner crashed) is taken over atomically and the request proceeds.
3. ``store_response`` fills the claimed row with the real body/status.
4. ``release_claim`` deletes an unfinished claim — call it when the handler
   fails so the client can retry immediately (otherwise the claim becomes
   re-claimable after ``CLAIM_STALE_SECONDS``).

Pattern intentionally lives outside FastAPI middleware — call it explicitly
from each handler so the cached body is exactly the response shape that
handler returns.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


_HEADER = "Idempotency-Key"
_IN_PROGRESS = 0
CLAIM_STALE_SECONDS = 60


def _hash(user_id: UUID | str | None, header_value: str) -> str:
    raw = f"{user_id or 'anon'}::{header_value}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _header(request: Request) -> str:
    header_value = (request.headers.get(_HEADER) or "").strip()
    if header_value and (len(header_value) < 8 or len(header_value) > 200):
        raise HTTPException(
            status_code=400,
            detail="Idempotency-Key must be 8–200 characters.",
        )
    return header_value


def _session_factory():
    # Own short-lived session: the claim must commit independently of the
    # handler's transaction (and survive its rollback).
    from .database import AsyncSessionLocal
    return AsyncSessionLocal


_CLAIM_SQL = text(
    """
    INSERT INTO idempotency_keys (id, scope, key_hash, user_id, response_status, response_json, created_at)
    VALUES (gen_random_uuid(), :scope, :key_hash, :user_id, 0, '', now())
    ON CONFLICT (scope, key_hash) DO NOTHING
    RETURNING id
    """
)

_TAKEOVER_SQL = text(
    """
    UPDATE idempotency_keys
       SET created_at = now()
     WHERE scope = :scope AND key_hash = :key_hash
       AND response_status = 0
       AND created_at < now() - make_interval(secs => :stale)
    RETURNING id
    """
)

_LOOKUP_SQL = text(
    """
    SELECT response_status, response_json
      FROM idempotency_keys
     WHERE scope = :scope AND key_hash = :key_hash
    """
)


async def get_cached_response(
    request: Request,
    *,
    scope: str,
    user_id: UUID | None,
    db: AsyncSession | None = None,  # kept for call-site compatibility
) -> Response | None:
    """Claim this request's Idempotency-Key, or replay / refuse a duplicate.

    Returns:
      * ``None`` — no header (proceed normally), or the key was claimed by this
        request (proceed, then call ``store_response``);
      * a ``Response`` replaying the stored result of a finished duplicate.
    Raises ``HTTPException(409)`` while another request with the same key is
    still in flight.
    """
    header_value = _header(request)
    if not header_value:
        return None
    params = {
        "scope": scope,
        "key_hash": _hash(user_id, header_value),
        "user_id": user_id,
        "stale": CLAIM_STALE_SECONDS,
    }
    async with _session_factory()() as s:
        claimed = (await s.execute(_CLAIM_SQL, params)).first()
        if claimed is None:
            claimed = (await s.execute(_TAKEOVER_SQL, params)).first()
        await s.commit()
        if claimed is not None:
            return None
        row = (await s.execute(_LOOKUP_SQL, params)).first()

    if row is None:
        # Deleted between our INSERT attempt and the lookup (released claim).
        # Treat as in-flight; the client's retry will claim it.
        raise HTTPException(status_code=409, detail="A request with this Idempotency-Key is in progress. Retry shortly.")
    status_code, body = int(row[0] or 0), row[1]
    if status_code == _IN_PROGRESS:
        raise HTTPException(
            status_code=409,
            detail="A request with this Idempotency-Key is in progress. Retry shortly.",
        )
    return Response(
        content=body,
        status_code=status_code,
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
    db: AsyncSession | None = None,  # kept for call-site compatibility
) -> None:
    """Persist ``response_json`` on the claimed row so a retry replays it.
    No-op when the client didn't send a header."""
    header_value = _header(request)
    if not header_value:
        return
    body = json.dumps(response_json, default=str)
    params = {
        "scope": scope,
        "key_hash": _hash(user_id, header_value),
        "user_id": user_id,
        "status": int(status_code) or 200,
        "body": body,
    }
    async with _session_factory()() as s:
        res = await s.execute(
            text(
                """
                UPDATE idempotency_keys
                   SET response_status = :status, response_json = :body
                 WHERE scope = :scope AND key_hash = :key_hash
                RETURNING id
                """
            ),
            params,
        )
        if res.first() is None:
            # Claim row vanished (released / never claimed) — store fresh.
            await s.execute(
                text(
                    """
                    INSERT INTO idempotency_keys (id, scope, key_hash, user_id, response_status, response_json, created_at)
                    VALUES (gen_random_uuid(), :scope, :key_hash, :user_id, :status, :body, now())
                    ON CONFLICT (scope, key_hash) DO NOTHING
                    """
                ),
                params,
            )
        await s.commit()


async def release_claim(
    request: Request,
    *,
    scope: str,
    user_id: UUID | None,
) -> None:
    """Drop an unfinished claim (handler failed) so the client can retry now."""
    header_value = (request.headers.get(_HEADER) or "").strip()
    if not header_value:
        return
    try:
        async with _session_factory()() as s:
            await s.execute(
                text(
                    "DELETE FROM idempotency_keys WHERE scope = :scope "
                    "AND key_hash = :key_hash AND response_status = 0"
                ),
                {"scope": scope, "key_hash": _hash(user_id, header_value)},
            )
            await s.commit()
    except Exception:
        pass
