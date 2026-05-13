"""Step-up authentication service.

Two complementary verification surfaces:

  1. INLINE — same-request password re-entry or fresh SIWE signature.
     The action handler (e.g. /wallet/withdraw) calls
     `verify_inline_proof()` with the proof data lifted off the request
     body and proceeds only on True. Stateless.

  2. ASYNC — multi-roundtrip flows (currently used for email-change
     OTP-to-OLD-email, future TOTP / passkey / hardware-wallet). The
     client first POSTs /auth/step-up/start to issue a challenge row,
     completes the proof out-of-band (waits for OTP / signs SIWE), then
     POSTs /auth/step-up/verify to flip the row to verified. The action
     handler then accepts a one-shot consumption of the verified
     challenge — typically presented as an `X-Step-Up-Token` header
     containing the challenge id.

`method` strings in use today:
  - 'password'      — inline. Compares plaintext against bcrypt hash.
  - 'siwe'          — inline OR async. Verifies a fresh SIWE signature
                      against `users.wallet_address`.
  - 'otp_old_email' — async. Sends a 6-digit OTP to users.email,
                      verifies hash on /step-up/verify.

Future hooks (schema already supports them):
  - 'totp'          — Google Authenticator / Authy / 1Password TOTP.
  - 'passkey'       — WebAuthn assertion against a registered authenticator.

Each method has two functions in the dispatch dict below: a `start`
that creates the challenge row (where applicable) and a `verify` that
checks the proof. Adding TOTP later is a ~30-line addition with zero
schema work.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Optional
from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import verify_password
from packages.common.src.models import (
    SensitiveActionChallenge, User, UserAuditLog,
)

logger = logging.getLogger("sensitive_action")

CHALLENGE_TTL_MINUTES = 10
STEP_UP_TOKEN_TTL_MINUTES = 5
MAX_VERIFY_ATTEMPTS = 5
OTP_CODE_LENGTH = 6


# ─── helpers ──────────────────────────────────────────────────────────────


def _hash_otp(code: str, salt: str) -> str:
    """SHA-256 with per-row salt so a DB read can't replay live codes."""
    return hashlib.sha256(f"{code}|{salt}".encode("utf-8")).hexdigest()


def _generate_otp() -> str:
    return f"{secrets.randbelow(10 ** OTP_CODE_LENGTH):0{OTP_CODE_LENGTH}d}"


def _normalize_address(addr: str) -> str:
    return (addr or "").strip().lower()


# ─── INLINE verification ──────────────────────────────────────────────────
# Used by withdrawals and wallet-disconnect. The proof is part of the
# request body and verified synchronously. No DB row is created — these
# are stateless one-shot checks.


async def verify_inline_proof(
    user: User,
    method: str,
    proof: dict[str, Any],
    *,
    request: Request,
    db: AsyncSession,
) -> str:
    """Validate `proof` for the given method against `user`. Returns the
    method name on success (so callers can stamp the action's audit log
    + snapshot fields). Raises HTTPException on failure.

    Methods supported inline:
      - 'password' → proof = {"password": "..."}.  Compares against
        users.password_hash with bcrypt. Refused if the user has no
        password (wallet-only or Google-only accounts can't use this).
      - 'siwe'     → proof = {"message": "<SIWE>", "signature": "0x..."}.
        Verifies the signature recovers an address that matches
        users.wallet_address. Wallet-less accounts can't use this.
    """
    if method == "password":
        password = (proof.get("password") or "").strip()
        if not password:
            raise HTTPException(status_code=400, detail="Password required for verification.")
        if not user.password_hash:
            raise HTTPException(
                status_code=400,
                detail="No password set. Use wallet-signature verification instead.",
            )
        if not verify_password(password, user.password_hash):
            raise HTTPException(status_code=401, detail="Incorrect password.")
        return "password"

    if method == "siwe":
        message = (proof.get("message") or "").strip()
        signature = (proof.get("signature") or "").strip()
        if not message or not signature:
            raise HTTPException(status_code=400, detail="Wallet signature required.")
        if not user.wallet_address:
            raise HTTPException(
                status_code=400,
                detail="No wallet linked. Use password verification instead.",
            )
        from . import wallet_auth_service
        try:
            recovered_addr, _nonce_row = await wallet_auth_service.verify_message(
                message, signature, request, db, expected_user_id=user.id,
            )
        except wallet_auth_service.AuthServiceError as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        if _normalize_address(recovered_addr) != _normalize_address(user.wallet_address or ""):
            raise HTTPException(
                status_code=401,
                detail="Signature did not match the wallet on file.",
            )
        return "siwe"

    raise HTTPException(
        status_code=400,
        detail=f"Verification method {method!r} is not supported for inline step-up.",
    )


