"""Admin Transaction Service — paginated listing and summary."""

import uuid  # noqa: F401  (used in type hints below)
from datetime import datetime

from sqlalchemy import select, func, or_, case
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import User, TradingAccount, Transaction
from packages.common.src.admin_schemas import AdminTransactionOut, PaginatedResponse

# Frontend filter chips map to one-or-more underlying transaction types.
_TYPE_GROUPS = {
    "deposit": ("deposit",),
    "withdrawal": ("withdrawal",),
    "transfer": ("transfer",),
    "trading": ("profit", "loss"),
    "adjustment": ("adjustment", "correction", "bonus", "bonus_release", "admin_commission"),
}


def _txn_to_out(
    t: Transaction,
    user: User = None,
    account: TradingAccount = None,
    admin: User = None,
) -> AdminTransactionOut:
    return AdminTransactionOut(
        id=str(t.id),
        user_id=str(t.user_id) if t.user_id else None,
        account_id=str(t.account_id) if t.account_id else None,
        type=t.type,
        amount=float(t.amount or 0),
        balance_after=float(t.balance_after) if t.balance_after is not None else None,
        reference_id=str(t.reference_id) if t.reference_id else None,
        description=t.description,
        created_by=str(t.created_by) if t.created_by else None,
        created_at=t.created_at,
        user_email=user.email if user else None,
        user_name=f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
        account_number=account.account_number if account else None,
        admin_email=admin.email if admin else None,
        admin_name=f"{admin.first_name or ''} {admin.last_name or ''}".strip() if admin else None,
    )


# Trade P&L Transaction rows (one per close, type='profit' or 'loss')
# duplicate the data that already appears under Trades → History. Admins
# kept asking why their Transactions tab was flooded with `+$0.00 Profit`
# break-even rows, so we hide them here. The DB still has them (the
# Transaction ledger is the source of truth for balance reconciliation);
# this is a presentation-only filter. If a future admin tool genuinely
# needs to scan profit/loss txs, query the table directly or extend the
# type filter explicitly.
_HIDDEN_FROM_ADMIN_TX = ("profit", "loss")


async def list_transactions(
    page: int,
    per_page: int,
    type_filter: str | None,
    search: str | None,
    db: AsyncSession,
    user_id: "uuid.UUID | None" = None,
    include_trade_pnl: bool = False,
    account_id: "uuid.UUID | None" = None,
    main_only: bool = False,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    query = select(Transaction)

    # Per-user filter for the user-detail ledger page. When admin
    # drills into a single user's full ledger we DO want to see the
    # trade-P&L rows there (otherwise the "complete ledger" wouldn't
    # be complete) — caller passes include_trade_pnl=True alongside
    # user_id to opt into that.
    if user_id is not None:
        query = query.where(Transaction.user_id == user_id)

    if type_filter and type_filter != "all":
        # A filter chip maps to one or more underlying types (e.g. P&L =
        # profit|loss, Adjustments = adjustment|correction|bonus…). An
        # unknown value is treated as an exact type for URL drill-downs.
        grp = _TYPE_GROUPS.get(type_filter)
        query = query.where(
            Transaction.type.in_(grp) if grp else Transaction.type == type_filter
        )
    elif not include_trade_pnl:
        query = query.where(Transaction.type.notin_(_HIDDEN_FROM_ADMIN_TX))

    # Account scope: a specific trading account, or the main-wallet bucket
    # (account_id IS NULL), or all (neither set).
    if account_id is not None:
        query = query.where(Transaction.account_id == account_id)
    elif main_only:
        query = query.where(Transaction.account_id.is_(None))

    # Date range — frontend sends timezone-correct UTC boundaries (local-day
    # start .. exclusive next-local-midnight) so filtering matches the
    # local-time ledger table. created_at is timestamptz, so the raw
    # timestamp comparison is timezone-correct.
    def _parse_iso(s: str):
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None
    if date_from:
        dfrom = _parse_iso(date_from)
        if dfrom is not None:
            query = query.where(Transaction.created_at >= dfrom)
    if date_to:
        dto = _parse_iso(date_to)
        if dto is not None:
            query = query.where(Transaction.created_at < dto)

    if search:
        user_ids_q = select(User.id).where(
            or_(
                User.email.ilike(f"%{search}%"),
                User.first_name.ilike(f"%{search}%"),
                User.last_name.ilike(f"%{search}%"),
            )
        )
        account_ids_q = select(TradingAccount.id).where(
            TradingAccount.account_number.ilike(f"%{search}%")
        )
        query = query.where(
            or_(
                Transaction.user_id.in_(user_ids_q),
                Transaction.account_id.in_(account_ids_q),
                Transaction.description.ilike(f"%{search}%"),
            )
        )

    # Summary over the FULL filtered set (count + money in/out/net) — NOT the
    # current page, so the cards are correct regardless of pagination.
    sub = query.subquery()
    srow = (await db.execute(
        select(
            func.count(),
            func.coalesce(func.sum(case((sub.c.amount > 0, sub.c.amount), else_=0)), 0),
            func.coalesce(func.sum(case((sub.c.amount < 0, -sub.c.amount), else_=0)), 0),
        ).select_from(sub)
    )).first()
    total = int(srow[0] or 0)
    total_in = float(srow[1] or 0)
    total_out = float(srow[2] or 0)
    summary = {"count": total, "total_in": total_in, "total_out": total_out, "net": total_in - total_out}

    query = query.order_by(Transaction.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page)
    result = await db.execute(query)
    transactions = result.scalars().all()

    user_ids = set()
    account_ids = set()
    admin_ids = set()
    for t in transactions:
        if t.user_id:
            user_ids.add(t.user_id)
        if t.account_id:
            account_ids.add(t.account_id)
        if t.created_by:
            admin_ids.add(t.created_by)

    users_map: dict = {}
    if user_ids:
        q = await db.execute(select(User).where(User.id.in_(list(user_ids))))
        for u in q.scalars().all():
            users_map[u.id] = u

    accounts_map: dict = {}
    if account_ids:
        q = await db.execute(select(TradingAccount).where(TradingAccount.id.in_(list(account_ids))))
        for a in q.scalars().all():
            accounts_map[a.id] = a

    admins_map: dict = {}
    if admin_ids:
        q = await db.execute(select(User).where(User.id.in_(list(admin_ids))))
        for u in q.scalars().all():
            admins_map[u.id] = u

    items = []
    for t in transactions:
        items.append(_txn_to_out(
            t,
            user=users_map.get(t.user_id),
            account=accounts_map.get(t.account_id),
            admin=admins_map.get(t.created_by),
        ))

    return {"items": items, "total": total, "page": page, "per_page": per_page, "summary": summary}


async def get_transaction_summary(db: AsyncSession) -> dict:
    # Mirror the visible-list filter — counts shown next to the
    # Transactions tab should match the rows the admin actually sees,
    # so the trade-P&L rows are excluded from totals too.
    total_q = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.type.notin_(_HIDDEN_FROM_ADMIN_TX))
    )
    total_count = total_q.scalar() or 0

    type_counts_q = await db.execute(
        select(Transaction.type, func.count(Transaction.id), func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.type.notin_(_HIDDEN_FROM_ADMIN_TX))
        .group_by(Transaction.type)
    )
    type_breakdown = {}
    for row in type_counts_q.all():
        type_breakdown[row[0]] = {"count": row[1], "total_amount": float(row[2])}

    return {
        "total_transactions": total_count,
        "type_breakdown": type_breakdown,
    }
