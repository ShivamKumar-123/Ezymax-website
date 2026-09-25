"""Auth Service — Registration, login, token management, demo user, 2FA, password reset."""
import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pyotp
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4

from packages.common.src.config import get_settings
from packages.common.src.models import (
    User, UserSession, TradingAccount, AccountGroup,
    IBProfile, Referral, PasswordResetToken, UserRefreshToken, UserAuditLog,
)
from packages.common.src.schemas import TokenResponse
from packages.common.src.auth import (
    hash_password, verify_password, create_access_token,
    hash_token, decode_token, invalidate_session_cache,
)

from packages.common.src.email_branding import apply_email_brand
from packages.common.src.redis_client import redis_client

logger = logging.getLogger("auth_service")

DEMO_SHARED_EMAIL = "demo@swisscresta.com"
DEMO_STARTING_BALANCE = Decimal("10000")

_rate_buckets: dict[str, list[float]] = {}


# ─── Exceptions ───────────────────────────────────────────────────────────

class AuthServiceError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def _allowed_origins() -> set[str]:
    raw = (get_settings().CORS_ORIGINS or "").split(",")
    return {o.strip().rstrip("/") for o in raw if o.strip()}


def assert_same_origin(request: Request) -> None:
    """Reject state-changing auth requests whose Origin/Referer is not on our allow-list.

    Defense in depth on top of CORS + SameSite=strict cookies. Browsers always
    send Origin on cross-origin POSTs; if it's missing entirely (e.g. curl from
    a script), we allow the call — the attacker would still need a valid id_token
    for our audience, which they cannot mint."""
    origin = (request.headers.get("origin") or "").strip().rstrip("/")
    referer = (request.headers.get("referer") or "").strip()
    if not origin and not referer:
        return  # non-browser caller; id_token audience check still gates auth
    allowed = _allowed_origins()
    if not allowed:
        return  # not configured — trust CORS layer
    if origin and origin in allowed:
        return
    if referer:
        # match referer prefix against any allowed origin
        for ao in allowed:
            if referer.startswith(ao + "/") or referer == ao:
                return
    raise AuthServiceError("Origin not allowed", 403)


async def assert_same_origin_or_tenant(request: Request, db: AsyncSession) -> None:
    """Same-origin guard that ALSO accepts live white-label tenant domains.

    A tenant's users log in from https://<their-broker-domain>, which is
    never in CORS_ORIGINS — without this, every white-label login would
    403. Only domains whose provisioning status is READY (cached 60s)
    are accepted, so the allow-list stays as tight as the static one."""
    try:
        assert_same_origin(request)
        return
    except AuthServiceError:
        if not get_settings().BRANDING_ENABLED:
            raise
        from packages.common.src import broker_tenancy
        host = broker_tenancy.host_from_request_headers(
            request.headers.get("origin"), request.headers.get("referer")
        )
        if host and host in await broker_tenancy.active_tenant_hosts(db):
            return
        raise


# Rate-limit helpers were lifted into packages/common so the admin API
# can share them. Re-exported here for back-compat with the existing
# `from .auth_service import rate_limit_http` callers across the gateway.
from packages.common.src.rate_limit import (  # noqa: F401  (re-export)
    client_ip_for_inet,
    rate_limit_http,
)


# ─── Utility: cookies ────────────────────────────────────────────────────

def _request_appears_secure(request: Request) -> bool:
    if request.headers.get("x-forwarded-proto", "").lower().startswith("https"):
        return True
    return request.url.scheme == "https"


def _cookie_secure_flag(request: Request) -> bool:
    st = get_settings()
    if st.COOKIE_SECURE is not None:
        return st.COOKIE_SECURE
    return _request_appears_secure(request)


def _cookie_samesite() -> str:
    v = get_settings().COOKIE_SAMESITE.lower().strip()
    if v not in ("lax", "strict", "none"):
        return "strict"
    return v


def _cookie_domain(request: Request | None = None) -> str | None:
    """Cookie Domain attribute, host-aware for white-label tenants.

    COOKIE_DOMAIN (.swisscresta.com) makes the session span apex +
    trade subdomain — but a Set-Cookie carrying Domain=.swisscresta.com
    is silently REJECTED by browsers when the response is served on a
    tenant domain (tarundewangan.com), which broke demo/login on every
    white-label site. When the request's browser host isn't under the
    configured parent domain, omit Domain entirely → host-only cookie,
    which is exactly right for a tenant (their trader app lives on one
    host)."""
    d = get_settings().COOKIE_DOMAIN.strip()
    if not d:
        return None
    if request is not None:
        parent = d.lstrip(".").lower()
        from packages.common.src import broker_tenancy
        host = broker_tenancy.host_from_request_headers(
            request.headers.get("origin"), request.headers.get("referer")
        ) or (request.headers.get("host") or "").split(":")[0].lower()
        if host and host != parent and not host.endswith("." + parent):
            return None
    return d


def attach_auth_cookies(
    response: JSONResponse,
    request: Request,
    *,
    access_token: str,
    access_expires_at: datetime,
    raw_refresh: str | None,
) -> None:
    st = get_settings()
    secure = _cookie_secure_flag(request)
    ss = _cookie_samesite()
    domain = _cookie_domain(request)
    exp = access_expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    max_age_access = max(60, int((exp - datetime.now(timezone.utc)).total_seconds()))
    max_age_refresh = max(3600, st.JWT_REFRESH_EXPIRY_DAYS * 86400)
    access_kw: dict = {
        "key": st.ACCESS_TOKEN_COOKIE_NAME,
        "value": access_token,
        "httponly": True,
        "secure": secure,
        "samesite": ss,
        "path": "/",
    }
    if domain:
        access_kw["domain"] = domain
    if not st.JWT_REFRESH_SESSION_COOKIE:
        access_kw["max_age"] = max_age_access
    response.set_cookie(**access_kw)
    if raw_refresh is None:
        # Session issued WITHOUT a refresh token (e.g. admin impersonation):
        # clear any refresh cookie already in this browser so a later
        # /auth/refresh can't silently resurrect a different identity.
        if domain:
            response.delete_cookie(st.REFRESH_TOKEN_COOKIE_NAME, path="/", domain=domain)
        response.delete_cookie(st.REFRESH_TOKEN_COOKIE_NAME, path="/")
        return
    refresh_kw: dict = {
        "key": st.REFRESH_TOKEN_COOKIE_NAME,
        "value": raw_refresh,
        "httponly": True,
        "secure": secure,
        "samesite": ss,
        "path": "/",
    }
    if domain:
        refresh_kw["domain"] = domain
    if not st.JWT_REFRESH_SESSION_COOKIE:
        refresh_kw["max_age"] = max_age_refresh
    response.set_cookie(**refresh_kw)


