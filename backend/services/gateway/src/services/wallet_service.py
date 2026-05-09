"""Wallet Service — Deposits, withdrawals, transfers, wallet summary."""
import logging
import uuid as uuid_lib
from pathlib import Path
from decimal import Decimal
from uuid import UUID
from datetime import datetime

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    BankAccount, BonusOffer, Deposit, Transaction, TradingAccount, User, Withdrawal,
)
from packages.common.src.notify import create_notification
from packages.common.src.config import get_settings
from packages.common.src.path_safety import PathTraversalError, safe_join_under_base
from . import oxapay_service, nowpayments_service

logger = logging.getLogger("wallet_service")

DEPOSIT_PROOF_EXT = {".jpg", ".jpeg", ".png", ".pdf", ".webp"}
MAX_PROOF_BYTES = 10 * 1024 * 1024

METHOD_MAP = {
    "bank": "bank_transfer",
    "bank_transfer": "bank_transfer",
    "upi": "upi",
    "qr": "qr",
    "crypto": "crypto_btc",
    "crypto_btc": "crypto_btc",
    "crypto_eth": "crypto_eth",
    "crypto_usdt": "crypto_usdt",
    "metamask": "metamask",
    "card": "bank_transfer",
    "oxapay": "oxapay",
    "nowpayments": "nowpayments",
    "manual": "manual",
}


# ─── Email helpers (best-effort, fire-and-forget) ─────────────────────────


def _send_bonus_emails_for_user(
    user_row: User,
    applied_bonuses: list[tuple[str, Decimal]],
) -> None:
    """Send one bonus-credited email per applied bonus offer. Caller has
    already fired the deposit-confirmation email; this tells the user
    explicitly which promo credited them. Silent no-op if SMTP isn't
    configured or no bonus was applied."""
    if not applied_bonuses:
        return
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        if not smtp_configured() or not user_row.email:
            return
        from packages.common.src.email_templates import render_bonus_credited
        st = get_settings()
        app_url = (getattr(st, "TRADER_APP_URL", None) or "https://trade.fxartha.com")
        for offer_name, bonus_amount in applied_bonuses:
            subject, html, text = render_bonus_credited(
                first_name=user_row.first_name,
                bonus_amount=bonus_amount,
                bonus_label=offer_name,
                currency="USD",
                new_bonus_balance=user_row.main_wallet_balance,
                trader_app_url=app_url,
            )
            fire_and_forget(send_email(user_row.email, subject, html, text=text))
    except Exception as _e:
        logger.warning("bonus credited email failed: %s", _e)


def _send_deposit_failed_email(
    user_row: User,
    deposit: Deposit,
    reason_code: str,
    *,
    method_label: str,
) -> None:
    """Fire-and-forget 'deposit not completed' email when a crypto provider
    reports expired / failed / refunded / partially_paid."""
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        if not smtp_configured() or not user_row.email:
            return
        from packages.common.src.email_templates import render_deposit_failed
        st = get_settings()
        app_url = (getattr(st, "TRADER_APP_URL", None) or "https://trade.fxartha.com")
        subject, html, text = render_deposit_failed(
            first_name=user_row.first_name,
            amount=deposit.amount,
            currency="USD",
            method=method_label,
            reason_code=reason_code,
            reference=str(deposit.id),
            trader_app_url=app_url,
        )
        fire_and_forget(send_email(user_row.email, subject, html, text=text))
    except Exception as _e:
        logger.warning("deposit failed email send failed: %s", _e)


def _wallet_upload_root() -> Path:
    raw = get_settings().WALLET_UPLOAD_ROOT.strip() or "uploads/wallet"
    p = Path(raw)
    if not p.is_absolute():
        p = Path.cwd() / p
    try:
        p.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        logger.error("Wallet upload dir not writable: %s — %s", p, e)
        raise HTTPException(
            status_code=503,
            detail="File upload is temporarily unavailable. Please contact support.",
        ) from e
    return p


async def _get_user_account_ids(user_id, db: AsyncSession) -> list[UUID]:
    result = await db.execute(
        select(TradingAccount.id).where(TradingAccount.user_id == user_id)
    )
    return [row[0] for row in result.all()]


async def _get_live_account_ids(user_id, db: AsyncSession) -> list[UUID]:
    result = await db.execute(
        select(TradingAccount.id).where(
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        )
    )
    return [row[0] for row in result.all()]


async def _get_bank_for_tier(amount: Decimal, db: AsyncSession) -> BankAccount | None:
    """Pick the active bank account whose tier brackets this amount,
    rotating through the pool by `last_used_at` so no single account
    receives every deposit. Used by the manual bank/UPI deposit flow
    (re-enabled per client direction)."""
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.is_active == True,
            BankAccount.min_amount <= amount,
            BankAccount.max_amount >= amount,
        ).order_by(BankAccount.last_used_at.asc().nullsfirst(), BankAccount.rotation_order)
    )
    bank = result.scalars().first()
    if bank:
        bank.last_used_at = datetime.utcnow()
    return bank


# ─── Deposits ─────────────────────────────────────────────────────────────

