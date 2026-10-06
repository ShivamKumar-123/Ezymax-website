"""Profile Service — User profile CRUD, KYC document handling, session management."""
import logging
import uuid as _uuid
from datetime import datetime
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile
from sqlalchemy import select

from packages.common.src.kyc_identifiers import normalise_pan, prepare_aadhaar
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import User, UserSession, KYCDocument
from packages.common.src.auth import hash_password, verify_password
from packages.common.src.config import get_settings
from packages.common.src.path_safety import PathTraversalError, safe_join_under_base
from packages.common.src.notify import create_notification
from packages.common.src.email_branding import apply_email_brand
from packages.common.src.wallet_placeholder import is_wallet_placeholder_email

logger = logging.getLogger("profile_service")

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf", ".webp"}
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
VALID_DOC_TYPES = {
    "passport", "national_id", "driving_license", "proof_of_address",
    "address_proof", "selfie", "bank_statement", "id_front", "id_back", "other",
}


def _kyc_upload_root() -> Path:
    raw = get_settings().KYC_UPLOAD_ROOT.strip() or "uploads/kyc"
    p = Path(raw)
    if not p.is_absolute():
        p = Path.cwd() / p
    try:
        p.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        logger.error("KYC upload directory not writable: %s — %s", p, e)
        raise HTTPException(
            status_code=503,
            detail="File upload is temporarily unavailable. Please contact support.",
        ) from e
    return p


