"""RMS Risk Dashboard (Module 1) — executive risk & financial summary.

Read-only aggregation for the Risk Manager. **Purely additive**: this
service does not mutate anything and reuses the existing, already-vetted
services (`analytics_service`, `dashboard_service`, `trade_risk_service`)
so its numbers agree with the rest of the admin panel — plus two focused
live-aggregate queries and the risk-engine's Redis `exposure:summary`.

Sources per card:
  * Live account/position aggregates (equity, margin, floating P/L, lots,
    A/B-book notional)          -> direct SQL over trading_accounts/positions
  * Daily revenue (brokerage/spread/swap/commission) -> analytics_service
  * Daily deposits / withdrawals -> dashboard_service
  * Margin-call band / stop-out / at-risk counts     -> trade_risk_service
  * Per-instrument exposure     -> analytics_service.get_exposure
  * Net / broker-directional exposure value (USD)     -> Redis exposure:summary

Notes / honest limitations (MVP):
  * `online_traders` is approximated as distinct users holding at least one
    open position — the platform has no live presence/session tracking yet.
    Wire a real signal (WS connections) in a later phase.
  * `daily_spread_revenue` is 0 until spread is stored separately (it is
    currently baked into the fill price — same limitation as the analytics
    page).
"""
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError, DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.redis_client import redis_client
from packages.common.src.admin_schemas import RmsRiskOverview
from services import analytics_service, dashboard_service, trade_risk_service

_log = logging.getLogger("uvicorn.error")


async def _account_aggregates(db: AsyncSession) -> dict:
    """Platform-wide live sums off trading_accounts (risk-engine keeps these
    fresh ~1s). Floating P/L is derived as equity - balance - credit, which is
    the account's unrealised P/L. B-book floating is split via users.book_type."""
    sql = text(
        """
        SELECT
            count(*) FILTER (WHERE ta.is_active = true)              AS active_accounts,
            coalesce(sum(ta.equity), 0)                              AS total_equity,
            coalesce(sum(ta.margin_used), 0)                         AS total_margin_used,
            coalesce(sum(ta.free_margin), 0)                         AS total_free_margin,
            coalesce(sum(ta.equity - ta.balance - ta.credit), 0)     AS total_floating_pnl,
            coalesce(sum(ta.equity - ta.balance - ta.credit)
                     FILTER (WHERE u.book_type = 'B' OR u.book_type IS NULL), 0) AS b_book_floating
        FROM trading_accounts ta
        JOIN users u ON u.id = ta.user_id
        WHERE ta.is_demo = false
        """
    )
    try:
        r = (await db.execute(sql)).first()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("rms account_aggregates failed: %s", exc)
        return {}
    if r is None:
        return {}
    m = r._mapping
    return {
        "active_accounts": int(m["active_accounts"] or 0),
        "total_equity": float(m["total_equity"] or 0),
        "total_margin_used": float(m["total_margin_used"] or 0),
        "total_free_margin": float(m["total_free_margin"] or 0),
        "total_floating_pnl": float(m["total_floating_pnl"] or 0),
        "b_book_floating": float(m["b_book_floating"] or 0),
    }


async def _position_aggregates(db: AsyncSession) -> dict:
    """Open-position sums: count, lots, distinct online users (proxy), and
    gross notional split by A/B book (lots * contract_size * open_price)."""
    sql = text(
        """
        SELECT
            count(*)                                                 AS open_positions,
            coalesce(sum(p.lots), 0)                                 AS open_lots,
            count(DISTINCT ta.user_id)                               AS online_traders,
            coalesce(sum(CASE WHEN u.book_type = 'A'
                              THEN p.lots * coalesce(i.contract_size, 1) * p.open_price
                              ELSE 0 END), 0)                        AS a_book_notional,
            coalesce(sum(CASE WHEN u.book_type = 'B' OR u.book_type IS NULL
                              THEN p.lots * coalesce(i.contract_size, 1) * p.open_price
                              ELSE 0 END), 0)                        AS b_book_notional
        FROM positions p
        JOIN trading_accounts ta ON ta.id = p.account_id
        JOIN users u ON u.id = ta.user_id
        JOIN instruments i ON i.id = p.instrument_id
        WHERE lower(cast(p.status AS text)) = 'open'
          AND ta.is_demo = false
        """
    )
    try:
        r = (await db.execute(sql)).first()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("rms position_aggregates failed: %s", exc)
        return {}
    if r is None:
        return {}
    m = r._mapping
    return {
        "open_positions": int(m["open_positions"] or 0),
        "open_lots": float(m["open_lots"] or 0),
        "online_traders": int(m["online_traders"] or 0),
        "a_book_exposure": float(m["a_book_notional"] or 0),
        "b_book_exposure": float(m["b_book_notional"] or 0),
    }