async def create_deposit(req, user_id: UUID, db: AsyncSession) -> dict:
    from packages.common.src.settings_store import get_bool_setting
    if await get_bool_setting("maintenance_mode", False):
        raise HTTPException(status_code=503, detail="Platform is under maintenance. Deposits are temporarily disabled.")
    if not await get_bool_setting("allow_deposits", True):
        raise HTTPException(status_code=403, detail="Deposits are currently disabled")

    if req.account_id is not None:
        acct = await db.execute(
            select(TradingAccount).where(
                TradingAccount.id == req.account_id,
                TradingAccount.user_id == user_id,
            )
        )
        account = acct.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

    bank = await _get_bank_for_tier(req.amount, db)
    db_method = METHOD_MAP.get(req.method, "bank_transfer")

    # For automated crypto methods, use 'initiated' status until payment is
    # actually started. This prevents showing incomplete payment attempts in
    # history. NOWPayments is the current default; OxaPay is kept mounted for
    # in-flight + historical deposits.
    settings = get_settings()
    crypto_currency = getattr(req, "crypto_currency", None)
    is_oxapay = db_method == "oxapay" and bool(settings.OXAPAY_MERCHANT_KEY)
    is_nowpayments = db_method == "nowpayments" and bool(settings.NOWPAYMENTS_API_KEY)
    is_automated_crypto = is_oxapay or is_nowpayments

    deposit = Deposit(
        user_id=user_id,
        account_id=req.account_id if req.account_id else None,
        amount=req.amount,
        method=db_method,
        transaction_id=req.transaction_id,
        screenshot_url=req.screenshot_url,
        crypto_tx_hash=getattr(req, "crypto_tx_hash", None),
        crypto_address=getattr(req, "crypto_address", None),
        bank_account_id=bank.id if bank else None,
        status="initiated" if is_automated_crypto else "pending",
    )
    db.add(deposit)
    await db.commit()
    await db.refresh(deposit)

    # ── Automated crypto payment ──────────────────────────────────────
    payment_url: str | None = None
    if is_oxapay:
        try:
            ox = await oxapay_service.create_payment(
                amount=req.amount,
                crypto_currency=crypto_currency,
                order_id=str(deposit.id),
                description=f"FXArtha deposit ${float(req.amount):,.2f}",
            )
            deposit.transaction_id = ox["track_id"]
            payment_url = ox["payment_url"]
            await db.commit()
        except Exception as oxapay_err:
            logger.exception(
                "OxaPay create_payment failed for deposit %s",
                deposit.id,
            )
            # Delete the initiated deposit since payment creation failed
            await db.delete(deposit)
            await db.commit()
            raise HTTPException(
                status_code=502,
                detail=f"OxaPay payment creation failed: {str(oxapay_err)}",
            )
    elif is_nowpayments:
        try:
            np = await nowpayments_service.create_payment(
                amount=req.amount,
                crypto_currency=crypto_currency,
                order_id=str(deposit.id),
                description=f"FXArtha deposit ${float(req.amount):,.2f}",
            )
            deposit.transaction_id = np["invoice_id"]
            payment_url = np["payment_url"]
            await db.commit()
        except Exception as np_err:
            logger.exception(
                "NOWPayments create_payment failed for deposit %s",
                deposit.id,
            )
            # Delete the initiated deposit since payment creation failed
            await db.delete(deposit)
            await db.commit()
            raise HTTPException(
                status_code=502,
                detail=f"NOWPayments payment creation failed: {str(np_err)}",
            )

    try:
        await create_notification(
            db, user_id,
            title="Deposit Submitted",
            message=f"${float(req.amount):,.2f} deposit via {req.method} is pending approval",
            notif_type="deposit", action_url="/wallet",
        )
        await db.commit()
    except Exception:
        logger.exception("create_notification failed after deposit (deposit already saved) user_id=%s", user_id)
        try:
            await db.rollback()
        except Exception:
            pass

    result: dict = {"id": str(deposit.id), "status": "pending", "amount": float(deposit.amount)}
    if payment_url:
        result["payment_url"] = payment_url
    return result


