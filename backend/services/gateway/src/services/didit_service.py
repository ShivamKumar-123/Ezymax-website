"""Didit identity verification — session creation and webhook settlement.

The contract below was confirmed against the live API before this was written,
not taken from memory:

    POST {base}/v2/session/                 -> 201 {session_id, url, status, ...}
    GET  {base}/v2/session/{id}/decision/   -> 200 {status, id_verification, aml, ...}

Both authenticate with an `x-api-key` header. The workflow in use returns the
features ID_VERIFICATION, LIVENESS, FACE_MATCH, AML and IP_ANALYSIS.

Approval flows one way only: Didit's decision sets `users.kyc_status`, and the
withdrawal gate reads that. Nothing here trusts a value the browser sends.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from typing import Any, Optional
from uuid import UUID

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.models import KycSession, User

logger = logging.getLogger("didit")

# Didit's session states. Only APPROVED grants KYC; everything else either
# leaves the user where they were or moves them to a reviewable state.
APPROVED = "Approved"
DECLINED = "Declined"
IN_REVIEW = "In Review"
IN_PROGRESS = "In Progress"
NOT_STARTED = "Not Started"
ABANDONED = "Abandoned"
EXPIRED = "Expired"
KYC_EXPIRED = "Kyc Expired"

# How Didit's state maps onto users.kyc_status, which is what the rest of the
# platform (and the withdrawal gate) reads.
STATUS_MAP = {
    APPROVED: "approved",
    DECLINED: "rejected",
    IN_REVIEW: "under_review",
    IN_PROGRESS: "submitted",
    NOT_STARTED: "pending",
    ABANDONED: "pending",
    EXPIRED: "pending",
    KYC_EXPIRED: "pending",
}

# A webhook older than this is refused even with a valid signature — a captured
# request must not stay replayable forever.
WEBHOOK_MAX_AGE_SECONDS = 300


def _cfg():
    st = get_settings()
    if not st.DIDIT_API_KEY or not st.DIDIT_WORKFLOW_ID:
        raise HTTPException(
            status_code=503,
            detail="Identity verification is not configured.",
        )
    return st


async def create_session(*, user_id: UUID, db: AsyncSession) -> dict:
    """Open a Didit session for this user and return the URL to send them to.

    Reuses a session that is still in flight rather than opening a second one:
    a user who closes the tab and comes back should land where they left off,
    and every extra session is billable.
    """
    st = _cfg()

    existing = (await db.execute(
        select(KycSession)
        .where(KycSession.user_id == user_id)
        .order_by(KycSession.created_at.desc())
    )).scalars().first()
    if existing is not None and existing.status in (NOT_STARTED, IN_PROGRESS):
        return {
            "url": existing.session_url,
            "session_id": existing.session_id,
            "status": existing.status,
            "reused": True,
        }

    body: dict[str, Any] = {
        "workflow_id": st.DIDIT_WORKFLOW_ID,
        # vendor_data is echoed back on the webhook. It is a convenience for
        # logs only — the session_id is what actually resolves the user.
        "vendor_data": str(user_id),
    }
    if st.DIDIT_RETURN_URL:
        body["callback"] = st.DIDIT_RETURN_URL

    url = f"{st.DIDIT_BASE_URL.rstrip('/')}/v2/session/"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                url,
                json=body,
                headers={"x-api-key": st.DIDIT_API_KEY, "Content-Type": "application/json"},
            )
    except Exception:
        logger.exception("Didit session create failed for user %s", user_id)
        raise HTTPException(status_code=503, detail="Verification service unavailable. Please try again.")

    if r.status_code not in (200, 201):
        # The provider's raw error is logged, not shown — it can carry internal
        # detail and means nothing to the trader.
        logger.error("Didit session create %s: %s", r.status_code, r.text[:500])
        raise HTTPException(status_code=503, detail="Could not start verification. Please try again.")

    data = r.json()
    row = KycSession(
        user_id=user_id,
        session_id=str(data["session_id"]),
        session_url=data.get("url"),
        status=data.get("status") or NOT_STARTED,
    )
    db.add(row)

    # The user is now mid-verification; reflect that so the UI stops asking.
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is not None and (user.kyc_status or "pending").lower() in ("pending", "rejected"):
        user.kyc_status = "submitted"
    await db.commit()

    logger.info("Didit session %s opened for user %s", row.session_id, user_id)
    return {
        "url": row.session_url,
        "session_id": row.session_id,
        "status": row.status,
        "reused": False,
    }


def verify_webhook_signature(raw_body: bytes, signature: str, timestamp: str) -> bool:
    """HMAC-SHA256 over the raw body, keyed with the webhook secret.

    Compared with compare_digest so a wrong signature cannot be narrowed down
    by timing, and refused outright once the timestamp is stale.
    """
    st = get_settings()
    secret = st.DIDIT_WEBHOOK_SECRET
    if not secret or not signature:
        return False

    try:
        age = abs(time.time() - int(timestamp))
    except (TypeError, ValueError):
        return False
    if age > WEBHOOK_MAX_AGE_SECONDS:
        logger.warning("Didit webhook rejected: timestamp %ss old", int(age))
        return False

    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


async def handle_webhook(payload: dict, db: AsyncSession) -> dict:
    """Apply a verification result. Idempotent — Didit retries."""
    session_id = str(payload.get("session_id") or "")
    status = str(payload.get("status") or "")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")

    row = (await db.execute(
        select(KycSession).where(KycSession.session_id == session_id)
    )).scalar_one_or_none()
    if row is None:
        # A session this platform never opened. Logged and accepted so Didit
        # stops retrying, but nothing is changed on the strength of it.
        logger.warning("Didit webhook for unknown session %s", session_id)
        return {"ok": True, "ignored": "unknown_session"}

    if row.status == status:
        return {"ok": True, "idempotent": True}

    row.status = status
    row.decision = payload

    st = get_settings()
    aml = (payload.get("aml") or {})
    aml_status = aml.get("status") if isinstance(aml, dict) else None
    row.aml_status = str(aml_status) if aml_status else None

    user = (await db.execute(select(User).where(User.id == row.user_id))).scalar_one_or_none()
    if user is None:
        await db.commit()
        return {"ok": True, "ignored": "user_gone"}

    mapped = STATUS_MAP.get(status)
    if mapped == "approved":
        # AML is a separate gate from identity. An approved ID with a flagged
        # AML result must not walk through as verified — it goes to a human.
        if st.DIDIT_AML_REQUIRED and aml_status and str(aml_status).lower() not in ("clear", "approved", "not_applicable"):
            user.kyc_status = "under_review"
            logger.warning(
                "Didit session %s: identity approved but AML=%s — held for review",
                session_id, aml_status,
            )
        else:
            user.kyc_status = "approved"
            logger.info("Didit session %s: user %s approved", session_id, user.id)
    elif mapped:
        user.kyc_status = mapped

    await db.commit()

    try:
        from packages.common.src.cache import cache_invalidate
        await cache_invalidate("auth_me", str(user.id))
    except Exception:
        pass

    return {"ok": True, "status": status, "kyc_status": user.kyc_status}


async def refresh_session(*, session_id: str, db: AsyncSession) -> dict:
    """Pull the decision straight from Didit.

    A webhook that never arrives — a dropped delivery, a misconfigured URL —
    would otherwise leave a verified user stuck on the old status forever.
    """
    st = _cfg()
    url = f"{st.DIDIT_BASE_URL.rstrip('/')}/v2/session/{session_id}/decision/"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url, headers={"x-api-key": st.DIDIT_API_KEY})
    except Exception:
        logger.exception("Didit decision fetch failed for %s", session_id)
        raise HTTPException(status_code=503, detail="Verification service unavailable.")
    if r.status_code != 200:
        logger.error("Didit decision %s: %s", r.status_code, r.text[:300])
        raise HTTPException(status_code=503, detail="Could not read verification status.")
    return await handle_webhook(r.json(), db)
