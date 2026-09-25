"""Social Trading Service — Leaderboard, copy trading, MAM/PAMM, followers."""
import json
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, func, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    MasterAccount, InvestorAllocation, CopyTrade,
    TradingAccount, User, Position, PositionStatus,
    TradeHistory, AllocationCopyType, Transaction,
    Referral, AccountGroup, Instrument,
)
from packages.common.src.copy_fees import apply_hwm_fee
from packages.common.src.row_locks import lock_user, lock_account
from packages.common.src.redis_client import redis_client
from packages.common.src.price_cache import price_cache
from packages.common.src.trading_service import calc_position_pnl, cross_rate_for


async def _live_open_pnl(pos, instrument) -> float:
    """Recompute an OPEN position's P&L from the CURRENT tick so a follower's
    copy P&L tracks the price in real time — the stored `pos.profit` only
    refreshes on a slow cadence, which made copy P&L lag the actual move and
    diverge between web and mobile. Currency-converted (via calc_position_pnl).
    Falls back to the stored profit when no live tick is cached."""
    try:
        tick_data = await price_cache.get(instrument.symbol)
        if tick_data:
            tick = json.loads(tick_data)
            sv = pos.side.value if hasattr(pos.side, "value") else str(pos.side)
            cp = Decimal(str(tick["bid"])) if sv == "buy" else Decimal(str(tick["ask"]))
            cs = instrument.contract_size or Decimal("100000")
            return float(calc_position_pnl(
                pos.side, pos.open_price, cp, pos.lots, cs, instrument=instrument,
                cross_rate=await cross_rate_for(instrument),
            ))
    except Exception:
        pass
    return float(pos.profit or 0)


async def _pool_value_with_floating(db: AsyncSession, pool_account) -> Decimal:
    """H-TRADE-2: value a PAMM pool at balance PLUS the live floating P&L of its
    open positions, so NAV for subscribe/redeem reflects true value. Using bare
    balance let a joiner buy units cheaply during an unrealised gain (or dear
    during a loss), diluting existing holders."""
    base = pool_account.balance or Decimal("0")
    pos_rows = (await db.execute(
        select(Position).where(
            Position.account_id == pool_account.id,
            Position.status == PositionStatus.OPEN,
        )
    )).scalars().all()
    floating = Decimal("0")
    for pos in pos_rows:
        inst = pos.instrument
        if not inst:
            continue
        floating += Decimal(str(await _live_open_pnl(pos, inst)))
    return base + floating


def _gen_investor_account_number(copy_type: str = "signal") -> str:
    """Generate a unique account number for an auto-created investor sub-account."""
    prefix = "CF"  # Copy Fund
    if copy_type in ("pamm", "mam"):
        prefix = "IF"  # Investment Fund
    return f"{prefix}{secrets.randbelow(90000000) + 10000000}"


async def _calculate_live_return(account_id: UUID) -> dict:
    equity_data = await redis_client.get(f"account_equity:{account_id}")
    if equity_data:
        return json.loads(equity_data)
    return {}


