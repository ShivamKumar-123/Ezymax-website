"""Account Service — Trading account CRUD, equity calculation, deletion."""
import json
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.common.src.models import (
    AccountGroup,
    CopyTrade,
    Deposit,
    IBCommission,
    InvestorAllocation,
    MasterAccount,
    Order,
    OrderStatus,
    Position,
    PositionStatus,
    TradeHistory,
    TradingAccount,
    Transaction,
    UserBonus,
    Withdrawal,
)
from packages.common.src.schemas import AccountSummary, MessageResponse, OpenLiveAccountRequest
from packages.common.src.redis_client import redis_client, PriceChannel


async def list_openable_account_groups(db: AsyncSession) -> dict:
    result = await db.execute(
        select(AccountGroup)
        .where(AccountGroup.is_active == True, AccountGroup.is_demo == False)
        .order_by(AccountGroup.name)
    )
    rows = result.scalars().all()
    return {
        "items": [
            {
                "id": str(g.id),
                "name": g.name,
                "description": g.description or "",
                "leverage_default": int(g.leverage_default or 100),
                "minimum_deposit": float(g.minimum_deposit or 0),
                "spread_markup": float(g.spread_markup_default or 0),
                "commission_per_lot": float(g.commission_default or 0),
                "swap_free": bool(g.swap_free),
            }
            for g in rows
        ]
    }


async def open_live_account(
    user_id: UUID, req: OpenLiveAccountRequest, db: AsyncSession,
) -> dict:
    from .auth_service import generate_account_number

    gq = await db.execute(
        select(AccountGroup).where(
            AccountGroup.id == req.account_group_id,
            AccountGroup.is_active == True,
            AccountGroup.is_demo == False,
        )
    )
    group = gq.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=400, detail="Invalid or inactive account type")

    min_d = Decimal(str(group.minimum_deposit or 0))

    live_q = await db.execute(
        select(TradingAccount).where(
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        )
    )
    existing_live = list(live_q.scalars().all())

    new_balance = Decimal("0")
    if min_d > 0 and existing_live:
        total = sum((a.balance or Decimal("0")) for a in existing_live)
        if total < min_d:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"You need at least ${float(min_d):.2f} across your existing live accounts "
                    "to open this account type. Deposit or add funds first."
                ),
            )
        remaining = min_d
        for acc in sorted(existing_live, key=lambda x: x.balance or Decimal("0"), reverse=True):
            if remaining <= 0:
                break
            bal = acc.balance or Decimal("0")
            take = min(bal, remaining)
            if take > 0:
                acc.balance = bal - take
                acc.equity = acc.balance
                acc.free_margin = acc.balance
                remaining -= take
        new_balance = min_d

    num = generate_account_number()
    lev = int(group.leverage_default or 100)
    new_acc = TradingAccount(
        user_id=user_id,
        account_group_id=group.id,
        account_number=num,
        balance=new_balance,
        equity=new_balance,
        free_margin=new_balance,
        margin_used=Decimal("0"),
        leverage=lev,
        currency="USD",
        is_demo=False,
        is_active=True,
    )
    db.add(new_acc)
    await db.commit()
    await db.refresh(new_acc)
    return {
        "id": str(new_acc.id),
        "account_number": new_acc.account_number,
        "balance": float(new_acc.balance or 0),
        "account_group_id": str(group.id),
        "account_group_name": group.name,
    }