async def create_manual_deposit(
    user_id: UUID,
    account_id: UUID | None,
    amount: Decimal,
    transaction_id: str,
    file: UploadFile,
    db: AsyncSession,
) -> dict:
    from packages.common.src.settings_store import get_bool_setting
    if not await get_bool_setting("allow_deposits", True):
        raise HTTPException(status_code=403, detail="Deposits are currently disabled")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    tid = (transaction_id or "").strip()
    if not tid:
        raise HTTPException(status_code=400, detail="Transaction / reference ID is required for manual deposits")

    if account_id is not None:
        acct = await db.execute(
            select(TradingAccount).where(
                TradingAccount.id == account_id,
                TradingAccount.user_id == user_id,
            )
        )
        account = acct.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Payment screenshot or proof file is required")
    suffix = Path(file.filename).suffix.lower()
    if suffix not in DEPOSIT_PROOF_EXT:
        raise HTTPException(status_code=400, detail="Allowed file types: JPG, PNG, PDF, WEBP")
    content = await file.read()
    if len(content) > MAX_PROOF_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    # Magic-byte validation — extension + Content-Type are spoofable.
    # A polyglot (e.g. valid JPEG header followed by PHP) gets through
    # extension checks alone and lets an attacker host malicious code
    # under a wallet/uploads/ URL. The leading bytes are much harder to
    # fake without breaking the format itself.
    from packages.common.src.file_validation import validate_upload
    try:
        suffix = validate_upload(
            content, suffix,
            allowed_extensions=DEPOSIT_PROOF_EXT,
            label="Payment screenshot",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    bank = await _get_bank_for_tier(amount, db)
    try:
        user_dir = safe_join_under_base(_wallet_upload_root(), "deposits", str(user_id))
    except PathTraversalError:
        raise HTTPException(status_code=400, detail="Invalid upload path")
    user_dir.mkdir(parents=True, exist_ok=True)
    safe = f"deposit_{uuid_lib.uuid4().hex}{suffix}"
    try:
        out_path = safe_join_under_base(user_dir, safe)
    except PathTraversalError:
        raise HTTPException(status_code=400, detail="Invalid file path")
    try:
        out_path.write_bytes(content)
    except OSError as e:
        logger.exception("manual deposit write failed: %s", out_path)
        raise HTTPException(status_code=503, detail="Could not save file") from e

    deposit = Deposit(
        user_id=user_id,
        account_id=account_id if account_id else None,
        amount=amount,
        method="manual",
        transaction_id=tid[:100],
        screenshot_url=str(out_path.resolve()),
        bank_account_id=bank.id if bank else None,
        status="pending",
    )
    db.add(deposit)
    await db.commit()
    await db.refresh(deposit)

    try:
        await create_notification(
            db, user_id,
            title="Deposit Submitted",
            message=f"${float(amount):,.2f} manual deposit pending approval",
            notif_type="deposit", action_url="/wallet",
        )
        await db.commit()
    except Exception:
        logger.exception("create_notification failed after manual deposit (deposit already saved) user_id=%s", user_id)
        try:
            await db.rollback()
        except Exception:
            pass

    return {"id": str(deposit.id), "status": "pending", "amount": float(deposit.amount)}


# ─── OxaPay Webhook ──────────────────────────────────────────────────────

async def handle_oxapay_webhook(
    order_id: str,
    oxapay_status: str,
    track_id: str | None,
    payload: dict,
    db: AsyncSession,
) -> None:
    """Process OxaPay webhook callback. Auto-approve on 'paid', reject on 'expired'/'failed'."""
    from uuid import UUID as UUIDType

    try:
        deposit_uuid = UUIDType(order_id)
    except ValueError:
        logger.warning("OxaPay webhook: invalid order_id=%s", order_id)
        return

    result = await db.execute(select(Deposit).where(Deposit.id == deposit_uuid))
    deposit = result.scalar_one_or_none()
    if not deposit:
        logger.warning("OxaPay webhook: deposit not found order_id=%s", order_id)
        return

    # Idempotent — skip if already processed (but allow 'initiated' to transition)
    if deposit.status not in ("initiated", "pending"):
        logger.info("OxaPay webhook: deposit %s already %s, skipping", order_id, deposit.status)
        return

    if track_id:
        deposit.transaction_id = track_id

    # If payment is waiting/confirming, move from 'initiated' to 'pending'
    if oxapay_status in ("waiting", "confirming") and deposit.status == "initiated":
        deposit.status = "pending"
        await db.commit()
        logger.info("OxaPay webhook: deposit %s → pending (payment started)", order_id)
        return

    if oxapay_status == "paid":
        deposit.status = "auto_approved"
        deposit.approved_at = datetime.utcnow()

        user_q = await db.execute(select(User).where(User.id == deposit.user_id))
        user_row = user_q.scalar_one_or_none()
        if not user_row:
            logger.error("OxaPay webhook: user not found for deposit %s", order_id)
            return

        user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + deposit.amount

        db.add(Transaction(
            user_id=deposit.user_id,
            account_id=None,
            type="deposit",
            amount=deposit.amount,
            balance_after=user_row.main_wallet_balance,
            reference_id=deposit.id,
            description=f"Deposit to main wallet - oxapay (auto)",
        ))

        # Apply bonus offers (mirrors admin approve_deposit logic)
        bonus_msg = ""
        applied_bonuses: list[tuple[str, Decimal]] = []
        now = datetime.utcnow()
        offers_q = await db.execute(
            select(BonusOffer).where(
                BonusOffer.is_active == True,
                BonusOffer.bonus_type.in_(["deposit", "welcome"]),
                BonusOffer.min_deposit <= deposit.amount,
            )
        )
        for offer in offers_q.scalars().all():
            if offer.starts_at and offer.starts_at > now:
                continue
            if offer.expires_at and offer.expires_at < now:
                continue
            if offer.percentage and offer.percentage > 0:
                bonus_amount = deposit.amount * offer.percentage / Decimal("100")
            elif offer.fixed_amount and offer.fixed_amount > 0:
                bonus_amount = offer.fixed_amount
            else:
                continue
            if offer.max_bonus and bonus_amount > offer.max_bonus:
                bonus_amount = offer.max_bonus

            user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + bonus_amount
            db.add(Transaction(
                user_id=deposit.user_id,
                account_id=None,
                type="bonus",
                amount=bonus_amount,
                balance_after=user_row.main_wallet_balance,
                description=f"Bonus: {offer.name} ({offer.percentage or 0}%)",
            ))
            bonus_msg = f" + ${float(bonus_amount):.2f} bonus ({offer.name})"
            applied_bonuses.append((offer.name, bonus_amount))

        await create_notification(
            db, deposit.user_id,
            title="Deposit approved",
            message=f"Your deposit of ${float(deposit.amount):,.2f} was approved automatically.{bonus_msg}",
            notif_type="deposit", action_url="/wallet",
        )

        # Email the user — best-effort.
        try:
            from packages.common.src.smtp_mail import (
                send_email, smtp_configured, fire_and_forget,
            )
            from packages.common.src.email_templates import render_deposit_confirmed
            from packages.common.src.config import get_settings as _gs
            if smtp_configured() and user_row.email:
                subject, html, text = render_deposit_confirmed(
                    first_name=user_row.first_name,
                    amount=deposit.amount,
                    currency="USD",
                    method="Crypto (OxaPay)",
                    reference=str(deposit.id),
                    new_balance=user_row.main_wallet_balance,
                    trader_app_url=(_gs().TRADER_APP_URL or "https://trade.fxartha.com"),
                )
                fire_and_forget(send_email(user_row.email, subject, html, text=text))
                _send_bonus_emails_for_user(user_row, applied_bonuses)
        except Exception as _e:
            logger.warning("oxapay deposit email failed: %s", _e)

    elif oxapay_status in ("expired", "failed"):
        deposit.status = "rejected"
        deposit.rejection_reason = f"OxaPay payment {oxapay_status}"
        await create_notification(
            db, deposit.user_id,
            title="Deposit not completed",
            message=f"Your ${float(deposit.amount):,.2f} crypto deposit {oxapay_status}. Please try again.",
            notif_type="deposit", action_url="/wallet",
        )
        _send_deposit_failed_email(
            user_row, deposit, oxapay_status, method_label="Crypto (OxaPay)",
        )

    else:
        # "waiting", "confirming" — informational only
        logger.info("OxaPay webhook: deposit %s status=%s (no action)", order_id, oxapay_status)
        return

    await db.commit()
    logger.info("OxaPay webhook: deposit %s → %s", order_id, deposit.status)


# ─── On-site wallet-connect deposit (NOWPayments /v1/payment) ───────────


async def create_wallet_deposit(
    *,
    amount: Decimal,
    crypto_currency: str,
    user_id: UUID,
    db: AsyncSession,
) -> dict:
    """Create a Deposit row + a NOWPayments direct payment for the
    wallet-connect flow. Returns the address + exact crypto amount the
    frontend renders. No payment_url — user pays from their connected
    wallet directly. Settlement still gates on the IPN webhook."""
    from packages.common.src.settings_store import get_bool_setting
    if await get_bool_setting("maintenance_mode", False):
        raise HTTPException(status_code=503, detail="Platform is under maintenance.")
    if not await get_bool_setting("allow_deposits", True):
        raise HTTPException(status_code=403, detail="Deposits are currently disabled")

    settings = get_settings()
    if not settings.NOWPAYMENTS_API_KEY:
        raise HTTPException(status_code=503, detail="Crypto deposits are not configured")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    deposit = Deposit(
        user_id=user_id,
        account_id=None,
        amount=amount,
        method="nowpayments",
        status="initiated",
    )
    db.add(deposit)
    await db.commit()
    await db.refresh(deposit)

    try:
        np = await nowpayments_service.create_direct_payment(
            amount_usd=amount,
            crypto_currency=crypto_currency,
            order_id=str(deposit.id),
            description=f"FXArtha deposit ${float(amount):,.2f}",
        )
    except Exception as e:
        logger.exception("NOWPayments create_direct_payment failed for deposit %s", deposit.id)
        await db.delete(deposit)
        await db.commit()
        raise HTTPException(status_code=502, detail=f"Crypto payment creation failed: {e}")

    deposit.transaction_id = np["payment_id"]
    deposit.crypto_address = np["pay_address"]
    deposit.pay_amount = Decimal(np["pay_amount"])
    deposit.pay_currency = np["pay_currency"]
    deposit.network = np["network"] or None
    if np.get("expires_at"):
        try:
            from datetime import datetime as _dt
            deposit.expires_at = _dt.fromisoformat(np["expires_at"].replace("Z", "+00:00"))
        except Exception:
            deposit.expires_at = None
    await db.commit()
    await db.refresh(deposit)

    return {
        "id": str(deposit.id),
        "status": deposit.status,
        "amount_usd": float(deposit.amount),
        "pay_address": deposit.crypto_address,
        "pay_amount": str(deposit.pay_amount),
        "pay_currency": deposit.pay_currency,
        "network": deposit.network,
        "expires_at": deposit.expires_at.isoformat() if deposit.expires_at else None,
        "payment_id": deposit.transaction_id,
    }


async def get_wallet_deposit_status(
    *, deposit_id: UUID, user_id: UUID, db: AsyncSession,
) -> dict:
    """Polled by the wallet-connect UI. Returns local row status + a fresh
    NOWPayments status (best-effort) so the UI can show confirmation
    progress before the IPN lands."""
    q = await db.execute(
        select(Deposit).where(Deposit.id == deposit_id, Deposit.user_id == user_id)
    )
    deposit = q.scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")

    np_status: str | None = None
    confirmations = None
    if deposit.transaction_id and deposit.method == "nowpayments":
        try:
            data = await nowpayments_service.get_payment_status(deposit.transaction_id)
            np_status = data.get("payment_status")
            confirmations = data.get("confirmations")
            # Side-effect: if NOWPayments says we're past 'waiting' but our
            # local row is still 'initiated' (missed IPN), bump to 'pending'
            # so the UI moves. Settlement still requires the IPN.
            if (
                deposit.status == "initiated"
                and np_status in ("confirming", "sending", "waiting")
            ):
                deposit.status = "pending"
                await db.commit()
        except Exception as e:
            logger.warning("NOWPayments status fetch failed for deposit %s: %s", deposit.id, e)

    return {
        "id": str(deposit.id),
        "status": deposit.status,
        "amount_usd": float(deposit.amount or 0),
        "pay_address": deposit.crypto_address,
        "pay_amount": str(deposit.pay_amount) if deposit.pay_amount is not None else None,
        "pay_currency": deposit.pay_currency,
        "network": deposit.network,
        "tx_hash": deposit.crypto_tx_hash,
        "expires_at": deposit.expires_at.isoformat() if deposit.expires_at else None,
        "nowpayments_status": np_status,
        "confirmations": confirmations,
    }


async def save_wallet_deposit_tx_hash(
    *, deposit_id: UUID, tx_hash: str, user_id: UUID, db: AsyncSession,
) -> dict:
    """Persist the on-chain tx hash the user's wallet returned after broadcast.
    Strictly informational — balance credit still gates on the IPN."""
    th = (tx_hash or "").strip()
    if not th or len(th) < 10 or len(th) > 200:
        raise HTTPException(status_code=400, detail="Invalid tx hash")

    q = await db.execute(
        select(Deposit).where(Deposit.id == deposit_id, Deposit.user_id == user_id)
    )
    deposit = q.scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.status not in ("initiated", "pending"):
        return {"id": str(deposit.id), "saved": False, "status": deposit.status}

    deposit.crypto_tx_hash = th
    if deposit.status == "initiated":
        deposit.status = "pending"
    await db.commit()
    return {"id": str(deposit.id), "saved": True, "status": deposit.status}


# ─── NOWPayments Webhook ─────────────────────────────────────────────────

# NOWPayments status terminals — mapping decided by client spec:
#   waiting / confirming / sending → 'pending'   (in flight)
#   confirmed / finished           → 'auto_approved' (credit balance)
#   failed / expired / refunded /
#     partially_paid               → 'rejected'   (no credit)


async def handle_nowpayments_webhook(
    order_id: str,
    np_status: str,
    payment_id: str | None,
    payload: dict,
    db: AsyncSession,
) -> None:
    """Process a NOWPayments IPN. Auto-approve on 'finished'/'confirmed';
    reject on terminal failures; otherwise just bump 'initiated' → 'pending'.
    Idempotent — already-settled rows are left alone."""
    from uuid import UUID as UUIDType

    try:
        deposit_uuid = UUIDType(order_id)
    except ValueError:
        logger.warning("NOWPayments webhook: invalid order_id=%s", order_id)
        return

    # Lock the deposit row so a concurrent admin approval can't credit
    # twice when the IPN lands at the same moment as a manual flip.
    result = await db.execute(
        select(Deposit).where(Deposit.id == deposit_uuid).with_for_update()
    )
    deposit = result.scalar_one_or_none()
    if not deposit:
        logger.warning("NOWPayments webhook: deposit not found order_id=%s", order_id)
        return

    # Idempotent — skip if already terminal.
    if deposit.status not in ("initiated", "pending"):
        logger.info("NOWPayments webhook: deposit %s already %s, skipping", order_id, deposit.status)
        return

    if payment_id:
        deposit.transaction_id = str(payment_id)

    status = (np_status or "").lower()

    in_flight = ("waiting", "confirming", "sending")
    success = ("confirmed", "finished")
    failure = ("failed", "expired", "refunded", "partially_paid")

    # Move 'initiated' → 'pending' on first signal that the user actually paid.
    if status in in_flight and deposit.status == "initiated":
        deposit.status = "pending"
        await db.commit()
        logger.info("NOWPayments webhook: deposit %s → pending (status=%s)", order_id, status)
        return

    if status in success:
        deposit.status = "auto_approved"
        deposit.approved_at = datetime.utcnow()

        user_q = await db.execute(select(User).where(User.id == deposit.user_id))
        user_row = user_q.scalar_one_or_none()
        if not user_row:
            logger.error("NOWPayments webhook: user not found for deposit %s", order_id)
            return

        user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + deposit.amount

        db.add(Transaction(
            user_id=deposit.user_id,
            account_id=None,
            type="deposit",
            amount=deposit.amount,
            balance_after=user_row.main_wallet_balance,
            reference_id=deposit.id,
            description="Deposit to main wallet - nowpayments (auto)",
        ))

        # Apply active bonus offers — mirrors the OxaPay path so promo
        # behaviour is identical regardless of provider.
        bonus_msg = ""
        applied_bonuses: list[tuple[str, Decimal]] = []
        now = datetime.utcnow()
        offers_q = await db.execute(
            select(BonusOffer).where(
                BonusOffer.is_active == True,
                BonusOffer.bonus_type.in_(["deposit", "welcome"]),
                BonusOffer.min_deposit <= deposit.amount,
            )
        )
        for offer in offers_q.scalars().all():
            if offer.starts_at and offer.starts_at > now:
                continue
            if offer.expires_at and offer.expires_at < now:
                continue
            if offer.percentage and offer.percentage > 0:
                bonus_amount = deposit.amount * offer.percentage / Decimal("100")
            elif offer.fixed_amount and offer.fixed_amount > 0:
                bonus_amount = offer.fixed_amount
            else:
                continue
            if offer.max_bonus and bonus_amount > offer.max_bonus:
                bonus_amount = offer.max_bonus

            user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + bonus_amount
            db.add(Transaction(
                user_id=deposit.user_id,
                account_id=None,
                type="bonus",
                amount=bonus_amount,
                balance_after=user_row.main_wallet_balance,
                description=f"Bonus: {offer.name} ({offer.percentage or 0}%)",
            ))
            bonus_msg = f" + ${float(bonus_amount):.2f} bonus ({offer.name})"
            applied_bonuses.append((offer.name, bonus_amount))

        await create_notification(
            db, deposit.user_id,
            title="Deposit approved",
            message=f"Your deposit of ${float(deposit.amount):,.2f} was approved automatically.{bonus_msg}",
            notif_type="deposit", action_url="/wallet",
        )

        # Best-effort email — never blocks settlement.
        try:
            from packages.common.src.smtp_mail import (
                send_email, smtp_configured, fire_and_forget,
            )
            from packages.common.src.email_templates import render_deposit_confirmed
            from packages.common.src.config import get_settings as _gs
            if smtp_configured() and user_row.email:
                subject, html, text = render_deposit_confirmed(
                    first_name=user_row.first_name,
                    amount=deposit.amount,
                    currency="USD",
                    method="Crypto (NOWPayments)",
                    reference=str(deposit.id),
                    new_balance=user_row.main_wallet_balance,
                    trader_app_url=(_gs().TRADER_APP_URL or "https://trade.fxartha.com"),
                )
                fire_and_forget(send_email(user_row.email, subject, html, text=text))
                _send_bonus_emails_for_user(user_row, applied_bonuses)
        except Exception as _e:
            logger.warning("nowpayments deposit email failed: %s", _e)

    elif status in failure:
        deposit.status = "rejected"
        deposit.rejection_reason = f"NOWPayments payment {status}"
        _send_deposit_failed_email(
            user_row, deposit, status, method_label="Crypto (NOWPayments)",
        )
        await create_notification(
            db, deposit.user_id,
            title="Deposit not completed",
            message=f"Your ${float(deposit.amount):,.2f} crypto deposit {status}. Please try again.",
            notif_type="deposit", action_url="/wallet",
        )

    else:
        # Unknown / informational — log and bail without mutating state.
        logger.info("NOWPayments webhook: deposit %s status=%s (no action)", order_id, status)
        return

    await db.commit()
    logger.info("NOWPayments webhook: deposit %s → %s", order_id, deposit.status)


# ─── Withdrawals ──────────────────────────────────────────────────────────

async def create_withdrawal(req, user_id: UUID, db: AsyncSession) -> dict:
    from packages.common.src.settings_store import get_bool_setting
    if await get_bool_setting("maintenance_mode", False):
        raise HTTPException(status_code=503, detail="Platform is under maintenance. Withdrawals are temporarily disabled.")
    if not await get_bool_setting("allow_withdrawals", True):
        raise HTTPException(status_code=403, detail="Withdrawals are currently disabled")

    user_q = await db.execute(select(User).where(User.id == user_id))
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    main_bal = user_row.main_wallet_balance or Decimal("0")
    if main_bal < req.amount:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient main wallet balance. Available: ${float(main_bal):.2f}. "
                "Transfer profit from your trading accounts to your main wallet first (Wallet page)."
            ),
        )

    # SECURITY — withdrawals always go to the user's linked wallet, never
    # to whatever address the frontend sent. The trader UI shows the
    # linked address read-only, but this server-side check is what
    # actually enforces the rule. If the user has no wallet linked the
    # onboarding gate should have stopped them long before this point;
    # we raise a 400 anyway as a defensive check.
    linked = (user_row.wallet_address or "").strip().lower()
    if not linked:
        raise HTTPException(
            status_code=400,
            detail="Link a wallet to your account before requesting a withdrawal.",
        )
    requested = (getattr(req, "crypto_address", None) or "").strip().lower()
    if requested and requested != linked:
        raise HTTPException(
            status_code=400,
            detail="Withdrawals can only be sent to your linked wallet.",
        )

    withdrawal = Withdrawal(
        user_id=user_id,
        account_id=None,
        amount=req.amount,
        method=METHOD_MAP.get(req.method, "bank_transfer"),
        bank_details=getattr(req, "bank_details", None),
        crypto_address=linked,  # always the linked wallet, ignore client input
        status="pending",
    )
    db.add(withdrawal)
    await db.commit()
    await db.refresh(withdrawal)

    await create_notification(
        db, user_id,
        title="Withdrawal Submitted",
        message=f"${float(req.amount):,.2f} withdrawal via {req.method} is pending approval",
        notif_type="withdrawal", action_url="/wallet",
    )
    await db.commit()

    # Confirmation email — fire-and-forget so SMTP never blocks the response.
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import render_withdrawal_requested
        from packages.common.src.config import get_settings as _gs
        if smtp_configured() and user_row.email:
            destination_str: str | None = None
            if withdrawal.crypto_address:
                ca = str(withdrawal.crypto_address)
                # Mask middle of crypto address for the email log.
                destination_str = f"{ca[:6]}…{ca[-4:]}" if len(ca) > 12 else ca
            elif withdrawal.bank_details and isinstance(withdrawal.bank_details, dict):
                acct = withdrawal.bank_details.get("account_number") or ""
                if acct:
                    destination_str = f"Bank ****{str(acct)[-4:]}"
            subject, html, text = render_withdrawal_requested(
                first_name=user_row.first_name,
                amount=req.amount,
                currency="USD",
                method=req.method,
                destination=destination_str,
                request_id=str(withdrawal.id),
                trader_app_url=(_gs().TRADER_APP_URL or "https://trade.fxartha.com"),
            )
            fire_and_forget(send_email(user_row.email, subject, html, text=text))
    except Exception as _e:
        logger.warning("withdrawal-requested email failed: %s", _e)

    return {"id": str(withdrawal.id), "status": "pending", "amount": float(withdrawal.amount)}


