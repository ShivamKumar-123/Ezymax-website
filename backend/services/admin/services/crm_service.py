"""CRM integration service — read-only business data for an external CRM.

Three views: platform `dashboard()`, `list_leads()` (per user), and
`list_customers()` (flat row per live trading account). Platform-wide
dashboard numbers reuse the existing admin analytics/dashboard services;
per-customer aggregates are computed here with grouped subqueries.

Notes:
- Deposits/withdrawals are wallet/user-level (Deposit.account_id is often
  NULL for wallet top-ups), so they're summed per USER and repeated on each
  of the user's account rows.
- IB commission is attributed to an account via the originating trade
  (ib_commissions.source_trade_id -> orders.account_id). IB rows with no
  trade (e.g. deposit-based) aren't account-attributed.
- current_pnl uses stored positions.profit (last-known; fresh at close).
- Contribution fields for the CRM's ContributionEntry: `brokerage` = gross
  brokerage (per account); `trading_loss` = the account's net realized loss
  (positive, 0 if profitable — B-book platform revenue). `insurance`
  (fees − claims) and `staking` (rewards accrued) are user-level, so — like
  deposits/withdrawals — they're summed per USER and repeated on each of the
  user's account rows.
- Demo accounts are excluded everywhere (live-only), matching admin views.
"""
import logging
from datetime import date, datetime, time, timezone

from sqlalchemy import select, func, text
from sqlalchemy.exc import ProgrammingError, DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import TradingAccount, TradeHistory
from packages.common.src.admin_schemas import (
    PaginatedResponse, CrmDashboard, CrmLeadRow, CrmCustomerRow,
    CrmTradeRow, CrmTransactionRow, CrmReferralRow,
)
from . import analytics_service, dashboard_service

_log = logging.getLogger("uvicorn.error")


def _source(utm_source, has_referrer) -> str:
    if utm_source:
        return str(utm_source)
    return "referral" if has_referrer else "direct"


# ── Dashboard ────────────────────────────────────────────────────────────

async def dashboard(db: AsyncSession) -> CrmDashboard:
    a = await analytics_service.analytics_dashboard(db)
    d = await dashboard_service.get_dashboard_stats(db)

    active_accounts = (await db.execute(
        select(func.count(TradingAccount.id)).where(
            TradingAccount.is_active == True,
            TradingAccount.is_demo == False,
        )
    )).scalar() or 0

    lots = (await db.execute(
        select(func.coalesce(func.sum(TradeHistory.lots), 0))
    )).scalar() or 0

    return CrmDashboard(
        total_traders=int(getattr(d, "total_users", 0) or 0),
        active_accounts=int(active_accounts),
        total_deposits=float(a.get("total_deposits", 0) or 0),
        total_withdrawals=float(a.get("total_withdrawals", 0) or 0),
        lots_traded=float(lots or 0),
        todays_revenue=float((a.get("today") or {}).get("total_revenue", 0) or 0),
        monthly_revenue=float((a.get("this_month") or {}).get("total_revenue", 0) or 0),
    )


# ── Leads (per user) ──────────────────────────────────────────────────────

