"""Authentication API — Register, Login, 2FA, Password Change, Demo login, Password reset."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.schemas import (
    RegisterRequest, LoginRequest, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest, MessageResponse, BootstrapSessionRequest,
    GoogleAuthRequest,
    WalletNonceRequest, WalletNonceResponse, WalletVerifyRequest,
)
from packages.common.src.auth import get_current_user
from ..services.auth_service import (
    AuthServiceError,
    register_user, login_user, demo_login as _demo_login,
    google_oauth as _google_oauth,
    refresh_token as _refresh_token, bootstrap_session as _bootstrap_session,
    forgot_password as _forgot_password, reset_password as _reset_password,
    setup_2fa as _setup_2fa, verify_2fa as _verify_2fa,
    change_password as _change_password, get_me as _get_me, logout_user,
    client_ip_for_inet,
)
from ..services import wallet_auth_service, email_otp_service, sensitive_action_service

logger = logging.getLogger("auth_api")

router = APIRouter()

# Keep this alias so orders.py (and any other module) that does
#   from .auth import _client_ip_for_inet
# continues to work without changes until orders.py is also refactored.
_client_ip_for_inet = client_ip_for_inet


@router.get("/platform-status")
async def platform_status():
    """Public: returns current platform flags so the frontend can gate UI
    (maintenance banner, register button, etc.). No auth required."""
    from packages.common.src.settings_store import get_bool_setting
    return {
        "maintenance_mode": await get_bool_setting("maintenance_mode", False),
        "allow_new_registrations": await get_bool_setting("allow_new_registrations", True),
        "allow_deposits": await get_bool_setting("allow_deposits", True),
        "allow_withdrawals": await get_bool_setting("allow_withdrawals", True),
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # 5 fresh signups per IP per 10 minutes — far above any organic rate
    # but stops spam-account creation from a single host.
    from ..services.auth_service import rate_limit_http
    rate_limit_http(request, "register", 5, 600.0)
    try:
        return await register_user(
            email=req.email, password=req.password,
            first_name=req.first_name, last_name=req.last_name,
            phone=req.phone, country=req.country,
            referral_code=req.referral_code,
            request=request, db=db,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/login")
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # 10 attempts per IP per minute — generous enough that a user can
    # mistype their password a few times, tight enough to block
    # credential stuffing. The per-bucket limiter falls back to in-process
    # if Redis is down, so a Redis blip never opens the floodgates.
    from ..services.auth_service import rate_limit_http
    rate_limit_http(request, "login", 10, 60.0)
    try:
        return await login_user(
            email=req.email, password=req.password,
            totp_code=req.totp_code, request=request, db=db,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/demo-login")
async def demo_login(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        return await _demo_login(request=request, db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception:
        logger.exception("demo-login failed unexpectedly")
        try:
            await db.rollback()
        except Exception:
            pass
        # Don't leak exception class / message to the client — full
        # detail is in the server logs above.
        raise HTTPException(
            status_code=500,
            detail="Demo sign-in failed. Please try again.",
        )


@router.post("/google")
async def google_auth(req: GoogleAuthRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        return await _google_oauth(
            id_token_str=req.id_token,
            referral_code=req.referral_code,
            request=request,
            db=db,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception:
        logger.exception("google sign-in failed unexpectedly")
        try:
            await db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail="Google sign-in failed. Please try again.",
        )


@router.post("/wallet/nonce", response_model=WalletNonceResponse)
async def wallet_nonce(
    req: WalletNonceRequest, request: Request, db: AsyncSession = Depends(get_db),
):
    """Issue a single-use SIWE nonce for the given wallet address. The
    client embeds it in the SIWE message and the wallet signs it. The
    nonce expires in 5 minutes and is consumed exactly once on verify."""
    try:
        return await wallet_auth_service.issue_nonce(
            req.address, req.chain_id, request, db,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/wallet/verify")
async def wallet_verify(
    req: WalletVerifyRequest, request: Request, db: AsyncSession = Depends(get_db),
):
    """Verify a SIWE signature, find or create the user, and issue cookies.
    Reuses `issue_auth_json_response()` so wallet sessions are
    indistinguishable from email/Google sessions for downstream routes."""
    try:
        return await wallet_auth_service.login_or_register_with_wallet(
            req.message, req.signature, request, db,
            referral_code=req.referral_code,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception:
        logger.exception("wallet verify failed unexpectedly")
        try:
            await db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail="Wallet sign-in failed. Please try again.",
        )


@router.post("/refresh")
async def auth_refresh(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        return await _refresh_token(request=request, db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/bootstrap-session")
async def bootstrap_session(
    req: BootstrapSessionRequest, request: Request, db: AsyncSession = Depends(get_db),
):
    try:
        return await _bootstrap_session(
            access_token=req.access_token, request=request, db=db,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


class _ImpersonateRedeemRequest(BaseModel):
    code: str


@router.post("/impersonate/redeem")
async def impersonate_redeem(
    body: _ImpersonateRedeemRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Redeem a single-use admin impersonation code (issued by
    `/admin/users/{id}/login-as`) for an HttpOnly session cookie pair.

    Why this exists: the admin UI used to embed the raw impersonation
    JWT in `?token=...` on the trader URL. The token leaked to browser
    history, server logs, and Referer headers. Now the admin gets back
    a 32-char hex code with a 60-second TTL — that's what travels via
    the URL. We GETDEL it from Redis (atomic, single-use), recover the
    JWT it was wrapping, and set HttpOnly cookies on the trader domain.

    Rate-limited so a stolen URL can't be retried indefinitely if the
    attacker races the legitimate redemption."""
    from ..services.auth_service import rate_limit_http
    rate_limit_http(request, "impersonate-redeem", 10, 60.0)

    code = (body.code or "").strip()
    if not code or len(code) < 16 or len(code) > 64:
        raise HTTPException(status_code=400, detail="Invalid redemption code")

    # Same Redis db-0 the admin service writes into. GETDEL is atomic —
    # the second caller of the same code can never succeed.
    import os
    import json
    import redis.asyncio as aioredis
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    pool = aioredis.from_url(
        redis_url.rsplit("/", 1)[0] + "/0", decode_responses=True,
    )
    try:
        raw = await pool.getdel(f"impersonation:{code}")
    finally:
        try:
            await pool.aclose()
        except Exception:
            pass

    if not raw:
        raise HTTPException(status_code=404, detail="Code expired or already used")
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        raise HTTPException(status_code=500, detail="Corrupted impersonation payload")

    access_token = data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=500, detail="Missing token in redemption payload")

    try:
        return await _bootstrap_session(
            access_token=access_token, request=request, db=db,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(req: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # 3 reset emails per IP per 10 minutes — stops a single host from
    # spamming the queue / SMTP throughput and prevents enumeration
    # attempts via timing.
    from ..services.auth_service import rate_limit_http
    rate_limit_http(request, "forgot-password", 3, 600.0)
    try:
        result = await _forgot_password(email=req.email, request=request, db=db)
        return MessageResponse(**result)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(req: ResetPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # 10 attempts per IP per 10 minutes — a real user reading from email
    # only ever submits this once; a token-guessing attacker would need
    # massive throughput to succeed at this rate.
    from ..services.auth_service import rate_limit_http
    rate_limit_http(request, "reset-password", 10, 600.0)
    try:
        result = await _reset_password(token=req.token, new_password=req.new_password, request=request, db=db)
        return MessageResponse(**result)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Cached for 15s — /auth/me is the AuthProvider heartbeat that fires
    every 60s and is also polled on every page transition. The fields it
    returns (name / email / kyc_status / wallet linkage / role / locale)
    change at human pace, so a 15s freshness window is invisible to UX
    while cutting the DB read by ~10x at scale. Mutation paths that
    change these fields call cache.cache_invalidate("auth_me", user_id)
    to bust the cache immediately."""
    from packages.common.src.cache import cache_get, cache_set

    user_id = current_user["user_id"]
    cached = await cache_get("auth_me", str(user_id))
    if cached is not None:
        return cached
    try:
        result = await _get_me(user_id=user_id, db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    await cache_set("auth_me", str(user_id), result, ttl_seconds=15)
    return result


@router.post("/2fa/setup")
async def setup_2fa(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        return await _setup_2fa(user_id=current_user["user_id"], db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/2fa/verify")
async def verify_2fa(
    code: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirms the freshly-set TOTP secret and returns 8 one-time backup
    codes. Display those to the user once — they can't be retrieved
    later. The /2fa/regenerate-backup-codes endpoint mints a fresh batch
    if the original sheet is lost.

    Rate-limited at 5 attempts / 10 minutes per IP because 6-digit TOTP
    codes have ~1M states — without throttling a determined attacker
    could exhaust them in well under an hour."""
    from ..services.auth_service import rate_limit_http
    rate_limit_http(request, "2fa-verify", 5, 600.0)
    try:
        return await _verify_2fa(user_id=current_user["user_id"], code=code, db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/2fa/regenerate-backup-codes")
async def regenerate_2fa_backup_codes(
    current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    from ..services.auth_service import regenerate_2fa_backup_codes as _regen
    try:
        return await _regen(user_id=current_user["user_id"], db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/password/change")
async def change_password(
    old_password: str, new_password: str,
    current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        return await _change_password(
            user_id=current_user["user_id"],
            old_password=old_password, new_password=new_password, db=db,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/logout")
async def logout(
    request: Request, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        return await logout_user(user_id=current_user["user_id"], request=request, db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


# ─── Email OTP verification ───────────────────────────────────────────────
# Powers the onboarding gate's email step (wallet-first signups + change-
# email flow). The user is already authenticated when they hit these
# routes — we're verifying that they actually own the address they typed.

from pydantic import BaseModel  # noqa: E402  (kept inline to localize the dep)


class _StartEmailVerificationRequest(BaseModel):
    email: str


class _VerifyEmailOtpRequest(BaseModel):
    otp: str


@router.post("/email/start-verification")
async def start_email_verification(
    body: _StartEmailVerificationRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Issue a fresh 6-digit OTP and email it to body.email."""
    return await email_otp_service.start_verification(
        user_id=current_user["user_id"], target_email=body.email, db=db,
    )


@router.post("/email/verify-otp")
async def verify_email_otp(
    body: _VerifyEmailOtpRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Consume the latest OTP and promote target_email → users.email.

    Rate-limited at 5 attempts / 10 minutes per IP. 6-digit codes have
    only ~1M states; an unthrottled attacker who already has a session
    could brute-force the OTP in a few thousand seconds."""
    from ..services.auth_service import rate_limit_http
    rate_limit_http(request, "email-otp-verify", 5, 600.0)
    return await email_otp_service.verify_otp(
        user_id=current_user["user_id"],
        otp=body.otp,
        db=db,
        request_ip=client_ip_for_inet(request),
    )


# ─── Step-up authentication (async multi-roundtrip flows) ─────────────────
# Used by email-change today and TOTP / passkey / hardware-wallet in the
# future. Inline step-up (password / fresh SIWE in the same request body)
# does NOT come through these routes — it's verified directly by the
# action handler. See services/sensitive_action_service.py.


class _StepUpStartRequest(BaseModel):
    action: str          # email_change | wallet_disconnect | withdrawal | …
    method: str          # otp_old_email | siwe | totp | passkey
    metadata: dict | None = None


class _StepUpVerifyRequest(BaseModel):
    challenge_id: str
    proof: dict          # method-specific payload (otp / message+signature / …)


@router.post("/step-up/start")
async def step_up_start(
    body: _StepUpStartRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Issue a step-up challenge. Returns a challenge_id the client uses
    on /step-up/verify. For 'otp_old_email' the OTP is sent
    immediately; for 'siwe' the response includes the wallet address
    the client should sign with."""
    return await sensitive_action_service.start_challenge(
        user_id=current_user["user_id"],
        action=body.action,
        method=body.method,
        metadata=body.metadata or {},
        db=db,
    )


@router.post("/step-up/verify")
async def step_up_verify(
    body: _StepUpVerifyRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify the proof for a previously-started challenge. On success
    sets verified_at — the row is now redeemable for one matching
    action call within 5 minutes. The action handler then uses
    consume_verified_challenge() to atomically redeem it."""
    from uuid import UUID as _UUID
    try:
        challenge_uuid = _UUID(body.challenge_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid challenge id")
    challenge = await sensitive_action_service.verify_challenge(
        user_id=current_user["user_id"],
        challenge_id=challenge_uuid,
        proof=body.proof,
        request=request,
        db=db,
    )
    return {
        "verified": True,
        "challenge_id": str(challenge.id),
        "action": challenge.action,
        "method": challenge.method,
        "verified_at": challenge.verified_at.isoformat() if challenge.verified_at else None,
        # Frontend uses this as a deadline for redeeming the action.
        "ttl_seconds": sensitive_action_service.STEP_UP_TOKEN_TTL_MINUTES * 60,
    }
