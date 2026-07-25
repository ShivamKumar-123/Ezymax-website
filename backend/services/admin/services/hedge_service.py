"""Hedged Trades — admin reporting + actions.

Three read views + two actions, all in one place so the admin panel gets a
standalone "Hedged Trades" section (not bolted onto RMS or Users):

  * live_hedges       — per-client: accounts currently holding BOTH sides of
                        the same instrument, with live floating P/L per leg.
  * book_exposure     — per-instrument: total client long vs short lots and
                        the house's net exposure (what the desk may hedge with
                        the LP). Reuses the risk engine's own live prices.
  * hedge_history     — closed hedge episodes recorded by the gateway
                        hedge_recorder engine (going-forward history).
  * block_trade       — admin force-closes ONE position at open price (zero
                        P/L, margin released), audit-logged. Neutralises a
                        specific leg of a suspected-abuse hedge.
  * block_account     — suspends the whole account's trading (reuses the same
                        far-future trading_blocked_until lock as user block).

Reads are read-only and reuse the RMS live-pricing helper so numbers agree
with the Live Position Monitor and the trader terminal.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import write_audit_log
from packages.common.src.trading_service import quote_to_account_pnl
from services.rms_positions_service import _price_map

_log = logging.getLogger("uvicorn.error")


# ── 1. Live per-client hedges ────────────────────────────────────────────

async def live_hedges(
    db: AsyncSession,
    *,
    symbol: str | None = None,
    country: str | None = None,
    search: str | None = None,
) -> dict:
    """Accounts currently hedged (both buy+sell open on the same instrument).
    One row per (account, instrument). Demo accounts excluded."""
    where = ["lower(cast(p.status AS text)) = 'open'", "ta.is_demo = false"]
    params: dict = {}
    if symbol:
        where.append("upper(i.symbol) = upper(:symbol)")
        params["symbol"] = symbol
    if country:
        where.append("upper(u.country) = upper(:country)")
        params["country"] = country
    if search:
        where.append("(ta.account_number ILIKE :q OR u.email ILIKE :q)")
        params["q"] = f"%{search}%"
    where_sql = " AND ".join(where)

    sql = text(f"""
        SELECT
            p.account_id, p.instrument_id, max(i.symbol) AS symbol,
            max(ta.account_number) AS account_number, max(ta.leverage) AS leverage,
            max(u.id::text) AS user_id, max(u.email) AS email,
            max(u.first_name) AS first_name, max(u.last_name) AS last_name,
            max(u.country) AS country, coalesce(max(u.book_type), 'B') AS book_type,
            max(i.base_currency) AS base_currency, max(i.quote_currency) AS quote_currency,
            coalesce(max(i.contract_size), 1) AS contract_size,
            sum(CASE WHEN lower(cast(p.side AS text))='buy'  THEN p.lots ELSE 0 END) AS long_lots,
            sum(CASE WHEN lower(cast(p.side AS text))='sell' THEN p.lots ELSE 0 END) AS short_lots,
            min(p.created_at) AS first_leg_at,
            count(*) AS leg_count
        FROM positions p
        JOIN trading_accounts ta ON ta.id = p.account_id
        JOIN instruments i       ON i.id = p.instrument_id
        JOIN users u             ON u.id = ta.user_id
        WHERE {where_sql}
        GROUP BY p.account_id, p.instrument_id
        HAVING sum(CASE WHEN lower(cast(p.side AS text))='buy'  THEN p.lots ELSE 0 END) > 0
           AND sum(CASE WHEN lower(cast(p.side AS text))='sell' THEN p.lots ELSE 0 END) > 0
        ORDER BY min(p.created_at) DESC
    """)

    try:
        rows = (await db.execute(sql, params)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("live_hedges failed: %s", exc)
        return {"items": []}

    symbols = {r._mapping["symbol"].upper() for r in rows if r._mapping["symbol"]}
    prices = await _price_map(symbols)

    items = []
    for row in rows:
        m = row._mapping
        sym = (m["symbol"] or "").upper()
        long_lots = Decimal(str(m["long_lots"] or 0))
        short_lots = Decimal(str(m["short_lots"] or 0))
        net_lots = long_lots - short_lots
        hedged_lots = min(long_lots, short_lots)
        # Fully hedged when the smaller side fully offsets the larger.
        bigger = max(long_lots, short_lots) or Decimal("1")
        hedge_ratio = float((hedged_lots / bigger) * 100)

        client = f"{m['first_name'] or ''} {m['last_name'] or ''}".strip() or (m["email"] or "—")
        items.append({
            "account_id": str(m["account_id"]),
            "instrument_id": str(m["instrument_id"]),
            "account_number": m["account_number"],
            "user_id": m["user_id"],
            "client_name": client,
            "email": m["email"],
            "country": m["country"],
            "symbol": sym,
            "long_lots": float(long_lots),
            "short_lots": float(short_lots),
            "net_lots": float(net_lots),
            "hedged_lots": float(hedged_lots),
            "hedge_ratio_pct": round(hedge_ratio, 1),
            "leg_count": int(m["leg_count"] or 0),
            "routing_type": "A-Book" if m["book_type"] == "A" else "B-Book",
            "first_leg_at": m["first_leg_at"].isoformat() if m["first_leg_at"] else None,
        })
    return {"items": items}


# ── 2. Book exposure per instrument ──────────────────────────────────────

async def book_exposure(db: AsyncSession) -> dict:
    """Per-instrument client long vs short lots + net + notional. The house
    position is the inverse of the clients' net (broker is counterparty)."""
    sql = text("""
        SELECT
            max(i.symbol) AS symbol, p.instrument_id,
            coalesce(max(i.contract_size), 1) AS contract_size,
            max(i.base_currency) AS base_currency, max(i.quote_currency) AS quote_currency,
            sum(CASE WHEN lower(cast(p.side AS text))='buy'  THEN p.lots ELSE 0 END) AS long_lots,
            sum(CASE WHEN lower(cast(p.side AS text))='sell' THEN p.lots ELSE 0 END) AS short_lots,
            count(DISTINCT p.account_id) AS accounts
        FROM positions p
        JOIN trading_accounts ta ON ta.id = p.account_id
        JOIN instruments i       ON i.id = p.instrument_id
        WHERE lower(cast(p.status AS text)) = 'open' AND ta.is_demo = false
        GROUP BY p.instrument_id
        HAVING sum(p.lots) > 0
        ORDER BY max(i.symbol)
    """)
    try:
        rows = (await db.execute(sql)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("book_exposure failed: %s", exc)
        return {"items": []}

    symbols = {r._mapping["symbol"].upper() for r in rows if r._mapping["symbol"]}
    prices = await _price_map(symbols)

    items = []
    for row in rows:
        m = row._mapping
        sym = (m["symbol"] or "").upper()
        long_lots = Decimal(str(m["long_lots"] or 0))
        short_lots = Decimal(str(m["short_lots"] or 0))
        net_lots = long_lots - short_lots  # + = clients net long
        cs = Decimal(str(m["contract_size"] or 1))
        tick = prices.get(sym) or {}
        mid = Decimal(str(((tick.get("bid") or 0) + (tick.get("ask") or 0)) / 2)) if tick else Decimal("0")
        # Net notional in quote ccy, converted to account (USD) terms.
        net_notional_quote = abs(net_lots) * cs * mid
        net_notional_usd = float(quote_to_account_pnl(
            net_notional_quote, m["base_currency"], m["quote_currency"], mid or Decimal("1"), "USD", sym,
        )) if mid > 0 else 0.0

        items.append({
            "instrument_id": str(m["instrument_id"]),
            "symbol": sym,
            "client_long_lots": float(long_lots),
            "client_short_lots": float(short_lots),
            "client_net_lots": float(net_lots),          # + clients long
            "house_net_lots": float(-net_lots),          # broker is opposite
            "house_side": "short" if net_lots > 0 else ("long" if net_lots < 0 else "flat"),
            "net_notional_usd": round(net_notional_usd, 2),
            "accounts": int(m["accounts"] or 0),
        })
    return {"items": items}


# ── 3. Hedge history (closed episodes) ───────────────────────────────────

async def hedge_history(
    db: AsyncSession, *, page: int = 1, per_page: int = 50, search: str | None = None,
) -> dict:
    where = ["h.status = 'closed'"]
    params: dict = {"limit": per_page, "offset": (page - 1) * per_page}
    if search:
        where.append("(ta.account_number ILIKE :q OR u.email ILIKE :q OR h.symbol ILIKE :q)")
        params["q"] = f"%{search}%"
    where_sql = " AND ".join(where)
    base = f"""
        FROM hedge_episodes h
        JOIN trading_accounts ta ON ta.id = h.account_id
        JOIN users u             ON u.id = h.user_id
        WHERE {where_sql}
    """
    try:
        total = (await db.execute(text(f"SELECT count(*) {base}"), params)).scalar() or 0
        rows = (await db.execute(text(f"""
            SELECT h.id, h.symbol, h.opened_at, h.closed_at,
                   h.peak_long_lots, h.peak_short_lots,
                   ta.account_number, u.email, u.first_name, u.last_name, u.country
            {base}
            ORDER BY h.closed_at DESC
            LIMIT :limit OFFSET :offset
        """), params)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("hedge_history failed (table not migrated?): %s", exc)
        return {"items": [], "total": 0, "page": page, "per_page": per_page}

    items = []
    for row in rows:
        m = row._mapping
        opened = m["opened_at"]
        closed = m["closed_at"]
        dur_min = None
        if opened and closed:
            dur_min = round((closed - opened).total_seconds() / 60.0, 1)
        client = f"{m['first_name'] or ''} {m['last_name'] or ''}".strip() or (m["email"] or "—")
        items.append({
            "id": str(m["id"]),
            "account_number": m["account_number"],
            "client_name": client,
            "email": m["email"],
            "country": m["country"],
            "symbol": m["symbol"],
            "peak_long_lots": float(m["peak_long_lots"] or 0),
            "peak_short_lots": float(m["peak_short_lots"] or 0),
            "opened_at": opened.isoformat() if opened else None,
            "closed_at": closed.isoformat() if closed else None,
            "duration_min": dur_min,
        })
    return {"items": items, "total": int(total), "page": page, "per_page": per_page}


# ── 4. Actions ───────────────────────────────────────────────────────────

async def block_trade(
    db: AsyncSession, position_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None,
) -> dict:
    """Force-close a single open position at its open price (zero P/L),
    release its margin, and flag it admin-modified. Mirrors the kill-switch
    close semantics but scoped to one trade."""
    # Lock the position row; leverage + contract_size come from the account
    # and instrument respectively (positions store neither).
    row = (await db.execute(text(
        """
        SELECT p.id, p.account_id, p.lots, p.open_price, p.is_fully_funded,
               lower(cast(p.status AS text)) AS status, i.contract_size
        FROM positions p JOIN instruments i ON i.id = p.instrument_id
        WHERE p.id = :id FOR UPDATE OF p
        """
    ), {"id": str(position_id)})).first()
    if row is None:
        raise HTTPException(status_code=404, detail="position_not_found")
    m = row._mapping
    if m["status"] != "open":
        raise HTTPException(status_code=409, detail="position_not_open")

    acct = (await db.execute(text(
        "SELECT id, leverage, margin_used, balance, credit FROM trading_accounts "
        "WHERE id = :aid FOR UPDATE"
    ), {"aid": str(m["account_id"])})).first()
    lots = Decimal(str(m["lots"] or 0))
    open_price = Decimal(str(m["open_price"] or 0))
    cs = Decimal(str(m["contract_size"] or 1))
    # Fully-funded ("Smart Trade") positions were opened at leverage 1, so
    # their margin == notional. Otherwise use the account leverage.
    if m["is_fully_funded"]:
        eff_lev = Decimal("1")
    else:
        eff_lev = Decimal(str((acct._mapping["leverage"] if acct else 0) or 1)) or Decimal("1")
    released = (lots * cs * open_price) / eff_lev

    await db.execute(text(
        """
        UPDATE positions
        SET status = 'closed', close_price = open_price, closed_at = now(),
            profit = 0, is_admin_modified = true
        WHERE id = :id
        """
    ), {"id": str(position_id)})
    if acct is not None:
        new_margin = max(Decimal("0"), Decimal(str(acct._mapping["margin_used"] or 0)) - released)
        bal = Decimal(str(acct._mapping["balance"] or 0))
        credit = Decimal(str(acct._mapping["credit"] or 0))
        equity = bal + credit
        await db.execute(text(
            """
            UPDATE trading_accounts
            SET margin_used = :mu, equity = :eq, free_margin = :fm
            WHERE id = :aid
            """
        ), {"mu": new_margin, "eq": equity, "fm": equity - new_margin, "aid": str(m["account_id"])})

    await write_audit_log(
        db, admin_id, "hedge_block_trade", "position", position_id,
        new_values={"forced_close": True, "close_price": float(open_price)},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Trade blocked (position force-closed)", "position_id": str(position_id)}


async def block_account(
    db: AsyncSession, account_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None,
) -> dict:
    """Suspend trading for the account's owner (far-future block), matching
    the user-level block_trading lock. Does not touch open positions."""
    row = (await db.execute(text(
        "SELECT user_id, account_number FROM trading_accounts WHERE id = :aid"
    ), {"aid": str(account_id)})).first()
    if row is None:
        raise HTTPException(status_code=404, detail="account_not_found")
    user_id = row._mapping["user_id"]
    far_future = datetime.now(timezone.utc) + timedelta(days=36500)
    await db.execute(text(
        "UPDATE users SET trading_blocked_until = :t WHERE id = :uid"
    ), {"t": far_future, "uid": str(user_id)})
    await write_audit_log(
        db, admin_id, "hedge_block_account", "trading_account", account_id,
        new_values={"trading_blocked_until": far_future.isoformat(),
                    "account_number": row._mapping["account_number"]},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Account trading blocked", "account_id": str(account_id)}
