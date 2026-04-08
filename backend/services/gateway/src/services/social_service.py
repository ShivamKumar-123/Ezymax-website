"""Social Trading Service — Leaderboard, copy trading, MAM/PAMM, followers."""
import json
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, func, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    MasterAccount, InvestorAllocation, CopyTrade,
    TradingAccount, User, Position, PositionStatus,
    TradeHistory, AllocationCopyType, Transaction,
)
from packages.common.src.redis_client import redis_client


async def _calculate_live_return(account_id: UUID) -> dict:
    equity_data = await redis_client.get(f"account_equity:{account_id}")
    if equity_data:
        return json.loads(equity_data)
    return {}


async def list_leaderboard(
    sort_by: str, page: int, per_page: int, db: AsyncSession,
) -> dict:
    count_result = await db.execute(
        select(func.count()).select_from(MasterAccount).where(
            MasterAccount.status == "approved",
            or_(
                MasterAccount.master_type == "signal_provider",
                MasterAccount.master_type.is_(None),
                MasterAccount.master_type == "",
            ),
        )
    )
    total = count_result.scalar()

    query = (
        select(MasterAccount, User.first_name, User.last_name)
        .join(User, MasterAccount.user_id == User.id)
        .where(
            MasterAccount.status == "approved",
            or_(
                MasterAccount.master_type == "signal_provider",
                MasterAccount.master_type.is_(None),
                MasterAccount.master_type == "",
            ),
        )
        .order_by(getattr(MasterAccount, sort_by).desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    rows = result.all()

    items = []
    for master, first_name, last_name in rows:
        items.append({
            "id": str(master.id),
            "provider_name": f"{first_name or ''} {last_name or ''}".strip(),
            "total_return_pct": float(master.total_return_pct),
            "max_drawdown_pct": float(master.max_drawdown_pct),
            "sharpe_ratio": float(master.sharpe_ratio),
            "followers_count": master.followers_count,
            "performance_fee_pct": float(master.performance_fee_pct),
            "min_investment": float(master.min_investment),
            "description": master.description,
            "created_at": master.created_at.isoformat() if master.created_at else None,
        })

    return {
        "items": items, "total": total, "page": page, "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def get_provider_detail(
    provider_id: UUID, user_id: UUID, db: AsyncSession,
) -> dict:
    result = await db.execute(
        select(MasterAccount, User.first_name, User.last_name)
        .join(User, MasterAccount.user_id == User.id)
        .where(MasterAccount.id == provider_id, MasterAccount.status == "approved")
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Provider not found")

    master, first_name, last_name = row

    investor_count = await db.execute(
        select(func.count()).select_from(InvestorAllocation).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
    )
    active_investors = investor_count.scalar()

    trades_result = await db.execute(
        select(func.count(), func.sum(TradeHistory.profit)).where(
            TradeHistory.account_id == master.account_id,
        )
    )
    trades_row = trades_result.one()
    total_trades = trades_row[0] or 0
    total_profit = float(trades_row[1] or 0)

    win_count_result = await db.execute(
        select(func.count()).where(
            TradeHistory.account_id == master.account_id,
            TradeHistory.profit > 0,
        )
    )
    wins = win_count_result.scalar()
    win_rate = (wins / total_trades * 100) if total_trades > 0 else 0

    monthly_result = await db.execute(
        select(
            func.date_trunc("month", TradeHistory.closed_at).label("month"),
            func.sum(TradeHistory.profit).label("profit"),
        )
        .where(TradeHistory.account_id == master.account_id)
        .group_by("month")
        .order_by("month")
    )
    monthly_breakdown = [
        {"month": str(r.month), "profit": float(r.profit)}
        for r in monthly_result.all()
    ]

    is_copying = False
    alloc_result = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status == "active",
        )
    )
    if alloc_result.scalar_one_or_none():
        is_copying = True

    return {
        "id": str(master.id),
        "provider_name": f"{first_name or ''} {last_name or ''}".strip(),
        "total_return_pct": float(master.total_return_pct),
        "max_drawdown_pct": float(master.max_drawdown_pct),
        "sharpe_ratio": float(master.sharpe_ratio),
        "followers_count": master.followers_count,
        "active_investors": active_investors,
        "performance_fee_pct": float(master.performance_fee_pct),
        "management_fee_pct": float(master.management_fee_pct),
        "min_investment": float(master.min_investment),
        "max_investors": master.max_investors,
        "description": master.description,
        "total_trades": total_trades,
        "total_profit": total_profit,
        "win_rate": round(win_rate, 2),
        "monthly_breakdown": monthly_breakdown,
        "is_copying": is_copying,
        "created_at": master.created_at.isoformat() if master.created_at else None,
    }


async def start_copy(
    master_id: UUID, account_id: UUID, amount: Decimal,
    max_drawdown_pct: Decimal | None, max_lot_override: Decimal | None,
    user_id: UUID, db: AsyncSession,
) -> dict:
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.id == master_id, MasterAccount.status == "approved"
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Provider not found")

    if master.master_type in ("pamm", "mamm"):
        raise HTTPException(
            status_code=400,
            detail="This manager runs a pooled account. Invest from the MAM/PAMM tab instead.",
        )

    if amount < master.min_investment:
        raise HTTPException(status_code=400, detail=f"Minimum investment is {master.min_investment}")

    investor_count = await db.execute(
        select(func.count()).select_from(InvestorAllocation).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
    )
    if investor_count.scalar() >= master.max_investors:
        raise HTTPException(status_code=400, detail="Provider has reached maximum investors")

    acct_result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id,
            TradingAccount.user_id == user_id,
        )
    )
    account = acct_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")
    if not account.is_active:
        raise HTTPException(status_code=403, detail="Account is not active")
    if account.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    existing = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.master_id == master_id,
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status == "active",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already copying this provider")

    allocation = InvestorAllocation(
        master_id=master_id,
        investor_user_id=user_id,
        investor_account_id=account_id,
        copy_type=AllocationCopyType.SIGNAL.value,
        allocation_amount=amount,
        max_drawdown_pct=max_drawdown_pct,
        max_lot_override=max_lot_override,
        status="active",
    )
    db.add(allocation)
    master.followers_count = (master.followers_count or 0) + 1
    await db.commit()
    await db.refresh(allocation)

    return {
        "id": str(allocation.id), "master_id": str(master_id),
        "account_id": str(account_id), "amount": float(amount),
        "copy_type": allocation.copy_type, "status": allocation.status,
        "created_at": allocation.created_at.isoformat() if allocation.created_at else None,
    }


