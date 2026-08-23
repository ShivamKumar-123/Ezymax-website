"""Share Trade Service — create + resolve public share links for positions."""
import json
import secrets
import string
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    SharedTrade, Position, TradingAccount, User, Instrument, PositionStatus,
    TradeHistory,
)
from packages.common.src.redis_client import redis_client, PriceChannel
from packages.common.src.price_cache import price_cache

SHARE_TTL_DAYS = 7
CODE_ALPHABET = string.ascii_letters + string.digits

# An account-wide share renders every trade in one page. Cap the list so a
# heavy account cannot turn a public link into a multi-megabyte response;
# the summary figures are still computed over the FULL set, only the
# per-trade list is trimmed (`truncated` tells the page to say so).
MAX_SHARE_TRADES = 200

VALID_SCOPES = ("single", "open", "history")


def _generate_code(length: int = 7) -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


async def _get_current_price(symbol: str) -> tuple[float, float] | tuple[None, None]:
    tick = await price_cache.get(symbol)
    if not tick:
        return None, None
    try:
        data = json.loads(tick)
        return float(data["bid"]), float(data["ask"])
    except (json.JSONDecodeError, KeyError, ValueError):
        return None, None


async def _to_account_ccy(gross_pnl: float, instrument, current_price: float) -> float:
    """Convert quote-currency P&L into the account currency (USD).

    Extracted from the single-share path so account-wide shares apply the
    exact same conversion — otherwise a portfolio total would silently
    disagree with the per-trade cards a user already shared.
    """
    base_ccy = (getattr(instrument, "base_currency", None) or "").upper()
    quote_ccy = (getattr(instrument, "quote_currency", None) or "").upper()
    if not quote_ccy or quote_ccy == "USD":
        return gross_pnl
    if base_ccy == "USD" and current_price:
        return gross_pnl / current_price
    if base_ccy and base_ccy != "USD":
        # Cross pair (e.g. GBPJPY): convert via the live quote→USD rate.
        from packages.common.src.trading_service import quote_to_account_rate
        rate = await quote_to_account_rate(quote_ccy, "USD")
        if rate is not None and rate > 0:
            return gross_pnl * float(rate)
    return gross_pnl


def _margin_for(lots: float, contract_size: float, open_price: float, leverage: int) -> float:
    return (lots * contract_size * open_price) / leverage if leverage > 0 else 0.0


async def _open_position_metrics(position, instrument, leverage: int) -> dict:
    """Live figures for one OPEN position, priced off the current tick."""
    side = position.side.value if hasattr(position.side, "value") else str(position.side)
    contract_size = float(instrument.contract_size or 100000)
    pip_size = float(instrument.pip_size or 0.0001)
    open_price = float(position.open_price)
    lots = float(position.lots)

    bid, ask = await _get_current_price(instrument.symbol)
    current_price = (bid if side == "buy" else ask) if bid and ask else open_price

    if side == "buy":
        gross = (current_price - open_price) * lots * contract_size
        ticks = (current_price - open_price) / pip_size if pip_size > 0 else 0.0
    else:
        gross = (open_price - current_price) * lots * contract_size
        ticks = (open_price - current_price) / pip_size if pip_size > 0 else 0.0

    gross = await _to_account_ccy(gross, instrument, current_price)
    # Net of what the broker already took, so an open trade and the closed
    # trade it becomes are measured the same way.
    net = gross - float(position.commission or 0) + float(position.swap or 0)
    margin = _margin_for(lots, contract_size, open_price, leverage)

    return {
        "id": str(position.id),
        "status": "active",
        "symbol": instrument.symbol,
        "side": side,
        "lots": lots,
        "open_price": open_price,
        "current_price": current_price,
        "pnl": net,
        "roi_pct": (net / margin * 100) if margin > 0 else 0.0,
        "ticks": ticks,
        "pip_size": pip_size,
        "margin": margin,
        "opened_at": position.created_at.isoformat() if position.created_at else None,
        "closed_at": None,
    }