async def _read_upload_file(upload: UploadFile, label: str) -> tuple[bytes, str]:
    if not upload.filename:
        raise HTTPException(status_code=400, detail=f"No file provided ({label})")
    suffix = Path(upload.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed for {label}. Upload JPG, PNG, PDF, or WEBP.",
        )
    content = await upload.read()
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large for {label}. Maximum size is 10 MB.",
        )
    # Confirm the file's leading bytes match the declared extension —
    # blocks polyglots / spoofed Content-Type uploads.
    from packages.common.src.file_validation import validate_upload
    try:
        suffix = validate_upload(
            content, suffix,
            allowed_extensions=ALLOWED_EXTENSIONS,
            label=label,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return content, suffix


# ─── Profile ──────────────────────────────────────────────────────────────

async def get_profile(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    kyc_result = await db.execute(
        select(KYCDocument)
        .where(KYCDocument.user_id == user.id)
        .order_by(KYCDocument.created_at.desc())
    )
    kyc_docs = kyc_result.scalars().all()

    kyc_documents = [
        {
            "id": str(doc.id),
            "document_type": doc.document_type,
            "status": doc.status,
            "rejection_reason": doc.rejection_reason,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
        }
        for doc in kyc_docs
    ]

    return {
        "id": str(user.id),
        "email": user.email,
        "email_verified": bool(getattr(user, "email_verified", False)),
        "is_wallet_placeholder": is_wallet_placeholder_email(user.email),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "country": user.country,
        "address": user.address,
        "city": user.city,
        "state": user.state,
        "postal_code": user.postal_code,
        "avatar": user.avatar,
        "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
        "role": user.role,
        "status": user.status,
        "kyc_status": user.kyc_status,
        "two_factor_enabled": user.two_factor_enabled,
        "language": user.language,
        "theme": user.theme,
        "is_islamic": bool(getattr(user, "is_islamic", False)),
        "kyc_documents": kyc_documents,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


_SELF_EDIT_FORBIDDEN_FIELDS = frozenset({"is_islamic"})


async def update_profile(
    user_id: UUID, update_data: dict, db: AsyncSession,
) -> dict:
    # B3: fields a trader may NEVER set on themselves. `is_islamic` switches
    # the account to swap-free groups (no overnight financing) — an admin /
    # compliance decision, not a self-service toggle. Dropped silently so
    # older clients that echo the whole profile back keep working.
    update_data = {k: v for k, v in (update_data or {}).items() if k not in _SELF_EDIT_FORBIDDEN_FIELDS}

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # date_of_birth arrives from the HTML <input type="date"> as a YYYY-MM-DD
    # string. The User column is a DateTime so we coerce here — asyncpg
    # otherwise raises DataError on commit.
    if "date_of_birth" in update_data:
        dob_raw = update_data["date_of_birth"]
        if dob_raw is None or (isinstance(dob_raw, str) and not dob_raw.strip()):
            update_data["date_of_birth"] = None
        elif isinstance(dob_raw, str):
            try:
                # Accept either "YYYY-MM-DD" or full ISO 8601.
                update_data["date_of_birth"] = datetime.fromisoformat(dob_raw[:10])
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid date of birth — expected YYYY-MM-DD.",
                )

    for field, value in update_data.items():
        if value is not None:
            setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    # Send the welcome email exactly once, the first time the user
    # completes every required profile field. Prior behavior was to fire
    # it at /auth/register which meant the welcome landed before the OTP
    # code and before any personalization was available.
    profile_complete = bool(
        (user.first_name or "").strip()
        and (user.last_name or "").strip()
        and (user.phone or "").strip()
        and (user.country or "").strip()
        and (user.address or "").strip()
        and (user.city or "").strip()
        and (user.state or "").strip()
        and (user.postal_code or "").strip()
        and user.date_of_birth is not None
    )
    if profile_complete and not getattr(user, "welcome_email_sent", False):
        try:
            from .auth_service import _send_welcome_email
            await apply_email_brand(db, user)
            _send_welcome_email(user, via_google=False)
            user.welcome_email_sent = True
            await db.commit()
        except Exception:
            # Delivery failure must not block the profile save.
            pass

    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "country": user.country,
        "address": user.address,
        "city": user.city,
        "state": user.state,
        "postal_code": user.postal_code,
        "avatar": user.avatar,
        "language": user.language,
        "theme": user.theme,
        "message": "Profile updated",
    }


async def change_password(
    user_id: UUID, current_password: str, new_password: str, db: AsyncSession,
    keep_sid=None,
) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if current_password == new_password:
        raise HTTPException(status_code=400, detail="New password must be different")

    user.password_hash = hash_password(new_password)
    # Sign out every OTHER device + revoke refresh tokens and algo keys (same
    # rule as /auth/password/change) so a changed password evicts an attacker.
    from .auth_service import revoke_user_credentials
    from packages.common.src.auth import invalidate_session_cache
    revoked_sids = await revoke_user_credentials(db, user.id, keep_sid=keep_sid)
    await db.commit()
    for _sid in revoked_sids:
        await invalidate_session_cache(_sid)

    return {"message": "Password changed successfully. Other devices have been signed out."}


# ─── Sessions ─────────────────────────────────────────────────────────────

async def list_sessions(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == user_id, UserSession.is_active == True)
        .order_by(UserSession.created_at.desc())
    )
    sessions = result.scalars().all()

    return {
        "sessions": [
            {
                "id": str(s.id),
                "ip_address": str(s.ip_address) if s.ip_address else None,
                "user_agent": s.user_agent,
                "device_info": s.device_info,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            }
            for s in sessions
        ],
        "total": len(sessions),
    }