async def my_copies(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(InvestorAllocation, MasterAccount, User.first_name, User.last_name)
        .join(MasterAccount, InvestorAllocation.master_id == MasterAccount.id)
        .join(User, MasterAccount.user_id == User.id)
        .where(
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status == "active",
        )
        .order_by(InvestorAllocation.created_at.desc())
    )
    rows = result.all()

    items = []
    for alloc, master, first_name, last_name in rows:
        items.append({
            "id": str(alloc.id), "master_id": str(master.id),
            "provider_name": f"{first_name or ''} {last_name or ''}".strip(),
            "allocation_amount": float(alloc.allocation_amount),
            "total_profit": float(alloc.total_profit),
            "total_return_pct": float(master.total_return_pct),
            "copy_type": alloc.copy_type or "signal",
            "status": alloc.status,
            "created_at": alloc.created_at.isoformat() if alloc.created_at else None,
        })
    return {"items": items, "total": len(items)}


async def stop_copy(allocation_id: UUID, user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.id == allocation_id,
            InvestorAllocation.investor_user_id == user_id,
        )
    )
    allocation = result.scalar_one_or_none()
    if not allocation:
        raise HTTPException(status_code=404, detail="Copy subscription not found")
    if allocation.status != "active":
        raise HTTPException(status_code=400, detail="Subscription already inactive")

    allocation.status = "stopped"
    master_result = await db.execute(
        select(MasterAccount).where(MasterAccount.id == allocation.master_id)
    )
    master = master_result.scalar_one_or_none()
    if master and master.followers_count and master.followers_count > 0:
        master.followers_count -= 1
    await db.commit()
    return {"message": "Copy trading stopped", "allocation_id": str(allocation_id)}