def _closed_trade_metrics(trade, instrument, leverage: int) -> dict:
    """Figures for one CLOSED trade. `profit` is already in account currency,
    so unlike the open path this needs no FX conversion."""
    side = trade.side.value if hasattr(trade.side, "value") else str(trade.side)
    contract_size = float(instrument.contract_size or 100000) if instrument else 100000.0
    pip_size = float(instrument.pip_size or 0.0001) if instrument else 0.0001
    open_price = float(trade.open_price)
    close_price = float(trade.close_price)
    lots = float(trade.lots)

    net = float(trade.profit or 0) - float(trade.commission or 0) + float(trade.swap or 0)
    ticks = ((close_price - open_price) if side == "buy" else (open_price - close_price))
    ticks = ticks / pip_size if pip_size > 0 else 0.0
    margin = _margin_for(lots, contract_size, open_price, leverage)

    return {
        "id": str(trade.id),
        "status": "closed",
        "symbol": instrument.symbol if instrument else None,
        "side": side,
        "lots": lots,
        "open_price": open_price,
        "current_price": close_price,
        "pnl": net,
        "roi_pct": (net / margin * 100) if margin > 0 else 0.0,
        "ticks": ticks,
        "pip_size": pip_size,
        "margin": margin,
        "opened_at": trade.opened_at.isoformat() if trade.opened_at else None,
        "closed_at": trade.closed_at.isoformat() if trade.closed_at else None,
    }


def _summarise(trades: list[dict]) -> dict:
    """Aggregate the headline figures shown above the trade list."""
    wins = sum(1 for t in trades if t["pnl"] > 0)
    losses = sum(1 for t in trades if t["pnl"] < 0)
    total_pnl = sum(t["pnl"] for t in trades)
    total_margin = sum(t["margin"] for t in trades)
    # Win rate counts decided trades only — break-even trades would
    # otherwise drag the percentage down without being losses.
    decided = wins + losses
    return {
        "total_pnl": total_pnl,
        "total_trades": len(trades),
        "open_count": sum(1 for t in trades if t["status"] == "active"),
        "closed_count": sum(1 for t in trades if t["status"] == "closed"),
        "wins": wins,
        "losses": losses,
        "win_rate": (wins / decided * 100) if decided else 0.0,
        "roi_pct": (total_pnl / total_margin * 100) if total_margin > 0 else 0.0,
        "ticks": sum(t["ticks"] for t in trades),
        "best_pnl": max((t["pnl"] for t in trades), default=0.0),
        "worst_pnl": min((t["pnl"] for t in trades), default=0.0),
    }


async def create_share_link(
    position_id: UUID,
    user_id: UUID,
    description: str | None,
    link_description: str | None,
    display_mode: str,
    db: AsyncSession,
) -> dict:
    if display_mode not in ("pnl", "roi", "ticks"):
        display_mode = "pnl"

    # Verify the position belongs to the user
    pos_q = await db.execute(
        select(Position, TradingAccount)
        .join(TradingAccount, Position.account_id == TradingAccount.id)
        .where(Position.id == position_id, TradingAccount.user_id == user_id)
    )
    row = pos_q.first()
    if not row:
        raise HTTPException(status_code=404, detail="Position not found")

    # Reuse an existing non-expired link for the same position
    now = datetime.now(timezone.utc)
    existing_q = await db.execute(
        select(SharedTrade).where(
            SharedTrade.position_id == position_id,
            SharedTrade.scope == "single",
            SharedTrade.expires_at > now,
        )
    )
    existing = existing_q.scalar_one_or_none()
    if existing:
        # Update description / display mode if caller changed them
        existing.description = description
        existing.link_description = link_description
        existing.display_mode = display_mode
        await db.commit()
        return {"short_code": existing.short_code, "expires_at": existing.expires_at.isoformat()}

    # Generate a unique code
    for _ in range(10):
        code = _generate_code()
        dupe = await db.execute(select(SharedTrade).where(SharedTrade.short_code == code))
        if not dupe.scalar_one_or_none():
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate unique share code")

    share = SharedTrade(
        short_code=code,
        scope="single",
        position_id=position_id,
        user_id=user_id,
        description=description,
        link_description=link_description,
        display_mode=display_mode,
        expires_at=now + timedelta(days=SHARE_TTL_DAYS),
    )
    db.add(share)
    await db.commit()
    return {"short_code": code, "expires_at": share.expires_at.isoformat()}


