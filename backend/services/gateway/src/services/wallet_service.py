"""Wallet Service — Deposits, withdrawals, transfers, wallet summary.

Concurrency / lock-order rule
-----------------------------
Every balance-mutating path in this module MUST acquire row locks in
this canonical order, ascending. Locks taken out of order will deadlock
under concurrent traffic (process A waits for B's User row while B
waits for A's TradingAccount row).

    1. User                  (the higher-level row — holds main_wallet_balance)
    2. TradingAccount        (when two are involved, by ascending UUID)
    3. Deposit / Withdrawal  (the per-transaction row — innermost)

If a path only mutates a TradingAccount (e.g. give_credit), still skip
the User lock — the rule is "every lock you take, you take in this
order", not "always lock every row". Skipping is fine; reordering is not.

When in doubt, mirror
`services/admin/services/deposit_service.approve_deposit` — the
canonical reference (Deposit → User → tagged TradingAccount, all with
`with_for_update()`)."""
import logging
import uuid as uuid_lib
from pathlib import Path
from decimal import Decimal, InvalidOperation
from uuid import UUID
from datetime import datetime

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    BankAccount, BonusOffer, Deposit, Transaction, TradingAccount, User,
    UserBonus, Withdrawal,
)
from packages.common.src.notify import create_notification
from packages.common.src.config import get_settings
from packages.common.src.path_safety import PathTraversalError, safe_join_under_base
from packages.common.src.email_branding import apply_email_brand
from packages.common.src.withdrawal_limits import available_to_withdraw
from packages.common.src.bonus_service import apply_deposit_bonus, outstanding_bonus
from . import oxapay_service, razorpay_service

logger = logging.getLogger("wallet_service")


async def _resolve_credit_target(db, user_id, preference: str | None = None):
    """Decide where an incoming crypto deposit / refund should land.

    `preference` lets the caller honor an explicit user choice:
      - "wallet" → force wallet-bound trading account (errors if
        the user doesn't have one)
      - "main"   → force legacy main_wallet_balance
      - None / unset → auto-route: wallet-bound if exists, else main

    Returns a tuple ``(target_kind, target_row)``:
      - ``("trading", trading_account)`` when wallet-bound is chosen
      - ``("main_wallet", user_row)`` otherwise

    Caller is responsible for the actual balance update (this helper
    only resolves which row to mutate).
    """
    from .account_service import get_wallet_account
    pref = (preference or "").strip().lower() or None

    user_row = (await db.execute(
        select(User).where(User.id == user_id)
    )).scalar_one_or_none()

    if pref == "main":
        return ("main_wallet", user_row)

    wallet_acc = await get_wallet_account(user_id, db)

    if pref == "wallet":
        if wallet_acc is None:
            # User asked for wallet-bound credit but doesn't have one.
            # Fall back to main_wallet rather than failing the deposit;
            # downstream code logs a warning so support can spot the
            # mismatch later.
            return ("main_wallet", user_row)
        return ("trading", wallet_acc)

    # Auto-route default.
    if wallet_acc is not None:
        return ("trading", wallet_acc)
    return ("main_wallet", user_row)


async def _resolve_debit_source(db, user_id, preference: str | None = None):
    """Decide which balance to debit when the user requests a withdrawal.

    Mirrors `_resolve_credit_target`'s preference handling. Returns
    ``(source_kind, source_row)``.
    """
    return await _resolve_credit_target(db, user_id, preference)


async def _credit_from_deposit_row(db, deposit, user_row):
    """Webhook-side credit resolver.

    Reads the Deposit row's tagged `account_id` (set at submit time
    when the user explicitly chose "Wallet Account"). If set, returns
    that trading account for crediting. Otherwise auto-routes via the
    standard resolver (wallet-bound if present, else main_wallet).

    Returns the same ``(target_kind, target_row)`` shape as
    `_resolve_credit_target`.
    """
    if getattr(deposit, "account_id", None):
        from packages.common.src.models import TradingAccount as _TA
        acc = (await db.execute(
            select(_TA).where(
                _TA.id == deposit.account_id,
                _TA.user_id == deposit.user_id,
                _TA.is_active.is_(True),
            ).with_for_update().limit(1)
        )).scalar_one_or_none()
        if acc is not None:
            return ("trading", acc)
        # Tagged account no longer exists / was closed — fall through
        # to the resolver so the deposit still credits something.
        logger.warning(
            "Deposit %s tagged account_id=%s no longer active; falling back to resolver",
            deposit.id, deposit.account_id,
        )
    return await _resolve_credit_target(db, deposit.user_id)


async def _resolve_deposit_target_account_id(db, user_id, target: str | None):
    """At deposit-creation time, decide whether the row should carry a
    target account_id (forcing the webhook to credit a trading account)
    or leave it NULL (legacy main_wallet flow / auto-route).

    Honors the user's explicit choice at submit time:
      - target == "wallet" → look up the user's wallet-bound account
        and return its id. Falls back to None if they don't have one.
      - target == "main"   → return None (explicit main_wallet route).
      - None / unset       → return None (webhook resolver will
        auto-route at credit time).

    The webhook handler treats deposit.account_id as authoritative when
    set; only falls through to the resolver when it's NULL.
    """
    pref = (target or "").strip().lower() or None
    if pref == "wallet":
        from .account_service import get_wallet_account
        acc = await get_wallet_account(user_id, db)
        return acc.id if acc is not None else None
    return None


