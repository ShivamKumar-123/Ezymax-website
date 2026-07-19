"""Pending-registration service — verify-email-before-creating-user.

Why this exists
---------------
The previous flow called POST /auth/register, immediately created a
`users` row, set auth cookies, then sent an OTP. That had two bad
consequences:

  1) A new (un-verified) row showed up in the admin user list the
     moment the user clicked Sign up — operators couldn't tell who
     had actually completed registration from who had typo'd their
     email and bailed.
  2) If the user mistyped their email, they were stuck on the OTP
     screen with a row tied to the bad address; the only escape was
     to log out, register again with a different address, and abandon
     the bad row.

New flow:

  POST /auth/register/start
      Validates the form, bcrypts the password, generates a 6-digit
      OTP, stashes everything in Redis under `pending_reg:{email}` with
      a 10-minute TTL, and emails the OTP. NO `users` row created. NO
      auth cookies set. Idempotent — calling again for the same email
      replaces the OTP and refreshes the TTL.

  POST /auth/register/verify
      Pulls the pending entry, checks the OTP, and only then inserts
      the `users` row (with `email_verified=true`), consumes any
      referral, and issues auth cookies via the normal
      `issue_auth_json_response()` path. The Redis entry is deleted on
      success.

  POST /auth/register/resend
      Re-emails the existing OTP (rate-limited tighter than start).

If the user typo'd their email they can just navigate away or click
Back on the OTP step — the Redis key falls out at TTL and no DB row
ever existed.
"""
from __future__ import annotations

import json
import logging
import secrets
import hashlib
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import hash_password
from packages.common.src.models import User
from packages.common.src.rate_limit import rate_limit_http
from packages.common.src.redis_client import redis_client

logger = logging.getLogger("pending_reg")

# 10-minute pending window matches the email_otp_codes default expiry.
# Any longer and a typo'd email squats on the address; any shorter and
# the user gets timed out before checking their inbox.
PENDING_TTL_SECONDS = 600
OTP_DIGITS = 6
MAX_VERIFY_ATTEMPTS = 5


def _redis_key(email_lower: str) -> str:
    return f"pending_reg:{email_lower}"


def _generate_otp() -> str:
    """Cryptographically-strong 6-digit numeric OTP."""
    n = secrets.randbelow(10 ** OTP_DIGITS)
    return str(n).zfill(OTP_DIGITS)


def _hash_otp(otp: str, salt: str) -> str:
    return hashlib.sha256((salt + ":" + otp).encode("utf-8")).hexdigest()


async def _email_already_registered(db: AsyncSession, email_lower: str) -> bool:
    res = await db.execute(
        select(User.id).where(func.lower(User.email) == email_lower).limit(1)
    )
    return res.scalar_one_or_none() is not None