async def create_account_share_link(
    account_id: UUID,
    user_id: UUID,
    scope: str,
    description: str | None,
    link_description: str | None,
    display_mode: str,
    db: AsyncSession,
) -> dict:
    """Create a link covering every trade on one account.

    `scope` is ``open`` (current positions) or ``history`` (open + closed).
    No position is captured: the link re-reads the account on each view, so
    a portfolio link stays current instead of freezing at share time.
    """
    if display_mode not in ("pnl", "roi", "ticks"):
        display_mode = "pnl"
    if scope not in ("open", "history"):
        raise HTTPException(status_code=422, detail="scope must be 'open' or 'history'")

    # The account must belong to the caller — otherwise anyone could mint a
    # public link exposing someone else's book.
    acct_q = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id,
            TradingAccount.user_id == user_id,
        )
    )
    if not acct_q.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Account not found")

    now = datetime.now(timezone.utc)
    existing_q = await db.execute(
        select(SharedTrade).where(
            SharedTrade.account_id == account_id,
            SharedTrade.scope == scope,
            SharedTrade.expires_at > now,
        )
    )
    existing = existing_q.scalar_one_or_none()
    if existing:
        existing.description = description
        existing.link_description = link_description
        existing.display_mode = display_mode
        await db.commit()
        return {
            "short_code": existing.short_code,
            "scope": scope,
            "expires_at": existing.expires_at.isoformat(),
        }

    for _ in range(10):
        code = _generate_code()
        dupe = await db.execute(select(SharedTrade).where(SharedTrade.short_code == code))
        if not dupe.scalar_one_or_none():
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate unique share code")

    share = SharedTrade(
        short_code=code,
        scope=scope,
        position_id=None,
        account_id=account_id,
        user_id=user_id,
        description=description,
        link_description=link_description,
        display_mode=display_mode,
        expires_at=now + timedelta(days=SHARE_TTL_DAYS),
    )
    db.add(share)
    await db.commit()
    return {"short_code": code, "scope": scope, "expires_at": share.expires_at.isoformat()}


async def account_share_payload(account_id: UUID, scope: str, db: AsyncSession) -> dict:
    """Figures for one account under `scope` — the body of an account-wide
    share, and what the modal previews before a link exists.

    Kept separate from the SharedTrade row so the preview and the public
    page are computed by the same code and cannot drift apart.
    """
    acct_q = await db.execute(
        select(TradingAccount).where(TradingAccount.id == account_id)
    )
    account = acct_q.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    leverage = int(account.leverage or 100)

    # Open positions — included in BOTH scopes: "entire history" reads as
    # the account's whole record, which is incomplete without live trades.
    open_q = await db.execute(
        select(Position, Instrument)
        .join(Instrument, Position.instrument_id == Instrument.id)
        .where(
            Position.account_id == account_id,
            Position.status.in_([PositionStatus.OPEN, PositionStatus.PARTIALLY_CLOSED]),
        )
        .order_by(Position.created_at.desc())
    )
    trades: list[dict] = []
    for position, instrument in open_q.all():
        trades.append(await _open_position_metrics(position, instrument, leverage))

    if scope == "history":
        closed_q = await db.execute(
            select(TradeHistory, Instrument)
            .join(Instrument, TradeHistory.instrument_id == Instrument.id)
            .where(TradeHistory.account_id == account_id)
            .order_by(TradeHistory.closed_at.desc())
        )
        for trade, instrument in closed_q.all():
            trades.append(_closed_trade_metrics(trade, instrument, leverage))

    summary = _summarise(trades)
    # Open trades first, then closed newest-first — the live rows are the
    # ones a viewer cares about most.
    visible = trades[:MAX_SHARE_TRADES]
    for t in visible:
        t.pop("margin", None)

    return {
        "scope": scope,
        # Only an open-position list ticks; a pure history view is static.
        "is_live": summary["open_count"] > 0,
        "leverage": leverage,
        "summary": summary,
        "trades": visible,
        "truncated": len(trades) > len(visible),
    }