async def create_manual_withdrawal(
    user_id: UUID,
    amount: Decimal,
    upi_id: str,
    payout_notes: str,
    file: UploadFile | None,
    db: AsyncSession,
) -> dict:
    from packages.common.src.settings_store import get_bool_setting
    if not await get_bool_setting("allow_withdrawals", True):
        raise HTTPException(status_code=403, detail="Withdrawals are currently disabled")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    upi = (upi_id or "").strip()
    notes = (payout_notes or "").strip()
    qr_path_str: str | None = None

    if file and file.filename:
        suffix = Path(file.filename).suffix.lower()
        if suffix not in DEPOSIT_PROOF_EXT:
            raise HTTPException(status_code=400, detail="Allowed file types for QR: JPG, PNG, PDF, WEBP")
        content = await file.read()
        if len(content) > MAX_PROOF_BYTES:
            raise HTTPException(status_code=400, detail="File too large (max 10 MB)")
        try:
            user_dir = safe_join_under_base(_wallet_upload_root(), "withdrawals", str(user_id))
        except PathTraversalError:
            raise HTTPException(status_code=400, detail="Invalid upload path")
        user_dir.mkdir(parents=True, exist_ok=True)
        safe = f"payout_qr_{uuid_lib.uuid4().hex}{suffix}"
        try:
            out_path = safe_join_under_base(user_dir, safe)
        except PathTraversalError:
            raise HTTPException(status_code=400, detail="Invalid file path")
        try:
            out_path.write_bytes(content)
        except OSError as e:
            logger.exception("manual withdrawal qr write failed: %s", out_path)
            raise HTTPException(status_code=503, detail="Could not save file") from e
        qr_path_str = str(out_path.resolve())

    if not upi and not qr_path_str:
        raise HTTPException(
            status_code=400,
            detail="Provide a UPI ID and/or upload a QR code image for manual payout.",
        )

    user_q = await db.execute(select(User).where(User.id == user_id))
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    main_bal = user_row.main_wallet_balance or Decimal("0")
    if main_bal < amount:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient main wallet balance. Available: ${float(main_bal):.2f}. "
                "Transfer profit from trading accounts first."
            ),
        )

    bank_details: dict = {
        "manual": True,
        "upi_id": upi or None,
        "notes": notes or None,
        "user_payout_qr_path": qr_path_str,
    }

    withdrawal = Withdrawal(
        user_id=user_id,
        account_id=None,
        amount=amount,
        method="manual",
        bank_details=bank_details,
        status="pending",
    )
    db.add(withdrawal)
    await db.commit()
    await db.refresh(withdrawal)

    await create_notification(
        db, user_id,
        title="Withdrawal Submitted",
        message=f"${float(amount):,.2f} manual withdrawal pending approval",
        notif_type="withdrawal", action_url="/wallet",
    )
    await db.commit()

    return {"id": str(withdrawal.id), "status": "pending", "amount": float(withdrawal.amount)}


