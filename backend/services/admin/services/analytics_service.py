"""Admin Analytics Service — dashboard stats, exposure, profitable users."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    User, Position, Transaction, Deposit, Withdrawal,
    Instrument, PositionStatus, OrderSide, TradingAccount,
    TradeHistory, MasterAccount, IBProfile, IBCommission,
    InvestorAllocation, CopyTrade, UserBonus,
)


def _start_of_today():
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _start_of_week():
    today = _start_of_today()
    return today - timedelta(days=today.weekday())


def _start_of_month():
    today = _start_of_today()
    return today.replace(day=1)


async def _revenue_stats(db: AsyncSession, since=None):
    commission_filter = [Position.commission != 0]
    swap_filter = [Position.swap != 0]
    pnl_filter = []

    if since:
        commission_filter.append(Position.created_at >= since)
        swap_filter.append(Position.created_at >= since)
        pnl_filter.append(TradeHistory.closed_at >= since)

    comm_q = await db.execute(
        select(func.coalesce(func.sum(Position.commission), 0)).where(*commission_filter)
    )
    total_commission = abs(float(comm_q.scalar() or 0))

    swap_q = await db.execute(
        select(func.coalesce(func.sum(Position.swap), 0)).where(*swap_filter)
    )
    total_swap = abs(float(swap_q.scalar() or 0))

    pnl_q_filters = []
    if since:
        pnl_q_filters.append(TradeHistory.closed_at >= since)
    pnl_q = await db.execute(
        select(func.coalesce(func.sum(TradeHistory.profit), 0)).where(*pnl_q_filters) if pnl_q_filters
        else select(func.coalesce(func.sum(TradeHistory.profit), 0))
    )
    user_pnl = float(pnl_q.scalar() or 0)

    return {
        "total_revenue": total_commission + total_swap,
        "commission_revenue": total_commission,
        "swap_revenue": total_swap,
        "spread_revenue": 0,
        "net_pnl": -user_pnl,
    }


async def analytics_dashboard(db: AsyncSession) -> dict:
    today = await _revenue_stats(db, _start_of_today())
    week = await _revenue_stats(db, _start_of_week())
    month = await _revenue_stats(db, _start_of_month())
    all_time = await _revenue_stats(db)

    dep_q = await db.execute(
        select(func.coalesce(func.sum(Deposit.amount), 0)).where(
            Deposit.status.in_(["approved", "auto_approved"])
        )
    )
    total_deposits = float(dep_q.scalar() or 0)

    wd_q = await db.execute(
        select(func.coalesce(func.sum(Withdrawal.amount), 0)).where(
            Withdrawal.status.in_(["approved", "completed"])
        )
    )
    total_withdrawals = float(wd_q.scalar() or 0)

    open_pos_q = await db.execute(
        select(func.count(Position.id)).where(Position.status == PositionStatus.OPEN.value)
    )

    closed_trades_q = await db.execute(select(func.count(TradeHistory.id)))

    # Admin commission earned from all sources (PAMM performance fee, copy-trade, etc.)
    admin_comm_all_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == "admin_commission",
        )
    )
    total_admin_commission = float(admin_comm_all_q.scalar() or 0)

    # PAMM/MAM specific admin commission (performance + management fees)
    pamm_admin_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == "admin_commission",
            Transaction.description.ilike("%pamm%") | Transaction.description.ilike("%performance%") | Transaction.description.ilike("%management%"),
        )
    )
    pamm_admin_commission = float(pamm_admin_q.scalar() or 0)

    # Copy trade admin commission
    copy_rev_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == "admin_commission",
            Transaction.description.ilike("%copy%"),
        )
    )
    copy_trade_admin_revenue = float(copy_rev_q.scalar() or 0)

    master_count_q = await db.execute(
        select(func.count(MasterAccount.id)).where(MasterAccount.status.in_(["approved", "active"]))
    )

    ib_count_q = await db.execute(
        select(func.count(IBProfile.id)).where(IBProfile.is_active == True)
    )
    total_ibs = ib_count_q.scalar() or 0

    sub_broker_q = await db.execute(
        select(func.count(User.id)).where(User.role == "sub_broker", User.status == "active")
    )
    total_sub_brokers = sub_broker_q.scalar() or 0

    ib_commission_q = await db.execute(
        select(func.coalesce(func.sum(IBCommission.amount), 0))
    )
    total_ib_commission = float(ib_commission_q.scalar() or 0)

    ib_pending_q = await db.execute(
        select(func.coalesce(func.sum(IBCommission.amount), 0)).where(IBCommission.status == "pending")
    )
    ib_pending_commission = float(ib_pending_q.scalar() or 0)

    total_copy_trades_q = await db.execute(select(func.count(CopyTrade.id)))
    total_copy_trades = total_copy_trades_q.scalar() or 0

    active_copies_q = await db.execute(
        select(func.count(CopyTrade.id)).where(CopyTrade.status == "open")
    )
    active_copies = active_copies_q.scalar() or 0

    # Master earnings — performance fees credited to masters (not admin's share)
    copy_perf_fee_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type.in_(["ib_commission", "performance_fee", "master_commission"]),
        )
    )
    master_earnings_total = float(copy_perf_fee_q.scalar() or 0)

    total_aum_q = await db.execute(
        select(func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0)).where(
            InvestorAllocation.status == "active"
        )
    )
    total_aum = float(total_aum_q.scalar() or 0)

    total_followers_q = await db.execute(
        select(func.count(InvestorAllocation.id)).where(InvestorAllocation.status == "active")
    )
    total_followers = total_followers_q.scalar() or 0

    bonus_given_q = await db.execute(
        select(func.coalesce(func.sum(UserBonus.amount), 0))
    )
    total_bonus_given = float(bonus_given_q.scalar() or 0)

    active_bonus_q = await db.execute(
        select(func.count(UserBonus.id)).where(UserBonus.status == "active")
    )
    active_bonuses = active_bonus_q.scalar() or 0

    return {
        "today": today,
        "this_week": week,
        "this_month": month,
        "all_time": all_time,
        "total_deposits": total_deposits,
        "total_withdrawals": total_withdrawals,
        "net_deposits": total_deposits - total_withdrawals,
        "open_positions": open_pos_q.scalar() or 0,
        "closed_trades": closed_trades_q.scalar() or 0,
        "total_admin_commission": total_admin_commission,
        "pamm_admin_commission": pamm_admin_commission,
        "copy_trade_revenue": copy_trade_admin_revenue,
        "active_masters": master_count_q.scalar() or 0,
        "total_ibs": total_ibs,
        "total_sub_brokers": total_sub_brokers,
        "total_ib_commission": total_ib_commission,
        "ib_pending_commission": ib_pending_commission,
        "total_copy_trades": total_copy_trades,
        "active_copies": active_copies,
        "master_earnings_total": master_earnings_total,
        "total_aum": total_aum,
        "total_followers": total_followers,
        "total_bonus_given": total_bonus_given,
        "active_bonuses": active_bonuses,
    }


async def get_exposure(db: AsyncSession) -> dict:
    result = await db.execute(
        select(
            Position.instrument_id,
            func.sum(
                case((Position.side == OrderSide.BUY.value, Position.lots), else_=0)
            ).label("buy_lots"),
            func.sum(
                case((Position.side == OrderSide.SELL.value, Position.lots), else_=0)
            ).label("sell_lots"),
            func.sum(
                case((Position.side == OrderSide.BUY.value, 1), else_=0)
            ).label("buy_count"),
            func.sum(
                case((Position.side == OrderSide.SELL.value, 1), else_=0)
            ).label("sell_count"),
        )
        .where(Position.status == PositionStatus.OPEN.value)
        .group_by(Position.instrument_id)
    )
    rows = result.all()

    exposure_items = []
    for row in rows:
        inst_q = await db.execute(select(Instrument).where(Instrument.id == row.instrument_id))
        inst = inst_q.scalar_one_or_none()
        buy = float(row.buy_lots or 0)
        sell = float(row.sell_lots or 0)
        net = buy - sell
        risk = 'low' if abs(net) < 1 else 'medium' if abs(net) < 5 else 'high'
        exposure_items.append({
            "symbol": inst.symbol if inst else "Unknown",
            "total_long": buy,
            "total_short": sell,
            "net_exposure": net,
            "risk_level": risk,
        })

    top_users_q = await db.execute(
        select(
            TradeHistory.account_id,
            func.sum(TradeHistory.profit).label("total_pnl"),
            func.count(TradeHistory.id).label("trades_count"),
            func.sum(case((TradeHistory.profit > 0, 1), else_=0)).label("wins"),
        )
        .group_by(TradeHistory.account_id)
        .order_by(func.sum(TradeHistory.profit).desc())
        .limit(10)
    )
    user_rows = top_users_q.all()

    profitable_users = []
    for ur in user_rows:
        pnl = float(ur.total_pnl or 0)
        if pnl <= 0:
            continue
        acc_q = await db.execute(select(TradingAccount).where(TradingAccount.id == ur.account_id))
        acc = acc_q.scalar_one_or_none()
        user_name = "Unknown"
        user_id = str(ur.account_id)
        if acc:
            u_q = await db.execute(select(User).where(User.id == acc.user_id))
            u = u_q.scalar_one_or_none()
            if u:
                user_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
                user_id = str(u.id)
        tc = int(ur.trades_count or 0)
        wins = int(ur.wins or 0)
        profitable_users.append({
            "user_id": user_id,
            "user_name": user_name,
            "pnl": pnl,
            "trades_count": tc,
            "win_rate": (wins / tc * 100) if tc > 0 else 0,
        })

    return {
        "exposure": exposure_items,
        "profitable_users": profitable_users,
    }


async def platform_pnl_detail(db: AsyncSession) -> dict:
    """Comprehensive Platform P&L breakdown for the
    /admin/analytics/platform-pnl page. Surfaces:

      - Per-period totals (Today / Week / Month / All Time) with the
        four components: trade mirror, brokerage commission, swap,
        and the combined net platform P&L
      - The 10 users whose trading has COST the platform the most
        (i.e. those with the largest realized user-side profit —
        in B-book that's broker loss)
      - The 10 users who have EARNED the platform the most
        (largest realized user-side losses)
      - The 30 most-impactful recent closed trades (last 30 days,
        sorted by absolute platform P&L impact)

    All numbers reuse `_revenue_stats` and the existing TradeHistory
    table so this stays read-only — no new tables, no recompute on
    write, no migration.
    """
    today = _start_of_today()
    week = _start_of_week()
    month = _start_of_month()
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    periods = {
        "today": await _revenue_stats(db, since=today),
        "this_week": await _revenue_stats(db, since=week),
        "this_month": await _revenue_stats(db, since=month),
        "all_time": await _revenue_stats(db),
    }

    # Helper: build a "user impact" list. Both lists are derived from
    # the same per-user aggregate (grouped by user_id via the account
    # join) — winners are users whose net_pnl > 0 (broker lost), losers
    # are users whose net_pnl < 0 (broker won).
    user_agg_q = await db.execute(
        select(
            TradingAccount.user_id.label("user_id"),
            func.sum(TradeHistory.profit).label("net_pnl"),
            func.count(TradeHistory.id).label("trades_count"),
        )
        .join(TradingAccount, TradeHistory.account_id == TradingAccount.id)
        .where(TradingAccount.is_demo == False)
        .group_by(TradingAccount.user_id)
    )
    user_rows = user_agg_q.all()

    # Fan out a single User lookup so we don't N+1 per row.
    user_ids = [r.user_id for r in user_rows if r.user_id]
    users_map: dict = {}
    if user_ids:
        u_res = await db.execute(select(User).where(User.id.in_(user_ids)))
        for u in u_res.scalars().all():
            users_map[u.id] = u

    def _user_label(uid):
        u = users_map.get(uid)
        if not u:
            return ("Unknown", None)
        name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
        return (name, u.email)

    rows_sorted = sorted(user_rows, key=lambda r: float(r.net_pnl or 0))
    # Losers for the broker (user_net_pnl > 0): broker pays them
    top_costs = []
    for r in reversed(rows_sorted):
        net = float(r.net_pnl or 0)
        if net <= 0:
            break
        name, email = _user_label(r.user_id)
        top_costs.append({
            "user_id": str(r.user_id),
            "user_name": name,
            "user_email": email,
            "user_pnl": net,
            "platform_impact": -net,  # broker loss
            "trades_count": int(r.trades_count or 0),
        })
        if len(top_costs) >= 10:
            break
    # Winners for the broker (user_net_pnl < 0): broker collects them
    top_earnings = []
    for r in rows_sorted:
        net = float(r.net_pnl or 0)
        if net >= 0:
            break
        name, email = _user_label(r.user_id)
        top_earnings.append({
            "user_id": str(r.user_id),
            "user_name": name,
            "user_email": email,
            "user_pnl": net,
            "platform_impact": -net,  # broker gain
            "trades_count": int(r.trades_count or 0),
        })
        if len(top_earnings) >= 10:
            break

    # Recent big trades — last 30 days, top 30 by |profit|. Used by
    # the admin page to show "what moved the needle".
    big_trades_q = await db.execute(
        select(TradeHistory)
        .join(TradingAccount, TradeHistory.account_id == TradingAccount.id)
        .where(
            TradingAccount.is_demo == False,
            TradeHistory.closed_at >= thirty_days_ago,
        )
        .order_by(func.abs(TradeHistory.profit).desc())
        .limit(30)
    )
    big_trades_rows = big_trades_q.scalars().all()

    # Look up symbols + owners for the big-trade rows.
    big_trade_account_ids = {th.account_id for th in big_trades_rows}
    big_trade_instrument_ids = {th.instrument_id for th in big_trades_rows}
    big_accounts: dict = {}
    if big_trade_account_ids:
        a_res = await db.execute(select(TradingAccount).where(TradingAccount.id.in_(list(big_trade_account_ids))))
        for a in a_res.scalars().all():
            big_accounts[a.id] = a
    big_instruments: dict = {}
    if big_trade_instrument_ids:
        i_res = await db.execute(select(Instrument).where(Instrument.id.in_(list(big_trade_instrument_ids))))
        for i in i_res.scalars().all():
            big_instruments[i.id] = i

    big_trades = []
    for th in big_trades_rows:
        acc = big_accounts.get(th.account_id)
        owner_id = acc.user_id if acc else None
        name, email = _user_label(owner_id) if owner_id else ("Unknown", None)
        inst = big_instruments.get(th.instrument_id) if th.instrument_id else None
        user_p = float(th.profit or 0)
        big_trades.append({
            "trade_id": str(th.id),
            "user_id": str(owner_id) if owner_id else None,
            "user_name": name,
            "user_email": email,
            "symbol": inst.symbol if inst else None,
            "side": th.side.value if hasattr(th.side, "value") else str(th.side),
            "lots": float(th.lots or 0),
            "user_pnl": user_p,
            "platform_impact": -user_p,  # B-book mirror
            "close_reason": th.close_reason or "manual",
            "closed_at": th.closed_at.isoformat() if th.closed_at else None,
        })

    return {
        "periods": periods,
        "top_costs": top_costs,
        "top_earnings": top_earnings,
        "big_trades": big_trades,
    }


def _period_start(period: str | None):
    """Resolve a period keyword to its UTC start instant. Returns None
    for 'all'/unknown so the caller skips the closed_at filter."""
    if period == "today":
        return _start_of_today()
    if period == "week":
        return _start_of_week()
    if period == "month":
        return _start_of_month()
    return None


async def list_user_pnl_breakdown(
    db: AsyncSession,
    page: int = 1,
    per_page: int = 50,
    search: str | None = None,
    sort_by: str = "net_pnl",
    sort_dir: str = "desc",
    period: str | None = None,
) -> dict:
    """Per-user trade P&L breakdown for the analytics page. Groups every
    closed trade in TradeHistory by the user that owns the trading
    account, summing gross profit / gross loss / net P&L plus broker
    fees (commission + swap) and a few summary stats (trades count,
    win count, win rate, last closed date).

    `period` ('today' | 'week' | 'month' | 'all'/None) filters the
    trades by `TradeHistory.closed_at` — so clicking the Today /
    This Week / This Month card on the analytics page lists exactly
    the users who closed a trade in that window, with their realized
    profit / loss + the spread-equivalent fees (commission + swap)
    the broker booked from them.

    Unlike the top-10 list under `/analytics/exposure`, this is
    paginated and includes BOTH winners AND losers so admin can find
    any user — search by email / name does substring matching, sort
    flips by net P&L / trades / last activity.
    """
    since = _period_start(period)

    base = (
        select(
            TradingAccount.user_id.label("user_id"),
            func.sum(TradeHistory.profit).label("net_pnl"),
            func.sum(case((TradeHistory.profit > 0, TradeHistory.profit), else_=0)).label("gross_profit"),
            func.sum(case((TradeHistory.profit < 0, TradeHistory.profit), else_=0)).label("gross_loss"),
            func.coalesce(func.sum(TradeHistory.commission), 0).label("commission"),
            func.coalesce(func.sum(TradeHistory.swap), 0).label("swap"),
            func.count(TradeHistory.id).label("trades_count"),
            func.sum(case((TradeHistory.profit > 0, 1), else_=0)).label("wins"),
            func.max(TradeHistory.closed_at).label("last_closed_at"),
        )
        .join(TradingAccount, TradeHistory.account_id == TradingAccount.id)
        .where(TradingAccount.is_demo == False)
        .group_by(TradingAccount.user_id)
    )

    if since is not None:
        base = base.where(TradeHistory.closed_at >= since)

    if search:
        like = f"%{search}%"
        matching_users_q = select(User.id).where(
            (User.email.ilike(like)) |
            (User.first_name.ilike(like)) |
            (User.last_name.ilike(like))
        )
        base = base.where(TradingAccount.user_id.in_(matching_users_q))

    sort_col_map = {
        "net_pnl": func.sum(TradeHistory.profit),
        "gross_profit": func.sum(case((TradeHistory.profit > 0, TradeHistory.profit), else_=0)),
        "gross_loss": func.sum(case((TradeHistory.profit < 0, TradeHistory.profit), else_=0)),
        "trades_count": func.count(TradeHistory.id),
        "last_closed_at": func.max(TradeHistory.closed_at),
    }
    sort_col = sort_col_map.get(sort_by, sort_col_map["net_pnl"])
    sort_col = sort_col.desc() if sort_dir == "desc" else sort_col.asc()

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    page_q = base.order_by(sort_col).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(page_q)
    rows = result.all()

    user_ids = [r.user_id for r in rows]
    users_map: dict = {}
    if user_ids:
        users_res = await db.execute(select(User).where(User.id.in_(user_ids)))
        for u in users_res.scalars().all():
            users_map[u.id] = u

    items = []
    for r in rows:
        u = users_map.get(r.user_id)
        net = float(r.net_pnl or 0)
        gp = float(r.gross_profit or 0)
        gl = float(r.gross_loss or 0)
        commission = abs(float(r.commission or 0))
        swap = abs(float(r.swap or 0))
        tc = int(r.trades_count or 0)
        wins = int(r.wins or 0)
        items.append({
            "user_id": str(r.user_id),
            "user_name": (
                f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
                if u else "Unknown"
            ),
            "user_email": u.email if u else None,
            "net_pnl": net,
            "gross_profit": gp,
            "gross_loss": gl,
            "commission": commission,
            "swap": swap,
            # What the broker booked from this user's trades in the
            # window: brokerage commission + overnight swap. (Spread is
            # baked into the fill price, not stored per-trade, so it is
            # not separable here.)
            "broker_fees": commission + swap,
            "avg_per_trade": (net / tc) if tc > 0 else 0,
            "trades_count": tc,
            "wins": wins,
            "win_rate": (wins / tc * 100) if tc > 0 else 0,
            "last_closed_at": r.last_closed_at.isoformat() if r.last_closed_at else None,
        })

    # Period-wide totals across ALL matching users (not just this page) —
    # lets the frontend show a header summary for the active filter.
    totals_q = await db.execute(
        select(
            func.coalesce(func.sum(TradeHistory.profit), 0),
            func.coalesce(func.sum(TradeHistory.commission), 0),
            func.coalesce(func.sum(TradeHistory.swap), 0),
            func.count(TradeHistory.id),
            func.count(func.distinct(TradingAccount.user_id)),
        )
        .join(TradingAccount, TradeHistory.account_id == TradingAccount.id)
        .where(
            TradingAccount.is_demo == False,
            *([TradeHistory.closed_at >= since] if since is not None else []),
        )
    )
    t = totals_q.one()
    user_net = float(t[0] or 0)
    totals = {
        "user_net_pnl": user_net,
        "platform_pnl": -user_net,  # B-book mirror: user profit = broker loss
        "commission": abs(float(t[1] or 0)),
        "swap": abs(float(t[2] or 0)),
        "broker_fees": abs(float(t[1] or 0)) + abs(float(t[2] or 0)),
        "trades_count": int(t[3] or 0),
        "users_count": int(t[4] or 0),
    }

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
        "period": period or "all",
        "totals": totals,
    }
