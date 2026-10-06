"""Ezymex Gateway — REST + WebSocket API Server."""
import asyncio
import collections
import contextlib
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from decimal import Decimal
from uuid import UUID

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, and_, or_, text

from packages.common.src.config import get_settings
from packages.common.src.database import AsyncSessionLocal, WorkerSessionLocal
from packages.common.src.redis_client import redis_client, PriceChannel, BARS_UPDATES_CHANNEL, CONFIG_INSTRUMENTS_RELOAD_CHANNEL
from packages.common.src.price_cache import price_cache
from packages.common.src.pubsub_hub import hub as pubsub_hub
from packages.common.src import engine_lock as engine_lock_mod
from packages.common.src.engine_lock import engine_lock
from packages.common.src.settings_store import SETTINGS_RELOAD_CHANNEL, bust_local_cache as bust_settings_cache
from packages.common.src.cache import bust_all as bust_display_caches
from packages.common.src.kafka_client import close_producer
from packages.common.src.auth import verify_session_token
from packages.common.src.models import TradingAccount, SpreadConfig, Instrument, Position
from packages.common.src.instrument_pricing import symmetric_quote_from_mid
from packages.common.src.instrumentation import init_sentry, add_middleware_stack, spawn

from .api import (
    auth, orders, positions, accounts, instruments, deposits, webhooks,
    websocket_manager, social, business, portfolio, profile, support,
    notifications, banners, trading_catalog, followers, lp_receiver,
    share, algo_connector, algo_keys, algo_market_data, ai_strategies,
    branding,
)
from .engines.sltp_engine import sltp_engine
from .engines.copy_engine import copy_engine
from .engines.stats_engine import stats_engine
from .engines.overnight_fee_engine import overnight_fee_engine
from .engines.verification_reminder_engine import verification_reminder_engine
from .engines.monthly_statement_engine import monthly_statement_engine
from .engines.chain_verifier_engine import chain_verifier_engine
from .engines.bars_persist_engine import bars_persist_engine
from .engines.reconcile_engine import reconcile_engine
from .engines.ai_strategy_engine import ai_strategy_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("gateway")

settings = get_settings()
init_sentry("gateway")

_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
if not _cors_origins:
    _cors_origins = ["http://localhost:3000", "http://localhost:3001"]
# Credentialed REST CORS is narrower than the WS origin allow-list (which keeps
# using _cors_origins): hosts that only need the live price socket (marketing
# apex/www) must not also get credentialed cross-origin API access. Falls back
# to CORS_ORIGINS when API_CORS_ORIGINS is unset.
if settings.API_CORS_ORIGINS is not None:
    _api_cors_origins = [o.strip() for o in settings.API_CORS_ORIGINS.split(",") if o.strip()]
else:
    _api_cors_origins = list(_cors_origins)
_cors_methods = [m.strip() for m in settings.CORS_ALLOW_METHODS.split(",") if m.strip()]
_cors_headers = [h.strip() for h in settings.CORS_ALLOW_HEADERS.split(",") if h.strip()]


# ── Section F: no DDL / table-wide backfills at process boot ─────────────
# The former boot helpers (_backfill_close_reasons, _ensure_pamm_units_column,
# _ensure_push_tokens_table, _ensure_ohlc_bars_table) now live in Alembic
# (0058 for the tables/column, 0076 for the one-time data backfills). Every
# replica restart used to run a table-wide UPDATE on trade_history.


# ── Trade-history self-heal ────────────────────────────────────────────
# Defensive safety net: if a Position closes (status='closed', close_price
# set) but no matching trade_history row exists, this task re-creates the
# missing row from the position's data. All values copied verbatim from the
# positions row — nothing fabricated. close_reason is computed from the
# actual close_price vs the actual TP/SL on the position.
#
# Section F (correct with N workers / replicas):
#   * leader-locked (engine_lock "trade_history_healer") — one healer cluster-wide;
#   * candidates are locked ``FOR UPDATE OF p SKIP LOCKED`` so a position that a
#     close path is finishing right now (it holds the row lock while writing its
#     own TradeHistory) is skipped, and only positions closed > 30 s ago are
#     considered;
#   * ``ON CONFLICT DO NOTHING``. There is deliberately NO unique index on
#     trade_history(position_id): partial closes write several rows per position.
_HEAL_SQL = text(
    """
    WITH cand AS (
        SELECT p.id
          FROM positions p
         WHERE p.status = 'closed'
           AND p.close_price IS NOT NULL
           AND COALESCE(p.closed_at, p.updated_at, p.created_at) < NOW() - INTERVAL '30 seconds'
           AND NOT EXISTS (SELECT 1 FROM trade_history th WHERE th.position_id = p.id)
         ORDER BY p.id
         LIMIT 1000
           FOR UPDATE OF p SKIP LOCKED
    )
    INSERT INTO trade_history (
        id, position_id, account_id, instrument_id, side, lots,
        open_price, close_price, swap, commission, profit,
        opened_at, closed_at, close_reason
    )
    SELECT
        gen_random_uuid(), p.id, p.account_id, p.instrument_id, p.side, p.lots,
        p.open_price, p.close_price,
        COALESCE(p.swap, 0), COALESCE(p.commission, 0),
        COALESCE(p.profit, 0),
        p.created_at,
        COALESCE(p.closed_at, NOW()),
        CASE
            WHEN p.take_profit IS NOT NULL AND (
              (LOWER(CAST(p.side AS TEXT))='buy'  AND p.close_price >= p.take_profit)
              OR (LOWER(CAST(p.side AS TEXT))='sell' AND p.close_price <= p.take_profit)
            ) THEN 'tp'
            WHEN p.stop_loss IS NOT NULL AND (
              (LOWER(CAST(p.side AS TEXT))='buy'  AND p.close_price <= p.stop_loss)
              OR (LOWER(CAST(p.side AS TEXT))='sell' AND p.close_price >= p.stop_loss)
            ) THEN 'sl'
            ELSE 'manual'
        END
    FROM positions p
    JOIN cand ON cand.id = p.id
    ON CONFLICT DO NOTHING
    """
)


