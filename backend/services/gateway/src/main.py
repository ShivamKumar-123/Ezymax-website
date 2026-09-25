"""SwissCresta Gateway — REST + WebSocket API Server."""
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from decimal import Decimal
from uuid import UUID

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.database import get_db, AsyncSessionLocal
from packages.common.src.redis_client import redis_client, PriceChannel, BARS_UPDATES_CHANNEL, CONFIG_INSTRUMENTS_RELOAD_CHANNEL
from packages.common.src.price_cache import price_cache
from packages.common.src.kafka_client import close_producer
from packages.common.src.auth import decode_token, require_onboarded
from packages.common.src.models import TradingAccount, SpreadConfig, Instrument, Position
from packages.common.src.instrument_pricing import symmetric_quote_from_mid
from packages.common.src.instrumentation import init_sentry, add_middleware_stack

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


async def _backfill_close_reasons():
    """Relabel historical trade_history rows where close_price matches the
    position's SL/TP level — those were previously written as 'manual' but
    should now show as 'sl'/'tp' in the UI. Idempotent."""
    from sqlalchemy import text
    sql = text(
        """
        UPDATE trade_history th
        SET close_reason = CASE
            WHEN p.stop_loss IS NOT NULL AND (
                (p.side = 'buy'  AND th.close_price <= p.stop_loss)
             OR (p.side = 'sell' AND th.close_price >= p.stop_loss)
            ) THEN 'sl'
            WHEN p.take_profit IS NOT NULL AND (
                (p.side = 'buy'  AND th.close_price >= p.take_profit)
             OR (p.side = 'sell' AND th.close_price <= p.take_profit)
            ) THEN 'tp'
            ELSE th.close_reason
        END
        FROM positions p
        WHERE th.position_id = p.id
          AND COALESCE(th.close_reason, 'manual') IN ('manual', 'copy_close', 'copy')
          AND (p.stop_loss IS NOT NULL OR p.take_profit IS NOT NULL)
        """
    )
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(sql)
            await session.commit()
    except Exception as e:
        logger.warning("close_reason backfill skipped: %s", e)


# ── Trade-history self-heal ────────────────────────────────────────────
# Defensive safety net: if a Position closes (status='closed', close_price
# set) but no matching trade_history row exists, this task re-creates the
# missing row from the position's data. Catches any close-path that drops
# the TradeHistory write — root cause investigation pending, but the
# user-visible symptom (missing rows in trader history) is auto-resolved
# within 60s without manual SQL intervention.
#
# All values copied verbatim from the existing positions row — nothing
# fabricated. close_reason is computed from the actual close_price vs
# the actual TP/SL on the position, same logic as the existing lazy
# backfill in portfolio_service.trade_history.
async def _heal_missing_trade_history():
    from sqlalchemy import text
    sql = text(
        """
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
        WHERE p.status = 'closed'
          AND p.close_price IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM trade_history th WHERE th.position_id = p.id)
        """
    )
    try:
        async with AsyncSessionLocal() as session:
            res = await session.execute(sql)
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
    """Run _heal_missing_trade_history every 60 seconds for as long as the
    gateway is up. Cheap query (touches only a tiny set of rows where
    Position.status='closed' AND no matching trade_history row), no impact
    on hot path."""
    while True:
        await _heal_missing_trade_history()
        await asyncio.sleep(60)


async def _ensure_pamm_units_column():
    """PAMM share accounting uses NAV-based 'units'. Ensure the column exists
    and seed it for any pre-existing active PAMM allocation as
    units = allocation_amount — that makes NAV start at exactly 1.0, so the
    switch from the old raw-capital model causes ZERO change to current
    shares (then future entries price in at the live NAV). Idempotent: the
    UPDATE only touches rows still at 0, so it's a no-op after the first boot
    and never clobbers units set by new investments. Safe on every start."""
    from sqlalchemy import text
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text(
                "ALTER TABLE investor_allocations "
                "ADD COLUMN IF NOT EXISTS units NUMERIC(28,12) DEFAULT 0"
            ))
            await session.execute(text(
                "UPDATE investor_allocations SET units = allocation_amount "
                "WHERE copy_type = 'pamm' AND status = 'active' "
                "AND COALESCE(units, 0) = 0"
            ))
            await session.commit()
    except Exception as e:
        logger.warning("pamm units column ensure skipped: %s", e)


