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
    insurance as insurance_admin,
    shield_insurance as shield_insurance_admin,
    reward_store as reward_store_admin,
    rewards_coins as rewards_coins_admin,
    rewards_tasks as rewards_tasks_admin,
    spin_wheel as spin_wheel_admin,
    ib_rebate as ib_rebate_admin,
    lifestyle as lifestyle_admin, deposit_wallets, demo_admins, rms, trade_risk, rms_dashboard,
    admin_notifications, pricing_rules, crm, hedge, waitlist,
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
            # Non-withdrawable bonus wallet (migration 0062).
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC(18,8) NOT NULL DEFAULT 0"
            ))
            # Per-task Power Score payout (migration 0066). DEFAULT 100 is the
            # flat amount every claim paid before this became per-task, so
            # existing rows keep paying exactly what they did.
            await conn.execute(text(
                "ALTER TABLE rewards_missions ADD COLUMN IF NOT EXISTS ps_reward INTEGER NOT NULL DEFAULT 100"
            ))
            # Allow spread_type='floating' (per-user floating spread). The old
            # check constraint only permitted fixed/variable/pips/percentage, so
            # inserting a floating override failed. Re-create it with 'floating'.
            await conn.execute(text(
                "ALTER TABLE spread_configs DROP CONSTRAINT IF EXISTS spread_configs_spread_type_check"
            ))
            await conn.execute(text(
                "ALTER TABLE spread_configs ADD CONSTRAINT spread_configs_spread_type_check "
                "CHECK (spread_type IN ('fixed','variable','pips','percentage','floating'))"
            ))
            # Allow insurance transaction types. The transactions_type_check
            # constraint predates the insurance products, so 'insurance_fee'
            # (premium charge) and 'insurance_payout' (claim credit) were
            # rejected — breaking both per-trade insurance and Shield purchases.
            # Re-create the constraint with them included (superset of the old).
            await conn.execute(text(
                "ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check"
            ))
            await conn.execute(text(
                "ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK ("
                "type IN ('deposit','withdrawal','commission','swap','bonus','credit',"
                "'adjustment','ib_commission','profit','loss','transfer','admin_commission',"
                "'performance_fee','master_commission','refund','insurance_fee','insurance_payout'))"
            ))
            # Waitlist (invite-only access gate). Mirrors migration 0061 so the
            # admin waitlist endpoints work even where Alembic hasn't run.
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS waitlist_requests (
                    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    full_name         VARCHAR(200) NOT NULL,
                    email             VARCHAR(255) NOT NULL,
                    phone             VARCHAR(20),
                    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
                    reviewed_by       UUID,
                    reviewed_at       TIMESTAMPTZ,
                    rejection_reason  TEXT,
                    created_user_id   UUID,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT waitlist_requests_status_check
                        CHECK (status IN ('pending','approved','rejected'))
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_waitlist_requests_email ON waitlist_requests (email)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_waitlist_requests_status ON waitlist_requests (status)"
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
            # RMS / IP-management tables. Mirrors migration 0053 so the
            # IP-management endpoints work even on a host where Alembic
            # hasn't been run yet. CREATE … IF NOT EXISTS is a no-op once
            # the migration has applied them.
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS ip_geo_cache (
                    ip_address INET PRIMARY KEY,
                    status VARCHAR(16) NOT NULL DEFAULT 'resolved',
                    country VARCHAR(80),
                    country_code VARCHAR(4),
                    region VARCHAR(120),
                    city VARCHAR(120),
                    latitude NUMERIC(9,6),
                    longitude NUMERIC(9,6),
                    isp VARCHAR(160),
                    org VARCHAR(160),
                    timezone VARCHAR(64),
                    is_proxy BOOLEAN,
                    is_hosting BOOLEAN,
                    resolved_at TIMESTAMPTZ DEFAULT now(),
                    created_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS rms_alerts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    alert_type VARCHAR(40) NOT NULL DEFAULT 'shared_ip',
                    ip_address INET NOT NULL,
                    user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
                    user_count INTEGER NOT NULL DEFAULT 0,
                    status VARCHAR(16) NOT NULL DEFAULT 'open',
                    severity VARCHAR(16) NOT NULL DEFAULT 'medium',
                    notes TEXT,
                    reviewed_by UUID,
                    reviewed_at TIMESTAMPTZ,
                    first_seen_at TIMESTAMPTZ DEFAULT now(),
                    last_seen_at TIMESTAMPTZ DEFAULT now(),
                    created_at TIMESTAMPTZ DEFAULT now(),
                    CONSTRAINT uq_rms_alert_type_ip UNIQUE (alert_type, ip_address)
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_rms_alerts_status ON rms_alerts (status)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_user_sessions_ip ON user_sessions (ip_address)"
            ))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS admin_notifications (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    category VARCHAR(40) NOT NULL,
                    severity VARCHAR(16) NOT NULL DEFAULT 'medium',
                    title VARCHAR(200) NOT NULL,
                    body TEXT,
                    meta JSONB,
                    action_url VARCHAR(200),
                    dedup_key VARCHAR(160),
                    is_read BOOLEAN NOT NULL DEFAULT false,
                    read_by UUID,
                    read_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    CONSTRAINT uq_admin_notif_dedup UNIQUE (dedup_key)
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_admin_notif_unread ON admin_notifications (is_read, created_at)"
            ))
            # Time-windowed spread/leverage rules + dynamic-spread tunables.
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS pricing_time_rules (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(120) NOT NULL,
                    scope VARCHAR(20) NOT NULL DEFAULT 'default',
                    segment_id UUID,
                    instrument_id UUID,
                    kind VARCHAR(12) NOT NULL DEFAULT 'custom',
                    session VARCHAR(30),
                    days_of_week JSONB,
                    start_min INTEGER,
                    end_min INTEGER,
                    spread_mode VARCHAR(12) NOT NULL DEFAULT 'multiplier',
                    spread_multiplier NUMERIC(8,3) DEFAULT 1,
                    spread_value NUMERIC(18,8),
                    spread_type VARCHAR(20) DEFAULT 'pips',
                    leverage_cap INTEGER,
                    priority INTEGER NOT NULL DEFAULT 0,
                    is_enabled BOOLEAN NOT NULL DEFAULT true,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now(),
                    updated_by UUID
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_pricing_time_rules_enabled ON pricing_time_rules (is_enabled)"
            ))
            await conn.execute(text("""
                INSERT INTO system_settings (key, value, description)
                VALUES
                    ('dynamic_spread_enabled',     'false'::jsonb, 'Widen spread with live market volatility'),
                    ('dynamic_spread_max_mult',    '3.0'::jsonb,   'Max volatility spread multiplier'),
                    ('dynamic_spread_sensitivity', '1.0'::jsonb,   'Volatility sensitivity'),
                    ('dynamic_spread_window_sec',  '60'::jsonb,    'Rolling window (seconds) for volatility')
                ON CONFLICT (key) DO NOTHING
            """))

            # ── FXArtha Shield — aggregate period-plan insurance ──────────────
            # Separate product from the per-trade micro-insurance. Mirrors the
            # models in packages/common/src/models/insurance_shield.py so the
            # Shield endpoints + close-time settlement work even where Alembic
            # hasn't run. All statements are idempotent.
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS insurance_shield_plans (
                    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    code          VARCHAR(32) NOT NULL UNIQUE,
                    period        VARCHAR(10) NOT NULL,
                    tier          VARCHAR(10) NOT NULL,
                    coverage_pct  NUMERIC(5,2) NOT NULL,
                    max_payout    NUMERIC(18,2) NOT NULL,
                    premium       NUMERIC(18,2) NOT NULL,
                    is_active     BOOLEAN NOT NULL DEFAULT true,
                    sort_order    INTEGER NOT NULL DEFAULT 0,
                    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT ins_shield_plan_period_check CHECK (period IN ('daily','weekly','monthly')),
                    CONSTRAINT ins_shield_plan_tier_check   CHECK (tier IN ('basic','plus','pro','elite')),
                    CONSTRAINT uq_ins_shield_plan_period_tier UNIQUE (period, tier)
                )
            """))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_insurance_shield (
                    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    plan_id                   UUID REFERENCES insurance_shield_plans(id) ON DELETE SET NULL,
                    period                    VARCHAR(10) NOT NULL,
                    tier                      VARCHAR(10) NOT NULL,
                    coverage_pct              NUMERIC(5,2) NOT NULL,
                    max_payout                NUMERIC(18,2) NOT NULL,
                    premium_paid              NUMERIC(18,2) NOT NULL,
                    cumulative_eligible_loss  NUMERIC(18,2) NOT NULL DEFAULT 0,
                    coverage_used             NUMERIC(18,2) NOT NULL DEFAULT 0,
                    status                    VARCHAR(12) NOT NULL DEFAULT 'active',
                    activated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
                    expires_at                TIMESTAMPTZ NOT NULL,
                    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT user_ins_shield_status_check
                        CHECK (status IN ('active','expired','cancelled','replaced','exhausted'))
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_user_ins_shield_user_status "
                "ON user_insurance_shield (user_id, status)"
            ))
            # One ACTIVE plan per user (partial unique index).
            await conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_ins_shield_one_active "
                "ON user_insurance_shield (user_id) WHERE status = 'active'"
            ))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS insurance_shield_claims (
                    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_insurance_id         UUID NOT NULL REFERENCES user_insurance_shield(id) ON DELETE CASCADE,
                    user_id                   UUID NOT NULL REFERENCES users(id),
                    position_id               UUID REFERENCES positions(id) ON DELETE SET NULL,
                    trade_loss                NUMERIC(18,2) NOT NULL,
                    cumulative_eligible_loss  NUMERIC(18,2) NOT NULL,
                    payout_amount             NUMERIC(18,2) NOT NULL,
                    transaction_id            UUID REFERENCES transactions(id),
                    status                    VARCHAR(14) NOT NULL DEFAULT 'paid',
                    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT ins_shield_claim_status_check
                        CHECK (status IN ('paid','pending','approved','rejected','partial','under_review'))
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_ins_shield_claim_shield "
                "ON insurance_shield_claims (user_insurance_id)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_ins_shield_claim_user_created "
                "ON insurance_shield_claims (user_id, created_at)"
            ))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS insurance_shield_events (
                    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_insurance_id UUID REFERENCES user_insurance_shield(id) ON DELETE SET NULL,
                    user_id           UUID NOT NULL REFERENCES users(id),
                    type              VARCHAR(24) NOT NULL,
                    detail            TEXT,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_ins_shield_event_user_created "
                "ON insurance_shield_events (user_id, created_at)"
            ))
            # Seed the handbook default catalog. ON CONFLICT keeps admin edits.
            await conn.execute(text("""
                INSERT INTO insurance_shield_plans
                    (code, period, tier, coverage_pct, max_payout, premium, sort_order)
                VALUES
                    ('daily_basic',   'daily',   'basic', 20,   200,  19,  0),
                    ('daily_plus',    'daily',   'plus',  30,   500,  45,  1),
                    ('daily_pro',     'daily',   'pro',   40,  2000, 149,  2),
                    ('daily_elite',   'daily',   'elite', 50,  5000, 399,  3),
                    ('weekly_basic',  'weekly',  'basic', 20,   500,  39, 10),
                    ('weekly_plus',   'weekly',  'plus',  30,  1000,  79, 11),
                    ('weekly_pro',    'weekly',  'pro',   40,  5000, 299, 12),
                    ('weekly_elite',  'weekly',  'elite', 50, 10000, 699, 13),
                    ('monthly_basic', 'monthly', 'basic', 20,  1000,  89, 20),
                    ('monthly_plus',  'monthly', 'plus',  30,  2500, 199, 21),
                    ('monthly_pro',   'monthly', 'pro',   40,  7500, 549, 22),
                    ('monthly_elite', 'monthly', 'elite', 50, 15000, 999, 23)
                ON CONFLICT (code) DO NOTHING
            """))

            # ── IB rebate (Milele-style tiered per-lot accrual) ───────────────
            # Two tables + seeded config. The model stays 'instant' (legacy flat
            # per-lot at fill) until an admin flips ib_commission_model to
            # 'accrual', so switching on the new engine is a deliberate action.
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS ib_rebate_periods (
                    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ib_id             UUID NOT NULL REFERENCES ib_profiles(id) ON DELETE CASCADE,
                    period            VARCHAR(7) NOT NULL,
                    eligible_lots     NUMERIC(18,4) NOT NULL DEFAULT 0,
                    active_clients    INTEGER NOT NULL DEFAULT 0,
                    tier              VARCHAR(20) NOT NULL DEFAULT 'starter',
                    rate_per_lot      NUMERIC(18,8) NOT NULL DEFAULT 0,
                    own_target        NUMERIC(18,8) NOT NULL DEFAULT 0,
                    own_settled       NUMERIC(18,8) NOT NULL DEFAULT 0,
                    override_settled  NUMERIC(18,8) NOT NULL DEFAULT 0,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT uq_ib_rebate_period UNIQUE (ib_id, period)
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_ib_rebate_period_period ON ib_rebate_periods (period)"
            ))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS ib_rebate_settlements (
                    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ib_id          UUID NOT NULL REFERENCES ib_profiles(id) ON DELETE CASCADE,
                    period         VARCHAR(7) NOT NULL,
                    kind           VARCHAR(12) NOT NULL,
                    level          INTEGER NOT NULL DEFAULT 0,
                    source_ib_id   UUID REFERENCES ib_profiles(id) ON DELETE SET NULL,
                    amount         NUMERIC(18,8) NOT NULL,
                    transaction_id UUID REFERENCES transactions(id),
                    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_ib_rebate_settle_ib_period ON ib_rebate_settlements (ib_id, period)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_ib_rebate_settle_created ON ib_rebate_settlements (created_at)"
            ))
            # Seed the Milele default config (JSONB values). ON CONFLICT keeps
            # any admin edits.
            # exec_driver_sql (not text()) — the tiers JSON contains `:0`, `:3`
            # etc. which SQLAlchemy's text() would parse as bind parameters and
            # blow up the whole DDL transaction ("bind parameter '0'").
            await conn.exec_driver_sql("""
                INSERT INTO system_settings (key, value, description) VALUES
                    ('ib_commission_model', '"instant"'::jsonb, 'IB payout model: instant (legacy flat per-lot) or accrual (Milele tiered)'),
                    ('ib_rebate_tiers',
                      '[{"tier":"starter","min_lots":0,"min_clients":0,"rate":3},{"tier":"builder","min_lots":200,"min_clients":3,"rate":5},{"tier":"pro","min_lots":500,"min_clients":10,"rate":7}]'::jsonb,
                      'IB rebate tier ladder (per closed lot)'),
                    ('ib_override_pcts', '[10,5,2.5]'::jsonb, 'Upline override % by depth (halves beyond the list)'),
                    ('ib_override_cap_pct', '20'::jsonb, 'Max total override on top of any rebate (%)'),
                    ('ib_override_max_levels', '8'::jsonb, 'Max upline depth that earns override'),
                    ('ib_active_client_min_lots', '0.5'::jsonb, 'Closed lots/month for a client to count as active'),
                    ('ib_active_require_kyc', 'true'::jsonb, 'Active client must be KYC-verified'),
                    ('ib_active_require_deposit', 'true'::jsonb, 'Active client must have deposited'),
                    ('ib_rebate_all_instruments', 'true'::jsonb, 'Count all instruments'' closed lots as eligible')
                ON CONFLICT (key) DO NOTHING
            """)

            # ── Every user gets a referral code + auto-IB threshold ───────────
            # No IB application: any user can refer, and once they bring enough
            # referrals they're auto-promoted to IB (see gateway auth_service).
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16)"
            ))
            # Backfill a deterministic, unique code for existing users.
            await conn.execute(text(
                "UPDATE users SET referral_code = upper(substr(md5(id::text || 'fxa'), 1, 8)) "
                "WHERE referral_code IS NULL"
            ))
            await conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_referral_code ON users (referral_code)"
            ))
            await conn.execute(text("""
                INSERT INTO system_settings (key, value, description) VALUES
                    ('ib_auto_min_referrals', '1'::jsonb, 'Referrals a user needs to be auto-promoted to IB')
                ON CONFLICT (key) DO NOTHING
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
app.include_router(shield_insurance_admin.router, prefix=prefix)
app.include_router(reward_store_admin.router, prefix=prefix)
app.include_router(rewards_coins_admin.router, prefix=prefix)
app.include_router(rewards_tasks_admin.router, prefix=prefix)
app.include_router(spin_wheel_admin.router, prefix=prefix)
app.include_router(ib_rebate_admin.router, prefix=prefix)
app.include_router(lifestyle_admin.router, prefix=prefix)
app.include_router(deposit_wallets.router, prefix=prefix)
app.include_router(demo_admins.router, prefix=prefix)
app.include_router(rms.router, prefix=prefix)
app.include_router(trade_risk.router, prefix=prefix)
app.include_router(rms_dashboard.router, prefix=prefix)
app.include_router(hedge.router, prefix=prefix)
app.include_router(admin_notifications.router, prefix=prefix)
app.include_router(pricing_rules.router, prefix=prefix)
app.include_router(waitlist.router, prefix=prefix)
# CRM integration API — distinct prefix (NOT the admin prefix); auth is the
# static X-API-Key, not admin JWT. GET-only, so AdminReadOnlyMiddleware passes.
app.include_router(crm.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "admin"}
