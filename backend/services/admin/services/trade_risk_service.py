"""Admin Trade-Risk (RMS) service — read-side aggregation over live trades.

Two risk lenses for the broker (B-book) desk:

  1. **At-risk trades** — open positions whose *account* is close to a
     margin call / stop-out. The risk-engine maintains
     ``trading_accounts.margin_level`` live (every ~1s), so we classify
     each open position by its account's margin level into:
       critical  (<= stop_out_level, default 50%)  — about to be force-closed
       warning   (<= margin_call_level, default 80%)
       caution   (<= caution_level, default 150%)
       healthy   (everything else)

  2. **Coordinated trades** — multiple *distinct users* opening the same
     side (buy/sell) on the same instrument inside a short time window.
     A herding / collusion signal: on a B-book, many users piling the
     same direction at the same moment is concentrated directional risk
     for the broker. We bin entries into ``window_min``-minute buckets
     and flag any (instrument, side, bucket) with >= ``min_users``.

Pure reads — no new tables. Thresholds come from ``system_settings``
(falling back to config defaults), matching the risk-engine.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError, DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.admin_schemas import (
    TradeRiskSummary, AtRiskTradeRow, CoordinatedCluster, ClusterUser,
)

_log = logging.getLogger("uvicorn.error")
_settings = get_settings()

DEFAULT_CAUTION_LEVEL = 150.0


async def _thresholds(db: AsyncSession) -> tuple[float, float, float]:
    """(stop_out, margin_call, caution) — from system_settings, else config."""
    stop_out = float(_settings.STOP_OUT_LEVEL)
    margin_call = float(_settings.MARGIN_CALL_LEVEL)
    caution = DEFAULT_CAUTION_LEVEL
    try:
        rows = (await db.execute(text(
            "SELECT key, value FROM system_settings "
            "WHERE key IN ('stop_out_level','margin_call_level','caution_level')"
        ))).all()
        for key, value in rows:
            try:
                v = float(value if not isinstance(value, str) else value.strip('"'))
            except (TypeError, ValueError):
                continue
            if key == "stop_out_level":
                stop_out = v
            elif key == "margin_call_level":
                margin_call = v
            elif key == "caution_level":
                caution = v
    except (ProgrammingError, DBAPIError):
        await db.rollback()
    return stop_out, margin_call, caution


def _bucket(margin_level: float, stop_out: float, margin_call: float, caution: float) -> str:
    if margin_level <= stop_out:
        return "critical"
    if margin_level <= margin_call:
        return "warning"
    if margin_level <= caution:
        return "caution"
    return "healthy"


async def summary(db: AsyncSession, window_min: int, min_users: int, lookback_hours: int) -> TradeRiskSummary:
    stop_out, margin_call, caution = await _thresholds(db)
    sql = text(
        """
        SELECT
            count(*) AS open_trades,
            count(*) FILTER (WHERE ta.margin_used > 0 AND ta.margin_level <= :stop_out) AS critical,
            count(*) FILTER (WHERE ta.margin_used > 0 AND ta.margin_level > :stop_out AND ta.margin_level <= :margin_call) AS warning,
            count(*) FILTER (WHERE ta.margin_used > 0 AND ta.margin_level > :margin_call AND ta.margin_level <= :caution) AS caution,
            count(DISTINCT ta.id) FILTER (WHERE ta.margin_used > 0 AND ta.margin_level <= :margin_call) AS accounts_at_risk
        FROM positions p
        JOIN trading_accounts ta ON ta.id = p.account_id
        WHERE lower(cast(p.status AS text)) = 'open'
        """
    )
    try:
        r = (await db.execute(sql, {"stop_out": stop_out, "margin_call": margin_call, "caution": caution})).first()
    except (ProgrammingError, DBAPIError):
        await db.rollback()
        r = None

    clusters = await coordinated_clusters(db, window_min, min_users, lookback_hours, with_users=False)

    if r is None:
        return TradeRiskSummary(
            stop_out_level=stop_out, margin_call_level=margin_call, caution_level=caution,
            coordinated_clusters=len(clusters),
        )
    crit, warn, caut = int(r[1] or 0), int(r[2] or 0), int(r[3] or 0)
    return TradeRiskSummary(
        open_trades=int(r[0] or 0),
        at_risk_trades=crit + warn,
        critical_trades=crit,
        warning_trades=warn,
        caution_trades=caut,
        accounts_at_risk=int(r[4] or 0),
        coordinated_clusters=len(clusters),
        stop_out_level=stop_out,
        margin_call_level=margin_call,
        caution_level=caution,
    )


async def at_risk_trades(
    db: AsyncSession, page: int, per_page: int, bucket: str | None, include_demo: bool,
) -> dict:
    stop_out, margin_call, caution = await _thresholds(db)

    # Only positions whose account is at or below the caution band qualify
    # as "at risk"; bucket filter narrows further.
    where_extra = ""
    params = {
        "stop_out": stop_out, "margin_call": margin_call, "caution": caution,
        "limit": per_page, "offset": (page - 1) * per_page,
    }
    if not include_demo:
        where_extra += " AND ta.is_demo = false"
    if bucket == "critical":
        where_extra += " AND ta.margin_level <= :stop_out"
    elif bucket == "warning":
        where_extra += " AND ta.margin_level > :stop_out AND ta.margin_level <= :margin_call"
    elif bucket == "caution":
        where_extra += " AND ta.margin_level > :margin_call AND ta.margin_level <= :caution"

    base = f"""
        FROM positions p
        JOIN trading_accounts ta ON ta.id = p.account_id
        JOIN instruments i ON i.id = p.instrument_id
        JOIN users u ON u.id = ta.user_id
        WHERE lower(cast(p.status AS text)) = 'open'
          AND ta.margin_used > 0
          AND ta.margin_level <= :caution
          {where_extra}
    """
    count_sql = text(f"SELECT count(*) {base}")
    rows_sql = text(f"""
        SELECT p.id AS position_id, u.id AS user_id, u.email,
               ta.id AS account_id, ta.account_number, ta.is_demo,
               i.symbol, lower(cast(p.side AS text)) AS side,
               p.lots, p.open_price, p.profit, p.created_at,
               ta.margin_level, ta.equity, ta.margin_used,
               (p.lots * coalesce(i.contract_size, 1) * p.open_price) AS notional
        {base}
        ORDER BY ta.margin_level ASC, notional DESC
        LIMIT :limit OFFSET :offset
    """)

    try:
        total = (await db.execute(count_sql, params)).scalar() or 0
        rows = (await db.execute(rows_sql, params)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("at_risk_trades failed: %s", exc)
        return {"items": [], "total": 0, "page": page, "per_page": per_page,
                "stop_out_level": stop_out, "margin_call_level": margin_call, "caution_level": caution}

    items = []
    for row in rows:
        m = row._mapping
        ml = float(m["margin_level"] or 0)
        items.append(AtRiskTradeRow(
            position_id=str(m["position_id"]),
            user_id=str(m["user_id"]),
            user_email=m["email"],
            account_id=str(m["account_id"]),
            account_number=m["account_number"],
            is_demo=bool(m["is_demo"]),
            symbol=m["symbol"],
            side=m["side"],
            lots=float(m["lots"] or 0),
            open_price=float(m["open_price"] or 0),
            notional=float(m["notional"] or 0),
            profit=float(m["profit"] or 0),
            margin_level=ml,
            equity=float(m["equity"] or 0),
            margin_used=float(m["margin_used"] or 0),
            risk_bucket=_bucket(ml, stop_out, margin_call, caution),
            opened_at=m["created_at"],
        ).model_dump())
    return {"items": items, "total": int(total), "page": page, "per_page": per_page,
            "stop_out_level": stop_out, "margin_call_level": margin_call, "caution_level": caution}


async def coordinated_clusters(
    db: AsyncSession, window_min: int, min_users: int, lookback_hours: int,
    *, with_users: bool = True,
) -> list[CoordinatedCluster]:
    """Same instrument + same side + same time-window opened by >= min_users
    distinct users. Entries binned into window_min-minute buckets."""
    users_select = ", array_agg(DISTINCT u.email) AS emails" if with_users else ""
    sql = text(
        f"""
        SELECT i.symbol,
               lower(cast(p.side AS text)) AS side,
               date_bin(make_interval(mins => :win), p.created_at, TIMESTAMPTZ '2000-01-01 00:00:00+00') AS bucket,
               count(DISTINCT ta.user_id) AS user_count,
               count(*) AS trade_count,
               sum(p.lots) AS total_lots,
               min(p.created_at) AS first_at,
               max(p.created_at) AS last_at
               {users_select}
        FROM positions p
        JOIN trading_accounts ta ON ta.id = p.account_id
        JOIN instruments i ON i.id = p.instrument_id
        JOIN users u ON u.id = ta.user_id
        WHERE p.created_at > now() - make_interval(hours => :lookback)
        GROUP BY i.symbol, lower(cast(p.side AS text)), bucket
        HAVING count(DISTINCT ta.user_id) >= :min_users
        ORDER BY user_count DESC, bucket DESC
        LIMIT 200
        """
    )
    try:
        rows = (await db.execute(sql, {
            "win": window_min, "lookback": lookback_hours, "min_users": min_users,
        })).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("coordinated_clusters failed: %s", exc)
        return []

    out: list[CoordinatedCluster] = []
    for row in rows:
        m = row._mapping
        users = []
        if with_users:
            users = [ClusterUser(email=e) for e in (m.get("emails") or []) if e]
        out.append(CoordinatedCluster(
            symbol=m["symbol"],
            side=m["side"],
            bucket_start=m["bucket"],
            first_trade_at=m["first_at"],
            last_trade_at=m["last_at"],
            user_count=int(m["user_count"] or 0),
            trade_count=int(m["trade_count"] or 0),
            total_lots=float(m["total_lots"] or 0),
            users=users,
        ))
    return out
