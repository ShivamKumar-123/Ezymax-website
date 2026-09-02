import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from packages.common.src.config import get_settings
from packages.common.src.database import engine
from packages.common.src.instrumentation import init_sentry, add_middleware_stack

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("admin-api")

from routes import (
    auth, dashboard, users, trades, deposits, banks, book,
    config as routes_config, instruments_admin, business, social, analytics, bonus, banners,
    support, employees, settings, transactions, kyc, account_types, user_audit_logs,
    admin_audit_logs,
    deposit_wallets,
    notifications,
    brokers,
    branding_admin,
)

app_settings = get_settings()
init_sentry("admin-api")

_cors_origins = [
    o.strip()
    for o in app_settings.CORS_ORIGINS.split(",")
    if o.strip()
]
if not _cors_origins:
    _cors_origins = ["http://localhost:3001"]
_cors_methods = [m.strip() for m in app_settings.CORS_ALLOW_METHODS.split(",") if m.strip()]
_cors_headers = [h.strip() for h in app_settings.CORS_ALLOW_HEADERS.split(",") if h.strip()]


async def _apply_startup_ddl():
    """Idempotent ALTERs that unblock admin endpoints when manual migrations
    haven't been run yet on a host (Render/Vercel/etc.). Safe to re-run."""
    from sqlalchemy import text
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS extra_permissions JSONB DEFAULT '[]'::jsonb"
            ))
            # Book-management LP settings read/write this table. Create if the
            # baseline migration hasn't been applied so GET/PUT don't 500.
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS system_settings (
                    key VARCHAR(100) PRIMARY KEY,
                    value JSONB NOT NULL,
                    description TEXT,
                    updated_by UUID REFERENCES users(id),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            # Algo Connector — per-account API keys for external bots. Bootstrap
            # so key generation works even if alembic 0055 hasn't run on a host.
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS algo_api_keys (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
                    api_key VARCHAR(64) UNIQUE NOT NULL,
                    secret_hash VARCHAR(128) NOT NULL,
                    label VARCHAR(100) DEFAULT '',
                    is_active BOOLEAN DEFAULT true,
                    last_used_at TIMESTAMPTZ,
                    trades_count INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_algo_api_keys_api_key ON algo_api_keys(api_key)"
            ))
            # Plaintext secret storage was removed (alembic 0056) — auth only
            # ever compares secret_hash. Drop the column here too so hosts that
            # never run alembic also stop holding plaintext trading credentials.
            await conn.execute(text(
                "ALTER TABLE algo_api_keys DROP COLUMN IF EXISTS api_secret"
            ))
            # White-label brokers (alembic 0062) — tenancy columns + profile
            # table so broker endpoints work even before alembic runs.
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_broker_id UUID "
                "REFERENCES users(id) ON DELETE SET NULL"
            ))
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS broker_ancestry UUID[] NOT NULL DEFAULT '{}'"
            ))
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_origin VARCHAR(20)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_users_broker_ancestry ON users USING GIN (broker_ancestry)"
            ))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS broker_profiles (
                    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    partner_code VARCHAR(20) UNIQUE NOT NULL,
                    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
                    brand_name VARCHAR(100),
                    logo_url TEXT,
                    support_email VARCHAR(255),
                    support_whatsapp VARCHAR(32),
                    custom_domain VARCHAR(255),
                    app_subdomain VARCHAR(63),
                    custom_domain_status VARCHAR(20),
                    custom_domain_last_error TEXT,
                    custom_domain_provisioned_at TIMESTAMPTZ,
                    rental_plan VARCHAR(50),
                    rental_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                    rental_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
                    rental_period VARCHAR(20) NOT NULL DEFAULT 'monthly',
                    rental_next_due DATE,
                    rental_notes TEXT,
                    is_suspended BOOLEAN NOT NULL DEFAULT false,
                    suspended_reason TEXT,
                    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            await conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_broker_profiles_custom_domain "
                "ON broker_profiles (custom_domain) WHERE custom_domain IS NOT NULL"
            ))
            # The baseline schema whitelists role values; white-label
            # tenants use role='broker' (alembic 0063). Recreate the CHECK
            # with 'broker' included — idempotent (same definition each run).
            await conn.execute(text(
                "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check"
            ))
            await conn.execute(text(
                "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK "
                "(role IN ('user','admin','super_admin','ib','sub_broker','master_trader','broker'))"
            ))
    except Exception as e:
        logger.warning("startup DDL skipped: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _apply_startup_ddl()
    yield
    await engine.dispose()


# Docs are an opt-in exposure (security audit M6). Previously this
# exposed the full admin OpenAPI spec on any environment that wasn't
# tagged exactly "development". Now docs only mount when ENVIRONMENT is
# explicitly dev/local.
_EXPOSE_DOCS = app_settings.ENVIRONMENT in ("development", "local")
app = FastAPI(
    title="SwissCresta Admin API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _EXPOSE_DOCS else None,
    redoc_url="/redoc" if _EXPOSE_DOCS else None,
    openapi_url="/openapi.json" if _EXPOSE_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=_cors_methods,
    allow_headers=_cors_headers,
)

add_middleware_stack(app)


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    """Return JSON (not plain text) so proxies and the admin UI can parse errors."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


prefix = "/api/v1/admin"

app.include_router(auth.router, prefix=prefix)
app.include_router(dashboard.router, prefix=prefix)
app.include_router(users.router, prefix=prefix)
app.include_router(trades.router, prefix=prefix)
app.include_router(book.router, prefix=prefix)
app.include_router(deposits.router, prefix=prefix)
app.include_router(banks.router, prefix=prefix)
app.include_router(routes_config.router, prefix=prefix)
app.include_router(instruments_admin.router, prefix=prefix)
app.include_router(business.router, prefix=prefix)
app.include_router(social.router, prefix=prefix)
app.include_router(analytics.router, prefix=prefix)
app.include_router(bonus.router, prefix=prefix)
app.include_router(banners.router, prefix=prefix)
app.include_router(support.router, prefix=prefix)
app.include_router(employees.router, prefix=prefix)
app.include_router(settings.router, prefix=prefix)
app.include_router(transactions.router, prefix=prefix)
app.include_router(kyc.router, prefix=prefix)
app.include_router(account_types.router, prefix=prefix)
app.include_router(user_audit_logs.router, prefix=prefix)
app.include_router(admin_audit_logs.router, prefix=prefix)
app.include_router(deposit_wallets.router, prefix=prefix)
app.include_router(notifications.router, prefix=prefix)
app.include_router(brokers.router, prefix=prefix)
app.include_router(branding_admin.router, prefix=prefix)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "admin"}
