"""Step-up authentication service.

Two complementary verification surfaces:

  1. INLINE — same-request password re-entry or fresh SIWE signature.
     The action handler calls `verify_inline_proof()` with the proof data
     lifted off the request body and proceeds only on True. Stateless.

  2. ASYNC — multi-roundtrip flows (email-change OTP-to-OLD-email, wallet
     disconnect, wallet link, withdrawal). The client first POSTs
     /auth/step-up/start to issue a challenge row, completes the proof
     out-of-band (waits for OTP / reads TOTP / signs SIWE), then POSTs
     /auth/step-up/verify to flip the row to verified. The action handler
     then redeems the verified challenge exactly once.

`method` strings in use today:
  - 'password'      — inline. Compares plaintext against bcrypt hash.
  - 'siwe'          — inline OR async. Verifies a fresh SIWE signature
                      against `users.wallet_address`. Refused for a wallet
                      linked less than 24 h ago (D4): a hijacked session
                      could otherwise link its own wallet, then use it to
                      approve sensitive actions.
  - 'otp_old_email' — async. Sends a 6-digit OTP to users.email, verifies
                      hash on /step-up/verify. ('email_otp' is an alias.)
  - 'totp'          — async. Authenticator code, replay-protected.
  - 'auto'          — start-only alias: TOTP when 2FA is enabled, otherwise
                      email OTP. Recommended for withdrawals.

Hardening (D4): verify attempts are reserved with a conditional
`UPDATE … SET attempts = attempts + 1 … RETURNING` BEFORE the proof is
checked (concurrent guesses can never exceed the budget), the verified →
consumed transition is a conditional `UPDATE … RETURNING` (single use even
under races), and per-user Redis caps bound starts and verifies across
challenges.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import verify_password
from packages.common.src.models import (
    SensitiveActionChallenge, User, UserAuditLog,
)
from packages.common.src.email_branding import apply_email_brand
from packages.common.src.redis_client import redis_client
from packages.common.src.user_credentials import redis_cap, verify_totp_once
from packages.common.src.wallet_placeholder import is_wallet_placeholder_email

logger = logging.getLogger("sensitive_action")

CHALLENGE_TTL_MINUTES = 10
STEP_UP_TOKEN_TTL_MINUTES = 5
MAX_VERIFY_ATTEMPTS = 5
OTP_CODE_LENGTH = 6

# Per-user Redis caps (across all challenges).
START_CAP_PER_HOUR = 10
VERIFY_CAP_PER_HOUR = 20

# D4: a wallet must have been linked at least this long before its
# signature is accepted as a step-up proof.
SIWE_MIN_WALLET_AGE = timedelta(hours=24)

WITHDRAWAL_ACTION = "withdrawal"
WALLET_LINK_ACTION = "wallet_link"

# Methods a withdrawal step-up may use (spec D3: TOTP if 2FA, else email OTP).
_EMAIL_OTP_METHODS = {"otp_old_email", "email_otp"}
_ASYNC_METHODS = {"otp_old_email", "siwe", "totp"}

# Actions accepted by /auth/step-up/start. Unknown actions are refused so a
# typo can't mint a challenge nobody will ever consume.
ALLOWED_ACTIONS = {
    "email_change", "wallet_disconnect", WALLET_LINK_ACTION, WITHDRAWAL_ACTION,
}


# ─── helpers ──────────────────────────────────────────────────────────────


def _hash_otp(code: str, salt: str) -> str:
    """SHA-256 with per-row salt so a DB read can't replay live codes."""
    return hashlib.sha256(f"{code}|{salt}".encode("utf-8")).hexdigest()


def _generate_otp() -> str:
    return f"{secrets.randbelow(10 ** OTP_CODE_LENGTH):0{OTP_CODE_LENGTH}d}"


def _normalize_address(addr: str) -> str:
    return (addr or "").strip().lower()


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _is_wallet_placeholder(email: Optional[str]) -> bool:
    return is_wallet_placeholder_email(email)


async def _wallet_linked_at(db: AsyncSession, user_id: UUID) -> Optional[datetime]:
    """When the user's CURRENT wallet was linked (latest WALLET_LINKED audit
    row). None when the wallet predates the audit trail (e.g. the account was
    created by wallet sign-in) — such wallets are treated as old."""
    ts = (await db.execute(
        select(func.max(UserAuditLog.created_at)).where(
            UserAuditLog.user_id == user_id,
            UserAuditLog.action_type == "WALLET_LINKED",
        )
    )).scalar_one_or_none()
    return _aware(ts) if isinstance(ts, datetime) else None