async def _heal_missing_trade_history():
    try:
        async with WorkerSessionLocal() as session:
            res = await session.execute(_HEAL_SQL)
            await session.commit()
            inserted = res.rowcount or 0
            if inserted > 0:
                # Historically caused by the b-book engine's duplicate SL/TP
                # monitor, which closed positions without writing TradeHistory.
                # That monitor was removed; this loop stays as a safety net and
                # any new hit means a NEW close-path is dropping the write.
                logger.warning(
                    "trade_history self-heal: inserted %d missing row(s) — "
                    "investigate close-path that's dropping the TradeHistory write",
                    inserted,
                )
    except Exception as e:
        logger.warning("trade_history self-heal skipped: %s", e)


async def _trade_history_healer_loop():
    """Heal every 60 s (first pass right after boot) on the leader only."""
    while True:
        try:
            async with engine_lock("trade_history_healer", ttl_seconds=120) as lease:
                if lease:
                    await _heal_missing_trade_history()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("trade_history healer tick failed: %s", e)
        await asyncio.sleep(60)


_ENGINES = (
    sltp_engine, copy_engine, stats_engine, overnight_fee_engine,
    verification_reminder_engine, monthly_statement_engine, chain_verifier_engine,
    bars_persist_engine, reconcile_engine, ai_strategy_engine,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # One Redis pub/sub connection per process, shared by the price cache,
    # every WebSocket and the config-bust listeners.
    await pubsub_hub.start()
    # In-memory tick cache fed by the hub. Must start BEFORE the engines so
    # they hit a warm cache instead of falling through to Redis.
    await price_cache.start(hub=pubsub_hub)
    bust_subs = [
        pubsub_hub.subscribe(SETTINGS_RELOAD_CHANNEL, bust_settings_cache),
        pubsub_hub.subscribe(CONFIG_INSTRUMENTS_RELOAD_CHANNEL, bust_display_caches),
    ]

    # RUN_ENGINES (default true = previous single-host behaviour): pure API /
    # WebSocket replicas set it false; engines then run only on engine
    # replicas. Even with several engine replicas each engine is leader-locked.
    run_engines = bool(getattr(settings, "RUN_ENGINES", True))
    healer_task = None
    if run_engines:
        healer_task = spawn(_trade_history_healer_loop(), name="trade_history_healer")
        for eng in _ENGINES:
            await eng.start()
    else:
        logger.info("RUN_ENGINES=false — background engines disabled in this process")
    yield
    if run_engines:
        for eng in reversed(_ENGINES):
            with contextlib.suppress(Exception):
                await eng.stop()
        if healer_task is not None:
            healer_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await healer_task
        # Hand leadership over now instead of letting peers wait out the TTL.
        await engine_lock_mod.release_all()
    for sub in bust_subs:
        sub.close()
    await price_cache.stop()
    await pubsub_hub.stop()
    await close_producer()
    await redis_client.close()


# Docs are an opt-in exposure (security audit M6). Previously this was
# "expose unless ENVIRONMENT == 'development' is false", so a staging
# box left at the default value would leak the full OpenAPI spec — every
# endpoint and schema — to the public internet. Now we only mount them
# for explicitly tagged dev/local environments.
_EXPOSE_DOCS = settings.ENVIRONMENT in ("development", "local")
app = FastAPI(
    title="Ezymex Gateway",
    version="1.0.0",
    description="Forex CFD B-Book Trading Platform API",
    lifespan=lifespan,
    docs_url="/docs" if _EXPOSE_DOCS else None,
    redoc_url="/redoc" if _EXPOSE_DOCS else None,
    openapi_url="/openapi.json" if _EXPOSE_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_api_cors_origins,
    allow_credentials=True,
    allow_methods=_cors_methods,
    allow_headers=_cors_headers,
    max_age=86400,  # Cache preflight for 24h — avoids OPTIONS request before every POST
)

add_middleware_stack(app)

# REST API Routes
#
# Onboarding enforcement happens at the action layer (e.g.
# wallet_service.create_withdrawal refuses without user.wallet_address)
# rather than at the router level. The router-wide _GATED was rolled back
# because the 428 ONBOARDING_INCOMPLETE responses were leaking through to
# the dashboard's read-only screens (accounts list, wallet summary,
# portfolio) before the OnboardingGate modal could render — leaving new
# users stuck on a "Retry" error instead of being walked through email
# verification + wallet linking.
#
# The frontend OnboardingGate is still the UX nudge. Money operations
# enforce per-action: withdrawals require user.wallet_address, the email-
# change flow requires step-up, etc.
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(accounts.router, prefix="/api/v1/accounts", tags=["Accounts"])
app.include_router(instruments.router, prefix="/api/v1/instruments", tags=["Instruments"])
app.include_router(trading_catalog.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(positions.router, prefix="/api/v1/positions", tags=["Positions"])
app.include_router(deposits.router, prefix="/api/v1/wallet", tags=["Wallet"])
app.include_router(social.router, prefix="/api/v1/social", tags=["Social Trading"])
app.include_router(business.router, prefix="/api/v1/business", tags=["Business/IB"])
app.include_router(portfolio.router, prefix="/api/v1/portfolio", tags=["Portfolio"])
app.include_router(profile.router, prefix="/api/v1/profile", tags=["Profile"])
app.include_router(support.router, prefix="/api/v1/support", tags=["Support"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(branding.router, prefix="/api/v1/branding", tags=["Branding"])
app.include_router(banners.media_router, prefix="/api/v1/banners", tags=["Banners"])
app.include_router(banners.router, prefix="/api/v1/banners", tags=["Banners"])
app.include_router(followers.router, prefix="/api/v1/followers", tags=["Followers"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["Webhooks"])
# Corecen LP price push receiver — HMAC-secured, public (no JWT). Path mirrors
# Corecen's sender (axios POST baseURL + '/api/lp/prices/batch').
app.include_router(lp_receiver.router, prefix="/api/lp", tags=["LP Receiver"])
app.include_router(share.router, prefix="/api/v1", tags=["Share Trade"])
app.include_router(share.public_router, prefix="/api/v1/public", tags=["Public Share"])
# Algo Connector. Key management is JWT/cookie-auth and rides the /api/v1 proxy;
# the bot-facing trade + market-data API is X-Api-Key/X-Api-Secret authed and lives
# under a separate /api/algo namespace (no v1) — bots never send a JWT.
app.include_router(algo_keys.router, prefix="/api/v1/algo", tags=["Algo Keys"])
app.include_router(algo_connector.router, prefix="/api/algo", tags=["Algo Connector"])
app.include_router(algo_market_data.router, prefix="/api/algo", tags=["Algo Market Data"])
# AI Strategy Builder — natural-language strategies, backtests, deployments.
app.include_router(ai_strategies.router, prefix="/api/v1/ai-strategies", tags=["AI Strategies"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "gateway"}


# ============================================
# WEBSOCKET — Price Streaming & Trade Updates
# ============================================

async def _verify_ws_token(token: str | None) -> dict | None:
    """Authenticate a WebSocket handshake token. Returns
    {user_id, role, sid} or None.

    Same checks as the REST ``get_current_user`` (via
    ``auth.verify_session_token``): a signature-valid JWT is NOT enough — it
    must carry a session id, must not be an impersonation hand-off token, its
    session must still be active (logout / revocation) and the account must
    not be banned / blocked / suspended. Previously the WS path only decoded
    the JWT, so revoked or sid-less tokens kept streaming."""
    if not token:
        return None
    try:
        user = await verify_session_token(token)
    except Exception:
        return None
    if not user:
        return None
    return {"user_id": user["user_id"], "role": user.get("role"), "sid": user.get("sid")}


def _ws_token_from_websocket(ws: WebSocket, fallback_query_token: str | None) -> str | None:
    """Extract the access JWT for a WebSocket handshake.

    Preferred path: HttpOnly `pt_access` cookie (browser sends it
    automatically — never leaks into URLs / logs / browser history).
    Fallback: ?token= query string for legacy mobile clients that can't
    attach cookies. The query path is retained for backward
    compatibility but the trader frontend has been switched to cookies
    so its access token never appears in nginx access logs (audit H4)."""
    cookie_name = (get_settings().ACCESS_TOKEN_COOKIE_NAME or "pt_access").strip()
    cookie_token = ws.cookies.get(cookie_name)
    if cookie_token:
        return cookie_token
    return fallback_query_token


def _admin_ws_token(ws: WebSocket, fallback_query_token: str | None) -> str | None:
    """Same cookie-first pattern as the trader token, but reads the
    admin HttpOnly cookie (`fx_admin` by default) and falls back to the
    query string only if the cookie is missing. Audit H4 — previously
    admin WS only accepted ?token=, dumping the admin JWT into nginx
    access logs and the browser history."""
    # Settings has no ADMIN_COOKIE_NAME field (the admin API hard-codes
    # "fx_admin"), so the old attribute access raised AttributeError and
    # broke every /ws/admin handshake. getattr keeps an env override possible.
    cookie_name = (getattr(get_settings(), "ADMIN_COOKIE_NAME", None) or "fx_admin").strip()
    cookie_token = ws.cookies.get(cookie_name)
    if cookie_token:
        return cookie_token
    return fallback_query_token


def _verify_admin_ws_token(token: str | None) -> dict | None:
    """Decode an admin JWT (separate secret + claim shape from trader
    tokens). Returns a normalised dict or None on any failure.

    Admin tokens carry `admin_id` not `sub`, are signed with
    ADMIN_JWT_SECRET, and have type="admin"; trader tokens decoded by
    `_verify_ws_token` will not pass this check — which is the point."""
    if not token:
        return None
    try:
        import jwt as _jwt
        st = get_settings()
        payload = _jwt.decode(token, st.ADMIN_JWT_SECRET, algorithms=[st.ADMIN_JWT_ALGORITHM])
        if payload.get("type") != "admin":
            return None
        return {"admin_id": UUID(payload["admin_id"]), "role": payload.get("role", "")}
    except Exception:
        return None


def _normalize_origin(raw: str) -> str:
    """Lower-case + strip trailing slash + drop the port if it's the
    default for the scheme. Lets `https://trade.ezymex.com:443/`
    compare equal to `https://trade.ezymex.com`."""
    o = raw.strip().rstrip("/").lower()
    if o.startswith("https://") and o.endswith(":443"):
        o = o[:-4]
    elif o.startswith("http://") and o.endswith(":80"):
        o = o[:-3]
    return o


_NORMALIZED_ALLOWED_ORIGINS = {_normalize_origin(o) for o in _cors_origins}


# Phase 3: cap the number of concurrent WebSocket connections a single user may
# hold, so one client (or a bug / abuse) can't open unbounded streams.
#
# Section F: the cap is now CLUSTER-WIDE via per-socket leases in Redis — a
# sorted set per user (member = socket lease id, score = expiry ms) that the
# socket's ping loop renews. A crashed process's sockets simply expire. The
# in-process counter below is kept as the fallback when Redis is unreachable
# (and is what the synchronous helpers / tests exercise).
_WS_MAX_PER_USER = int(getattr(settings, "WS_MAX_PER_USER", 20) or 20)
_WS_LEASE_TTL_SEC = int(getattr(settings, "WS_LEASE_TTL_SEC", 90) or 90)
_WS_LEASE_PREFIX = "ws:leases:"
_ws_user_conn_counts: dict[str, int] = {}

# KEYS[1]=zset ARGV[1]=now_ms ARGV[2]=ttl_ms ARGV[3]=max ARGV[4]=member -> 1|0
_WS_LEASE_ACQUIRE_LUA = """
redis.call('zremrangebyscore', KEYS[1], '-inf', ARGV[1])
if redis.call('zcard', KEYS[1]) >= tonumber(ARGV[3]) then
  return 0
end
redis.call('zadd', KEYS[1], tonumber(ARGV[1]) + tonumber(ARGV[2]), ARGV[4])
redis.call('pexpire', KEYS[1], ARGV[2])
return 1
"""

# Renew only an existing lease (XX) and keep the key alive.
_WS_LEASE_RENEW_LUA = """
local n = redis.call('zadd', KEYS[1], 'XX', 'CH', tonumber(ARGV[1]) + tonumber(ARGV[2]), ARGV[3])
if redis.call('zscore', KEYS[1], ARGV[3]) then
  redis.call('pexpire', KEYS[1], ARGV[2])
  return 1
end
return 0
"""


def _ws_try_acquire(user_id: str | None) -> bool:
    """Process-local cap (Redis-down fallback)."""
    if not user_id:
        return True  # anonymous streams are already tightly scoped
    n = _ws_user_conn_counts.get(user_id, 0)
    if n >= _WS_MAX_PER_USER:
        return False
    _ws_user_conn_counts[user_id] = n + 1
    return True


def _ws_release(user_id: str | None) -> None:
    if not user_id:
        return
    n = _ws_user_conn_counts.get(user_id, 0) - 1
    if n <= 0:
        _ws_user_conn_counts.pop(user_id, None)
    else:
        _ws_user_conn_counts[user_id] = n


async def _ws_lease_acquire(user_id: str | None) -> tuple[bool, tuple | None]:
    """Acquire a connection slot. Returns (ok, lease). Lease kinds:
    ("redis", member) cluster-wide, ("local", None) Redis-down fallback,
    None for anonymous sockets (never capped)."""
    if not user_id:
        return True, None
    member = uuid.uuid4().hex
    try:
        ok = await redis_client.eval(
            _WS_LEASE_ACQUIRE_LUA, 1, f"{_WS_LEASE_PREFIX}{user_id}",
            int(time.time() * 1000), _WS_LEASE_TTL_SEC * 1000, _WS_MAX_PER_USER, member,
        )
        return (True, ("redis", member)) if int(ok or 0) == 1 else (False, None)
    except Exception as exc:
        logger.debug("ws lease acquire: redis unavailable (%s) — local cap", exc)
        if _ws_try_acquire(user_id):
            return True, ("local", None)
        return False, None


async def _ws_lease_renew(user_id: str | None, lease: tuple | None) -> None:
    if not user_id or not lease or lease[0] != "redis":
        return
    try:
        await redis_client.eval(
            _WS_LEASE_RENEW_LUA, 1, f"{_WS_LEASE_PREFIX}{user_id}",
            int(time.time() * 1000), _WS_LEASE_TTL_SEC * 1000, lease[1],
        )
    except Exception:
        pass


async def _ws_lease_release(user_id: str | None, lease: tuple | None) -> None:
    if not user_id or not lease:
        return
    if lease[0] == "local":
        _ws_release(user_id)
        return
    try:
        await redis_client.zrem(f"{_WS_LEASE_PREFIX}{user_id}", lease[1])
    except Exception:
        pass  # expires on its own within the lease TTL


def _check_ws_origin(websocket: WebSocket) -> bool:
    """Reject WebSocket handshakes whose Origin header isn't on our
    allow-list. Browsers send cookies on cross-origin WS handshakes
    regardless of SameSite, so a malicious page could otherwise open
    a credentialed WS and stream the user's events. Audit M2.

    Non-browser callers (no Origin header) are allowed through — they
    still have to present a valid token in the next step. CORS allow-list
    is empty in dev → also allowed through so localhost flows still work.

    Matching is case-insensitive, ignores trailing slash, and treats
    default ports (443 for https, 80 for http) as equivalent to no port.
    Rejections are logged at WARNING so we can spot a misconfigured
    nginx / front-door that strips or mangles the Origin header.
    """
    raw_origin = websocket.headers.get("origin") or ""
    if not raw_origin.strip():
        return True
    if not _NORMALIZED_ALLOWED_ORIGINS:
        return True
    normalized = _normalize_origin(raw_origin)
    if normalized in _NORMALIZED_ALLOWED_ORIGINS:
        return True
    logger.warning(
        "WS handshake rejected — Origin %r not in allow-list %s",
        raw_origin,
        sorted(_NORMALIZED_ALLOWED_ORIGINS),
    )
    return False


# ── Per-user display spread ─────────────────────────────────────────
# The broadcast tick stream is shared by every client, so user-scope
# spread_configs rows can't be baked into it by market-data. Instead the
# gateway rewrites ticks per-connection here, so the user SEES the same
# spread their fills use (USER_SPREAD_AT_EXECUTION).

_USER_SPREAD_RELOAD_SEC = 30.0


async def _load_user_spread_overrides(
    user_id: str,
    trading_account_id: str | None = None,
) -> dict[str, tuple[Decimal, str, Decimal, int]]:
    """symbol -> (spread_value, spread_type, pip_size, digits) for the trader's
    EFFECTIVE spread, so the live /ws/prices quote matches what a fill would use.

    Resolves the same priority chain as resolve_spread_config's user+tier layers
    (so an admin per-tier / per-user spread edit shows LIVE on the stream, not
    only at execution):
      1. user + this instrument   (account-pinned row beats user-wide)
      2. user + blanket           (account-pinned beats user-wide)
      3. account_group + this instrument   (tier)
      4. account_group + blanket           (tier)
    Instrument / segment / default spread is already baked into the broadcast
    tick by market-data, so it needs no override here — those levels flow through
    unchanged and reflect live via market-data's own pub/sub reload."""
    try:
        uid = UUID(str(user_id))
    except (ValueError, TypeError):
        return {}
    acct_uuid: UUID | None = None
    if trading_account_id:
        try:
            acct_uuid = UUID(str(trading_account_id))
        except (ValueError, TypeError):
            acct_uuid = None
    out: dict[str, tuple[Decimal, str, Decimal, int]] = {}
    try:
        async with AsyncSessionLocal() as db:
            group_id: UUID | None = None
            if acct_uuid is not None:
                # Never let a client claim someone else's account context.
                row = (
                    await db.execute(
                        select(TradingAccount.account_group_id, TradingAccount.user_id)
                        .where(TradingAccount.id == acct_uuid)
                    )
                ).first()
                if row is None or row[1] != uid:
                    acct_uuid = None
                else:
                    group_id = row[0]
            if group_id is None:
                # No pinned account (or not owned) — use the tier of the user's
                # oldest live account so the per-tier spread still applies.
                group_id = (
                    await db.execute(
                        select(TradingAccount.account_group_id).where(
                            TradingAccount.user_id == uid,
                            TradingAccount.is_demo == False,  # noqa: E712
                        ).order_by(TradingAccount.created_at.asc()).limit(1)
                    )
                ).scalar_one_or_none()

            # ── Config-based per-symbol spread (user + tier priority chain) ──
            conds = [
                and_(func.lower(SpreadConfig.scope) == "user", SpreadConfig.user_id == uid)
            ]
            if group_id is not None:
                conds.append(
                    and_(func.lower(SpreadConfig.scope) == "account_group",
                         SpreadConfig.account_group_id == group_id)
                )
            rows = (
                await db.execute(
                    select(SpreadConfig).where(
                        SpreadConfig.is_enabled == True,  # noqa: E712
                        or_(*conds),
                    )
                )
            ).scalars().all()

            # Active instruments (pip/digits) — loaded unconditionally because the
            # per-position override path below needs them even when the user has
            # no config spread rows at all.
            insts = (
                await db.execute(select(Instrument).where(Instrument.is_active == True))  # noqa: E712
            ).scalars().all()

            if rows:
                # Resolve the four candidate slots. rank encodes account-pinned >
                # user-wide within the user scope; user always beats group
                # (handled by the per-instrument fallback order below).
                user_inst: dict = {}          # instrument_id -> (val, type, rank)
                user_blanket: tuple | None = None
                group_inst: dict = {}         # instrument_id -> (val, type)
                group_blanket: tuple | None = None
                for cfg in rows:
                    val = Decimal(str(cfg.value or 0))
                    if val <= 0:
                        continue
                    st = (cfg.spread_type or "pips").lower()
                    scope = (cfg.scope or "").lower()
                    if scope == "user":
                        is_pinned = cfg.trading_account_id is not None
                        if is_pinned and (acct_uuid is None or cfg.trading_account_id != acct_uuid):
                            continue  # pinned to a different account — ignore
                        rank = 2 if is_pinned else 1
                        if cfg.instrument_id is None:
                            if user_blanket is None or rank > user_blanket[2]:
                                user_blanket = (val, st, rank)
                        else:
                            ex = user_inst.get(cfg.instrument_id)
                            if ex is None or rank > ex[2]:
                                user_inst[cfg.instrument_id] = (val, st, rank)
                    elif scope == "account_group":
                        if cfg.instrument_id is None:
                            if group_blanket is None:
                                group_blanket = (val, st)
                        else:
                            group_inst.setdefault(cfg.instrument_id, (val, st))

                for inst in insts:
                    sym = (inst.symbol or "").strip().upper()
                    if not sym:
                        continue
                    # Priority: user+inst → user+blanket → group+inst → group+blanket.
                    eff = (
                        user_inst.get(inst.id)
                        or user_blanket
                        or group_inst.get(inst.id)
                        or group_blanket
                    )
                    if eff is None:
                        continue
                    pip = Decimal(str(inst.pip_size or "0.0001"))
                    digits = int(inst.digits or 5)
                    out[sym] = (eff[0], eff[1], pip, digits)

            # ── Per-position spread override (TEMPORARY, highest priority) ──
            # An admin can set a spread on a RUNNING trade. While that position is
            # OPEN it drives THIS user's live quote for that instrument (price +
            # chart + P&L), above any config spread. The moment the position
            # closes it is no longer open, so it drops out here and the config
            # spreads resume — it never permanently overrides the account-group /
            # instrument / user config. (Stop-out / SL/TP are mid-based, so this
            # override changes what the user SEES/realises, never force-closes.)
            if acct_uuid is not None:
                acct_ids = [acct_uuid]
            else:
                acct_ids = (
                    await db.execute(
                        select(TradingAccount.id).where(TradingAccount.user_id == uid)
                    )
                ).scalars().all()
            if acct_ids:
                inst_by_id = {i.id: i for i in insts}
                ov_rows = (
                    await db.execute(
                        select(
                            Position.instrument_id,
                            Position.spread_override,
                            Position.spread_override_type,
                        ).where(
                            Position.status == "open",
                            Position.spread_override.isnot(None),
                            Position.account_id.in_(acct_ids),
                        ).order_by(Position.created_at.asc())  # latest override wins
                    )
                ).all()
                for inst_id, ov_val, ov_type in ov_rows:
                    inst = inst_by_id.get(inst_id)
                    if inst is None:
                        continue
                    try:
                        v = Decimal(str(ov_val))
                    except (ValueError, TypeError):
                        continue
                    if v < 0:
                        continue
                    sym = (inst.symbol or "").strip().upper()
                    if not sym:
                        continue
                    pip = Decimal(str(inst.pip_size or "0.0001"))
                    digits = int(inst.digits or 5)
                    out[sym] = (v, (ov_type or "pips").lower(), pip, digits)
    except Exception as exc:
        logger.warning("user spread override load failed for %s: %s", user_id, exc)
    return out


def _rewrite_tick_with_spread(raw, overrides: dict) -> str:
    """Re-center bid/ask around the broadcast mid using the user's spread.
    Any parse hiccup returns the tick unchanged — never break the stream."""
    try:
        tick = json.loads(raw)
        sym = str(tick.get("symbol") or "").strip().upper()
        p = overrides.get(sym)
        if not p:
            return raw
        sv, st, pip, digits = p
        bid = float(tick["bid"])
        ask = float(tick["ask"])
        b, a = symmetric_quote_from_mid(
            Decimal(str((bid + ask) / 2.0)), sv, st, pip, digits, Decimal("0"),
        )
        tick["bid"] = float(b)
        tick["ask"] = float(a)
        tick["spread"] = round(float(a) - float(b), 8)
        return json.dumps(tick)
    except Exception:
        return raw


# ── Section F: WebSocket hub plumbing ───────────────────────────────────
# Every socket used to own a Redis pub/sub connection and busy-poll it
# (get_message(timeout) + receive_text(timeout=0.001) + sleep(0.01) loops).
# Now each process has ONE subscriber (packages.common.src.pubsub_hub) that
# parses every message once and pushes it into per-socket buffers; each socket
# runs a sender task (waits on an Event, coalesces, sends, pings) and a
# receiver task (control messages). Message formats and close codes are
# unchanged; a client that can't keep up is closed with 1013 (Try Again Later).

_WS_FLUSH_INTERVAL = 0.05          # ~20 fps coalesced flush (as before)
_WS_PING_INTERVAL = 30.0           # {"type":"ping"} cadence (as before)
_WS_SLOW_SEND_SEC = 10.0           # one flush taking longer => slow consumer
_WS_SEND_QUEUE_MAX = int(getattr(settings, "WS_SEND_QUEUE_MAX", 1000) or 1000)
_WS_CLOSE_SLOW = 1013


class _SlowConsumer(Exception):
    pass


async def _close_quietly(websocket: WebSocket, code: int, reason: str = "") -> None:
    with contextlib.suppress(Exception):
        await websocket.close(code=code, reason=reason)


async def _wait_event(event: asyncio.Event, timeout: float) -> None:
    if event.is_set():
        return
    with contextlib.suppress(asyncio.TimeoutError):
        await asyncio.wait_for(event.wait(), timeout=max(0.0, timeout))


async def _send_all(websocket: WebSocket, payloads) -> None:
    """Send a batch; a batch that can't drain within _WS_SLOW_SEND_SEC marks
    the client as a slow consumer."""
    async def _go():
        for p in payloads:
            await websocket.send_text(p)
    try:
        await asyncio.wait_for(_go(), timeout=_WS_SLOW_SEND_SEC)
    except asyncio.TimeoutError as exc:
        raise _SlowConsumer() from exc


async def _receive_texts(websocket: WebSocket):
    """Yield inbound text frames until the client disconnects."""
    while True:
        message = await websocket.receive()
        if message.get("type") == "websocket.disconnect":
            return
        txt = message.get("text")
        if txt is not None:
            yield txt


async def _run_socket(websocket: WebSocket, sender, receiver) -> None:
    """Run sender + receiver until either ends; then cancel the other."""
    send_task = asyncio.create_task(sender())
    recv_task = asyncio.create_task(receiver())
    try:
        done, pending = await asyncio.wait(
            {send_task, recv_task}, return_when=asyncio.FIRST_COMPLETED,
        )
    except asyncio.CancelledError:
        done, pending = set(), {send_task, recv_task}
        raise
    finally:
        for t in pending:
            t.cancel()
        for t in pending:
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await t
    for t in done:
        if t.cancelled():
            continue
        exc = t.exception()
        if isinstance(exc, _SlowConsumer):
            logger.info("WS slow consumer closed (1013)")
            await _close_quietly(websocket, _WS_CLOSE_SLOW, "Slow consumer")
        elif exc is not None and not isinstance(exc, WebSocketDisconnect):
            logger.debug("WS stream ended: %r", exc)


class _PriceSocketState:
    __slots__ = ("pending", "event", "reload_needed", "active_account_id")

    def __init__(self) -> None:
        self.pending: dict[str, str] = {}   # symbol -> latest raw payload
        self.event = asyncio.Event()
        self.reload_needed = False
        self.active_account_id: str | None = None


def _price_tick_for_client(raw: str, sym: str, overrides: dict) -> str:
    """Apply the per-user spread overlay only for symbols that have one —
    everything else is forwarded as the exact broadcast bytes (no re-parse)."""
    if overrides and sym.strip().upper() in overrides:
        return _rewrite_tick_with_spread(raw, overrides)
    return raw


@app.websocket("/ws/prices")
async def price_stream(websocket: WebSocket, token: str | None = Query(default=None)):
    if not _check_ws_origin(websocket):
        await websocket.close(code=4003, reason="Origin not allowed")
        return
    user_id: str | None = None
    effective = _ws_token_from_websocket(websocket, token)
    if effective:
        user = await _verify_ws_token(effective)
        if not user:
            await websocket.close(code=4001, reason="Invalid token")
            return
        user_id = str(user.get("user_id") or "") or None

    ok, lease = await _ws_lease_acquire(user_id)
    if not ok:
        await websocket.close(code=4008, reason="Too many concurrent connections")
        return
    await websocket.accept()

    state = _PriceSocketState()

    def _on_message(channel, raw, parsed):
        if channel == CONFIG_INSTRUMENTS_RELOAD_CHANNEL:
            # Admin changed spread/instrument config — reload overrides now
            # (pub/sub), not on the 30 s poll.
            state.reload_needed = True
            state.event.set()
            return
        if parsed is None:
            return
        sym = str(parsed.get("symbol") or "")
        if sym:
            state.pending[sym] = raw
            state.event.set()

    sub = pubsub_hub.subscribe(
        (PriceChannel.PRICE_CHANNEL, CONFIG_INSTRUMENTS_RELOAD_CHANNEL), _on_message,
    )

    # Per-user display spread (empty dict = pass-through fast path). The
    # client can pin the context to one trading account via a
    # {"action":"set_account","account_id":...} control message so
    # account-specific overrides apply to the active account only.
    overrides: dict = await _load_user_spread_overrides(user_id) if user_id else {}

    async def sender():
        nonlocal overrides
        loop = asyncio.get_event_loop()
        now = loop.time()
        last_ping = now
        last_flush = now - _WS_FLUSH_INTERVAL
        last_override_reload = now
        while True:
            now = loop.time()
            deadline = last_ping + _WS_PING_INTERVAL
            if user_id:
                deadline = min(deadline, last_override_reload + _USER_SPREAD_RELOAD_SEC)
            await _wait_event(state.event, deadline - now)
            # Coalesce: at most one flush per _WS_FLUSH_INTERVAL; ticks that
            # arrive meanwhile overwrite older ones per symbol.
            since = loop.time() - last_flush
            if state.pending and since < _WS_FLUSH_INTERVAL:
                await asyncio.sleep(_WS_FLUSH_INTERVAL - since)
            state.event.clear()

            if state.reload_needed and user_id:
                state.reload_needed = False
                overrides = await _load_user_spread_overrides(user_id, state.active_account_id)
                last_override_reload = loop.time()

            if state.pending:
                batch, state.pending = state.pending, {}
                await _send_all(
                    websocket,
                    [_price_tick_for_client(raw, sym, overrides) for sym, raw in batch.items()],
                )
                last_flush = loop.time()

            now = loop.time()
            if now - last_ping >= _WS_PING_INTERVAL:
                await websocket.send_json({"type": "ping"})
                await _ws_lease_renew(user_id, lease)
                last_ping = now
            # Pick up admin edits without forcing a reconnect.
            if user_id and now - last_override_reload >= _USER_SPREAD_RELOAD_SEC:
                overrides = await _load_user_spread_overrides(user_id, state.active_account_id)
                last_override_reload = loop.time()

    async def receiver():
        async for raw in _receive_texts(websocket):
            if not user_id:
                continue
            try:
                ctrl = json.loads(raw)
            except (ValueError, TypeError):
                ctrl = None
            if isinstance(ctrl, dict) and ctrl.get("action") == "set_account":
                acct = str(ctrl.get("account_id") or "") or None
                if acct != state.active_account_id:
                    state.active_account_id = acct
                    state.reload_needed = True
                    state.event.set()

    try:
        await _run_socket(websocket, sender, receiver)
    finally:
        sub.close()
        await _ws_lease_release(user_id, lease)


# TradingView resolution string → aggregator timeframe name. Mirrors
# instruments._TV_RESOLUTION_TO_TF; kept local so the WS layer has no import
# coupling to the REST router.
_BARS_RES_TO_TF = {
    "1": "1m", "5": "5m", "15": "15m", "30": "30m",
    "60": "1h", "240": "4h", "1D": "1d", "D": "1d", "1d": "1d",
}


@app.websocket("/ws/bars")
async def bars_stream(websocket: WebSocket, token: str | None = Query(default=None)):
    """Live OHLCV bar stream for the TradingView datafeed's subscribeBars.

    Protocol: client sends {type:"subscribe"|"unsubscribe", symbol, resolution};
    the process-wide hub carries Redis `bars:updates` and this socket relays only
    the bar messages whose (symbol, timeframe) matches an active client
    subscription. A new bar `time` = the previous candle closed; the same `time`
    redrawn = the live candle extending. Bars are public market data, so auth
    mirrors /ws/prices (validated only if a token is supplied)."""
    if not _check_ws_origin(websocket):
        await websocket.close(code=4003, reason="Origin not allowed")
        return
    user_id: str | None = None
    effective = _ws_token_from_websocket(websocket, token)
    if effective:
        user = await _verify_ws_token(effective)
        if not user:
            await websocket.close(code=4001, reason="Invalid token")
            return
        user_id = str(user.get("user_id") or "") or None

    ok, lease = await _ws_lease_acquire(user_id)
    if not ok:
        await websocket.close(code=4008, reason="Too many concurrent connections")
        return
    await websocket.accept()

    # Active (SYMBOL, tf) filters for THIS client.
    subs: set[tuple[str, str]] = set()
    # Newest bar per (symbol, tf) for the forming candle — with ONE exception:
    # a bar flagged closed=true is final candle data and must never be
    # coalesced away by the next period's forming bar, so it goes to `urgent`
    # and is flushed at the next wake.
    pending: dict[tuple[str, str], str] = {}
    urgent: collections.deque = collections.deque()
    event = asyncio.Event()
    overflow = {"hit": False}

    def _on_bar(_channel, raw, bar):
        if not subs or bar is None:
            return
        key = (str(bar.get("symbol") or "").upper(), str(bar.get("timeframe") or ""))
        if key not in subs:
            return
        prev = pending.get(key)
        if prev is not None and '"closed": true' in prev:
            if len(urgent) >= _WS_SEND_QUEUE_MAX:
                overflow["hit"] = True
            else:
                urgent.append(prev)
        pending[key] = raw
        event.set()

    sub = pubsub_hub.subscribe(BARS_UPDATES_CHANNEL, _on_bar)

    async def sender():
        nonlocal pending
        loop = asyncio.get_event_loop()
        now = loop.time()
        last_ping = now
        last_flush = now - _WS_FLUSH_INTERVAL
        while True:
            await _wait_event(event, last_ping + _WS_PING_INTERVAL - loop.time())
            if overflow["hit"]:
                raise _SlowConsumer()
            if urgent:
                batch_u = list(urgent)
                urgent.clear()
                await _send_all(websocket, batch_u)
            since = loop.time() - last_flush
            if pending and since < _WS_FLUSH_INTERVAL:
                await asyncio.sleep(_WS_FLUSH_INTERVAL - since)
                if urgent:
                    batch_u = list(urgent)
                    urgent.clear()
                    await _send_all(websocket, batch_u)
            event.clear()
            if pending:
                batch, pending = pending, {}
                await _send_all(websocket, list(batch.values()))
                last_flush = loop.time()
            now = loop.time()
            if now - last_ping >= _WS_PING_INTERVAL:
                await websocket.send_json({"type": "ping"})
                await _ws_lease_renew(user_id, lease)
                last_ping = now

    async def receiver():
        async for raw in _receive_texts(websocket):
            try:
                data = json.loads(raw)
            except (ValueError, TypeError):
                data = None
            if not isinstance(data, dict):
                continue
            mtype = data.get("type")
            if mtype in ("subscribe", "unsubscribe"):
                sym = str(data.get("symbol") or "").strip().upper()
                res = str(data.get("resolution") or "").strip()
                tf = _BARS_RES_TO_TF.get(res) or _BARS_RES_TO_TF.get(res.upper())
                if sym and tf:
                    if mtype == "subscribe":
                        subs.add((sym, tf))
                    else:
                        subs.discard((sym, tf))

    try:
        await _run_socket(websocket, sender, receiver)
    finally:
        sub.close()
        await _ws_lease_release(user_id, lease)


@app.websocket("/ws/algo/prices")
async def algo_prices_stream(websocket: WebSocket):
    """Live tick stream for external algo bots — first-message auth via
    X-Api-Key + X-Api-Secret (see algo_market_data.algo_prices_ws)."""
    await algo_market_data.algo_prices_ws(websocket)


class _QueueSocketState:
    """Ordered, bounded outbound queue (trade / admin events must not be
    coalesced). Overflow => slow consumer => 1013."""
    __slots__ = ("queue", "event", "overflow")

    def __init__(self) -> None:
        self.queue: collections.deque = collections.deque()
        self.event = asyncio.Event()
        self.overflow = False

    def push(self, payload: str) -> None:
        if len(self.queue) >= _WS_SEND_QUEUE_MAX:
            self.overflow = True
        else:
            self.queue.append(payload)
        self.event.set()


async def _queue_sender(websocket: WebSocket, state: _QueueSocketState, user_id, lease) -> None:
    loop = asyncio.get_event_loop()
    last_ping = loop.time()
    while True:
        await _wait_event(state.event, last_ping + _WS_PING_INTERVAL - loop.time())
        state.event.clear()
        if state.overflow:
            raise _SlowConsumer()
        if state.queue:
            batch = list(state.queue)
            state.queue.clear()
            await _send_all(websocket, batch)
        now = loop.time()
        if now - last_ping >= _WS_PING_INTERVAL:
            await websocket.send_json({"type": "ping"})
            await _ws_lease_renew(user_id, lease)
            last_ping = now


@app.websocket("/ws/trades/{account_id}")
async def trade_stream(websocket: WebSocket, account_id: str, token: str | None = Query(default=None)):
    if not _check_ws_origin(websocket):
        await websocket.close(code=4003, reason="Origin not allowed")
        return
    effective = _ws_token_from_websocket(websocket, token)
    user = await _verify_ws_token(effective)
    if not user:
        await websocket.close(code=4001, reason="Invalid token")
        return

    try:
        acct_uuid = UUID(account_id)
    except (ValueError, TypeError):
        await websocket.close(code=4003, reason="Account not found or access denied")
        return
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TradingAccount).where(
                TradingAccount.id == acct_uuid,
                TradingAccount.user_id == user["user_id"],
            )
        )
        if not result.scalar_one_or_none():
            await websocket.close(code=4003, reason="Account not found or access denied")
            return

    _uid = str(user.get("user_id") or "") or None
    ok, lease = await _ws_lease_acquire(_uid)
    if not ok:
        await websocket.close(code=4008, reason="Too many concurrent connections")
        return
    await websocket.accept()
    manager = websocket_manager.ConnectionManager()
    await manager.connect(account_id, websocket)

    state = _QueueSocketState()
    channel = f"account:{account_id}"
    # Dynamic per-account SUBSCRIBE on the shared connection (ref-counted).
    sub = pubsub_hub.subscribe(channel, lambda _c, raw, _p: state.push(raw))

    async def receiver():
        async for ws_message in _receive_texts(websocket):
            try:
                data = json.loads(ws_message)
            except (ValueError, TypeError):
                continue
            if not isinstance(data, dict):
                continue
            mtype = data.get("type")
            if mtype == "pong":
                continue
            if mtype == "ping":
                # Reply on THIS socket (through its own sender, so all writes
                # stay on one task). Same {"type":"pong"} payload as before.
                state.push(json.dumps({"type": "pong"}))
            # "subscribe" and anything else: no-op (as before).

    try:
        await _run_socket(websocket, lambda: _queue_sender(websocket, state, _uid, lease), receiver)
    finally:
        sub.close()
        if manager._connections.get(account_id) is websocket:
            manager.disconnect(account_id)
        await _ws_lease_release(_uid, lease)


@app.websocket("/ws/admin")
async def admin_stream(websocket: WebSocket, token: str | None = Query(default=None)):
    if not _check_ws_origin(websocket):
        await websocket.close(code=4003, reason="Origin not allowed")
        return
    # Cookie-first (audit H4) so the admin JWT never ends up in nginx
    # access logs or browser history the way ?token= did. Query string
    # stays as a last-resort fallback for non-browser clients. Decode
    # uses ADMIN_JWT_SECRET — a trader token cannot pass this check
    # even if JWT_SECRET == ADMIN_JWT_SECRET in some envs (the type
    # claim still has to be "admin").
    effective = _admin_ws_token(websocket, token)
    admin = _verify_admin_ws_token(effective)
    if not admin or admin["role"] not in ("admin", "super_admin"):
        await websocket.close(code=4003, reason="Admin access required")
        return

    await websocket.accept()
    state = _QueueSocketState()

    def _on_admin(channel, raw, _parsed):
        state.push(json.dumps({"channel": channel, "data": raw}))

    sub = pubsub_hub.subscribe(("admin:trades", "admin:deposits", "admin:alerts"), _on_admin)

    async def receiver():
        async for _ in _receive_texts(websocket):
            pass  # admin stream is push-only (inbound frames ignored, as before)

    try:
        await _run_socket(websocket, lambda: _queue_sender(websocket, state, None, None), receiver)
    finally:
        sub.close()