async def list_leads(
    db: AsyncSession,
    page: int,
    per_page: int,
    search: str | None,
    date_from: date | None,
    date_to: date | None,
) -> PaginatedResponse:
    like = f"%{search.strip()}%" if search and search.strip() else None
    df = datetime.combine(date_from, time.min, tzinfo=timezone.utc) if date_from else None
    dt = datetime.combine(date_to, time.max, tzinfo=timezone.utc) if date_to else None
    params = {"search": like, "df": df, "dt": dt, "limit": per_page, "offset": (page - 1) * per_page}

    where = """
        WHERE u.role NOT IN ('admin','super_admin','demo_admin')
          AND (CAST(:search AS text) IS NULL
               OR u.email ILIKE CAST(:search AS text)
               OR trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) ILIKE CAST(:search AS text)
               OR u.phone ILIKE CAST(:search AS text))
          AND (CAST(:df AS timestamptz) IS NULL OR u.created_at >= :df)
          AND (CAST(:dt AS timestamptz) IS NULL OR u.created_at <= :dt)
    """
    count_sql = text(f"SELECT count(*) FROM users u {where}")
    rows_sql = text(f"""
        SELECT u.id AS user_id, u.email, u.phone, u.country,
               trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) AS name,
               u.status, u.kyc_status, u.created_at,
               (SELECT r.utm_source FROM referrals r WHERE r.referred_id = u.id ORDER BY r.created_at LIMIT 1) AS utm_source,
               EXISTS (SELECT 1 FROM referrals r WHERE r.referred_id = u.id AND r.referrer_id IS NOT NULL) AS has_referrer,
               EXISTS (SELECT 1 FROM trading_accounts ta WHERE ta.user_id = u.id AND ta.is_demo = false) AS has_account,
               (SELECT count(*) FROM trading_accounts ta WHERE ta.user_id = u.id AND ta.is_demo = false) AS sub_accounts,
               ibp.referral_code AS referral_code,
               (ibp.id IS NOT NULL) AS is_ib,
               COALESCE(ibp.total_earned, 0) AS ib_commission_total,
               COALESCE((SELECT count(*) FROM referrals r WHERE r.ib_profile_id = ibp.id), 0) AS followers_count,
               (SELECT ru.email FROM referrals r JOIN users ru ON ru.id = r.referrer_id
                  WHERE r.referred_id = u.id AND r.referrer_id IS NOT NULL ORDER BY r.created_at LIMIT 1) AS referred_by,
               (SELECT count(*) FROM referrals r WHERE r.referrer_id = u.id) AS referrals_count
        FROM users u
        LEFT JOIN ib_profiles ibp ON ibp.user_id = u.id
        {where}
        ORDER BY u.created_at DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """)
    try:
        total = (await db.execute(count_sql, params)).scalar() or 0
        rows = (await db.execute(rows_sql, params)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("crm list_leads failed: %s", exc)
        return PaginatedResponse(items=[], total=0, page=page, per_page=per_page)

    items = []
    for r in (row._mapping for row in rows):
        items.append(CrmLeadRow(
            user_id=str(r["user_id"]),
            name=(r["name"] or "").strip() or None,
            phone=r["phone"], email=r["email"], country=r["country"],
            source=_source(r["utm_source"], r["has_referrer"]),
            assigned_rm=None,
            status=r["status"], kyc_status=r["kyc_status"],
            created_at=r["created_at"], has_account=bool(r["has_account"]),
            sub_accounts=int(r["sub_accounts"] or 0),
            is_ib=bool(r["is_ib"]),
            referral_code=r["referral_code"],
            followers_count=int(r["followers_count"] or 0),
            ib_commission_total=float(r["ib_commission_total"] or 0),
            referred_by=r["referred_by"],
            referrals_count=int(r["referrals_count"] or 0),
        ).model_dump())
    return PaginatedResponse(items=items, total=int(total), page=page, per_page=per_page)


# ── Customers (flat row per live trading account) ─────────────────────────

async def list_customers(
    db: AsyncSession, page: int, per_page: int, search: str | None,
) -> PaginatedResponse:
    like = f"%{search.strip()}%" if search and search.strip() else None
    params = {"search": like, "limit": per_page, "offset": (page - 1) * per_page}

    search_clause = """
        (CAST(:search AS text) IS NULL
         OR u.email ILIKE CAST(:search AS text)
         OR trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) ILIKE CAST(:search AS text)
         OR ta.account_number ILIKE CAST(:search AS text))
    """
    count_sql = text(f"""
        SELECT count(*) FROM trading_accounts ta
        JOIN users u ON u.id = ta.user_id
        WHERE ta.is_demo = false AND {search_clause}
    """)
    rows_sql = text(f"""
        SELECT
            u.id AS user_id, u.email, u.phone, u.country, u.kyc_status,
            trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) AS name,
            (SELECT r.utm_source FROM referrals r WHERE r.referred_id = u.id ORDER BY r.created_at LIMIT 1) AS utm_source,
            EXISTS (SELECT 1 FROM referrals r WHERE r.referred_id = u.id AND r.referrer_id IS NOT NULL) AS has_referrer,
            ta.account_number, ta.currency, ta.balance, ta.equity, ta.created_at AS account_opened_at,
            ta.is_active AS account_active,
            ag.name AS account_type,
            ibp.referral_code AS referral_code,
            (ibp.id IS NOT NULL) AS is_ib,
            COALESCE(ibp.total_earned, 0) AS ib_commission_total,
            COALESCE(dep.total, 0) AS total_deposit,
            COALESCE(wd.total, 0) AS total_withdrawal,
            COALESCE(th.lots, 0) + COALESCE(op.lots, 0) AS lots_traded,
            COALESCE(op.pnl, 0) AS current_pnl,
            COALESCE(th.profit, 0) AS realized_pnl,
            COALESCE(op.comm, 0) + COALESCE(th.comm, 0) AS gross_brokerage,
            COALESCE(ibc.amount, 0) AS ib_commission,
            COALESCE(insf.fees, 0) - COALESCE(insc.claims, 0) AS insurance,
            COALESCE(stk.rewards, 0) AS staking
        FROM trading_accounts ta
        JOIN users u ON u.id = ta.user_id
        LEFT JOIN account_groups ag ON ag.id = ta.account_group_id
        LEFT JOIN ib_profiles ibp ON ibp.user_id = u.id
        LEFT JOIN (
            SELECT user_id, sum(amount) AS total FROM deposits
            WHERE status IN ('approved','auto_approved') GROUP BY user_id
        ) dep ON dep.user_id = u.id
        LEFT JOIN (
            SELECT user_id, sum(amount) AS total FROM withdrawals
            WHERE status IN ('approved','completed') GROUP BY user_id
        ) wd ON wd.user_id = u.id
        LEFT JOIN (
            SELECT account_id, sum(lots) AS lots, sum(profit) AS profit, sum(commission) AS comm
            FROM trade_history GROUP BY account_id
        ) th ON th.account_id = ta.id
        LEFT JOIN (
            SELECT account_id, sum(lots) AS lots, sum(profit) AS pnl, sum(commission) AS comm
            FROM positions WHERE lower(cast(status AS text)) = 'open' GROUP BY account_id
        ) op ON op.account_id = ta.id
        LEFT JOIN (
            SELECT o.account_id AS account_id, sum(ic.amount) AS amount
            FROM ib_commissions ic JOIN orders o ON o.id = ic.source_trade_id
            GROUP BY o.account_id
        ) ibc ON ibc.account_id = ta.id
        LEFT JOIN (
            SELECT user_id, sum(fee) AS fees FROM insurance_policies GROUP BY user_id
        ) insf ON insf.user_id = u.id
        LEFT JOIN (
            SELECT user_id, sum(claim_amount) AS claims FROM insurance_claims GROUP BY user_id
        ) insc ON insc.user_id = u.id
        LEFT JOIN (
            SELECT sp.user_id, sum(sra.reward_amount) AS rewards
            FROM staking_reward_accruals sra
            JOIN staking_positions sp ON sp.id = sra.position_id
            GROUP BY sp.user_id
        ) stk ON stk.user_id = u.id
        WHERE ta.is_demo = false AND {search_clause}
        ORDER BY ta.created_at DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """)
    try:
        total = (await db.execute(count_sql, params)).scalar() or 0
        rows = (await db.execute(rows_sql, params)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("crm list_customers failed: %s", exc)
        return PaginatedResponse(items=[], total=0, page=page, per_page=per_page)

    items = []
    for r in (row._mapping for row in rows):
        gross = float(r["gross_brokerage"] or 0)
        ibc = float(r["ib_commission"] or 0)
        realized = float(r["realized_pnl"] or 0)
        current = float(r["current_pnl"] or 0)
        # B-book: the customer's net realized loss is platform revenue.
        trading_loss = -realized if realized < 0 else 0.0
        total_profit = realized if realized > 0 else 0.0     # item 5
        net_pnl = realized + current                          # item 5 (realized + unrealised)
        items.append(CrmCustomerRow(
            user_id=str(r["user_id"]),
            name=(r["name"] or "").strip() or None,
            phone=r["phone"], email=r["email"], country=r["country"],
            source=_source(r["utm_source"], r["has_referrer"]),
            assigned_rm=None,
            broker="FXArtha",
            account_number=r["account_number"],
            account_type=r["account_type"],
            currency=r["currency"],
            balance=float(r["balance"] or 0),
            equity=float(r["equity"] or 0),
            total_deposit=float(r["total_deposit"] or 0),
            total_withdrawal=float(r["total_withdrawal"] or 0),
            lots_traded=float(r["lots_traded"] or 0),
            current_pnl=float(r["current_pnl"] or 0),
            realized_pnl=realized,
            gross_brokerage=gross,
            ib_commission=ibc,
            net_revenue=gross - ibc,
            # Contribution breakdown for the CRM's ContributionEntry.
            brokerage=gross,
            insurance=float(r["insurance"] or 0),
            staking=float(r["staking"] or 0),
            trading_loss=trading_loss,
            total_profit=total_profit,
            net_pnl=net_pnl,
            account_opened_at=r["account_opened_at"],
            account_status="active" if r["account_active"] else "inactive",
            kyc_status=r["kyc_status"],
            is_ib=bool(r["is_ib"]),
            referral_code=r["referral_code"],
            ib_commission_total=float(r["ib_commission_total"] or 0),
        ).model_dump())
    return PaginatedResponse(items=items, total=int(total), page=page, per_page=per_page)


# ── Trades (per closed trade) — item 2 ────────────────────────────────────

async def list_trades(
    db: AsyncSession, page: int, per_page: int, search: str | None,
    date_from: date | None, date_to: date | None,
) -> PaginatedResponse:
    like = f"%{search.strip()}%" if search and search.strip() else None
    df = datetime.combine(date_from, time.min, tzinfo=timezone.utc) if date_from else None
    dt = datetime.combine(date_to, time.max, tzinfo=timezone.utc) if date_to else None
    params = {"search": like, "df": df, "dt": dt, "limit": per_page, "offset": (page - 1) * per_page}
    where = """
        WHERE ta.is_demo = false
          AND (CAST(:search AS text) IS NULL OR u.email ILIKE CAST(:search AS text)
               OR ta.account_number ILIKE CAST(:search AS text))
          AND (CAST(:df AS timestamptz) IS NULL OR th.closed_at >= :df)
          AND (CAST(:dt AS timestamptz) IS NULL OR th.closed_at <= :dt)
    """
    base = """
        FROM trade_history th
        JOIN trading_accounts ta ON ta.id = th.account_id
        JOIN users u ON u.id = ta.user_id
        LEFT JOIN instruments i ON i.id = th.instrument_id
    """
    count_sql = text(f"SELECT count(*) {base} {where}")
    rows_sql = text(f"""
        SELECT th.id AS trade_id, ta.user_id, ta.account_number, i.symbol,
               th.side, th.lots, th.open_price, th.close_price,
               th.opened_at, th.closed_at, th.profit, th.commission, th.swap, th.close_reason
        {base} {where}
        ORDER BY th.closed_at DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """)
    try:
        total = (await db.execute(count_sql, params)).scalar() or 0
        rows = (await db.execute(rows_sql, params)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("crm list_trades failed: %s", exc)
        return PaginatedResponse(items=[], total=0, page=page, per_page=per_page)
    items = []
    for r in (row._mapping for row in rows):
        pnl = float(r["profit"] or 0)
        comm = float(r["commission"] or 0)
        swap = float(r["swap"] or 0)
        items.append(CrmTradeRow(
            trade_id=str(r["trade_id"]), user_id=str(r["user_id"]),
            account_number=r["account_number"], symbol=r["symbol"],
            side=str(r["side"]).lower() if r["side"] is not None else None,
            lots=float(r["lots"] or 0),
            open_price=float(r["open_price"] or 0), close_price=float(r["close_price"] or 0),
            opened_at=r["opened_at"], closed_at=r["closed_at"],
            profit=pnl if pnl > 0 else 0.0, loss=-pnl if pnl < 0 else 0.0, net_pnl=pnl,
            commission=comm, swap=swap, brokerage=comm + swap,
            close_reason=r["close_reason"],
        ).model_dump())
    return PaginatedResponse(items=items, total=int(total), page=page, per_page=per_page)


# ── Transactions (deposits + withdrawals) — item 6 ────────────────────────

async def list_transactions(
    db: AsyncSession, page: int, per_page: int, search: str | None,
    tx_type: str | None, date_from: date | None, date_to: date | None,
) -> PaginatedResponse:
    like = f"%{search.strip()}%" if search and search.strip() else None
    df = datetime.combine(date_from, time.min, tzinfo=timezone.utc) if date_from else None
    dt = datetime.combine(date_to, time.max, tzinfo=timezone.utc) if date_to else None
    params = {"search": like, "df": df, "dt": dt, "ttype": tx_type,
              "limit": per_page, "offset": (page - 1) * per_page}
    union = """
        SELECT d.id AS tx_id, d.user_id, 'deposit' AS type, d.amount, d.currency,
               d.method, d.status, d.created_at
        FROM deposits d
        UNION ALL
        SELECT w.id AS tx_id, w.user_id, 'withdrawal' AS type, w.amount, NULL::varchar AS currency,
               w.method, w.status, w.created_at
        FROM withdrawals w
    """
    filt = """
        JOIN users u ON u.id = t.user_id
        WHERE (CAST(:ttype AS text) IS NULL OR t.type = CAST(:ttype AS text))
          AND (CAST(:search AS text) IS NULL OR u.email ILIKE CAST(:search AS text))
          AND (CAST(:df AS timestamptz) IS NULL OR t.created_at >= :df)
          AND (CAST(:dt AS timestamptz) IS NULL OR t.created_at <= :dt)
    """
    count_sql = text(f"SELECT count(*) FROM ({union}) t {filt}")
    rows_sql = text(f"""
        SELECT t.* FROM ({union}) t {filt}
        ORDER BY t.created_at DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """)
    try:
        total = (await db.execute(count_sql, params)).scalar() or 0
        rows = (await db.execute(rows_sql, params)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("crm list_transactions failed: %s", exc)
        return PaginatedResponse(items=[], total=0, page=page, per_page=per_page)
    items = []
    for r in (row._mapping for row in rows):
        items.append(CrmTransactionRow(
            transaction_id=str(r["tx_id"]), user_id=str(r["user_id"]),
            type=r["type"], amount=float(r["amount"] or 0),
            currency=r["currency"], method=r["method"], status=r["status"],
            created_at=r["created_at"],
        ).model_dump())
    return PaginatedResponse(items=items, total=int(total), page=page, per_page=per_page)


# ── Referral network — item 4 ─────────────────────────────────────────────

async def list_referrals(
    db: AsyncSession, page: int, per_page: int, user_id: str | None,
) -> PaginatedResponse:
    params = {"uid": user_id, "limit": per_page, "offset": (page - 1) * per_page}
    where = """
        WHERE r.referrer_id IS NOT NULL
          AND (CAST(:uid AS uuid) IS NULL OR r.referrer_id = CAST(:uid AS uuid) OR r.referred_id = CAST(:uid AS uuid))
    """
    base = """
        FROM referrals r
        JOIN users rd ON rd.id = r.referred_id
        LEFT JOIN users rr ON rr.id = r.referrer_id
        LEFT JOIN ib_profiles ibp ON ibp.id = r.ib_profile_id
    """
    count_sql = text(f"SELECT count(*) {base} {where}")
    rows_sql = text(f"""
        SELECT r.referrer_id, rr.email AS referrer_email, ibp.referral_code AS referrer_code,
               r.referred_id, rd.email AS referred_email,
               trim(coalesce(rd.first_name,'') || ' ' || coalesce(rd.last_name,'')) AS referred_name,
               rd.country AS referred_country,
               EXISTS (SELECT 1 FROM trading_accounts ta WHERE ta.user_id = rd.id AND ta.is_demo = false) AS referred_has_account,
               r.created_at
        {base} {where}
        ORDER BY r.created_at DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """)
    try:
        total = (await db.execute(count_sql, params)).scalar() or 0
        rows = (await db.execute(rows_sql, params)).all()
    except (ProgrammingError, DBAPIError) as exc:
        await db.rollback()
        _log.warning("crm list_referrals failed: %s", exc)
        return PaginatedResponse(items=[], total=0, page=page, per_page=per_page)
    items = []
    for r in (row._mapping for row in rows):
        items.append(CrmReferralRow(
            referrer_id=str(r["referrer_id"]) if r["referrer_id"] else None,
            referrer_email=r["referrer_email"], referrer_referral_code=r["referrer_code"],
            referred_id=str(r["referred_id"]), referred_email=r["referred_email"],
            referred_name=(r["referred_name"] or "").strip() or None,
            referred_country=r["referred_country"],
            referred_has_account=bool(r["referred_has_account"]),
            created_at=r["created_at"],
        ).model_dump())
    return PaginatedResponse(items=items, total=int(total), page=page, per_page=per_page)