async def terminate_session(user_id: UUID, session_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.is_active:
        raise HTTPException(status_code=400, detail="Session already terminated")

    session.is_active = False
    await db.commit()

    return {"message": "Session terminated", "session_id": str(session_id)}


# ─── KYC ──────────────────────────────────────────────────────────────────

async def submit_kyc(
    user_id: UUID,
    document_type: str,
    file: UploadFile,
    document_type_2: str | None,
    file_2: UploadFile | None,
    residential_address: str | None,
    city: str | None,
    postal_code: str | None,
    country_of_residence: str | None,
    pan_number: str | None,
    aadhaar_number: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.kyc_status in ("under_review", "submitted"):
        raise HTTPException(
            status_code=400,
            detail="Your documents are already submitted and under review. Please wait.",
        )
    if user.kyc_status in ("verified", "approved"):
        raise HTTPException(status_code=400, detail="Your KYC is already verified.")

    if document_type not in VALID_DOC_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document type. Allowed: {', '.join(sorted(VALID_DOC_TYPES))}",
        )

    has_second = bool(file_2 and file_2.filename)
    if has_second:
        if not document_type_2 or document_type_2 not in VALID_DOC_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Select a valid document type for the second file.",
            )
    elif document_type_2 and document_type_2.strip():
        raise HTTPException(
            status_code=400,
            detail="Second document type was set but no second file was uploaded.",
        )

    uploads: list[tuple[str, bytes, str]] = []
    c1, s1 = await _read_upload_file(file, "primary document")
    uploads.append((document_type, c1, s1))
    if has_second:
        c2, s2 = await _read_upload_file(file_2, "second document")
        uploads.append((document_type_2, c2, s2))

    root = _kyc_upload_root()
    try:
        user_upload_dir = safe_join_under_base(root, str(user_id))
    except PathTraversalError:
        raise HTTPException(status_code=400, detail="Invalid upload path")
    try:
        user_upload_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        # Most common cause: the host bind-mount target
        # (./backend/uploads/) isn't writable by the gateway container's
        # non-root user (uid 1001). Surfaces the same way as the bank_service
        # /uploads bug fixed earlier — logs the full path so ops can chmod it.
        logger.exception("KYC user upload dir not writable: %s", user_upload_dir)
        raise HTTPException(
            status_code=503,
            detail="File upload is temporarily unavailable. Please contact support.",
        ) from e

    saved_docs: list[KYCDocument] = []
    try:
        for dtype, content, suffix in uploads:
            safe_name = f"{dtype}_{_uuid.uuid4().hex}{suffix}"
            try:
                file_path = safe_join_under_base(user_upload_dir, safe_name)
            except PathTraversalError:
                raise HTTPException(status_code=400, detail="Invalid file path")
            try:
                file_path.write_bytes(content)
            except OSError as e:
                logger.exception("KYC file write failed: %s", file_path)
                raise HTTPException(
                    status_code=503,
                    detail="Could not store upload. Please try again or contact support.",
                ) from e

            doc = KYCDocument(
                user_id=user_id,
                document_type=dtype,
                file_url=str(file_path),
                status="pending",
            )
            db.add(doc)
            saved_docs.append(doc)

        # City and postcode go in THEIR OWN columns. They used to be folded
        # into user.address as a text blob, which left users.city and
        # users.postal_code empty forever and gave admin one unstructured line
        # it could neither search nor break apart.
        if residential_address and residential_address.strip():
            user.address = residential_address.strip()
        if city and city.strip():
            user.city = city.strip()
        if postal_code and postal_code.strip():
            user.postal_code = postal_code.strip()
        if country_of_residence and country_of_residence.strip():
            user.country = country_of_residence.strip()

        # Document numbers. A malformed PAN or Aadhaar is rejected at
        # submission rather than swallowed, so the user fixes it now instead
        # of an admin finding it days later.
        try:
            pan = normalise_pan(pan_number)
            aadhaar_last4, aadhaar_hash = prepare_aadhaar(aadhaar_number)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        if pan:
            dupe = (await db.execute(
                select(User).where(User.pan_number == pan, User.id != user_id)
            )).scalar_one_or_none()
            if dupe is not None:
                raise HTTPException(
                    status_code=400,
                    detail="This PAN is already registered to another account.",
                )
            user.pan_number = pan
        if aadhaar_hash:
            dupe = (await db.execute(
                select(User).where(User.aadhaar_hash == aadhaar_hash, User.id != user_id)
            )).scalar_one_or_none()
            if dupe is not None:
                raise HTTPException(
                    status_code=400,
                    detail="This Aadhaar is already registered to another account.",
                )
            user.aadhaar_last4 = aadhaar_last4
            user.aadhaar_hash = aadhaar_hash

        user.kyc_status = "submitted"

        await create_notification(
            db,
            user_id,
            title="KYC submitted",
            message="Your documents were received and are pending review. We will notify you when verification is complete.",
            notif_type="kyc",
            action_url="/profile",
            commit=False,
        )
        # Ping every admin so the KYC queue gets attention without polling.
        try:
            from packages.common.src.notify import notify_all_admins
            await notify_all_admins(
                db,
                title="New KYC submission",
                message=f"{user.email} just submitted KYC documents for review.",
                notif_type="kyc",
                action_url="/kyc",
                commit=False,
            )
        except Exception:  # pragma: no cover
            pass
        await db.commit()
        for d in saved_docs:
            await db.refresh(d)
    except IntegrityError as e:
        await db.rollback()
        logger.exception("KYC database constraint failed (run migration 005_kyc_document_types.sql?): %s", e)
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not save KYC data. Your server database may need the latest migration "
                "(kyc document types). Contact support if this continues."
            ),
        ) from e
    except HTTPException:
        # Already a clean error — let it through without rewrapping.
        raise
    except Exception as e:
        # Anything else is unexpected (filesystem, Redis, Notification model
        # drift, etc.). Log the full traceback so ops can diagnose, but
        # return a generic 500 to the user without leaking internals.
        await db.rollback()
        logger.exception("KYC submit failed for user_id=%s: %s", user_id, e)
        raise HTTPException(
            status_code=500,
            detail="We couldn't save your KYC documents. Our team has been notified — please try again in a few minutes.",
        ) from e

    primary = saved_docs[0]
    return {
        "message": "KYC submitted successfully. We will review it within 1–2 business days.",
        "document_id": str(primary.id),
        "document_type": primary.document_type,
        "status": primary.status,
        "documents_submitted": len(saved_docs),
    }