async def _ensure_push_tokens_table():
    """Device push-token registry for OS-level push notifications (Expo).
    Created at startup so no separate migration is needed — idempotent."""
    from sqlalchemy import text
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text(
                """
                CREATE TABLE IF NOT EXISTS user_push_tokens (
                    token      TEXT PRIMARY KEY,
                    user_id    UUID NOT NULL,
                    platform   TEXT,
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            ))
            await session.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user ON user_push_tokens(user_id)"
            ))
            await session.commit()
    except Exception as e:
        logger.warning("push_tokens table ensure skipped: %s", e)


async def _ensure_ohlc_bars_table():
    """Durable OHLC bar store for the advanced chart — gap-free deep history,
    only-new-data-from-source. Created at startup, idempotent."""
    from packages.common.src.bars_store import ensure_bars_table
    try:
        async with AsyncSessionLocal() as session:
            await ensure_bars_table(session)
    except Exception as e:
        logger.warning("ohlc_bars table ensure skipped: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _backfill_close_reasons()
    await _ensure_pamm_units_column()
    await _ensure_push_tokens_table()
    await _ensure_ohlc_bars_table()
    # Run the self-heal once at startup (catches drift accumulated while
    # gateway was down), then kick off the periodic loop.
    await _heal_missing_trade_history()
    healer_task = asyncio.create_task(_trade_history_healer_loop())
    # In-memory tick cache fed by Redis pub/sub. Must start BEFORE the
    # engines so they hit a warm cache instead of falling through to
    # Redis on first-tick reads (which would defeat the point).
    await price_cache.start()
    await sltp_engine.start()
    await copy_engine.start()
    await stats_engine.start()
    await overnight_fee_engine.start()
    await verification_reminder_engine.start()
    await monthly_statement_engine.start()
    await chain_verifier_engine.start()
    await bars_persist_engine.start()
    await reconcile_engine.start()
    await ai_strategy_engine.start()
    yield
    await ai_strategy_engine.stop()
    healer_task.cancel()
    try:
        await healer_task
    except asyncio.CancelledError:
        pass
    await reconcile_engine.stop()
    await bars_persist_engine.stop()
    await chain_verifier_engine.stop()
    await monthly_statement_engine.stop()
    await verification_reminder_engine.stop()
    await overnight_fee_engine.stop()
    await stats_engine.stop()
    await copy_engine.stop()
    await sltp_engine.stop()
    await price_cache.stop()
    await close_producer()
    await redis_client.close()


# Docs are an opt-in exposure (security audit M6). Previously this was
# "expose unless ENVIRONMENT == 'development' is false", so a staging
# box left at the default value would leak the full OpenAPI spec — every
# endpoint and schema — to the public internet. Now we only mount them
# for explicitly tagged dev/local environments.
_EXPOSE_DOCS = settings.ENVIRONMENT in ("development", "local")
app = FastAPI(
    title="SwissCresta Gateway",
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

def _verify_ws_token(token: str | None) -> dict | None:
    """Decode a JWT for WebSocket auth. Returns payload or None."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        return {"user_id": UUID(payload["sub"]), "role": payload["role"]}
    except Exception:
        return None


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
    cookie_name = (get_settings().ADMIN_COOKIE_NAME or "fx_admin").strip()
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
    default for the scheme. Lets `https://trade.swisscresta.com:443/`
    compare equal to `https://trade.swisscresta.com`."""
    o = raw.strip().rstrip("/").lower()
    if o.startswith("https://") and o.endswith(":443"):
        o = o[:-4]
    elif o.startswith("http://") and o.endswith(":80"):
        o = o[:-3]
    return o


_NORMALIZED_ALLOWED_ORIGINS = {_normalize_origin(o) for o in _cors_origins}


# Phase 3: cap the number of concurrent WebSocket connections a single user may
# hold, so one client (or a bug / abuse) can't open unbounded streams and
# exhaust the worker's sockets/memory. Per-worker in-process counter — good
# enough as a guard-rail; a multi-worker deploy multiplies the cap by worker
# count, which is acceptable for a resource ceiling.
_WS_MAX_PER_USER = 10
_ws_user_conn_counts: dict[str, int] = {}


def _ws_try_acquire(user_id: str | None) -> bool:
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


@app.websocket("/ws/prices")
async def price_stream(websocket: WebSocket, token: str | None = Query(default=None)):
    if not _check_ws_origin(websocket):
        await websocket.close(code=4003, reason="Origin not allowed")
        return
    user_id: str | None = None
    effective = _ws_token_from_websocket(websocket, token)
    if effective:
        user = _verify_ws_token(effective)
        if not user:
            await websocket.close(code=4001, reason="Invalid token")
            return
        user_id = str(user.get("user_id") or "") or None

    if not _ws_try_acquire(user_id):
        await websocket.close(code=4008, reason="Too many concurrent connections")
        return
    await websocket.accept()
    pubsub = redis_client.pubsub()
    # Also subscribe to the config-reload channel so an admin spread edit is
    # reflected on THIS live connection instantly (pub/sub), not on the 30s poll.
    await pubsub.subscribe(PriceChannel.PRICE_CHANNEL, CONFIG_INSTRUMENTS_RELOAD_CHANNEL)

    # Per-user display spread (empty dict = pass-through fast path). The
    # client can pin the context to one trading account via a
    # {"action":"set_account","account_id":...} control message so
    # account-specific overrides apply to the active account only.
    active_account_id: str | None = None
    overrides = await _load_user_spread_overrides(user_id) if user_id else {}
    last_override_reload = asyncio.get_event_loop().time()

    try:
        # ── Drain + coalesce + fixed-rate flush ─────────────────────────
        # The old loop read ONE pubsub message per iteration (plus a 10ms
        # control-message wait), capping forwarding at ~100 msg/s across
        # ALL symbols — a fast feed (crypto book ticks) starved slow ones
        # and everything lagged behind the backlog. Now every wake drains
        # the WHOLE backlog keeping only the newest payload per symbol,
        # and flushes at ~20fps. Perceived latency stays <50ms while
        # bandwidth is bounded no matter how fast the upstream feed gets.
        FLUSH_INTERVAL = 0.05
        ping_interval = 30
        _now = asyncio.get_event_loop().time
        last_ping = _now()
        last_flush = _now()
        pending: dict[str, str] = {}  # symbol -> latest raw payload

        while True:
            # Wait for the first message up to the next flush deadline,
            # then drain everything queued without blocking.
            wait = max(0.005, FLUSH_INTERVAL - (_now() - last_flush))
            config_reloaded = False
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=wait)
            while message:
                if message["type"] == "message":
                    ch = message.get("channel")
                    if isinstance(ch, bytes):
                        ch = ch.decode("utf-8", "ignore")
                    if ch == CONFIG_INSTRUMENTS_RELOAD_CHANNEL:
                        # Admin changed spread/instrument config — reload overrides.
                        config_reloaded = True
                    else:
                        raw_tick = message["data"]
                        try:
                            sym = str(json.loads(raw_tick).get("symbol") or "")
                        except (ValueError, TypeError):
                            sym = ""
                        if sym:
                            pending[sym] = raw_tick
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0)

            if config_reloaded and user_id:
                overrides = await _load_user_spread_overrides(user_id, active_account_id)
                last_override_reload = asyncio.get_event_loop().time()

            now_flush = _now()
            if pending and now_flush - last_flush >= FLUSH_INTERVAL:
                for raw_tick in pending.values():
                    data = _rewrite_tick_with_spread(raw_tick, overrides) if overrides else raw_tick
                    await websocket.send_text(data)
                pending.clear()
                last_flush = now_flush

            # Drain client control messages without blocking the stream.
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.001)
            except asyncio.TimeoutError:
                raw = None
            if raw and user_id:
                try:
                    ctrl = json.loads(raw)
                except (ValueError, TypeError):
                    ctrl = None
                if isinstance(ctrl, dict) and ctrl.get("action") == "set_account":
                    acct = str(ctrl.get("account_id") or "") or None
                    if acct != active_account_id:
                        active_account_id = acct
                        overrides = await _load_user_spread_overrides(user_id, active_account_id)
                        last_override_reload = asyncio.get_event_loop().time()

            now = asyncio.get_event_loop().time()
            if now - last_ping >= ping_interval:
                await websocket.send_json({"type": "ping"})
                last_ping = now

            # Pick up admin edits without forcing a reconnect.
            if user_id and now - last_override_reload >= _USER_SPREAD_RELOAD_SEC:
                overrides = await _load_user_spread_overrides(user_id, active_account_id)
                last_override_reload = now
    except WebSocketDisconnect:
        pass
    finally:
        _ws_release(user_id)
        await pubsub.unsubscribe(PriceChannel.PRICE_CHANNEL, CONFIG_INSTRUMENTS_RELOAD_CHANNEL)
        await pubsub.close()


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
    the server subscribes to Redis `bars:updates` ONCE and relays only the bar
    messages whose (symbol, timeframe) matches an active client subscription.
    A new bar `time` = the previous candle closed; the same `time` redrawn =
    the live candle extending. Bars are public market data, so auth mirrors
    /ws/prices (validated only if a token is supplied)."""
    if not _check_ws_origin(websocket):
        await websocket.close(code=4003, reason="Origin not allowed")
        return
    user_id: str | None = None
    effective = _ws_token_from_websocket(websocket, token)
    if effective:
        user = _verify_ws_token(effective)
        if not user:
            await websocket.close(code=4001, reason="Invalid token")
            return
        user_id = str(user.get("user_id") or "") or None

    if not _ws_try_acquire(user_id):
        await websocket.close(code=4008, reason="Too many concurrent connections")
        return
    await websocket.accept()
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(BARS_UPDATES_CHANNEL)

    # Active (SYMBOL, tf) filters for THIS client.
    subs: set[tuple[str, str]] = set()

    try:
        # Same drain + coalesce + ~20fps flush as /ws/prices: the channel
        # carries a forming-bar update per tick for EVERY symbol, so the
        # old one-message-per-iteration read backlogged badly the moment
        # the feed got fast. Only the newest bar per (symbol, tf) matters
        # for the forming candle — with ONE exception: a bar flagged
        # closed=true is final candle data and must never be coalesced
        # away by the next period's forming bar, so it flushes through
        # immediately.
        FLUSH_INTERVAL = 0.05
        ping_interval = 30
        _now = asyncio.get_event_loop().time
        last_ping = _now()
        last_flush = _now()
        pending: dict[tuple[str, str], str] = {}

        while True:
            # 1) Drain client control messages (subscribe / unsubscribe / pong).
            raw = None
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.001)
            except asyncio.TimeoutError:
                pass
            if raw:
                try:
                    data = json.loads(raw)
                except (ValueError, TypeError):
                    data = None
                if isinstance(data, dict):
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

            # 2) Drain the whole bar backlog, newest per (symbol, tf).
            wait = max(0.005, FLUSH_INTERVAL - (_now() - last_flush))
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=wait)
            while message:
                if message["type"] == "message" and subs:
                    try:
                        bar = json.loads(message["data"])
                        key = (
                            str(bar.get("symbol") or "").upper(),
                            str(bar.get("timeframe") or ""),
                        )
                        if key in subs:
                            prev = pending.get(key)
                            if prev is not None and '"closed": true' in prev:
                                # Never lose a finalised candle to coalescing.
                                await websocket.send_text(prev)
                            pending[key] = message["data"]
                    except (ValueError, TypeError):
                        pass
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0)

            now = _now()
            if pending and now - last_flush >= FLUSH_INTERVAL:
                for payload in pending.values():
                    await websocket.send_text(payload)
                pending.clear()
                last_flush = now

            if now - last_ping >= ping_interval:
                await websocket.send_json({"type": "ping"})
                last_ping = now
    except WebSocketDisconnect:
        pass
    finally:
        _ws_release(user_id)
        await pubsub.unsubscribe(BARS_UPDATES_CHANNEL)
        await pubsub.close()


