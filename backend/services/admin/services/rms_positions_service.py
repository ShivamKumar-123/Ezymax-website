"""RMS — Live Position Monitor (Module 2).

Every open position with the RMS desk columns: client, country, introducing
broker, routing (A/B book), plus **live** current price + floating P/L read
from the risk-engine's Redis ticks. Read-only, paginated, filterable.

Purely additive: reuses the same joined-read pattern as ``trade_risk_service``
and the platform's own P/L helpers (``quote_to_account_pnl``, ``calc_margin``)
so the numbers agree with the trader terminal. No writes, no engine changes.

Live pricing: a buy is marked to the current **bid**, a sell to the **ask**
(the price it would close at) — matching the b-book / risk engines.
"""
import json
import logging
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError, DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.redis_client import redis_client
from packages.common.src.trading_service import quote_to_account_pnl, calc_margin

_log = logging.getLogger("uvicorn.error")


async def _price_map(symbols: set[str]) -> dict[str, dict]:
    """Batch-read tick:{symbol} for the given symbols → {SYMBOL: {bid, ask}}.
    Missing/stale keys are simply absent; callers fall back to open price."""
    out: dict[str, dict] = {}
    syms = [s for s in symbols if s]
    if not syms:
        return out
    try:
        keys = [f"tick:{s}" for s in syms]
        raws = await redis_client.mget(keys)
        for sym, raw in zip(syms, raws):
            if not raw:
                continue
            try:
                t = json.loads(raw)
                out[sym] = {"bid": float(t.get("bid") or 0), "ask": float(t.get("ask") or 0)}
            except (ValueError, TypeError):
                continue
    except Exception as exc:  # noqa: BLE001 — pricing is best-effort
        _log.debug("rms price_map failed: %s", exc)
    return out


async def live_positions(
    db: AsyncSession,
    *,
    page: int = 1,
    per_page: int = 50,
    symbol: str | None = None,
    side: str | None = None,        # 'buy' | 'sell'
    book_type: str | None = None,   # 'A' | 'B'
    country: str | None = None,
    search: str | None = None,      # account number or client email
    include_demo: bool = False,
) -> dict:
    where = ["lower(cast(p.status AS text)) = 'open'"]
    params: dict = {"limit": per_page, "offset": (page - 1) * per_page}
    if not include_demo:
        where.append("ta.is_demo = false")
    if symbol:
        where.append("upper(i.symbol) = upper(:symbol)")
        params["symbol"] = symbol
    if side in ("buy", "sell"):
        where.append("lower(cast(p.side AS text)) = :side")
        params["side"] = side
    if book_type in ("A", "B"):
        where.append("coalesce(u.book_type, 'B') = :book_type")
        params["book_type"] = book_type
    if country:
        where.append("upper(u.country) = upper(:country)")
        params["country"] = country
    if search:
        where.append("(ta.account_number ILIKE :q OR u.email ILIKE :q)")
        params["q"] = f"%{search}%"
    where_sql = " AND ".join(where)

    base = f"""
        FROM positions p
        JOIN trading_accounts ta ON ta.id = p.account_id
        JOIN instruments i       ON i.id = p.instrument_id
        JOIN users u             ON u.id = ta.user_id
        LEFT JOIN referrals r    ON r.referred_id = u.id
        LEFT JOIN users ib       ON ib.id = r.referrer_id
        WHERE {where_sql}
    """
    count_sql = text(f"SELECT count(*) {base}")
    rows_sql = text(f"""
        SELECT
            p.id AS ticket_id, p.side, p.lots, p.open_price, p.created_at AS open_time,
            ta.account_number, ta.leverage, ta.is_demo,
            u.id AS user_id, u.first_name, u.last_name, u.email, u.country,
            coalesce(u.book_type, 'B') AS book_type,
            i.symbol, i.base_currency, i.quote_currency, coalesce(i.contract_size, 1) AS contract_size,
            ib.first_name AS ib_first, ib.last_name AS ib_last, ib.email AS ib_email
        {base}
        ORDER BY p.created_at DESC
        LIMIT :limit OFFSET :offset
    """)

    try:
        total = (await db.execute(count_sql, params)).scalar() or 0
        rows = (await db.execute(rows_sql, params)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("rms live_positions failed: %s", exc)
        return {"items": [], "total": 0, "page": page, "per_page": per_page}

    symbols = {r._mapping["symbol"].upper() for r in rows if r._mapping["symbol"]}
    prices = await _price_map(symbols)

    items = []
    for row in rows:
        m = row._mapping
        sym = (m["symbol"] or "").upper()
        side_l = str(m["side"]).lower()
        open_price = Decimal(str(m["open_price"] or 0))
        lots = Decimal(str(m["lots"] or 0))
        cs = Decimal(str(m["contract_size"] or 1))
        lev = int(m["leverage"] or 1)

        tick = prices.get(sym)
        # buy closes at bid, sell at ask; fall back to open price when no tick.
        if tick and tick.get("bid") and tick.get("ask"):
            close_price = Decimal(str(tick["bid"])) if side_l == "buy" else Decimal(str(tick["ask"]))
        else:
            close_price = open_price
        if side_l == "buy":
            raw_quote = (close_price - open_price) * lots * cs
        else:
            raw_quote = (open_price - close_price) * lots * cs
        floating_pnl = quote_to_account_pnl(
            raw_quote, m["base_currency"], m["quote_currency"], close_price, "USD", sym,
        )
        margin = calc_margin(lots, open_price, cs, lev)

        client = f"{m['first_name'] or ''} {m['last_name'] or ''}".strip() or (m["email"] or "—")
        ib_name = None
        if m["ib_first"] or m["ib_last"] or m["ib_email"]:
            ib_name = f"{m['ib_first'] or ''} {m['ib_last'] or ''}".strip() or m["ib_email"]

        items.append({
            "ticket_id": str(m["ticket_id"]),
            "account_number": m["account_number"],
            "client_name": client,
            "user_id": str(m["user_id"]),
            "country": m["country"],
            "introducing_broker": ib_name,
            "symbol": sym,
            "side": side_l,
            "lots": float(lots),
            "open_price": float(open_price),
            "current_price": float(close_price),
            "floating_pnl": float(floating_pnl),
            "margin_used": float(margin),
            "leverage": lev,
            "open_time": m["open_time"].isoformat() if m["open_time"] else None,
            "routing_type": "A-Book" if m["book_type"] == "A" else "B-Book",
            "liquidity_provider": "Corecen" if m["book_type"] == "A" else None,
            "is_demo": bool(m["is_demo"]),
        })

    return {"items": items, "total": int(total), "page": page, "per_page": per_page}
