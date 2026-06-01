"""SIWE (EIP-4361) wallet sign-in / link-account.

The wallet path is a sibling of `auth_service.login_user()` and
`auth_service.google_oauth()`: it ends at the same
`issue_auth_json_response()` cookie issuer so every authenticated route
downstream is identical.

Flow:
    Client                                  Server
    ──────                                  ──────
    POST /auth/wallet/nonce  ────────────►  issue_nonce()
       { address, chain_id }                     │
    ◄────────────  { nonce, domain, statement, … }
    Build SIWE message locally
    Wallet signs the message
    POST /auth/wallet/verify ────────────►  login_or_register_with_wallet()
       { message, signature }                    │
                                            • parse SIWE
                                            • atomic consume nonce
                                            • verify signature
                                            • find/create user
                                            • issue cookies
    ◄────────────  TokenResponse + HttpOnly cookies

Single-use guarantee comes from the atomic UPDATE … RETURNING in
`_consume_nonce`: a concurrent verify of the same nonce sees no row and
fails with 401.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from uuid import UUID

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import User, WalletAuthNonce
from packages.common.src.schemas import WalletNonceResponse

from .auth_service import (
    AuthServiceError, _allowed_origins, _consume_referral, client_ip_for_inet,
    issue_auth_json_response, rate_limit_http,
)

logger = logging.getLogger("wallet_auth_service")

NONCE_TTL_SECONDS = 300
ALLOWED_CHAIN_IDS = {1, 56, 137, 42161}  # mainnet, bsc, polygon, arbitrum
SIWE_STATEMENT = (
    "Sign in to FXArtha. This signature does not authorise any transaction."
)
WALLET_PLACEHOLDER_EMAIL_DOMAIN = "wallet.fxartha.local"


# ─── Helpers ──────────────────────────────────────────────────────────────


def _normalize_address(addr: str) -> str:
    """EVM addresses are case-insensitive on the wire (EIP-55 is presentational
    only). Storing lowercase keeps lookups simple and the partial unique
    index in migration 0034 enforces uniqueness on `LOWER(wallet_address)`."""
    return (addr or "").strip().lower()


def _user_agent_hash(request: Request) -> str | None:
    ua = (request.headers.get("user-agent") or "").strip()
    if not ua:
        return None
    return hashlib.sha256(ua.encode("utf-8")).hexdigest()


def _request_host(request: Request) -> str:
    """Effective hostname for SIWE `domain` validation. Trust X-Forwarded-Host
    only when it's already on our CORS allow-list — prevents a Host-header
    smuggle from forging a domain we accept."""
    fwd = (request.headers.get("x-forwarded-host") or "").split(",")[0].strip()
    if fwd:
        candidate = fwd.split(":")[0].lower()
        allowed_hosts = {
            o.split("//", 1)[-1].split(":")[0].lower()
            for o in _allowed_origins()
        }
        if candidate in allowed_hosts:
            return candidate
    return (request.url.hostname or "").lower()


def _allowed_hosts() -> set[str]:
    """Hostnames extracted from CORS_ORIGINS, used to validate the SIWE
    `domain` and `uri` fields in the signed message."""
    return {
        o.split("//", 1)[-1].split(":")[0].lower()
        for o in _allowed_origins()
    }


# ─── Nonce issuance ───────────────────────────────────────────────────────


async def issue_nonce(
    address: str,
    chain_id: int,
    request: Request,
    db: AsyncSession,
    *,
    issued_for: str = "login",
    user_id: Optional[UUID] = None,
) -> WalletNonceResponse:
    """Mint a single-use nonce bound to (address, chain_id). The client
    embeds the nonce in the SIWE message and the wallet signs it. The
    nonce expires in NONCE_TTL_SECONDS and is consumed atomically inside
    verify_signature()."""
    from .auth_service import assert_same_origin
    assert_same_origin(request)
    rate_limit_http(request, f"wallet_nonce:{_normalize_address(address)}", 10, 60.0)
    rate_limit_http(request, "wallet_nonce_global", 100, 60.0)

    if chain_id not in ALLOWED_CHAIN_IDS:
        raise AuthServiceError("Unsupported chain", 400)

    addr = _normalize_address(address)

    # Cap concurrent unconsumed nonces per address. Without this, a script
    # can flood the wallet_auth_nonces table with millions of rows for
    # any address (the rate limit only smooths the burst). Six unconsumed
    # nonces is plenty for normal "click → fail → retry" UX.
    active_q = await db.execute(
        select(func.count())
        .select_from(WalletAuthNonce)
        .where(
            func.lower(WalletAuthNonce.address) == addr,
            WalletAuthNonce.consumed_at.is_(None),
            WalletAuthNonce.expires_at > func.now(),
        )
    )
    if (active_q.scalar() or 0) >= 6:
        raise AuthServiceError("Too many pending sign-in attempts for this wallet", 429)
    # Defensive shape check — Pydantic already enforced 0x + 40 hex but
    # is_address() also catches mixed-case checksum issues if present.
    try:
        from eth_utils import is_address
        if not is_address(addr):
            raise AuthServiceError("Invalid wallet address", 400)
    except ImportError:
        # eth_utils ships transitively with `siwe`; if missing, we still
        # have the regex check from Pydantic — fall through.
        pass

    # token_hex is alphanumeric → satisfies SIWE's RFC-3986 nonce charset
    # without re-rolling. 16 bytes = 128 bits of entropy.
    nonce = secrets.token_hex(16)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=NONCE_TTL_SECONDS)

    db.add(WalletAuthNonce(
        address=addr,
        nonce=nonce,
        chain_id=chain_id,
        issued_for=issued_for,
        user_id=user_id,
        ip_address=client_ip_for_inet(request),
        user_agent_hash=_user_agent_hash(request),
        expires_at=expires,
    ))
    await db.commit()

    return WalletNonceResponse(
        nonce=nonce,
        issued_at=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        expires_at=expires.strftime("%Y-%m-%dT%H:%M:%SZ"),
        domain=_request_host(request),
        statement=SIWE_STATEMENT,
    )


# ─── Verification ─────────────────────────────────────────────────────────


def _import_siwe():
    """Local import so a missing dep surfaces as a 500 only when wallet
    sign-in is actually used, not at module import time."""
    try:
        from siwe import SiweMessage  # type: ignore
        return SiweMessage
    except ImportError as e:
        raise AuthServiceError("Wallet sign-in unavailable on this server", 503) from e


async def verify_message(
    message: str,
    signature: str,
    request: Request,
    db: AsyncSession,
    *,
    expected_user_id: Optional[UUID] = None,
) -> Tuple[str, WalletAuthNonce]:
    """Parse SIWE, atomically consume the nonce, and verify the signature.
    Does NOT touch the users table. Returns the verified wallet address
    (lowercase) and the consumed nonce row. Caller decides what to do
    next — sign-in user lookup vs. profile-link write.

    Single-use guarantee comes from the atomic UPDATE … RETURNING: a
    concurrent verify of the same payload sees no matching row and is
    rejected with 401."""
    from .auth_service import assert_same_origin
    assert_same_origin(request)
    rate_limit_http(request, "wallet_verify", 30, 60.0)
    SiweMessage = _import_siwe()

    # 1. Parse.
    try:
        siwe_msg = SiweMessage.from_message(message)
    except Exception as e:
        logger.info("siwe parse failed: %s", e)
        raise AuthServiceError("Invalid SIWE message", 400)

    # 2. Validate the message body.
    expected_host = _request_host(request)
    allowed_hosts = _allowed_hosts() | ({expected_host} if expected_host else set())

    if str(getattr(siwe_msg, "domain", "")).lower() not in allowed_hosts:
        raise AuthServiceError("SIWE domain not allowed", 401)

    uri = str(getattr(siwe_msg, "uri", ""))
    uri_host = uri.split("//", 1)[-1].split("/", 1)[0].split(":", 1)[0].lower()
    if uri_host not in allowed_hosts:
        raise AuthServiceError("SIWE uri host not allowed", 401)

    if str(getattr(siwe_msg, "version", "")) != "1":
        raise AuthServiceError("Unsupported SIWE version", 401)

    chain_id = int(getattr(siwe_msg, "chain_id", 0) or 0)
    if chain_id not in ALLOWED_CHAIN_IDS:
        raise AuthServiceError("Unsupported chain", 401)

    if (getattr(siwe_msg, "statement", None) or "") != SIWE_STATEMENT:
        raise AuthServiceError("SIWE statement mismatch", 401)

    issued_at_raw = getattr(siwe_msg, "issued_at", None)
    if not issued_at_raw:
        raise AuthServiceError("Missing issued-at", 401)
    try:
        issued_at = datetime.fromisoformat(str(issued_at_raw).replace("Z", "+00:00"))
    except ValueError:
        raise AuthServiceError("Invalid issued-at", 401)
    now = datetime.now(timezone.utc)
    if issued_at > now + timedelta(seconds=60):
        raise AuthServiceError("issued-at in the future", 401)

    expiration_raw = getattr(siwe_msg, "expiration_time", None)
    if expiration_raw:
        try:
            exp_dt = datetime.fromisoformat(str(expiration_raw).replace("Z", "+00:00"))
        except ValueError:
            raise AuthServiceError("Invalid expiration-time", 401)
        if exp_dt < now:
            raise AuthServiceError("SIWE message expired", 401)

    siwe_address = _normalize_address(str(getattr(siwe_msg, "address", "")))
    siwe_nonce = str(getattr(siwe_msg, "nonce", ""))
    if not siwe_address or not siwe_nonce:
        raise AuthServiceError("Malformed SIWE fields", 401)

    # 3. Look up the nonce (NOT consumed yet). This is a plain read —
    # consumption is deferred until after signature verification so an
    # attacker who fires a bad signature can't burn a victim's nonce
    # and lock them out of a real login.
    res = await db.execute(
        select(WalletAuthNonce).where(
            WalletAuthNonce.nonce == siwe_nonce,
            WalletAuthNonce.consumed_at.is_(None),
            WalletAuthNonce.expires_at > func.now(),
            func.lower(WalletAuthNonce.address) == siwe_address,
            WalletAuthNonce.chain_id == chain_id,
        )
    )
    nonce_row = res.scalar_one_or_none()
    if nonce_row is None:
        raise AuthServiceError("Invalid or expired nonce", 401)

    # 4. Link-flow ownership check.
    if expected_user_id is not None and nonce_row.user_id != expected_user_id:
        raise AuthServiceError("Nonce not issued for this session", 401)

    # 5. Signature verification — pure CPU, no DB write. A bad signature
    # leaves the nonce untouched so the legitimate signer can still use it.
    try:
        siwe_msg.verify(signature)
    except Exception as e:
        logger.info("siwe signature verify failed: %s", e)
        raise AuthServiceError("Signature verification failed", 401)

    # 6. Atomic single-use consume — only now do we burn the nonce. The
    # WHERE consumed_at IS NULL clause makes a concurrent winner of two
    # legitimate-looking verify requests deterministic: exactly one row
    # is updated, the loser gets nonce_row=None and a 401.
    consumed = await db.execute(
        update(WalletAuthNonce)
        .where(
            WalletAuthNonce.id == nonce_row.id,
            WalletAuthNonce.consumed_at.is_(None),
        )
        .values(consumed_at=func.now())
        .returning(WalletAuthNonce)
    )
    if consumed.scalar_one_or_none() is None:
        # Another concurrent verifier (with their own valid signature)
        # already consumed this nonce. Reject this attempt to keep
        # single-use semantics intact.
        raise AuthServiceError("Nonce already used", 401)
    await db.commit()
    return siwe_address, nonce_row


async def resolve_or_create_user(
    siwe_address: str, db: AsyncSession,
) -> Tuple[User, bool]:
    """For sign-in flows: find the user that owns this wallet, or create a
    fresh row if none exists. Returns (user, created)."""
    found = await db.execute(
        select(User).where(func.lower(User.wallet_address) == siwe_address)
    )
    user = found.scalar_one_or_none()
    if user is not None:
        return user, False

    placeholder_email = f"wallet_{siwe_address}@{WALLET_PLACEHOLDER_EMAIL_DOMAIN}"
    user = User(
        email=placeholder_email,
        password_hash=None,
        wallet_address=siwe_address,
        first_name="",
        last_name="",
        role="user",
        status="active",
        kyc_status="pending",
    )
    db.add(user)
    await db.flush()
    await db.commit()
    return user, True


# ─── Public entry: wallet login or register ──────────────────────────────


async def login_or_register_with_wallet(
    message: str,
    signature: str,
    request: Request,
    db: AsyncSession,
    *,
    referral_code: Optional[str] = None,
) -> JSONResponse:
    """The endpoint handler for POST /auth/wallet/verify."""
    siwe_address, nonce_row = await verify_message(
        message, signature, request, db,
    )
    user, created = await resolve_or_create_user(siwe_address, db)

    if created and referral_code:
        try:
            await _consume_referral(db, user.id, referral_code)
            await db.commit()
        except Exception as e:
            # Referral attribution is best-effort — never block sign-in.
            logger.debug("wallet signup referral attach failed: %s", e)
            await db.rollback()

    return await issue_auth_json_response(
        user, request, db,
        user_audit_action="WALLET_LOGIN",
        audit_metadata={
            "wallet": user.wallet_address,
            "chain_id": int(nonce_row.chain_id),
            "new_user": bool(created),
        },
    )
