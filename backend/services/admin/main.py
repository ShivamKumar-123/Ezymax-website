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


# Section F: the former _apply_startup_ddl() ran ALTER/CREATE statements on
# every admin boot — including DROP + ADD CONSTRAINT users_role_check, which
# took an ACCESS EXCLUSIVE lock on users and re-validated the whole table each
# start (x2 workers). Every statement already lives in an Alembic migration
# (0055/0056 algo keys, 0062 broker tenancy, 0063 users_role_check, 0070
# employees.extra_permissions, baseline system_settings) and deploy.sh runs
# `alembic upgrade head` before restarting services, so it is gone (see 0076).


@asynccontextmanager
async def lifespan(app: FastAPI):
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