@app.websocket("/ws/algo/prices")
async def algo_prices_stream(websocket: WebSocket):
    """Live tick stream for external algo bots — first-message auth via
    X-Api-Key + X-Api-Secret (see algo_market_data.algo_prices_ws)."""
    await algo_market_data.algo_prices_ws(websocket)


@app.websocket("/ws/trades/{account_id}")
async def trade_stream(websocket: WebSocket, account_id: str, token: str | None = Query(default=None)):
    if not _check_ws_origin(websocket):
        await websocket.close(code=4003, reason="Origin not allowed")
        return
    effective = _ws_token_from_websocket(websocket, token)
    user = _verify_ws_token(effective)
    if not user:
        await websocket.close(code=4001, reason="Invalid token")
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TradingAccount).where(
                TradingAccount.id == UUID(account_id),
                TradingAccount.user_id == user["user_id"],
            )
        )
        if not result.scalar_one_or_none():
            await websocket.close(code=4003, reason="Account not found or access denied")
            return

    _uid = str(user.get("user_id") or "") or None
    if not _ws_try_acquire(_uid):
        await websocket.close(code=4008, reason="Too many concurrent connections")
        return
    await websocket.accept()
    manager = websocket_manager.ConnectionManager()
    await manager.connect(account_id, websocket)

    pubsub = redis_client.pubsub()
    channel = f"account:{account_id}"
    await pubsub.subscribe(channel)

    try:
        ping_interval = 30
        last_ping = asyncio.get_event_loop().time()
        while True:
            ws_message = None
            try:
                ws_message = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
            except asyncio.TimeoutError:
                pass

            if ws_message:
                data = json.loads(ws_message)
                if data.get("type") == "pong":
                    pass
                else:
                    await manager.handle_message(account_id, data)

            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
            if message and message["type"] == "message":
                await websocket.send_text(message["data"])

            now = asyncio.get_event_loop().time()
            if now - last_ping >= ping_interval:
                await websocket.send_json({"type": "ping"})
                last_ping = now

            await asyncio.sleep(0.01)
    except WebSocketDisconnect:
        manager.disconnect(account_id)
    finally:
        _ws_release(_uid)
        await pubsub.unsubscribe(channel)
        await pubsub.close()


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
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("admin:trades", "admin:deposits", "admin:alerts")

    try:
        ping_interval = 30
        last_ping = asyncio.get_event_loop().time()
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
            if message and message["type"] == "message":
                await websocket.send_text(json.dumps({
                    "channel": message["channel"],
                    "data": message["data"],
                }))

            now = asyncio.get_event_loop().time()
            if now - last_ping >= ping_interval:
                await websocket.send_json({"type": "ping"})
                last_ping = now

            await asyncio.sleep(0.01)
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe("admin:trades", "admin:deposits", "admin:alerts")
        await pubsub.close()