# ─── ASYNC challenge flow ─────────────────────────────────────────────────
# Used by email-change (OTP to OLD email) and future flows where the
# proof is multi-roundtrip. The challenge row is the source of truth
# for "this user has proved X within the last 5 minutes".


async def start_challenge(
    user_id: UUID,
    action: str,
    method: str,
    metadata: dict[str, Any],
    db: AsyncSession,
) -> dict:
    """Issue a fresh challenge row and (where applicable) trigger the
    out-of-band side effect — sending the OTP email or returning the
    SIWE nonce for the client to sign. Returns the new challenge_id
    plus any per-method context the client needs."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=CHALLENGE_TTL_MINUTES)

    # Invalidate any prior unconsumed challenge for this same (action)
    # — only the latest one should be live.
    await db.execute(
        update(SensitiveActionChallenge)
        .where(
            SensitiveActionChallenge.user_id == user_id,
            SensitiveActionChallenge.action == action,
            SensitiveActionChallenge.consumed_at.is_(None),
        )
        .values(consumed_at=now)
    )

    challenge = SensitiveActionChallenge(
        user_id=user_id,
        action=action,
        method=method,
        challenge_metadata=metadata or None,
        challenge_data=None,
        attempts=0,
        created_at=now,
        expires_at=expires,
    )
    db.add(challenge)
    await db.flush()

    # Per-method side effects.
    public_payload: dict = {
        "challenge_id": str(challenge.id),
        "action": action,
        "method": method,
        "expires_at": expires.isoformat(),
    }

    if method == "otp_old_email":
        if not user.email or not user.email_verified:
            await db.rollback()
            raise HTTPException(
                status_code=400,
                detail="No verified email on file. Use wallet-signature verification instead.",
            )
        code = _generate_otp()
        challenge.challenge_data = {
            "code_hash": _hash_otp(code, str(challenge.id)),
            "target": user.email,
        }
        await db.commit()

        # Best-effort send — failure rolls the row back so the user can retry.
        try:
            from packages.common.src.smtp_mail import send_email, smtp_configured
            from packages.common.src.email_templates import render_email_otp
        except Exception as e:
            logger.error("smtp/template import failed: %s", e)
            raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")
        if not smtp_configured():
            raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")
        subject, html, text = render_email_otp(
            first_name=user.first_name,
            code=code,
            ttl_minutes=CHALLENGE_TTL_MINUTES,
        )
        ok = await send_email(user.email, subject, html, text=text)
        if not ok:
            logger.warning(
                "step-up OTP send failed user=%s action=%s",
                user.id, action,
            )
            raise HTTPException(
                status_code=502,
                detail="We couldn't send the verification email. Please retry.",
            )
        public_payload["target_email_masked"] = _mask_email(user.email)
        return public_payload

    if method == "siwe":
        if not user.wallet_address:
            await db.rollback()
            raise HTTPException(
                status_code=400,
                detail="No wallet linked — wallet-signature verification isn't available.",
            )
        # We don't pre-allocate a nonce here. The client builds the SIWE
        # message client-side using their own wallet's address + chain
        # and the SAME nonce flow as login (/auth/wallet/nonce). On
        # /step-up/verify they hand us the message+signature and we
        # check it through wallet_auth_service.verify_message just like
        # the inline path does.
        await db.commit()
        public_payload["wallet_address"] = user.wallet_address
        return public_payload

    # method='totp' / 'passkey' — future. For now reject so calls don't
    # silently no-op.
    await db.rollback()
    raise HTTPException(
        status_code=400,
        detail=f"Verification method {method!r} is not yet supported for async step-up.",
    )


async def verify_challenge(
    user_id: UUID,
    challenge_id: UUID,
    proof: dict[str, Any],
    *,
    request: Request,
    db: AsyncSession,
) -> SensitiveActionChallenge:
    """Verify the proof for the given challenge. On success, sets
    `verified_at` (the row is now redeemable for one matching action
    call within STEP_UP_TOKEN_TTL_MINUTES). Returns the row so the
    caller can read its action + metadata.

    Does NOT consume the row — that happens when the action handler
    actually performs the protected operation.
    """
    now = datetime.now(timezone.utc)
    challenge = (await db.execute(
        select(SensitiveActionChallenge).where(
            SensitiveActionChallenge.id == challenge_id,
            SensitiveActionChallenge.user_id == user_id,
        )
    )).scalar_one_or_none()
    if challenge is None:
        raise HTTPException(status_code=404, detail="Verification expired or unknown. Please retry.")
    if challenge.consumed_at is not None:
        raise HTTPException(status_code=400, detail="This challenge has already been used.")
    if challenge.verified_at is not None:
        raise HTTPException(status_code=400, detail="This challenge has already been verified.")
    if challenge.expires_at <= now:
        raise HTTPException(status_code=400, detail="Verification expired. Please retry.")
    if challenge.attempts >= MAX_VERIFY_ATTEMPTS:
        challenge.consumed_at = now
        await db.commit()
        raise HTTPException(status_code=400, detail="Too many failed attempts. Please retry.")

    if challenge.method == "otp_old_email":
        code = (proof.get("otp") or "").strip()
        if not code or len(code) != OTP_CODE_LENGTH or not code.isdigit():
            challenge.attempts += 1
            await db.commit()
            raise HTTPException(status_code=400, detail="Enter the 6-digit code.")
        expected = _hash_otp(code, str(challenge.id))
        cdata = challenge.challenge_data or {}
        if not secrets.compare_digest(expected, cdata.get("code_hash") or ""):
            challenge.attempts += 1
            await db.commit()
            remaining = MAX_VERIFY_ATTEMPTS - challenge.attempts
            raise HTTPException(
                status_code=400,
                detail=f"Incorrect code. {remaining} attempt(s) left." if remaining > 0
                else "Incorrect code. Please retry.",
            )

    elif challenge.method == "siwe":
        message = (proof.get("message") or "").strip()
        signature = (proof.get("signature") or "").strip()
        if not message or not signature:
            challenge.attempts += 1
            await db.commit()
            raise HTTPException(status_code=400, detail="Wallet signature required.")
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if not user or not user.wallet_address:
            raise HTTPException(status_code=400, detail="No wallet linked.")
        from . import wallet_auth_service
        try:
            recovered_addr, _ = await wallet_auth_service.verify_message(
                message, signature, request, db, expected_user_id=user.id,
            )
        except wallet_auth_service.AuthServiceError as e:
            challenge.attempts += 1
            await db.commit()
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        if _normalize_address(recovered_addr) != _normalize_address(user.wallet_address):
            challenge.attempts += 1
            await db.commit()
            raise HTTPException(status_code=401, detail="Signature did not match the wallet on file.")

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Verification method {challenge.method!r} is not yet supported.",
        )

    # Success.
    challenge.verified_at = now
    await db.commit()
    return challenge


async def consume_verified_challenge(
    user_id: UUID,
    challenge_id: UUID,
    expected_action: str,
    db: AsyncSession,
) -> SensitiveActionChallenge:
    """One-shot consumption. Called by the action handler after the
    user has POSTed their actual action with the step-up token. The
    challenge must be:
      • owned by this user
      • for the expected action (a verified email-change challenge can't
        authorise a withdrawal)
      • verified (verified_at IS NOT NULL)
      • not already consumed
      • not stale (within STEP_UP_TOKEN_TTL_MINUTES of verified_at)
    Sets consumed_at on success.
    """
    now = datetime.now(timezone.utc)
    challenge = (await db.execute(
        select(SensitiveActionChallenge).where(
            SensitiveActionChallenge.id == challenge_id,
            SensitiveActionChallenge.user_id == user_id,
        )
    )).scalar_one_or_none()
    if challenge is None:
        raise HTTPException(status_code=403, detail="Verification not found. Please verify first.")
    if challenge.action != expected_action:
        raise HTTPException(
            status_code=403,
            detail=f"Verification was for {challenge.action!r}, not {expected_action!r}.",
        )
    if challenge.verified_at is None:
        raise HTTPException(status_code=403, detail="Verification incomplete.")
    if challenge.consumed_at is not None:
        raise HTTPException(status_code=403, detail="Verification already used.")
    age = now - challenge.verified_at
    if age > timedelta(minutes=STEP_UP_TOKEN_TTL_MINUTES):
        raise HTTPException(status_code=403, detail="Verification expired. Please retry.")

    challenge.consumed_at = now
    await db.commit()
    return challenge


def _mask_email(email: str) -> str:
    """`alice@example.com` → `a***e@example.com`. UI hint only."""
    if not email or "@" not in email:
        return ""
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        return f"{local[0]}*@{domain}"
    return f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}@{domain}"