async def withdraw_managed_account(
    allocation_id: UUID, user_id: UUID, db: AsyncSession,
) -> dict:
    """Withdraw from a PAMM/MAM managed account.

    - Closes all open copied positions for this allocation
    - Returns allocation capital + accumulated profit to investor
    - Deactivates the allocation
    """
    result = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.id == allocation_id,
            InvestorAllocation.investor_user_id == user_id,
        )
    )
    allocation = result.scalar_one_or_none()
    if not allocation:
        raise HTTPException(status_code=404, detail="Investment not found")
    if allocation.status != "active":
        raise HTTPException(status_code=400, detail="Investment is already inactive")

    if allocation.copy_type not in ("pamm", "mam"):
        raise HTTPException(
            status_code=400,
            detail="Use 'Stop Copy' for signal subscriptions",
        )

    master_result = await db.execute(
        select(MasterAccount).where(MasterAccount.id == allocation.master_id)
    )
    master = master_result.scalar_one_or_none()

    # Close any open copied positions for this allocation
    from packages.common.src.models import CopyTrade, Position, PositionStatus
    import json
    from packages.common.src.redis_client import redis_client, PriceChannel

    open_copies_q = await db.execute(
        select(CopyTrade).where(
            CopyTrade.investor_allocation_id == allocation.id,
            CopyTrade.status == "open",
        )
    )
    open_copies = open_copies_q.scalars().all()

    total_closed_pnl = Decimal("0")
    for copy in open_copies:
        investor_pos = await db.get(Position, copy.investor_position_id)
        if not investor_pos or investor_pos.status != PositionStatus.OPEN:
            copy.status = "closed"
            continue

        instrument = investor_pos.instrument
        if not instrument:
            copy.status = "closed"
            continue

        tick_data = await redis_client.get(PriceChannel.tick_key(instrument.symbol))
        if not tick_data:
            continue  # defer — can't close without price

        tick = json.loads(tick_data)
        side_val = investor_pos.side.value if hasattr(investor_pos.side, "value") else str(investor_pos.side)
        close_price = Decimal(str(tick["bid"])) if side_val == "buy" else Decimal(str(tick["ask"]))
        contract_size = instrument.contract_size or Decimal("100000")

        if side_val == "buy":
            gross = (close_price - investor_pos.open_price) * investor_pos.lots * contract_size
        else:
            gross = (investor_pos.open_price - close_price) * investor_pos.lots * contract_size

        perf_fee = Decimal("0")
        if gross > 0 and master:
            perf_fee = gross * (master.performance_fee_pct or Decimal("0")) / Decimal("100")

        net = gross - perf_fee
        total_closed_pnl += net

        investor_pos.status = PositionStatus.CLOSED.value
        investor_pos.close_price = close_price
        investor_pos.profit = net
        from datetime import datetime, timezone
        investor_pos.closed_at = datetime.now(timezone.utc)

        from packages.common.src.models import TradeHistory
        db.add(TradeHistory(
            position_id=investor_pos.id,
            account_id=investor_pos.account_id,
            instrument_id=investor_pos.instrument_id,
            side=investor_pos.side,
            lots=investor_pos.lots,
            open_price=investor_pos.open_price,
            close_price=close_price,
            swap=investor_pos.swap or Decimal("0"),
            commission=investor_pos.commission or Decimal("0"),
            profit=net,
            close_reason="managed_withdrawal",
            opened_at=investor_pos.created_at,
            closed_at=datetime.now(timezone.utc),
        ))

        copy.status = "closed"

    # Update investor account balance
    investor_account = await db.get(TradingAccount, allocation.investor_account_id)
    if investor_account:
        investor_account.balance = (investor_account.balance or Decimal("0")) + total_closed_pnl
        investor_account.equity = investor_account.balance + (investor_account.credit or Decimal("0"))
        investor_account.free_margin = investor_account.equity - (investor_account.margin_used or Decimal("0"))

    # Deactivate allocation
    allocation.status = "withdrawn"
    allocation.total_profit = (allocation.total_profit or Decimal("0")) + total_closed_pnl

    if master and master.followers_count and master.followers_count > 0:
        master.followers_count -= 1

    await db.commit()

    return {
        "message": "Withdrawal complete",
        "allocation_id": str(allocation_id),
        "positions_closed": len(open_copies),
        "total_pnl": float(total_closed_pnl),
        "total_profit": float(allocation.total_profit),
    }