async def get_kyc_file(user_id: UUID, document_id: UUID, db: AsyncSession) -> Path:
    """Resolve a KYC document path for serving.

    Defense-in-depth: even though the row's `file_url` is written from
    `safe_join_under_base` on upload, we re-validate here that the
    stored path resolves under `KYC_UPLOAD_ROOT/{user_id}/`. If the DB
    is ever tampered with (manual SQL, replication bug, malicious
    dump-restore), a stored path like `../../etc/passwd` won't escape
    the upload directory at serve time.
    """
    result = await db.execute(
        select(KYCDocument).where(
            KYCDocument.id == document_id,
            KYCDocument.user_id == user_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    stored = Path(doc.file_url).resolve()
    root = Path(get_settings().KYC_UPLOAD_ROOT.strip() or "uploads/kyc").resolve()
    user_base = (root / str(user_id)).resolve()

    # Stored path must sit under the per-user upload directory.
    try:
        stored.relative_to(user_base)
    except ValueError:
        logger.warning(
            "KYC file path outside user upload dir blocked: doc_id=%s stored=%s user_base=%s",
            document_id, stored, user_base,
        )
        raise HTTPException(status_code=404, detail="Document not found")

    if not stored.exists() or not stored.is_file():
        raise HTTPException(status_code=404, detail="File not found on server")

    return stored


# ─── Opt-in migration to the wallet-bound trading account ──────────────────

# Withdrawal statuses that are finished — anything else is still in flight.
_FINISHED_WITHDRAWAL_STATUSES = ("completed", "paid", "rejected", "cancelled", "canceled", "failed")


async def migrate_to_wallet_account(
    user_id: UUID, merge_from_account_id: UUID | None, db: AsyncSession,
) -> dict:
    """Provision the wallet-bound account and move the user's money into it.

    A5 / A6 / B1 hardening:
      * lock the user row FIRST, then the optional source account (canonical
        order user -> account);
      * move only the SPENDABLE main wallet (balance - un-released bonus);
        the bonus stays in the main wallet;
      * the source account must be flat (no open positions, no pending
        orders), have no in-flight withdrawals, and must not be a PAMM/MAM
        pool (investor capital) or a copy / MAM follower sub-account;
      * from the source only its available cash (`balance`) moves; bonus
        `credit` stays on it (the account is kept open while it holds any).

    Adds the ledger rows and flushes; the caller commits. Returns
    {new_account, starting, main_amount, sweep_amount}.
    """
    from decimal import Decimal

    from sqlalchemy import func

    from packages.common.src.models import (
        InvestorAllocation, Order, OrderStatus, Position, PositionStatus,
        Transaction, Withdrawal,
    )
    from packages.common.src.money_guards import assert_not_managed_pool, spendable_main_wallet
    from packages.common.src.row_locks import lock_account, lock_user
    from packages.common.src.trading_guards import is_platform_copy_subaccount
    from .account_service import create_wallet_bound_account

    user = await lock_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Wallet must be linked first — the wallet account is meaningless
    # without a withdrawal destination.
    if not (user.wallet_address or "").strip():
        raise HTTPException(status_code=400, detail="Link a wallet first, then migrate.")

    source_acc = None
    if merge_from_account_id is not None:
        source_acc = await lock_account(db, merge_from_account_id, user_id=user_id)
        if (
            source_acc is None
            or source_acc.is_active is False
            or bool(source_acc.is_demo)
        ):
            raise HTTPException(status_code=404, detail="Source account not found or not eligible.")
        if bool(getattr(source_acc, "is_wallet_account", False)):
            raise HTTPException(status_code=400, detail="That account is already the wallet account.")
        # B1: a PAMM/MAM pool holds investor capital.
        await assert_not_managed_pool(db, source_acc.id)
        # Copy / MAM follower sub-accounts are unwound via Stop Copy / Withdraw.
        if is_platform_copy_subaccount(source_acc):
            raise HTTPException(
                status_code=409,
                detail="Copy-trading accounts can't be merged — stop the copy subscription instead.",
            )
        copy_dest = (await db.execute(
            select(InvestorAllocation.id).where(
                InvestorAllocation.investor_account_id == source_acc.id,
                InvestorAllocation.status.in_(("active", "pending")),
            ).limit(1)
        )).scalar_one_or_none()
        if copy_dest is not None:
            raise HTTPException(
                status_code=409,
                detail="This account is used by a copy subscription — stop it before merging.",
            )
        open_pos = (await db.execute(
            select(Position.id).where(
                Position.account_id == source_acc.id,
                Position.status.in_((PositionStatus.OPEN.value, PositionStatus.PARTIALLY_CLOSED.value)),
            ).limit(1)
        )).scalar_one_or_none()
        if open_pos is not None:
            raise HTTPException(status_code=409, detail="Close all open positions on that account first.")
        pending_order = (await db.execute(
            select(Order.id).where(
                Order.account_id == source_acc.id,
                Order.status.in_((OrderStatus.PENDING.value, OrderStatus.PARTIALLY_FILLED.value)),
            ).limit(1)
        )).scalar_one_or_none()
        if pending_order is not None:
            raise HTTPException(status_code=409, detail="Cancel pending orders on that account first.")
        pending_wd = (await db.execute(
            select(Withdrawal.id).where(
                Withdrawal.account_id == source_acc.id,
                func.lower(func.coalesce(Withdrawal.status, "pending")).notin_(_FINISHED_WITHDRAWAL_STATUSES),
            ).limit(1)
        )).scalar_one_or_none()
        if pending_wd is not None:
            raise HTTPException(
                status_code=409,
                detail="That account has a withdrawal in progress — wait for it to finish.",
            )

    # A5: only the spendable main wallet moves; outstanding bonus stays.
    main_amount = await spendable_main_wallet(db, user)
    sweep_amount = Decimal(str(source_acc.balance or 0)) if source_acc else Decimal("0")
    if sweep_amount < 0:
        sweep_amount = Decimal("0")
    starting = main_amount + sweep_amount

    new_acc = await create_wallet_bound_account(db, user_id, starting_balance=starting)

    if main_amount > 0:
        user.main_wallet_balance = Decimal(str(user.main_wallet_balance or 0)) - main_amount
        db.add(Transaction(
            user_id=user_id,
            account_id=new_acc.id,
            type="transfer",
            amount=main_amount,
            balance_after=new_acc.balance,
            description="Migration: main wallet → wallet account",
        ))
    if source_acc is not None:
        remaining_credit = Decimal(str(source_acc.credit or 0))
        if sweep_amount > 0:
            source_acc.balance = Decimal("0")
            source_acc.equity = remaining_credit
            source_acc.free_margin = remaining_credit
            db.add(Transaction(
                user_id=user_id,
                account_id=new_acc.id,
                type="transfer",
                amount=sweep_amount,
                balance_after=new_acc.balance,
                description=f"Migration: account {source_acc.account_number} → wallet account",
            ))
        # Close the source only when nothing (no bonus credit) is left on it.
        if remaining_credit <= 0:
            source_acc.is_active = False

    await db.flush()
    return {
        "new_account": new_acc,
        "starting": starting,
        "main_amount": main_amount,
        "sweep_amount": sweep_amount,
    }