# ─── Transfers ────────────────────────────────────────────────────────────

async def internal_wallet_transfer(req, user_id: UUID, db: AsyncSession) -> dict:
    if req.from_account_id == req.to_account_id:
        raise HTTPException(status_code=400, detail="Choose two different accounts")

    fq = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == req.from_account_id,
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        )
    )
    from_a = fq.scalar_one_or_none()
    tq = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == req.to_account_id,
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        )
    )
    to_a = tq.scalar_one_or_none()
    if not from_a or not to_a:
        raise HTTPException(status_code=404, detail="Account not found")

    amt = Decimal(str(req.amount))
    free = (from_a.balance or Decimal("0")) - (from_a.margin_used or Decimal("0"))
    if free < amt:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient available balance on the source account. "
                f"Available: ${float(free):.2f} (${float(from_a.margin_used or 0):.2f} locked in open trades)."
            ),
        )

    from_a.balance = (from_a.balance or Decimal("0")) - amt
    from_a.equity = from_a.balance + (from_a.credit or Decimal("0"))
    from_a.free_margin = from_a.equity - (from_a.margin_used or Decimal("0"))

    to_a.balance = (to_a.balance or Decimal("0")) + amt
    to_a.equity = to_a.balance + (to_a.credit or Decimal("0"))
    to_a.free_margin = to_a.equity - (to_a.margin_used or Decimal("0"))

    db.add(Transaction(
        user_id=user_id, account_id=from_a.id, type="transfer",
        amount=-amt, balance_after=from_a.balance,
        description=f"Transfer to {to_a.account_number}",
    ))
    db.add(Transaction(
        user_id=user_id, account_id=to_a.id, type="transfer",
        amount=amt, balance_after=to_a.balance,
        description=f"Transfer from {from_a.account_number}",
    ))
    await db.commit()

    return {
        "message": "Transfer completed.",
        "from_balance": float(from_a.balance),
        "to_balance": float(to_a.balance),
    }


