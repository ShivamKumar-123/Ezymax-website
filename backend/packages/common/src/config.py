from functools import lru_cache
from typing import Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql+asyncpg://swisscresta:swisscresta_dev@localhost:5432/swisscresta"
    TIMESCALE_URL: str = "postgresql+asyncpg://swisscresta:swisscresta_dev@localhost:5433/marketdata"
    REDIS_URL: str = "redis://localhost:6379/0"
    # KAFKA_BOOTSTRAP_SERVERS retained as a settings field for now so any
    # downstream IaC / .env that still defines it doesn't fail validation
    # — but Kafka itself has been removed from the stack. The kafka_client
    # module is a no-op shim.
    KAFKA_BOOTSTRAP_SERVERS: str = ""

    JWT_SECRET: str = "dev-secret-change-in-production"
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
    # H-AUTH-3: do NOT echo the access token in the login/register JSON body when
    # cookie auth is in use — it needlessly exposes the token to page JS (XSS
    # reach) while the web app already authenticates via the HttpOnly cookie.
    # Mobile/cookie-less clients still opt in per-request with the
    # `x-token-delivery: json` header, so this default does not affect them.
    JWT_INCLUDE_LEGACY_JSON_TOKEN: bool = False

    # HttpOnly auth cookies (trader web). Secure derived from request HTTPS unless overridden.
    ACCESS_TOKEN_COOKIE_NAME: str = "pt_access"
    REFRESH_TOKEN_COOKIE_NAME: str = "pt_refresh"
    COOKIE_SAMESITE: str = "strict"  # lax | strict | none
    # If None, Secure flag follows the incoming request (HTTPS / X-Forwarded-Proto).
    COOKIE_SECURE: bool | None = None
    # Cookie Domain attribute. Set to a parent domain (e.g. ".swisscresta.com") to share
    # the auth session across the apex and subdomains (trade.*, etc.). Leave empty to
    # let the browser set a host-only cookie (works for single-host dev/local setups).
    COOKIE_DOMAIN: str = ""

    # Google OAuth (Sign in / Sign up with Google). Verifies id_token audience offline
    # against Google's JWKS — no client secret stored on our infra. When empty, the
    # /auth/google endpoint returns 503 and the frontend hides the button.
    GOOGLE_CLIENT_ID: str = ""

    ADMIN_JWT_SECRET: str = "admin-secret-change-in-production"
    ADMIN_JWT_ALGORITHM: str = "HS256"
    ADMIN_JWT_EXPIRY_HOURS: int = 8

    ADMIN_EMAIL: str = "admin@swisscresta.com"
    # Initial seed password for the super-admin row created by the
    # `migrate` profile. Empty by default so prod operators are forced
    # to set a strong value in their .env before the first migration —
    # see `_assert_production_secrets` below.
    ADMIN_PASSWORD: str = ""
    USER_JWT_SECRET: str = "dev-secret-change-in-production"
    USER_JWT_ALGORITHM: str = "HS256"

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    # Origins allowed CREDENTIALED cross-origin REST calls to the gateway. Kept
    # separate from CORS_ORIGINS (which also drives the WebSocket origin
    # allow-list) so browser hosts that only need the live price socket — e.g.
    # the marketing apex — don't also get credentialed API access. Browsers in
    # prod reach REST via the same-origin /api/v1 proxy, so this can be narrow.
    # None = fall back to CORS_ORIGINS (backward compatible).
    API_CORS_ORIGINS: Optional[str] = None
    CORS_ALLOW_METHODS: str = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    CORS_ALLOW_HEADERS: str = "Authorization,Content-Type,X-Requested-With,Accept,X-Api-Key,X-Api-Secret"

    # Public trader app URL (password reset links). No trailing slash.
    TRADER_APP_URL: str = "http://localhost:3000"

    # ── White-label brokers (rental model, ported from stock4x) ──────────
    # Master switch — every branding/custom-domain endpoint 503s when off,
    # and login/signup tenant attribution becomes a no-op.
    BRANDING_ENABLED: bool = False
    # Hostnames that are the PLATFORM's own (comma-separated, no scheme).
    # A login/signup arriving from one of these hosts is never attributed
    # to a tenant, and tenant login-isolation fails OPEN for them.
    # Phase 3: api. and admin. are reserved so a broker can't claim them as a
    # custom domain (is_platform_domain also blocks any *.swisscresta.com).
    PLATFORM_HOSTS: str = "swisscresta.com,www.swisscresta.com,trade.swisscresta.com,api.swisscresta.com,admin.swisscresta.com,localhost,127.0.0.1"
    # The origin IP tenants must point their A record at (shown in the
    # domain-connect wizard and checked by DNS verification).
    PLATFORM_PUBLIC_IP: str = ""
    # SSL/nginx provisioning (server-side; leave empty on dev — the
    # provisioner then only records status transitions without shelling out).
    BRANDING_NGINX_TENANTS_FILE: str = ""   # e.g. /etc/nginx/conf.d/swisscresta-tenants.conf
    BRANDING_TRADER_UPSTREAM: str = "127.0.0.1:3000"
    # Upstream for the admin panel served on tenant admin domains
    # (admin.<broker-domain>). Prod: 127.0.0.1:3013 (see nginx upstreams).
    BRANDING_ADMIN_UPSTREAM: str = "127.0.0.1:3001"
    BRANDING_CERTBOT_BIN: str = "/usr/bin/certbot"
    BRANDING_NGINX_BIN: str = "/usr/sbin/nginx"
    BRANDING_CERTBOT_EMAIL: str = ""
    # true = admin-api shells out to nginx/certbot itself (only valid when
    # it runs directly on the host). false (default) = the containerised
    # service just marks status 'provisioning' and the HOST cron agent
    # (scripts/wl-domain-agent.sh) performs the nginx+certbot work.
    BRANDING_PROVISION_LOCAL: bool = False

    # Optional SMTP — required for password-reset emails in non-dev. If SMTP_HOST is empty, reset links are only logged in development.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    # Live crypto from Binance's PUBLIC @bookTicker stream (no key needed).
    # When true (default) the market-data service runs it as a dedicated
    # side feed AND removes the crypto symbols from the primary vendor
    # subscription, so each symbol has exactly ONE live source. bookTicker
    # pushes best bid/ask many times per second — real spread, real speed.
    BINANCE_CRYPTO_FEED_ENABLED: bool = True

    # Also subscribe Infoway's TRADE stream (protocol code 10000 → pushes
    # code 10002) alongside depth. Depth (~1/s) keeps supplying the real
    # spread; trades add several updates/sec on active instruments (gold
    # prints ~7 trades/s). A trade's last price is treated as the mid and
    # re-spread from config, so published quotes stay consistent.
    INFOWAY_TRADE_STREAM_ENABLED: bool = True

    # Market data provider (Infoway.io) — fallback when Corecen LP not configured
    INFOWAY_API_KEY: str = ""
    INFOWAY_API_URL: str = "https://api.infoway.io"

    # AI Strategy Builder — Claude API for natural-language → strategy DSL.
    # Unset key: /ai-strategies/generate returns 503; everything else (manual
    # DSL editing, backtesting, deploying) still works.
    ANTHROPIC_API_KEY: str = ""
    AI_STRATEGY_MODEL: str = "claude-opus-5"

    # When True, order fills and closes re-derive the user's bid/ask from the
    # broadcast MID using the user's resolved spread config (per-user / per-tier),
    # instead of trusting the single global broadcast spread — so the admin
    # spread is crossed exactly once per round trip at the USER's own rate.
    # Default OFF: this changes realized P&L for tiered accounts, so enable it
    # only after verifying on a demo account. (Floating-P&L display and the
    # SL/TP engine still use the global broadcast quote — identical for
    # non-tiered accounts; full per-account floating valuation is a follow-up.)
    USER_SPREAD_AT_EXECUTION: bool = False

    # Corecen LP (primary market data source). When CORECEN_LP_ENABLED=true the
    # market-data service stops running its own Infoway / simulator feed and
    # consumes ticks pushed from Corecen via POST /api/lp/prices/batch (HMAC).
    CORECEN_LP_ENABLED: bool = False
    # HMAC credentials — must match SWISSCRESTA_API_KEY / SWISSCRESTA_API_SECRET in the Corecen .env.
    CORECEN_LP_API_KEY: str = ""
    CORECEN_LP_API_SECRET: str = ""
    # Reject pushes older than this many ms (same tolerance as Corecen's HMAC middleware).
    CORECEN_LP_TIMESTAMP_TOLERANCE_MS: int = 60_000

    # Corecen Broker API (A-Book trade forwarding). When an A-Book user opens/closes
    # a position, SwissCresta pushes the trade to Corecen's broker API for LP routing.
    # These credentials are the API key/secret registered in Corecen's admin panel
    # for the SwissCresta broker account.
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

    # Razorpay payment gateway (current default for new automated deposits).
    # User enters a USD amount; we convert USD→INR at USD_TO_INR_RATE and
    # charge INR via Razorpay Checkout. On success we credit the USD amount
    # to the user's main wallet. No `razorpay` pip SDK — httpx + stdlib hmac.
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    # USD→INR conversion rate used to compute the INR charge amount. Configure
    # to a realistic live rate before going to production.
    USD_TO_INR_RATE: float = 83.0

    # Decentralized USDT deposit flow — per-chain explorer + RPC config.
    # All optional: with no keys the chain_verifier_engine falls back to
    # public free endpoints (rate-limited but functional for low traffic).
    ETHERSCAN_API_KEY: str = ""        # https://etherscan.io/myapikey
    BSCSCAN_API_KEY: str = ""          # https://bscscan.com/myapikey (same key works for mainnet + testnet)
    TRONGRID_API_KEY: str = ""         # https://www.trongrid.io
    ALCHEMY_API_URL: str = ""          # full URL incl key, e.g. https://eth-mainnet.g.alchemy.com/v2/<KEY>
    BSC_RPC_URL: str = ""              # public default fallback used if blank
    # BSC testnet RPC for the SwissCrestaVaultV1 testnet deploy. Falls back
    # to the public binance.org seed if blank. Used by the bscscan vault
    # event verifier to fetch eth_blockNumber for confirmations.
    BSC_TESTNET_RPC_URL: str = ""
    TRON_API_URL: str = "https://api.trongrid.io"

    # Absolute path recommended in production (writable volume). Relative paths are resolved from gateway CWD.
    KYC_UPLOAD_ROOT: str = "uploads/kyc"
    # Deposit proof screenshots + user payout QR for manual withdrawals (gateway). Mount same path in admin for review.
    WALLET_UPLOAD_ROOT: str = "uploads/wallet"

    # H-AUTH-1: comma-separated CIDRs of proxies we operate (nginx, docker
    # bridge, load balancers). client_ip_for_inet walks X-Forwarded-For from the
    # right and returns the last hop NOT in one of these ranges — the real
    # client — so a spoofed leftmost XFF entry can't bypass per-IP limits.
    # DECISION default covers loopback + the RFC1918 ranges our nginx/docker
    # network uses; tighten to the exact proxy IPs in production if desired.
    TRUSTED_PROXY_CIDRS: str = "127.0.0.0/8,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"

    class Config:
        env_file = ".env"
        # The root .env legitimately carries vars for other consumers
        # (docker compose, backup scripts, Next.js build args). Unknown
        # keys must never crash service boot with extra_forbidden.
        extra = "ignore"