async def list_leaderboard(
    sort_by: str, page: int, per_page: int, user_id: UUID, db: AsyncSession,
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

        # Real follower count = count of ACTIVE allocations (excludes closed/paused/etc)
        real_followers_q = await db.execute(
            select(func.count()).select_from(InvestorAllocation).where(
                InvestorAllocation.master_id == master.id,
                InvestorAllocation.status == "active",
            )
        )
        real_followers = real_followers_q.scalar() or 0

        # Real trade stats straight from trade_history — the raw numbers a
        # follower can sanity-check the ROI against.
        from packages.common.src.models import TradeHistory as _TH
        from sqlalchemy import case as _case
        tstats = (
            await db.execute(
                select(
                    func.count(),
                    func.coalesce(func.sum(_case((_TH.profit > 0, 1), else_=0)), 0),
                    func.coalesce(func.sum(_TH.profit), 0),
                ).where(_TH.account_id == master.account_id)
            )
        ).one()
        total_trades = int(tstats[0] or 0)
        wins = int(tstats[1] or 0)
        win_rate = (wins / total_trades * 100) if total_trades else 0.0

        items.append({
            "id": str(master.id),
            "user_id": str(master.user_id),
            "provider_name": f"{first_name or ''} {last_name or ''}".strip(),
            "total_return_pct": float(master.total_return_pct),
            "max_drawdown_pct": float(master.max_drawdown_pct),
            "sharpe_ratio": float(master.sharpe_ratio),
            "win_rate": round(win_rate, 2),
            "total_trades": total_trades,
            "total_profit_usd": round(float(tstats[2] or 0), 2),
            "followers_count": real_followers,
            "performance_fee_pct": float(master.performance_fee_pct),
            "min_investment": float(master.min_investment),
            "description": master.description,
            "strategy_info": getattr(master, "strategy_info", None),
            "created_at": master.created_at.isoformat() if master.created_at else None,
            "is_copying": is_copying,
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
        "user_id": str(master.user_id),
        "is_self": master.user_id == user_id,  # your own master → UI hides Copy
        "provider_name": f"{first_name or ''} {last_name or ''}".strip(),
        "total_return_pct": float(master.total_return_pct),
        "max_drawdown_pct": float(master.max_drawdown_pct),
        "sharpe_ratio": float(master.sharpe_ratio),
        "followers_count": active_investors,  # actual count from allocations, not stale counter
        "active_investors": active_investors,
        "performance_fee_pct": float(master.performance_fee_pct),
        "management_fee_pct": float(master.management_fee_pct),
        "min_investment": float(master.min_investment),
        "max_investors": master.max_investors,
        "description": master.description,
        "strategy_info": getattr(master, "strategy_info", None),
        "total_trades": total_trades,
        "total_profit": total_profit,
        "win_rate": round(win_rate, 2),
        "monthly_breakdown": monthly_breakdown,
        "is_copying": is_copying,
        "created_at": master.created_at.isoformat() if master.created_at else None,
    }


async def provider_activity(provider_id: UUID, user_id: UUID, db: AsyncSession) -> dict:
    """The master's OPEN positions + closed trade history on their account,
    limited to what happened AFTER the requesting user started copying (so a
    follower sees exactly the trades they're mirroring). Requires an active
    allocation — only copiers can see a provider's live activity."""
    master = (await db.execute(
        select(MasterAccount).where(MasterAccount.id == provider_id)
    )).scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Provider not found")

    alloc = (await db.execute(
        select(InvestorAllocation)
        .where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status == "active",
        )
        .order_by(InvestorAllocation.created_at.asc())
    )).scalars().first()
    if not alloc:
        return {"is_copying": False, "open_positions": [], "history": [], "since": None}

    since = alloc.created_at

    # Return the follower's OWN copy trades (their mirrored positions + closed
    # history), NOT the master's raw trades. This delegates to the exact same
    # investor-facing data the website's copy-trades view uses, so the P&L
    # VALUES and the open/close TIMESTAMPS match across web and mobile.
    #
    # Previously this read the master's account directly and returned the
    # master's profit with the master's timestamps — which disagreed with the
    # website in both value (master lots vs your lots) and timing (the master's
    # open/close times vs your copy's), the mismatch the user reported.
    trades = await copy_allocation_trades(alloc.id, user_id, db)

    def _investor_pnl(t: dict) -> float:
        # pamm rows carry the investor's `your_share`; signal/mam carry `pnl`.
        share = t.get("your_share")
        return float(share if share is not None else (t.get("pnl") or 0))

    open_positions = [
        {
            "id": t["id"],
            "symbol": t["symbol"],
            "side": t["side"],
            "lots": t["lots"],
            "open_price": t["open_price"],
            "profit": _investor_pnl(t),
            "opened_at": t.get("opened_at"),
        }
        for t in trades.get("open_trades", [])
    ]
    history = [
        {
            "id": t["id"],
            "symbol": t["symbol"],
            "side": t["side"],
            "lots": t["lots"],
            "open_price": t["open_price"],
            "close_price": t.get("close_price"),
            "profit": _investor_pnl(t),
            "commission": float(t.get("commission", 0) or 0),
            "swap": float(t.get("swap", 0) or 0),
            "closed_at": t.get("closed_at"),
        }
        for t in trades.get("closed_trades", [])
    ]

    return {
        "is_copying": True,
        "since": since.isoformat() if since else None,
        "open_positions": open_positions,
        "history": history,
    }


async def start_copy(
    master_id: UUID, account_id: UUID | None, amount: Decimal,
    max_drawdown_pct: Decimal | None, max_lot_override: Decimal | None,
    user_id: UUID, db: AsyncSession,
) -> dict:
    """Follower starts copying a master — auto-approved.

    Two destination modes:
      • account_id=None  → create a fresh CF trading account, debit
                           the follower's main wallet by `amount` and
                           seed the new account with that balance.
      • account_id=<id>  → reuse the follower's existing live account
                           as the copy destination. No main wallet
                           debit; the amount is recorded as the
                           allocation tag only. The account's own
                           equity drives lot sizing.
    """
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.id == master_id, MasterAccount.status == "approved"
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Provider not found")

    if master.user_id == user_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot copy your own master account",
        )

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

    # C-TRADE-4 / H-TRADE-1: lock the user row (canonical: user before account)
    # so two concurrent subscriptions can't both spend the same wallet balance.
    user = await lock_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.master_id == master_id,
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status.in_(["active", "pending"]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already copying this provider")

    investor_account: TradingAccount
    if account_id is not None:
        # ── Existing-account path ──
        # Lock the account (after the user — canonical order) before checking
        # its balance against the allocation.
        acc = await lock_account(db, account_id)
        if not acc or acc.user_id != user_id:
            raise HTTPException(status_code=400, detail="Account not found or not yours")
        if acc.is_demo:
            raise HTTPException(status_code=400, detail="Demo accounts can't host copy-trade subscriptions")
        if master.account_id and acc.id == master.account_id:
            raise HTTPException(status_code=400, detail="You can't copy a master into the master's own account")
        # Another allocation already using the same destination would
        # double-mirror the same trades into one account — block it.
        dup_q = await db.execute(
            select(InvestorAllocation.id).where(
                InvestorAllocation.investor_account_id == account_id,
                InvestorAllocation.status.in_(["active", "pending"]),
            )
        )
        if dup_q.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="This account is already used by another copy subscription")
        acc_balance = acc.balance or Decimal("0")
        if acc_balance < amount:
            raise HTTPException(status_code=400, detail=f"Account balance ${acc_balance} is below allocation ${amount}")
        investor_account = acc
    else:
        # ── New-account path (legacy default) ──
        wallet_bal = user.main_wallet_balance or Decimal("0")
        if wallet_bal < amount:
            raise HTTPException(status_code=400, detail=f"Insufficient wallet balance (available: {wallet_bal})")
        # Attach a real account group so spread/commission/min-lot resolution
        # and the account-summary UI work. Without it the account_group FK is
        # NULL and downstream group lookups fall back to defaults. Best-effort:
        # if the Standard group is missing we still create the account (the
        # copy engine drives trades, not a manual order pipeline).
        std_grp_q = await db.execute(
            select(AccountGroup).where(
                AccountGroup.name == "Standard",
                AccountGroup.is_demo == False,  # noqa: E712
                AccountGroup.is_active == True,  # noqa: E712
            ).limit(1)
        )
        std_grp = std_grp_q.scalar_one_or_none()
        investor_account = TradingAccount(
            user_id=user_id,
            account_group_id=std_grp.id if std_grp else None,
            account_number=_gen_investor_account_number("signal"),
            balance=amount,
            equity=amount,
            free_margin=amount,
            margin_used=Decimal("0"),
            leverage=500,
            currency="USD",
            is_demo=False,
            is_active=True,
        )
        db.add(investor_account)
        await db.flush()

        user.main_wallet_balance = wallet_bal - amount
        db.add(Transaction(
            user_id=user_id, account_id=investor_account.id,
            type="withdrawal", amount=-amount,
            description=f"Copy trading investment → account {investor_account.account_number}",
        ))

    allocation = InvestorAllocation(
        master_id=master_id,
        investor_user_id=user_id,
        investor_account_id=investor_account.id,
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

    message = (
        f"Now copying — using existing account {investor_account.account_number} (${amount} allocation)"
        if account_id is not None
        else f"Now copying — account {investor_account.account_number} funded with ${amount}"
    )
    return {
        "id": str(allocation.id), "master_id": str(master_id),
        "investor_account": investor_account.account_number,
        "amount": float(amount),
        "copy_type": allocation.copy_type, "status": allocation.status,
        "wallet_balance": float(user.main_wallet_balance or 0),
        "message": message,
        "created_at": allocation.created_at.isoformat() if allocation.created_at else None,
    }


async def approve_follow_request(
    allocation_id: UUID, action: str, user_id: UUID, db: AsyncSession,
) -> dict:
    """Master approves or rejects a pending follow request.

    On approve: creates investor account, deducts follower wallet, credits master pool.
    On reject: marks allocation as rejected.
    """
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    # Verify the caller is the master
    alloc_result = await db.execute(
        select(InvestorAllocation, MasterAccount)
        .join(MasterAccount, InvestorAllocation.master_id == MasterAccount.id)
        .where(InvestorAllocation.id == allocation_id)
    )
    row = alloc_result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Allocation not found")
    allocation, master = row

    if master.user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the master can approve or reject followers")

    if allocation.status != "pending":
        raise HTTPException(status_code=400, detail=f"Allocation is already '{allocation.status}'")

    if action == "reject":
        allocation.status = "rejected"
        await db.commit()
        return {"id": str(allocation.id), "status": "rejected", "message": "Follow request rejected"}

    # ── Approve: create account, move funds ──────────────────────────
    investor_user_result = await db.execute(
        select(User).where(User.id == allocation.investor_user_id)
    )
    investor_user = investor_user_result.scalar_one_or_none()
    if not investor_user:
        raise HTTPException(status_code=404, detail="Investor user not found")

    amount = allocation.allocation_amount or Decimal("0")
    wallet_bal = investor_user.main_wallet_balance or Decimal("0")
    if wallet_bal < amount:
        raise HTTPException(
            status_code=400,
            detail=f"Investor has insufficient balance ({wallet_bal}). Request amount: {amount}",
        )

    # Create dedicated investor trading account
    investor_account = TradingAccount(
        user_id=allocation.investor_user_id,
        account_number=_gen_investor_account_number("signal"),
        balance=amount,
        equity=amount,
        free_margin=amount,
        margin_used=Decimal("0"),
        leverage=500,
        currency="USD",
        is_demo=False,
        is_active=True,
    )
    db.add(investor_account)
    await db.flush()

    # Deduct from follower wallet — funds land in follower's own CF account only.
    # Do NOT credit master's pool: signal/copy trade mirrors trades on the follower's
    # account using follower's own equity. Master funds their CT account separately.
    investor_user.main_wallet_balance = wallet_bal - amount
    db.add(Transaction(
        user_id=allocation.investor_user_id, account_id=investor_account.id,
        type="withdrawal", amount=-amount,
        description=f"Copy trading investment → account {investor_account.account_number}",
    ))

    # Activate allocation
    allocation.investor_account_id = investor_account.id
    allocation.status = "active"
    master.followers_count = (master.followers_count or 0) + 1
    await db.commit()

    return {
        "id": str(allocation.id),
        "status": "active",
        "investor_account": investor_account.account_number,
        "amount": float(amount),
        "message": "Follower approved — account created and funded",
    }


async def list_follow_requests(user_id: UUID, db: AsyncSession) -> dict:
    """Master lists all pending follow requests for their signal provider account."""
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.user_id == user_id,
            MasterAccount.status.in_(["approved", "active"]),
        )
    )
    masters = master_result.scalars().all()
    if not masters:
        return {"items": [], "total": 0}

    master_ids = [m.id for m in masters]

    alloc_result = await db.execute(
        select(InvestorAllocation, User.first_name, User.last_name, User.email)
        .join(User, InvestorAllocation.investor_user_id == User.id)
        .where(
            InvestorAllocation.master_id.in_(master_ids),
            InvestorAllocation.status == "pending",
        )
        .order_by(InvestorAllocation.created_at.desc())
    )
    rows = alloc_result.all()

    items = []
    for alloc, first_name, last_name, email in rows:
        items.append({
            "id": str(alloc.id),
            "master_id": str(alloc.master_id),
            "investor_user_id": str(alloc.investor_user_id),
            "investor_name": f"{first_name or ''} {last_name or ''}".strip() or email,
            "investor_email": email,
            "amount": float(alloc.allocation_amount),
            "copy_type": alloc.copy_type or "signal",
            "created_at": alloc.created_at.isoformat() if alloc.created_at else None,
        })

    return {"items": items, "total": len(items)}


async def my_copies(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(InvestorAllocation, MasterAccount, User.first_name, User.last_name)
        .join(MasterAccount, InvestorAllocation.master_id == MasterAccount.id)
        .join(User, MasterAccount.user_id == User.id)
        .where(
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status.in_(["active", "pending"]),
        )
        .order_by(InvestorAllocation.created_at.desc())
    )
    rows = result.all()

    items = []
    for alloc, master, first_name, last_name in rows:
        ctype = (alloc.copy_type or "signal").lower()
        open_count, closed_count = await _allocation_trade_counts(alloc, master, ctype, db)
        items.append({
            "id": str(alloc.id), "master_id": str(master.id),
            "provider_name": f"{first_name or ''} {last_name or ''}".strip(),
            "allocation_amount": float(alloc.allocation_amount),
            "total_profit": float(alloc.total_profit),
            "total_return_pct": float(master.total_return_pct),
            "copy_type": alloc.copy_type or "signal",
            "status": alloc.status,
            "open_trades": open_count,
            "closed_trades": closed_count,
            "total_trades": open_count + closed_count,
            "created_at": alloc.created_at.isoformat() if alloc.created_at else None,
        })
    return {"items": items, "total": len(items)}