async def _stop_outs_today(db: AsyncSession) -> int:
    """Count of positions force-closed by stop-out since UTC midnight."""
    sql = text(
        """
        SELECT count(*) FROM trade_history
        WHERE close_reason = 'stop_out'
          AND closed_at >= date_trunc('day', now() AT TIME ZONE 'utc')
        """
    )
    try:
        return int((await db.execute(sql)).scalar() or 0)
    except (ProgrammingError, DBAPIError):
        await db.rollback()
        return 0


async def _net_exposure_value(db: AsyncSession) -> float:
    """Total gross net-exposure value (USD) from the risk-engine's live
    `exposure:summary` Redis key (net_value already priced per symbol).
    Falls back to 0 if the key is missing/stale."""
    try:
        raw = await redis_client.get("exposure:summary")
        if not raw:
            return 0.0
        data = json.loads(raw)
        total = 0.0
        for sym in data.values():
            if isinstance(sym, dict) and sym.get("net_value") is not None:
                total += abs(float(sym["net_value"]))
        return total
    except Exception as exc:  # noqa: BLE001 — Redis/JSON best-effort, never fail the dashboard
        _log.debug("rms net_exposure read failed: %s", exc)
        return 0.0


async def risk_overview(db: AsyncSession) -> RmsRiskOverview:
    """Assemble the Module-1 executive risk summary from live + reused data."""
    acct = await _account_aggregates(db)
    pos = await _position_aggregates(db)
    stop_outs = await _stop_outs_today(db)
    net_exposure = await _net_exposure_value(db)

    # Reuse vetted services so numbers match the rest of the admin panel.
    analytics = await analytics_service.analytics_dashboard(db)
    stats = await dashboard_service.get_dashboard_stats(db)
    risk = await trade_risk_service.summary(db, window_min=5, min_users=3, lookback_hours=24)
    exposure = await analytics_service.get_exposure(db)

    today = analytics.get("today", {}) if isinstance(analytics, dict) else {}
    stats_d = stats.model_dump() if hasattr(stats, "model_dump") else dict(stats)
    risk_d = risk.model_dump() if hasattr(risk, "model_dump") else dict(risk)

    total_margin_used = acct.get("total_margin_used", 0.0)
    total_equity = acct.get("total_equity", 0.0)
    margin_level = (total_equity / total_margin_used * 100.0) if total_margin_used > 0 else None

    return RmsRiskOverview(
        # accounts / traders
        active_accounts=acct.get("active_accounts", 0),
        online_traders=pos.get("online_traders", 0),
        total_open_positions=pos.get("open_positions", analytics.get("open_positions", 0)),
        total_open_lots=pos.get("open_lots", 0.0),
        # P/L
        total_floating_pnl=acct.get("total_floating_pnl", 0.0),
        broker_net_floating_pnl=-acct.get("b_book_floating", 0.0),
        # daily revenue
        daily_brokerage_revenue=float(today.get("total_revenue", 0) or 0),
        daily_spread_revenue=float(today.get("spread_revenue", 0) or 0),
        daily_swap_revenue=float(today.get("swap_revenue", 0) or 0),
        daily_commission_revenue=float(today.get("commission_revenue", 0) or 0),
        # daily money
        daily_deposits=float(stats_d.get("deposits_today", 0) or 0),
        daily_withdrawals=float(stats_d.get("withdrawals_today", 0) or 0),
        # margin aggregates
        total_margin_used=total_margin_used,
        total_free_margin=acct.get("total_free_margin", 0.0),
        total_equity=total_equity,
        margin_level_pct=margin_level,
        # risk events / at-risk
        accounts_at_risk=int(risk_d.get("accounts_at_risk", 0) or 0),
        margin_calls=int(risk_d.get("warning_trades", 0) or 0) + int(risk_d.get("critical_trades", 0) or 0),
        stop_outs=stop_outs,
        # exposure
        net_exposure=net_exposure,
        a_book_exposure=pos.get("a_book_exposure", 0.0),
        b_book_exposure=pos.get("b_book_exposure", 0.0),
        # thresholds (context)
        stop_out_level=float(risk_d.get("stop_out_level", 50) or 50),
        margin_call_level=float(risk_d.get("margin_call_level", 80) or 80),
        # detail table
        exposure=exposure.get("exposure", []) if isinstance(exposure, dict) else [],
        generated_at=datetime.now(timezone.utc),
    )