_DEFAULT_JWT_SECRETS = {
    "dev-secret-change-in-production",
    "admin-secret-change-in-production",
    "change-me",
    # .env.example placeholders — long enough to pass the >=32-char length
    # check, so they MUST be blocklisted explicitly or a copy-pasted env
    # file boots production with publicly-known signing keys.
    "CHANGE_THIS_RANDOM_64_CHAR_STRING",
    "CHANGE_THIS_OTHER_RANDOM_64_CHAR_STRING",
    "",
}

_KNOWN_WEAK_ADMIN_PASSWORDS = {
    # Every value that has ever shipped in .env.example as a default.
    # Any deployment running with one of these is effectively unpassworded —
    # an attacker who knows the project can guess it on day one. Keep ALL
    # historical values forever; never delete, only append.
    "SwissCrestaAdmin2026!",  # current .env.example default
    "SwissCrestaAdmin2025!",  # earlier SwissCresta-era default
    "NovaFxAdmin2026!",       # NovaFX-era default
    "NovaFXAdmin2025!",       # earlier NovaFX-era default
    "FXArthaAdmin2025!",      # pre-rebrand default
    "admin",
    "password",
    "changeme",
    "",
}

# H-INF-9: default DB passwords baked into docker-compose fallbacks and the
# config defaults. A production deploy that never overrode POSTGRES_PASSWORD /
# TIMESCALE_PASSWORD ships with a publicly-known DB password — treat it like a
# default JWT secret and refuse to boot. Matched as a substring of the DSN.
_WEAK_DB_PASSWORDS = {
    "swisscresta_dev",
}


