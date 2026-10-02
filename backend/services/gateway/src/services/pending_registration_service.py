"""Pending-registration service — verify-email-before-creating-user.

Flow
----
  POST /auth/register/start
      Validates the form, bcrypts the password, generates a 6-digit OTP,
      stages everything in Redis under `pending_reg:{email}` (10-min TTL)
      with SET NX, and emails the OTP in the background. NO `users` row,
      NO auth cookies. The response is identical whether or not the email
      is already registered (no enumeration).

  POST /auth/register/verify
      Checks the OTP (constant-time) — and the password when the entry is
      contested — then inserts the `users` row (email_verified=true) and
      issues auth cookies via `issue_auth_json_response()`.

  POST /auth/register/resend
      Rotates the OTP. The attempt budget is NOT reset.

  POST /auth/register/cancel
      Requires the OTP.

D2 hardening
------------
  * A second /register/start for an email with a live pending entry NEVER
    overwrites the staged password or referral. Same password + referral
    → treated as an idempotent retry. Anything else → the entry is VOIDED
    and the email is marked *contested*: from then on /register/verify
    also requires the password, so whoever re-starts can only complete the
    signup with BOTH the mailbox OTP and the password they staged.
  * Verify attempts are an atomic Redis counter that survives /resend.
  * Per-email caps (independent of IP) on start / resend / verify.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import hash_password, verify_password
from packages.common.src.models import User
from packages.common.src.rate_limit import rate_limit_http
from packages.common.src.redis_client import redis_client
from packages.common.src.email_branding import apply_email_brand_for_signup
from packages.common.src.user_credentials import redis_cap

logger = logging.getLogger("pending_reg")

PENDING_TTL_SECONDS = 600
OTP_DIGITS = 6
# Total wrong-code budget per pending registration — shared by verify and
# cancel and NOT reset by /resend.
MAX_VERIFY_ATTEMPTS = 5
ATTEMPTS_TTL_SECONDS = 3600
CONTESTED_TTL_SECONDS = 3600
RESEND_COOLDOWN_SECONDS = 60

# Per-email caps (independent of client IP).
START_CAP_PER_EMAIL_HOUR = 5
RESEND_CAP_PER_EMAIL_10MIN = 3
VERIFY_CAP_PER_EMAIL_10MIN = 20

_UNIFORM_START_RESPONSE = {"message": "Verification code sent. Check your email."}


def _redis_key(email_lower: str) -> str:
    return f"pending_reg:{email_lower}"


def _attempts_key(email_lower: str) -> str:
    return f"pending_reg_attempts:{email_lower}"


def _contested_key(email_lower: str) -> str:
    return f"pending_reg_contested:{email_lower}"


def _email_hash(email_lower: str) -> str:
    return hashlib.sha256(email_lower.encode("utf-8")).hexdigest()[:32]


def _generate_otp() -> str:
    """Cryptographically-strong 6-digit numeric OTP."""
    n = secrets.randbelow(10 ** OTP_DIGITS)
    return str(n).zfill(OTP_DIGITS)


def _hash_otp(otp: str, salt: str) -> str:
    return hashlib.sha256((salt + ":" + otp).encode("utf-8")).hexdigest()


def _otp_matches(otp: str, payload: dict) -> bool:
    expected = payload.get("otp_hash") or ""
    salt = payload.get("otp_salt") or ""
    if not expected or not salt:
        return False
    return hmac.compare_digest(_hash_otp((otp or "").strip(), salt), expected)


def _norm_ref(code: Optional[str]) -> Optional[str]:
    return (code or "").strip() or None


async def _email_already_registered(db: AsyncSession, email_lower: str) -> bool:
    res = await db.execute(
        select(User.id).where(func.lower(User.email) == email_lower).limit(1)
    )
    return res.scalar_one_or_none() is not None


async def _cap(key: str, limit: int, window: int, detail: str) -> None:
    # Fails closed: pending registration lives in Redis anyway.
    await redis_cap(key, limit, window, fail_closed=True, client=redis_client, detail=detail)


async def _charge_attempt(email_lower: str) -> None:
    """Atomically consume one wrong-code attempt; burn the entry when the
    budget is exhausted."""
    key = _attempts_key(email_lower)
    # Create the counter WITH its TTL first (no-op if it exists), then INCR.
    # The old INCR-then-EXPIRE left a counter with no TTL if the process died
    # between the two calls — that email's signup would stay locked forever.
    await redis_client.set(key, 0, ex=ATTEMPTS_TTL_SECONDS, nx=True)
    n = int(await redis_client.incr(key))
    if n > MAX_VERIFY_ATTEMPTS:
        await redis_client.delete(_redis_key(email_lower))
        raise HTTPException(
            status_code=429,
            detail="Too many wrong attempts. Please request a new verification code.",
        )


async def _render_otp_email(db, request: Request, *, first_name, referral_code, otp: str):
    try:
        from packages.common.src.smtp_mail import smtp_configured
        from packages.common.src.email_templates import render_email_otp
    except Exception as e:
        logger.error("smtp/template import failed: %s", e)
        raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")
    if not smtp_configured():
        raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")
    from packages.common.src.broker_tenancy import host_from_request_headers
    await apply_email_brand_for_signup(
        db,
        referral_code=referral_code,
        host=host_from_request_headers(
            request.headers.get("origin"), request.headers.get("referer")
        ),
    )
    return render_email_otp(first_name=first_name, code=otp, ttl_minutes=PENDING_TTL_SECONDS // 60)


def _send_in_background(email_lower: str, subject: str, html: str, text: str) -> None:
    """D5: the OTP email is sent in the background so /register/start takes
    the same time for registered and unregistered addresses."""
    from packages.common.src.smtp_mail import fire_and_forget, send_email

    async def _go():
        ok = await send_email(email_lower, subject, html, text=text)
        if not ok:
            logger.warning("pending-registration OTP send failed (email hash %s)", _email_hash(email_lower))

    fire_and_forget(_go())


async def _notify_existing_owner(db, request: Request, email_lower: str, referral_code) -> None:
    """Tell the real owner (in the background) that someone tried to sign up
    with their address. Never raises; the API response stays uniform."""
    try:
        from packages.common.src.smtp_mail import smtp_configured
        if not smtp_configured():
            raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")
        from packages.common.src.email_templates import render_account_exists
        from packages.common.src.config import get_settings
        from packages.common.src.broker_tenancy import host_from_request_headers
        await apply_email_brand_for_signup(
            db, referral_code=referral_code,
            host=host_from_request_headers(
                request.headers.get("origin"), request.headers.get("referer")
            ),
        )
        subject, html, text = render_account_exists(
            first_name=None,
            trader_app_url=get_settings().TRADER_APP_URL or "https://trade.swisscresta.com",
        )
        _send_in_background(email_lower, subject, html, text)
    except HTTPException:
        raise
    except Exception as e:
        logger.debug("account-exists notice skipped: %s", e)


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
    """Stage a registration in Redis and email the OTP. Never creates a
    `users` row. Always returns the same ack payload on success."""
    rate_limit_http(request, "register-start", 15, 3600.0)
    email_lower = email.strip().lower()
    rate_limit_http(request, f"register-start:{email_lower}", 3, 3600.0)
    await _cap(f"pending_reg_start:{_email_hash(email_lower)}", START_CAP_PER_EMAIL_HOUR, 3600,
               "Too many sign-up attempts for this email. Try again later.")

    # Platform gates first — identical for every address.
    from packages.common.src.settings_store import get_bool_setting
    if await get_bool_setting("maintenance_mode", False):
        raise HTTPException(
            status_code=503,
            detail="Platform is under maintenance. Registrations are temporarily disabled.",
        )
    if not await get_bool_setting("allow_new_registrations", True):
        raise HTTPException(status_code=403, detail="New registrations are currently disabled")

    # D5 enumeration: hash the password up-front for every request so the
    # registered / unregistered paths cost the same, then answer uniformly.
    password_hash = hash_password(password)
    if await _email_already_registered(db, email_lower):
        logger.info("register/start for an existing account (email hash %s) — uniform response",
                    _email_hash(email_lower))
        await _notify_existing_owner(db, request, email_lower, referral_code)
        return dict(_UNIFORM_START_RESPONSE)

    ref = _norm_ref(referral_code)
    otp = _generate_otp()
    salt = secrets.token_hex(8)
    payload = {
        "email": email_lower,
        "password_hash": password_hash,
        "first_name": first_name.strip(),
        "last_name": last_name.strip(),
        "phone": (phone or "").strip() or None,
        "country": (country or "").strip() or None,
        "referral_code": ref,
        "otp_hash": _hash_otp(otp, salt),
        "otp_salt": salt,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    subject, html, text = await _render_otp_email(
        db, request, first_name=payload["first_name"], referral_code=ref, otp=otp,
    )

    key = _redis_key(email_lower)
    created = await redis_client.set(key, json.dumps(payload), nx=True, ex=PENDING_TTL_SECONDS)
    if created:
        # Fresh entry → fresh wrong-code budget.
        await redis_client.delete(_attempts_key(email_lower))
        _send_in_background(email_lower, subject, html, text)
        logger.info("Pending registration started (email hash %s)", _email_hash(email_lower))
        return dict(_UNIFORM_START_RESPONSE)

    # An entry already exists — NEVER overwrite its password / referral.
    existing_raw = await redis_client.get(key)
    try:
        existing = json.loads(existing_raw) if existing_raw else None
    except (ValueError, TypeError):
        existing = None
    if existing is None:
        # Expired (or corrupt) between SET NX and GET — one retry.
        await redis_client.delete(key)
        if await redis_client.set(key, json.dumps(payload), nx=True, ex=PENDING_TTL_SECONDS):
            await redis_client.delete(_attempts_key(email_lower))
            _send_in_background(email_lower, subject, html, text)
        return dict(_UNIFORM_START_RESPONSE)

    same_person = (
        verify_password(password, existing.get("password_hash") or "")
        and _norm_ref(existing.get("referral_code")) == ref
    )
    if not same_person:
        # Conflicting re-start: void the entry and mark the email contested —
        # the next completed signup must present the password it staged.
        await redis_client.delete(key)
        await redis_client.set(_contested_key(email_lower), "1", ex=CONTESTED_TTL_SECONDS)
        logger.warning("Conflicting register/start — pending entry voided (email hash %s)",
                       _email_hash(email_lower))
        return dict(_UNIFORM_START_RESPONSE)

    # Same person retrying (double-click, back-then-submit). Inside the
    # cooldown keep the current OTP; after it, rotate the OTP like /resend
    # (attempt budget untouched).
    try:
        created_at = datetime.fromisoformat(existing.get("created_at", ""))
        age = (datetime.now(timezone.utc) - created_at).total_seconds()
    except (ValueError, TypeError):
        age = RESEND_COOLDOWN_SECONDS
    if 0 <= age < RESEND_COOLDOWN_SECONDS:
        return dict(_UNIFORM_START_RESPONSE)
    existing["otp_hash"] = payload["otp_hash"]
    existing["otp_salt"] = payload["otp_salt"]
    existing["created_at"] = payload["created_at"]
    ttl = await redis_client.ttl(key)
    await redis_client.set(key, json.dumps(existing), xx=True,
                           ex=ttl if ttl and ttl > 0 else PENDING_TTL_SECONDS)
    _send_in_background(email_lower, subject, html, text)
    return dict(_UNIFORM_START_RESPONSE)


async def complete_pending_registration(
    *,
    email: str,
    otp: str,
    request: Request,
    db: AsyncSession,
    password: Optional[str] = None,
) -> JSONResponse:
    """Verify the OTP (+ password when contested or supplied), create the
    real `users` row, and issue auth cookies."""
    rate_limit_http(request, "register-verify", 20, 600.0)
    email_lower = email.strip().lower()
    rate_limit_http(request, f"register-verify:{email_lower}", 10, 600.0)
    await _cap(f"pending_reg_verify:{_email_hash(email_lower)}", VERIFY_CAP_PER_EMAIL_10MIN, 600,
               "Too many verification attempts. Please try again later.")

    key = _redis_key(email_lower)
    raw = await redis_client.get(key)
    if not raw:
        raise HTTPException(
            status_code=400,
            detail="Verification code expired or never started. Please start over.",
        )
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        await redis_client.delete(key)
        raise HTTPException(status_code=400, detail="Verification code expired. Please start over.")

    contested = bool(await redis_client.get(_contested_key(email_lower)))
    if contested and not password:
        raise HTTPException(
            status_code=400,
            detail="PASSWORD_REQUIRED: please re-enter the password you chose to finish signing up.",
        )

    ok_otp = _otp_matches(otp, payload)
    ok_pw = True
    if password is not None:
        ok_pw = verify_password(password, payload.get("password_hash") or "")
    if not (ok_otp and ok_pw):
        await _charge_attempt(email_lower)
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    # Claim the entry atomically — exactly one concurrent verify proceeds.
    if not await redis_client.delete(key):
        raise HTTPException(
            status_code=400,
            detail="Verification code expired or never started. Please start over.",
        )
    await redis_client.delete(_attempts_key(email_lower))
    await redis_client.delete(_contested_key(email_lower))

    if await _email_already_registered(db, email_lower):
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
        from .auth_service import _consume_referral
        try:
            await _consume_referral(db, user.id, referral_code)
        except Exception as e:
            logger.warning("referral consume failed for %s: %s", user.id, e)

    from .auth_service import apply_tenant_attribution
    await apply_tenant_attribution(db, user, referral_code, request)

    from .auth_service import issue_auth_json_response
    return await issue_auth_json_response(
        user, request, db, status_code=201, user_audit_action="REGISTER",
    )


async def resend_pending_otp(
    *,
    email: str,
    request: Request,
    db: AsyncSession,
) -> dict:
    """Re-issue the OTP for an in-progress pending registration. Keeps the
    password hash, referral and form fields untouched; the wrong-code
    budget is NOT reset (D2)."""
    rate_limit_http(request, "register-resend", 10, 600.0)
    email_lower = email.strip().lower()
    rate_limit_http(request, f"register-resend:{email_lower}", 3, 600.0)
    await _cap(f"pending_reg_resend:{_email_hash(email_lower)}", RESEND_CAP_PER_EMAIL_10MIN, 600,
               "Too many resend requests. Please wait a few minutes.")

    key = _redis_key(email_lower)
    raw = await redis_client.get(key)
    if not raw:
        raise HTTPException(status_code=400, detail="No pending registration. Please start over.")
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        await redis_client.delete(key)
        raise HTTPException(status_code=400, detail="Pending registration corrupted. Please start over.")

    otp = _generate_otp()
    salt = secrets.token_hex(8)
    subject, html, text = await _render_otp_email(
        db, request, first_name=payload.get("first_name"),
        referral_code=payload.get("referral_code"), otp=otp,
    )
    payload["otp_hash"] = _hash_otp(otp, salt)
    payload["otp_salt"] = salt
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    payload.pop("attempts", None)  # legacy field; the budget lives in its own key
    if not await redis_client.set(key, json.dumps(payload), xx=True, ex=PENDING_TTL_SECONDS):
        raise HTTPException(status_code=400, detail="No pending registration. Please start over.")

    from packages.common.src.smtp_mail import send_email
    try:
        ok = await send_email(email_lower, subject, html, text=text)
    except Exception as e:
        logger.exception("Failed to resend pending-registration OTP")
        raise HTTPException(status_code=502, detail="Could not send verification email.") from e
    if not ok:
        raise HTTPException(status_code=502, detail="Could not send verification email.")
    return {"message": "New verification code sent."}


async def cancel_pending_registration(
    *, email: str, otp: Optional[str] = None, request: Optional[Request] = None,
) -> dict:
    """Cancel an in-progress pending registration. D2: requires the OTP
    (wrong codes draw from the same budget as verify)."""
    if request is not None:
        rate_limit_http(request, "register-cancel", 10, 600.0)
    email_lower = (email or "").strip().lower()
    code = (otp or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Enter the verification code to cancel.")
    key = _redis_key(email_lower)
    raw = await redis_client.get(key)
    if not raw:
        return {"message": "Cancelled"}
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        await redis_client.delete(key)
        return {"message": "Cancelled"}
    if not _otp_matches(code, payload):
        await _charge_attempt(email_lower)
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    await redis_client.delete(key)
    return {"message": "Cancelled"}