def clear_auth_cookies(response: JSONResponse, request: Request) -> None:
    st = get_settings()
    secure = _cookie_secure_flag(request)
    ss = _cookie_samesite()
    domain = _cookie_domain(request)
    delete_kw_a = dict(path="/", samesite=ss, secure=secure)
    delete_kw_r = dict(path="/", samesite=ss, secure=secure)
    if domain:
        delete_kw_a["domain"] = domain
        delete_kw_r["domain"] = domain
    response.delete_cookie(st.ACCESS_TOKEN_COOKIE_NAME, **delete_kw_a)
    response.delete_cookie(st.REFRESH_TOKEN_COOKIE_NAME, **delete_kw_r)


# ─── Utility: transactional email senders ────────────────────────────────


def _send_welcome_email(user: User, *, via_google: bool) -> None:
    """Schedule a welcome email after a successful signup. Fire-and-forget:
    SMTP latency or failure must never delay the API response or roll back
    the signup."""
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        if not smtp_configured():
            return
        from packages.common.src.email_templates import render_welcome
        st = get_settings()
        subject, html, text = render_welcome(
            first_name=user.first_name,
            trader_app_url=st.TRADER_APP_URL or "https://trade.swisscresta.com",
            via_google=via_google,
        )
        fire_and_forget(send_email(user.email, subject, html, text=text))
    except Exception as e:
        logger.warning("welcome email scheduling failed for %s: %s", user.email, e)


async def _send_login_notification_email(
    user: User,
    request: Request,
    db: AsyncSession,
    new_session_id: UUID,
) -> None:
    """Email the user that a sign-in just happened on their account.

    Fires on every login (email/password, Google, wallet) so the account
    owner has a paper trail. Best-effort, fire-and-forget — never blocks
    the login response or rolls anything back. Skips wallet-placeholder
    addresses (@wallet.swisscresta.local) since those aren't real mailboxes;
    those users get notified once they add a real email via the profile."""
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        if not smtp_configured() or not user.email:
            return
        # Wallet-first signups get a synthesized placeholder email; sending
        # to wallet.swisscresta.local would just bounce.
        if user.email.lower().endswith("@wallet.swisscresta.local"):
            return

        ua = (request.headers.get("user-agent") or "").strip()
        from packages.common.src.email_templates import render_new_login

        ip = client_ip_for_inet(request) or None
        when_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        st = get_settings()
        await apply_email_brand(db, user)
        subject, html, text = render_new_login(
            first_name=user.first_name,
            ip_address=str(ip) if ip else None,
            user_agent=ua,
            location=None,
            when_utc=when_utc,
            trader_app_url=st.TRADER_APP_URL or "https://trade.swisscresta.com",
        )
        fire_and_forget(send_email(user.email, subject, html, text=text))
    except Exception as e:
        logger.debug("new-login email check failed for %s: %s", getattr(user, "email", "?"), e)


# ─── Utility: account number ─────────────────────────────────────────────

def generate_account_number() -> str:
    return f"PT{secrets.randbelow(90000000) + 10000000}"


# ─── Utility: referral attribution ───────────────────────────────────────

async def _consume_referral(db: AsyncSession, user_id: UUID, referral_code: str) -> None:
    """Attach a new user to the IB whose referral_code they used. Silent no-op if the code
    is missing, expired, or owned by an inactive IB — we don't want to block signup over it.
    On a successful link, also credits the IB referrer the signup bonus (XP/AC/PS)
    per XP_Reward_mechanism slide 4."""
    code = (referral_code or "").strip()
    if not code:
        return
    ib_q = await db.execute(
        select(IBProfile).where(IBProfile.referral_code == code, IBProfile.is_active == True)
    )
    ib_profile = ib_q.scalar_one_or_none()
    if ib_profile:
        db.add(Referral(referrer_id=ib_profile.user_id, referred_id=user_id, ib_profile_id=ib_profile.id))


# ─── Utility: white-label tenant attribution (stock4x port) ──────────────

async def apply_tenant_attribution(
    db: AsyncSession, user: User, referral_code: str | None, request: Request
) -> None:
    """Places a NEW self-registered user in the right white-label pool.

    Priority (stock4x order): explicit ?ref=<WL-partner-code> beats the
    custom domain the signup arrived on; anything else stays in the
    platform pool. Separate from the IB referral system — the same code
    field is tried against broker partner codes first, then falls
    through to IB attribution untouched. No-op when BRANDING_ENABLED is
    off or nothing matches, so plain platform signups are unaffected."""
    from packages.common.src import broker_tenancy
    try:
        host = broker_tenancy.host_from_request_headers(
            request.headers.get("origin"), request.headers.get("referer")
        )
        owner, origin = await broker_tenancy.resolve_owner_for_request(
            db, referral_code=referral_code, host=host
        )
        pool = broker_tenancy.pool_assignment_for_owner(owner)
        for field, value in pool.items():
            setattr(user, field, value)
        if pool or user.signup_origin is None:
            user.signup_origin = origin
    except Exception:
        # Attribution must never block a signup.
        logger.exception("tenant attribution skipped")


# ─── Core: issue auth response ───────────────────────────────────────────

def _include_json_access_token(legacy_flag: bool, json_delivery: bool) -> bool:
    """H-AUTH-3: the access token is echoed in the JSON body ONLY when a
    cookie-less client explicitly opts in (x-token-delivery: json) or the legacy
    flag is enabled. Cookie (web) clients get an empty token — they authenticate
    via the HttpOnly cookie, so echoing it only widens XSS reach."""
    return bool(legacy_flag or json_delivery)


