"""Per-trade commission history for copy trading.

Every copy-trade close writes three Transaction rows linked by the same
`reference_id` (the follower's investor Position.id):

  1. follower side  : type='commission',       amount=-performance_fee
  2. master side    : type='ib_commission',    amount= master_share
  3. platform side  : type='admin_commission', amount= admin_fee

This module joins those rows back to the Position + CopyTrade + Instrument
+ MasterAccount + follower User so the trader UI and admin panel can show
a clean "what was earned / paid on which trade by whom" ledger.

Three query shapes:

  * `get_master_earnings(user_id, ...)`  — trader-facing self-view: a
    master sees their own ib_commission rows.

  * `get_master_commission_history(master_id, ...)` — admin-facing
    per-master drill-down: same rows but for any master, plus the
    admin-fee column from the matching admin_commission row.

  * `get_user_copy_fees_paid(user_id, ...)` — admin-facing per-follower
    view: every fee the user paid on copied trades + which master
    received the share.

All three honour `from_date`, `to_date`, pagination, and return aggregate
totals alongside the page.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    CopyTrade, Instrument, InvestorAllocation, MasterAccount,
    Position, TradingAccount, Transaction, User,
)


_MAX_PER_PAGE = 200


def _bounded_page(page: int, per_page: int) -> tuple[int, int]:
    page = max(1, int(page or 1))
    per_page = max(1, min(_MAX_PER_PAGE, int(per_page or 50)))
    return page, per_page


def _apply_date_window(query, col, from_date: Optional[datetime], to_date: Optional[datetime]):
    if from_date is not None:
        query = query.where(col >= from_date)
    if to_date is not None:
        query = query.where(col <= to_date)
    return query


# ─────────────────────────────────────────────────────────────────────
# 1. Master self-view: "my earnings from followers"
# ─────────────────────────────────────────────────────────────────────

async def get_master_earnings(
    *,
    user_id: UUID,
    db: AsyncSession,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    page: int = 1,
    per_page: int = 50,
) -> dict:
    """Master sees the commission they earned on every closed copy trade.

    Rows are ordered most-recent first. Each row carries: when, which
    follower (anonymised to first name + last initial), which symbol,
    follower's profit on that trade, the master's fee %, the master's
    share, and the position id (for support lookup).
    """
    # Confirm this user is actually a master (any approved record).
    is_master_q = await db.execute(
        select(MasterAccount.id).where(
            MasterAccount.user_id == user_id,
            MasterAccount.status.in_(["approved", "active"]),
        ).limit(1)
    )
    if is_master_q.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=403,
            detail="Earnings history is available to approved providers only.",
        )

    page, per_page = _bounded_page(page, per_page)

    # Master's ib_commission rows from copy trades. The same `type` value
    # is also used by the IB referral chain (non-copy), so we restrict to
    # rows whose reference_id maps to an investor Position via CopyTrade
    # — guarantees this view never mixes referral fees in.
    base = (
        select(
            Transaction.id.label("tx_id"),
            Transaction.amount.label("master_share"),
            Transaction.created_at.label("ts"),
            Transaction.reference_id.label("investor_position_id"),
            Position.lots.label("investor_lots"),
            Position.profit.label("investor_profit"),
            Position.side.label("side"),
            Position.open_price.label("open_price"),
            Position.close_price.label("close_price"),
            Position.closed_at.label("closed_at"),
            Instrument.symbol.label("symbol"),
            User.id.label("follower_id"),
            User.first_name.label("follower_first"),
            User.last_name.label("follower_last"),
            CopyTrade.id.label("copy_trade_id"),
        )
        .select_from(Transaction)
        .join(Position, Position.id == Transaction.reference_id)
        .join(CopyTrade, CopyTrade.investor_position_id == Position.id)
        .join(MasterAccount, MasterAccount.id == CopyTrade.master_id)
        .join(Instrument, Instrument.id == Position.instrument_id)
        .join(TradingAccount, TradingAccount.id == Position.account_id)
        .join(User, User.id == TradingAccount.user_id)
        .where(
            Transaction.user_id == user_id,
            Transaction.type == "ib_commission",
            MasterAccount.user_id == user_id,  # belt-and-braces — only this master's rows
        )
    )
    base = _apply_date_window(base, Transaction.created_at, from_date, to_date)

    # Aggregate totals — separate query so pagination doesn't truncate.
    totals_q = await db.execute(
        select(
            func.count().label("rows"),
            func.coalesce(func.sum(Transaction.amount), 0).label("total_earned"),
        )
        .select_from(Transaction)
        .join(Position, Position.id == Transaction.reference_id)
        .join(CopyTrade, CopyTrade.investor_position_id == Position.id)
        .join(MasterAccount, MasterAccount.id == CopyTrade.master_id)
        .where(
            Transaction.user_id == user_id,
            Transaction.type == "ib_commission",
            MasterAccount.user_id == user_id,
            *([] if from_date is None else [Transaction.created_at >= from_date]),
            *([] if to_date is None else [Transaction.created_at <= to_date]),
        )
    )
    tot_row = totals_q.one()
    total_rows = int(tot_row.rows or 0)
    total_earned = Decimal(str(tot_row.total_earned or 0))

    page_q = base.order_by(Transaction.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(page_q)).all()

    items = []
    for r in rows:
        name_pieces = []
        if r.follower_first:
            name_pieces.append(r.follower_first)
        if r.follower_last:
            name_pieces.append(f"{r.follower_last[:1]}.")
        items.append({
            "transaction_id": str(r.tx_id),
            "timestamp": r.ts.isoformat() if r.ts else None,
            "copy_trade_id": str(r.copy_trade_id),
            "investor_position_id": str(r.investor_position_id),
            "symbol": r.symbol,
            "side": r.side,
            "investor_lots": float(r.investor_lots or 0),
            "open_price": float(r.open_price or 0),
            "close_price": float(r.close_price or 0) if r.close_price is not None else None,
            "investor_profit": float(r.investor_profit or 0),
            "master_share_earned": float(r.master_share or 0),
            # Privacy: surface a stable but anonymised label so a master
            # can identify the relationship for support without seeing
            # the follower's full PII.
            "follower_display": " ".join(name_pieces) if name_pieces else f"Investor #{str(r.follower_id)[:8]}",
        })

    return {
        "items": items,
        "page": page,
        "per_page": per_page,
        "total_rows": total_rows,
        "total_earned": float(total_earned),
        "pages": (total_rows + per_page - 1) // per_page if total_rows else 0,
    }


# ─────────────────────────────────────────────────────────────────────
# 2. Admin per-master drill-down
# ─────────────────────────────────────────────────────────────────────

async def get_master_commission_history(
    *,
    master_id: UUID,
    db: AsyncSession,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    page: int = 1,
    per_page: int = 50,
) -> dict:
    """Admin drill-down: every commission row tied to one master account
    PLUS the admin (platform) fee on each trade so revenue is visible
    line-by-line. The platform's `admin_commission` row shares the
    same `reference_id` as the master's `ib_commission` row, so a LEFT
    JOIN on reference_id picks it up where present.
    """
    master = (await db.execute(
        select(MasterAccount).where(MasterAccount.id == master_id)
    )).scalar_one_or_none()
    if master is None:
        raise HTTPException(status_code=404, detail="Master not found")

    page, per_page = _bounded_page(page, per_page)

    # Aliased Transaction join to fetch the matching admin_commission row.
    from sqlalchemy.orm import aliased
    admin_tx = aliased(Transaction)

    base = (
        select(
            Transaction.id.label("tx_id"),
            Transaction.amount.label("master_share"),
            Transaction.created_at.label("ts"),
            Transaction.reference_id.label("investor_position_id"),
            admin_tx.amount.label("admin_share"),
            Position.lots.label("investor_lots"),
            Position.profit.label("investor_profit"),
            Position.side.label("side"),
            Position.open_price.label("open_price"),
            Position.close_price.label("close_price"),
            Instrument.symbol.label("symbol"),
            User.id.label("follower_id"),
            User.email.label("follower_email"),
            User.first_name.label("follower_first"),
            User.last_name.label("follower_last"),
            CopyTrade.id.label("copy_trade_id"),
        )
        .select_from(Transaction)
        .join(Position, Position.id == Transaction.reference_id)
        .join(CopyTrade, CopyTrade.investor_position_id == Position.id)
        .join(Instrument, Instrument.id == Position.instrument_id)
        .join(TradingAccount, TradingAccount.id == Position.account_id)
        .join(User, User.id == TradingAccount.user_id)
        .outerjoin(
            admin_tx,
            and_(
                admin_tx.reference_id == Transaction.reference_id,
                admin_tx.type == "admin_commission",
            ),
        )
        .where(
            CopyTrade.master_id == master_id,
            Transaction.user_id == master.user_id,
            Transaction.type == "ib_commission",
        )
    )
    base = _apply_date_window(base, Transaction.created_at, from_date, to_date)

    totals_q = await db.execute(
        select(
            func.count().label("rows"),
            func.coalesce(func.sum(Transaction.amount), 0).label("master_total"),
            func.coalesce(func.sum(admin_tx.amount), 0).label("admin_total"),
        )
        .select_from(Transaction)
        .join(Position, Position.id == Transaction.reference_id)
        .join(CopyTrade, CopyTrade.investor_position_id == Position.id)
        .outerjoin(
            admin_tx,
            and_(
                admin_tx.reference_id == Transaction.reference_id,
                admin_tx.type == "admin_commission",
            ),
        )
        .where(
            CopyTrade.master_id == master_id,
            Transaction.user_id == master.user_id,
            Transaction.type == "ib_commission",
            *([] if from_date is None else [Transaction.created_at >= from_date]),
            *([] if to_date is None else [Transaction.created_at <= to_date]),
        )
    )
    tot = totals_q.one()
    total_rows = int(tot.rows or 0)
    master_total = Decimal(str(tot.master_total or 0))
    admin_total = Decimal(str(tot.admin_total or 0))

    page_q = base.order_by(Transaction.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(page_q)).all()

    items = [
        {
            "transaction_id": str(r.tx_id),
            "timestamp": r.ts.isoformat() if r.ts else None,
            "copy_trade_id": str(r.copy_trade_id),
            "investor_position_id": str(r.investor_position_id),
            "symbol": r.symbol,
            "side": r.side,
            "investor_lots": float(r.investor_lots or 0),
            "open_price": float(r.open_price or 0),
            "close_price": float(r.close_price or 0) if r.close_price is not None else None,
            "investor_profit": float(r.investor_profit or 0),
            "master_share": float(r.master_share or 0),
            "admin_share": float(r.admin_share or 0) if r.admin_share is not None else 0.0,
            "follower_id": str(r.follower_id),
            "follower_email": r.follower_email,
            "follower_name": " ".join(filter(None, [r.follower_first, r.follower_last])) or r.follower_email,
        }
        for r in rows
    ]

    return {
        "master_id": str(master.id),
        "master_user_id": str(master.user_id),
        "performance_fee_pct": float(master.performance_fee_pct or 0),
        "admin_commission_pct": float(master.admin_commission_pct or 0),
        "items": items,
        "page": page,
        "per_page": per_page,
        "total_rows": total_rows,
        "pages": (total_rows + per_page - 1) // per_page if total_rows else 0,
        "totals": {
            "master_earned": float(master_total),
            "admin_revenue": float(admin_total),
            "gross_fee": float(master_total + admin_total),
        },
    }


# ─────────────────────────────────────────────────────────────────────
# 3. Admin per-follower view: "what fees did this user pay on copy trades"
# ─────────────────────────────────────────────────────────────────────

async def get_user_copy_fees_paid(
    *,
    user_id: UUID,
    db: AsyncSession,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    page: int = 1,
    per_page: int = 50,
) -> dict:
    """Admin lookup for support: how much has THIS user paid in copy-trade
    performance fees, broken down by master + trade. Follows the
    `commission` Transaction row on the follower side, then joins back
    to CopyTrade to identify which master collected the fee.
    """
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    page, per_page = _bounded_page(page, per_page)

    base = (
        select(
            Transaction.id.label("tx_id"),
            Transaction.amount.label("fee_paid"),  # negative number
            Transaction.created_at.label("ts"),
            Transaction.reference_id.label("position_id"),
            Position.lots.label("investor_lots"),
            Position.profit.label("investor_profit"),
            Position.side.label("side"),
            Position.open_price.label("open_price"),
            Position.close_price.label("close_price"),
            Instrument.symbol.label("symbol"),
            CopyTrade.id.label("copy_trade_id"),
            MasterAccount.id.label("master_id"),
            User.id.label("master_user_id"),
            User.email.label("master_email"),
            User.first_name.label("master_first"),
            User.last_name.label("master_last"),
        )
        .select_from(Transaction)
        .join(Position, Position.id == Transaction.reference_id)
        .join(CopyTrade, CopyTrade.investor_position_id == Position.id)
        .join(MasterAccount, MasterAccount.id == CopyTrade.master_id)
        .join(User, User.id == MasterAccount.user_id)
        .join(Instrument, Instrument.id == Position.instrument_id)
        .where(
            Transaction.user_id == user_id,
            Transaction.type == "commission",
            # `commission` is also used by closing-trade brokerage fees;
            # the CopyTrade INNER JOIN above guarantees we only return
            # rows tied to a real copy mirror, never plain self-trades.
        )
    )
    base = _apply_date_window(base, Transaction.created_at, from_date, to_date)

    totals_q = await db.execute(
        select(
            func.count().label("rows"),
            func.coalesce(func.sum(Transaction.amount), 0).label("total_fees"),
        )
        .select_from(Transaction)
        .join(Position, Position.id == Transaction.reference_id)
        .join(CopyTrade, CopyTrade.investor_position_id == Position.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.type == "commission",
            *([] if from_date is None else [Transaction.created_at >= from_date]),
            *([] if to_date is None else [Transaction.created_at <= to_date]),
        )
    )
    tot = totals_q.one()
    total_rows = int(tot.rows or 0)
    # fees_paid amounts are negative — display as absolute "paid" value.
    total_paid = abs(Decimal(str(tot.total_fees or 0)))

    page_q = base.order_by(Transaction.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(page_q)).all()

    items = [
        {
            "transaction_id": str(r.tx_id),
            "timestamp": r.ts.isoformat() if r.ts else None,
            "copy_trade_id": str(r.copy_trade_id),
            "investor_position_id": str(r.position_id),
            "symbol": r.symbol,
            "side": r.side,
            "investor_lots": float(r.investor_lots or 0),
            "open_price": float(r.open_price or 0),
            "close_price": float(r.close_price or 0) if r.close_price is not None else None,
            "investor_profit": float(r.investor_profit or 0),
            "fee_paid": abs(float(r.fee_paid or 0)),
            "master_id": str(r.master_id),
            "master_user_id": str(r.master_user_id),
            "master_email": r.master_email,
            "master_name": " ".join(filter(None, [r.master_first, r.master_last])) or r.master_email,
        }
        for r in rows
    ]

    return {
        "user_id": str(user_id),
        "items": items,
        "page": page,
        "per_page": per_page,
        "total_rows": total_rows,
        "pages": (total_rows + per_page - 1) // per_page if total_rows else 0,
        "total_paid": float(total_paid),
    }