async def become_provider(
    account_id: UUID, master_type: str, description: str | None,
    performance_fee_pct: Decimal, management_fee_pct: Decimal,
    min_investment: Decimal, max_investors: int,
    user_id: UUID, db: AsyncSession,
) -> dict:
    # Each account type is independent — a user can have one signal_provider
    # AND one pamm/mamm account simultaneously.
    normalized_type = master_type if master_type in ("signal_provider", "pamm", "mamm") else "signal_provider"
    type_group = "signal_provider" if normalized_type == "signal_provider" else "managed"
    type_filter = (
        MasterAccount.master_type == "signal_provider"
        if type_group == "signal_provider"
        else MasterAccount.master_type.in_(["pamm", "mamm"])
    )
    existing = await db.execute(
        select(MasterAccount).where(MasterAccount.user_id == user_id, type_filter)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a provider application of this type")

    acct_result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id, TradingAccount.user_id == user_id,
        )
    )
    account = acct_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")
    if not account.is_active:
        raise HTTPException(status_code=403, detail="Account is not active")
    if account.is_demo:
        raise HTTPException(status_code=400, detail="Cannot use a demo account as provider")

    master = MasterAccount(
        user_id=user_id, account_id=account_id, status="pending",
        master_type=master_type if master_type in ("signal_provider", "pamm", "mamm") else "signal_provider",
        performance_fee_pct=performance_fee_pct, management_fee_pct=management_fee_pct,
        min_investment=min_investment, max_investors=max_investors, description=description,
    )
    db.add(master)
    await db.commit()
    await db.refresh(master)

    return {"id": str(master.id), "status": master.status, "message": "Application submitted for review"}


async def my_provider_stats(user_id: UUID, db: AsyncSession, master_type: str | None = None) -> dict:
    filters = [MasterAccount.user_id == user_id]
    if master_type == "signal_provider":
        filters.append(MasterAccount.master_type == "signal_provider")
    elif master_type in ("pamm", "mamm"):
        filters.append(MasterAccount.master_type.in_(["pamm", "mamm"]))
    result = await db.execute(
        select(MasterAccount).where(*filters).order_by(MasterAccount.created_at.desc())
    )
    master = result.scalars().first()
    if not master:
        raise HTTPException(status_code=404, detail="You are not a signal provider")

    investor_result = await db.execute(
        select(
            func.count().label("count"),
            func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0).label("total_aum"),
            func.coalesce(func.sum(InvestorAllocation.total_profit), 0).label("total_investor_profit"),
        ).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
    )
    inv_stats = investor_result.one()

    trades_result = await db.execute(
        select(func.count(), func.sum(TradeHistory.profit)).where(
            TradeHistory.account_id == master.account_id,
        )
    )
    trades_row = trades_result.one()

    return {
        "id": str(master.id), "status": master.status, "master_type": master.master_type,
        "total_return_pct": float(master.total_return_pct),
        "max_drawdown_pct": float(master.max_drawdown_pct),
        "sharpe_ratio": float(master.sharpe_ratio),
        "followers_count": master.followers_count,
        "active_investors": inv_stats.count,
        "total_aum": float(inv_stats.total_aum),
        "total_investor_profit": float(inv_stats.total_investor_profit),
        "total_trades": trades_row[0] or 0,
        "total_profit": float(trades_row[1] or 0),
        "performance_fee_pct": float(master.performance_fee_pct),
        "management_fee_pct": float(master.management_fee_pct),
        "min_investment": float(master.min_investment),
        "max_investors": master.max_investors,
        "description": master.description,
        "created_at": master.created_at.isoformat() if master.created_at else None,
    }


