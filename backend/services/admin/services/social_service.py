"""Admin Social Trading Service — master requests, masters CRUD."""
import secrets
import uuid
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    User, MasterAccount, TradingAccount, InvestorAllocation,
    CopyTrade, TradeHistory, Transaction, Position, AccountGroup,
)
from dependencies import write_audit_log
from packages.common.src.admin_fees import credit_admin_fee
from packages.common.src.row_locks import lock_account


def _generate_pool_account_number(prefix: str = "PM") -> str:
    return f"{prefix}{secrets.randbelow(90000000) + 10000000}"


async def pamm_analytics(db: AsyncSession) -> dict:
    pamm_result = await db.execute(
        select(MasterAccount, User)
        .join(User, MasterAccount.user_id == User.id)
        .where(MasterAccount.status == "approved", MasterAccount.master_type == "pamm")
        .order_by(MasterAccount.created_at.desc())
    )
    pamm_rows = pamm_result.all()

    mam_result = await db.execute(
        select(MasterAccount, User)
        .join(User, MasterAccount.user_id == User.id)
        .where(MasterAccount.status == "approved", MasterAccount.master_type == "mamm")
        .order_by(MasterAccount.created_at.desc())
    )
    mam_rows = mam_result.all()

    # Sum all admin platform commissions (type=admin_commission from credit_admin_fee)
    fee_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == "admin_commission",
        )
    )
    admin_fee_revenue = float(fee_result.scalar() or 0)

    pamm_pools = []
    total_pamm_capital = 0.0
    for master, manager in pamm_rows:
        inv_q = await db.execute(
            select(
                func.count().label("count"),
                func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0).label("aum"),
            ).where(InvestorAllocation.master_id == master.id, InvestorAllocation.status == "active")
        )
        inv = inv_q.one()
        aum = float(inv.aum)
        total_pamm_capital += aum
        pamm_pools.append({
            "id": str(master.id),
            "manager_name": f"{manager.first_name or ''} {manager.last_name or ''}".strip() or manager.email,
            "aum": round(aum, 2),
            "active_investors": inv.count,
            "total_return_pct": float(master.total_return_pct or 0),
            "performance_fee_pct": float(master.performance_fee_pct or 0),
            "admin_commission_pct": float(master.admin_commission_pct or 0),
        })

    mam_managers = []
    total_mam_capital = 0.0
    for master, manager in mam_rows:
        inv_q = await db.execute(
            select(
                func.count().label("count"),
                func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0).label("aum"),
            ).where(InvestorAllocation.master_id == master.id, InvestorAllocation.status == "active")
        )
        inv = inv_q.one()
        aum = float(inv.aum)
        total_mam_capital += aum
        trade_q = await db.execute(
            select(func.count(TradeHistory.id)).where(TradeHistory.account_id == master.account_id)
        )
        trades_count = trade_q.scalar() or 0
        mam_managers.append({
            "id": str(master.id),
            "manager_name": f"{manager.first_name or ''} {manager.last_name or ''}".strip() or manager.email,
            "aum": round(aum, 2),
            "active_investors": inv.count,
            "trades_count": trades_count,
            "performance_fee_pct": float(master.performance_fee_pct or 0),
        })

    return {
        "summary": {
            "total_pamm_pools": len(pamm_pools),
            "total_mam_managers": len(mam_managers),
            "total_investor_capital": round(total_pamm_capital + total_mam_capital, 2),
            "admin_fee_revenue": round(admin_fee_revenue, 2),
        },
        "pamm_pools": pamm_pools,
        "mam_managers": mam_managers,
    }