async def _allocation_trade_counts(
    allocation: InvestorAllocation, master: MasterAccount, copy_type: str, db: AsyncSession,
) -> tuple[int, int]:
    """(open_count, closed_count) of copied trades for one allocation.

    - signal/mam: counts the follower's own mirrored positions (CopyTrade rows).
    - pamm: there are no per-investor copies — the investor shares the master's
      pool — so we report the master's own open positions + closed-trade count.
    """
    if copy_type == "pamm":
        if not master.account_id:
            return 0, 0
        open_q = await db.execute(
            select(func.count()).where(
                Position.account_id == master.account_id,
                Position.status == "open",
            )
        )
        closed_q = await db.execute(
            select(func.count()).where(TradeHistory.account_id == master.account_id)
        )
        return int(open_q.scalar() or 0), int(closed_q.scalar() or 0)

    counts_q = await db.execute(
        select(CopyTrade.status, func.count())
        .where(CopyTrade.investor_allocation_id == allocation.id)
        .group_by(CopyTrade.status)
    )
    open_count = closed_count = 0
    for status_val, cnt in counts_q.all():
        if status_val == "open":
            open_count = int(cnt or 0)
        elif status_val == "closed":
            closed_count = int(cnt or 0)
    return open_count, closed_count


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

    # C-TRADE-4 / H-TRADE-1: acquire the balance-mutation locks up front in the
    # canonical order (user, then account) so the refund can't race a concurrent
    # transfer/subscribe on the same wallet or CF account.
    user = await lock_user(db, user_id)

    # Close open copied positions and calculate PnL
    from packages.common.src.redis_client import PriceChannel
    open_copies_q = await db.execute(
        select(CopyTrade).where(
            CopyTrade.investor_allocation_id == allocation.id,
            CopyTrade.status == "open",
        )
    )
    open_copies = open_copies_q.scalars().all()

    total_pnl = Decimal("0")
    master_result = await db.execute(
        select(MasterAccount).where(MasterAccount.id == allocation.master_id)
    )
    master = master_result.scalar_one_or_none()

    # C-TRADE-1: the follower's capital lives in their own CF account. Realise
    # P&L into THAT account and later refund its real balance — the old code
    # credited allocation_amount + P&L to the wallet without ever zeroing the CF
    # account, so deleting the account afterwards swept the same funds a second
    # time (double refund).
    inv_acct = (
        await lock_account(db, allocation.investor_account_id)
        if allocation.investor_account_id else None
    )

    for copy in open_copies:
        investor_pos = await db.get(Position, copy.investor_position_id)
        if not investor_pos or investor_pos.status != PositionStatus.OPEN:
            copy.status = "closed"
            continue

        instrument = investor_pos.instrument
        if not instrument:
            copy.status = "closed"
            continue

        tick_data = await price_cache.get(instrument.symbol)
        if not tick_data:
            continue

        tick = json.loads(tick_data)
        side_val = investor_pos.side.value if hasattr(investor_pos.side, "value") else str(investor_pos.side)
        close_price = Decimal(str(tick["bid"])) if side_val == "buy" else Decimal(str(tick["ask"]))
        contract_size = instrument.contract_size or Decimal("100000")

        if side_val == "buy":
            gross = (close_price - investor_pos.open_price) * investor_pos.lots * contract_size
        else:
            gross = (investor_pos.open_price - close_price) * investor_pos.lots * contract_size
        from packages.common.src.trading_service import quote_to_account_pnl
        gross = quote_to_account_pnl(
            gross,
            getattr(instrument, "base_currency", None),
            getattr(instrument, "quote_currency", None),
            close_price,
            symbol=getattr(instrument, "symbol", None),
            cross_rate=await cross_rate_for(instrument),
        )

        # Same high-water mark as the mirror-close path.
        perf_fee = Decimal("0")
        if master:
            perf_fee = apply_hwm_fee(
                allocation, gross, master.performance_fee_pct or Decimal("0")
            )
        net = gross - perf_fee
        total_pnl += net
        # Realise this position's P&L onto the CF account balance.
        if inv_acct is not None:
            inv_acct.balance = (inv_acct.balance or Decimal("0")) + net

        investor_pos.status = PositionStatus.CLOSED.value
        investor_pos.close_price = close_price
        investor_pos.profit = net
        from datetime import datetime, timezone
        investor_pos.closed_at = datetime.now(timezone.utc)

        db.add(TradeHistory(
            position_id=investor_pos.id, account_id=investor_pos.account_id,
            instrument_id=investor_pos.instrument_id, side=investor_pos.side,
            lots=investor_pos.lots, open_price=investor_pos.open_price,
            close_price=close_price, swap=investor_pos.swap or Decimal("0"),
            commission=investor_pos.commission or Decimal("0"), profit=net,
            close_reason="copy_stopped", opened_at=investor_pos.created_at,
            closed_at=datetime.now(timezone.utc),
        ))
        copy.status = "closed"

    # No master-pool deduct: signal/copy trade keeps follower funds in the follower's
    # own CF account throughout. Master never held this money.

    # Return capital + PnL to main wallet (user row already locked above).
    # C-TRADE-1: refund the CF account's REAL balance (capital with realised P&L
    # already applied above), then zero the account so it can't be swept again.
    # Fall back to the reconstructed figure only for legacy allocations that
    # never had a dedicated CF account.
    if inv_acct is not None:
        return_amount = inv_acct.balance or Decimal("0")
        if return_amount < 0:
            return_amount = Decimal("0")
        inv_acct.balance = Decimal("0")
        inv_acct.equity = Decimal("0")
        inv_acct.free_margin = Decimal("0")
        inv_acct.margin_used = Decimal("0")
        inv_acct.is_active = False
    else:
        return_amount = (allocation.allocation_amount or Decimal("0")) + total_pnl
        if return_amount < 0:
            return_amount = Decimal("0")

    if user:
        user.main_wallet_balance = (user.main_wallet_balance or Decimal("0")) + return_amount
        db.add(Transaction(
            user_id=user_id, account_id=None, type="deposit",
            amount=return_amount,
            description="Copy trading withdrawal (capital + P&L)",
        ))

    allocation.status = "stopped"
    allocation.total_profit = (allocation.total_profit or Decimal("0")) + total_pnl

    if master and master.followers_count and master.followers_count > 0:
        master.followers_count -= 1

    await db.commit()
    return {
        "message": "Copy trading stopped — funds returned to wallet",
        "allocation_id": str(allocation_id),
        "positions_closed": len(open_copies),
        "returned_to_wallet": float(return_amount),
        "total_pnl": float(total_pnl),
        "wallet_balance": float(user.main_wallet_balance) if user else None,
    }


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

    # ─── PAMM withdrawal ────────────────────────────────────────────────
    # Pooled-fund model: investor has no sub-account. Their share of the
    # master's pool = (allocation_amount / sum(active allocations)) *
    # master.balance. Deduct that cash from master, credit investor wallet,
    # apply performance fee on any profit component.
    if allocation.copy_type == "pamm":
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()

        pool_account = await db.get(TradingAccount, master.account_id) if (master and master.account_id) else None
        if not pool_account:
            raise HTTPException(status_code=500, detail="Master pool account missing")

        total_units_q = await db.execute(
            select(func.coalesce(func.sum(InvestorAllocation.units), 0)).where(
                InvestorAllocation.master_id == allocation.master_id,
                InvestorAllocation.status == "active",
                InvestorAllocation.copy_type == "pamm",
            )
        )
        total_units = Decimal(str(total_units_q.scalar() or 0))
        my_units = allocation.units or Decimal("0")
        alloc_amt = allocation.allocation_amount or Decimal("0")  # cost basis
        # H-TRADE-2: value the pool at equity (balance + floating P&L of open
        # positions), not bare balance, so the redeem NAV is fair.
        pool_balance = await _pool_value_with_floating(db, pool_account)

        # Investor share = their units valued at the current NAV
        # (NAV = pool_balance / total_units). Redeeming the full share removes
        # exactly units × NAV from the pool, so the remaining holders' NAV is
        # unchanged — no value leaks to or from them.
        if total_units <= 0 or my_units <= 0:
            share_value = Decimal("0")
        else:
            share_value = (pool_balance * my_units) / total_units

        gross_profit = share_value - alloc_amt  # realised P&L vs cost basis
        perf_fee = Decimal("0")
        if gross_profit > 0 and master and master.performance_fee_pct:
            perf_fee = gross_profit * (master.performance_fee_pct or Decimal("0")) / Decimal("100")

        return_amount = share_value - perf_fee
        if return_amount < 0:
            return_amount = Decimal("0")

        # The FULL share leaves the pool. The performance fee does NOT linger in
        # the pool (that would inflate the remaining investors' NAV) — it is
        # paid out to the master's own wallet below.
        # H-TRADE-2: reduce the REAL settled balance by the cash paid out, not the
        # equity figure used for NAV (pool_balance now includes floating P&L).
        pool_account.balance = max(Decimal("0"), (pool_account.balance or Decimal("0")) - share_value)
        pool_account.equity = pool_account.balance + (pool_account.credit or Decimal("0"))
        pool_account.free_margin = pool_account.equity - (pool_account.margin_used or Decimal("0"))

        if user:
            user.main_wallet_balance = (user.main_wallet_balance or Decimal("0")) + return_amount
            db.add(Transaction(
                user_id=user_id, account_id=None, type="deposit",
                amount=return_amount,
                description=f"Withdrawal from PAMM pool (share: ${float(share_value):.2f}, fee: ${float(perf_fee):.2f})",
            ))

        # Pay the performance fee to the master (their own wallet, not the pool).
        if perf_fee > 0 and master:
            master_user = await db.get(User, master.user_id)
            if master_user:
                master_user.main_wallet_balance = (master_user.main_wallet_balance or Decimal("0")) + perf_fee
                db.add(Transaction(
                    user_id=master.user_id, account_id=None, type="performance_fee",
                    amount=perf_fee,
                    description=f"PAMM performance fee from investor withdrawal (${float(perf_fee):.2f})",
                ))
            master.total_fee_earned = (master.total_fee_earned or Decimal("0")) + perf_fee

        allocation.status = "withdrawn"
        allocation.units = Decimal("0")
        allocation.total_profit = gross_profit - perf_fee
        if master and master.followers_count and master.followers_count > 0:
            master.followers_count -= 1

        await db.commit()
        return {
            "message": "PAMM withdrawal complete — funds returned to wallet",
            "allocation_id": str(allocation_id),
            "positions_closed": 0,
            "share_value": float(share_value),
            "performance_fee": float(perf_fee),
            "returned_to_wallet": float(return_amount),
            "total_pnl": float(gross_profit),
            "total_profit": float(allocation.total_profit),
            "wallet_balance": float(user.main_wallet_balance) if user else None,
        }

    # ─── MAM withdrawal (legacy) ────────────────────────────────────────
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

        tick_data = await price_cache.get(instrument.symbol)
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
        from packages.common.src.trading_service import quote_to_account_pnl
        gross = quote_to_account_pnl(
            gross,
            getattr(instrument, "base_currency", None),
            getattr(instrument, "quote_currency", None),
            close_price,
            symbol=getattr(instrument, "symbol", None),
            cross_rate=await cross_rate_for(instrument),
        )

        perf_fee = Decimal("0")
        if master:
            perf_fee = apply_hwm_fee(
                allocation, gross, master.performance_fee_pct or Decimal("0")
            )

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

    # Return capital + PnL to main wallet
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    return_amount = (allocation.allocation_amount or Decimal("0")) + total_closed_pnl
    if return_amount < 0:
        return_amount = Decimal("0")

    # Deduct from master's pool account
    if master and master.account_id:
        pool_account = await db.get(TradingAccount, master.account_id)
        if pool_account:
            pool_account.balance = max(Decimal("0"), (pool_account.balance or Decimal("0")) - (allocation.allocation_amount or Decimal("0")))
            pool_account.equity = pool_account.balance + (pool_account.credit or Decimal("0"))
            pool_account.free_margin = pool_account.equity - (pool_account.margin_used or Decimal("0"))

    if user:
        user.main_wallet_balance = (user.main_wallet_balance or Decimal("0")) + return_amount
        db.add(Transaction(
            user_id=user_id, account_id=None, type="deposit",
            amount=return_amount,
            description=f"Withdrawal from {'PAMM' if allocation.copy_type == 'pamm' else 'MAM'} (capital + P&L)",
        ))

    # Deactivate allocation
    allocation.status = "withdrawn"
    allocation.total_profit = (allocation.total_profit or Decimal("0")) + total_closed_pnl

    if master and master.followers_count and master.followers_count > 0:
        master.followers_count -= 1

    await db.commit()

    return {
        "message": "Withdrawal complete — funds returned to wallet",
        "allocation_id": str(allocation_id),
        "positions_closed": len(open_copies),
        "returned_to_wallet": float(return_amount),
        "total_pnl": float(total_closed_pnl),
        "total_profit": float(allocation.total_profit),
        "wallet_balance": float(user.main_wallet_balance) if user else None,
    }