async def list_managed_accounts(page: int, per_page: int, db: AsyncSession) -> dict:
    count_result = await db.execute(
        select(func.count()).select_from(MasterAccount).where(
            MasterAccount.status == "approved",
            MasterAccount.master_type.in_(["mamm", "pamm"]),
        )
    )
    total = count_result.scalar()

    result = await db.execute(
        select(MasterAccount, User.first_name, User.last_name)
        .join(User, MasterAccount.user_id == User.id)
        .where(
            MasterAccount.status == "approved",
            MasterAccount.master_type.in_(["mamm", "pamm"]),
        )
        .order_by(MasterAccount.total_return_pct.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    rows = result.all()

    items = []
    for master, first_name, last_name in rows:
        investor_count = await db.execute(
            select(func.count()).select_from(InvestorAllocation).where(
                InvestorAllocation.master_id == master.id,
                InvestorAllocation.status == "active",
            )
        )
        active = investor_count.scalar()
        items.append({
            "id": str(master.id),
            "manager_name": f"{first_name or ''} {last_name or ''}".strip(),
            "master_type": master.master_type,
            "total_return_pct": float(master.total_return_pct),
            "max_drawdown_pct": float(master.max_drawdown_pct),
            "sharpe_ratio": float(master.sharpe_ratio),
            "performance_fee_pct": float(master.performance_fee_pct),
            "management_fee_pct": float(master.management_fee_pct),
            "min_investment": float(master.min_investment),
            "max_investors": master.max_investors,
            "active_investors": active,
            "slots_available": master.max_investors - active,
            "description": master.description,
        })

    return {
        "items": items, "total": total, "page": page, "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def invest_managed_account(
    master_id: UUID, account_id: UUID, amount: Decimal,
    max_drawdown_pct: Decimal | None, volume_scaling_pct: Decimal,
    user_id: UUID, db: AsyncSession,
) -> dict:
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.id == master_id,
            MasterAccount.status == "approved",
            MasterAccount.master_type.in_(["mamm", "pamm"]),
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Managed account not found")

    if amount < master.min_investment:
        raise HTTPException(status_code=400, detail=f"Minimum investment is {master.min_investment}")

    investor_count = await db.execute(
        select(func.count()).select_from(InvestorAllocation).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
    )
    if investor_count.scalar() >= master.max_investors:
        raise HTTPException(status_code=400, detail="No slots available")

    acct_result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id, TradingAccount.user_id == user_id,
        )
    )
    account = acct_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")
    if not account.is_active:
        raise HTTPException(status_code=403, detail="Account is not active")
    if account.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    existing = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.master_id == master_id,
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status == "active",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already invested in this managed account")

    alloc_pct = volume_scaling_pct if master.master_type == "mamm" else None
    copy_type_val = (
        AllocationCopyType.PAMM.value if master.master_type == "pamm"
        else AllocationCopyType.MAM.value
    )

    allocation = InvestorAllocation(
        master_id=master_id, investor_user_id=user_id,
        investor_account_id=account_id, copy_type=copy_type_val,
        allocation_amount=amount, allocation_pct=alloc_pct,
        max_drawdown_pct=max_drawdown_pct, status="active",
    )
    db.add(allocation)
    master.followers_count = (master.followers_count or 0) + 1
    await db.commit()
    await db.refresh(allocation)

    out = {
        "id": str(allocation.id), "master_id": str(master_id),
        "master_type": master.master_type, "copy_type": allocation.copy_type,
        "account_id": str(account_id), "amount": float(amount),
        "status": allocation.status,
        "created_at": allocation.created_at.isoformat() if allocation.created_at else None,
    }
    if master.master_type == "mamm":
        out["volume_scaling_pct"] = float(volume_scaling_pct)
    return out