async def list_accounts(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(TradingAccount)
        .options(selectinload(TradingAccount.account_group))
        .where(TradingAccount.user_id == user_id)
    )
    accounts = result.scalars().unique().all()

    items = []
    for a in accounts:
        unrealized_pnl = Decimal("0")
        pos_result = await db.execute(
            select(Position).where(
                Position.account_id == a.id,
                Position.status == PositionStatus.OPEN,
            )
        )
        for pos in pos_result.scalars().all():
            try:
                tick_data = await redis_client.get(PriceChannel.tick_key(pos.instrument.symbol))
                if tick_data:
                    tick = json.loads(tick_data)
                    sv = pos.side.value if hasattr(pos.side, 'value') else str(pos.side)
                    cp = Decimal(str(tick["bid"])) if sv == "buy" else Decimal(str(tick["ask"]))
                    cs = pos.instrument.contract_size if pos.instrument else Decimal("100000")
                    if sv == "buy":
                        unrealized_pnl += (cp - pos.open_price) * pos.lots * cs
                    else:
                        unrealized_pnl += (pos.open_price - cp) * pos.lots * cs
            except Exception:
                pass

        balance = a.balance or Decimal("0")
        credit = a.credit or Decimal("0")
        margin_used = a.margin_used or Decimal("0")
        equity = balance + credit + unrealized_pnl
        free_margin = equity - margin_used
        margin_level = float((equity / margin_used) * 100) if margin_used > 0 else 0

        g = a.account_group
        group_payload = None
        if g:
            group_payload = {
                "id": str(g.id),
                "name": g.name,
                "spread_markup": float(g.spread_markup_default or 0),
                "commission_per_lot": float(g.commission_default or 0),
                "minimum_deposit": float(g.minimum_deposit or 0),
                "swap_free": bool(g.swap_free),
                "leverage_default": int(g.leverage_default or 100),
            }

        items.append({
            "id": str(a.id),
            "account_number": a.account_number,
            "account_group_id": str(a.account_group_id) if a.account_group_id else None,
            "balance": float(balance),
            "credit": float(credit),
            "equity": float(equity),
            "margin_used": float(margin_used),
            "free_margin": float(free_margin),
            "margin_level": margin_level,
            "leverage": a.leverage,
            "currency": a.currency,
            "is_demo": a.is_demo,
            "is_active": a.is_active,
            "account_group": group_payload,
        })

    return {"items": items}


async def get_account(account_id: UUID, user_id: UUID, db: AsyncSession) -> TradingAccount:
    result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id,
            TradingAccount.user_id == user_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


async def get_account_summary(
    account_id: UUID, user_id: UUID, db: AsyncSession,
) -> AccountSummary:
    result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id,
            TradingAccount.user_id == user_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    positions_result = await db.execute(
        select(Position).where(
            Position.account_id == account_id,
            Position.status == PositionStatus.OPEN,
        )
    )
    open_positions = positions_result.scalars().all()

    unrealized_pnl = Decimal("0")
    for pos in open_positions:
        tick_data = await redis_client.get(PriceChannel.tick_key(pos.instrument.symbol))
        if tick_data:
            tick = json.loads(tick_data)
            current_price = Decimal(str(tick["bid"])) if pos.side.value == "buy" else Decimal(str(tick["ask"]))
            if pos.side.value == "buy":
                pnl = (current_price - pos.open_price) * pos.lots * pos.instrument.contract_size
            else:
                pnl = (pos.open_price - current_price) * pos.lots * pos.instrument.contract_size
            unrealized_pnl += pnl

    equity = account.balance + account.credit + unrealized_pnl

    return AccountSummary(
        balance=account.balance,
        credit=account.credit,
        equity=equity,
        margin_used=account.margin_used,
        free_margin=equity - account.margin_used,
        margin_level=((equity / account.margin_used) * 100) if account.margin_used > 0 else Decimal("0"),
        unrealized_pnl=unrealized_pnl,
        open_positions_count=len(open_positions),
    )


