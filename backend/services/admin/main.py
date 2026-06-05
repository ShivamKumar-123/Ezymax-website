import logging
from contextlib import asynccontextmanager

import jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

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
    insurance as insurance_admin, play_zone as play_zone_admin,
    lifestyle as lifestyle_admin, deposit_wallets, demo_admins,
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
    except Exception as e:
        logger.warning("startup DDL skipped: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _apply_startup_ddl()
    yield
    await engine.dispose()


app = FastAPI(
    title="FXArtha Admin API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if app_settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if app_settings.ENVIRONMENT == "development" else None,
    openapi_url="/openapi.json" if app_settings.ENVIRONMENT == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=_cors_methods,
    allow_headers=_cors_headers,
)


class AdminReadOnlyMiddleware(BaseHTTPMiddleware):
    """Belt-and-braces guard for the read-only `demo_admin` role.

    require_permission already rejects every non-`.view` permission
    for demo_admin, but some endpoints in the admin API (auth, /me,
    a few legacy routes) only depend on get_current_admin without a
    permission scope. This middleware adds a coarser second layer:
    if the request's admin JWT carries role='demo_admin' AND the
    HTTP method is anything other than GET/HEAD/OPTIONS, reject 403.

    The check is cheap (one jwt.decode on each request — same key
    the auth dependency uses, no DB hit). The middleware fails open
    on decode errors / missing tokens because get_current_admin will
    catch those itself with a 401."""

    _READ_ONLY_METHODS = {"GET", "HEAD", "OPTIONS"}

    async def dispatch(self, request: Request, call_next):
        if request.method in self._READ_ONLY_METHODS:
            return await call_next(request)
        # Skip the static endpoints — they have no auth and no side effects.
        path = request.url.path
        if path in ("/health", "/metrics") or path.startswith("/api/v1/admin/auth/login"):
            return await call_next(request)
        token = request.cookies.get("fx_admin")
        if not token:
            auth_hdr = request.headers.get("authorization") or ""
            if auth_hdr.lower().startswith("bearer "):
                token = auth_hdr.split(None, 1)[1].strip()
        if not token:
            # No token — let the per-route auth dep return 401.
            return await call_next(request)
        try:
            payload = jwt.decode(
                token,
                app_settings.ADMIN_JWT_SECRET,
                algorithms=[app_settings.ADMIN_JWT_ALGORITHM],
                options={"verify_exp": True},
            )
        except jwt.PyJWTError:
            # Bad token — let the per-route auth dep handle the 401.
            return await call_next(request)
        # The role embedded in the token is stamped at login time. Even
        # if a viewer somehow forges a different role, the per-route
        # require_permission falls back on a fresh DB lookup, so this
        # middleware is a hint, not the only safeguard.
        if payload.get("role") == "demo_admin":
            return JSONResponse(
                status_code=403,
                content={"detail": "Demo admin is read-only — cannot perform this action."},
            )
        return await call_next(request)


app.add_middleware(AdminReadOnlyMiddleware)

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
app.include_router(insurance_admin.router, prefix=prefix)
app.include_router(play_zone_admin.router, prefix=prefix)
app.include_router(lifestyle_admin.router, prefix=prefix)
app.include_router(deposit_wallets.router, prefix=prefix)
app.include_router(demo_admins.router, prefix=prefix)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "admin"}