async def get_my_followers(user_id: UUID, db: AsyncSession) -> dict:
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.user_id == user_id,
            MasterAccount.status.in_(["approved", "active"]),
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="You are not a signal provider")

    allocations_result = await db.execute(
        select(InvestorAllocation, User, TradingAccount)
        .join(User, InvestorAllocation.investor_user_id == User.id)
        .join(TradingAccount, InvestorAllocation.investor_account_id == TradingAccount.id)
        .where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
        .order_by(InvestorAllocation.created_at.desc())
    )
    allocations = allocations_result.all()

    followers = []
    for allocation, user, account in allocations:
        copy_trades_result = await db.execute(
            select(func.count()).where(CopyTrade.investor_allocation_id == allocation.id)
        )
        total_copied_trades = copy_trades_result.scalar() or 0

        profit_pct = 0
        if allocation.allocation_amount and allocation.allocation_amount > 0:
            profit_pct = (float(allocation.total_profit or 0) / float(allocation.allocation_amount)) * 100

        followers.append({
            "id": str(allocation.id),
            "user_id": str(user.id),
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
            "user_email": user.email,
            "account_number": account.account_number,
            "allocation_amount": float(allocation.allocation_amount or 0),
            "total_profit": float(allocation.total_profit or 0),
            "profit_pct": round(profit_pct, 2),
            "total_copied_trades": total_copied_trades,
            "status": allocation.status,
            "joined_at": allocation.created_at.isoformat() if allocation.created_at else None,
        })

    return {
        "master_id": str(master.id),
        "total_followers": len(followers),
        "total_aum": sum(f["allocation_amount"] for f in followers),
        "followers": followers,
    }