async def transfer_trading_to_main(req, user_id: UUID, db: AsyncSession) -> dict:
    amt = Decimal(str(req.amount))

    acc_q = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == req.from_account_id,
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        )
    )
    account = acc_q.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")

    free = (account.balance or Decimal("0")) - (account.margin_used or Decimal("0"))
    if free < amt:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient available balance on this trading account. "
                f"Available: ${float(free):.2f} (${float(account.margin_used or 0):.2f} locked in open trades)."
            ),
        )

    user_q = await db.execute(select(User).where(User.id == user_id))
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    account.balance = (account.balance or Decimal("0")) - amt
    account.equity = account.balance + (account.credit or Decimal("0"))
    account.free_margin = account.equity - (account.margin_used or Decimal("0"))

    user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + amt

    db.add(Transaction(
        user_id=user_id, account_id=account.id, type="transfer",
        amount=-amt, balance_after=account.balance,
        description="Transfer to main wallet",
    ))
    db.add(Transaction(
        user_id=user_id, account_id=None, type="transfer",
        amount=amt, balance_after=user_row.main_wallet_balance,
        description=f"From trading account {account.account_number}",
    ))
    await db.commit()

    return {
        "message": "Funds moved to main wallet.",
        "main_wallet_balance": float(user_row.main_wallet_balance),
        "trading_balance": float(account.balance),
    }