async def send_withdrawal_requested_email(
    db, withdrawal, user_row=None, method_label: str | None = None,
) -> None:
    """Fire-and-forget confirmation email when a withdrawal request is
    created. Safe to call from any withdrawal-creation path (legacy
    bank/crypto, on-chain WalletConnect, manual UPI) — handles missing
    user row, missing SMTP config, missing email gracefully.
    Includes the withdrawal request ID so support can correlate. The
    actual on-chain tx_hash isn't known at this stage; the "your
    withdrawal has been paid" email (sent on mark-paid) carries that."""
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import render_withdrawal_requested
        from packages.common.src.config import get_settings as _gs
        if not smtp_configured():
            return
        if user_row is None:
            user_row = (await db.execute(
                select(User).where(User.id == withdrawal.user_id)
            )).scalar_one_or_none()
        if not user_row or not user_row.email:
            return
        destination_str: str | None = None
        if withdrawal.crypto_address:
            ca = str(withdrawal.crypto_address)
            destination_str = f"{ca[:6]}…{ca[-4:]}" if len(ca) > 12 else ca
        elif withdrawal.bank_details and isinstance(withdrawal.bank_details, dict):
            acct = withdrawal.bank_details.get("account_number") or ""
            upi = withdrawal.bank_details.get("upi_id") or ""
            if acct:
                destination_str = f"Bank ****{str(acct)[-4:]}"
            elif upi:
                destination_str = f"UPI {upi}"
        await apply_email_brand(db, user_row)
        subject, html, text = render_withdrawal_requested(
            first_name=user_row.first_name,
            amount=withdrawal.amount,
            currency=withdrawal.currency or "USD",
            method=method_label or withdrawal.method or "manual",
            destination=destination_str,
            request_id=str(withdrawal.id),
            trader_app_url=(_gs().TRADER_APP_URL or "https://trade.swisscresta.com"),
        )
        fire_and_forget(send_email(user_row.email, subject, html, text=text))
    except Exception as _e:
        logger.warning("withdrawal-requested email failed: %s", _e)


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
    "razorpay": "razorpay",
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
        app_url = (getattr(st, "TRADER_APP_URL", None) or "https://trade.swisscresta.com")
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
        app_url = (getattr(st, "TRADER_APP_URL", None) or "https://trade.swisscresta.com")
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