async def issue_auth_json_response(
    user: User,
    request: Request,
    db: AsyncSession,
    *,
    status_code: int = 200,
    user_audit_action: str | None = None,
    audit_metadata: dict | None = None,
    amr_override: str | None = None,
    issue_refresh: bool = True,
) -> JSONResponse:
    """Create user_session + refresh row, commit, return JSON (+ HttpOnly cookies).

    All inserts (session, refresh, optional audit log) are flushed together and
    committed atomically. Any exception raised before this commit leaves the
    transaction open for the route handler to roll back.

    amr_override: force the session's amr (e.g. "impersonation").
    issue_refresh: False → no refresh token (session dies with the access
    token; used for admin impersonation so it can't outlive its window)."""
    # H-AUTH-3: bind the token to its user_sessions row via a sid claim (set the
    # session id explicitly so no extra flush is needed) and record how the
    # session was established (amr) — a real login vs a derived/bootstrap session.
    sid = uuid4()
    _login_actions = {"LOGIN", "WALLET_LOGIN", "OAUTH_GOOGLE_LOGIN", "OAUTH_GOOGLE_REGISTER", "REGISTER", "DEMO_LOGIN"}
    amr = amr_override or ("login" if (user_audit_action in _login_actions) else "derived")
    token, expires = create_access_token(str(user.id), user.role, sid=str(sid), amr=amr)
    new_session = UserSession(
        id=sid,
        user_id=user.id,
        token_hash=hash_token(token),
        ip_address=client_ip_for_inet(request),
        user_agent=request.headers.get("user-agent"),
        expires_at=expires,
    )
    db.add(new_session)
    st = get_settings()
    raw_refresh: str | None = None
    ref_exp = datetime.now(timezone.utc) + timedelta(days=st.JWT_REFRESH_EXPIRY_DAYS)
    if issue_refresh:
        raw_refresh = secrets.token_urlsafe(48)
        db.add(
            UserRefreshToken(
                user_id=user.id,
                token_hash=hash_token(raw_refresh),
                expires_at=ref_exp,
                revoked=False,
            )
        )
    if user_audit_action:
        ua = (request.headers.get("user-agent") or "").strip()
        # device_info is plain Text; embed structured audit metadata (e.g. Google sub/email)
        # as a JSON suffix so it's later searchable via ILIKE without a schema change.
        device_info: str | None = ua[:2048] if ua else None
        if audit_metadata:
            try:
                meta_json = json.dumps(audit_metadata, separators=(",", ":"))
            except (TypeError, ValueError):
                meta_json = ""
            if meta_json:
                marker = f" :: meta={meta_json}"
                device_info = ((device_info or "") + marker)[:4096]
            # Also emit a structured app-log line so SIEM can pick it up without
            # parsing device_info, and so we don't lose the event if the DB write fails.
            logger.info(
                "auth_audit action=%s user_id=%s meta=%s",
                user_audit_action, user.id, audit_metadata,
            )
        db.add(
            UserAuditLog(
                user_id=user.id,
                action_type=user_audit_action,
                ip_address=client_ip_for_inet(request),
                device_info=device_info,
            )
        )
    await db.commit()

    # Best-effort: notify the user by email on every successful sign-in
    # (email/password, Google, wallet). Never raises into the login path.
    # Includes the Google REGISTER path so first-time Google signups still
    # see a login record, matching the client's "every login" requirement.
    if user_audit_action in (
        "LOGIN",
        "WALLET_LOGIN",
        "OAUTH_GOOGLE_LOGIN",
        "OAUTH_GOOGLE_REGISTER",
    ):
        try:
            await _send_login_notification_email(user, request, db, new_session.id)
        except Exception:
            pass

    # Cookie-less clients (the mobile app) opt into JSON token delivery with an
    # explicit request header. Web clients never send it, so browser responses
    # keep the cookie-only contract (no refresh token in JSON).
    json_delivery = (request.headers.get("x-token-delivery") or "").strip().lower() == "json"
    display_token = token if _include_json_access_token(st.JWT_INCLUDE_LEGACY_JSON_TOKEN, json_delivery) else ""
    body = TokenResponse(
        access_token=display_token,
        user_id=str(user.id),
        role=user.role,
        expires_at=expires,
    )
    content = body.model_dump(mode="json")
    if json_delivery and raw_refresh is not None:
        content["refresh_token"] = raw_refresh
        content["refresh_expires_at"] = ref_exp.isoformat()
    resp = JSONResponse(content=content, status_code=status_code)
    attach_auth_cookies(
        resp, request,
        access_token=token,
        access_expires_at=expires,
        raw_refresh=raw_refresh,
    )
    return resp


# ─── Registration ─────────────────────────────────────────────────────────

async def register_user(
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    phone: str | None,
    country: str | None,
    referral_code: str | None,
    request: Request,
    db: AsyncSession,
) -> JSONResponse:
    await assert_same_origin_or_tenant(request, db)
    from packages.common.src.settings_store import get_bool_setting

    rate_limit_http(request, "register", 15, 3600.0)
    if await get_bool_setting("maintenance_mode", False):
        raise AuthServiceError(
            "Platform is under maintenance. Registrations are temporarily disabled.", 503
        )
    if not await get_bool_setting("allow_new_registrations", True):
        raise AuthServiceError("New registrations are currently disabled", 403)

    existing = await db.execute(
        select(User).where(func.lower(User.email) == email.lower())
    )
    existing_user = existing.scalar_one_or_none()
    if existing_user is not None:
        # H-AUTH-4: no "reclaim" of an existing account — verified or not.
        # Overwriting an unverified stub in place let anyone reset another
        # in-progress signup's credentials/profile. Registration goes through
        # the OTP-first pending flow (start/verify); this legacy helper is no
        # longer wired to /auth/register and refuses any existing address.
        raise AuthServiceError("Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        country=country,
        role="user",
        status="active",
        kyc_status="pending",
    )
    db.add(user)
    await db.flush()

    if referral_code:
        await _consume_referral(db, user.id, referral_code)
    await apply_tenant_attribution(db, user, referral_code, request)

    response = await issue_auth_json_response(
        user, request, db, status_code=201, user_audit_action="REGISTER",
    )
    # Welcome email is sent later, once the user has verified their email
    # and completed their profile (handled in profile_service.update_profile).
    # Firing it here used to mean the welcome arrived before the OTP code,
    # which confused new signups.
    return response


# ─── Login ────────────────────────────────────────────────────────────────

async def _enforce_2fa(user, totp_code: str | None, db: AsyncSession) -> None:
    """Verify the user's second factor when 2FA is enabled. Shared by password
    login AND Google login (M: Google sign-in previously skipped 2FA entirely,
    letting a stolen Google session bypass the user's TOTP). Accepts a 6-digit
    TOTP or a one-time backup code."""
    if not getattr(user, "two_factor_enabled", False):
        return
    secret = (user.two_factor_secret or "").strip()
    if not secret:
        raise AuthServiceError(
            "Two-factor authentication is misconfigured for this account. Contact support.", 403
        )
    if not totp_code:
        raise AuthServiceError("2FA code required")
    totp = pyotp.TOTP(secret)
    ok = totp.verify(totp_code)
    if not ok:
        ok = await consume_2fa_backup_code(user.id, totp_code, db)
    if not ok:
        raise AuthServiceError("Invalid 2FA code", 401)