async def start_pending_registration(
    *,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    phone: Optional[str],
    country: Optional[str],
    referral_code: Optional[str],
    request: Request,
    db: AsyncSession,
) -> dict:
    """Stage a registration in Redis and email the OTP.

    Never creates a `users` row. Returns a small ack payload; the
    real account is minted later in `complete_pending_registration`."""
    # Avoid the "burn this email forever" griefing pattern: cap to 3
    # starts per email per hour as well as the global 15/hour/IP cap
    # from the auth_service helper.
    rate_limit_http(request, "register-start", 15, 3600.0)
    email_lower = email.strip().lower()
    rate_limit_http(request, f"register-start:{email_lower}", 3, 3600.0)

    if await _email_already_registered(db, email_lower):
        # Same error shape as the old /auth/register so the frontend
        # doesn't need a special branch.
        raise HTTPException(status_code=400, detail="Email already registered")

    # Maintenance / kill-switch gates — same as register_user().
    from packages.common.src.settings_store import get_bool_setting
    if await get_bool_setting("maintenance_mode", False):
        raise HTTPException(
            status_code=503,
            detail="Platform is under maintenance. Registrations are temporarily disabled.",
        )
    if not await get_bool_setting("allow_new_registrations", True):
        raise HTTPException(status_code=403, detail="New registrations are currently disabled")

    # Idempotency cooldown: a duplicate /register/start for the same email
    # within this window (double-click, client retry while the SMTP send is
    # still in flight, back-then-submit) must NOT mint + email a second OTP.
    # We refresh the staged form fields (so the latest password/name wins)
    # but keep the existing OTP and skip the email. An explicit "Resend"
    # goes through /register/resend, which rotates the OTP deliberately.
    RESEND_COOLDOWN_SECONDS = 60
    existing_raw = await redis_client.get(_redis_key(email_lower))
    if existing_raw:
        try:
            existing = json.loads(existing_raw)
            created = datetime.fromisoformat(existing.get("created_at", ""))
            age = (datetime.now(timezone.utc) - created).total_seconds()
            if 0 <= age < RESEND_COOLDOWN_SECONDS and existing.get("otp_hash"):
                existing.update({
                    "password_hash": hash_password(password),
                    "first_name": first_name.strip(),
                    "last_name": last_name.strip(),
                    "phone": (phone or "").strip() or None,
                    "country": (country or "").strip() or None,
                    "referral_code": (referral_code or "").strip() or None,
                })
                ttl = await redis_client.ttl(_redis_key(email_lower))
                await redis_client.setex(
                    _redis_key(email_lower),
                    ttl if ttl and ttl > 0 else PENDING_TTL_SECONDS,
                    json.dumps(existing),
                )
                logger.info(
                    "Pending registration re-start within cooldown for %s — OTP reused, no email sent",
                    email_lower,
                )
                return {"message": "Verification code sent. Check your email."}
        except Exception:
            pass  # malformed staged entry — fall through and restage fresh

    otp = _generate_otp()
    salt = secrets.token_hex(8)
    payload = {
        "email": email_lower,
        "password_hash": hash_password(password),
        "first_name": first_name.strip(),
        "last_name": last_name.strip(),
        "phone": (phone or "").strip() or None,
        "country": (country or "").strip() or None,
        "referral_code": (referral_code or "").strip() or None,
        "otp_hash": _hash_otp(otp, salt),
        "otp_salt": salt,
        "attempts": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await redis_client.setex(_redis_key(email_lower), PENDING_TTL_SECONDS, json.dumps(payload))

    # Send the OTP email. Reuse the same template the post-registration
    # /auth/email/start-verification flow uses, so the email looks
    # identical to the existing system.
    try:
        from packages.common.src.smtp_mail import send_email, smtp_configured
        from packages.common.src.email_templates import render_email_otp
    except Exception as e:
        logger.error("smtp/template import failed: %s", e)
        raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")
    if not smtp_configured():
        raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")
    subject, html, text = render_email_otp(
        first_name=payload["first_name"],
        code=otp,
        ttl_minutes=PENDING_TTL_SECONDS // 60,
    )
    # send_email's first positional arg is `to_email`, NOT `to`. Calling
    # it as `to=...` raised TypeError on every request and surfaced as a
    # 502 to the user — the v1 of this service got that wrong.
    try:
        ok = await send_email(email_lower, subject, html, text=text)
    except Exception as e:
        logger.exception("Failed to send pending-registration OTP to %s", email_lower)
        raise HTTPException(status_code=502, detail="Could not send verification email.") from e
    if not ok:
        # smtp_configured() check fell through OR transport failure —
        # send_email returns False rather than raising on these.
        logger.warning("send_email returned False for pending-registration to %s", email_lower)
        raise HTTPException(status_code=502, detail="Could not send verification email.")

    logger.info("Pending registration started for %s", email_lower)
    return {"message": "Verification code sent. Check your email."}


async def complete_pending_registration(
    *,
    email: str,
    otp: str,
    request: Request,
    db: AsyncSession,
) -> JSONResponse:
    """Verify the OTP, create the real `users` row, and issue auth
    cookies. Imports `issue_auth_json_response` + `_consume_referral`
    lazily to avoid a circular module load."""
    rate_limit_http(request, "register-verify", 20, 600.0)
    email_lower = email.strip().lower()
    rate_limit_http(request, f"register-verify:{email_lower}", 10, 600.0)

    raw = await redis_client.get(_redis_key(email_lower))
    if not raw:
        raise HTTPException(
            status_code=400,
            detail="Verification code expired or never started. Please start over.",
        )
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        # Should never happen — but if Redis somehow holds a bad blob,
        # treat as expired so the user re-starts.
        await redis_client.delete(_redis_key(email_lower))
        raise HTTPException(status_code=400, detail="Verification code expired. Please start over.")

    attempts = int(payload.get("attempts") or 0) + 1
    if attempts > MAX_VERIFY_ATTEMPTS:
        await redis_client.delete(_redis_key(email_lower))
        raise HTTPException(
            status_code=429,
            detail="Too many wrong attempts. Please request a new verification code.",
        )

    expected = payload.get("otp_hash") or ""
    salt = payload.get("otp_salt") or ""
    if not expected or not salt or _hash_otp(otp.strip(), salt) != expected:
        # Persist incremented attempt counter while preserving TTL.
        payload["attempts"] = attempts
        ttl = await redis_client.ttl(_redis_key(email_lower))
        ttl = max(int(ttl or 0), 1)
        await redis_client.setex(_redis_key(email_lower), ttl, json.dumps(payload))
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    # Race guard: if someone else managed to register the same email
    # between start and verify, treat as duplicate.
    if await _email_already_registered(db, email_lower):
        await redis_client.delete(_redis_key(email_lower))
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=email_lower,
        password_hash=payload["password_hash"],
        first_name=payload.get("first_name") or "",
        last_name=payload.get("last_name") or "",
        phone=payload.get("phone"),
        country=payload.get("country"),
        role="user",
        status="active",
        kyc_status="pending",
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()

    referral_code = payload.get("referral_code")
    if referral_code:
        # Lazy import — auth_service imports from us via the route
        # handler, so going the other way at module-load time would
        # produce a circular import.
        from .auth_service import _consume_referral
        try:
            await _consume_referral(db, user.id, referral_code)
        except Exception as e:
            # Referral consumption is best-effort; never block the new
            # account on a bad code.
            logger.warning("referral consume failed for %s: %s", user.id, e)

    # Successful create — burn the Redis entry so the code can't be
    # replayed.
    await redis_client.delete(_redis_key(email_lower))

    from .auth_service import issue_auth_json_response
    return await issue_auth_json_response(
        user, request, db, status_code=201, user_audit_action="REGISTER",
    )


async def resend_pending_otp(
    *,
    email: str,
    request: Request,
) -> dict:
    """Re-issue the OTP for an in-progress pending registration.

    Idempotent — keeps the password hash and form fields untouched;
    just rotates the OTP and refreshes the TTL."""
    rate_limit_http(request, "register-resend", 10, 600.0)
    email_lower = email.strip().lower()
    rate_limit_http(request, f"register-resend:{email_lower}", 3, 600.0)

    raw = await redis_client.get(_redis_key(email_lower))
    if not raw:
        raise HTTPException(
            status_code=400,
            detail="No pending registration. Please start over.",
        )
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        await redis_client.delete(_redis_key(email_lower))
        raise HTTPException(status_code=400, detail="Pending registration corrupted. Please start over.")

    otp = _generate_otp()
    salt = secrets.token_hex(8)
    payload["otp_hash"] = _hash_otp(otp, salt)
    payload["otp_salt"] = salt
    payload["attempts"] = 0  # fresh code -> fresh budget
    await redis_client.setex(_redis_key(email_lower), PENDING_TTL_SECONDS, json.dumps(payload))

    try:
        from packages.common.src.smtp_mail import send_email, smtp_configured
        from packages.common.src.email_templates import render_email_otp
    except Exception as e:
        logger.error("smtp/template import failed: %s", e)
        raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")
    if not smtp_configured():
        raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")
    subject, html, text = render_email_otp(
        first_name=payload.get("first_name"),
        code=otp,
        ttl_minutes=PENDING_TTL_SECONDS // 60,
    )
    try:
        ok = await send_email(email_lower, subject, html, text=text)
    except Exception as e:
        logger.exception("Failed to resend pending-registration OTP to %s", email_lower)
        raise HTTPException(status_code=502, detail="Could not send verification email.") from e
    if not ok:
        logger.warning("send_email returned False on resend for %s", email_lower)
        raise HTTPException(status_code=502, detail="Could not send verification email.")

    return {"message": "New verification code sent."}


async def cancel_pending_registration(*, email: str) -> dict:
    """Best-effort cleanup when the user backs out of the OTP step.
    Always returns success — the Redis row will TTL out anyway."""
    await redis_client.delete(_redis_key(email.strip().lower()))
    return {"message": "Cancelled"}