async def preview_account_share(
    account_id: UUID, user_id: UUID, scope: str, db: AsyncSession,
) -> dict:
    """Same figures a share link would expose, for the share modal.

    Read-only and ownership-checked: it mints no link and bumps no view
    count, so opening the modal has no side effects.
    """
    if scope not in ("open", "history"):
        raise HTTPException(status_code=422, detail="scope must be 'open' or 'history'")
    owned = await db.execute(
        select(TradingAccount.id).where(
            TradingAccount.id == account_id,
            TradingAccount.user_id == user_id,
        )
    )
    if not owned.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Account not found")
    return await account_share_payload(account_id, scope, db)


async def _build_account_share(share: SharedTrade, db: AsyncSession) -> dict:
    """Render the public payload for an ``open`` / ``history`` share."""
    payload = await account_share_payload(share.account_id, share.scope, db)
    payload.update({
        "short_code": share.short_code,
        "description": share.description,
        "link_description": share.link_description,
        "display_mode": share.display_mode,
        "expires_at": share.expires_at.isoformat(),
    })
    return payload


async def get_public_share(code: str, db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    share_q = await db.execute(
        select(SharedTrade).where(SharedTrade.short_code == code)
    )
    share = share_q.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")
    if share.expires_at < now:
        raise HTTPException(status_code=410, detail="Share link expired")

    if share.scope and share.scope != "single":
        payload = await _build_account_share(share, db)
        share.view_count = (share.view_count or 0) + 1
        await db.commit()
        return payload

    pos_q = await db.execute(
        select(Position, TradingAccount, Instrument)
        .join(TradingAccount, Position.account_id == TradingAccount.id)
        .join(Instrument, Position.instrument_id == Instrument.id)
        .where(Position.id == share.position_id)
    )
    row = pos_q.first()
    if not row:
        raise HTTPException(status_code=404, detail="Position not found")

    position, account, instrument = row
    pos_status = position.status.value if hasattr(position.status, "value") else str(position.status)
    side = position.side.value if hasattr(position.side, "value") else str(position.side)

    bid, ask = await _get_current_price(instrument.symbol)
    contract_size = float(instrument.contract_size or 100000)
    open_price = float(position.open_price)
    lots = float(position.lots)
    pip_size = float(instrument.pip_size or 0.0001)

    if pos_status == "closed" and position.close_price:
        current_price = float(position.close_price)
        is_live = False
    else:
        current_price = (bid if side == "buy" else ask) if bid and ask else open_price
        is_live = True

    if side == "buy":
        gross_pnl = (current_price - open_price) * lots * contract_size
        pip_diff = (current_price - open_price) / pip_size if pip_size > 0 else 0
    else:
        gross_pnl = (open_price - current_price) * lots * contract_size
        pip_diff = (open_price - current_price) / pip_size if pip_size > 0 else 0
    # Convert quote-currency P&L to account currency (USD)
    gross_pnl = await _to_account_ccy(gross_pnl, instrument, current_price)

    # Margin snapshot: lots * contract_size * open_price / leverage
    leverage = int(account.leverage or 100)
    margin = (lots * contract_size * open_price) / leverage if leverage > 0 else 0
    roi_pct = (gross_pnl / margin * 100) if margin > 0 else 0

    share.view_count = (share.view_count or 0) + 1
    await db.commit()

    return {
        "short_code": share.short_code,
        "scope": "single",
        "status": "closed" if pos_status == "closed" else "active",
        "is_live": is_live,
        "symbol": instrument.symbol,
        "side": side,
        "lots": lots,
        "leverage": leverage,
        "open_price": open_price,
        "current_price": current_price,
        "pnl": gross_pnl,
        "roi_pct": roi_pct,
        "ticks": pip_diff,
        "pip_size": pip_size,
        "description": share.description,
        "link_description": share.link_description,
        "display_mode": share.display_mode,
        "opened_at": position.created_at.isoformat() if position.created_at else None,
        "closed_at": position.closed_at.isoformat() if position.closed_at else None,
        "expires_at": share.expires_at.isoformat(),
    }