# ─────────────────────────────────────────────────────────────────────
# Master Trader eligibility (COPY_TRADING_PAGE.docx)
# ─────────────────────────────────────────────────────────────────────
#
# Two paths:
#   1. Verified external P&L  — submit a track-record URL; admin reviews.
#   2. Qualify via SwissCresta    — meet all four criteria below over the
#      user's lifetime trading on the platform.

MASTER_MIN_ACTIVE_DAYS = 30
MASTER_MIN_VOLUME_USD = Decimal("100000")
MASTER_MIN_TRADES = 100


async def check_master_eligibility(user_id: UUID, db: AsyncSession) -> dict:
    """Compute the four eligibility metrics + a per-criterion pass flag.

    Volume is sum(lots × open_price × 100k) over closed trades — same notional
    convention used elsewhere (see stats_engine). All checks consider live
    accounts only; demo trades don't count toward eligibility.
    """
    # Live trading accounts only.
    accounts_q = await db.execute(
        select(TradingAccount.id)
        .where(
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo.is_(False),
        )
    )
    account_ids = [row[0] for row in accounts_q.all()]

    if not account_ids:
        return {
            "active_days": 0, "active_days_required": MASTER_MIN_ACTIVE_DAYS, "active_days_ok": False,
            "profitable": False, "profitable_ok": False, "total_pnl_usd": 0.0,
            "trade_volume_usd": 0.0, "trade_volume_required": float(MASTER_MIN_VOLUME_USD), "trade_volume_ok": False,
            "trade_count": 0, "trade_count_required": MASTER_MIN_TRADES, "trade_count_ok": False,
            "all_passed": False,
        }

    stats_q = await db.execute(
        select(
            func.count().label("cnt"),
            func.coalesce(func.sum(TradeHistory.profit), 0).label("pnl"),
            func.coalesce(
                func.sum(TradeHistory.lots * TradeHistory.open_price * 100000),
                0,
            ).label("volume"),
            func.min(TradeHistory.closed_at).label("first_close"),
        )
        .where(TradeHistory.account_id.in_(account_ids))
    )
    row = stats_q.one()
    trade_count = int(row.cnt or 0)
    total_pnl = Decimal(str(row.pnl or 0))
    volume = Decimal(str(row.volume or 0))
    first_close = row.first_close

    if first_close is not None:
        if first_close.tzinfo is None:
            first_close = first_close.replace(tzinfo=timezone.utc)
        active_days = max(0, (datetime.now(timezone.utc) - first_close).days)
    else:
        active_days = 0

    profitable = total_pnl > 0
    return {
        "active_days": active_days,
        "active_days_required": MASTER_MIN_ACTIVE_DAYS,
        "active_days_ok": active_days >= MASTER_MIN_ACTIVE_DAYS,
        "profitable": profitable,
        "profitable_ok": profitable,
        "total_pnl_usd": float(total_pnl),
        "trade_volume_usd": float(volume),
        "trade_volume_required": float(MASTER_MIN_VOLUME_USD),
        "trade_volume_ok": volume >= MASTER_MIN_VOLUME_USD,
        "trade_count": trade_count,
        "trade_count_required": MASTER_MIN_TRADES,
        "trade_count_ok": trade_count >= MASTER_MIN_TRADES,
        "all_passed": (
            active_days >= MASTER_MIN_ACTIVE_DAYS
            and profitable
            and volume >= MASTER_MIN_VOLUME_USD
            and trade_count >= MASTER_MIN_TRADES
        ),
    }


async def apply_as_master(
    user_id: UUID,
    db: AsyncSession,
    *,
    master_type: str = "signal_provider",
    description: str | None = None,
    performance_fee_pct: Decimal = Decimal("25"),
    management_fee_pct: Decimal = Decimal("0"),
    min_investment: Decimal = Decimal("100"),
    max_investors: int = 100,
    external_pnl_url: str | None = None,
) -> dict:
    """Apply as a Master Trader. Either eligibility passes (auto-create
    pending application) or an external_pnl_url is supplied for admin review.
    Reuses the existing become_provider() to write the row so all of the
    existing admin-approval plumbing keeps working unchanged."""
    if not external_pnl_url:
        elig = await check_master_eligibility(user_id, db)
        if not elig["all_passed"]:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "not_eligible",
                    "eligibility": elig,
                },
            )
    strategy_info = None
    if external_pnl_url:
        strategy_info = {"external_pnl_url": external_pnl_url}
    return await become_provider(
        account_id=None,
        master_type=master_type,
        description=description,
        performance_fee_pct=performance_fee_pct,
        management_fee_pct=management_fee_pct,
        min_investment=min_investment,
        max_investors=max_investors,
        user_id=user_id,
        db=db,
        strategy_info=strategy_info,
    )


# ─────────────────────────────────────────────────────────────────────
# Copy-trade platform-fee 50% network distribution
# (XP_Reward_mechanism slide 6 / table 3)
#
# When a follower's copy trade closes profitably and the platform takes
# its share of the master's fee, half of that platform-take is
# distributed up the FOLLOWER's referral chain across 10 levels using
# the same percentages as the trade-volume distribution (35/15/10/10/
# 5×6). The other 50% stays as platform profit.
# ─────────────────────────────────────────────────────────────────────

COPY_TRADE_NETWORK_SHARE = Decimal("0.5")  # 50% of the platform-take is redistributed
COPY_TRADE_LEVEL_PCT = [
    Decimal("0.35"), Decimal("0.15"), Decimal("0.10"), Decimal("0.10"),
    Decimal("0.05"), Decimal("0.05"), Decimal("0.05"), Decimal("0.05"),
    Decimal("0.05"), Decimal("0.05"),
]


async def distribute_copy_trade_platform_fee(
    db: AsyncSession,
    *,
    follower_user_id: UUID,
    platform_fee: Decimal,
    reference_id: UUID,
) -> Decimal:
    """Walk up to 10 levels from the follower and credit each ancestor in
    USD (added to main_wallet_balance). Returns the total amount paid out
    so the caller can subtract it from platform retained earnings if
    they want exact accounting.

    The pool here is `platform_fee × 50%` — the other 50% stays as
    platform profit (already credited via credit_admin_fee on the call
    site)."""
    if platform_fee <= 0:
        return Decimal("0")
    pool = (Decimal(str(platform_fee)) * COPY_TRADE_NETWORK_SHARE).quantize(Decimal("0.01"))
    if pool <= 0:
        return Decimal("0")

    paid_out = Decimal("0")
    current = follower_user_id
    visited: set = set()
    for level_idx in range(10):
        row = (await db.execute(
            select(Referral).where(Referral.referred_id == current).limit(1)
        )).scalar_one_or_none()
        if row is None:
            break
        ancestor_id = row.referrer_id
        if ancestor_id in visited or ancestor_id == follower_user_id:
            break
        visited.add(ancestor_id)

        share = COPY_TRADE_LEVEL_PCT[level_idx]
        payout = (pool * share).quantize(Decimal("0.01"))
        if payout <= 0:
            current = ancestor_id
            continue

        anc = (await db.execute(
            select(User).where(User.id == ancestor_id).with_for_update()
        )).scalar_one_or_none()
        if anc is None:
            break
        anc.main_wallet_balance = Decimal(str(anc.main_wallet_balance or 0)) + payout
        paid_out += payout
        current = ancestor_id
    return paid_out