async def assert_wallet_old_enough_for_siwe(db: AsyncSession, user_id: UUID) -> None:
    """D4: refuse a SIWE step-up for a wallet linked < 24 h ago."""
    linked_at = await _wallet_linked_at(db, user_id)
    if linked_at is not None and datetime.now(timezone.utc) - linked_at < SIWE_MIN_WALLET_AGE:
        raise HTTPException(
            status_code=403,
            detail=(
                "This wallet was linked less than 24 hours ago and can't be used "
                "for verification yet. Use your email or authenticator code."
            ),
        )


def _resolve_method(user: User, action: str, method: str) -> str:
    """Normalise aliases and enforce per-action method policy."""
    m = (method or "").strip().lower()
    if m in _EMAIL_OTP_METHODS:
        m = "otp_old_email"
    if action == WITHDRAWAL_ACTION:
        # D3: TOTP if 2FA is enabled, else email OTP. No downgrade from TOTP to
        # email, no SIWE / password for money-out.
        required = "totp" if getattr(user, "two_factor_enabled", False) else "otp_old_email"
        if m in ("", "auto"):
            return required
        if m != required:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Withdrawals must be confirmed with your authenticator code."
                    if required == "totp"
                    else "Withdrawals must be confirmed with an email code."
                ),
            )
        return m
    if m == "auto":
        return "totp" if getattr(user, "two_factor_enabled", False) else "otp_old_email"
    return m


async def _user_cap(kind: str, user_id: UUID, limit: int, *, fail_closed: bool) -> None:
    await redis_cap(
        f"stepup_{kind}:{user_id}", limit, 3600,
        fail_closed=fail_closed, client=redis_client,
        detail="Too many verification attempts. Please try again later.",
    )


# ─── INLINE verification ──────────────────────────────────────────────────