async def login_user(
    email: str,
    password: str,
    totp_code: str | None,
    request: Request,
    db: AsyncSession,
) -> JSONResponse:
    await assert_same_origin_or_tenant(request, db)
    rate_limit_http(request, "login", 40, 60.0)
    # Case-insensitive email lookup so users who registered with mixed case can still
    # sign in. The unique index on lower(email) (migration 0018) enforces uniqueness.
    result = await db.execute(select(User).where(func.lower(User.email) == email.lower()))
    user = result.scalar_one_or_none()

    # OAuth-only accounts (Google sign-in) have no password_hash. Reject the password
    # attempt with a clear message rather than silently calling bcrypt on None.
    if user and not user.password_hash:
        raise AuthServiceError(
            "This account uses Google sign-in. Click 'Continue with Google' instead.",
            400,
        )

    if not user or not verify_password(password, user.password_hash):
        raise AuthServiceError("Invalid credentials", 401)

    if user.status == "banned":
        raise AuthServiceError("Account has been banned", 403)
    if user.status == "blocked":
        raise AuthServiceError("Account has been blocked", 403)

    # Staff accounts must log in via the admin portal — never the trader
    # frontend. Done AFTER the password check so we don't reveal which
    # emails belong to admins (no enumeration via differing error
    # responses); done BEFORE 2FA + token issuance so staff credentials
    # never mint a trader session, even if the staff user accidentally
    # submitted them to the wrong form.
    STAFF_ROLES = ("admin", "super_admin", "employee", "manager", "support", "broker")
    if user.role in STAFF_ROLES:
        raise AuthServiceError(
            "Staff accounts must sign in via the admin portal.", 403
        )

    # White-label tenant isolation (stock4x port): a login arriving on a
    # broker's custom domain only admits that broker's own users. Fails
    # OPEN on platform / unrecognised hosts so nobody gets locked out by
    # a half-configured domain. Done after the password check so tenant
    # domains don't become an email-enumeration oracle.
    settings_wl = get_settings()
    if settings_wl.BRANDING_ENABLED:
        from packages.common.src import broker_tenancy
        wl_host = broker_tenancy.host_from_request_headers(
            request.headers.get("origin"), request.headers.get("referer")
        )
        wl_owner = await broker_tenancy.find_broker_by_domain(db, wl_host)
        if not broker_tenancy.user_belongs_to_owner(user, wl_owner):
            raise AuthServiceError(
                "This account is not registered with this broker. "
                "Please sign in on the platform you registered with.",
                403,
            )

    # Email-verification gate. A user who never verified the email they
    # signed up with cannot hold a trader session — this keeps login in
    # step with the admin list (which hides unverified accounts) and with
    # the register flow (which lets the same email be reclaimed). To get
    # back to the OTP screen they simply re-run signup with the same email;
    # register_user reclaims the unverified stub and issues a fresh code.
    # Demo accounts are exempt (they verify nothing and use a separate flow).
    if not getattr(user, "email_verified", False) and not getattr(user, "is_demo", False):
        raise AuthServiceError(
            "Please verify your email before logging in. Re-register with the "
            "same email to receive a fresh verification code.",
            403,
        )

    # Maintenance mode: only admin / super_admin / employee roles may log in.
    if user.role not in ("admin", "super_admin", "employee"):
        from packages.common.src.settings_store import get_bool_setting
        if await get_bool_setting("maintenance_mode", False):
            raise AuthServiceError(
                "Platform is under maintenance. Please try again later.", 503
            )

    await _enforce_2fa(user, totp_code, db)

    return await issue_auth_json_response(user, request, db, user_audit_action="LOGIN")


# ─── Demo login ───────────────────────────────────────────────────────────

async def _ensure_shared_demo_user(db: AsyncSession) -> User:
    from packages.common.src.settings_store import get_int_setting

    result = await db.execute(select(User).where(User.email == DEMO_SHARED_EMAIL))
    existing = result.scalar_one_or_none()
    if existing:
        if not existing.is_demo:
            raise AuthServiceError("This email is reserved for the platform demo account", 403)
        return existing

    # default_leverage retained for any future demo-side leverage tweak.
    await get_int_setting("default_leverage", 100)
    demo_password = secrets.token_urlsafe(32)
    user = User(
        email=DEMO_SHARED_EMAIL,
        password_hash=hash_password(demo_password),
        first_name="Demo", last_name="Trader",
        role="user", status="active", kyc_status="pending",
        is_demo=True, two_factor_enabled=False, two_factor_secret=None,
    )
    db.add(user)
    await db.flush()

    # Demo users get a demo account only — no Standard/real account is
    # provisioned. Previously we created both, which surfaced a $0 real
    # account in the picker for everyone who clicked "Try with demo".
    demo_group = await db.execute(select(AccountGroup).where(AccountGroup.name == "Demo").limit(1))
    dg = demo_group.scalars().first()
    db.add(TradingAccount(
        user_id=user.id, account_group_id=dg.id if dg else None,
        account_number=generate_account_number(),
        balance=DEMO_STARTING_BALANCE, equity=DEMO_STARTING_BALANCE, free_margin=DEMO_STARTING_BALANCE,
        leverage=100, currency="USD", is_demo=True,
    ))
    await db.flush()
    return user


async def _ensure_demo_trading_account(db: AsyncSession, user: User) -> None:
    # NOTE: admin can provision multiple demo accounts for a user, so this
    # existence check MUST tolerate multiple rows — use .first(), not
    # scalar_one_or_none() which raises MultipleResultsFound on 2+ matches.
    q = await db.execute(
        select(TradingAccount.id)
        .where(TradingAccount.user_id == user.id, TradingAccount.is_demo == True)
        .limit(1)
    )
    if q.scalars().first() is not None:
        return
    demo_group = await db.execute(select(AccountGroup).where(AccountGroup.name == "Demo").limit(1))
    dg = demo_group.scalars().first()
    db.add(TradingAccount(
        user_id=user.id, account_group_id=dg.id if dg else None,
        account_number=generate_account_number(),
        balance=DEMO_STARTING_BALANCE, equity=DEMO_STARTING_BALANCE, free_margin=DEMO_STARTING_BALANCE,
        leverage=100, currency="USD", is_demo=True,
    ))
    await db.flush()


async def demo_login(request: Request, db: AsyncSession) -> JSONResponse:
    rate_limit_http(request, "demo-login", 30, 60.0)
    user = await _ensure_shared_demo_user(db)
    await _ensure_demo_trading_account(db, user)
    if user.status == "banned":
        raise AuthServiceError("Account has been banned", 403)
    if user.status == "blocked":
        raise AuthServiceError("Account has been blocked", 403)
    return await issue_auth_json_response(user, request, db, user_audit_action="LOGIN")


