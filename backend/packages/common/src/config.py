from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql+asyncpg://fxartha:fxartha_dev@localhost:5432/fxartha"
    TIMESCALE_URL: str = "postgresql+asyncpg://fxartha:fxartha_dev@localhost:5433/marketdata"
    REDIS_URL: str = "redis://localhost:6379/0"
    # KAFKA_BOOTSTRAP_SERVERS retained as a settings field for now so any
    # downstream IaC / .env that still defines it doesn't fail validation
    # — but Kafka itself has been removed from the stack. The kafka_client
    # module is a no-op shim.
    KAFKA_BOOTSTRAP_SERVERS: str = ""

    # JWT secrets are loaded from env. They have NO baked-in default because
    # a forgotten env file in production would silently authenticate forged
    # tokens against a known string. Empty values are tolerated only when
    # ENVIRONMENT in {"development","test"}; everywhere else the process
    # refuses to boot (see `_assert_production_secrets`).
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    # Short-lived access JWT (browser cookie + optional JSON for legacy clients).
    JWT_ACCESS_EXPIRY_MINUTES: int = Field(
        default=45,
        validation_alias=AliasChoices("JWT_ACCESS_EXPIRY_MINUTES", "JWT_EXPIRY_MINUTES"),
    )
    # Refresh token row expiry in DB (rotation); still enforced when validating refresh.
    JWT_REFRESH_EXPIRY_DAYS: int = 7
    # If True, both access + refresh HttpOnly cookies omit Max-Age (browser session cookies).
    # Closing the browser session clears them — user must log in again. If False, cookies use
    # Max-Age (access ~JWT_ACCESS_EXPIRY_MINUTES, refresh JWT_REFRESH_EXPIRY_DAYS) so login
    # survives browser restarts.
    JWT_REFRESH_SESSION_COOKIE: bool = True
    # Still return access_token in login/register JSON (phase out when all clients use cookies only).
    JWT_INCLUDE_LEGACY_JSON_TOKEN: bool = True

    # HttpOnly auth cookies (trader web). Secure derived from request HTTPS unless overridden.
    ACCESS_TOKEN_COOKIE_NAME: str = "pt_access"
    REFRESH_TOKEN_COOKIE_NAME: str = "pt_refresh"
    COOKIE_SAMESITE: str = "strict"  # lax | strict | none
    # If None, Secure flag follows the incoming request (HTTPS / X-Forwarded-Proto).
    COOKIE_SECURE: bool | None = None
    # Cookie Domain attribute. Set to a parent domain (e.g. ".fxartha.com") to share
    # the auth session across the apex and subdomains (trade.*, etc.). Leave empty to
    # let the browser set a host-only cookie (works for single-host dev/local setups).
    COOKIE_DOMAIN: str = ""

    # Google OAuth (Sign in / Sign up with Google). Verifies id_token audience offline
    # against Google's JWKS — no client secret stored on our infra. When empty, the
    # /auth/google endpoint returns 503 and the frontend hides the button.
    GOOGLE_CLIENT_ID: str = ""

    ADMIN_JWT_SECRET: str = ""
    ADMIN_JWT_ALGORITHM: str = "HS256"
    ADMIN_JWT_EXPIRY_HOURS: int = 8

    ADMIN_EMAIL: str = "admin@fxartha.com"
    # Initial seed password for the super-admin row created by the
    # `migrate` profile. Empty by default so prod operators are forced
    # to set a strong value in their .env before the first migration —
    # see `_assert_production_secrets` below.
    ADMIN_PASSWORD: str = ""
    USER_JWT_SECRET: str = ""
    USER_JWT_ALGORITHM: str = "HS256"

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    CORS_ALLOW_METHODS: str = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    CORS_ALLOW_HEADERS: str = "Authorization,Content-Type,X-Requested-With,Accept,X-Api-Key,X-Api-Secret"

    # Public trader app URL (password reset links). No trailing slash.
    TRADER_APP_URL: str = "http://localhost:3000"

    # Optional SMTP — required for password-reset emails in non-dev. If SMTP_HOST is empty, reset links are only logged in development.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    # Market data provider (Infoway.io) — fallback when Corecen LP not configured
    INFOWAY_API_KEY: str = ""
    INFOWAY_API_URL: str = "https://api.infoway.io"

    # Corecen LP (primary market data source). When CORECEN_LP_ENABLED=true the
    # market-data service stops running its own Infoway / simulator feed and
    # consumes ticks pushed from Corecen via POST /api/lp/prices/batch (HMAC).
    CORECEN_LP_ENABLED: bool = False
    # HMAC credentials — must match FXARTHA_API_KEY / FXARTHA_API_SECRET in the Corecen .env.
    CORECEN_LP_API_KEY: str = ""
    CORECEN_LP_API_SECRET: str = ""
    # Reject pushes older than this many ms (same tolerance as Corecen's HMAC middleware).
    CORECEN_LP_TIMESTAMP_TOLERANCE_MS: int = 60_000

    # Corecen Broker API (A-Book trade forwarding). When an A-Book user opens/closes
    # a position, FXArtha pushes the trade to Corecen's broker API for LP routing.
    # These credentials are the API key/secret registered in Corecen's admin panel
    # for the FXArtha broker account.
    CORECEN_BROKER_API_URL: str = ""       # e.g. https://api.corecen.com
    CORECEN_BROKER_API_KEY: str = ""       # ck_... from Corecen broker API keys
    CORECEN_BROKER_API_SECRET: str = ""    # cs_... from Corecen broker API keys

    MARGIN_CALL_LEVEL: float = 80.0
    STOP_OUT_LEVEL: float = 50.0
    MAX_OPEN_TRADES: int = 200
    DEFAULT_LEVERAGE: int = 100

    # Sentry error tracking (leave empty to disable)
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1

    # Rate limiting DISABLED — add_middleware_stack skips the SlowAPI limiter
    # by default and rate_limit_http() in auth_service is now a no-op. These
    # values are kept only so env parsing doesn't break if they're set.
    RATE_LIMIT_DEFAULT: str = "1000000/minute"
    RATE_LIMIT_AUTH: str = "1000000/minute"
    RATE_LIMIT_TRADING: str = "1000000/minute"

    # Request body size limit (bytes) — 10 MB default
    MAX_REQUEST_SIZE: int = 10 * 1024 * 1024

    # OxaPay crypto payment gateway (legacy — kept mounted for in-flight + historical deposits)
    OXAPAY_MERCHANT_KEY: str = ""
    OXAPAY_SANDBOX: bool = False
    OXAPAY_CALLBACK_BASE_URL: str = ""  # public gateway URL for webhooks, e.g. "https://api.yourdomain.com"

    # NOWPayments crypto payment gateway (current default for new deposits).
    NOWPAYMENTS_API_KEY: str = ""
    NOWPAYMENTS_IPN_SECRET: str = ""    # IPN HMAC secret from dashboard
    NOWPAYMENTS_SANDBOX: bool = False
    NOWPAYMENTS_CALLBACK_BASE_URL: str = ""  # e.g. "https://api.fxartha.com"

    # Decentralized USDT deposit flow — per-chain explorer + RPC config.
    # All optional: with no keys the chain_verifier_engine falls back to
    # public free endpoints (rate-limited but functional for low traffic).
    ETHERSCAN_API_KEY: str = ""        # https://etherscan.io/myapikey
    BSCSCAN_API_KEY: str = ""          # https://bscscan.com/myapikey (same key works for mainnet + testnet)
    TRONGRID_API_KEY: str = ""         # https://www.trongrid.io
    ALCHEMY_API_URL: str = ""          # full URL incl key, e.g. https://eth-mainnet.g.alchemy.com/v2/<KEY>
    BSC_RPC_URL: str = ""              # public default fallback used if blank
    # BSC testnet RPC for the FXArthaVaultV1 testnet deploy. Falls back
    # to the public binance.org seed if blank. Used by the bscscan vault
    # event verifier to fetch eth_blockNumber for confirmations.
    BSC_TESTNET_RPC_URL: str = ""
    TRON_API_URL: str = "https://api.trongrid.io"

    # Absolute path recommended in production (writable volume). Relative paths are resolved from gateway CWD.
    KYC_UPLOAD_ROOT: str = "uploads/kyc"
    # Deposit proof screenshots + user payout QR for manual withdrawals (gateway). Mount same path in admin for review.
    WALLET_UPLOAD_ROOT: str = "uploads/wallet"

    class Config:
        env_file = ".env"