def _safe_stored_upload(stored: str | None) -> str | None:
    """C-ADMIN-1 (write-time): only persist a screenshot/proof path we can
    confine to the uploads tree. The generic create_deposit accepts a
    client-supplied screenshot_url; a crafted absolute or ``..`` value would
    later be handed to the admin download endpoint. Drop anything we can't
    confine (server-written upload paths always pass)."""
    if not stored:
        return None
    raw = get_settings().WALLET_UPLOAD_ROOT.strip() or "uploads/wallet"
    base = Path(raw)
    if not base.is_absolute():
        base = Path.cwd() / base
    base = base.resolve().parent
    try:
        p = Path(stored)
        rel = p.resolve().relative_to(base) if p.is_absolute() else Path(stored)
        safe_join_under_base(base, *rel.parts)
    except (ValueError, PathTraversalError):
        return None
    return stored


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
    # history. OxaPay is kept mounted for in-flight + historical deposits.
    # Razorpay deposits use the dedicated /deposit/razorpay/order endpoint,
    # not this generic create_deposit path.
    settings = get_settings()
    crypto_currency = getattr(req, "crypto_currency", None)
    is_oxapay = db_method == "oxapay" and bool(settings.OXAPAY_MERCHANT_KEY)
    is_automated_crypto = is_oxapay

    deposit = Deposit(
        user_id=user_id,
        account_id=req.account_id if req.account_id else None,
        amount=req.amount,
        method=db_method,
        transaction_id=req.transaction_id,
        screenshot_url=_safe_stored_upload(req.screenshot_url),
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
                description=f"SwissCresta deposit ${float(req.amount):,.2f}",
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

    # Notify ONLY for manual methods, where submitting genuinely files a
    # request that awaits admin approval. Automated crypto (OxaPay) deposits
    # are merely 'initiated' here — the user hasn't paid anything yet, so a
    # "submitted / pending approval" notification (and history entry) would be
    # false; the webhook notifies once a real payment is detected.
    if not is_automated_crypto:
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

    # Lock the Deposit row so a concurrent admin "approve" (or a
    # re-delivered IPN — payment providers retry routinely) can't both
    # flip pending → auto_approved and credit twice. The status guard
    # below makes the second writer fail cleanly.
    result = await db.execute(
        select(Deposit).where(Deposit.id == deposit_uuid).with_for_update()
    )
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

    # 'waiting' fires as soon as the invoice is CREATED — the user may just
    # have opened (or immediately abandoned) the payment page, no money moved.
    # Keep the deposit invisible ('initiated'); do NOT promote or notify.
    if oxapay_status == "waiting":
        logger.info("OxaPay webhook: deposit %s waiting (invoice open, no payment yet)", order_id)
        return

    # 'confirming' means a real on-chain payment was detected — NOW surface the
    # deposit (history + admin queue) and tell the user.
    if oxapay_status == "confirming" and deposit.status == "initiated":
        deposit.status = "pending"
        await create_notification(
            db, deposit.user_id,
            title="Deposit detected",
            message=f"Your ${float(deposit.amount):,.2f} crypto deposit was received and is confirming on-chain.",
            notif_type="deposit", action_url="/wallet",
        )
        await db.commit()
        logger.info("OxaPay webhook: deposit %s → pending (payment confirming)", order_id)
        return

    if oxapay_status == "paid":
        # Phase 3 (OxaPay amount binding): the credited amount is always the
        # recorded deposit.amount, never a client value. As a tamper check, if
        # the callback echoes a USD invoice amount that does NOT match our
        # record, do not auto-credit — route to manual review. (OxaPay only
        # sends 'paid' on full settlement; underpayment arrives as a different
        # status and is not credited here.)
        _cb_amount = None
        for _k in ("amount", "price_amount", "priceAmount"):
            if payload.get(_k) is not None:
                try:
                    _cb_amount = Decimal(str(payload.get(_k)))
                    break
                except (InvalidOperation, ValueError, TypeError):
                    continue
        if _cb_amount is not None and abs(_cb_amount - (deposit.amount or Decimal("0"))) > Decimal("0.01"):
            deposit.status = "manual_review"
            deposit.rejection_reason = (
                f"oxapay_amount_mismatch callback={_cb_amount} expected={deposit.amount}"
            )
            await db.commit()
            logger.error(
                "OxaPay webhook: amount mismatch deposit=%s callback=%s expected=%s → manual_review",
                order_id, _cb_amount, deposit.amount,
            )
            return

        deposit.status = "auto_approved"
        deposit.approved_at = datetime.utcnow()

        # Lock User row BEFORE crediting main_wallet_balance — see
        # NOWPayments handler for full rationale. Lock order is Deposit
        # (above) → User → tagged TradingAccount.
        user_q = await db.execute(
            select(User).where(User.id == deposit.user_id).with_for_update()
        )
        user_row = user_q.scalar_one_or_none()
        if not user_row:
            logger.error("OxaPay webhook: user not found for deposit %s", order_id)
            return

        # If the deposit row was tagged with a target account_id at
        # submit time (user picked "Wallet Account" in the UI), honor
        # that explicit choice. Otherwise auto-route via the resolver.
        target_kind, target_row = await _credit_from_deposit_row(
            db, deposit, user_row,
        )
        if target_kind == "trading":
            target_row.balance = (target_row.balance or Decimal("0")) + deposit.amount
            target_row.equity = (target_row.equity or Decimal("0")) + deposit.amount
            target_row.free_margin = (target_row.free_margin or Decimal("0")) + deposit.amount
            db.add(Transaction(
                user_id=deposit.user_id,
                account_id=target_row.id,
                type="deposit",
                amount=deposit.amount,
                balance_after=target_row.balance,
                reference_id=deposit.id,
                description="Deposit to wallet account - oxapay (auto)",
            ))
        else:
            user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + deposit.amount
            db.add(Transaction(
                user_id=deposit.user_id,
                account_id=None,
                type="deposit",
                amount=deposit.amount,
                balance_after=user_row.main_wallet_balance,
                reference_id=deposit.id,
                description="Deposit to main wallet - oxapay (auto)",
            ))

        # H-MONEY-2: single, dedup-guarded bonus application (was an inline copy).
        applied_bonuses = await apply_deposit_bonus(db, user_row, deposit)
        bonus_msg = "".join(
            f" + ${float(a):.2f} bonus ({n})" for n, a in applied_bonuses
        )

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
            await apply_email_brand(db, user_row)
            if smtp_configured() and user_row.email:
                subject, html, text = render_deposit_confirmed(
                    first_name=user_row.first_name,
                    amount=deposit.amount,
                    currency="USD",
                    method="Crypto (OxaPay)",
                    reference=str(deposit.id),
                    new_balance=user_row.main_wallet_balance,
                    trader_app_url=(_gs().TRADER_APP_URL or "https://trade.swisscresta.com"),
                )
                fire_and_forget(send_email(user_row.email, subject, html, text=text))
                _send_bonus_emails_for_user(user_row, applied_bonuses)
        except Exception as _e:
            logger.warning("oxapay deposit email failed: %s", _e)

    elif oxapay_status in ("expired", "failed"):
        was_visible = deposit.status == "pending"
        deposit.status = "rejected"
        deposit.rejection_reason = f"OxaPay payment {oxapay_status}"
        # Only notify/email when a payment had actually started ('pending').
        # An 'initiated' deposit expiring is just an abandoned invoice — the
        # user never paid, so there is nothing to tell them about.
        if was_visible:
            await create_notification(
                db, deposit.user_id,
                title="Deposit not completed",
                message=f"Your ${float(deposit.amount):,.2f} crypto deposit {oxapay_status}. Please try again.",
                notif_type="deposit", action_url="/wallet",
            )
            fail_user_q = await db.execute(
                select(User).where(User.id == deposit.user_id)
            )
            fail_user = fail_user_q.scalar_one_or_none()
            if fail_user:
                await apply_email_brand(db, fail_user)
                _send_deposit_failed_email(
                    fail_user, deposit, oxapay_status, method_label="Crypto (OxaPay)",
                )

    else:
        # "waiting", "confirming" — informational only
        logger.info("OxaPay webhook: deposit %s status=%s (no action)", order_id, oxapay_status)
        return

    await db.commit()
    logger.info("OxaPay webhook: deposit %s → %s", order_id, deposit.status)


# ─── Local Banking deposit request (admin-mediated) ────────────────────────


async def create_local_banking_request(
    *,
    amount: Decimal,
    user_id: UUID,
    db: AsyncSession,
) -> dict:
    """Stage-1 of the local-banking flow: user submits a request, no amount.

    A Deposit row is created with method='local_banking', status='pending',
    amount=0 (the user doesn't specify upfront — admin works it out with
    them and updates the amount before marking the deposit approved).
    Admin reviews the user's KYC and then attaches a payment_link
    (Razorpay payment-link / UPI VPA / bank instructions — admin's choice
    per case) through the admin panel. User pays externally and the admin
    marks the deposit 'approved' with the actual paid amount, crediting
    the main wallet through the standard manual-approval flow.

    No KYC gate here — platform policy is deposit/trade freely, verify
    identity at withdrawal time (assert_kyc_approved_for_withdrawal).
    Admin still reviews each request manually before sharing payment rails.
    """
    from packages.common.src.settings_store import get_bool_setting

    if await get_bool_setting("maintenance_mode", False):
        raise HTTPException(status_code=503, detail="Platform is under maintenance.")
    if not await get_bool_setting("allow_deposits", True):
        raise HTTPException(status_code=403, detail="Deposits are currently disabled")

    # Negative amounts are still invalid, but zero is the new normal — the
    # user just signalled intent to deposit; admin fills in the figure.
    if amount < 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    user_row = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user_row is None:
        raise HTTPException(status_code=404, detail="User not found")

    deposit = Deposit(
        user_id=user_id,
        account_id=None,
        amount=amount,
        method="local_banking",
        status="pending",
    )
    db.add(deposit)
    await db.commit()
    await db.refresh(deposit)

    await create_notification(
        db, user_id,
        title="Deposit request submitted",
        message=(
            "Your local banking deposit request has been submitted. Our team "
            "will review your KYC and share payment details with you shortly."
        ),
        notif_type="deposit",
        action_url="/wallet?tab=deposit",
    )

    logger.info("Local banking request created: deposit=%s user=%s amount=%s", deposit.id, user_id, amount)

    # Ping every admin / super-admin: in-app notification (bell icon) +
    # email. Best-effort — a delivery failure here must never roll back
    # the user's submission.
    try:
        from packages.common.src.notify import notify_all_admins
        await notify_all_admins(
            db,
            title="New local banking deposit request",
            message=f"{user_row.email} just submitted a request. Open Deposits to attach a payment link.",
            notif_type="deposit",
            action_url="/deposits",
        )
        await db.commit()
    except Exception as e:  # pragma: no cover
        logger.warning("admin in-app notify (request) failed: %s", e)

    try:
        await _email_admins_local_banking_event(
            db,
            subject="New local banking deposit request",
            heading="A user just submitted a new deposit request",
            body_lines=[
                f"User: {user_row.email}",
                "Stage: awaiting admin review",
                "Action: open the admin Deposits queue and use Set Link to share payment details.",
            ],
        )
    except Exception as e:  # pragma: no cover
        logger.warning("admin email notify (request) failed: %s", e)

    return {
        "deposit_id": str(deposit.id),
        "amount": float(amount),
        "status": deposit.status,
        "message": "Request submitted — awaiting admin review.",
    }


async def _email_admins_local_banking_event(
    db: AsyncSession,
    *,
    subject: str,
    heading: str,
    body_lines: list[str],
) -> None:
    """Fan out a one-line transactional email to every admin / super-admin.
    Used to flag local-banking stage transitions (new request, proof
    submitted) so the queue gets attention without admins having to poll
    the deposits page."""
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates.base import render_layout
        from packages.common.src.config import get_settings as _gs
    except ImportError:
        return
    if not smtp_configured():
        return

    admins_q = await db.execute(
        select(User).where(User.role.in_(["admin", "super_admin"]))
    )
    admins = admins_q.scalars().all()
    if not admins:
        return

    admin_app_url = (_gs().ADMIN_APP_URL or "https://admin.swisscresta.com").rstrip("/")
    body_html = (
        "<p>" + "</p><p>".join(body_lines) + "</p>"
    )
    html = render_layout(
        title=heading,
        intro="A local banking deposit needs your attention.",
        body_html=body_html,
        cta_label="Open Admin Deposits",
        cta_url=f"{admin_app_url}/deposits",
    )
    for a in admins:
        if not a.email:
            continue
        fire_and_forget(send_email(a.email, subject, html))


async def confirm_local_banking_payment(
    *,
    deposit_id: UUID,
    user_id: UUID,
    amount: Decimal,
    transaction_id: str,
    file: UploadFile,
    db: AsyncSession,
) -> dict:
    """Stage-3 of the local-banking flow: after the admin has shared a payment
    link, the user pays externally and confirms the payment here by entering
    the actual amount paid and uploading proof (UPI screenshot / bank receipt).

    Updates the existing Deposit row in place — amount goes from 0 to the real
    figure, screenshot_url + transaction_id are populated. Status stays
    'pending' so the admin still has the final approval step; this just gives
    them the evidence to do it.

    Idempotent against the same deposit_id being confirmed twice — we refuse
    if the deposit is already approved/rejected, or if it was never given a
    payment link in the first place.
    """
    deposit_q = await db.execute(
        select(Deposit).where(
            Deposit.id == deposit_id,
            Deposit.user_id == user_id,
            Deposit.method == "local_banking",
        ).with_for_update()
    )
    deposit = deposit_q.scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.status != "pending":
        raise HTTPException(status_code=400, detail="Deposit already finalised")
    if not deposit.payment_link:
        raise HTTPException(
            status_code=400,
            detail="Wait for the admin to share payment details before confirming.",
        )

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Enter the amount you paid")

    tid = (transaction_id or "").strip()
    if not tid:
        raise HTTPException(
            status_code=400,
            detail="Transaction reference (UTR / UPI reference) is required",
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="Payment proof file is required")
    suffix = Path(file.filename).suffix.lower()
    if suffix not in DEPOSIT_PROOF_EXT:
        raise HTTPException(status_code=400, detail="Allowed file types: JPG, PNG, PDF, WEBP")
    content = await file.read()
    if len(content) > MAX_PROOF_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    from packages.common.src.file_validation import validate_upload
    try:
        suffix = validate_upload(
            content, suffix,
            allowed_extensions=DEPOSIT_PROOF_EXT,
            label="Payment proof",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        user_dir = safe_join_under_base(_wallet_upload_root(), "deposits", str(user_id))
    except PathTraversalError:
        raise HTTPException(status_code=400, detail="Invalid upload path")
    user_dir.mkdir(parents=True, exist_ok=True)
    safe = f"local_banking_{uuid_lib.uuid4().hex}{suffix}"
    try:
        out_path = safe_join_under_base(user_dir, safe)
    except PathTraversalError:
        raise HTTPException(status_code=400, detail="Invalid file path")
    try:
        out_path.write_bytes(content)
    except OSError as e:
        logger.exception("local banking proof write failed: %s", out_path)
        raise HTTPException(status_code=503, detail="Could not save file") from e

    deposit.amount = amount
    deposit.transaction_id = tid
    deposit.screenshot_url = str(out_path.resolve())

    await create_notification(
        db, user_id,
        title="Payment proof received",
        message=(
            f"We received your proof of payment for ${float(amount):,.2f}. "
            "Our team will verify and credit your wallet shortly."
        ),
        notif_type="deposit",
        action_url="/wallet?tab=deposit",
        commit=False,
    )

    await db.commit()
    await db.refresh(deposit)

    logger.info(
        "Local banking payment confirmed: deposit=%s user=%s amount=%s",
        deposit.id, user_id, amount,
    )

    # Tell every admin the proof is in: bell icon + email. Best-effort.
    user_q = await db.execute(select(User).where(User.id == user_id))
    user_row = user_q.scalar_one_or_none()
    try:
        from packages.common.src.notify import notify_all_admins
        await notify_all_admins(
            db,
            title="Payment proof uploaded",
            message=(
                f"{(user_row.email if user_row else 'A user')} uploaded "
                f"${float(amount):,.2f} proof. Verify and approve in Deposits."
            ),
            notif_type="deposit",
            action_url="/deposits",
        )
        await db.commit()
    except Exception as e:  # pragma: no cover
        logger.warning("admin in-app notify (proof) failed: %s", e)

    try:
        await _email_admins_local_banking_event(
            db,
            subject="Local banking payment proof received",
            heading="A user has uploaded payment proof",
            body_lines=[
                f"User: {user_row.email if user_row else '—'}",
                f"Amount: ${float(amount):,.2f}",
                f"Reference: {tid}",
                "Action: open the admin Deposits queue, click the screenshot icon to verify, then Approve.",
            ],
        )
    except Exception as e:  # pragma: no cover
        logger.warning("admin email notify (proof) failed: %s", e)

    return {
        "deposit_id": str(deposit.id),
        "amount": float(deposit.amount or 0),
        "status": deposit.status,
        "message": "Payment proof submitted — awaiting admin confirmation.",
    }


# ─── Razorpay deposit (Checkout popup, charged in INR) ─────────────────────


async def create_razorpay_deposit(
    *,
    amount: Decimal,
    account_target: str | None,
    user_id: UUID,
    db: AsyncSession,
) -> dict:
    """Create a *pending* Deposit row + a Razorpay order.

    The user enters a USD amount (`amount`); the order is charged in INR by
    razorpay_service.create_order. The order id is stamped onto the deposit's
    `transaction_id` so the verify endpoint and the webhook can both look the
    row up by Razorpay order id. Balance is never credited here — it settles
    via verify_and_credit_razorpay / handle_razorpay_webhook (whichever
    arrives first credits exactly once).
    """
    from packages.common.src.settings_store import get_bool_setting
    if await get_bool_setting("maintenance_mode", False):
        raise HTTPException(status_code=503, detail="Platform is under maintenance.")
    if not await get_bool_setting("allow_deposits", True):
        raise HTTPException(status_code=403, detail="Deposits are currently disabled")

    if not razorpay_service.razorpay_configured():
        raise HTTPException(status_code=503, detail="Card / UPI deposits are not configured")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    # No KYC gate on deposits — platform policy is deposit/trade freely,
    # verify identity at withdrawal time (assert_kyc_approved_for_withdrawal).
    user_row = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user_row is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Honour the user's chosen credit target (wallet-bound account vs main
    # wallet). Stored on the row so the webhook/verify path credits the
    # right bucket via _credit_from_deposit_row.
    target_account_id = await _resolve_deposit_target_account_id(db, user_id, account_target)

    deposit = Deposit(
        user_id=user_id,
        account_id=target_account_id,
        amount=amount,
        method="razorpay",
        status="pending",
    )
    db.add(deposit)
    await db.commit()
    await db.refresh(deposit)

    try:
        order = await razorpay_service.create_order(
            amount_usd=amount,
            receipt=str(deposit.id),
            notes={"user_id": str(user_id), "deposit_id": str(deposit.id)},
        )
    except HTTPException:
        # Razorpay order failed — drop the orphan pending row so it doesn't
        # linger in the user's history as an un-payable deposit.
        await db.delete(deposit)
        await db.commit()
        raise
    except Exception as e:
        logger.exception("Razorpay create_order failed for deposit %s", deposit.id)
        await db.delete(deposit)
        await db.commit()
        raise HTTPException(status_code=502, detail=f"Razorpay order creation failed: {e}")

    # Map the Razorpay order id onto the deposit so verify + webhook can find
    # this row by order id.
    deposit.transaction_id = order["order_id"]
    await db.commit()
    await db.refresh(deposit)

    return {
        "deposit_id": str(deposit.id),
        "order_id": order["order_id"],
        "key_id": order["key_id"],
        "amount_paise": order["amount_paise"],
        "amount_inr": order["amount_inr"],
        "currency": order["currency"],
        "name": "SwissCresta",
        "description": "Wallet deposit",
    }


async def _credit_razorpay_deposit_locked(
    *, deposit: Deposit, payment_id: str | None, db: AsyncSession,
) -> bool:
    """Idempotently credit a Razorpay deposit. Caller MUST already hold a
    `with_for_update()` lock on the Deposit row.

    Returns True when this call performed the credit, False when the deposit
    was already settled (no-op). Reuses the exact lock-order + credit +
    Transaction + bonus pattern from the OxaPay/NOWPayments webhook handlers
    so the wallet is credited exactly once regardless of whether the client
    `verify` call or the webhook arrives first.
    """
    # Idempotency guard — already-settled rows are left alone. This is the
    # primary defence against double-crediting: the first writer flips the
    # status under the row lock; the second writer sees a terminal status
    # and returns without touching the balance.
    if deposit.status not in ("initiated", "pending"):
        logger.info("Razorpay credit: deposit %s already %s, skipping", deposit.id, deposit.status)
        return False

    if payment_id:
        deposit.transaction_id = str(payment_id)
    deposit.status = "auto_approved"
    deposit.approved_at = datetime.utcnow()

    # Lock the User row BEFORE crediting main_wallet_balance. Lock order:
    # Deposit (held by caller) → User → tagged TradingAccount (inside
    # _credit_from_deposit_row). Prevents a lost-update if verify + webhook
    # ever race on the same user.
    user_q = await db.execute(
        select(User).where(User.id == deposit.user_id).with_for_update()
    )
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        logger.error("Razorpay credit: user not found for deposit %s", deposit.id)
        raise HTTPException(status_code=404, detail="User not found")

    target_kind, target_row = await _credit_from_deposit_row(db, deposit, user_row)
    if target_kind == "trading":
        target_row.balance = (target_row.balance or Decimal("0")) + deposit.amount
        target_row.equity = (target_row.equity or Decimal("0")) + deposit.amount
        target_row.free_margin = (target_row.free_margin or Decimal("0")) + deposit.amount
        db.add(Transaction(
            user_id=deposit.user_id,
            account_id=target_row.id,
            type="deposit",
            amount=deposit.amount,
            balance_after=target_row.balance,
            reference_id=deposit.id,
            description="Deposit to wallet account - razorpay (auto)",
        ))
    else:
        user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + deposit.amount
        db.add(Transaction(
            user_id=deposit.user_id,
            account_id=None,
            type="deposit",
            amount=deposit.amount,
            balance_after=user_row.main_wallet_balance,
            reference_id=deposit.id,
            description="Deposit to main wallet - razorpay (auto)",
        ))

    # H-MONEY-2: single, dedup-guarded bonus application (was an inline copy).
    applied_bonuses = await apply_deposit_bonus(db, user_row, deposit)
    bonus_msg = "".join(
        f" + ${float(a):.2f} bonus ({n})" for n, a in applied_bonuses
    )

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
        await apply_email_brand(db, user_row)
        if smtp_configured() and user_row.email:
            subject, html, text = render_deposit_confirmed(
                first_name=user_row.first_name,
                amount=deposit.amount,
                currency="USD",
                method="Card / UPI (Razorpay)",
                reference=str(deposit.id),
                new_balance=user_row.main_wallet_balance,
                trader_app_url=(_gs().TRADER_APP_URL or "https://trade.swisscresta.com"),
            )
            fire_and_forget(send_email(user_row.email, subject, html, text=text))
            _send_bonus_emails_for_user(user_row, applied_bonuses)
    except Exception as _e:
        logger.warning("razorpay deposit email failed: %s", _e)

    return True


async def verify_and_credit_razorpay(
    *,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    user_id: UUID,
    db: AsyncSession,
) -> dict:
    """Client-side settlement: verify the Checkout handler signature then
    idempotently credit the deposit. Safe to call concurrently with the
    webhook — the row lock + status guard in _credit_razorpay_deposit_locked
    ensure exactly-once crediting."""
    if not razorpay_service.verify_checkout_signature(
        razorpay_order_id, razorpay_payment_id, razorpay_signature
    ):
        logger.warning("Razorpay verify: bad signature order=%s", razorpay_order_id)
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # Look the deposit up by the Razorpay order id stamped at order-creation,
    # scoped to the authenticated user so one user can't settle another's row.
    result = await db.execute(
        select(Deposit)
        .where(
            Deposit.transaction_id == razorpay_order_id,
            Deposit.user_id == user_id,
            Deposit.method == "razorpay",
        )
        .with_for_update()
    )
    deposit = result.scalar_one_or_none()
    if not deposit:
        logger.warning("Razorpay verify: deposit not found order=%s user=%s", razorpay_order_id, user_id)
        raise HTTPException(status_code=404, detail="Deposit not found")

    credited = await _credit_razorpay_deposit_locked(
        deposit=deposit, payment_id=razorpay_payment_id, db=db,
    )
    await db.commit()
    logger.info(
        "Razorpay verify: deposit %s order=%s credited=%s",
        deposit.id, razorpay_order_id, credited,
    )
    return {"status": "credited", "amount": float(deposit.amount)}


async def handle_razorpay_webhook(
    *, order_id: str, payment_id: str, db: AsyncSession,
) -> None:
    """Server-side settlement from the Razorpay `payment.captured` webhook.
    Performs the SAME idempotent credit as verify_and_credit_razorpay so
    whichever arrives first (client verify or webhook) credits once; the
    second is a no-op."""
    result = await db.execute(
        select(Deposit)
        .where(
            Deposit.transaction_id == order_id,
            Deposit.method == "razorpay",
        )
        .with_for_update()
    )
    deposit = result.scalar_one_or_none()
    if not deposit:
        logger.warning("Razorpay webhook: deposit not found order=%s", order_id)
        return

    credited = await _credit_razorpay_deposit_locked(
        deposit=deposit, payment_id=payment_id, db=db,
    )
    await db.commit()
    logger.info(
        "Razorpay webhook: deposit %s order=%s credited=%s",
        deposit.id, order_id, credited,
    )


async def release_bonuses_after_trade(
    *,
    user_id: UUID,
    traded_lots: Decimal,
    is_demo_account: bool,
    db: AsyncSession,
) -> None:
    """Apply newly-traded lots toward each active user_bonus and release
    those that meet their wagering requirement.

    Lot accounting (FIFO): traded lots are consumed by the OLDEST active
    bonus first; once that bonus's `lots_required` is reached, the
    remainder flows to the next-oldest. A bonus is released the instant
    its `lots_traded >= lots_required` — its locked amount is credited
    to `user.main_wallet_balance` and a Transaction row of
    `type='bonus_release'` is written so the credit appears in the
    user's transaction history.

    Real accounts only — demo trades do NOT count toward wagering
    (otherwise users could trade demo to release real bonus money).

    Caller MUST be inside an open DB transaction. This function only
    flushes; it does not commit. Errors propagate; the caller should
    wrap in try/except if a release failure must not block the trade
    close.
    """
    if is_demo_account:
        return
    if traded_lots <= 0:
        return

    q = await db.execute(
        select(UserBonus)
        .where(UserBonus.user_id == user_id, UserBonus.status == "active")
        .order_by(UserBonus.created_at.asc())
        .with_for_update()
    )
    active = list(q.scalars().all())
    if not active:
        return

    user_q = await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )
    user = user_q.scalar_one_or_none()
    if not user:
        return

    remaining = Decimal(str(traded_lots))
    for bonus in active:
        if remaining <= 0:
            break
        required = Decimal(str(bonus.lots_required or 0))
        already = Decimal(str(bonus.lots_traded or 0))
        needed = max(Decimal("0"), required - already)
        # Lots_required==0 is a no-wagering bonus — release immediately
        # without consuming any of the traded volume.
        if required <= 0:
            consume = Decimal("0")
        elif remaining >= needed:
            consume = needed
        else:
            consume = remaining

        bonus.lots_traded = already + consume
        remaining -= consume

        if bonus.lots_traded >= required:
            bonus.status = "released"
            bonus.released_at = datetime.utcnow()
            bonus_amount = Decimal(str(bonus.amount or 0))
            if bonus_amount > 0:
                user.main_wallet_balance = (
                    Decimal(str(user.main_wallet_balance or 0)) + bonus_amount
                )
                db.add(Transaction(
                    user_id=user_id,
                    account_id=None,
                    type="bonus_release",
                    amount=bonus_amount,
                    balance_after=user.main_wallet_balance,
                    reference_id=bonus.id,
                    description="Bonus released — wagering requirement met",
                ))
    await db.flush()


# ─── Withdrawals ──────────────────────────────────────────────────────────

async def assert_kyc_approved_for_withdrawal(db: AsyncSession, user_id: UUID) -> None:
    """Withdrawal-time KYC gate — the ONLY hard KYC block on the platform.

    Policy: users can register, deposit, and trade without KYC; identity is
    verified the moment money leaves the platform. Every withdrawal-creation
    path (standard, manual UPI/QR, on-chain) must call this before touching
    balances. 403 detail "KYC_REQUIRED" is a contract with the trader UI,
    which routes the user to /kyc on that exact string.
    """
    row = (
        await db.execute(select(User.kyc_status).where(User.id == user_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    if (row or "").lower() not in ("approved", "verified"):
        raise HTTPException(status_code=403, detail="KYC_REQUIRED")


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
    if (user_row.kyc_status or "").lower() not in ("approved", "verified"):
        raise HTTPException(status_code=403, detail="KYC_REQUIRED")

    # Resolve debit source — honor explicit user choice if provided
    # (`req.source`), else auto-route (wallet-bound when present, else
    # main_wallet). Balance check uses whichever source is authoritative.
    pref = getattr(req, "source", None)
    source_kind, source_row = await _resolve_debit_source(db, user_id, preference=pref)
    # C-MONEY-3 / H-MONEY-1: for a trading account, only funds NOT backing open
    # positions are withdrawable — never the raw balance (which includes margin
    # locked in live trades). Routed through the shared helper so every
    # withdrawal path agrees.
    if source_kind == "trading":
        available = available_to_withdraw(
            "trading",
            balance=source_row.balance,
            margin_used=source_row.margin_used,
            free_margin=source_row.free_margin,
        )
    else:
        available = available_to_withdraw(
            "main",
            main_wallet_balance=source_row.main_wallet_balance if source_row else None,
            outstanding_bonus=await outstanding_bonus(db, user_id),  # H-MONEY-2
        )
    if available < req.amount:
        if source_kind == "trading":
            detail = (
                f"Insufficient wallet account balance. Available: ${float(available):.2f}."
            )
        else:
            detail = (
                f"Insufficient main wallet balance. Available: ${float(available):.2f}. "
                "Transfer profit from your trading accounts to your main wallet first (Wallet page)."
            )
        raise HTTPException(status_code=400, detail=detail)

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
        # Tag the source account when it's a wallet-bound account so the
        # admin approve flow knows where to debit. NULL means "debit
        # main_wallet_balance" (legacy path).
        account_id=source_row.id if source_kind == "trading" else None,
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
    # Ping every admin so the withdrawal queue gets attention.
    try:
        from packages.common.src.notify import notify_all_admins
        await notify_all_admins(
            db,
            title="New withdrawal request",
            message=(
                f"{user_row.email if user_row else 'A user'} requested a "
                f"${float(req.amount):,.2f} withdrawal via {req.method}."
            ),
            notif_type="withdrawal",
            action_url="/deposits",
            commit=False,
        )
    except Exception:  # pragma: no cover
        pass
    await db.commit()

    # Confirmation email — fire-and-forget so SMTP never blocks the response.
    await send_withdrawal_requested_email(
        db, withdrawal, user_row=user_row, method_label=req.method,
    )

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

    await assert_kyc_approved_for_withdrawal(db, user_id)

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

    # Resolve debit source — same logic as create_withdrawal.
    source_kind, source_row = await _resolve_debit_source(db, user_id)
    # C-MONEY-3 / H-MONEY-1: trading-account withdrawals exclude margin-backed
    # funds via the shared helper (see create_withdrawal).
    if source_kind == "trading":
        available = available_to_withdraw(
            "trading",
            balance=source_row.balance,
            margin_used=source_row.margin_used,
            free_margin=source_row.free_margin,
        )
    else:
        available = available_to_withdraw(
            "main",
            main_wallet_balance=source_row.main_wallet_balance if source_row else None,
            outstanding_bonus=await outstanding_bonus(db, user_id),  # H-MONEY-2
        )
    if available < amount:
        if source_kind == "trading":
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient wallet account balance. Available: ${float(available):.2f}.",
            )
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient main wallet balance. Available: ${float(available):.2f}. "
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
        # Tag the source account when wallet-bound, NULL for legacy
        # main_wallet path so admin approval knows which balance to
        # debit at the time of approval.
        account_id=source_row.id if source_kind == "trading" else None,
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
    # Ping every admin so the withdrawal queue gets attention. The crypto
    # withdrawal path already does this; manual was missed and admins
    # never got the bell update on UPI/QR requests.
    try:
        from packages.common.src.notify import notify_all_admins
        await notify_all_admins(
            db,
            title="New withdrawal request",
            message=(
                f"{user_row.email} requested a "
                f"${float(amount):,.2f} manual withdrawal "
                f"({'UPI' if upi else 'QR'})."
            ),
            notif_type="withdrawal",
            action_url="/deposits",
            commit=False,
        )
    except Exception:  # pragma: no cover
        pass
    await db.commit()

    # Confirmation email — same template + helper as the legacy /
    # WalletConnect paths so all three flows emit the same trigger.
    await send_withdrawal_requested_email(db, withdrawal, method_label="manual")

    return {"id": str(withdrawal.id), "status": "pending", "amount": float(withdrawal.amount)}


# ─── Transfers ────────────────────────────────────────────────────────────

async def internal_wallet_transfer(req, user_id: UUID, db: AsyncSession) -> dict:
    if req.from_account_id == req.to_account_id:
        raise HTTPException(status_code=400, detail="Choose two different accounts")

    amt = Decimal(str(req.amount))

    # ── Concurrency: lock BOTH accounts in ascending UUID order ──────
    # Without the locks, two concurrent transfers from the same source
    # account both read the pre-debit balance, both pass the free-margin
    # check, and both deduct — the source overdraws into the negative.
    # We acquire the locks in ascending UUID order regardless of which
    # is the source / destination, so a second transfer in the opposite
    # direction can never deadlock with us (both processes will request
    # locks in the same canonical order).
    id_a, id_b = sorted([req.from_account_id, req.to_account_id])
    locked_q = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id.in_([id_a, id_b]),
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        ).with_for_update().order_by(TradingAccount.id)
    )
    locked = {a.id: a for a in locked_q.scalars().all()}
    from_a = locked.get(req.from_account_id)
    to_a = locked.get(req.to_account_id)
    if not from_a or not to_a:
        raise HTTPException(status_code=404, detail="Account not found")

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

    # ── Concurrency: lock User first, then TradingAccount ───────────
    # Canonical order (User → TradingAccount). Without locks, two
    # concurrent transfers from the same trading account both read the
    # pre-debit balance, both pass the free-margin check, and both
    # deduct — the trading account overdraws and main_wallet over-credits.
    user_q = await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    acc_q = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == req.from_account_id,
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        ).with_for_update()
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

    # ── Concurrency: lock User first (canonical order), then TradingAccount.
    # Without the User lock, two concurrent transfers of the available
    # main_wallet balance both read the pre-debit value and both deduct,
    # overdrawing main_wallet into the negative.
    user_q = await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    # H-MONEY-2: bonus credit is non-withdrawable, and moving it to a trading
    # account would launder it into withdrawable balance (trading withdrawals
    # ignore bonus). Only the real (non-bonus) main balance may be transferred.
    main_bal = user_row.main_wallet_balance or Decimal("0")
    available = available_to_withdraw(
        "main", main_wallet_balance=main_bal,
        outstanding_bonus=await outstanding_bonus(db, user_id),
    )
    if available < amt:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient transferable main wallet balance. Available: ${float(available):.2f}",
        )

    acc_q = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == req.to_account_id,
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        ).with_for_update()
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
    # Exclude 'initiated' deposits (OxaPay payments that were never started).
    # Pending rows ARE returned because the trader's "Your requests" panel
    # on the Deposit tab needs them; the Transaction History view filters
    # them out client-side.
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
                # Local-banking flow surfaces the admin-provided link to the
                # user. NULL until an admin attaches it. When the admin
                # picked the Razorpay-auto path we set this to
                # "razorpay:<order_id>" so the trader UI knows to open
                # the Razorpay checkout popup instead of an external URL.
                "payment_link": d.payment_link or None,
                # transaction_id doubles as the Razorpay order_id for
                # auto-approved deposits; the trader needs it to launch
                # the Razorpay Checkout popup.
                "transaction_id": d.transaction_id or None,
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

    # Real "bonus balance" = sum of active user_bonuses still under wagering.
    # Once a bonus is released (lots_traded >= lots_required), it merges into
    # main_wallet_balance via the wallet_service.release_bonus path. So this
    # number is the locked, unwithdrawable portion only.
    bonus_q = await db.execute(
        select(func.coalesce(func.sum(UserBonus.amount), 0)).where(
            UserBonus.user_id == user_id,
            UserBonus.status == "active",
        )
    )
    bonus_balance = float(bonus_q.scalar() or 0)

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
            "bonus_balance": bonus_balance,
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
        "bonus_balance": bonus_balance,
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

    resp: dict = {}
    if bank:
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
        # Optional crypto wallet address on the same Bank row — admin
        # enters it on the /admin/banks page; the trader renders it as
        # a copyable address + auto-generated QR alongside the bank /
        # UPI fields. Single source of truth for every deposit
        # destination.
        if bank.wallet_address:
            resp["wallet_address"] = bank.wallet_address

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


