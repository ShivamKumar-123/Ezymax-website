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
    TradingAccount,
    Transaction,
    User,
)
from packages.common.src.schemas import AccountSummary, MessageResponse, OpenLiveAccountRequest
from packages.common.src.redis_client import redis_client, PriceChannel
from packages.common.src.price_cache import price_cache
from packages.common.src.trading_service import calc_position_pnl, cross_rate_for


# ─── Per-user leverage cap (Trading_Mechanism.docx risk control) ──────
# Default ceiling is 1:50 for everyone. KYC unlocks the broker's full
# account-group ceiling.
DEFAULT_USER_MAX_LEVERAGE = 50


async def _user_effective_leverage_cap(
    db: AsyncSession,
    user: User,
    group: AccountGroup,
) -> tuple[int, dict]:
    """Returns (effective_cap, hints) where effective_cap is the smallest of:
        - group.max_leverage / leverage_default (broker ceiling per Phase 2)
        - DEFAULT_USER_MAX_LEVERAGE if KYC is not approved

    `hints` carries per-reason flags so the UI can show 'Complete KYC'
    next to the dropdown."""
    group_cap = int(group.max_leverage or group.leverage_default or 100)

    # Demo accounts ignore KYC gating — full group ceiling applies.
    if bool(user.is_demo) or bool(group.is_demo):
        return group_cap, {
            "kyc_unlock_required": False,
        }

    # KYC gate.
    kyc_ok = (user.kyc_status or "").lower() in ("approved", "verified")
    kyc_cap = group_cap if kyc_ok else DEFAULT_USER_MAX_LEVERAGE

    effective = min(group_cap, kyc_cap)

    return effective, {
        "kyc_unlock_required": (not kyc_ok and group_cap > DEFAULT_USER_MAX_LEVERAGE),
    }


async def list_openable_account_groups(
    db: AsyncSession, user_id: UUID, requested_type: str | None = None,
) -> dict:
    u = await db.execute(select(User).where(User.id == user_id))
    user = u.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Demo users are locked to demo groups regardless of `requested_type`.
    # Real users can ask for the demo set via `?type=demo` to spin up a
    # practice account alongside their live ones.
    if bool(user.is_demo):
        want_demo = True
    else:
        want_demo = (requested_type or "").strip().lower() == "demo"
    result = await db.execute(
        select(AccountGroup)
        .where(
            AccountGroup.is_active == True,
            AccountGroup.is_demo == want_demo,
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
    # Demo users are locked to demo accounts. Real users can also open
    # demo accounts (practice) by passing is_demo=True in the request.
    if bool(user.is_demo):
        user_is_demo = True
    else:
        user_is_demo = bool(getattr(req, "is_demo", False) or False)

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

    # KYC is NOT required to open a live trading account. The only KYC gate
    # we keep is on Razorpay (Card/UPI) deposits, where the payment processor
    # contractually requires verified identity. Trading, account creation,
    # bank/crypto deposits, and withdrawals all run without this check.

    min_d = Decimal(str(group.minimum_deposit or 0))

    new_balance = Decimal("0")
    if user_is_demo:
        # One demo account per user (self-service). Deactivated ("deleted")
        # demo accounts don't count, so a user who removed theirs can open a
        # fresh one; the admin back office can still provision extras.
        existing_demo = await db.execute(
            select(TradingAccount.id)
            .where(
                TradingAccount.user_id == user_id,
                TradingAccount.is_demo == True,  # noqa: E712
                TradingAccount.is_active.isnot(False),
            )
            .limit(1)
        )
        if existing_demo.scalars().first() is not None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "You already have a demo account — switch to it from the "
                    "account picker. Contact support if you need another one."
                ),
            )
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
        # If the admin has set a minimum-deposit on this group, enforce it
        # *always*. The earlier "first-time user with no money opens at $0"
        # loophole let brand-new accounts get created with no funding — the
        # accounts page then rendered empty equity rows that looked broken.
        # Users now have to deposit first; refusal message tells them where
        # to go.
        if min_d > 0:
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
    # Effective cap = min(group ceiling, KYC gate). User-facing error
    # mentions KYC gating so the trader knows what to do next.
    max_lev, hints = await _user_effective_leverage_cap(db, user, group)
    if req.leverage is not None:
        if req.leverage < 1 or req.leverage > max_lev:
            reasons: list[str] = []
            if hints.get("kyc_unlock_required"):
                reasons.append("complete KYC")
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


async def get_wallet_account(
    user_id: UUID,
    db: AsyncSession,
) -> TradingAccount | None:
    """Return the user's active wallet-bound trading account, if any.
    Partial unique index ux_one_wallet_account_per_user guarantees at
    most one row matches."""
    row = (await db.execute(
        select(TradingAccount).where(
            TradingAccount.user_id == user_id,
            TradingAccount.is_wallet_account.is_(True),
            TradingAccount.is_active.is_(True),
        ).limit(1)
    )).scalar_one_or_none()
    return row