async def transfer_main_to_trading(req, user_id: UUID, db: AsyncSession) -> dict:
    amt = Decimal(str(req.amount))

    user_q = await db.execute(select(User).where(User.id == user_id))
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    main_bal = user_row.main_wallet_balance or Decimal("0")
    if main_bal < amt:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient main wallet balance. Available: ${float(main_bal):.2f}",
        )

    acc_q = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == req.to_account_id,
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        )
    )
    account = acc_q.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")

    user_row.main_wallet_balance = main_bal - amt
    account.balance = (account.balance or Decimal("0")) + amt
    account.equity = account.balance + (account.credit or Decimal("0"))
    account.free_margin = account.equity - (account.margin_used or Decimal("0"))

    db.add(Transaction(
        user_id=user_id, account_id=None, type="transfer",
        amount=-amt, balance_after=user_row.main_wallet_balance,
        description=f"To trading account {account.account_number}",
    ))
    db.add(Transaction(
        user_id=user_id, account_id=account.id, type="transfer",
        amount=amt, balance_after=account.balance,
        description="Transfer from main wallet",
    ))
    await db.commit()

    return {
        "message": "Funds moved to trading account.",
        "main_wallet_balance": float(user_row.main_wallet_balance),
        "trading_balance": float(account.balance),
    }


# ─── Queries ──────────────────────────────────────────────────────────────

async def list_deposits(user_id: UUID, db: AsyncSession) -> dict:
    # Exclude 'initiated' deposits (OxaPay payments that were never started)
    query = (
        select(Deposit)
        .where(
            Deposit.user_id == user_id,
            Deposit.status != "initiated"
        )
        .order_by(Deposit.created_at.desc())
    )
    result = await db.execute(query)
    deposits = result.scalars().all()
    return {
        "items": [
            {
                "id": str(d.id),
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "type": "deposit",
                "method": d.method or "bank",
                "amount": float(d.amount or 0),
                "status": d.status or "pending",
                "currency": "USD",
            }
            for d in deposits
        ]
    }


async def list_withdrawals(user_id: UUID, db: AsyncSession) -> dict:
    query = (
        select(Withdrawal)
        .where(Withdrawal.user_id == user_id)
        .order_by(Withdrawal.created_at.desc())
    )
    result = await db.execute(query)
    withdrawals = result.scalars().all()
    return {
        "items": [
            {
                "id": str(w.id),
                "created_at": w.created_at.isoformat() if w.created_at else None,
                "type": "withdrawal",
                "method": w.method or "bank",
                "amount": float(w.amount or 0),
                "status": w.status or "pending",
                "currency": "USD",
            }
            for w in withdrawals
        ]
    }


def _ledger_entry_method(txn_type: str | None) -> str:
    t = (txn_type or "").lower()
    if t == "transfer":
        return "Internal transfer"
    if t in ("adjustment", "credit"):
        return "Admin adjustment"
    if t == "profit":
        return "Trading — profit"
    if t == "loss":
        return "Trading — loss"
    return t.replace("_", " ").title() if t else "Ledger"


async def list_transactions(user_id: UUID, account_id: UUID | None, db: AsyncSession) -> dict:
    if account_id:
        acct = await db.execute(
            select(TradingAccount).where(
                TradingAccount.id == account_id,
                TradingAccount.user_id == user_id,
            )
        )
        if not acct.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Account not found")
        query = select(Transaction).where(Transaction.account_id == account_id)
    else:
        query = select(Transaction).where(Transaction.user_id == user_id)

    query = query.order_by(Transaction.created_at.desc()).limit(500)
    result = await db.execute(query)
    txns = result.scalars().all()

    return {
        "items": [
            {
                "id": str(t.id),
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "type": t.type or "adjustment",
                "method": _ledger_entry_method(t.type),
                "amount": float(t.amount or 0),
                "status": "completed",
                "currency": "USD",
                "description": (t.description or "").strip(),
                "account_id": str(t.account_id) if t.account_id else None,
            }
            for t in txns
        ]
    }


