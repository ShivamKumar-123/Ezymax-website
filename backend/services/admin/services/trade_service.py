"""Admin Trades Service — positions, orders, history, modify, close, create stealth trade."""
import json
import os
import uuid
from datetime import datetime
from decimal import Decimal

import redis.asyncio as aioredis
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    User, TradingAccount, Position, Order, Instrument, TradeHistory,
    PositionStatus, OrderStatus, OrderType, OrderSide, Transaction, CopyTrade,
)
from packages.common.src.admin_schemas import (
    PositionOut, OrderOut, TradeHistoryOut, PaginatedResponse,
    ModifyPositionRequest, ClosePositionRequest, CreateTradeRequest,
    BulkCreateTradeRequest,
)
from packages.common.src.database import AsyncSessionLocal
from packages.common.src.instrument_pricing import resolve_commission
from dependencies import write_audit_log

# Admin uses Redis db 1, but market ticks are on db 0 (gateway).
# Use db 0 explicitly for price reads.
_redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
_redis = aioredis.from_url(_redis_url, decode_responses=True)
_redis_prices = aioredis.from_url(_redis_url.rsplit("/", 1)[0] + "/0", decode_responses=True)


async def _get_live_price(symbol: str) -> dict | None:
    try:
        data = await _redis_prices.get(f"tick:{symbol}")
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def list_positions(
    page: int, per_page: int, status_filter: str, db: AsyncSession,
    user_id: uuid.UUID | None = None,
):
    # Exclude demo-account activity from admin views (demo trades are practice-only).
    query = (
        select(Position)
        .join(TradingAccount, Position.account_id == TradingAccount.id)
        .where(TradingAccount.is_demo == False)
    )
    # Per-user filter for the user-detail ledger page. Joined on
    # TradingAccount (positions are scoped to accounts, not users
    # directly) so this picks up every account the user owns.
    if user_id is not None:
        query = query.where(TradingAccount.user_id == user_id)
    if status_filter == "open":
        query = query.where(Position.status == PositionStatus.OPEN.value)
    elif status_filter == "closed":
        query = query.where(Position.status == PositionStatus.CLOSED.value)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Position.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    positions = result.scalars().all()

    items = []
    for pos in positions:
        acc_q = await db.execute(select(TradingAccount).where(TradingAccount.id == pos.account_id))
        acc = acc_q.scalar_one_or_none()

        user_email = None
        account_number = None
        book_type = None
        is_demo = False
        if acc:
            account_number = acc.account_number
            is_demo = bool(acc.is_demo)
            user_q = await db.execute(select(User).where(User.id == acc.user_id))
            usr = user_q.scalar_one_or_none()
            if usr:
                user_email = usr.email
                book_type = (usr.book_type or "B").upper()
        # LP-forwarded when a LIVE account belongs to an A-book user —
        # demo trades always stay internal (b-book engine), never hit LP.
        is_lp_forwarded = (book_type == "A") and not is_demo

        inst_q = await db.execute(select(Instrument).where(Instrument.id == pos.instrument_id))
        inst = inst_q.scalar_one_or_none()

        side_val = pos.side.value if hasattr(pos.side, "value") else str(pos.side)
        status_val = pos.status.value if hasattr(pos.status, "value") else str(pos.status)
        current_price = None
        profit = float(pos.profit or 0)

        if status_val == "open" and inst:
            tick = await _get_live_price(inst.symbol)
            if tick:
                current_price = float(tick["bid"]) if side_val == "buy" else float(tick["ask"])
                contract_size = float(inst.contract_size or 100000)
                lots = float(pos.lots or 0)
                open_p = float(pos.open_price or 0)
                if side_val == "buy":
                    profit = (current_price - open_p) * lots * contract_size
                else:
                    profit = (open_p - current_price) * lots * contract_size

        items.append(PositionOut(
            id=str(pos.id),
            account_id=str(pos.account_id),
            instrument_symbol=inst.symbol if inst else None,
            side=side_val,
            status=status_val,
            lots=float(pos.lots or 0),
            open_price=float(pos.open_price or 0),
            close_price=current_price if status_val == "open" else (float(pos.close_price) if pos.close_price else None),
            stop_loss=float(pos.stop_loss) if pos.stop_loss is not None else None,
            take_profit=float(pos.take_profit) if pos.take_profit is not None else None,
            swap=float(pos.swap or 0),
            commission=float(pos.commission or 0),
            profit=round(profit, 2),
            contract_size=float(inst.contract_size) if inst and inst.contract_size is not None else None,
            comment=pos.comment,
            is_admin_modified=pos.is_admin_modified or False,
            created_at=pos.created_at,
            user_email=user_email,
            account_number=account_number,
            book_type=book_type,
            is_demo=is_demo,
            is_lp_forwarded=is_lp_forwarded,
        ))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def list_orders(
    page: int, per_page: int, status_filter: str, db: AsyncSession,
):
    query = (
        select(Order)
        .join(TradingAccount, Order.account_id == TradingAccount.id)
        .where(TradingAccount.is_demo == False)
    )
    if status_filter == "pending":
        query = query.where(Order.status == OrderStatus.PENDING)
    elif status_filter == "filled":
        query = query.where(Order.status == OrderStatus.FILLED)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Order.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    orders = result.scalars().all()

    items = []
    for o in orders:
        acc_q = await db.execute(select(TradingAccount).where(TradingAccount.id == o.account_id))
        acc = acc_q.scalar_one_or_none()
        user_email = None
        account_number = None
        if acc:
            account_number = acc.account_number
            user_q = await db.execute(select(User).where(User.id == acc.user_id))
            usr = user_q.scalar_one_or_none()
            if usr:
                user_email = usr.email

        inst_q = await db.execute(select(Instrument).where(Instrument.id == o.instrument_id))
        inst = inst_q.scalar_one_or_none()

        items.append(OrderOut(
            id=str(o.id),
            account_id=str(o.account_id),
            instrument_symbol=inst.symbol if inst else None,
            order_type=o.order_type.value if hasattr(o.order_type, "value") else str(o.order_type),
            side=o.side.value if hasattr(o.side, "value") else str(o.side),
            status=o.status.value if hasattr(o.status, "value") else str(o.status),
            lots=float(o.lots or 0),
            price=float(o.price) if o.price else None,
            stop_loss=float(o.stop_loss) if o.stop_loss else None,
            take_profit=float(o.take_profit) if o.take_profit else None,
            filled_price=float(o.filled_price) if o.filled_price else None,
            commission=float(o.commission or 0),
            swap=float(o.swap or 0),
            comment=o.comment,
            is_admin_created=o.is_admin_created or False,
            created_at=o.created_at,
            user_email=user_email,
            account_number=account_number,
        ))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def list_trade_history(
    page: int, per_page: int, db: AsyncSession,
    user_id: uuid.UUID | None = None,
):
    query = (
        select(TradeHistory)
        .join(TradingAccount, TradeHistory.account_id == TradingAccount.id)
        .where(TradingAccount.is_demo == False)
    )
    if user_id is not None:
        query = query.where(TradingAccount.user_id == user_id)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(TradeHistory.closed_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    trades = result.scalars().all()

    items = []
    for t in trades:
        inst_q = await db.execute(select(Instrument).where(Instrument.id == t.instrument_id))
        inst = inst_q.scalar_one_or_none()

        acc_q = await db.execute(select(TradingAccount).where(TradingAccount.id == t.account_id))
        acc = acc_q.scalar_one_or_none()
        user_email = None
        account_number = None
        if acc:
            account_number = acc.account_number
            user_q = await db.execute(select(User).where(User.id == acc.user_id))
            usr = user_q.scalar_one_or_none()
            if usr:
                user_email = usr.email

        # Pull SL/TP off the originating position so the history row
        # carries the limits the trader had set at close time. The
        # Position row stays after close (status flips to 'closed' but
        # the row is preserved for the audit trail), so this read is
        # cheap and accurate.
        pos_sl = None
        pos_tp = None
        if t.position_id:
            pos_q = await db.execute(select(Position).where(Position.id == t.position_id))
            pos = pos_q.scalar_one_or_none()
            if pos:
                pos_sl = float(pos.stop_loss) if pos.stop_loss is not None else None
                pos_tp = float(pos.take_profit) if pos.take_profit is not None else None

        items.append(TradeHistoryOut(
            id=str(t.id),
            account_id=str(t.account_id),
            instrument_symbol=inst.symbol if inst else None,
            side=t.side.value if hasattr(t.side, "value") else str(t.side),
            lots=float(t.lots or 0),
            open_price=float(t.open_price or 0),
            close_price=float(t.close_price or 0),
            stop_loss=pos_sl,
            take_profit=pos_tp,
            swap=float(t.swap or 0),
            commission=float(t.commission or 0),
            profit=float(t.profit or 0),
            close_reason=getattr(t, 'close_reason', None) or "manual",
            opened_at=t.opened_at,
            closed_at=t.closed_at,
            user_email=user_email,
            account_number=account_number,
        ))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def modify_position(
    position_id: uuid.UUID, body: ModifyPositionRequest,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(Position).where(Position.id == position_id))
    pos = result.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    if (pos.status.value if hasattr(pos.status, 'value') else pos.status) != PositionStatus.OPEN.value:
        raise HTTPException(status_code=400, detail="Position is not open")

    # A-book guard: positions on a non-demo account whose owner is book_type='A'
    # are forwarded to the LP — admin cannot edit them locally because the
    # broker no longer owns the risk. Only B-book (internal) trades are editable.
    acc_q = await db.execute(select(TradingAccount).where(TradingAccount.id == pos.account_id))
    acc = acc_q.scalar_one_or_none()
    if acc and not acc.is_demo:
        usr_q = await db.execute(select(User).where(User.id == acc.user_id))
        usr = usr_q.scalar_one_or_none()
        if usr and (usr.book_type or "B").upper() == "A":
            raise HTTPException(
                status_code=403,
                detail="A-book trade — forwarded to LP, cannot be edited from admin.",
            )

    def _side_str(s) -> str:
        return s.value if hasattr(s, "value") else str(s)

    old_values = {
        "stop_loss": float(pos.stop_loss) if pos.stop_loss is not None else None,
        "take_profit": float(pos.take_profit) if pos.take_profit is not None else None,
        "open_price": float(pos.open_price) if pos.open_price else None,
        "commission": float(pos.commission) if pos.commission else 0,
        "swap": float(pos.swap) if pos.swap else 0,
        "lots": float(pos.lots) if pos.lots else None,
        "side": _side_str(pos.side) if pos.side else None,
        "created_at": pos.created_at.isoformat() if pos.created_at else None,
    }

    # For SL/TP we need to distinguish "field omitted" (don't touch)
    # from "field explicitly null" (clear it). Pydantic v2 tracks
    # which keys were actually present in the request body via
    # `model_fields_set`; we use that to decide whether to write.
    # Without this, admin clearing the SL/TP input on the Edit modal
    # silently does nothing because `stop_loss is not None` short-
    # circuits the clear case. Reported bug: "TP/SL edit nahi hota,
    # purana SL TP show karta rehta hai".
    fields_set = body.model_fields_set
    if "stop_loss" in fields_set:
        pos.stop_loss = Decimal(str(body.stop_loss)) if body.stop_loss is not None else None
    if "take_profit" in fields_set:
        pos.take_profit = Decimal(str(body.take_profit)) if body.take_profit is not None else None
    if body.open_price is not None:
        pos.open_price = Decimal(str(body.open_price))
    if body.commission is not None:
        pos.commission = Decimal(str(body.commission))
    if body.swap is not None:
        pos.swap = Decimal(str(body.swap))
    if body.lots is not None:
        pos.lots = Decimal(str(body.lots))
    if body.open_time is not None:
        pos.created_at = body.open_time

    # Side flip — buy ↔ sell. The position object stores an enum so we
    # coerce the string from the body into OrderSide. We do NOT touch
    # the unrealized P&L here: it's computed from side + current price
    # on every tick, so the sign reverses naturally on the next read.
    # SL/TP semantics also reverse (was-buy-with-TP-above-open becomes
    # sell-with-TP-below-open if admin doesn't also update the SL/TP),
    # so admins are expected to set sensible SL/TP in the same call
    # when flipping side.
    if body.side is not None:
        side_norm = body.side.strip().lower()
        if side_norm not in ("buy", "sell"):
            raise HTTPException(status_code=400, detail="side must be 'buy' or 'sell'")
        pos.side = OrderSide.BUY if side_norm == "buy" else OrderSide.SELL

    pos.is_admin_modified = True
    pos.updated_at = datetime.utcnow()

    new_values = {
        "stop_loss": float(pos.stop_loss) if pos.stop_loss is not None else None,
        "take_profit": float(pos.take_profit) if pos.take_profit is not None else None,
        "open_price": float(pos.open_price) if pos.open_price else None,
        "commission": float(pos.commission) if pos.commission else 0,
        "swap": float(pos.swap) if pos.swap else 0,
        "lots": float(pos.lots) if pos.lots else None,
        "side": _side_str(pos.side) if pos.side else None,
        "created_at": pos.created_at.isoformat() if pos.created_at else None,
    }

    copy_trades_q = await db.execute(
        select(CopyTrade).where(
            CopyTrade.master_position_id == position_id,
            CopyTrade.status == "open",
        )
    )
    updated_copies = 0
    for ct in copy_trades_q.scalars().all():
        inv_pos = await db.get(Position, ct.investor_position_id)
        if not inv_pos:
            continue
        inv_status = inv_pos.status.value if hasattr(inv_pos.status, 'value') else str(inv_pos.status)
        if inv_status != "open":
            continue
        if body.open_price is not None:
            inv_pos.open_price = Decimal(str(body.open_price))
        # Same omitted-vs-null treatment for the mirrored follower:
        # clearing on master clears on follower.
        if "stop_loss" in fields_set:
            inv_pos.stop_loss = Decimal(str(body.stop_loss)) if body.stop_loss is not None else None
        if "take_profit" in fields_set:
            inv_pos.take_profit = Decimal(str(body.take_profit)) if body.take_profit is not None else None
        # Mirror the side flip onto the follower so the copy stays
        # aligned with the master after admin's correction.
        if body.side is not None:
            inv_pos.side = pos.side
        inv_pos.is_admin_modified = True
        inv_pos.updated_at = datetime.utcnow()
        updated_copies += 1

    await write_audit_log(
        db, admin_id, "modify_position", "position", position_id,
        old_values=old_values, new_values={**new_values, "copies_updated": updated_copies},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": f"Position modified successfully. {updated_copies} copy trades updated."}


async def close_position(
    position_id: uuid.UUID, body: ClosePositionRequest,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(Position).where(Position.id == position_id))
    pos = result.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    if (pos.status.value if hasattr(pos.status, 'value') else pos.status) != PositionStatus.OPEN.value:
        raise HTTPException(status_code=400, detail="Position is not open")

    side_val = pos.side.value if hasattr(pos.side, "value") else str(pos.side)

    inst_q = await db.execute(select(Instrument).where(Instrument.id == pos.instrument_id))
    inst = inst_q.scalar_one_or_none()
    contract_size = Decimal(str(inst.contract_size)) if inst else Decimal("100000")

    if body.close_price:
        close_price = Decimal(str(body.close_price))
    elif inst:
        tick = await _get_live_price(inst.symbol)
        if tick:
            close_price = Decimal(str(tick["bid"])) if side_val == "buy" else Decimal(str(tick["ask"]))
        else:
            raise HTTPException(status_code=400, detail="No market price available")
    else:
        raise HTTPException(status_code=400, detail="No price available")

    open_price = pos.open_price or Decimal("0")
    lots = pos.lots or Decimal("0")

    if side_val == "buy":
        profit = (close_price - open_price) * lots * contract_size
    else:
        profit = (open_price - close_price) * lots * contract_size
    from packages.common.src.trading_service import quote_to_account_pnl
    profit = quote_to_account_pnl(
        profit,
        getattr(inst, "base_currency", None),
        getattr(inst, "quote_currency", None),
        close_price,
        symbol=getattr(inst, "symbol", None),
    )

    pos.status = PositionStatus.CLOSED.value
    pos.close_price = close_price
    pos.profit = profit
    pos.closed_at = datetime.utcnow()
    pos.is_admin_modified = True

    acc_q = await db.execute(select(TradingAccount).where(TradingAccount.id == pos.account_id))
    acc = acc_q.scalar_one_or_none()
    if acc:
        acc.balance = (acc.balance or Decimal("0")) + profit
        margin_release = (lots * contract_size * open_price) / Decimal(str(acc.leverage))
        acc.margin_used = max(Decimal("0"), (acc.margin_used or Decimal("0")) - margin_release)
        acc.equity = acc.balance + (acc.credit or Decimal("0"))
        acc.free_margin = acc.equity - acc.margin_used

    # Detect whether the close price has already crossed the position's
    # SL/TP — covers two cases where admin clicks Close:
    #   1. Admin races the SL/TP engine and lands the close request first
    #      (the engine's next tick would have stamped 'sl' or 'tp').
    #   2. Admin overrides body.close_price to the SL/TP level explicitly
    #      (e.g. honouring a TP that the engine missed because of a feed
    #      gap).
    # If neither matches, default the reason to 'admin' (NOT 'manual')
    # so support can distinguish admin-closed trades from
    # trader-clicked-Close manual closes. The frontend already renders
    # an 'Admin' badge for this value (admin/trades/page.tsx).
    detected_reason = "admin"
    if pos.stop_loss:
        sl = Decimal(str(pos.stop_loss))
        if side_val == "buy" and close_price <= sl:
            detected_reason = "sl"
        elif side_val == "sell" and close_price >= sl:
            detected_reason = "sl"
    if detected_reason == "admin" and pos.take_profit:
        tp = Decimal(str(pos.take_profit))
        if side_val == "buy" and close_price >= tp:
            detected_reason = "tp"
        elif side_val == "sell" and close_price <= tp:
            detected_reason = "tp"

    trade_rec = TradeHistory(
        position_id=pos.id,
        account_id=pos.account_id,
        instrument_id=pos.instrument_id,
        side=pos.side,
        lots=pos.lots,
        open_price=pos.open_price,
        close_price=close_price,
        swap=pos.swap or Decimal("0"),
        commission=pos.commission or Decimal("0"),
        profit=profit,
        close_reason=detected_reason,
        opened_at=pos.created_at,
        closed_at=datetime.utcnow(),
    )
    db.add(trade_rec)

    await write_audit_log(
        db, admin_id, "close_position", "position", position_id,
        new_values={"close_price": float(close_price), "profit": float(profit)},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Position closed successfully", "profit": float(profit)}


async def list_instruments(search: str | None, db: AsyncSession) -> dict:
    query = select(Instrument).where(Instrument.is_active == True)
    if search:
        query = query.where(Instrument.symbol.ilike(f"%{search}%"))
    query = query.order_by(Instrument.symbol)
    result = await db.execute(query)
    instruments = result.scalars().all()
    return {
        "items": [
            {
                "id": str(i.id),
                "symbol": i.symbol,
                "display_name": i.display_name,
                "segment": i.segment.name if i.segment else None,
            }
            for i in instruments
        ]
    }


async def create_stealth_trade(
    body: CreateTradeRequest, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    acc_q = await db.execute(
        select(TradingAccount).where(TradingAccount.id == uuid.UUID(body.account_id))
    )
    account = acc_q.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")

    instrument = None
    if body.symbol:
        symbol_clean = body.symbol.replace("/", "").upper()
        inst_q = await db.execute(
            select(Instrument).where(Instrument.symbol == symbol_clean)
        )
        instrument = inst_q.scalar_one_or_none()
    if not instrument and body.instrument_id:
        inst_q = await db.execute(
            select(Instrument).where(Instrument.id == uuid.UUID(body.instrument_id))
        )
        instrument = inst_q.scalar_one_or_none()
    if not instrument:
        raise HTTPException(status_code=404, detail=f"Instrument not found: {body.symbol or body.instrument_id}")

    side_val = OrderSide.BUY.value if body.side.lower() == "buy" else OrderSide.SELL.value

    # Normalise order_type so 'limit'/'stop'/'stop_limit'/'market' all map
    # to the OrderType enum cleanly. Unknown values fall back to MARKET so
    # old clients can't sneak through with garbage.
    order_type_raw = (getattr(body, "order_type", None) or "market").lower().strip()
    if order_type_raw not in {"market", "limit", "stop", "stop_limit"}:
        raise HTTPException(status_code=400, detail=f"Unsupported order_type: {order_type_raw}")
    is_pending = order_type_raw in {"limit", "stop", "stop_limit"}

    # Price resolution differs by mode:
    #   * market: must use the live mid; user-supplied price is ignored.
    #   * limit/stop: admin's price is REQUIRED — that's the trigger.
    if is_pending:
        if not body.price:
            raise HTTPException(
                status_code=400,
                detail=f"price is required for {order_type_raw} orders",
            )
        target_price = Decimal(str(body.price))
        # For pending orders there's no fill yet; reference price for the
        # commission calculation uses the live mid so the eventual fill
        # gets the same commission a market trade would have.
        tick = await _get_live_price(instrument.symbol)
        ref_price = (
            Decimal(str(tick["ask"])) if (tick and side_val == "buy")
            else (Decimal(str(tick["bid"])) if tick else target_price)
        )
        fill_price = None
    else:
        target_price = None
        if body.price:
            fill_price = Decimal(str(body.price))
        else:
            tick = await _get_live_price(instrument.symbol)
            if tick:
                fill_price = Decimal(str(tick["ask"])) if side_val == "buy" else Decimal(str(tick["bid"]))
            else:
                raise HTTPException(status_code=400, detail="No live price available. Provide a price manually.")
        ref_price = fill_price

    # Brokerage / commission. Admin-created trades MUST be charged the
    # same commission a real user-placed trade would attract — otherwise
    # admin-funded test trades short-circuit the per-account ChargeConfig
    # rate table and bypass the XP-tier discount logic. resolve_commission
    # honours the full priority chain (user override → instrument →
    # segment → default → account-group), so this is the single right
    # place to compute it. For pending orders we estimate using live mid;
    # the actual commission can drift slightly when the trigger fires
    # against a different price, matching how user-placed pending orders
    # behave.
    lots_dec = Decimal(str(body.lots))
    commission = await resolve_commission(
        db, instrument, lots_dec, ref_price,
        user_id=account.user_id,
        account_group_id=account.account_group_id,
    )

    # Order row — for market orders we mark it FILLED + create the Position
    # below. For pending orders we leave it PENDING; the b-book matching
    # engine fills it later when the trigger price hits.
    order_type_value = {
        "market":     OrderType.MARKET.value,
        "limit":      OrderType.LIMIT.value,
        "stop":       OrderType.STOP.value,
        "stop_limit": OrderType.STOP_LIMIT.value,
    }[order_type_raw]
    order = Order(
        account_id=account.id,
        instrument_id=instrument.id,
        order_type=order_type_value,
        side=side_val,
        status=OrderStatus.PENDING.value if is_pending else OrderStatus.FILLED.value,
        lots=lots_dec,
        price=target_price if is_pending else fill_price,
        filled_price=None if is_pending else fill_price,
        filled_at=None if is_pending else datetime.utcnow(),
        stop_loss=Decimal(str(body.stop_loss)) if body.stop_loss else None,
        take_profit=Decimal(str(body.take_profit)) if body.take_profit else None,
        stop_limit_price=(
            Decimal(str(body.stop_limit_price))
            if (is_pending and getattr(body, "stop_limit_price", None))
            else None
        ),
        comment=body.comment or "Admin created trade",
        commission=commission,
        is_admin_created=True,
        admin_created_by=admin_id,
    )
    db.add(order)
    await db.flush()

    audit_payload = {
        "account_id": str(account.id),
        "instrument": instrument.symbol,
        "side": body.side,
        "lots": body.lots,
        "order_type": order_type_raw,
        "commission": float(commission),
    }

    if is_pending:
        # No Position yet — the b-book matching engine fills the order
        # when the live bid/ask crosses `target_price`. No margin
        # reserved, no commission debit until the fill happens (same as
        # the user-placed pending-order flow).
        audit_payload["target_price"] = float(target_price)
        await write_audit_log(
            db, admin_id, "create_stealth_pending_order", "order", order.id,
            new_values=audit_payload,
            ip_address=ip_address,
        )
        await db.commit()
        return {
            "message": "Pending order created. It will fill automatically when the price hits the target.",
            "order_id": str(order.id),
            "order_type": order_type_raw,
            "target_price": float(target_price),
            "commission_estimate": float(commission),
        }

    # ── Market order: open the Position immediately ─────────────────────
    position = Position(
        account_id=account.id,
        instrument_id=instrument.id,
        order_id=order.id,
        side=side_val,
        status=PositionStatus.OPEN.value,
        lots=lots_dec,
        open_price=fill_price,
        stop_loss=Decimal(str(body.stop_loss)) if body.stop_loss else None,
        take_profit=Decimal(str(body.take_profit)) if body.take_profit else None,
        comment=body.comment or "Admin created trade",
        commission=commission,
        is_admin_modified=True,
    )
    db.add(position)

    margin_required = lots_dec * (instrument.contract_size or Decimal("100000")) * (instrument.margin_rate or Decimal("0.01"))
    account.margin_used = (account.margin_used or Decimal("0")) + margin_required
    # Debit commission from balance just like the user-placed-trade path
    # (trading_service.place_order:322). Keeps balance / equity consistent
    # with the per-position commission column and prevents free trades
    # for admin-created positions.
    account.balance = (account.balance or Decimal("0")) - commission
    account.equity = (account.balance or Decimal("0")) + (account.credit or Decimal("0"))
    account.free_margin = account.equity - account.margin_used

    audit_payload["price"] = float(fill_price)
    await write_audit_log(
        db, admin_id, "create_stealth_trade", "position", None,
        new_values=audit_payload,
        ip_address=ip_address,
    )
    await db.commit()
    return {
        "message": "Trade created successfully",
        "order_id": str(order.id),
        "order_type": order_type_raw,
        "commission": float(commission),
    }


async def _resolve_bulk_account_ids(
    body: BulkCreateTradeRequest, db: AsyncSession,
) -> list[uuid.UUID]:
    """Build the final list of trading-account UUIDs for a bulk create.

    Order of precedence:
      1. apply_to_all → every active user's primary live (non-demo) account
      2. account_ids  → explicit list, used as-is
      3. user_ids     → resolve each to that user's primary live account

    De-duplicates while preserving order. Skips users with no live account."""
    if body.apply_to_all:
        rows = (await db.execute(
            select(TradingAccount.id)
            .join(User, User.id == TradingAccount.user_id)
            .where(
                User.status == "active",
                TradingAccount.is_demo == False,  # noqa: E712
            )
            .order_by(User.created_at.asc())
        )).scalars().all()
        seen: set[uuid.UUID] = set()
        ordered: list[uuid.UUID] = []
        for aid in rows:
            if aid not in seen:
                seen.add(aid)
                ordered.append(aid)
        return ordered

    out: list[uuid.UUID] = []
    seen2: set[uuid.UUID] = set()
    if body.account_ids:
        for s in body.account_ids:
            try:
                aid = uuid.UUID(s)
            except (TypeError, ValueError):
                continue
            if aid not in seen2:
                seen2.add(aid)
                out.append(aid)
    if body.user_ids:
        for s in body.user_ids:
            try:
                uid = uuid.UUID(s)
            except (TypeError, ValueError):
                continue
            row = (await db.execute(
                select(TradingAccount.id)
                .where(
                    TradingAccount.user_id == uid,
                    TradingAccount.is_demo == False,  # noqa: E712
                )
                .order_by(TradingAccount.created_at.asc())
                .limit(1)
            )).scalar_one_or_none()
            if row and row not in seen2:
                seen2.add(row)
                out.append(row)
    return out


async def create_stealth_trade_bulk(
    body: BulkCreateTradeRequest, admin_id: uuid.UUID, ip_address: str | None,
    db: AsyncSession,
) -> dict:
    """Place the same trade across many accounts. Each account is processed
    in its own DB session so a failure on one (e.g. insufficient margin)
    doesn't roll back successful trades on the others."""
    account_ids = await _resolve_bulk_account_ids(body, db)
    if not account_ids:
        raise HTTPException(
            status_code=400,
            detail="No accounts resolved. Pass account_ids, user_ids, or apply_to_all=true.",
        )

    results: list[dict] = []
    succeeded = 0
    failed = 0

    for aid in account_ids:
        per_request = CreateTradeRequest(
            account_id=str(aid),
            instrument_id=body.instrument_id,
            symbol=body.symbol,
            side=body.side,
            lots=body.lots,
            price=body.price,
            stop_loss=body.stop_loss,
            take_profit=body.take_profit,
            comment=body.comment,
        )
        # Each call gets its own session/transaction so per-account errors
        # are contained. We don't reuse the outer `db` because a failure
        # there would put it in a rolled-back state for subsequent users.
        try:
            async with AsyncSessionLocal() as inner_db:
                res = await create_stealth_trade(
                    body=per_request, admin_id=admin_id,
                    ip_address=ip_address, db=inner_db,
                )
            results.append({
                "account_id": str(aid), "success": True,
                "order_id": res.get("order_id"),
            })
            succeeded += 1
        except HTTPException as e:
            results.append({
                "account_id": str(aid), "success": False,
                "error": str(e.detail),
            })
            failed += 1
        except Exception as e:
            results.append({
                "account_id": str(aid), "success": False,
                "error": str(e) or e.__class__.__name__,
            })
            failed += 1

    return {
        "total": len(account_ids),
        "succeeded": succeeded,
        "failed": failed,
        "results": results,
    }
