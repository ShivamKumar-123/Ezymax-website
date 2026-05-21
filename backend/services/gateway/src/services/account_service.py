"""Account Service — Trading account CRUD, equity calculation, deletion."""
import json
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.common.src.models import (
    AccountGroup,
    CopyTrade,
    InvestorAllocation,
    MasterAccount,
    Order,
    OrderStatus,
    Position,
    PositionStatus,
    RewardsUserState,
    TradingAccount,
    Transaction,
    User,
)
from packages.common.src.schemas import AccountSummary, MessageResponse, OpenLiveAccountRequest
from packages.common.src.redis_client import redis_client, PriceChannel
from packages.common.src.price_cache import price_cache


# ─── Per-user leverage cap (Trading_Mechanism.docx risk control) ──────
# Default ceiling is 1:50 for everyone. KYC + XP unlock higher leverage.
DEFAULT_USER_MAX_LEVERAGE = 50

# XP tier → leverage ceiling. Same XP thresholds as the rewards level
# system — keeping a single XP ladder so the user-facing story stays
# coherent ("level up to unlock more leverage").
XP_LEVERAGE_TIERS = [
    (0,    50),   # Starter
    (300,  100),  # Active
    (1000, 200),  # Skilled
    (3000, 300),  # Pro
    (7000, 500),  # Elite
]


def _xp_leverage_cap(xp: int) -> int:
    cap = DEFAULT_USER_MAX_LEVERAGE
    for threshold, max_lev in XP_LEVERAGE_TIERS:
        if xp >= threshold:
            cap = max_lev
    return cap


async def _user_effective_leverage_cap(
    db: AsyncSession,
    user: User,
    group: AccountGroup,
) -> tuple[int, dict]:
    """Returns (effective_cap, hints) where effective_cap is the smallest of:
        - group.max_leverage / leverage_default (broker ceiling per Phase 2)
        - DEFAULT_USER_MAX_LEVERAGE if KYC is not approved
        - the user's XP-gated cap

    `hints` carries per-reason flags so the UI can show 'Complete KYC' or
    'Reach 1,000 XP to unlock 1:200' next to the dropdown."""
    group_cap = int(group.max_leverage or group.leverage_default or 100)

    # Demo accounts ignore KYC + XP gating — full group ceiling applies.
    if bool(user.is_demo) or bool(group.is_demo):
        return group_cap, {
            "kyc_unlock_required": False,
            "xp_unlock_required": False,
            "xp_for_next_unlock": None,
            "next_unlock_leverage": None,
        }

    # KYC gate.
    kyc_ok = (user.kyc_status or "").lower() in ("approved", "verified")
    kyc_cap = group_cap if kyc_ok else DEFAULT_USER_MAX_LEVERAGE

    # XP gate.
    xp = (await db.execute(
        select(RewardsUserState.xp).where(RewardsUserState.user_id == user.id)
    )).scalar_one_or_none()
    xp_int = int(xp or 0)
    xp_cap = _xp_leverage_cap(xp_int)

    effective = min(group_cap, kyc_cap, xp_cap)

    # Compute the next unlock that the user can earn — the next XP threshold
    # whose cap is strictly higher than the *current* effective cap.
    next_threshold = None
    next_leverage = None
    for threshold, lev in XP_LEVERAGE_TIERS:
        if xp_int < threshold and lev > effective:
            next_threshold = threshold
            next_leverage = lev
            break

    return effective, {
        "kyc_unlock_required": (not kyc_ok and group_cap > DEFAULT_USER_MAX_LEVERAGE),
        "xp_unlock_required": (next_threshold is not None),
        "xp_for_next_unlock": next_threshold,
        "next_unlock_leverage": next_leverage,
    }


