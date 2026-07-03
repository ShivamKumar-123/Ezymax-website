"""FXArtha Gateway — REST + WebSocket API Server."""
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.database import get_db, AsyncSessionLocal
from packages.common.src.redis_client import redis_client, PriceChannel
from packages.common.src.price_cache import price_cache
from packages.common.src.kafka_client import close_producer
from packages.common.src.auth import decode_token, require_onboarded
from packages.common.src.models import TradingAccount
from packages.common.src.instrumentation import init_sentry, add_middleware_stack

from .api import (
    auth, orders, positions, accounts, instruments, deposits, webhooks,
    websocket_manager, social, business, portfolio, profile, support,
    notifications, banners, trading_catalog, followers, lp_receiver,
    share, insurance, rewards, play_zone, staking,
)
from .engines.sltp_engine import sltp_engine
from .engines.copy_engine import copy_engine
from .engines.stats_engine import stats_engine
from .engines.staking_engine import staking_engine
from .engines.play_zone_engine import play_zone_engine
from .engines.overnight_fee_engine import overnight_fee_engine
from .engines.verification_reminder_engine import verification_reminder_engine
from .engines.monthly_statement_engine import monthly_statement_engine
from .engines.chain_verifier_engine import chain_verifier_engine
from .engines.cleanup_engine import cleanup_engine
from .engines.rms_engine import rms_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("gateway")

settings = get_settings()
init_sentry("gateway")

_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
if not _cors_origins:
    _cors_origins = ["http://localhost:3000", "http://localhost:3001"]
_cors_methods = [m.strip() for m in settings.CORS_ALLOW_METHODS.split(",") if m.strip()]
_cors_headers = [h.strip() for h in settings.CORS_ALLOW_HEADERS.split(",") if h.strip()]


async def _backfill_admin_deposit_labels():
    """Relabel historical admin fund-additions so they show under the trader's
    "Deposits" tab instead of vanishing.

    Admin "Add Fund" credits the main wallet with a ledger Transaction only
    (no `deposits` row), so the trader history surfaces them purely by
    Transaction.type. Before commit ba8280b that type was 'adjustment', which
    the frontend maps to a generic adjustment — invisible under the Deposits
    filter. New credits already book type='deposit'; this heals the old rows.

    Predicate is deliberately tight so it can only match admin main-wallet
    fund additions: every other 'adjustment' writer books a NEGATIVE amount
    (deductions), and non-admin ledger rows have no created_by. So
    `type='adjustment' AND account_id IS NULL AND amount > 0 AND created_by
    IS NOT NULL` uniquely identifies a pre-fix admin deposit. Idempotent —
    once relabeled the rows are 'deposit' and no longer match."""
    from sqlalchemy import text
    sql = text(
        """
        UPDATE transactions
        SET type = 'deposit'
        WHERE type = 'adjustment'
          AND account_id IS NULL
          AND created_by IS NOT NULL
          AND amount > 0
        """
    )
    try:
        async with AsyncSessionLocal() as session:
            res = await session.execute(sql)
            await session.commit()
            relabeled = res.rowcount or 0
            if relabeled > 0:
                logger.info(
                    "admin-deposit backfill: relabeled %d historical "
                    "'adjustment' credit(s) to 'deposit'",
                    relabeled,
                )
    except Exception as e:
        logger.warning("admin-deposit label backfill skipped: %s", e)


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _backfill_close_reasons()
    await _backfill_admin_deposit_labels()
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
    await staking_engine.start()
    await play_zone_engine.start()
    await overnight_fee_engine.start()
    await verification_reminder_engine.start()
    await monthly_statement_engine.start()
    await chain_verifier_engine.start()
    await cleanup_engine.start()
    await rms_engine.start()
    yield
    healer_task.cancel()
    try:
        await healer_task
    except asyncio.CancelledError:
        pass
    await rms_engine.stop()
    await cleanup_engine.stop()
    await chain_verifier_engine.stop()
    await monthly_statement_engine.stop()
    await verification_reminder_engine.stop()
    await overnight_fee_engine.stop()
    await play_zone_engine.stop()
    await staking_engine.stop()
    await stats_engine.stop()
    await copy_engine.stop()
    await sltp_engine.stop()
    await price_cache.stop()
    await close_producer()
    await redis_client.close()