async def become_provider(
    account_id: UUID | None, master_type: str, description: str | None,
    performance_fee_pct: Decimal, management_fee_pct: Decimal,
    min_investment: Decimal, max_investors: int,
    user_id: UUID, db: AsyncSession,
    strategy_info: dict | None = None,
) -> dict:
    # Retired "mamm" master type — callers that still send it get remapped
    # to signal_provider so no new MAMM rows are created. Users may hold one
    # PAMM and one signal_provider application simultaneously.
    if master_type == "mamm":
        master_type = "signal_provider"
    normalized_type = master_type if master_type in ("signal_provider", "pamm") else "signal_provider"

    existing = await db.execute(
        select(MasterAccount).where(
            MasterAccount.user_id == user_id,
            MasterAccount.master_type == normalized_type,
            MasterAccount.status.in_(["pending", "approved", "active"]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a provider application of this type")

    # If the user picked an existing live account as the master account,
    # validate ownership and constraints up-front. Demo accounts can't be
    # master accounts, and an account already used by another master row
    # is off-limits. When account_id is None the admin auto-creates a
    # dedicated pool account at approval time.
    if account_id is not None:
        acc_q = await db.execute(
            select(TradingAccount).where(TradingAccount.id == account_id)
        )
        acc = acc_q.scalar_one_or_none()
        if not acc or acc.user_id != user_id:
            raise HTTPException(status_code=400, detail="Account not found or not yours")
        if acc.is_demo:
            raise HTTPException(status_code=400, detail="Demo accounts can't be used as a master account")
        in_use_q = await db.execute(
            select(MasterAccount.id).where(
                MasterAccount.account_id == account_id,
                MasterAccount.status.in_(["pending", "approved", "active"]),
            )
        )
        if in_use_q.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="This account is already linked to another master application")

    master = MasterAccount(
        user_id=user_id, account_id=account_id, status="pending",
        master_type=normalized_type,
        performance_fee_pct=performance_fee_pct, management_fee_pct=management_fee_pct,
        min_investment=min_investment, max_investors=max_investors, description=description,
        strategy_info=strategy_info,
    )
    db.add(master)
    await db.commit()
    await db.refresh(master)

    # Notify every admin so the master queue gets attention.
    try:
        from packages.common.src.notify import notify_all_admins
        user_q = await db.execute(select(User).where(User.id == user_id))
        user_row = user_q.scalar_one_or_none()
        await notify_all_admins(
            db,
            title="New Trade Master application",
            message=(
                f"{user_row.email if user_row else 'A user'} has applied to "
                f"become a {normalized_type} master."
            ),
            notif_type="system",
            action_url="/social",
        )
        await db.commit()
    except Exception:  # pragma: no cover
        pass

    return {
        "id": str(master.id),
        "status": master.status,
        "account_number": None,
        "message": "Application submitted — your pool trading account will be created after admin approval.",
    }


async def my_provider_stats(user_id: UUID, db: AsyncSession, master_type: str | None = None) -> dict:
    filters = [MasterAccount.user_id == user_id]
    # Exact-type match — a user can hold one PAMM master AND one MAM master
    # simultaneously, and each page must see only its own application.
    if master_type in ("signal_provider", "pamm", "mamm"):
        filters.append(MasterAccount.master_type == master_type)
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

    # Win rate
    wins_q = await db.execute(
        select(func.count()).where(
            TradeHistory.account_id == master.account_id,
            TradeHistory.profit > 0,
        )
    )
    wins = wins_q.scalar() or 0
    total_trades_count = trades_row[0] or 0
    win_rate = (wins / total_trades_count * 100) if total_trades_count > 0 else 0

    # Today's trades
    from datetime import datetime, timezone, timedelta
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_trades_q = await db.execute(
        select(func.count(), func.coalesce(func.sum(TradeHistory.profit), 0)).where(
            TradeHistory.account_id == master.account_id,
            TradeHistory.closed_at >= today_start,
        )
    )
    today_row = today_trades_q.one()

    # Open positions count
    open_pos_q = await db.execute(
        select(func.count()).where(
            Position.account_id == master.account_id,
            Position.status == "open",
        )
    )
    open_positions = open_pos_q.scalar() or 0

    # Copy-trade mirrors generated across ALL of this master's followers
    # (open + closed). This is distinct from the master's own trade counts
    # above — it's how many follower-side copies this master has spawned.
    copy_counts_q = await db.execute(
        select(CopyTrade.status, func.count())
        .join(InvestorAllocation, CopyTrade.investor_allocation_id == InvestorAllocation.id)
        .where(InvestorAllocation.master_id == master.id)
        .group_by(CopyTrade.status)
    )
    copy_open_count = 0
    copy_closed_count = 0
    for status_val, cnt in copy_counts_q.all():
        if status_val == "open":
            copy_open_count = cnt or 0
        elif status_val == "closed":
            copy_closed_count = cnt or 0

    # Commission / performance fee earned by this master
    from packages.common.src.models import Transaction
    fee_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type.in_(["performance_fee", "master_commission", "ib_commission"]),
        )
    )
    commission_earned = float(fee_q.scalar() or 0)

    # Platform (admin) commission carved out of this user's performance fees.
    # Scoped to ALL of the user's master accounts (matching commission_earned,
    # which keys on the master's user_id) — sum the admin_commission ledger
    # rows whose source trade is one of their followers' copies.
    admin_fee_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == "admin_commission",
            Transaction.reference_id.in_(
                select(CopyTrade.investor_position_id)
                .join(InvestorAllocation, CopyTrade.investor_allocation_id == InvestorAllocation.id)
                .join(MasterAccount, InvestorAllocation.master_id == MasterAccount.id)
                .where(MasterAccount.user_id == user_id)
            ),
        )
    )
    admin_commission_paid = float(admin_fee_q.scalar() or 0)

    return {
        "id": str(master.id), "status": master.status, "master_type": master.master_type,
        "total_return_pct": float(master.total_return_pct),
        "max_drawdown_pct": float(master.max_drawdown_pct),
        "sharpe_ratio": float(master.sharpe_ratio),
        "followers_count": inv_stats.count,  # actual active allocations, not stale counter
        "active_investors": inv_stats.count,
        "total_aum": float(inv_stats.total_aum),
        "total_investor_profit": float(inv_stats.total_investor_profit),
        "total_trades": total_trades_count,
        "total_profit": float(trades_row[1] or 0),
        "win_rate": round(win_rate, 1),
        "today_trades": today_row[0] or 0,
        "today_profit": float(today_row[1] or 0),
        "open_positions": open_positions,
        "copy_open_count": copy_open_count,
        "copy_closed_count": copy_closed_count,
        "copy_total_count": copy_open_count + copy_closed_count,
        "commission_earned": commission_earned,
        "admin_commission_paid": round(admin_commission_paid, 2),
        "admin_commission_pct": float(master.admin_commission_pct or 0),
        "performance_fee_pct": float(master.performance_fee_pct),
        "management_fee_pct": float(master.management_fee_pct),
        "min_investment": float(master.min_investment),
        "max_investors": master.max_investors,
        "description": master.description,
        "strategy_info": getattr(master, "strategy_info", None),
        "created_at": master.created_at.isoformat() if master.created_at else None,
    }


async def follower_earnings(user_id: UUID, db: AsyncSession) -> dict:
    """Copy-trading earnings summary for a follower: net profit kept and the
    performance-fee commission that went to the master(s) they copy."""
    from packages.common.src.models import Transaction
    allocs = (await db.execute(
        select(InvestorAllocation).where(InvestorAllocation.investor_user_id == user_id)
    )).scalars().all()

    total_profit = sum(float(a.total_profit or 0) for a in allocs)
    active_subs = sum(1 for a in allocs if a.status == "active")
    total_invested = sum(
        float(a.allocation_amount or 0) for a in allocs if a.status == "active"
    )

    # Performance fees paid to masters = the 'commission' ledger rows on the
    # follower's copy accounts (those accounts are never traded manually, so
    # every commission row there is a copy-trade performance fee).
    copy_acct_ids = list({a.investor_account_id for a in allocs if a.investor_account_id})
    commission_to_master = 0.0
    if copy_acct_ids:
        fee_q = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.account_id.in_(copy_acct_ids),
                Transaction.type == "commission",
            )
        )
        commission_to_master = abs(float(fee_q.scalar() or 0))

    return {
        "total_profit": round(total_profit, 2),
        "commission_to_master": round(commission_to_master, 2),
        "total_invested": round(total_invested, 2),
        "active_subscriptions": active_subs,
    }