async def create_razorpay_order_on_lb_deposit(
    deposit_id: UUID,
    amount: Decimal,
    user_id: UUID,
    db: AsyncSession,
) -> dict:
    """Trader-side: create a Razorpay order against an already-approved
    Local Banking deposit. Used by the "Pay with Razorpay" flow after
    admin has flipped payment_link to "razorpay:awaiting".

    Amount is whatever the user typed in the trader UI — it overwrites
    any prior amount on the deposit row, and the Razorpay order is
    created for it. The existing webhook + verify-on-popup paths credit
    this USD amount when payment.captured fires.
    """
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Enter a valid amount")

    result = await db.execute(
        select(Deposit).where(
            Deposit.id == deposit_id,
            Deposit.user_id == user_id,
        ).with_for_update()
    )
    deposit = result.scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.status not in ("pending",):
        raise HTTPException(status_code=400, detail="Deposit is not pending")

    pl = (deposit.payment_link or "")
    if not pl.startswith("razorpay:"):
        raise HTTPException(
            status_code=400,
            detail="This deposit is not approved for Razorpay yet",
        )

    deposit.amount = amount

    order = await razorpay_service.create_order(
        amount_usd=amount,
        receipt=str(deposit.id)[:40],
        notes={
            "deposit_id": str(deposit.id),
            "user_id": str(user_id),
            "source": "local_banking_user_pay",
        },
    )

    deposit.transaction_id = order["order_id"]
    deposit.payment_link = f"razorpay:{order['order_id']}"
    deposit.method = "razorpay"  # so the existing webhook handler matches
    await db.commit()

    return {
        "deposit_id": str(deposit.id),
        "order_id": order["order_id"],
        "amount_paise": order["amount_paise"],
        "amount_inr": order["amount_inr"],
        "key_id": order["key_id"],
        "currency": order["currency"],
    }