async def delete_trading_account(
    account_id: UUID, user_id: UUID, db: AsyncSession,
) -> MessageResponse:
    result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id,
            TradingAccount.user_id == user_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.is_demo:
        raise HTTPException(
            status_code=400,
            detail="Demo accounts cannot be deleted. Use a registered live profile to manage your own accounts.",
        )

    open_n = (
        await db.execute(
            select(func.count())
            .select_from(Position)
            .where(
                Position.account_id == account_id,
                Position.status.in_((PositionStatus.OPEN, PositionStatus.PARTIALLY_CLOSED)),
            )
        )
    ).scalar_one()
    if open_n and int(open_n) > 0:
        raise HTTPException(
            status_code=400,
            detail="Close all open positions before deleting this account.",
        )

    pending_n = (
        await db.execute(
            select(func.count())
            .select_from(Order)
            .where(
                Order.account_id == account_id,
                Order.status.in_(
                    (
                        OrderStatus.PENDING,
                        OrderStatus.PARTIALLY_FILLED,
                    )
                ),
            )
        )
    ).scalar_one()
    if pending_n and int(pending_n) > 0:
        raise HTTPException(
            status_code=400,
            detail="Cancel or complete pending orders before deleting this account.",
        )

    bal = account.balance or Decimal("0")
    cr = account.credit or Decimal("0")
    if bal > 0 or cr > 0:
        raise HTTPException(
            status_code=400,
            detail="Withdraw or transfer your balance and credit to zero before deleting this account.",
        )

    pos_result = await db.execute(select(Position.id).where(Position.account_id == account_id))
    pos_ids = [row[0] for row in pos_result.all()]

    if pos_ids:
        await db.execute(
            delete(TradeHistory).where(
                or_(
                    TradeHistory.account_id == account_id,
                    TradeHistory.position_id.in_(pos_ids),
                )
            )
        )
        await db.execute(
            delete(CopyTrade).where(
                or_(
                    CopyTrade.master_position_id.in_(pos_ids),
                    CopyTrade.investor_position_id.in_(pos_ids),
                )
            )
        )
    else:
        await db.execute(delete(TradeHistory).where(TradeHistory.account_id == account_id))

    master_res = await db.execute(select(MasterAccount.id).where(MasterAccount.account_id == account_id))
    master_ids = [row[0] for row in master_res.all()]
    if master_ids:
        alloc_m = await db.execute(
            select(InvestorAllocation.id).where(InvestorAllocation.master_id.in_(master_ids))
        )
        alloc_m_ids = [row[0] for row in alloc_m.all()]
        if alloc_m_ids:
            await db.execute(delete(CopyTrade).where(CopyTrade.investor_allocation_id.in_(alloc_m_ids)))
            await db.execute(delete(InvestorAllocation).where(InvestorAllocation.id.in_(alloc_m_ids)))
        await db.execute(delete(MasterAccount).where(MasterAccount.id.in_(master_ids)))

    inv_alloc = await db.execute(
        select(InvestorAllocation.id).where(InvestorAllocation.investor_account_id == account_id)
    )
    inv_alloc_ids = [row[0] for row in inv_alloc.all()]
    if inv_alloc_ids:
        await db.execute(delete(CopyTrade).where(CopyTrade.investor_allocation_id.in_(inv_alloc_ids)))
        await db.execute(delete(InvestorAllocation).where(InvestorAllocation.id.in_(inv_alloc_ids)))

    ord_res = await db.execute(select(Order.id).where(Order.account_id == account_id))
    ord_ids = [row[0] for row in ord_res.all()]
    if ord_ids:
        await db.execute(delete(IBCommission).where(IBCommission.source_trade_id.in_(ord_ids)))

    await db.execute(update(Position).where(Position.account_id == account_id).values(order_id=None))
    await db.execute(delete(Position).where(Position.account_id == account_id))
    await db.execute(delete(Order).where(Order.account_id == account_id))

    await db.execute(delete(UserBonus).where(UserBonus.account_id == account_id))
    await db.execute(delete(Deposit).where(Deposit.account_id == account_id))
    await db.execute(delete(Withdrawal).where(Withdrawal.account_id == account_id))
    await db.execute(delete(Transaction).where(Transaction.account_id == account_id))

    await db.execute(delete(TradingAccount).where(TradingAccount.id == account_id))
    await db.commit()

    return MessageResponse(message="Trading account permanently deleted.")
