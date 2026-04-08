"""Admin User Service — user listing, detail, fund/credit ops, ban, kill switch, login-as."""
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import jwt
from fastapi import HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.models import (
    User, TradingAccount, Position, Order, Transaction, Deposit, Withdrawal,
    PositionStatus, OrderStatus,
)
from packages.common.src.admin_schemas import (
    UserOut, UserDetailOut, TradingAccountOut,
    FundRequest, CreditRequest,
)
from dependencies import write_audit_log

settings = get_settings()


def _user_to_out(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "phone": u.phone,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "date_of_birth": u.date_of_birth,
        "country": u.country,
        "address": u.address,
        "role": u.role,
        "status": u.status,
        "kyc_status": u.kyc_status,
        "is_demo": u.is_demo,
        "language": u.language,
        "theme": u.theme,
        "trading_blocked_until": u.trading_blocked_until,
        "created_at": u.created_at,
        "updated_at": u.updated_at,
    }


def _account_to_out(a: TradingAccount) -> dict:
    return {
        "id": str(a.id),
        "user_id": str(a.user_id),
        "account_group_id": str(a.account_group_id) if a.account_group_id else None,
        "account_number": a.account_number,
        "balance": float(a.balance or 0),
        "credit": float(a.credit or 0),
        "equity": float(a.equity or 0),
        "margin_used": float(a.margin_used or 0),
        "free_margin": float(a.free_margin or 0),
        "margin_level": float(a.margin_level or 0),
        "leverage": a.leverage,
        "currency": a.currency,
        "is_demo": a.is_demo,
        "is_active": a.is_active,
        "created_at": a.created_at,
    }