async def list_openable_account_groups(db: AsyncSession, user_id: UUID) -> dict:
    u = await db.execute(select(User).where(User.id == user_id))
    user = u.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Demo users see only demo-type groups; live users see only live groups.
    result = await db.execute(
        select(AccountGroup)
        .where(
            AccountGroup.is_active == True,
            AccountGroup.is_demo == bool(user.is_demo),
        )
        .order_by(AccountGroup.name)
    )
    rows = result.scalars().all()
    # Islamic users see only swap-free groups so their entire account list
    # is Shariah-friendly by default. Demo/non-Islamic users see all.
    if bool(getattr(user, "is_islamic", False)) and not bool(user.is_demo):
        rows = [g for g in rows if bool(g.swap_free)]
    items = []
    for g in rows:
        effective_cap, hints = await _user_effective_leverage_cap(db, user, g)
        items.append({
            "id": str(g.id),
            "name": g.name,
            "description": g.description or "",
            "leverage_default": int(g.leverage_default or 100),
            "max_leverage": int(g.max_leverage or g.leverage_default or 100),
            "effective_max_leverage": int(effective_cap),
            "kyc_unlock_required": bool(hints["kyc_unlock_required"]),
            "xp_unlock_required": bool(hints["xp_unlock_required"]),
            "xp_for_next_unlock": hints["xp_for_next_unlock"],
            "next_unlock_leverage": hints["next_unlock_leverage"],
            "minimum_deposit": float(g.minimum_deposit or 0),
            "spread_markup": float(g.spread_markup_default or 0),
            "commission_per_lot": float(g.commission_default or 0),
            "commission_pct": float(g.commission_pct) if g.commission_pct is not None else None,
            "swap_free": bool(g.swap_free),
        })
    return {"items": items, "user_is_islamic": bool(getattr(user, "is_islamic", False))}


async def open_live_account(
    user_id: UUID, req: OpenLiveAccountRequest, db: AsyncSession,
) -> dict:
    from .auth_service import generate_account_number

    u = await db.execute(select(User).where(User.id == user_id))
    user = u.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_is_demo = bool(user.is_demo)

    gq = await db.execute(
        select(AccountGroup).where(
            AccountGroup.id == req.account_group_id,
            AccountGroup.is_active == True,
            AccountGroup.is_demo == user_is_demo,
        )
    )
    group = gq.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=400, detail="Invalid or inactive account type")

    # Live accounts require KYC approval. Demo users skip this gate.
    if not user_is_demo:
        kyc = (user.kyc_status or "pending").lower()
        if kyc not in ("approved", "verified"):
            raise HTTPException(
                status_code=403,
                detail="KYC_REQUIRED",
            )

    min_d = Decimal(str(group.minimum_deposit or 0))

    new_balance = Decimal("0")
    if user_is_demo:
        # Demo users get a starter virtual balance; use min_deposit if set, else $10,000.
        new_balance = min_d if min_d > 0 else Decimal("10000")
    else:
        live_q = await db.execute(
            select(TradingAccount).where(
                TradingAccount.user_id == user_id,
                TradingAccount.is_demo == False,
            )
        )
        existing_live = list(live_q.scalars().all())
        wallet_bal = user.main_wallet_balance or Decimal("0")
        live_total = sum((a.balance or Decimal("0")) for a in existing_live)
        available = wallet_bal + live_total
        # First-time signups (no prior live account AND no wallet balance)
        # open at $0 — they'll deposit later. Only enforce min_deposit when
        # the user already has *some* money in the system; that way a user
        # holding $504k in the wallet can't be told "you have no balance".
        enforce_min = min_d > 0 and available > 0
        if enforce_min:
            # Funding pool = main wallet + existing live account balances.
            # If even the combined pool can't cover min_deposit, refuse.
            if available < min_d:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"You need at least ${float(min_d):.2f} available across your main wallet "
                        "and existing live accounts to open this account type. Deposit or add funds first."
                    ),
                )
            # Prefer the main wallet first (the natural place users expect
            # funding to come from after deposits / account closures).
            remaining = min_d
            take_from_wallet = min(wallet_bal, remaining)
            if take_from_wallet > 0:
                user.main_wallet_balance = wallet_bal - take_from_wallet
                remaining -= take_from_wallet
                db.add(Transaction(
                    user_id=user.id,
                    type="transfer",
                    amount=-take_from_wallet,
                    balance_after=user.main_wallet_balance,
                    description="Main wallet → new trading account funding",
                ))
            # If wallet alone wasn't enough, top up by sweeping the existing
            # live accounts (largest-first) — preserves the prior fallback
            # behaviour for users who never used the main wallet flow.
            if remaining > 0:
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
    # Effective cap = min(group ceiling, KYC gate, XP gate). User-facing
    # error mentions the most-restrictive reason so the trader knows what
    # to do next.
    max_lev, hints = await _user_effective_leverage_cap(db, user, group)
    if req.leverage is not None:
        if req.leverage < 1 or req.leverage > max_lev:
            reasons: list[str] = []
            if hints.get("kyc_unlock_required"):
                reasons.append("complete KYC")
            if hints.get("xp_unlock_required") and hints.get("xp_for_next_unlock"):
                reasons.append(
                    f"reach {hints['xp_for_next_unlock']} XP to unlock 1:{hints['next_unlock_leverage']}"
                )
            extra = (" — " + ", ".join(reasons)) if reasons else ""
            raise HTTPException(
                status_code=400,
                detail=f"Leverage must be between 1 and {max_lev} for this account type{extra}.",
            )
        lev = int(req.leverage)
    else:
        # Default to the group's headline leverage clamped by the user cap.
        lev = min(int(group.leverage_default or max_lev), max_lev)
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
        is_demo=user_is_demo,
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
                tick_data = await price_cache.get(pos.instrument.symbol)
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
                "commission_pct": float(g.commission_pct) if g.commission_pct is not None else None,
                "minimum_deposit": float(g.minimum_deposit or 0),
                "swap_free": bool(g.swap_free),
                "leverage_default": int(g.leverage_default or 100),
                "max_leverage": int(g.max_leverage or g.leverage_default or 100),
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

    from .trading_service import quote_to_account_pnl
    unrealized_pnl = Decimal("0")
    for pos in open_positions:
        tick_data = await price_cache.get(pos.instrument.symbol)
        if tick_data:
            tick = json.loads(tick_data)
            current_price = Decimal(str(tick["bid"])) if pos.side.value == "buy" else Decimal(str(tick["ask"]))
            if pos.side.value == "buy":
                pnl = (current_price - pos.open_price) * pos.lots * pos.instrument.contract_size
            else:
                pnl = (pos.open_price - current_price) * pos.lots * pos.instrument.contract_size
            pnl = quote_to_account_pnl(
                pnl,
                getattr(pos.instrument, "base_currency", None),
                getattr(pos.instrument, "quote_currency", None),
                current_price,
                symbol=getattr(pos.instrument, "symbol", None),
            )
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