async def distribute_pamm_profit(
    master_id: uuid.UUID,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.id == master_id,
            MasterAccount.master_type == "pamm",
            MasterAccount.status == "approved",
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="PAMM pool not found or not approved")

    master_pnl_result = await db.execute(
        select(func.coalesce(func.sum(TradeHistory.profit), 0)).where(
            TradeHistory.account_id == master.account_id
        )
    )
    master_total_pnl = float(master_pnl_result.scalar() or 0)
    if master_total_pnl <= 0:
        raise HTTPException(status_code=400, detail="No profit to distribute")

    alloc_result = await db.execute(
        select(InvestorAllocation, TradingAccount)
        .join(TradingAccount, InvestorAllocation.investor_account_id == TradingAccount.id)
        .where(InvestorAllocation.master_id == master_id, InvestorAllocation.status == "active")
    )
    allocations = alloc_result.all()
    if not allocations:
        raise HTTPException(status_code=400, detail="No active investors in this pool")

    total_pool = sum(float(alloc.allocation_amount or 0) for alloc, _ in allocations)
    if total_pool <= 0:
        raise HTTPException(status_code=400, detail="No capital in pool")

    perf_fee_pct = float(master.performance_fee_pct or 0)
    admin_commission_pct = float(master.admin_commission_pct or 0)

    distributions = []
    total_perf_fee = 0.0
    total_admin_fee = 0.0

    for alloc, investor_account in allocations:
        share_pct = float(alloc.allocation_amount or 0) / total_pool
        gross_due = master_total_pnl * share_pct
        already_paid = float(alloc.total_profit or 0)
        new_gross = gross_due - already_paid

        if new_gross <= 0:
            continue

        perf_fee = new_gross * perf_fee_pct / 100
        admin_fee = perf_fee * admin_commission_pct / 100
        net_profit = new_gross - perf_fee

        # C-TRADE-4 (Medium): lock the investor account before crediting the
        # settlement so it can't race a concurrent close / transfer / withdrawal.
        investor_account = await lock_account(db, alloc.investor_account_id)
        if investor_account is None:
            continue
        investor_account.balance = (investor_account.balance or Decimal("0")) + Decimal(str(round(net_profit, 8)))
        investor_account.equity = investor_account.balance + (investor_account.credit or Decimal("0"))
        alloc.total_profit = (alloc.total_profit or Decimal("0")) + Decimal(str(round(net_profit, 8)))

        db.add(Transaction(
            user_id=alloc.investor_user_id,
            account_id=alloc.investor_account_id,
            type="performance_fee",
            amount=Decimal(str(round(net_profit, 8))),
            description=f"PAMM profit distribution — {share_pct * 100:.2f}% share",
            created_by=admin_id,
        ))

        total_perf_fee += perf_fee
        total_admin_fee += admin_fee
        distributions.append({
            "allocation_id": str(alloc.id),
            "investor_user_id": str(alloc.investor_user_id),
            "share_pct": round(share_pct * 100, 2),
            "gross_profit": round(new_gross, 2),
            "performance_fee": round(perf_fee, 2),
            "net_profit": round(net_profit, 2),
        })

    master_cut = total_perf_fee - total_admin_fee
    if master_cut > 0:
        # C-TRADE-4 (Medium): lock the master pool before crediting its cut.
        master_acct = await lock_account(db, master.account_id)
        if master_acct:
            master_acct.balance = (master_acct.balance or Decimal("0")) + Decimal(str(round(master_cut, 8)))
            master_acct.equity = master_acct.balance + (master_acct.credit or Decimal("0"))
            master_acct.free_margin = master_acct.equity - (master_acct.margin_used or Decimal("0"))
            db.add(Transaction(
                user_id=master.user_id,
                account_id=master.account_id,
                type="ib_commission",
                amount=Decimal(str(round(master_cut, 8))),
                balance_after=master_acct.balance,
                description="PAMM manager performance fee earnings",
                created_by=admin_id,
            ))

        # Track master's total fee earned
        master.total_fee_earned = (master.total_fee_earned or Decimal("0")) + Decimal(str(round(master_cut, 8)))

    # Credit admin platform fee
    if total_admin_fee > 0:
        await credit_admin_fee(
            db, Decimal(str(round(total_admin_fee, 8))),
            description=f"Platform commission from PAMM profit distribution (master {master_id})",
        )

    total_net = sum(d["net_profit"] for d in distributions)
    await write_audit_log(
        db, admin_id, "distribute_pamm_profit", "master_account", master_id,
        new_values={
            "distributions_count": len(distributions),
            "total_distributed": round(total_net, 2),
            "total_performance_fees": round(total_perf_fee, 2),
        },
        ip_address=ip_address,
    )
    await db.commit()

    return {
        "message": f"Distributed profit to {len(distributions)} investor(s)",
        "total_distributed": round(total_net, 2),
        "total_performance_fees": round(total_perf_fee, 2),
        "total_admin_fees": round(total_admin_fee, 2),
        "distributions": distributions,
    }