async def list_managed_accounts(page: int, per_page: int, db: AsyncSession) -> dict:
    # /pamm Browse shows PAMM pools only. Legacy "MAMM" master type has
    # been retired — MAM Trading now lives under /social (signal_provider
    # master_type) with its own leaderboard.
    count_result = await db.execute(
        select(func.count()).select_from(MasterAccount).where(
            MasterAccount.status == "approved",
            MasterAccount.master_type == "pamm",
        )
    )
    total = count_result.scalar()

    result = await db.execute(
        select(MasterAccount, User.first_name, User.last_name)
        .join(User, MasterAccount.user_id == User.id)
        .where(
            MasterAccount.status == "approved",
            MasterAccount.master_type == "pamm",
        )
        .order_by(MasterAccount.total_return_pct.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    rows = result.all()

    items = []
    for master, first_name, last_name in rows:
        # Active investors + real AUM (sum of allocation amounts) for this
        # master. Single aggregation query — count() + sum() in one round-trip.
        aum_row = await db.execute(
            select(
                func.count(InvestorAllocation.id),
                func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0),
            ).where(
                InvestorAllocation.master_id == master.id,
                InvestorAllocation.status == "active",
            )
        )
        active, aum = aum_row.one()

        # Real win rate from trade_history. Zero-safe when no trades closed
        # yet (new master) — UI will render 0% instead of an em-dash.
        trades_row = await db.execute(
            select(
                func.count(TradeHistory.id),
                func.count().filter(TradeHistory.profit > 0),
            ).where(TradeHistory.account_id == master.account_id)
        )
        total_trades, wins = trades_row.one()
        win_rate = (wins / total_trades * 100) if total_trades else 0.0

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
            "aum": float(aum or 0),
            "win_rate": round(float(win_rate), 2),
            "total_trades": int(total_trades or 0),
            "description": master.description,
        })

    return {
        "items": items, "total": total, "page": page, "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def invest_managed_account(
    master_id: UUID, amount: Decimal,
    max_drawdown_pct: Decimal | None, volume_scaling_pct: Decimal,
    user_id: UUID, db: AsyncSession, account_id: UUID | None = None,
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

    # Deduct from main wallet
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallet_bal = user.main_wallet_balance or Decimal("0")
    if wallet_bal < amount:
        raise HTTPException(status_code=400, detail=f"Insufficient wallet balance (available: {wallet_bal})")

    existing_result = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.master_id == master_id,
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status == "active",
        )
    )
    existing_alloc = existing_result.scalar_one_or_none()

    # Deduct from wallet
    user.main_wallet_balance = wallet_bal - amount

    # Add funds to master's pool trading account
    pool_account = await db.get(TradingAccount, master.account_id) if master.account_id else None

    # ── PAMM units (NAV) ─────────────────────────────────────────────────
    # Snapshot the pool value + units BEFORE this deposit lands so the
    # investor buys units at the CURRENT NAV (= pool_value / total_units).
    # This is what makes staggered entries fair: a late joiner can't claim a
    # slice of profit the pool earned before they arrived. NAV = 1.0 for the
    # first investor (or an empty pool). MAM is unaffected (units stays 0).
    pamm_new_units = Decimal("0")
    if master.master_type == "pamm" and pool_account is not None:
        # H-TRADE-2: NAV uses pool equity (balance + floating P&L), not balance.
        pool_value_before = await _pool_value_with_floating(db, pool_account)
        tot_units_q = await db.execute(
            select(func.coalesce(func.sum(InvestorAllocation.units), 0)).where(
                InvestorAllocation.master_id == master_id,
                InvestorAllocation.status == "active",
                InvestorAllocation.copy_type == "pamm",
            )
        )
        total_units_before = Decimal(str(tot_units_q.scalar() or 0))
        nav = (
            pool_value_before / total_units_before
            if total_units_before > 0 and pool_value_before > 0
            else Decimal("1")
        )
        pamm_new_units = amount / nav

    # H-TRADE-3: credit exactly ONE destination. PAMM is a pooled fund → the
    # pool account. MAM mirrors into the investor's own sub-account → credited
    # below. Previously the pool was credited for BOTH types AND the MAM
    # sub-account too, double-crediting every MAM investment.
    if master.master_type == "pamm" and pool_account:
        pool_account.balance = (pool_account.balance or Decimal("0")) + amount
        pool_account.equity = pool_account.balance + (pool_account.credit or Decimal("0"))
        pool_account.free_margin = pool_account.equity - (pool_account.margin_used or Decimal("0"))

    label = 'PAMM' if master.master_type == 'pamm' else 'MAM'

    # PAMM is a pooled fund — investors do NOT get a sub-account. Funds live
    # on the master's pool account, allocation tracks each investor's share,
    # and P&L is settled to the investor's main wallet when the master closes
    # a trade (see trading_service.close_position → distribute_pamm_profit).
    is_pamm = master.master_type == "pamm"

    if existing_alloc:
        # ── Top-up: add funds to existing allocation ──
        existing_alloc.allocation_amount = (existing_alloc.allocation_amount or Decimal("0")) + amount
        if is_pamm:
            # Buy more units at the current NAV and grow the cost basis above.
            existing_alloc.units = (existing_alloc.units or Decimal("0")) + pamm_new_units
        if volume_scaling_pct and master.master_type == "mamm":
            existing_alloc.allocation_pct = volume_scaling_pct
        if max_drawdown_pct is not None:
            existing_alloc.max_drawdown_pct = max_drawdown_pct

        inv_acct = None
        if is_pamm:
            # No sub-account — transaction is logged against main wallet.
            db.add(Transaction(
                user_id=user_id, account_id=None, type="withdrawal",
                amount=-amount,
                description=f"Top-up {label} investment (total: {existing_alloc.allocation_amount})",
            ))
        else:
            inv_acct = await db.get(TradingAccount, existing_alloc.investor_account_id)
            if inv_acct:
                inv_acct.balance = (inv_acct.balance or Decimal("0")) + amount
                inv_acct.equity = inv_acct.balance + (inv_acct.credit or Decimal("0"))
                inv_acct.free_margin = inv_acct.equity - (inv_acct.margin_used or Decimal("0"))

            db.add(Transaction(
                user_id=user_id, account_id=existing_alloc.investor_account_id, type="withdrawal",
                amount=-amount,
                description=f"Top-up {label} investment (total: {existing_alloc.allocation_amount})",
            ))

        await db.commit()
        await db.refresh(existing_alloc)

        out = {
            "id": str(existing_alloc.id), "master_id": str(master_id),
            "master_type": master.master_type, "copy_type": existing_alloc.copy_type,
            "investor_account": inv_acct.account_number if inv_acct else None,
            "amount": float(existing_alloc.allocation_amount),
            "top_up": float(amount),
            "wallet_balance": float(user.main_wallet_balance),
            "status": existing_alloc.status,
            "created_at": existing_alloc.created_at.isoformat() if existing_alloc.created_at else None,
        }
    else:
        investor_account = None
        if not is_pamm:
            # MAM allocation: auto-create dedicated sub-account for position mirroring.
            investor_account = TradingAccount(
                user_id=user_id,
                account_number=_gen_investor_account_number("mam"),
                balance=amount,
                equity=amount,
                free_margin=amount,
                margin_used=Decimal("0"),
                leverage=500,
                currency="USD",
                is_demo=False,
                is_active=True,
            )
            db.add(investor_account)
            await db.flush()

            db.add(Transaction(
                user_id=user_id, account_id=investor_account.id, type="withdrawal",
                amount=-amount,
                description=f"Investment in {label} → account {investor_account.account_number}",
            ))
        else:
            # PAMM allocation: no sub-account, funds sit in master's pool.
            db.add(Transaction(
                user_id=user_id, account_id=None, type="withdrawal",
                amount=-amount,
                description=f"Investment in {label} pool (master: {master.id})",
            ))

        alloc_pct = volume_scaling_pct if master.master_type == "mamm" else None
        copy_type_val = (
            AllocationCopyType.PAMM.value if is_pamm
            else AllocationCopyType.MAM.value
        )

        allocation = InvestorAllocation(
            master_id=master_id, investor_user_id=user_id,
            investor_account_id=(investor_account.id if investor_account else None),
            copy_type=copy_type_val,
            allocation_amount=amount, allocation_pct=alloc_pct,
            units=(pamm_new_units if is_pamm else Decimal("0")),
            max_drawdown_pct=max_drawdown_pct, status="active",
        )
        db.add(allocation)
        master.followers_count = (master.followers_count or 0) + 1
        await db.commit()
        await db.refresh(allocation)

        out = {
            "id": str(allocation.id), "master_id": str(master_id),
            "master_type": master.master_type, "copy_type": allocation.copy_type,
            "investor_account": investor_account.account_number if investor_account else None,
            "amount": float(amount),
            "wallet_balance": float(user.main_wallet_balance),
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
        ).order_by(MasterAccount.created_at.desc())
    )
    master = master_result.scalars().first()
    if not master:
        raise HTTPException(status_code=404, detail="You are not a signal provider")

    # LEFT join the investor account: an INNER join silently dropped any
    # active follower whose investor_account_id was NULL or pointed at a
    # missing account row — leaving the master staring at "No followers yet"
    # even though the allocation is active (the reported "master can't see
    # follower account details" bug). The account_number is shown when
    # available and falls back to a placeholder otherwise.
    allocations_result = await db.execute(
        select(InvestorAllocation, User, TradingAccount)
        .join(User, InvestorAllocation.investor_user_id == User.id)
        .outerjoin(TradingAccount, InvestorAllocation.investor_account_id == TradingAccount.id)
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
            "account_number": account.account_number if account else "—",
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


async def get_provider_followers(provider_id: UUID, db: AsyncSession) -> dict:
    """Public view of a provider's followers (limited info for privacy)."""
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.id == provider_id,
            MasterAccount.status.in_(["approved", "active"]),
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Provider not found")

    allocations_result = await db.execute(
        select(InvestorAllocation, User)
        .join(User, InvestorAllocation.investor_user_id == User.id)
        .where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
    )
    allocations = allocations_result.all()

    followers = []
    for allocation, user in allocations:
        copy_trades_result = await db.execute(
            select(func.count()).where(CopyTrade.investor_allocation_id == allocation.id)
        )
        total_copied_trades = copy_trades_result.scalar() or 0

        profit_pct = 0.0
        if allocation.allocation_amount and allocation.allocation_amount > 0:
            profit_pct = (float(allocation.total_profit or 0) / float(allocation.allocation_amount)) * 100

        # Public view — ANY authenticated user can enumerate masters (via the
        # leaderboard) and call this, so it must NOT expose other investors'
        # real names or exact capital. Mask the name to first-name + last
        # initial and drop absolute dollar amounts; the relative profit % and
        # trade count are safe social-proof and reveal no one's capital.
        fn = (user.first_name or "").strip()
        ln = (user.last_name or "").strip()
        masked_name = (f"{fn} {ln[0]}." if fn and ln else fn) or "Anonymous"
        followers.append({
            "id": str(allocation.id),
            "user_name": masked_name,
            "allocation_amount": 0.0,   # hidden — do not expose other users' capital
            "total_profit": 0.0,        # hidden — absolute $ is private
            "profit_pct": round(profit_pct, 2),
            "total_copied_trades": total_copied_trades,
            "joined_at": allocation.created_at.isoformat() if allocation.created_at else None,
        })

    return {
        "provider_id": str(master.id),
        "total_followers": len(followers),
        "total_aum": 0.0,               # hidden — aggregate capital is private
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
        invested = float(alloc.allocation_amount or 0)

        if alloc.copy_type == "pamm":
            # PAMM: no sub-account. Live value = the allocation's units valued
            # at the current NAV (= pool_balance / total_units).
            pool_account = await db.get(TradingAccount, master.account_id) if master.account_id else None
            pool_balance = float(pool_account.balance or 0) if pool_account else 0.0
            total_units_q = await db.execute(
                select(func.coalesce(func.sum(InvestorAllocation.units), 0)).where(
                    InvestorAllocation.master_id == master.id,
                    InvestorAllocation.status == "active",
                    InvestorAllocation.copy_type == "pamm",
                )
            )
            total_units = float(total_units_q.scalar() or 0)
            my_units = float(alloc.units or 0)
            current_value = (pool_balance * my_units / total_units) if total_units > 0 else invested
            total_pnl = current_value - invested
            realized_pnl = total_pnl  # PAMM has no separate realized/unrealized split
            unrealized_pnl = 0.0
        else:
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
            current_value = invested + total_pnl

        pnl_pct = (total_pnl / invested * 100) if invested > 0 else 0.0

        items.append({
            "id": str(alloc.id),
            "master_id": str(master.id),
            "manager_name": f"{manager.first_name or ''} {manager.last_name or ''}".strip() or manager.email,
            "master_type": master.master_type,
            "copy_type": alloc.copy_type,
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


async def pamm_master_trades(
    allocation_id: UUID, user_id: UUID, db: AsyncSession,
) -> dict:
    """Return the PAMM master's open + closed trades, visible to the investor
    who owns this allocation. Each trade shows gross P&L (master's view) and
    the investor's proportional share based on their allocation ratio."""
    from packages.common.src.models import Position, TradeHistory, Instrument

    alloc_q = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.id == allocation_id,
            InvestorAllocation.investor_user_id == user_id,
        )
    )
    allocation = alloc_q.scalar_one_or_none()
    if not allocation or allocation.copy_type != "pamm":
        raise HTTPException(status_code=404, detail="PAMM allocation not found")

    master = await db.get(MasterAccount, allocation.master_id)
    if not master or not master.account_id:
        raise HTTPException(status_code=404, detail="Master account not found")

    total_units_q = await db.execute(
        select(func.coalesce(func.sum(InvestorAllocation.units), 0)).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
            InvestorAllocation.copy_type == "pamm",
        )
    )
    total_units = Decimal(str(total_units_q.scalar() or 0))
    my_units = allocation.units or Decimal("0")
    # Investor's pool ownership = their units / total units (NAV-based).
    ratio = float(my_units / total_units) if total_units > 0 else 0.0

    # Open positions on master's pool
    open_q = await db.execute(
        select(Position, Instrument)
        .join(Instrument, Position.instrument_id == Instrument.id)
        .where(
            Position.account_id == master.account_id,
            Position.status == "open",
        )
        .order_by(Position.created_at.desc())
    )
    open_trades = []
    for pos, inst in open_q.all():
        profit = await _live_open_pnl(pos, inst)
        open_trades.append({
            "id": str(pos.id),
            "symbol": inst.symbol,
            "side": pos.side.value if hasattr(pos.side, "value") else str(pos.side),
            "lots": float(pos.lots),
            "open_price": float(pos.open_price),
            "opened_at": pos.created_at.isoformat() if pos.created_at else None,
            "master_pnl": profit,
            "your_share": round(profit * ratio, 2),
            "status": "open",
        })

    # Closed trades from master's history
    closed_q = await db.execute(
        select(TradeHistory, Instrument)
        .join(Instrument, TradeHistory.instrument_id == Instrument.id)
        .where(TradeHistory.account_id == master.account_id)
        .order_by(TradeHistory.closed_at.desc())
        .limit(200)
    )
    closed_trades = []
    for th, inst in closed_q.all():
        profit = float(th.profit or 0)
        closed_trades.append({
            "id": str(th.id),
            "symbol": inst.symbol,
            "side": th.side.value if hasattr(th.side, "value") else str(th.side),
            "lots": float(th.lots),
            "open_price": float(th.open_price),
            "close_price": float(th.close_price),
            "opened_at": th.opened_at.isoformat() if th.opened_at else None,
            "closed_at": th.closed_at.isoformat() if th.closed_at else None,
            "master_pnl": profit,
            "your_share": round(profit * ratio, 2),
            # Hide 'admin' close-reason from investor view (matches
            # portfolio_service._public_close_reason). Investor sees
            # 'manual' if admin closed the master's trade.
            "close_reason": ("manual" if (th.close_reason or "").lower() == "admin"
                             else (th.close_reason or "manual")),
            "status": "closed",
        })

    return {
        "allocation_id": str(allocation_id),
        "copy_type": "pamm",
        "your_ratio_pct": round(ratio * 100, 4),
        "open_trades": open_trades,
        "closed_trades": closed_trades,
        "open_count": len(open_trades),
        "closed_count": len(closed_trades),
    }


async def copy_allocation_trades(
    allocation_id: UUID, user_id: UUID, db: AsyncSession,
) -> dict:
    """Per-subscription copy-trade history for the follower who owns this
    allocation. Works for every copy type:

    - pamm  → delegates to pamm_master_trades (master pool + your_share).
    - signal/mam → the follower's OWN mirrored positions on their copy
      sub-account (open Positions + closed TradeHistory rows).
    """
    from packages.common.src.models import Position, TradeHistory, Instrument

    alloc_q = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.id == allocation_id,
            InvestorAllocation.investor_user_id == user_id,
        )
    )
    allocation = alloc_q.scalar_one_or_none()
    if not allocation:
        raise HTTPException(status_code=404, detail="Copy subscription not found")

    ctype = (allocation.copy_type or "signal").lower()
    if ctype == "pamm":
        return await pamm_master_trades(allocation_id, user_id, db)

    acct_id = allocation.investor_account_id

    open_q = await db.execute(
        select(Position, Instrument)
        .join(Instrument, Position.instrument_id == Instrument.id)
        .where(Position.account_id == acct_id, Position.status == "open")
        .order_by(Position.created_at.desc())
    )
    open_trades = []
    for pos, inst in open_q.all():
        open_trades.append({
            "id": str(pos.id),
            "symbol": inst.symbol,
            "side": pos.side.value if hasattr(pos.side, "value") else str(pos.side),
            "lots": float(pos.lots),
            "open_price": float(pos.open_price),
            "opened_at": pos.created_at.isoformat() if pos.created_at else None,
            "pnl": await _live_open_pnl(pos, inst),
            "status": "open",
        })

    closed_q = await db.execute(
        select(TradeHistory, Instrument)
        .join(Instrument, TradeHistory.instrument_id == Instrument.id)
        .where(TradeHistory.account_id == acct_id)
        .order_by(TradeHistory.closed_at.desc())
        .limit(200)
    )
    closed_trades = []
    for th, inst in closed_q.all():
        closed_trades.append({
            "id": str(th.id),
            "symbol": inst.symbol,
            "side": th.side.value if hasattr(th.side, "value") else str(th.side),
            "lots": float(th.lots),
            "open_price": float(th.open_price),
            "close_price": float(th.close_price),
            "opened_at": th.opened_at.isoformat() if th.opened_at else None,
            "closed_at": th.closed_at.isoformat() if th.closed_at else None,
            "pnl": float(th.profit or 0),
            "close_reason": ("manual" if (th.close_reason or "").lower() == "admin"
                             else (th.close_reason or "manual")),
            "status": "closed",
        })

    return {
        "allocation_id": str(allocation_id),
        "copy_type": ctype,
        "open_trades": open_trades,
        "closed_trades": closed_trades,
        "open_count": len(open_trades),
        "closed_count": len(closed_trades),
    }