async def update_account_leverage(
    account_id: UUID, user_id: UUID, leverage: int, db: AsyncSession,
) -> dict:
    """Update leverage on an account the user owns, capped at the group's max_leverage."""
    if leverage < 1:
        raise HTTPException(status_code=400, detail="leverage must be at least 1")

    q = await db.execute(
        select(TradingAccount)
        .options(selectinload(TradingAccount.account_group))
        .where(TradingAccount.id == account_id, TradingAccount.user_id == user_id)
    )
    account = q.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")

    group = account.account_group
    if group is None:
        # Defensive fallback for legacy rows that lost their group FK.
        max_lev = 500
        hints: dict = {}
    else:
        u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if u is None:
            raise HTTPException(status_code=404, detail="User not found")
        max_lev, hints = await _user_effective_leverage_cap(db, u, group)

    if leverage > max_lev:
        reasons: list[str] = []
        if hints.get("kyc_unlock_required"):
            reasons.append("complete KYC")
        if hints.get("xp_unlock_required") and hints.get("xp_for_next_unlock"):
            reasons.append(
                f"reach {hints['xp_for_next_unlock']} XP to unlock 1:{hints['next_unlock_leverage']}"
            )
        extra = (" — " + ", ".join(reasons)) if reasons else ""
        raise HTTPException(
            status_code=400,
            detail=f"Leverage cannot exceed 1:{max_lev} for this account{extra}",
        )

    # Block leverage changes while positions are open to avoid surprise margin calls.
    open_q = await db.execute(
        select(Position).where(
            Position.account_id == account.id,
            Position.status == PositionStatus.OPEN,
        )
    )
    if open_q.scalars().first():
        raise HTTPException(
            status_code=400,
            detail="Close all open positions before changing leverage",
        )

    account.leverage = leverage
    await db.commit()
    await db.refresh(account)
    return {
        "id": str(account.id),
        "leverage": int(account.leverage),
        "max_leverage": max_lev,
    }


