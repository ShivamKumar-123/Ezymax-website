"""Email OTP verification service.

Used for two flows:

  1. Wallet-first signup: user signed in via SIWE with a placeholder email
     (`wallet_<addr>@wallet.fxartha.local`). They land on the onboarding gate,
     enter their real email, get a 6-digit OTP via SMTP, and verify.

  2. Change email: any user (password / Google / wallet) can request a new
     email. Same OTP flow. Until they verify, users.email stays at the old
     value — only after a successful OTP do we promote `target_email` →
     users.email and re-arm `email_verified`.

Security shape:
  • OTP is 6 digits, generated with secrets.choice (cryptographically random).
  • The code is stored ONLY as a sha256 hash with a per-row salt. A DB read
    cannot replay live codes.
  • TTL is 10 minutes per code.
  • Up to 5 verify attempts per code; after that the row is permanently
    consumed.
  • Per-user rate limits: 1 send per 60s, 3 sends per hour. Stops a hostile
    actor from spamming the SMTP queue.
  • Audit log entries on EMAIL_VERIFIED + EMAIL_CHANGED so support can
    reconstruct any account history.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import EmailOtpCode, User, UserAuditLog

logger = logging.getLogger("email_otp")

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
SEND_COOLDOWN_SECONDS = 60        # min seconds between two sends to the same user
SEND_HOURLY_CAP = 3               # max sends per user per rolling hour
WALLET_PLACEHOLDER_DOMAIN = "wallet.fxartha.local"

_EMAIL_RE_HINT = "user@example.com"


# ─── helpers ──────────────────────────────────────────────────────────────


def _generate_code() -> str:
    """Cryptographically random 6-digit numeric OTP."""
    return f"{secrets.randbelow(10**6):06d}"


def _hash_code(code: str, salt: str) -> str:
    """sha256(code + salt) — short and irreversible. Salt is the row's
    UUID stringified, baked-in at create-time, so each row has a unique
    hash even if two users happen to receive the same code."""
    return hashlib.sha256(f"{code}|{salt}".encode("utf-8")).hexdigest()


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _is_valid_email(email: str) -> bool:
    if not email or len(email) > 255:
        return False
    if "@" not in email:
        return False
    local, _, domain = email.rpartition("@")
    if not local or not domain or "." not in domain:
        return False
    if email.endswith("@" + WALLET_PLACEHOLDER_DOMAIN):
        # Placeholder is internal-only — users cannot adopt it.
        return False
    return True


# ─── send ─────────────────────────────────────────────────────────────────


async def start_verification(
    user_id: UUID, target_email: str, db: AsyncSession,
) -> dict:
    """Issue a fresh OTP and email it to `target_email`.

    Validates the address shape, enforces rate limits, ensures the
    address isn't already owned by another verified account, invalidates
    any previous outstanding codes for this user, and inserts a new row
    in email_otp_codes.
    """
    target = _normalize_email(target_email)
    if not _is_valid_email(target):
        raise HTTPException(
            status_code=400,
            detail=f"Enter a valid email address (e.g. {_EMAIL_RE_HINT}).",
        )

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Block adopting an email another verified account already owns. We
    # check with the lower-cased target to dodge case-sensitivity issues.
    clash = (await db.execute(
        select(User.id).where(
            func.lower(User.email) == target,
            User.id != user_id,
            User.email_verified.is_(True),
        )
    )).scalar_one_or_none()
    if clash is not None:
        raise HTTPException(
            status_code=409,
            detail="This email is already in use by another account.",
        )

    # Rate limits — one minute between sends, three per hour.
    now = datetime.now(timezone.utc)
    cooldown_threshold = now - timedelta(seconds=SEND_COOLDOWN_SECONDS)
    hour_threshold = now - timedelta(hours=1)

    last_send = (await db.execute(
        select(EmailOtpCode.created_at)
        .where(EmailOtpCode.user_id == user_id)
        .order_by(EmailOtpCode.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()
    if last_send and last_send > cooldown_threshold:
        wait = SEND_COOLDOWN_SECONDS - int((now - last_send).total_seconds())
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {max(1, wait)}s before requesting another code.",
        )
    hour_count = (await db.execute(
        select(func.count())
        .select_from(EmailOtpCode)
        .where(
            EmailOtpCode.user_id == user_id,
            EmailOtpCode.created_at >= hour_threshold,
        )
    )).scalar() or 0
    if hour_count >= SEND_HOURLY_CAP:
        raise HTTPException(
            status_code=429,
            detail="Too many verification requests. Try again in an hour.",
        )

    # Mark every prior outstanding code for this user consumed so old
    # codes can't be used after a fresh one is issued.
    await db.execute(
        update(EmailOtpCode)
        .where(
            EmailOtpCode.user_id == user_id,
            EmailOtpCode.consumed_at.is_(None),
        )
        .values(consumed_at=now)
    )

    code = _generate_code()
    expires = now + timedelta(minutes=OTP_TTL_MINUTES)
    row = EmailOtpCode(
        user_id=user_id,
        target_email=target,
        # Salt with the row's UUID so the hash is unique even on duplicate codes.
        # We stringify the auto-generated UUID after flush.
        code_hash="",
        attempts=0,
        created_at=now,
        expires_at=expires,
    )
    db.add(row)
    await db.flush()
    row.code_hash = _hash_code(code, str(row.id))
    await db.commit()

    # Send the email (best-effort; failure is reported to the caller so they
    # can retry rather than silently leaving the user stuck waiting).
    try:
        from packages.common.src.smtp_mail import send_email, smtp_configured
    except Exception as e:
        logger.error("smtp_mail import failed in OTP send: %s", e)
        raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")

    if not smtp_configured():
        logger.error("OTP requested but SMTP isn't configured — cannot send code")
        raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")

    from packages.common.src.email_templates import render_email_otp
    subject, html, text = render_email_otp(
        first_name=user.first_name,
        code=code,
        ttl_minutes=OTP_TTL_MINUTES,
    )
    ok = await send_email(target, subject, html, text=text)
    if not ok:
        logger.warning("OTP email failed to send for user=%s target=%s", user_id, target)
        # 503, NOT 502. We are the origin server and SMTP is a downstream
        # dependency — "Service Unavailable" is the accurate code, and it
        # matches the smtp_configured() check above. It also matters
        # operationally: Cloudflare replaces an origin 502 with its own
        # branded "Bad gateway" HTML page, which destroys this JSON body,
        # so the browser gets un-parseable HTML and shows a bare
        # "Request failed" instead of the message below.
        raise HTTPException(
            status_code=503,
            detail="We couldn't send the verification email. Please retry in a moment.",
        )

    logger.info("OTP issued user=%s target=%s ttl=%dmin", user_id, target, OTP_TTL_MINUTES)
    return {
        "sent": True,
        "target_email": target,
        "expires_at": expires.isoformat(),
        "ttl_seconds": OTP_TTL_MINUTES * 60,
    }


# ─── verify ───────────────────────────────────────────────────────────────


async def verify_otp(
    user_id: UUID, otp: str, db: AsyncSession, *, request_ip: str | None = None,
) -> dict:
    """Consume the latest outstanding OTP for the user.

    On success, promote `target_email` → users.email, set email_verified=true,
    write an audit log entry (EMAIL_VERIFIED for first-time verification,
    EMAIL_CHANGED if the target differs from the prior verified email).
    """
    code = (otp or "").strip()
    if not code or len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="Enter the 6-digit code.")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    row = (await db.execute(
        select(EmailOtpCode)
        .where(
            EmailOtpCode.user_id == user_id,
            EmailOtpCode.consumed_at.is_(None),
            EmailOtpCode.expires_at > now,
        )
        .order_by(EmailOtpCode.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=400,
            detail="No active code. Request a new one.",
        )
    if row.attempts >= OTP_MAX_ATTEMPTS:
        # Burn the row.
        row.consumed_at = now
        await db.commit()
        raise HTTPException(
            status_code=400,
            detail="Too many incorrect attempts on this code. Request a new one.",
        )

    expected = _hash_code(code, str(row.id))
    if not secrets.compare_digest(expected, row.code_hash):
        row.attempts += 1
        await db.commit()
        remaining = OTP_MAX_ATTEMPTS - row.attempts
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect code. {remaining} attempt(s) left." if remaining > 0
            else "Incorrect code. Request a new one.",
        )

    # Success. Capture the prior email for the audit log.
    prior_email = user.email
    is_change = (
        user.email_verified
        and (user.email or "").lower() != row.target_email
    )

    user.email = row.target_email
    user.email_verified = True
    user.email_verified_at = now
    row.consumed_at = now

    # Audit trail: distinguish first-verification from change-of-record.
    audit_action = "EMAIL_CHANGED" if is_change else "EMAIL_VERIFIED"
    db.add(UserAuditLog(
        user_id=user_id,
        action_type=audit_action,
        ip_address=request_ip,
        device_info=f"prior={prior_email or '-'} :: new={row.target_email}",
    ))

    await db.commit()
    # /auth/me's cached payload includes `email` and `email_verified` —
    # bust it so the dashboard reflects the change on the next render
    # instead of waiting up to 15s for the TTL.
    try:
        from packages.common.src.cache import cache_invalidate
        await cache_invalidate("auth_me", str(user_id))
    except Exception:
        pass
    logger.info(
        "OTP verified user=%s action=%s prior=%s new=%s",
        user_id, audit_action, prior_email, row.target_email,
    )
    return {
        "verified": True,
        "email": user.email,
        "email_verified": True,
        "action": audit_action,
    }