async def list_users(
    page: int, per_page: int, search: str | None,
    status_filter: str | None, kyc_filter: str | None,
    group_id: str | None, db: AsyncSession,
) -> dict:
    query = select(User).where(User.role.notin_(["admin", "super_admin"]))

    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                User.email.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                User.phone.ilike(term),
            )
        )
    if status_filter:
        query = query.where(User.status == status_filter)
    if kyc_filter:
        query = query.where(User.kyc_status == kyc_filter)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    user_ids = [u.id for u in users]
    balance_map: dict = {}
    if user_ids:
        acc_q = await db.execute(
            select(
                TradingAccount.user_id,
                func.coalesce(func.sum(TradingAccount.balance), 0).label("total_balance"),
                func.coalesce(func.sum(TradingAccount.equity), 0).label("total_equity"),
            )
            .where(TradingAccount.user_id.in_(user_ids))
            .group_by(TradingAccount.user_id)
        )
        for row in acc_q.all():
            balance_map[row[0]] = {"balance": float(row[1]), "equity": float(row[2])}

    user_list = []
    for u in users:
        name = " ".join(filter(None, [u.first_name, u.last_name])) or u.email.split("@")[0]
        bals = balance_map.get(u.id, {"balance": 0.0, "equity": 0.0})
        user_list.append({
            "id": str(u.id),
            "name": name,
            "email": u.email,
            "balance": bals["balance"],
            "equity": bals["equity"],
            "group": u.role or "user",
            "kyc_status": u.kyc_status or "pending",
            "status": u.status or "active",
        })

    pages = max(1, (total + per_page - 1) // per_page)
    return {
        "users": user_list,
        "total": total,
        "page": page,
        "pages": pages,
    }


async def get_user_detail(user_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    accounts_q = await db.execute(
        select(TradingAccount).where(TradingAccount.user_id == user_id)
    )
    accounts = accounts_q.scalars().all()

    dep_q = await db.execute(
        select(func.coalesce(func.sum(Deposit.amount), 0)).where(
            Deposit.user_id == user_id,
            Deposit.status.in_(["approved", "auto_approved"]),
        )
    )
    total_deposit = float(dep_q.scalar() or 0)

    wd_q = await db.execute(
        select(func.coalesce(func.sum(Withdrawal.amount), 0)).where(
            Withdrawal.user_id == user_id,
            Withdrawal.status.in_(["approved", "completed"]),
        )
    )
    total_withdrawal = float(wd_q.scalar() or 0)

    account_ids = [a.id for a in accounts]
    total_trades = 0
    open_positions = 0
    if account_ids:
        trades_q = await db.execute(
            select(func.count(Order.id)).where(Order.account_id.in_(account_ids))
        )
        total_trades = trades_q.scalar() or 0

        pos_q = await db.execute(
            select(func.count(Position.id)).where(
                Position.account_id.in_(account_ids),
                Position.status == PositionStatus.OPEN.value,
            )
        )
        open_positions = pos_q.scalar() or 0

    return UserDetailOut(
        user=UserOut(**_user_to_out(user)),
        accounts=[TradingAccountOut(**_account_to_out(a)) for a in accounts],
        total_deposit=total_deposit,
        total_withdrawal=total_withdrawal,
        total_trades=total_trades,
        open_positions=open_positions,
    )


async def add_fund(
    user_id: uuid.UUID, body: FundRequest,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    """Add funds to user's MAIN WALLET. User must transfer to trading account manually."""
    from packages.common.src.notify import create_notification

    user_result = await db.execute(select(User).where(User.id == user_id))
    user_row = user_result.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    old_balance = user_row.main_wallet_balance or Decimal("0")
    user_row.main_wallet_balance = old_balance + Decimal(str(body.amount))

    txn = Transaction(
        user_id=user_id,
        account_id=None,  # Main wallet — no trading account
        type="adjustment",
        amount=Decimal(str(body.amount)),
        balance_after=user_row.main_wallet_balance,
        description=body.description or "Admin fund addition to main wallet",
        created_by=admin_id,
    )
    db.add(txn)

    await write_audit_log(
        db, admin_id, "add_fund", "user", user_id,
        old_values={"main_wallet_balance": float(old_balance)},
        new_values={"main_wallet_balance": float(user_row.main_wallet_balance), "amount_added": body.amount},
        ip_address=ip_address,
    )
    await create_notification(
        db,
        user_id,
        title="Funds Added",
        message=(
            f"${float(body.amount):,.2f} has been added to your main wallet. "
            "You can now transfer it to your trading account from the Wallet page."
        ),
        notif_type="deposit",
        action_url="/wallet",
        commit=False,
    )
    await db.commit()
    return {
        "message": "Fund added to main wallet successfully",
        "new_main_wallet_balance": float(user_row.main_wallet_balance),
    }


async def deduct_fund(
    user_id: uuid.UUID, body: FundRequest,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    """Deduct funds from user's MAIN WALLET first. If insufficient, deduct from specified trading account."""
    amt = Decimal(str(body.amount))

    # Try main wallet first
    user_result = await db.execute(select(User).where(User.id == user_id))
    user_row = user_result.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    main_bal = user_row.main_wallet_balance or Decimal("0")

    if main_bal >= amt:
        # Deduct from main wallet
        user_row.main_wallet_balance = main_bal - amt
        txn = Transaction(
            user_id=user_id,
            account_id=None,
            type="adjustment",
            amount=-amt,
            balance_after=user_row.main_wallet_balance,
            description=body.description or "Admin fund deduction from main wallet",
            created_by=admin_id,
        )
        db.add(txn)
        await write_audit_log(
            db, admin_id, "deduct_fund", "user", user_id,
            old_values={"main_wallet_balance": float(main_bal)},
            new_values={"main_wallet_balance": float(user_row.main_wallet_balance), "amount_deducted": body.amount},
            ip_address=ip_address,
        )
        await db.commit()
        return {
            "message": "Fund deducted from main wallet successfully",
            "new_main_wallet_balance": float(user_row.main_wallet_balance),
        }

    # Fallback: deduct from trading account if account_id is provided
    if not getattr(body, "account_id", None):
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient main wallet balance (${float(main_bal):.2f}). Provide a trading account ID to deduct from trading account.",
        )

    account_result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == uuid.UUID(body.account_id),
            TradingAccount.user_id == user_id,
        )
    )
    account = account_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")

    old_balance = account.balance or Decimal("0")
    if old_balance < amt:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance in both main wallet (${float(main_bal):.2f}) and trading account (${float(old_balance):.2f})",
        )

    account.balance = old_balance - amt
    account.equity = account.balance + (account.credit or Decimal("0"))
    account.free_margin = account.equity - (account.margin_used or Decimal("0"))

    txn = Transaction(
        user_id=user_id,
        account_id=account.id,
        type="adjustment",
        amount=-amt,
        balance_after=account.balance,
        description=body.description or "Admin fund deduction from trading account",
        created_by=admin_id,
    )
    db.add(txn)
    await write_audit_log(
        db, admin_id, "deduct_fund", "trading_account", account.id,
        old_values={"balance": float(old_balance)},
        new_values={"balance": float(account.balance), "amount_deducted": body.amount},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Fund deducted from trading account successfully", "new_balance": float(account.balance)}


async def give_credit(
    user_id: uuid.UUID, body: CreditRequest,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    account_result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == uuid.UUID(body.account_id),
            TradingAccount.user_id == user_id,
        )
    )
    account = account_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")

    old_credit = float(account.credit or 0)
    account.credit = Decimal(str(old_credit)) + Decimal(str(body.amount))
    account.equity = (account.balance or Decimal("0")) + account.credit

    txn = Transaction(
        user_id=user_id,
        account_id=account.id,
        type="credit",
        amount=Decimal(str(body.amount)),
        balance_after=account.balance,
        description=body.description or "Admin credit addition",
        created_by=admin_id,
    )
    db.add(txn)

    await write_audit_log(
        db, admin_id, "give_credit", "trading_account", account.id,
        old_values={"credit": old_credit},
        new_values={"credit": float(account.credit), "amount": body.amount},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Credit added successfully", "new_credit": float(account.credit)}


async def take_credit(
    user_id: uuid.UUID, body: CreditRequest,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    account_result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == uuid.UUID(body.account_id),
            TradingAccount.user_id == user_id,
        )
    )
    account = account_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")

    old_credit = float(account.credit or 0)
    if old_credit < body.amount:
        raise HTTPException(status_code=400, detail="Insufficient credit")

    account.credit = Decimal(str(old_credit)) - Decimal(str(body.amount))
    account.equity = (account.balance or Decimal("0")) + account.credit

    txn = Transaction(
        user_id=user_id,
        account_id=account.id,
        type="credit",
        amount=-Decimal(str(body.amount)),
        balance_after=account.balance,
        description=body.description or "Admin credit removal",
        created_by=admin_id,
    )
    db.add(txn)

    await write_audit_log(
        db, admin_id, "take_credit", "trading_account", account.id,
        old_values={"credit": old_credit},
        new_values={"credit": float(account.credit), "amount_removed": body.amount},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Credit removed successfully", "new_credit": float(account.credit)}


async def ban_user(
    user_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_status = user.status
    user.status = "banned"

    await write_audit_log(
        db, admin_id, "ban_user", "user", user_id,
        old_values={"status": old_status},
        new_values={"status": "banned"},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "User banned successfully"}


async def unban_user(
    user_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_status = user.status
    user.status = "active"

    await write_audit_log(
        db, admin_id, "unban_user", "user", user_id,
        old_values={"status": old_status},
        new_values={"status": "active"},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "User unbanned successfully"}


async def block_trading(
    user_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    far_future = datetime.utcnow() + timedelta(days=36500)
    user.trading_blocked_until = far_future

    await write_audit_log(
        db, admin_id, "block_trading", "user", user_id,
        new_values={"trading_blocked_until": far_future.isoformat()},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Trading blocked successfully"}


async def kill_switch(
    user_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    accounts_q = await db.execute(
        select(TradingAccount).where(TradingAccount.user_id == user_id)
    )
    accounts = accounts_q.scalars().all()
    account_ids = [a.id for a in accounts]

    closed_count = 0
    if account_ids:
        positions_q = await db.execute(
            select(Position).where(
                Position.account_id.in_(account_ids),
                Position.status == PositionStatus.OPEN.value,
            )
        )
        positions = positions_q.scalars().all()
        for pos in positions:
            pos.status = PositionStatus.CLOSED.value
            pos.close_price = pos.open_price
            pos.closed_at = datetime.utcnow()
            pos.profit = Decimal("0")
            pos.is_admin_modified = True
            closed_count += 1

    far_future = datetime.utcnow() + timedelta(days=36500)
    user.trading_blocked_until = far_future

    await write_audit_log(
        db, admin_id, "kill_switch", "user", user_id,
        new_values={"positions_closed": closed_count, "trading_blocked": True},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": f"Kill switch activated. {closed_count} positions closed. Trading disabled."}


async def login_as_user(
    user_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    expire = datetime.utcnow() + timedelta(hours=2)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "type": "user",
        "impersonated_by": str(admin_id),
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, settings.USER_JWT_SECRET, algorithm=settings.USER_JWT_ALGORITHM)

    await write_audit_log(
        db, admin_id, "login_as_user", "user", user_id,
        new_values={"impersonated_user_email": user.email},
        ip_address=ip_address,
    )
    await db.commit()

    return {"access_token": token, "token_type": "bearer", "user_email": user.email}