# ─── Google OAuth ─────────────────────────────────────────────────────────

async def google_oauth(
    id_token_str: str,
    referral_code: str | None,
    request: Request,
    db: AsyncSession,
    totp_code: str | None = None,
) -> JSONResponse:
    """Verify a Google id_token and sign the user in. Creates a new user, links to an
    existing email-based account, or returns the existing google-linked user."""
    await assert_same_origin_or_tenant(request, db)
    rate_limit_http(request, "google-oauth", 30, 60.0)

    st = get_settings()
    if not st.GOOGLE_CLIENT_ID:
        raise AuthServiceError("Google sign-in is not configured", 503)

    # Imported lazily so the rest of auth_service does not require google-auth
    # to be installed in environments that don't enable Google sign-in.
    try:
        from google.oauth2 import id_token as google_id_token  # type: ignore
        from google.auth.transport import requests as google_requests  # type: ignore
    except ImportError:
        raise AuthServiceError("Google sign-in dependency missing on server", 503)

    try:
        claims = google_id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            audience=st.GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        # Defensive: log without echoing the raw token payload back to the client.
        logger.warning("google id_token verification failed: %s", e)
        raise AuthServiceError("Invalid Google token", 401)

    # Issuer must be Google. verify_oauth2_token already checks this in current
    # versions of google-auth, but we re-validate explicitly so the contract is
    # part of *our* code and survives library upgrades.
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise AuthServiceError("Invalid token issuer", 401)

    # Authorized party (azp) — when set, must match our client id. Belt-and-braces
    # against a token minted for a different (sibling) client in the same project.
    azp = claims.get("azp")
    if azp and azp != st.GOOGLE_CLIENT_ID:
        raise AuthServiceError("Invalid authorized party", 401)

    if not claims.get("email_verified"):
        raise AuthServiceError("Google account email is not verified", 401)

    google_id = str(claims.get("sub") or "").strip()
    email = str(claims.get("email") or "").strip().lower()
    if not google_id or not email:
        raise AuthServiceError("Google token missing required claims", 401)

    first_name = (claims.get("given_name") or "").strip()
    last_name = (claims.get("family_name") or "").strip()

    is_new = False
    # Lookup-by-google_id first. with_for_update() takes a row lock so a racing
    # second request for the same google account can't double-insert.
    user = (
        await db.execute(
            select(User).where(User.google_id == google_id).with_for_update()
        )
    ).scalar_one_or_none()

    if user is None:
        # No google-linked row — try to link to an existing password account by email.
        # Lock the row so concurrent google logins for the same email serialize.
        user = (
            await db.execute(
                select(User).where(func.lower(User.email) == email).with_for_update()
            )
        ).scalar_one_or_none()
        if user is not None:
            # Reject linking if this email is already bound to a *different* google account.
            if user.google_id and user.google_id != google_id:
                raise AuthServiceError(
                    "Email is already linked to another Google account", 409
                )
            if not user.google_id:
                user.google_id = google_id
            # Linking proves the user controls this Google-verified
            # mailbox (we checked email_verified above), so promote
            # email_verified so the OnboardingGate stops asking them
            # for an OTP they already passed at Google.
            if not user.email_verified:
                user.email_verified = True
                user.email_verified_at = datetime.utcnow()
        else:
            user = User(
                email=email,
                password_hash=None,  # OAuth-only — no password
                google_id=google_id,
                first_name=first_name,
                last_name=last_name,
                role="user",
                status="active",
                kyc_status="pending",
                is_demo=False,
                language="en",
                theme="dark",
                # Google verifies the user's mailbox upstream and we
                # validated the email_verified claim above. Skip our
                # own OTP — it would just re-prove what Google already
                # proved, and was the cause of "verification email
                # going to Google signups" UX bug.
                email_verified=True,
                email_verified_at=datetime.utcnow(),
            )
            db.add(user)
            await db.flush()
            is_new = True
            if referral_code:
                await _consume_referral(db, user.id, referral_code)
            await apply_tenant_attribution(db, user, referral_code, request)

    if user.status == "banned":
        raise AuthServiceError("Account has been banned", 403)
    if user.status == "blocked":
        raise AuthServiceError("Account has been blocked", 403)

    # M: enforce 2FA on Google sign-in too (was password-login only).
    await _enforce_2fa(user, totp_code, db)

    # Same staff-only block as login_user(): if a staff user happens to
    # have the trader Google flow hit their existing email, refuse to
    # mint a trader session for them. New OAuth signups always default
    # to role="user" above, so this only fires for pre-existing staff.
    if user.role in ("admin", "super_admin", "employee", "manager", "support"):
        raise AuthServiceError(
            "Staff accounts must sign in via the admin portal.", 403
        )

    # Single commit point — issue_auth_json_response below adds session + refresh
    # rows and commits once. Any failure above raises before commit, so the
    # outer route handler's rollback restores a clean state.
    response = await issue_auth_json_response(
        user, request, db,
        status_code=201 if is_new else 200,
        user_audit_action="OAUTH_GOOGLE_REGISTER" if is_new else "OAUTH_GOOGLE_LOGIN",
        audit_metadata={"google_sub": google_id, "google_email": email},
    )
    # Welcome email only for first-time Google signups — returning users
    # logging in via Google have already received it. Google's email is
    # already verified upstream so we send the welcome at OAuth time
    # rather than waiting for profile completion; flip the flag so the
    # profile path doesn't double-send.
    if is_new:
        await apply_email_brand(db, user)
        _send_welcome_email(user, via_google=True)
        user.welcome_email_sent = True
        await db.commit()
    return response


# ─── Token refresh ────────────────────────────────────────────────────────