async def wallet_summary(user_id: UUID, account_id: UUID | None, db: AsyncSession) -> dict:
    user_q = await db.execute(select(User).where(User.id == user_id))
    user_row = user_q.scalar_one_or_none()
    main_wallet_balance = float(user_row.main_wallet_balance or 0) if user_row else 0.0

    dep_glob = await db.execute(
        select(func.coalesce(func.sum(Deposit.amount), 0)).where(
            Deposit.user_id == user_id,
            Deposit.status.in_(["approved", "auto_approved"]),
        )
    )
    total_deposited = float(dep_glob.scalar() or 0)

    wd_glob = await db.execute(
        select(func.coalesce(func.sum(Withdrawal.amount), 0)).where(
            Withdrawal.user_id == user_id,
            Withdrawal.status.in_(["approved", "completed"]),
        )
    )
    total_withdrawn = float(wd_glob.scalar() or 0)

    adj_main_in = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.account_id.is_(None),
            Transaction.type.in_(["adjustment", "credit"]),
            Transaction.amount > 0,
        )
    )
    adj_main_out = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.account_id.is_(None),
            Transaction.type.in_(["adjustment", "credit"]),
            Transaction.amount < 0,
        )
    )
    total_deposited += float(adj_main_in.scalar() or 0)
    total_withdrawn += abs(float(adj_main_out.scalar() or 0))

    acct_q = await db.execute(
        select(TradingAccount)
        .where(
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
            TradingAccount.is_active == True,
        )
        .order_by(TradingAccount.created_at)
    )
    live_list = list(acct_q.scalars().all())

    live_accounts_payload = [
        {
            "id": str(a.id),
            "account_number": a.account_number,
            "balance": float(a.balance or 0),
            "credit": float(a.credit or 0),
            "margin_used": float(a.margin_used or 0),
            "currency": a.currency or "USD",
            "free_margin": float((a.balance or Decimal("0")) - (a.margin_used or Decimal("0"))),
        }
        for a in live_list
    ]
    total_live_balance = sum(float(a.balance or 0) for a in live_list)

    if not live_list:
        return {
            "main_wallet_balance": main_wallet_balance,
            "balance": 0, "credit": 0, "equity": 0, "margin_used": 0, "free_margin": 0,
            "total_deposited": total_deposited, "total_withdrawn": total_withdrawn,
            "total_live_balance": 0, "live_accounts": [],
        }

    if account_id is not None:
        account = next((a for a in live_list if a.id == account_id), None)
        if not account:
            raise HTTPException(status_code=404, detail="Live account not found")
        accounts_for_metrics = [account]
    else:
        accounts_for_metrics = live_list

    total_credit = Decimal("0")
    total_equity = Decimal("0")
    total_margin = Decimal("0")
    total_free = Decimal("0")

    for acc in accounts_for_metrics:
        total_credit += acc.credit or Decimal("0")
        total_equity += acc.equity or acc.balance or Decimal("0")
        total_margin += acc.margin_used or Decimal("0")
        bal = acc.balance or Decimal("0")
        mu = acc.margin_used or Decimal("0")
        total_free += bal - mu

    primary_balance = float(account.balance or 0) if account_id is not None else total_live_balance

    return {
        "main_wallet_balance": main_wallet_balance,
        "balance": primary_balance,
        "credit": float(total_credit),
        "equity": float(total_equity),
        "margin_used": float(total_margin),
        "free_margin": float(total_free),
        "total_deposited": total_deposited,
        "total_withdrawn": total_withdrawn,
        "total_live_balance": total_live_balance,
        "live_accounts": live_accounts_payload,
    }


async def get_deposit_bank_details(amount: Decimal | None, db: AsyncSession) -> dict:
    bank = None
    if amount is not None and amount > 0:
        bank = await _get_bank_for_tier(amount, db)
        await db.commit()
    if bank is None:
        result = await db.execute(
            select(BankAccount)
            .where(BankAccount.is_active == True)
            .order_by(BankAccount.rotation_order)
            .limit(1)
        )
        bank = result.scalars().first()
    if not bank:
        return {}

    resp: dict = {}
    if bank.bank_name:
        resp["bank_name"] = bank.bank_name
    if bank.account_name:
        resp["account_holder"] = bank.account_name
    if bank.account_number:
        resp["account_number"] = bank.account_number
    if bank.ifsc_code:
        resp["ifsc_code"] = bank.ifsc_code
    if bank.upi_id:
        resp["upi_id"] = bank.upi_id
    if bank.qr_code_url:
        resp["qr_code_url"] = bank.qr_code_url
    return resp


async def get_bank_info(amount: Decimal, db: AsyncSession) -> dict:
    bank = await _get_bank_for_tier(amount, db)
    if not bank:
        raise HTTPException(status_code=404, detail="No bank account available for this amount")
    await db.commit()
    return {
        "bank_name": bank.bank_name,
        "account_name": bank.account_name,
        "account_number": bank.account_number,
        "ifsc_code": bank.ifsc_code,
        "upi_id": bank.upi_id,
        "qr_code_url": bank.qr_code_url,
    }


# ─────────────────────────────────────────────────────────────────────
# Trade insurance — fee debit
# (Payouts are credited inside packages.common.src.insurance.claims so
#  the credit + InsuranceClaim INSERT are atomic with position close.)
# ─────────────────────────────────────────────────────────────────────

async def charge_insurance_fee(
    *,
    db: AsyncSession,
    user_id: UUID,
    amount: Decimal,
    policy_id: UUID,
    description: str,
) -> Decimal:
    """Debit `amount` from the user's main wallet for an insurance fee.
    Caller is responsible for `db.commit()`. Raises 402 if balance is short.

    Returns the user's new main_wallet_balance.
    """
    user = (await db.execute(select(User).where(User.id == user_id).with_for_update())).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    bal = Decimal(str(user.main_wallet_balance or 0))
    if bal < amount:
        raise HTTPException(status_code=402, detail="insufficient_balance")

    new_balance = bal - amount
    user.main_wallet_balance = new_balance

    db.add(Transaction(
        id=uuid_lib.uuid4(),
        user_id=user_id,
        account_id=None,
        type="insurance_fee",
        amount=-amount,
        balance_after=new_balance,
        reference_id=policy_id,
        description=description,
    ))
    return new_balance
