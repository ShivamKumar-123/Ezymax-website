"""Public webhook endpoints — no JWT auth, secured by provider-specific HMAC."""
import hashlib
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import WebhookEvent
from ..services import oxapay_service, razorpay_service, wallet_service

router = APIRouter()
logger = logging.getLogger("webhooks")


async def _claim_webhook(
    db: AsyncSession,
    *,
    provider: str,
    external_id: str,
    status: str,
    raw_body: bytes,
) -> bool:
    """Insert a (provider, external_id, status) row in webhook_events.

    Returns True when the row was newly inserted (caller should process
    the webhook), False when the UNIQUE constraint already had it (a
    re-delivery — caller short-circuits with 200 OK so the provider
    stops retrying).

    Production payment webhooks are routinely re-delivered (network
    blips, our 5xx, deliberate re-sends from the dashboard). Without
    this guard, a re-delivery of a `finished` event would credit the
    deposit twice and apply bonuses twice."""
    payload_hash = hashlib.sha256(raw_body or b"").hexdigest()
    db.add(WebhookEvent(
        provider=provider,
        external_id=external_id,
        status=status,
        payload_hash=payload_hash,
    ))
    try:
        await db.commit()
        return True
    except IntegrityError:
        await db.rollback()
        logger.info(
            "webhook duplicate suppressed: provider=%s external_id=%s status=%s",
            provider, external_id, status,
        )
        return False


async def _release_webhook_claim(
    db: AsyncSession, *, provider: str, external_id: str, status: str,
) -> None:
    """Phase 3 (commit ordering): the claim row is committed BEFORE the webhook
    is processed (so concurrent re-deliveries dedupe). If processing then fails,
    delete the claim so the provider's retry is NOT suppressed and the deposit
    isn't silently lost. Best-effort — a failure here just means the retry is
    deduped, which is the pre-fix behaviour."""
    from sqlalchemy import delete as _delete
    try:
        await db.rollback()  # clear any failed-transaction state first
        await db.execute(
            _delete(WebhookEvent).where(
                WebhookEvent.provider == provider,
                WebhookEvent.external_id == external_id,
                WebhookEvent.status == status,
            )
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception(
            "failed to release webhook claim provider=%s external_id=%s", provider, external_id,
        )


@router.post("/oxapay")
async def oxapay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """OxaPay payment status callback. Public endpoint secured by HMAC-SHA512."""
    raw_body = await request.body()
    hmac_header = request.headers.get("HMAC", "") or request.headers.get("hmac", "")

    if not oxapay_service.verify_webhook_signature(raw_body, hmac_header):
        logger.warning("OxaPay webhook: invalid HMAC signature")
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload = json.loads(raw_body)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid JSON")

    order_id = payload.get("orderId")
    status = payload.get("status")
    track_id = payload.get("trackId")

    if not order_id or not status:
        logger.info("OxaPay webhook: missing orderId/status, ignoring")
        return {"status": "ignored"}

    logger.info("OxaPay webhook: order=%s status=%s track=%s", order_id, status, track_id)

    if not await _claim_webhook(
        db, provider="oxapay", external_id=str(order_id), status=str(status),
        raw_body=raw_body,
    ):
        return {"status": "duplicate"}

    try:
        await wallet_service.handle_oxapay_webhook(
            order_id=order_id,
            oxapay_status=status,
            track_id=track_id,
            payload=payload,
            db=db,
        )
    except Exception:
        # Processing failed after the claim was committed — release the claim so
        # the provider's retry re-processes instead of being deduped away.
        await _release_webhook_claim(
            db, provider="oxapay", external_id=str(order_id), status=str(status),
        )
        raise

    return {"status": "ok"}


@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Razorpay webhook callback. Public endpoint secured by HMAC-SHA256.

    Signature arrives in the `X-Razorpay-Signature` header, computed over the
    RAW request body with RAZORPAY_WEBHOOK_SECRET. We handle the
    `payment.captured` event: the captured payment carries its `order_id`
    (which we stamped onto the deposit at order-creation) and its payment
    `id`. Crediting is idempotent + deduped by _claim_webhook so a replay
    can't double-credit."""
    raw_body = await request.body()
    sig = (
        request.headers.get("X-Razorpay-Signature")
        or request.headers.get("x-razorpay-signature")
        or ""
    )

    if not razorpay_service.verify_webhook_signature(raw_body, sig):
        logger.warning("Razorpay webhook: invalid HMAC signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        payload = json.loads(raw_body)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = payload.get("event")
    if event != "payment.captured":
        logger.info("Razorpay webhook: event=%s ignored", event)
        return {"ok": True}

    entity = (
        payload.get("payload", {})
        .get("payment", {})
        .get("entity", {})
    )
    order_id = entity.get("order_id")
    payment_id = entity.get("id")

    if not order_id or not payment_id:
        logger.info("Razorpay webhook: missing order_id/payment_id, ignoring")
        return {"ok": True}

    logger.info(
        "Razorpay webhook: event=%s order=%s payment_id=%s",
        event, order_id, payment_id,
    )

    # Dedup on the payment id so a re-delivered payment.captured can't
    # double-credit even before the deposit's status guard kicks in.
    if not await _claim_webhook(
        db, provider="razorpay", external_id=str(payment_id), status="captured",
        raw_body=raw_body,
    ):
        return {"ok": True}

    try:
        await wallet_service.handle_razorpay_webhook(
            order_id=str(order_id),
            payment_id=str(payment_id),
            db=db,
        )
    except Exception:
        await _release_webhook_claim(
            db, provider="razorpay", external_id=str(payment_id), status="captured",
        )
        raise

    return {"ok": True}