async def refresh_token(request: Request, db: AsyncSession) -> JSONResponse:
    rate_limit_http(request, "auth-refresh", 60, 60.0)
    st = get_settings()
    raw = request.cookies.get(st.REFRESH_TOKEN_COOKIE_NAME)
    if not raw or not raw.strip():
        # Cookie-less clients (mobile) send the refresh token in the JSON body.
        try:
            payload = await request.json()
            raw = str(payload.get("refresh_token") or "")
        except Exception:
            raw = ""
    if not raw or not raw.strip():
        raise AuthServiceError("Not authenticated", 401)
    th = hash_token(raw.strip())
    now = datetime.now(timezone.utc)
    q = await db.execute(
        select(UserRefreshToken).where(
            UserRefreshToken.token_hash == th,
            UserRefreshToken.revoked.is_(False),
            UserRefreshToken.expires_at > now,
        )
    )
    row = q.scalar_one_or_none()
    if not row:
        raise AuthServiceError("Invalid or expired session", 401)
    user = await db.get(User, row.user_id)
    if not user or user.status in ("banned", "blocked"):
        raise AuthServiceError("Not authenticated", 401)
    # H-AUTH-4: a session must not be renewable while the email is unverified —
    # otherwise a pre-verification session (or one issued by an older build)
    # could be refreshed indefinitely. Demo and wallet-placeholder accounts have
    # no e-mail to verify and are exempt.
    _is_wallet_placeholder = (user.email or "").lower().endswith("@wallet.swisscresta.local")
    if not getattr(user, "email_verified", False) and not getattr(user, "is_demo", False) and not _is_wallet_placeholder:
        row.revoked = True
        await db.flush()
        raise AuthServiceError("Please verify your email to continue.", 403)
    # If a staff role somehow still holds a trader refresh token (e.g.
    # issued before the login-side block was added), refuse to renew it.
    # The session will die on next refresh instead of cycling forever.
    if user.role in ("admin", "super_admin", "employee", "manager", "support"):
        row.revoked = True
        await db.flush()
        raise AuthServiceError("Not authenticated", 401)
    row.revoked = True
    await db.flush()
    return await issue_auth_json_response(user, request, db)


# ─── Bootstrap session ────────────────────────────────────────────────────

async def bootstrap_session(access_token: str, request: Request, db: AsyncSession) -> JSONResponse:
    """Turn an ADMIN-IMPERSONATION token into a browser session.

    Previously this accepted ANY valid access token and minted a fresh session +
    7-day refresh token — without even checking whether that token's session had
    been revoked. So a stolen ~45-minute access token became a 7-day foothold,
    and a logged-out token could be resurrected, defeating logout.

    Now it only accepts the purpose-built impersonation token (carries
    `impersonated_by`, no `sid`). Ordinary session tokens (which carry a `sid`)
    are rejected — they already HAVE a session. The resulting session is marked
    amr="impersonation" (sensitive money/security actions are refused for it)
    and gets NO refresh token, so it ends with the access token instead of
    outliving the admin's short impersonation window."""
    rate_limit_http(request, "bootstrap-session", 30, 3600.0)
    try:
        payload = decode_token(access_token.strip())
    except Exception:
        raise AuthServiceError("Invalid token", 401)
    if payload.get("sid") or not payload.get("impersonated_by"):
        raise AuthServiceError("Invalid token", 401)
    try:
        uid = UUID(str(payload["sub"]))
    except (KeyError, ValueError, TypeError):
        raise AuthServiceError("Invalid token", 401)
    user = await db.get(User, uid)
    if not user:
        raise AuthServiceError("Invalid token", 401)
    if user.status == "banned":
        raise AuthServiceError("Account has been banned", 403)
    if user.status == "blocked":
        raise AuthServiceError("Account has been blocked", 403)
    return await issue_auth_json_response(
        user, request, db, amr_override="impersonation", issue_refresh=False,
    )


# ─── Forgot / Reset password ─────────────────────────────────────────────

def _reset_link_base(request: Request) -> str:
    """Base URL for the password-reset link in the email.

    Prefer the Origin the user is actually on (forwarded by the Next proxy
    and already validated by assert_same_origin in the caller) so the link
    is ALWAYS reachable — even if TRADER_APP_URL is unset and still sitting
    on its `http://localhost:3000` default, which would otherwise ship a
    dead localhost link to real users. Only trust the Origin when it's on
    our allow-list (host-header-injection guard); otherwise fall back to the
    configured TRADER_APP_URL, then a safe production host."""
    origin = (request.headers.get("origin") or "").strip().rstrip("/")
    allowed = _allowed_origins()
    if origin.startswith("http") and (not allowed or origin in allowed):
        return origin
    cfg = (get_settings().TRADER_APP_URL or "").strip().rstrip("/")
    return cfg or "https://trade.swisscresta.com"


async def forgot_password(email: str, request: Request, db: AsyncSession) -> dict:
    await assert_same_origin_or_tenant(request, db)
    rate_limit_http(request, "forgot-password", 5, 600.0)
    msg = {"message": "If an account exists for this email, you will receive password reset instructions shortly."}
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or user.status in ("banned", "blocked"):
        return msg

    # 6-digit numeric code — the user types it into the app's reset-password
    # screen. reset_password() verifies hash_token(code), so the same backend
    # path handles it; no magic link needed.
    # SECURITY: invalidate any prior unused reset codes for this user, so only
    # ONE code is ever valid at a time. Previously every forgot-password request
    # added another live code, and none were bound/capped — requesting resets
    # repeatedly widened the brute-force surface across accounts.
    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used.is_(False))
        .values(used=True)
    )
    raw = f"{secrets.randbelow(10**6):06d}"
    token_hash = hash_token(raw)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.add(PasswordResetToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at, used=False))
    await db.commit()

    settings = get_settings()

    from packages.common.src.smtp_mail import send_password_reset_email, smtp_configured
    if smtp_configured():
        await apply_email_brand(db, user)
        sent = await send_password_reset_email(user.email, raw)
        if sent:
            logger.info("Password reset code sent to %s", user.email)
        else:
            logger.error("Password reset email failed for %s", user.email)
    elif settings.ENVIRONMENT == "development":
        logger.warning("Password reset code (dev, SMTP not configured): %s", raw)
    else:
        logger.warning("SMTP not configured — no email sent for %s", user.email)

    return msg