async def my_allocations(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(InvestorAllocation, MasterAccount, User)
        .join(MasterAccount, InvestorAllocation.master_id == MasterAccount.id)
        .join(User, MasterAccount.user_id == User.id)
        .where(
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status == "active",
            MasterAccount.master_type.in_(["pamm", "mamm"]),
        )
        .order_by(InvestorAllocation.created_at.desc())
    )
    rows = result.all()

    items = []
    for alloc, master, manager in rows:
        open_copies = await db.execute(
            select(CopyTrade, Position)
            .join(Position, CopyTrade.investor_position_id == Position.id)
            .where(
                CopyTrade.investor_allocation_id == alloc.id,
                CopyTrade.status == "open",
            )
        )
        unrealized_pnl = sum(float(pos.profit or 0) for _, pos in open_copies.all())
        realized_pnl = float(alloc.total_profit or 0)
        total_pnl = realized_pnl + unrealized_pnl
        invested = float(alloc.allocation_amount or 0)
        current_value = invested + total_pnl
        pnl_pct = (total_pnl / invested * 100) if invested > 0 else 0.0

        items.append({
            "id": str(alloc.id),
            "master_id": str(master.id),
            "manager_name": f"{manager.first_name or ''} {manager.last_name or ''}".strip() or manager.email,
            "master_type": master.master_type,
            "allocation_amount": round(invested, 2),
            "current_value": round(current_value, 2),
            "realized_pnl": round(realized_pnl, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "total_pnl": round(total_pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "performance_fee_pct": float(master.performance_fee_pct),
            "joined_at": alloc.created_at.isoformat() if alloc.created_at else None,
            "status": alloc.status,
        })

    total_invested = sum(i["allocation_amount"] for i in items)
    total_current = sum(i["current_value"] for i in items)
    total_pnl_all = sum(i["total_pnl"] for i in items)
    overall_pct = (total_pnl_all / total_invested * 100) if total_invested > 0 else 0.0

    return {
        "items": items,
        "summary": {
            "total_invested": round(total_invested, 2),
            "total_current_value": round(total_current, 2),
            "total_pnl": round(total_pnl_all, 2),
            "overall_pnl_pct": round(overall_pct, 2),
        },
    }


async def master_investors(user_id: UUID, db: AsyncSession) -> dict:
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.user_id == user_id,
            MasterAccount.status.in_(["approved", "active"]),
            MasterAccount.master_type.in_(["pamm", "mamm"]),
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="You are not an approved PAMM/MAM manager")

    allocations_result = await db.execute(
        select(InvestorAllocation, User, TradingAccount)
        .join(User, InvestorAllocation.investor_user_id == User.id)
        .join(TradingAccount, InvestorAllocation.investor_account_id == TradingAccount.id)
        .where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
        .order_by(InvestorAllocation.created_at.desc())
    )
    allocations = allocations_result.all()

    total_aum = sum(float(alloc.allocation_amount or 0) for alloc, _, _ in allocations)

    investors = []
    for allocation, user, account in allocations:
        invested = float(allocation.allocation_amount or 0)
        pnl = float(allocation.total_profit or 0)
        pnl_pct = (pnl / invested * 100) if invested > 0 else 0.0
        share_pct = (invested / total_aum * 100) if total_aum > 0 else 0.0

        investors.append({
            "id": str(allocation.id),
            "user_id": str(user.id),
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
            "user_email": user.email,
            "account_number": account.account_number,
            "allocated": round(invested, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "share_pct": round(share_pct, 2),
            "copy_type": allocation.copy_type,
            "joined_at": allocation.created_at.isoformat() if allocation.created_at else None,
        })

    return {
        "master_id": str(master.id),
        "master_type": master.master_type,
        "total_aum": round(total_aum, 2),
        "total_investors": len(investors),
        "investors": investors,
    }


async def master_performance(user_id: UUID, db: AsyncSession) -> dict:
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.user_id == user_id,
            MasterAccount.master_type.in_(["pamm", "mamm"]),
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="You are not a PAMM/MAM manager")

    investor_stats = await db.execute(
        select(
            func.count().label("count"),
            func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0).label("total_aum"),
        ).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
    )
    inv_row = investor_stats.one()

    fee_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.account_id == master.account_id,
            Transaction.type == "performance_fee",
        )
    )
    fee_earnings = float(fee_result.scalar() or 0)

    monthly_result = await db.execute(
        select(
            extract("year", TradeHistory.closed_at).label("year"),
            extract("month", TradeHistory.closed_at).label("month"),
            func.sum(TradeHistory.profit).label("profit"),
        )
        .where(TradeHistory.account_id == master.account_id)
        .group_by("year", "month")
        .order_by("year", "month")
    )

    cumulative = 0.0
    monthly_breakdown = []
    for row in monthly_result.all():
        profit = float(row.profit or 0)
        cumulative += profit
        monthly_breakdown.append({
            "month": f"{int(row.year)}-{int(row.month):02d}",
            "profit": round(profit, 2),
            "cumulative": round(cumulative, 2),
        })

    return {
        "id": str(master.id),
        "status": master.status,
        "master_type": master.master_type,
        "total_aum": float(inv_row.total_aum),
        "total_investors": inv_row.count,
        "fee_earnings": round(fee_earnings, 2),
        "total_return_pct": float(master.total_return_pct),
        "max_drawdown_pct": float(master.max_drawdown_pct),
        "sharpe_ratio": float(master.sharpe_ratio),
        "performance_fee_pct": float(master.performance_fee_pct),
        "management_fee_pct": float(master.management_fee_pct),
        "admin_commission_pct": float(master.admin_commission_pct),
        "min_investment": float(master.min_investment),
        "max_investors": master.max_investors,
        "description": master.description,
        "monthly_breakdown": monthly_breakdown,
    }