def _assert_production_secrets(s: Settings) -> None:
    """Refuse to start in production with default secrets baked into the
    binary. Missing/default JWT secrets let an attacker mint valid tokens;
    a default admin password is functionally an open super-admin login —
    both are the codebase's #1 security risks if the env file is ever
    forgotten. Fail loudly at process boot rather than silently
    authenticating forged or default-credential sessions."""
    if s.ENVIRONMENT.lower() != "production":
        # Dev hygiene: warn but don't refuse to boot — local devs need
        # the convenience of running with no env file at all.
        import logging
        log = logging.getLogger("swisscresta.config")
        weak_jwt = [
            n for n in ("JWT_SECRET", "ADMIN_JWT_SECRET", "USER_JWT_SECRET")
            if getattr(s, n, "") in _DEFAULT_JWT_SECRETS
        ]
        if weak_jwt:
            log.warning(
                "Using DEFAULT dev JWT secrets for: %s. Acceptable for local "
                "development only; production deploys MUST set strong values.",
                ", ".join(weak_jwt),
            )
        if s.ADMIN_PASSWORD in _KNOWN_WEAK_ADMIN_PASSWORDS:
            log.warning(
                "ADMIN_PASSWORD is empty or a known-weak default. Acceptable "
                "for local dev; production deploys MUST set a strong password "
                "(e.g. `openssl rand -base64 24`)."
            )
        if any(f":{pw}@" in (getattr(s, n, "") or "")
               for n in ("DATABASE_URL", "TIMESCALE_URL") for pw in _WEAK_DB_PASSWORDS):
            log.warning(
                "Using the DEFAULT dev DB password (swisscresta_dev). Acceptable "
                "for local dev; production deploys MUST set POSTGRES_PASSWORD / "
                "TIMESCALE_PASSWORD to strong values."
            )
        return
    bad: list[str] = []
    for name in ("JWT_SECRET", "ADMIN_JWT_SECRET", "USER_JWT_SECRET"):
        val = getattr(s, name, "")
        if val in _DEFAULT_JWT_SECRETS or len(val) < 32:
            bad.append(name)
    if s.ADMIN_PASSWORD in _KNOWN_WEAK_ADMIN_PASSWORDS:
        bad.append("ADMIN_PASSWORD")
    # H-INF-9: refuse a default DB password in either DSN.
    for name in ("DATABASE_URL", "TIMESCALE_URL"):
        dsn = getattr(s, name, "") or ""
        if any(f":{pw}@" in dsn for pw in _WEAK_DB_PASSWORDS):
            bad.append(name)
    if bad:
        raise RuntimeError(
            "Refusing to start: ENVIRONMENT=production but the following "
            "secrets are missing, default, or known-weak: "
            + ", ".join(bad)
            + ". Generate strong JWT secrets with `openssl rand -hex 32` and "
            "a strong ADMIN_PASSWORD with `openssl rand -base64 24`, then "
            "set them in /opt/swisscresta/.env before deploying."
        )


@lru_cache()
def get_settings() -> Settings:
    s = Settings()
    _assert_production_secrets(s)
    return s