# Historical default strings that used to ship in the codebase. Kept here
# as a deny-list so a stale .env carrying one of these is treated as
# "secret not set" rather than authenticating real tokens.
_LEGACY_DEFAULT_JWT_SECRETS = {
    "dev-secret-change-in-production",
    "admin-secret-change-in-production",
    "change-me",
}

_KNOWN_WEAK_ADMIN_PASSWORDS = {
    # Historical default that shipped with .env.example for a while.
    # Any deployment still using this in 2026+ is effectively unpassworded.
    "FXArthaAdmin2025!",
    "admin",
    "password",
    "changeme",
    "",
}

# Environments where missing/weak secrets are warned but tolerated.
# Anything else (production, staging, prod, live, …) fails closed.
_DEV_ENVIRONMENTS = {"development", "dev", "local", "test", "testing", "ci"}


def _assert_production_secrets(s: Settings) -> None:
    """Refuse to boot when JWT secrets are missing/weak outside of an
    explicit dev environment. A forged token against a known default
    string is the codebase's #1 security risk if the env file is ever
    forgotten — fail loud at boot, never silently authenticate."""
    env = (s.ENVIRONMENT or "").lower().strip()

    def _weak_jwt(val: str) -> bool:
        return (not val) or val in _LEGACY_DEFAULT_JWT_SECRETS or len(val) < 32

    weak_jwt = [
        n for n in ("JWT_SECRET", "ADMIN_JWT_SECRET", "USER_JWT_SECRET")
        if _weak_jwt(getattr(s, n, "") or "")
    ]
    weak_pwd = s.ADMIN_PASSWORD in _KNOWN_WEAK_ADMIN_PASSWORDS

    if env in _DEV_ENVIRONMENTS:
        # Dev hygiene: warn but don't refuse to boot — local devs need
        # the convenience of running with no env file at all.
        import logging
        log = logging.getLogger("fxartha.config")
        if weak_jwt:
            log.warning(
                "Using empty/weak/default JWT secrets for: %s. Acceptable for "
                "local development only; production deploys MUST set strong "
                "values via `openssl rand -hex 32`.",
                ", ".join(weak_jwt),
            )
        if weak_pwd:
            log.warning(
                "ADMIN_PASSWORD is empty or a known-weak default. Acceptable "
                "for local dev; production deploys MUST set a strong password "
                "(e.g. `openssl rand -base64 24`)."
            )
        return

    bad: list[str] = list(weak_jwt)
    if weak_pwd:
        bad.append("ADMIN_PASSWORD")
    if bad:
        raise RuntimeError(
            f"Refusing to start: ENVIRONMENT={s.ENVIRONMENT!r} but the following "
            "secrets are missing, empty, default, or known-weak: "
            + ", ".join(bad)
            + ". Generate strong JWT secrets with `openssl rand -hex 32` and "
            "a strong ADMIN_PASSWORD with `openssl rand -base64 24`, then "
            "set them in /opt/fxartha/.env before deploying. If this is a "
            "local dev box, set ENVIRONMENT=development."
        )


@lru_cache()
def get_settings() -> Settings:
    s = Settings()
    _assert_production_secrets(s)
    return s