async def list_master_requests(page: int, per_page: int, db: AsyncSession) -> dict:
    query = select(MasterAccount).where(MasterAccount.status == "pending")
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(MasterAccount.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    masters = result.scalars().all()

    items = []
    for m in masters:
        user_q = await db.execute(select(User).where(User.id == m.user_id))
        user = user_q.scalar_one_or_none()
        acc_q = await db.execute(select(TradingAccount).where(TradingAccount.id == m.account_id))
        acc = acc_q.scalar_one_or_none()
        items.append({
            "id": str(m.id),
            "user_id": str(m.user_id),
            "user_email": user.email if user else None,
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
            "account_id": str(m.account_id),
            "account_number": acc.account_number if acc else None,
            "account_balance": float(acc.balance or 0) if acc else 0,
            "status": m.status,
            "master_type": m.master_type,
            "performance_fee_pct": float(m.performance_fee_pct or 0),
            "management_fee_pct": float(m.management_fee_pct or 0),
            "admin_commission_pct": float(m.admin_commission_pct or 0),
            "max_investors": m.max_investors or 100,
            "min_investment": float(m.min_investment or 0),
            "description": m.description,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "per_page": per_page}


async def approve_master_request(
    master_id: uuid.UUID,
    admin_commission_pct: float | None,
    max_investors: int | None,
    master_type: str | None,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(MasterAccount).where(MasterAccount.id == master_id))
    master = result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Master request not found")
    if master.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    master.status = "approved"
    if admin_commission_pct is not None:
        master.admin_commission_pct = Decimal(str(admin_commission_pct))
    if max_investors is not None:
        master.max_investors = max_investors
    if master_type:
        master.master_type = master_type

    user_q = await db.execute(select(User).where(User.id == master.user_id))
    user = user_q.scalar_one_or_none()
    if user:
        user.role = "master_trader"

    # ── Pool trading account ──
    # If the applicant picked an existing live account at apply time, reuse
    # it as the master pool. Otherwise auto-create a dedicated CT/PM/MM
    # account so the master's mirror activity stays separate from their
    # personal trading.
    if master.account_id:
        existing_q = await db.execute(
            select(TradingAccount).where(TradingAccount.id == master.account_id)
        )
        pool_account = existing_q.scalar_one_or_none()
        if not pool_account:
            raise HTTPException(status_code=400, detail="Linked account no longer exists")
    else:
        effective_type = (master.master_type or "signal_provider").lower()
        prefix = "PM" if effective_type == "pamm" else ("MM" if effective_type == "mamm" else "CT")
        pool_account = TradingAccount(
            user_id=master.user_id,
            account_number=_generate_pool_account_number(prefix),
            balance=Decimal("0"),
            equity=Decimal("0"),
            free_margin=Decimal("0"),
            margin_used=Decimal("0"),
            leverage=500,
            currency="USD",
            is_demo=False,
            is_active=True,
        )
        db.add(pool_account)
        await db.flush()  # get pool_account.id
        master.account_id = pool_account.id

    await write_audit_log(
        db, admin_id, "approve_master_request", "master_account", master_id,
        new_values={
            "status": "approved",
            "admin_commission_pct": float(master.admin_commission_pct or 0),
            "master_type": master.master_type,
            "pool_account_id": str(pool_account.id),
            "pool_account_number": pool_account.account_number,
        },
        ip_address=ip_address,
    )
    await db.commit()
    return {
        "message": "Master request approved",
        "pool_account_id": str(pool_account.id),
        "pool_account_number": pool_account.account_number,
    }


async def reject_master_request(
    master_id: uuid.UUID,
    reason: str | None,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(MasterAccount).where(MasterAccount.id == master_id))
    master = result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Master request not found")
    if master.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    master.status = "rejected"
    master.description = (master.description or "") + f"\n[Rejected: {reason or 'No reason'}]"

    await write_audit_log(
        db, admin_id, "reject_master_request", "master_account", master_id,
        new_values={"status": "rejected", "reason": reason},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Master request rejected"}


async def list_masters(page: int, per_page: int, db: AsyncSession) -> dict:
    query = select(MasterAccount).where(MasterAccount.status.in_(["approved", "active"]))
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(MasterAccount.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    masters = result.scalars().all()

    items = []
    for m in masters:
        user_q = await db.execute(select(User).where(User.id == m.user_id))
        user = user_q.scalar_one_or_none()
        acc_q = await db.execute(select(TradingAccount).where(TradingAccount.id == m.account_id))
        acc = acc_q.scalar_one_or_none()

        investor_q = await db.execute(
            select(
                func.count().label("count"),
                func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0).label("aum"),
                func.coalesce(func.sum(InvestorAllocation.total_profit), 0).label("inv_profit"),
            ).where(InvestorAllocation.master_id == m.id, InvestorAllocation.status == "active")
        )
        inv = investor_q.one()

        # Admin platform commissions linked to this master via description
        acct_num = ""
        if m.account_id:
            _macct = await db.get(TradingAccount, m.account_id)
            acct_num = _macct.account_number if _macct else str(m.id)
        admin_rev_q = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.type == "admin_commission",
                Transaction.description.ilike(f"%{acct_num}%") if acct_num else Transaction.description.ilike(f"%{m.id}%"),
            )
        )
        admin_revenue = float(admin_rev_q.scalar() or 0)

        perf_fee_q = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == m.user_id,
                Transaction.type == "ib_commission",
            )
        )
        master_earnings = float(perf_fee_q.scalar() or 0)

        copy_trades_q = await db.execute(
            select(func.count(CopyTrade.id)).where(
                CopyTrade.investor_allocation_id.in_(
                    select(InvestorAllocation.id).where(InvestorAllocation.master_id == m.id)
                )
            )
        )
        total_copy_trades = copy_trades_q.scalar() or 0

        master_trades_q = await db.execute(
            select(func.count(TradeHistory.id)).where(TradeHistory.account_id == m.account_id)
        )
        total_master_trades = master_trades_q.scalar() or 0

        master_pnl_q = await db.execute(
            select(func.coalesce(func.sum(TradeHistory.profit), 0)).where(TradeHistory.account_id == m.account_id)
        )
        master_pnl = float(master_pnl_q.scalar() or 0)

        live_positions_q = await db.execute(
            select(func.count(Position.id)).where(
                Position.account_id == m.account_id,
                Position.status == "open",
            )
        )
        live_positions = live_positions_q.scalar() or 0

        items.append({
            "id": str(m.id),
            "user_id": str(m.user_id),
            "user_email": user.email if user else None,
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
            "account_number": acc.account_number if acc else None,
            "account_balance": float(acc.balance or 0) if acc else 0,
            "status": m.status,
            "master_type": m.master_type,
            "performance_fee_pct": float(m.performance_fee_pct or 0),
            "admin_commission_pct": float(m.admin_commission_pct or 0),
            "max_investors": m.max_investors or 100,
            "followers_count": m.followers_count or 0,
            "active_investors": inv.count,
            "aum": float(inv.aum),
            "total_investor_profit": float(inv.inv_profit),
            "master_earnings": master_earnings,
            "admin_revenue": admin_revenue,
            "total_return_pct": float(m.total_return_pct or 0),
            "max_drawdown_pct": float(m.max_drawdown_pct or 0),
            "min_investment": float(m.min_investment or 0),
            "total_copy_trades": total_copy_trades,
            "total_master_trades": total_master_trades,
            "master_pnl": master_pnl,
            "live_positions": live_positions,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "per_page": per_page}


async def update_master_settings(
    master_id: uuid.UUID,
    admin_commission_pct: float | None,
    max_investors: int | None,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(MasterAccount).where(MasterAccount.id == master_id))
    master = result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    if admin_commission_pct is not None:
        master.admin_commission_pct = Decimal(str(admin_commission_pct))
    if max_investors is not None:
        master.max_investors = max_investors

    await write_audit_log(
        db, admin_id, "update_master_settings", "master_account", master_id,
        new_values={"admin_commission_pct": float(master.admin_commission_pct or 0), "max_investors": master.max_investors},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Master settings updated"}


async def delete_master(
    master_id: uuid.UUID,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(MasterAccount).where(MasterAccount.id == master_id))
    master = result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    active_inv_q = await db.execute(
        select(func.count()).where(
            InvestorAllocation.master_id == master_id,
            InvestorAllocation.status == "active"
        )
    )
    active_investors = active_inv_q.scalar() or 0
    if active_investors > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete master with {active_investors} active investors. Please close all investor allocations first."
        )

    user_q = await db.execute(select(User).where(User.id == master.user_id))
    user = user_q.scalar_one_or_none()
    if user and user.role == "master_trader":
        user.role = "user"

    await db.delete(master)

    await write_audit_log(
        db, admin_id, "delete_master", "master_account", master_id,
        old_values={
            "user_id": str(master.user_id),
            "master_type": master.master_type,
            "status": master.status,
        },
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Master account deleted successfully"}


async def master_transactions(
    master_id: uuid.UUID,
    db: AsyncSession,
    page: int = 1,
    per_page: int = 20,
    filter_type: str = "all",
) -> dict:
    """Paginated transaction history on a specific master pool account.

    Same shape as the trader-side master_transactions endpoint but
    keyed by master_id so admins can audit any master without having
    to impersonate them. Surfaces ib_commission rows (with the
    originating follower), withdrawals, transfers, deposits — all
    scoped to master.account_id so general wallet activity stays out.
    """
    from packages.common.src.models import Instrument

    master_q = await db.execute(
        select(MasterAccount).where(MasterAccount.id == master_id)
    )
    master = master_q.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    if not master.account_id:
        return {
            "items": [], "page": 1, "per_page": per_page, "total": 0, "pages": 0,
            "summary": {"total_commission": 0, "total_withdrawn": 0, "total_transferred": 0, "total_deposit": 0},
            "master": {
                "id": str(master.id),
                "user_id": str(master.user_id),
                "performance_fee_pct": float(master.performance_fee_pct or 0),
                "admin_commission_pct": float(master.admin_commission_pct or 0),
            },
        }

    page = max(1, page)
    per_page = max(1, min(per_page, 100))

    type_filters: dict[str, list[str]] = {
        "all": ["ib_commission", "withdrawal", "transfer", "deposit", "bonus"],
        "commission": ["ib_commission"],
        "withdrawal": ["withdrawal"],
        "transfer": ["transfer"],
        "deposit": ["deposit", "bonus"],
    }
    allowed_types = type_filters.get(filter_type, type_filters["all"])

    count_q = await db.execute(
        select(func.count()).select_from(Transaction).where(
            Transaction.account_id == master.account_id,
            Transaction.type.in_(allowed_types),
        )
    )
    total = int(count_q.scalar() or 0)

    rows_q = await db.execute(
        select(Transaction).where(
            Transaction.account_id == master.account_id,
            Transaction.type.in_(allowed_types),
        ).order_by(Transaction.created_at.desc())
        .limit(per_page).offset((page - 1) * per_page)
    )
    txns = list(rows_q.scalars().all())

    commission_refs = [t.reference_id for t in txns if t.type == "ib_commission" and t.reference_id]
    follower_by_ref: dict = {}
    symbol_by_ref: dict = {}
    if commission_refs:
        copy_q = await db.execute(
            select(CopyTrade, InvestorAllocation, User)
            .join(InvestorAllocation, InvestorAllocation.id == CopyTrade.investor_allocation_id)
            .join(User, User.id == InvestorAllocation.investor_user_id)
            .where(CopyTrade.investor_position_id.in_(commission_refs))
        )
        for ct, alloc, follower in copy_q.all():
            follower_by_ref[ct.investor_position_id] = {
                "user_id": str(follower.id),
                "name": f"{follower.first_name or ''} {follower.last_name or ''}".strip() or follower.email,
                "email": follower.email,
            }
        pos_q = await db.execute(
            select(Position, Instrument)
            .join(Instrument, Instrument.id == Position.instrument_id)
            .where(Position.id.in_(commission_refs))
        )
        for pos, inst in pos_q.all():
            symbol_by_ref[pos.id] = {
                "symbol": inst.symbol,
                "side": str(pos.side).lower() if pos.side else None,
                "lots": float(pos.lots) if pos.lots is not None else None,
                "gross_profit": float(pos.profit) if pos.profit is not None else None,
            }

    perf_pct = float(master.performance_fee_pct or 0)
    admin_pct = float(master.admin_commission_pct or 0)

    items: list[dict] = []
    for t in txns:
        row = {
            "id": str(t.id),
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "type": t.type,
            "amount": float(t.amount or 0),
            "balance_after": float(t.balance_after) if t.balance_after is not None else None,
            "description": t.description,
            "follower": None, "symbol": None, "side": None, "lots": None,
            "gross_profit": None, "performance_fee_pct": None,
            "performance_fee_gross": None, "admin_commission_pct": None,
            "admin_fee": None, "master_net": None,
        }
        if t.type == "ib_commission":
            ref = t.reference_id
            row["follower"] = follower_by_ref.get(ref)
            sym = symbol_by_ref.get(ref) if ref else None
            if sym:
                row["symbol"] = sym["symbol"]; row["side"] = sym["side"]
                row["lots"] = sym["lots"]; row["gross_profit"] = sym["gross_profit"]
            master_net = float(t.amount or 0)
            row["master_net"] = master_net
            row["performance_fee_pct"] = perf_pct
            row["admin_commission_pct"] = admin_pct
            if admin_pct < 100:
                gross_fee = master_net / (1 - admin_pct / 100) if admin_pct else master_net
                row["performance_fee_gross"] = round(gross_fee, 4)
                row["admin_fee"] = round(gross_fee - master_net, 4)
        items.append(row)

    summary_q = await db.execute(
        select(Transaction.type, func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.account_id == master.account_id)
        .group_by(Transaction.type)
    )
    raw = {row[0]: float(row[1] or 0) for row in summary_q.all()}
    summary = {
        "total_commission": raw.get("ib_commission", 0),
        "total_withdrawn": abs(raw.get("withdrawal", 0)),
        "total_transferred": raw.get("transfer", 0),
        "total_deposit": raw.get("deposit", 0) + raw.get("bonus", 0),
    }

    master_user_q = await db.execute(select(User).where(User.id == master.user_id))
    master_user = master_user_q.scalar_one_or_none()
    return {
        "items": items,
        "page": page, "per_page": per_page, "total": total,
        "pages": (total + per_page - 1) // per_page if per_page else 1,
        "summary": summary,
        "master": {
            "id": str(master.id),
            "user_id": str(master.user_id),
            "name": (f"{master_user.first_name or ''} {master_user.last_name or ''}".strip() or master_user.email) if master_user else None,
            "email": master_user.email if master_user else None,
            "performance_fee_pct": perf_pct,
            "admin_commission_pct": admin_pct,
        },
    }
