from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql+asyncpg://trustedge:trustedge_dev@localhost:5432/trustedge"
    TIMESCALE_URL: str = "postgresql+asyncpg://trustedge:trustedge_dev@localhost:5433/marketdata"
    REDIS_URL: str = "redis://localhost:6379/0"
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"

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
    # Still return access_token in login/register JSON (phase out when all clients use cookies only).
    JWT_INCLUDE_LEGACY_JSON_TOKEN: bool = True

    # HttpOnly auth cookies (trader web). Secure derived from request HTTPS unless overridden.
    ACCESS_TOKEN_COOKIE_NAME: str = "pt_access"
    REFRESH_TOKEN_COOKIE_NAME: str = "pt_refresh"
    COOKIE_SAMESITE: str = "strict"  # lax | strict | none
    # If None, Secure flag follows the incoming request (HTTPS / X-Forwarded-Proto).
    COOKIE_SECURE: bool | None = None

    ADMIN_JWT_SECRET: str = "admin-secret-change-in-production"
    ADMIN_JWT_ALGORITHM: str = "HS256"
    ADMIN_JWT_EXPIRY_HOURS: int = 8
    USER_JWT_SECRET: str = "dev-secret-change-in-production"
    USER_JWT_ALGORITHM: str = "HS256"

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    CORS_ALLOW_METHODS: str = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    CORS_ALLOW_HEADERS: str = "Authorization,Content-Type,X-Requested-With,Accept"

    # Public trader app URL (password reset links). No trailing slash.
    TRADER_APP_URL: str = "http://localhost:3000"

    # Optional SMTP — required for password-reset emails in non-dev. If SMTP_HOST is empty, reset links are only logged in development.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    # Market data provider (Infoway.io)
    INFOWAY_API_KEY: str = ""
    INFOWAY_API_URL: str = "https://api.infoway.io"

    MARGIN_CALL_LEVEL: float = 80.0
    STOP_OUT_LEVEL: float = 50.0
    MAX_OPEN_TRADES: int = 200
    DEFAULT_LEVERAGE: int = 100

    # Sentry error tracking (leave empty to disable)
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1

    # Rate limiting (requests per minute per IP)
    RATE_LIMIT_DEFAULT: str = "600/minute"
    RATE_LIMIT_AUTH: str = "20/minute"
    RATE_LIMIT_TRADING: str = "600/minute"

    # Request body size limit (bytes) — 10 MB default
    MAX_REQUEST_SIZE: int = 10 * 1024 * 1024

    # Absolute path recommended in production (writable volume). Relative paths are resolved from gateway CWD.
    KYC_UPLOAD_ROOT: str = "uploads/kyc"
    # Deposit proof screenshots + user payout QR for manual withdrawals (gateway). Mount same path in admin for review.
    WALLET_UPLOAD_ROOT: str = "uploads/wallet"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