async def reset_password(
    token: str, new_password: str, request: Request, db: AsyncSession,
    email: str | None = None,
) -> dict:
    await assert_same_origin_or_tenant(request, db)
    rate_limit_http(request, "reset-password", 20, 600.0)
    token_hash = hash_token(token.strip())
    now = datetime.now(timezone.utc)

    # C-AUTH-1: bind the code to a user and cap attempts in Redis, independent
    # of IP. With the e-mail, the token lookup is scoped to that user, so a
    # 6-digit code can only be brute-forced against ONE account, and only
    # 10 attempts / 15 min are allowed.
    user = None
    if email:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is not None:
            try:
                key = f"pwreset_attempts_user:{user.id}"
                n = await redis_client.incr(key)
                if n == 1:
                    await redis_client.expire(key, 900)
                if n > 10:
                    raise AuthServiceError("Too many reset attempts. Please try again later.")
            except AuthServiceError:
                raise
            except Exception:
                pass  # Redis unavailable → fall back to DB + HTTP rate limits.

    q = select(PasswordResetToken).where(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used.is_(False),
        PasswordResetToken.expires_at > now,
    )
    if user is not None:
        q = q.where(PasswordResetToken.user_id == user.id)
    row = (await db.execute(q)).scalar_one_or_none()
    if not row:
        raise AuthServiceError("Invalid or expired reset code")

    # Per-token attempt cap (5).
    try:
        tkey = f"pwreset_attempts_token:{row.id}"
        tn = await redis_client.incr(tkey)
        if tn == 1:
            await redis_client.expire(tkey, 900)
        if tn > 5:
            row.used = True
            await db.commit()
            raise AuthServiceError("Too many attempts on this code. Request a new one.")
    except AuthServiceError:
        raise
    except Exception:
        pass

    resolved = user or await db.get(User, row.user_id)
    if not resolved:
        raise AuthServiceError("Invalid or expired reset code")

    resolved.password_hash = hash_password(new_password)
    row.used = True

    # C-AUTH-1: a successful reset revokes every existing session, refresh
    # token AND algo API key for the user, so a prior attacker's foothold dies.
    revoked_sids = await revoke_user_credentials(db, resolved.id)
    await db.commit()
    for _sid in revoked_sids:
        await invalidate_session_cache(_sid)
    return {"message": "Password has been reset. You can sign in now."}


async def revoke_user_credentials(db: AsyncSession, user_id: UUID, *, keep_sid=None) -> list:
    """Kill every credential an attacker could be holding for this user:
    all refresh tokens, all sessions except `keep_sid` (the caller's own), and
    all algo API keys (long-lived bot keys that otherwise survive a password
    change — a persistence vector). Returns the revoked session ids so the
    caller can bust the session cache AFTER committing. Caller commits."""
    from packages.common.src.models import AlgoApiKey

    await db.execute(
        update(UserRefreshToken)
        .where(UserRefreshToken.user_id == user_id, UserRefreshToken.revoked.is_(False))
        .values(revoked=True)
    )
    q = select(UserSession.id).where(
        UserSession.user_id == user_id, UserSession.is_active.is_(True),
    )
    if keep_sid:
        try:
            q = q.where(UserSession.id != UUID(str(keep_sid)))
        except (ValueError, TypeError):
            pass
    sids = list((await db.execute(q)).scalars().all())
    if sids:
        await db.execute(
            update(UserSession).where(UserSession.id.in_(sids)).values(is_active=False)
        )
    await db.execute(
        update(AlgoApiKey)
        .where(AlgoApiKey.user_id == user_id, AlgoApiKey.is_active.is_(True))
        .values(is_active=False)
    )
    return sids


# ─── 2FA ──────────────────────────────────────────────────────────────────

async def setup_2fa(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise AuthServiceError("Not authenticated", 401)
    # Never overwrite a LIVE 2FA secret. Previously this replaced the secret even
    # when 2FA was already enabled, with no re-auth — so anyone holding a session
    # (stolen token, impersonation) could call setup → verify with THEIR
    # authenticator and take over the account's 2FA, while the real owner's app
    # silently stopped working. Re-enrolment must go through a verified disable.
    if user.two_factor_enabled:
        raise AuthServiceError("Two-factor authentication is already enabled", 409)
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=user.email, issuer_name="SwissCresta")
    user.two_factor_secret = secret
    await db.commit()
    # `otp_uri` is what the trader profile UI reads; `qr_uri` kept for older clients.
    return {"secret": secret, "qr_uri": provisioning_uri, "otp_uri": provisioning_uri}


async def verify_2fa(user_id: UUID, code: str, db: AsyncSession) -> dict:
    """Confirms the freshly-set TOTP secret with a real code, then mints
    eight one-time backup codes — bcrypt-hashed in the DB, returned in
    plaintext exactly once. The user's instructions tell them to print
    or save these somewhere offline; lose the phone, use a code, sign
    in. Without this path the only fallback is a support ticket which
    is the social-engineering attack surface (audit H2)."""
    from packages.common.src.models import TwoFactorBackupCode
    from sqlalchemy import delete as sql_delete

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user.two_factor_secret:
        raise AuthServiceError("2FA not set up")
    totp = pyotp.TOTP(user.two_factor_secret)
    if not totp.verify(code):
        raise AuthServiceError("Invalid code", 401)
    user.two_factor_enabled = True

    # Burn any old backup codes from a previous setup attempt before
    # issuing a fresh batch — otherwise stale codes from a previous
    # secret could still authenticate against this user.
    await db.execute(
        sql_delete(TwoFactorBackupCode).where(TwoFactorBackupCode.user_id == user_id)
    )
    plaintext_codes = []
    for _ in range(8):
        # 10 hex chars (40 bits of entropy) — formatted as XXXXX-XXXXX
        # for readability when transcribing.
        raw = secrets.token_hex(5).upper()
        formatted = f"{raw[:5]}-{raw[5:]}"
        plaintext_codes.append(formatted)
        db.add(TwoFactorBackupCode(
            user_id=user_id,
            code_hash=hash_password(formatted),
        ))
    await db.commit()
    return {
        "message": "2FA enabled successfully",
        "backup_codes": plaintext_codes,
        "backup_code_warning": (
            "Save these one-time recovery codes somewhere safe. Each "
            "code works exactly once if you lose access to your "
            "authenticator app. We will never show them again."
        ),
    }


async def consume_2fa_backup_code(user_id: UUID, code: str, db: AsyncSession) -> bool:
    """Try every active backup code; bcrypt-verify against `code`. On
    match, mark that code used (single-use) and return True. Constant-
    time-ish: we always loop the full set even on early hit so timing
    can't reveal how many codes the user has remaining."""
    from packages.common.src.models import TwoFactorBackupCode

    rows_q = await db.execute(
        select(TwoFactorBackupCode).where(
            TwoFactorBackupCode.user_id == user_id,
            TwoFactorBackupCode.used_at.is_(None),
        )
    )
    rows = rows_q.scalars().all()
    candidate = (code or "").strip().upper()
    if not candidate:
        return False
    matched: TwoFactorBackupCode | None = None
    for row in rows:
        if verify_password(candidate, row.code_hash):
            matched = row  # don't break — keep timing roughly constant
    if matched is None:
        return False
    matched.used_at = datetime.now(timezone.utc)
    await db.commit()
    return True