async def verify_inline_proof(
    user: User,
    method: str,
    proof: dict[str, Any],
    *,
    request: Request,
    db: AsyncSession,
) -> str:
    """Validate `proof` for the given method against `user`. Returns the
    method name on success. Raises HTTPException on failure.

      - 'password' → proof = {"password": "..."}.
      - 'siwe'     → proof = {"message": "<SIWE>", "signature": "0x..."}.
                     Refused for a wallet linked < 24 h ago.
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
        await assert_wallet_old_enough_for_siwe(db, user.id)
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


async def start_challenge(
    user_id: UUID,
    action: str,
    method: str,
    metadata: dict[str, Any],
    db: AsyncSession,
) -> dict:
    """Issue a fresh challenge row and (where applicable) trigger the
    out-of-band side effect — sending the OTP email. Returns the new
    challenge_id plus any per-method context the client needs (including
    the RESOLVED `method`, so clients may pass method='auto')."""
    action = (action or "").strip().lower()
    if action not in ALLOWED_ACTIONS:
        raise HTTPException(status_code=400, detail="Unknown verification action.")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    method = _resolve_method(user, action, method)
    if method not in _ASYNC_METHODS:
        raise HTTPException(
            status_code=400,
            detail=f"Verification method {method!r} is not supported for async step-up.",
        )

    # Pre-flight per-method eligibility BEFORE writing anything.
    if method == "otp_old_email" and (
        not user.email or not user.email_verified or _is_wallet_placeholder(user.email)
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "No verified email on file. Verify your email or enable two-factor "
                "authentication first."
                if action == WITHDRAWAL_ACTION
                else "No verified email on file. Use wallet-signature verification instead."
            ),
        )
    if method == "totp" and not (user.two_factor_enabled and user.two_factor_secret):
        raise HTTPException(status_code=400, detail="Two-factor authentication is not enabled.")
    if method == "siwe":
        if not user.wallet_address:
            raise HTTPException(
                status_code=400,
                detail="No wallet linked — wallet-signature verification isn't available.",
            )
        await assert_wallet_old_enough_for_siwe(db, user.id)

    # Per-user cap on challenge creation (bounds OTP email volume). Fails
    # open: the verify path below is the security-critical budget.
    await _user_cap("start", user_id, START_CAP_PER_HOUR, fail_closed=False)

    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=CHALLENGE_TTL_MINUTES)

    # Only the latest challenge per action is live.
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

    public_payload: dict = {
        "challenge_id": str(challenge.id),
        "action": action,
        "method": method,
        "expires_at": expires.isoformat(),
    }

    if method == "otp_old_email":
        code = _generate_otp()
        challenge.challenge_data = {
            "code_hash": _hash_otp(code, str(challenge.id)),
            "target": user.email,
        }
        await db.commit()

        try:
            from packages.common.src.smtp_mail import send_email, smtp_configured
            from packages.common.src.email_templates import render_email_otp
        except Exception as e:
            logger.error("smtp/template import failed: %s", e)
            raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")
        if not smtp_configured():
            raise HTTPException(status_code=503, detail="Email service unavailable. Try again shortly.")
        await apply_email_brand(db, user)
        subject, html, text = render_email_otp(
            first_name=user.first_name,
            code=code,
            ttl_minutes=CHALLENGE_TTL_MINUTES,
        )
        ok = await send_email(user.email, subject, html, text=text)
        if not ok:
            logger.warning("step-up OTP send failed user=%s action=%s", user.id, action)
            raise HTTPException(
                status_code=502,
                detail="We couldn't send the verification email. Please retry.",
            )
        public_payload["target_email_masked"] = _mask_email(user.email)
        return public_payload

    if method == "totp":
        await db.commit()
        return public_payload

    # siwe: the client builds the SIWE message with a link-nonce
    # (/profile/wallet/link/nonce) and hands message+signature to verify.
    await db.commit()
    public_payload["wallet_address"] = user.wallet_address
    return public_payload


async def _reserve_attempt(
    db: AsyncSession, user_id: UUID, challenge_id: UUID, now: datetime,
) -> SensitiveActionChallenge:
    """Atomically charge one verify attempt against a live challenge.
    Returns the challenge row, or raises with the precise reason."""
    res = await db.execute(
        update(SensitiveActionChallenge)
        .where(
            SensitiveActionChallenge.id == challenge_id,
            SensitiveActionChallenge.user_id == user_id,
            SensitiveActionChallenge.consumed_at.is_(None),
            SensitiveActionChallenge.verified_at.is_(None),
            SensitiveActionChallenge.expires_at > now,
            SensitiveActionChallenge.attempts < MAX_VERIFY_ATTEMPTS,
        )
        .values(attempts=SensitiveActionChallenge.attempts + 1)
        .returning(SensitiveActionChallenge)
        .execution_options(synchronize_session=False)
    )
    challenge = res.scalar_one_or_none()
    if challenge is not None:
        return challenge

    # Diagnose why (read-only) so the client gets a useful message.
    row = (await db.execute(
        select(SensitiveActionChallenge).where(
            SensitiveActionChallenge.id == challenge_id,
            SensitiveActionChallenge.user_id == user_id,
        )
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Verification expired or unknown. Please retry.")
    if row.consumed_at is not None:
        raise HTTPException(status_code=400, detail="This challenge has already been used.")
    if row.verified_at is not None:
        raise HTTPException(status_code=400, detail="This challenge has already been verified.")
    if _aware(row.expires_at) <= now:
        raise HTTPException(status_code=400, detail="Verification expired. Please retry.")
    # Attempt budget exhausted → burn the row.
    await db.execute(
        update(SensitiveActionChallenge)
        .where(SensitiveActionChallenge.id == challenge_id,
               SensitiveActionChallenge.consumed_at.is_(None))
        .values(consumed_at=now)
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    raise HTTPException(status_code=400, detail="Too many failed attempts. Please retry.")


def _wrong(challenge: SensitiveActionChallenge, msg: str = "Incorrect code.") -> HTTPException:
    remaining = MAX_VERIFY_ATTEMPTS - int(challenge.attempts or 0)
    return HTTPException(
        status_code=400,
        detail=f"{msg} {remaining} attempt(s) left." if remaining > 0 else f"{msg} Please retry.",
    )


async def verify_challenge(
    user_id: UUID,
    challenge_id: UUID,
    proof: dict[str, Any],
    *,
    request: Request,
    db: AsyncSession,
) -> SensitiveActionChallenge:
    """Verify the proof for the given challenge. On success sets
    `verified_at` (redeemable once within STEP_UP_TOKEN_TTL_MINUTES).
    Does NOT consume the row — the action handler does that."""
    # Per-user cap across challenges — fails CLOSED (this is the guess budget).
    await _user_cap("verify", user_id, VERIFY_CAP_PER_HOUR, fail_closed=True)

    now = datetime.now(timezone.utc)
    challenge = await _reserve_attempt(db, user_id, challenge_id, now)
    # Persist the charged attempt before evaluating the proof.
    await db.commit()

    if challenge.method == "otp_old_email":
        code = str(proof.get("otp") or proof.get("code") or "").strip()
        if not code or len(code) != OTP_CODE_LENGTH or not code.isdigit():
            raise _wrong(challenge, "Enter the 6-digit code.")
        expected = _hash_otp(code, str(challenge.id))
        cdata = challenge.challenge_data or {}
        if not secrets.compare_digest(expected, cdata.get("code_hash") or ""):
            raise _wrong(challenge)

    elif challenge.method == "totp":
        code = str(proof.get("code") or proof.get("otp") or proof.get("totp_code") or "").strip()
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if not user or not user.two_factor_enabled or not user.two_factor_secret:
            raise HTTPException(status_code=400, detail="Two-factor authentication is not enabled.")
        if not await verify_totp_once(user.id, user.two_factor_secret, code, client=redis_client):
            raise _wrong(challenge, "Incorrect or already-used authenticator code.")

    elif challenge.method == "siwe":
        message = (proof.get("message") or "").strip()
        signature = (proof.get("signature") or "").strip()
        if not message or not signature:
            raise _wrong(challenge, "Wallet signature required.")
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if not user or not user.wallet_address:
            raise HTTPException(status_code=400, detail="No wallet linked.")
        await assert_wallet_old_enough_for_siwe(db, user.id)
        from . import wallet_auth_service
        try:
            recovered_addr, _ = await wallet_auth_service.verify_message(
                message, signature, request, db, expected_user_id=user.id,
            )
        except wallet_auth_service.AuthServiceError as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        if _normalize_address(recovered_addr) != _normalize_address(user.wallet_address):
            raise HTTPException(status_code=401, detail="Signature did not match the wallet on file.")

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Verification method {challenge.method!r} is not yet supported.",
        )

    # Success — conditional flip so two concurrent correct proofs can't both win.
    res = await db.execute(
        update(SensitiveActionChallenge)
        .where(
            SensitiveActionChallenge.id == challenge.id,
            SensitiveActionChallenge.verified_at.is_(None),
            SensitiveActionChallenge.consumed_at.is_(None),
        )
        .values(verified_at=now)
        .returning(SensitiveActionChallenge.id)
        .execution_options(synchronize_session=False)
    )
    if res.scalar_one_or_none() is None:
        await db.rollback()
        raise HTTPException(status_code=400, detail="This challenge has already been verified.")
    await db.commit()
    challenge.verified_at = now
    return challenge


async def _consume(
    db: AsyncSession, user_id: UUID, challenge_id: UUID, expected_action: str,
) -> Optional[SensitiveActionChallenge]:
    """Conditional verified → consumed transition. Returns the row or None."""
    now = datetime.now(timezone.utc)
    res = await db.execute(
        update(SensitiveActionChallenge)
        .where(
            SensitiveActionChallenge.id == challenge_id,
            SensitiveActionChallenge.user_id == user_id,
            SensitiveActionChallenge.action == expected_action,
            SensitiveActionChallenge.verified_at.is_not(None),
            SensitiveActionChallenge.verified_at > now - timedelta(minutes=STEP_UP_TOKEN_TTL_MINUTES),
            SensitiveActionChallenge.consumed_at.is_(None),
        )
        .values(consumed_at=now)
        .returning(SensitiveActionChallenge)
        .execution_options(synchronize_session=False)
    )
    row = res.scalar_one_or_none()
    if row is None:
        return None
    # Defensive re-validation of the returned row (the WHERE already holds).
    if getattr(row, "action", expected_action) != expected_action:
        raise HTTPException(
            status_code=403,
            detail=f"Verification was for {row.action!r}, not {expected_action!r}.",
        )
    if getattr(row, "verified_at", None) is None:
        raise HTTPException(status_code=403, detail="Verification incomplete.")
    if getattr(row, "consumed_at", None) is None:
        row.consumed_at = now
    return row


async def _explain_consume_failure(
    db: AsyncSession, user_id: UUID, challenge_id: UUID, expected_action: str,
) -> HTTPException:
    row = (await db.execute(
        select(SensitiveActionChallenge).where(
            SensitiveActionChallenge.id == challenge_id,
            SensitiveActionChallenge.user_id == user_id,
        )
    )).scalar_one_or_none()
    if row is None:
        return HTTPException(status_code=403, detail="Verification not found. Please verify first.")
    if row.action != expected_action:
        return HTTPException(
            status_code=403,
            detail=f"Verification was for {row.action!r}, not {expected_action!r}.",
        )
    if row.verified_at is None:
        return HTTPException(status_code=403, detail="Verification incomplete.")
    if row.consumed_at is not None:
        return HTTPException(status_code=403, detail="Verification already used.")
    return HTTPException(status_code=403, detail="Verification expired. Please retry.")


async def consume_verified_challenge(
    user_id: UUID,
    challenge_id: UUID,
    expected_action: str,
    db: AsyncSession,
) -> SensitiveActionChallenge:
    """One-shot consumption (commits). The challenge must be owned by this
    user, for `expected_action`, verified, unconsumed and verified within
    STEP_UP_TOKEN_TTL_MINUTES. Atomic: a conditional UPDATE … RETURNING, so
    two concurrent requests can never both redeem the same challenge."""
    row = await _consume(db, user_id, challenge_id, expected_action)
    if row is None:
        raise await _explain_consume_failure(db, user_id, challenge_id, expected_action)
    await db.commit()
    return row


# ─── Withdrawal step-up (D3) — shared interface for Section A ────────────


async def consume_withdrawal_step_up(db: AsyncSession, user_id, challenge_id) -> None:
    """Redeem a verified action='withdrawal' challenge INSIDE the caller's
    transaction (no commit, no rollback): if the withdrawal later fails and
    the transaction rolls back, the challenge is NOT burnt.

    Raises HTTPException(403):
      • detail "STEP_UP_REQUIRED" — no challenge id supplied / malformed;
      • detail "STEP_UP_INVALID"  — unknown, other user, other action,
        unverified, already used, or verified > 5 min ago.
    Clients react to either by running /auth/step-up/start (action=
    "withdrawal", method="auto") + /auth/step-up/verify and retrying with
    the new `step_up_challenge_id`."""
    if challenge_id is None or (isinstance(challenge_id, str) and not challenge_id.strip()):
        raise HTTPException(status_code=403, detail="STEP_UP_REQUIRED")
    try:
        cid = challenge_id if isinstance(challenge_id, UUID) else UUID(str(challenge_id).strip())
        uid = user_id if isinstance(user_id, UUID) else UUID(str(user_id))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=403, detail="STEP_UP_REQUIRED")
    try:
        row = await _consume(db, uid, cid, WITHDRAWAL_ACTION)
    except HTTPException:
        raise HTTPException(status_code=403, detail="STEP_UP_INVALID")
    if row is None:
        raise HTTPException(status_code=403, detail="STEP_UP_INVALID")


# ─── Wallet link step-up (D4) — for the profile wallet-link endpoint ─────


def wallet_link_requires_step_up(user: User) -> bool:
    """D4: the FIRST wallet link on an account with a verified (real) email
    requires step-up — otherwise a hijacked session could attach its own
    wallet and use it as a credential / payout destination."""
    return bool(
        getattr(user, "email_verified", False)
        and not (getattr(user, "wallet_address", None) or "").strip()
        and not _is_wallet_placeholder(getattr(user, "email", None))
    )


async def require_wallet_link_step_up(db: AsyncSession, user: User, challenge_id) -> None:
    """Call from POST /profile/wallet/link before persisting the address.
    No-op when step-up isn't required; otherwise redeems a verified
    action='wallet_link' challenge (commits, like consume_verified_challenge)."""
    if not wallet_link_requires_step_up(user):
        return
    try:
        cid = challenge_id if isinstance(challenge_id, UUID) else UUID(str(challenge_id).strip())
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=403, detail="STEP_UP_REQUIRED")
    await consume_verified_challenge(user.id, cid, WALLET_LINK_ACTION, db)


def _mask_email(email: str) -> str:
    """`alice@example.com` → `a***e@example.com`. UI hint only."""
    if not email or "@" not in email:
        return ""
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        return f"{local[0]}*@{domain}"
    return f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}@{domain}"