async def create_wallet_bound_account(
    db: AsyncSession,
    user_id: UUID,
    *,
    account_group_id: UUID | None = None,
    starting_balance: Decimal | None = None,
) -> TradingAccount:
    """Provision the dedicated wallet-bound trading account.

    Used in two places:
      1. wallet_auth_service.verify_message() — when a user links their
         first wallet AND has no prior trading history, we auto-create
         this account at $0 so the deposit flow lands here from day 1.
      2. profile.migrate_to_wallet_account endpoint — for existing
         users who opt in via Settings; this is where `starting_balance`
         is non-zero (their main_wallet_balance + optionally a merged
         live account balance).

    Raises HTTPException(409) if the user already has an active
    wallet-bound account. Caller must commit.
    """
    from .auth_service import generate_account_number

    existing = await get_wallet_account(user_id, db)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Wallet-bound account already exists for this user.",
        )

    # Pick group: default to "Standard" live group if caller didn't
    # specify. The Standard tier has the lowest min_deposit gate that
    # still has full feature access (Micro is more limited).
    if account_group_id is None:
        std_q = await db.execute(
            select(AccountGroup).where(
                AccountGroup.name == "Standard",
                AccountGroup.is_demo == False,
                AccountGroup.is_active == True,
            ).limit(1)
        )
        std = std_q.scalar_one_or_none()
        if std is None:
            raise HTTPException(
                status_code=500,
                detail="Default Standard account group not found. Run seed migrations.",
            )
        group_id = std.id
        default_leverage = int(std.leverage_default or 100)
    else:
        grp_q = await db.execute(
            select(AccountGroup).where(
                AccountGroup.id == account_group_id,
                AccountGroup.is_active == True,
                AccountGroup.is_demo == False,
            ).limit(1)
        )
        grp = grp_q.scalar_one_or_none()
        if grp is None:
            raise HTTPException(status_code=400, detail="Invalid account group.")
        group_id = grp.id
        default_leverage = int(grp.leverage_default or 100)

    bal = Decimal(str(starting_balance or 0))
    acc = TradingAccount(
        user_id=user_id,
        account_group_id=group_id,
        account_number=generate_account_number(),
        balance=bal,
        equity=bal,
        free_margin=bal,
        margin_used=Decimal("0"),
        leverage=default_leverage,
        currency="USD",
        is_demo=False,
        is_active=True,
        is_wallet_account=True,
    )
    db.add(acc)
    await db.flush()
    return acc


async def list_accounts(user_id: UUID, db: AsyncSession) -> dict:
    # Demo users see only demo accounts — protects against legacy rows
    # the auth bootstrap used to create alongside the demo account, and
    # cleanly hides any real account an admin might attach to a demo
    # user by mistake.
    user_q = await db.execute(select(User.is_demo).where(User.id == user_id))
    is_demo_user = bool(user_q.scalar() or False)

    where = [TradingAccount.user_id == user_id]
    # Hide ONLY accounts that were explicitly soft-deleted (is_active = False set
    # by delete_trading_account, with the balance already swept to the main
    # wallet). We must NOT use `== True` here: legacy accounts can have is_active
    # NULL, and `== True` would wrongly hide every one of them. `IS NOT FALSE`
    # keeps True + NULL visible and hides only the explicit-False deletions.
    where.append(TradingAccount.is_active.isnot(False))
    if is_demo_user:
        where.append(TradingAccount.is_demo == True)  # noqa: E712

    result = await db.execute(
        select(TradingAccount)
        .options(selectinload(TradingAccount.account_group))
        .where(*where)
        # Stable, deterministic ordering. Without an explicit ORDER BY,
        # Postgres returns rows in physical/heap order, which shifts as
        # rows are updated — so the trader's 2 s account-list poll made the
        # cards "float"/reshuffle every few seconds. Order by creation time
        # (oldest first) with id as a tiebreaker so the order never changes.
        .order_by(TradingAccount.created_at.asc(), TradingAccount.id.asc())
    )
    accounts = result.scalars().unique().all()

    # Flag copy-trading accounts so the UI can tag them regardless of the
    # account-number prefix. An account is "copy trading" when it's either a
    # provider's master/pool account (existing account picked at apply time OR
    # a dedicated CT/PM pool created on approval) or a follower's copy account.
    acct_ids = [a.id for a in accounts]
    copy_acct_ids: set = set()
    # account_id → 'pamm' | 'mam' | 'signal_provider' so the UI can label the
    # account precisely (PAMM / MAM) instead of a generic "Copy" tag.
    copy_type_by_acct: dict = {}
    if acct_ids:
        master_rows = await db.execute(
            select(MasterAccount.account_id, MasterAccount.master_type).where(
                MasterAccount.account_id.in_(acct_ids),
                MasterAccount.status.in_(["pending", "approved", "active"]),
            )
        )
        for mid, mtype in master_rows.all():
            if mid:
                copy_acct_ids.add(mid)
                copy_type_by_acct[mid] = mtype
        follower_rows = await db.execute(
            select(InvestorAllocation.investor_account_id, InvestorAllocation.copy_type).where(
                InvestorAllocation.investor_account_id.in_(acct_ids),
                InvestorAllocation.status == "active",
            )
        )
        for fid, ctype in follower_rows.all():
            if fid:
                copy_acct_ids.add(fid)
                # Follower's allocation type (pamm/mam) is the most precise label.
                copy_type_by_acct[fid] = ctype or copy_type_by_acct.get(fid)

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
                    # Use the canonical P&L helper so the quote-currency → account
                    # conversion (e.g. USDJPY P&L is in JPY, gold/USD already in USD)
                    # matches the positions endpoint and the trader/mobile clients.
                    # Previously this inline math skipped the conversion, so the
                    # Accounts-page equity for JPY / USD-base pairs disagreed with
                    # the terminal and the app.
                    unrealized_pnl += calc_position_pnl(
                        pos.side, pos.open_price, cp, pos.lots, cs,
                        instrument=pos.instrument,
                        account_currency=a.currency or "USD",
                        cross_rate=await cross_rate_for(pos.instrument, a.currency or "USD"),
                    )
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
            "is_wallet_account": bool(getattr(a, "is_wallet_account", False)),
            "is_copy_trading": a.id in copy_acct_ids,
            "copy_type": copy_type_by_acct.get(a.id),  # 'pamm' | 'mam' | 'signal_provider' | None
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
                cross_rate=await cross_rate_for(pos.instrument),
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