async def regenerate_2fa_backup_codes(user_id: UUID, code: str, db: AsyncSession) -> dict:
    """User-initiated rotation. Burns all existing codes and issues a
    fresh batch — used when the printed sheet is suspected lost.

    Requires a CURRENT authenticator code: backup codes bypass 2FA at login,
    so minting them must prove possession of the second factor — a session
    alone (stolen token / impersonation) must not be able to harvest them."""
    from packages.common.src.models import TwoFactorBackupCode
    from sqlalchemy import delete as sql_delete

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user or not user.two_factor_enabled:
        raise AuthServiceError("2FA is not enabled")
    if not user.two_factor_secret or not pyotp.TOTP(user.two_factor_secret).verify((code or "").strip()):
        raise AuthServiceError("Invalid authenticator code", 401)

    await db.execute(
        sql_delete(TwoFactorBackupCode).where(TwoFactorBackupCode.user_id == user_id)
    )
    plaintext_codes = []
    for _ in range(8):
        raw = secrets.token_hex(5).upper()
        formatted = f"{raw[:5]}-{raw[5:]}"
        plaintext_codes.append(formatted)
        db.add(TwoFactorBackupCode(
            user_id=user_id, code_hash=hash_password(formatted),
        ))
    await db.commit()
    return {"backup_codes": plaintext_codes}


# ─── Password change ─────────────────────────────────────────────────────

async def change_password(
    user_id: UUID, old_password: str, new_password: str, db: AsyncSession, keep_sid=None,
) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not verify_password(old_password, user.password_hash):
        raise AuthServiceError("Current password is incorrect")
    user.password_hash = hash_password(new_password)
    # Changing the password is what a user does when they suspect compromise —
    # so sign out every OTHER device and revoke refresh tokens + algo keys.
    # (Previously only the forgot-password reset did this; a normal change left
    # an attacker's session fully alive.) The caller's own session is kept.
    revoked_sids = await revoke_user_credentials(db, user.id, keep_sid=keep_sid)
    await db.commit()
    for _sid in revoked_sids:
        await invalidate_session_cache(_sid)
    return {"message": "Password changed successfully. Other devices have been signed out."}


# ─── Get current user profile ─────────────────────────────────────────────

async def get_me(user_id: UUID, db: AsyncSession) -> dict:
    """Return the user row plus the computed `profile_complete` flag.

    A profile is "complete" when all the fields the trader UI needs before
    deposits / trading become available are populated. Demo accounts and
    staff (admin/employee) auto-pass — they don't need to fill the gate."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise AuthServiceError("User not found", 404)

    if user.is_demo or user.role in ("admin", "super_admin", "employee", "manager", "support"):
        complete = True
    else:
        complete = bool(
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

    # Onboarding gate inputs. The trader app's OnboardingGate reads these
    # to decide which steps to render (profile / connect wallet / verify
    # email). Demo and staff accounts skip the gate entirely — their
    # onboarding_complete is always True. For everyone else, ALL THREE of
    # profile_complete, wallet_linked, and email_verified must be true.
    #
    # Grandfather rule: users created before the email + wallet
    # mandate landed (commit d862363, 2026-05-08) were trading on the
    # platform under the old rules. Retroactively forcing them into
    # OTP + wallet linking traps them in a non-dismissible modal on
    # next login. They're treated as onboarded; per-action checks
    # (e.g. wallet required for withdrawal) still apply when they
    # actually try to move money.
    ONBOARDING_RULE_CUTOFF = datetime(2026, 5, 8, tzinfo=timezone.utc)
    is_wallet_placeholder = bool(
        (user.email or "").lower().endswith("@wallet.swisscresta.local")
    )
    wallet_linked = bool((user.wallet_address or "").strip())
    email_verified = bool(getattr(user, "email_verified", False))
    is_pre_policy = (
        user.created_at is not None and user.created_at < ONBOARDING_RULE_CUTOFF
    )
    # Wallet linking gate — temporarily False while the wallet feature
    # is still being completed (frontend mirror: WALLET_LINK_REQUIRED in
    # OnboardingGate.tsx, and the same flag in
    # packages/common/src/auth.require_onboarded — keep all three in sync).
    # Per-action wallet checks (e.g. wallet required for withdrawal)
    # still apply independently of this flag.
    WALLET_LINK_REQUIRED = False
    wallet_ok = wallet_linked if WALLET_LINK_REQUIRED else True
    placeholder_block = is_wallet_placeholder if WALLET_LINK_REQUIRED else False
    if (
        user.role in ("admin", "super_admin", "employee")
        or bool(user.is_demo)
        or is_pre_policy
    ):
        onboarding_complete = True
    else:
        onboarding_complete = bool(
            complete and wallet_ok and email_verified and not placeholder_block
        )

    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "country": user.country,
        "address": user.address,
        "city": user.city,
        "state": user.state,
        "postal_code": user.postal_code,
        "date_of_birth": user.date_of_birth,
        "role": user.role,
        "status": user.status,
        "kyc_status": user.kyc_status,
        "is_demo": bool(user.is_demo),
        "main_wallet_balance": float(user.main_wallet_balance or 0),
        "two_factor_enabled": bool(user.two_factor_enabled),
        "language": user.language or "en",
        "theme": user.theme or "dark",
        "profile_complete": complete,
        "wallet_address": user.wallet_address,
        "wallet_linked": wallet_linked,
        "email_verified": email_verified,
        "is_wallet_placeholder": is_wallet_placeholder,
        "onboarding_complete": onboarding_complete,
        "has_password": bool(user.password_hash),
        "has_google": bool(user.google_id),
        "created_at": user.created_at,
    }


# ─── Logout ───────────────────────────────────────────────────────────────

async def logout_user(user_id: UUID, request: Request, db: AsyncSession) -> JSONResponse:
    ua = (request.headers.get("user-agent") or "").strip()
    db.add(UserAuditLog(
        user_id=user_id, action_type="LOGOUT",
        ip_address=client_ip_for_inet(request),
        device_info=ua[:2048] if ua else None,
    ))
    await db.execute(
        update(UserRefreshToken).where(
            UserRefreshToken.user_id == user_id,
            UserRefreshToken.revoked.is_(False),
        ).values(revoked=True)
    )
    result = await db.execute(
        select(UserSession).where(UserSession.user_id == user_id, UserSession.is_active == True)
    )
    for s in result.scalars().all():
        s.is_active = False
        await invalidate_session_cache(s.id)  # H-AUTH-3: make revocation instant
    await db.commit()

    resp = JSONResponse(content={"message": "Logged out"})
    clear_auth_cookies(resp, request)
    return resp