async def delete_trading_account(
    account_id: UUID, user_id: UUID, db: AsyncSession,
) -> MessageResponse:
    """Soft-delete a trading account belonging to the current user.

    Flow (works for any account type — live, CT/PM/MM master pool, CF/IF follower sub-account):
      1. Auto-close every open position at open_price (zero pnl).
      2. Auto-cancel pending orders.
      3. If this account is a master pool (MasterAccount row attached):
           - Close open positions on each active follower's copy account.
           - Sweep each follower's copy-account balance → follower's main wallet (type='transfer').
           - Mark allocation.status='closed'; mark master.status='rejected', followers_count=0.
           - Mark follower copy account is_active=False.
      4. If this account is itself a follower sub-account (InvestorAllocation row), close that allocation.
      5. Sweep the account's own balance + credit → owning user's main wallet (type='transfer').
      6. Set is_active=False so the account disappears from the user's list (kept for history + FK safety).
    """
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
            detail="Demo accounts cannot be deleted.",
        )

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. Close any open/partial positions on this account at open_price (flat pnl).
    open_pos_q = await db.execute(
        select(Position).where(
            Position.account_id == account_id,
            Position.status.in_((PositionStatus.OPEN.value, PositionStatus.PARTIALLY_CLOSED.value)),
        )
    )
    for pos in open_pos_q.scalars().all():
        pos.status = PositionStatus.CLOSED.value
        pos.close_price = pos.open_price
        pos.profit = Decimal("0")
        pos.closed_at = datetime.utcnow()

    # 2. Cancel pending orders.
    await db.execute(
        update(Order)
        .where(
            Order.account_id == account_id,
            Order.status.in_((OrderStatus.PENDING.value, OrderStatus.PARTIALLY_FILLED.value)),
        )
        .values(status=OrderStatus.CANCELLED.value)
    )

    # 3. If this account hosts an approved master, run the master-shutdown flow.
    master_q = await db.execute(
        select(MasterAccount).where(
            MasterAccount.account_id == account_id,
            MasterAccount.status == "approved",
        )
    )
    master = master_q.scalar_one_or_none()
    followers_refunded = 0
    total_refunded = Decimal("0")
    if master:
        allocs_q = await db.execute(
            select(InvestorAllocation).where(
                InvestorAllocation.master_id == master.id,
                InvestorAllocation.status == "active",
            )
        )
        for alloc in allocs_q.scalars().all():
            followers_refunded += 1
            investor = await db.get(User, alloc.investor_user_id)
            inv_acct = await db.get(TradingAccount, alloc.investor_account_id) if alloc.investor_account_id else None

            if inv_acct:
                inv_open_q = await db.execute(
                    select(Position).where(
                        Position.account_id == inv_acct.id,
                        Position.status.in_((PositionStatus.OPEN.value, PositionStatus.PARTIALLY_CLOSED.value)),
                    )
                )
                for pos in inv_open_q.scalars().all():
                    pos.status = PositionStatus.CLOSED.value
                    pos.close_price = pos.open_price
                    pos.profit = Decimal("0")
                    pos.closed_at = datetime.utcnow()

                refund = (inv_acct.balance or Decimal("0")) + (inv_acct.credit or Decimal("0"))
                inv_acct.balance = Decimal("0")
                inv_acct.credit = Decimal("0")
                inv_acct.equity = Decimal("0")
                inv_acct.free_margin = Decimal("0")
                inv_acct.margin_used = Decimal("0")
                inv_acct.is_active = False

                if investor and refund > 0:
                    investor.main_wallet_balance = (investor.main_wallet_balance or Decimal("0")) + refund
                    total_refunded += refund
                    db.add(Transaction(
                        user_id=investor.id,
                        account_id=inv_acct.id,
                        type="transfer",
                        amount=refund,
                        balance_after=investor.main_wallet_balance,
                        description="Master account closed by owner — copy trade refund to main wallet",
                    ))

            alloc.status = "closed"

        # Close any still-open CopyTrade rows for this master.
        ct_q = await db.execute(
            select(CopyTrade)
            .join(InvestorAllocation, CopyTrade.investor_allocation_id == InvestorAllocation.id)
            .where(
                InvestorAllocation.master_id == master.id,
                CopyTrade.status == "open",
            )
        )
        for ct in ct_q.scalars().all():
            ct.status = "closed"

        master.status = "rejected"
        master.followers_count = 0

    # 4. If this account is itself a follower sub-account, close the allocation.
    follower_alloc_q = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.investor_account_id == account_id,
            InvestorAllocation.status == "active",
        )
    )
    for alloc in follower_alloc_q.scalars().all():
        alloc.status = "closed"

    # 5. Sweep own balance + credit to owner's main wallet.
    sweep = (account.balance or Decimal("0")) + (account.credit or Decimal("0"))
    if sweep > 0:
        user.main_wallet_balance = (user.main_wallet_balance or Decimal("0")) + sweep
        db.add(Transaction(
            user_id=user.id,
            account_id=account.id,
            type="transfer",
            amount=sweep,
            balance_after=user.main_wallet_balance,
            description="Trading account closed — balance returned to main wallet",
        ))

    account.balance = Decimal("0")
    account.credit = Decimal("0")
    account.equity = Decimal("0")
    account.free_margin = Decimal("0")
    account.margin_used = Decimal("0")
    account.is_active = False

    await db.commit()

    if master and followers_refunded:
        return MessageResponse(
            message=(
                f"Account closed — ${float(sweep):.2f} returned to your main wallet. "
                f"{followers_refunded} follower(s) refunded (${float(total_refunded):.2f})."
            )
        )
    return MessageResponse(
        message=f"Account closed — ${float(sweep):.2f} returned to your main wallet."
    )