async def copy_trade_history(
    user_id: UUID,
    db: AsyncSession,
    account_id: str | None = None,
    symbol: str | None = None,
    status_filter: str | None = None,
) -> dict:
    """Aggregated copy-trade history across ALL of the follower's subscriptions.

    Returns every mirrored trade (open + closed) the user has, tagged with the
    master/provider it came from and the destination account, plus the list of
    accounts and symbols present so the UI can offer account-wise and
    trade-wise (symbol) filters. Covers signal/mam (the follower's own copy
    sub-accounts) and pamm (the shared master pool, with the investor's share).
    """
    from packages.common.src.models import Position, TradeHistory, Instrument

    rows = (await db.execute(
        select(InvestorAllocation, MasterAccount, User.first_name, User.last_name)
        .join(MasterAccount, InvestorAllocation.master_id == MasterAccount.id)
        .join(User, MasterAccount.user_id == User.id)
        .where(InvestorAllocation.investor_user_id == user_id)
        .order_by(InvestorAllocation.created_at.desc())
    )).all()

    # account_number lookup for signal/mam copy sub-accounts
    acct_ids = {a.investor_account_id for a, *_ in rows if a.investor_account_id}
    acct_map: dict = {}
    if acct_ids:
        ar = await db.execute(
            select(TradingAccount.id, TradingAccount.account_number)
            .where(TradingAccount.id.in_(acct_ids))
        )
        acct_map = {aid: num for aid, num in ar.all()}

    items: list[dict] = []
    accounts: dict[str, dict] = {}   # account_key -> filter descriptor
    symbols: set[str] = set()
    pamm_total_cache: dict = {}       # master_id -> total active pamm allocation
    seen_pamm_masters: set = set()    # avoid duplicating a shared pool's trades

    for alloc, master, fn, ln in rows:
        ctype = (alloc.copy_type or "signal").lower()
        provider_name = f"{fn or ''} {ln or ''}".strip() or "Master"

        if ctype == "pamm":
            if not master.account_id or master.id in seen_pamm_masters:
                continue
            seen_pamm_masters.add(master.id)
            if master.id not in pamm_total_cache:
                tot_q = await db.execute(
                    select(func.coalesce(func.sum(InvestorAllocation.units), 0)).where(
                        InvestorAllocation.master_id == master.id,
                        InvestorAllocation.status == "active",
                        InvestorAllocation.copy_type == "pamm",
                    )
                )
                pamm_total_cache[master.id] = Decimal(str(tot_q.scalar() or 0))
            total_units = pamm_total_cache[master.id]
            my_units = alloc.units or Decimal("0")
            # NAV-based ownership share of the pool.
            ratio = float(my_units / total_units) if total_units > 0 else 0.0
            src_account_id = master.account_id
            acct_key = f"pamm:{master.id}"
            account_number = f"PAMM · {provider_name}"
            is_pamm = True
        else:
            src_account_id = alloc.investor_account_id
            if not src_account_id:
                continue
            account_number = acct_map.get(src_account_id) or "—"
            acct_key = str(src_account_id)
            ratio = 1.0
            is_pamm = False

        accounts.setdefault(acct_key, {
            "account_key": acct_key,
            "account_number": account_number,
            "master_name": provider_name,
            "copy_type": ctype,
        })

        open_q = await db.execute(
            select(Position, Instrument)
            .join(Instrument, Position.instrument_id == Instrument.id)
            .where(Position.account_id == src_account_id, Position.status == "open")
            .order_by(Position.created_at.desc())
        )
        for pos, inst in open_q.all():
            profit = await _live_open_pnl(pos, inst)
            symbols.add(inst.symbol)
            items.append({
                "id": str(pos.id),
                "allocation_id": str(alloc.id),
                "account_key": acct_key,
                "account_number": account_number,
                "provider_name": provider_name,
                "copy_type": ctype,
                "symbol": inst.symbol,
                "side": pos.side.value if hasattr(pos.side, "value") else str(pos.side),
                "lots": float(pos.lots),
                "open_price": float(pos.open_price),
                "close_price": None,
                "opened_at": pos.created_at.isoformat() if pos.created_at else None,
                "closed_at": None,
                "pnl": round(profit * ratio, 2) if is_pamm else profit,
                "close_reason": None,
                "status": "open",
            })

        closed_q = await db.execute(
            select(TradeHistory, Instrument)
            .join(Instrument, TradeHistory.instrument_id == Instrument.id)
            .where(TradeHistory.account_id == src_account_id)
            .order_by(TradeHistory.closed_at.desc())
            .limit(200)
        )
        for th, inst in closed_q.all():
            profit = float(th.profit or 0)
            symbols.add(inst.symbol)
            items.append({
                "id": str(th.id),
                "allocation_id": str(alloc.id),
                "account_key": acct_key,
                "account_number": account_number,
                "provider_name": provider_name,
                "copy_type": ctype,
                "symbol": inst.symbol,
                "side": th.side.value if hasattr(th.side, "value") else str(th.side),
                "lots": float(th.lots),
                "open_price": float(th.open_price),
                "close_price": float(th.close_price),
                "opened_at": th.opened_at.isoformat() if th.opened_at else None,
                "closed_at": th.closed_at.isoformat() if th.closed_at else None,
                "pnl": round(profit * ratio, 2) if is_pamm else profit,
                # Hide internal 'admin' close-reason from the investor view.
                "close_reason": ("manual" if (th.close_reason or "").lower() == "admin"
                                 else (th.close_reason or "manual")),
                "status": "closed",
            })

    # newest first — closed_at for closed trades, opened_at otherwise
    items.sort(key=lambda it: (it.get("closed_at") or it.get("opened_at") or ""), reverse=True)

    # optional server-side filters (the UI also filters client-side)
    if account_id and account_id != "all":
        items = [it for it in items if it["account_key"] == account_id]
    if symbol and symbol != "all":
        items = [it for it in items if it["symbol"] == symbol]
    if status_filter in ("open", "closed"):
        items = [it for it in items if it["status"] == status_filter]

    return {
        "items": items,
        "accounts": list(accounts.values()),
        "symbols": sorted(symbols),
        "open_count": sum(1 for it in items if it["status"] == "open"),
        "closed_count": sum(1 for it in items if it["status"] == "closed"),
        "total": len(items),
        "total_pnl": round(sum(it["pnl"] for it in items), 2),
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

    # LEFT join so an active investor is never dropped just because their
    # investor_account_id is NULL / the account row is missing (same class of
    # bug as get_my_followers above).
    allocations_result = await db.execute(
        select(InvestorAllocation, User, TradingAccount)
        .join(User, InvestorAllocation.investor_user_id == User.id)
        .outerjoin(TradingAccount, InvestorAllocation.investor_account_id == TradingAccount.id)
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
            "account_number": account.account_number if account else "—",
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


async def master_transactions(
    user_id: UUID,
    db: AsyncSession,
    page: int = 1,
    per_page: int = 20,
    filter_type: str = "all",
) -> dict:
    """Paginated transaction history for a Trade Master.

    Returns commission earnings (with the originating follower + symbol),
    withdrawals, account transfers, deposits and bonuses — everything that
    moves money in or out of the master's wallets — in one ordered feed
    so the master can audit earnings against payouts in a single place.
    """
    from packages.common.src.models import Instrument

    master_q = await db.execute(
        select(MasterAccount).where(MasterAccount.user_id == user_id)
    )
    master = master_q.scalar_one_or_none()
    if not master or master.status != "approved":
        raise HTTPException(status_code=404, detail="You are not an approved Trade Master")

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

    # Scope every query to the master's pool/CT account. Activity on
    # the user's main wallet or other trading accounts is NOT master
    # activity — it already lives in the Funds → Transaction History
    # tab, so surfacing it here would just be duplicate noise.
    master_account_id = master.account_id

    count_q = await db.execute(
        select(func.count()).select_from(Transaction).where(
            Transaction.account_id == master_account_id,
            Transaction.type.in_(allowed_types),
        )
    )
    total = int(count_q.scalar() or 0)

    rows_q = await db.execute(
        select(Transaction).where(
            Transaction.account_id == master_account_id,
            Transaction.type.in_(allowed_types),
        ).order_by(Transaction.created_at.desc())
        .limit(per_page).offset((page - 1) * per_page)
    )
    txns = list(rows_q.scalars().all())

    # Pre-resolve follower + symbol enrichment for commission rows in one
    # shot — Transaction.reference_id on an ib_commission row points to
    # the investor's position, so we can walk position → copy_trade →
    # investor_allocation → user, plus position → instrument → symbol.
    commission_refs = [t.reference_id for t in txns if t.type == "ib_commission" and t.reference_id]
    follower_by_ref: dict[UUID, dict] = {}
    symbol_by_ref: dict[UUID, dict] = {}
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
            "follower": None,
            "symbol": None,
            "side": None,
            "lots": None,
            "gross_profit": None,
            "performance_fee_pct": None,
            "performance_fee_gross": None,
            "admin_commission_pct": None,
            "admin_fee": None,
            "master_net": None,
        }
        if t.type == "ib_commission":
            ref = t.reference_id
            row["follower"] = follower_by_ref.get(ref)
            sym = symbol_by_ref.get(ref) if ref else None
            if sym:
                row["symbol"] = sym["symbol"]
                row["side"] = sym["side"]
                row["lots"] = sym["lots"]
                row["gross_profit"] = sym["gross_profit"]
            # Reconstruct the fee chain using the master's current settings.
            # These can drift if the master edits their % after the fact;
            # we surface the % so the trader can see exactly how their
            # number was derived rather than just a flat amount.
            master_net = float(t.amount or 0)
            row["master_net"] = master_net
            row["performance_fee_pct"] = perf_pct
            row["admin_commission_pct"] = admin_pct
            if admin_pct < 100:
                gross_fee = master_net / (1 - admin_pct / 100) if admin_pct else master_net
                row["performance_fee_gross"] = round(gross_fee, 4)
                row["admin_fee"] = round(gross_fee - master_net, 4)
        items.append(row)

    # Lightweight summary so the dashboard can show totals without a
    # second round-trip. Sums are over the FULL set (not just this
    # page) so they survive pagination.
    summary_q = await db.execute(
        select(Transaction.type, func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.account_id == master_account_id)
        .group_by(Transaction.type)
    )
    summary_raw = {row[0]: float(row[1] or 0) for row in summary_q.all()}
    summary = {
        "total_commission": summary_raw.get("ib_commission", 0),
        "total_withdrawn": abs(summary_raw.get("withdrawal", 0)),
        "total_transferred": summary_raw.get("transfer", 0),
        "total_deposit": summary_raw.get("deposit", 0) + summary_raw.get("bonus", 0),
    }

    return {
        "items": items,
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": (total + per_page - 1) // per_page if per_page else 1,
        "summary": summary,
    }