app = FastAPI(
    title="FXArtha Gateway",
    version="1.0.0",
    description="Forex CFD B-Book Trading Platform API",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
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
app.include_router(banners.media_router, prefix="/api/v1/banners", tags=["Banners"])
app.include_router(banners.router, prefix="/api/v1/banners", tags=["Banners"])
app.include_router(followers.router, prefix="/api/v1/followers", tags=["Followers"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["Webhooks"])
# Corecen LP price push receiver — HMAC-secured, public (no JWT). Path mirrors
# Corecen's sender (axios POST baseURL + '/api/lp/prices/batch').
app.include_router(lp_receiver.router, prefix="/api/lp", tags=["LP Receiver"])
app.include_router(share.router, prefix="/api/v1", tags=["Share Trade"])
app.include_router(share.public_router, prefix="/api/v1/public", tags=["Public Share"])
app.include_router(insurance.router, prefix="/api/v1/insurance", tags=["Trade Insurance"])
app.include_router(rewards.router, prefix="/api/v1/rewards", tags=["Rewards"])
app.include_router(play_zone.router, prefix="/api/v1/play", tags=["Play Zone"])
app.include_router(staking.router, prefix="/api/v1/staking", tags=["Staking"])


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
    attach cookies. The query path is RETAINED but DEPRECATED; the
    token shows up in nginx access logs and any forwarded telemetry,
    so we emit a warning every time it's used. Once log-monitoring
    confirms no client still uses the fallback, delete it."""
    cookie_name = (get_settings().ACCESS_TOKEN_COOKIE_NAME or "pt_access").strip()
    cookie_token = ws.cookies.get(cookie_name)
    if cookie_token:
        return cookie_token
    if fallback_query_token:
        # Hash a prefix so the warning is identifiable across log entries
        # without echoing the bearer itself back to the logs we're
        # complaining about.
        import hashlib
        token_fp = hashlib.sha256(fallback_query_token.encode()).hexdigest()[:12]
        logger.warning(
            "ws-auth deprecation: client used ?token= query fallback "
            "(no cookie). client=%s path=%s token_fp=%s — migrate to "
            "cookie-based auth before removal",
            ws.client.host if ws.client else "?",
            ws.url.path,
            token_fp,
        )
    return fallback_query_token


@app.websocket("/ws/prices")
async def price_stream(websocket: WebSocket, token: str | None = Query(default=None)):
    effective = _ws_token_from_websocket(websocket, token)
    if effective:
        user = _verify_ws_token(effective)
        if not user:
            await websocket.close(code=4001, reason="Invalid token")
            return

    await websocket.accept()
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(PriceChannel.PRICE_CHANNEL)

    try:
        ping_interval = 30
        last_ping = asyncio.get_event_loop().time()
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
            if message and message["type"] == "message":
                await websocket.send_text(message["data"])

            now = asyncio.get_event_loop().time()
            if now - last_ping >= ping_interval:
                await websocket.send_json({"type": "ping"})
                last_ping = now

            await asyncio.sleep(0.01)
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(PriceChannel.PRICE_CHANNEL)
        await pubsub.close()


@app.websocket("/ws/trades/{account_id}")
async def trade_stream(websocket: WebSocket, account_id: str, token: str | None = Query(default=None)):
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
        await pubsub.unsubscribe(channel)
        await pubsub.close()


@app.websocket("/ws/admin")
async def admin_stream(websocket: WebSocket, token: str = Query()):
    user = _verify_ws_token(token)
    if not user or user["role"] not in ("admin", "super_admin"):
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
