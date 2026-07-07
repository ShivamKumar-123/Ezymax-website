"""Business Service — IB/Sub-Broker, referrals, commissions, MLM tree."""
import json
from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    IBProfile, IBApplication, IBCommission, IBCommissionPlan,
    Referral, User, TradingAccount, Position, Deposit, UserAuditLog,
)

from . import trading_service


def _get_frontend_url() -> str:
    from packages.common.src.config import get_settings
    s = get_settings()
    origins = [o.strip() for o in s.CORS_ORIGINS.split(",") if o.strip()]
    for o in origins:
        if "fxartha.com" in o:
            return o
    for o in origins:
        if ":3000" in o:
            return o
    return origins[0] if origins else "http://localhost:3000"


# ── Shared IB scope helpers ─────────────────────────────────────────────
# Every IB endpoint resolves the caller's IBProfile from their user_id, and
# the trade / drill-down features additionally require that the target user
# (or account owner) is one of THIS IB's referred users — a Referral row with
# ib_profile_id == profile.id. These three helpers centralise those checks so
# no endpoint can accidentally leak another IB's (or an unrelated user's) data.
async def _require_ib_profile(user_id: UUID, db: AsyncSession) -> IBProfile:
    result = await db.execute(select(IBProfile).where(IBProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="IB profile not found")
    return profile


async def _require_referred_user(profile_id: UUID, target_user_id: UUID, db: AsyncSession) -> User:
    """403 unless target_user_id was referred by this IB."""
    ref = await db.execute(
        select(Referral.id).where(
            Referral.ib_profile_id == profile_id,
            Referral.referred_id == target_user_id,
        ).limit(1)
    )
    if ref.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="This user is not one of your referrals")
    user_q = await db.execute(select(User).where(User.id == target_user_id))
    user = user_q.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _require_referred_account(profile_id: UUID, account_id: UUID, db: AsyncSession) -> TradingAccount:
    """Load a trading account and 403 unless its owner is referred by this IB."""
    acct_q = await db.execute(select(TradingAccount).where(TradingAccount.id == account_id))
    account = acct_q.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await _require_referred_user(profile_id, account.user_id, db)
    return account


def _account_dict(a: TradingAccount, book_type: str | None = None) -> dict:
    d = {
        "id": str(a.id),
        "account_number": a.account_number,
        "currency": a.currency,
        "balance": float(a.balance or 0),
        "credit": float(a.credit or 0),
        "equity": float(a.equity or 0),
        "margin_used": float(a.margin_used or 0),
        "free_margin": float(a.free_margin or 0),
        "leverage": a.leverage,
        "is_demo": bool(a.is_demo),
        "is_active": bool(a.is_active),
    }
    if book_type is not None:
        d["book_type"] = book_type
    return d


async def ib_portal_login(login_id: str | None, password: str | None, db: AsyncSession) -> dict:
    """Authenticate against the standalone IB partner-portal credentials
    (separate login ID + password issued on approval). On success returns a
    normal user access token for the underlying account so the IB dashboard
    APIs work with a Bearer header — the portal keeps its own session,
    independent of the trader app's cookie."""
    from packages.common.src.auth import verify_password, create_access_token

    lid = (login_id or "").strip()
    pwd = password or ""
    if not lid or not pwd:
        raise HTTPException(status_code=400, detail="Login ID and password are required")

    result = await db.execute(
        select(IBProfile).where(
            IBProfile.portal_login_id == lid,
            IBProfile.is_active == True,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile or not profile.portal_password_hash or not verify_password(pwd, profile.portal_password_hash):
        raise HTTPException(status_code=401, detail="Invalid IB login ID or password")

    user_q = await db.execute(select(User).where(User.id == profile.user_id))
    user = user_q.scalar_one_or_none()
    token, _ = create_access_token(str(profile.user_id), "user")
    name = f"{(user.first_name if user else '') or ''} {(user.last_name if user else '') or ''}".strip()
    return {"access_token": token, "referral_code": profile.referral_code, "name": name}


async def ib_status(user_id: UUID, db: AsyncSession) -> dict:
    profile_result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()

    app_result = await db.execute(
        select(IBApplication).where(IBApplication.user_id == user_id)
        .order_by(IBApplication.created_at.desc())
    )
    application = app_result.scalars().first()

    if profile:
        return {
            "is_ib": True,
            "referral_code": profile.referral_code,
            "level": profile.level,
            "total_earned": float(profile.total_earned),
            "pending_payout": float(profile.pending_payout),
            "is_active": profile.is_active,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
        }

    if application:
        return {
            "is_ib": False,
            "application_status": application.status,
            "applied_at": application.created_at.isoformat() if application.created_at else None,
        }

    return {"is_ib": False, "application_status": None}


async def apply_ib(user_id: UUID, application_data: dict | None, db: AsyncSession) -> dict:
    existing_profile = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    if existing_profile.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You are already an IB")

    existing_app = await db.execute(
        select(IBApplication).where(
            IBApplication.user_id == user_id,
            IBApplication.status == "pending",
        )
    )
    if existing_app.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a pending application")

    application = IBApplication(
        user_id=user_id,
        status="pending",
        application_data=application_data or {},
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)

    return {
        "id": str(application.id),
        "status": application.status,
        "message": "IB application submitted for review",
    }


async def apply_sub_broker(user_id: UUID, application_data: dict | None, db: AsyncSession) -> dict:
    existing_app = await db.execute(
        select(IBApplication).where(
            IBApplication.user_id == user_id,
            IBApplication.status == "pending",
        )
    )
    if existing_app.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a pending application")

    existing_profile = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    if existing_profile.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a business profile")

    data = application_data or {}
    data["type"] = "sub_broker"

    application = IBApplication(
        user_id=user_id,
        status="pending",
        application_data=data,
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)

    return {
        "id": str(application.id),
        "status": application.status,
        "message": "Sub-broker application submitted for review",
    }


async def ib_dashboard(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="IB profile not found")

    referral_count = await db.execute(
        select(func.count()).select_from(Referral).where(Referral.ib_profile_id == profile.id)
    )
    total_referrals = referral_count.scalar()

    total_commission = await db.execute(
        select(func.coalesce(func.sum(IBCommission.amount), 0)).where(IBCommission.ib_id == profile.id)
    )
    total_comm = total_commission.scalar()

    pending_comm = await db.execute(
        select(func.coalesce(func.sum(IBCommission.amount), 0)).where(
            IBCommission.ib_id == profile.id, IBCommission.status == "pending",
        )
    )
    pending = pending_comm.scalar()

    # Sub-IBs — referred users who themselves became IBs (direct children in
    # the MLM tree). This surfaces "if my referral became an IB, show their
    # name under my sub-IBs" right on the dashboard.
    sub_ib_rows = await db.execute(
        select(IBProfile, User.first_name, User.last_name, User.email)
        .join(User, IBProfile.user_id == User.id)
        .where(IBProfile.parent_ib_id == profile.id)
        .order_by(IBProfile.created_at.desc())
    )
    sub_ibs = [
        {
            "name": f"{fn or ''} {ln or ''}".strip() or em,
            "email": em,
            "referral_code": p.referral_code,
            "level": p.level,
            "total_earned": float(p.total_earned or 0),
        }
        for p, fn, ln, em in sub_ib_rows.all()
    ]

    # Split referred users into "traded at least once" vs "registered but
    # never placed a trade" (any position ever, open or closed).
    referred_ids_q = await db.execute(
        select(Referral.referred_id).where(Referral.ib_profile_id == profile.id)
    )
    referred_ids = [r[0] for r in referred_ids_q.all()]
    traded = 0
    if referred_ids:
        traded_q = await db.execute(
            select(func.count(func.distinct(TradingAccount.user_id)))
            .select_from(Position)
            .join(TradingAccount, Position.account_id == TradingAccount.id)
            .where(TradingAccount.user_id.in_(referred_ids))
        )
        traded = traded_q.scalar() or 0
    registered_no_trade = max(0, len(referred_ids) - traded)

    base_url = _get_frontend_url()

    return {
        "referral_code": profile.referral_code,
        "referral_link": f"{base_url}/auth/register?ref={profile.referral_code}",
        "level": profile.level,
        "total_referrals": total_referrals,
        "total_commission": float(total_comm),
        "pending_payout": float(profile.pending_payout),
        "total_earned": float(profile.total_earned),
        "is_active": profile.is_active,
        "traded_count": traded,
        "registered_no_trade": registered_no_trade,
        "sub_ib_count": len(sub_ibs),
        "sub_ibs": sub_ibs,
    }


async def ib_referrals(
    user_id: UUID, page: int, per_page: int, db: AsyncSession,
    *, has_traded: bool | None = None, search: str | None = None,
    date_from: date | None = None, date_to: date | None = None,
) -> dict:
    """Paginated referral list with optional filters.

    Filters: `has_traded` (True/False/None), `search` (email or name),
    `date_from`/`date_to` (Referral.created_at). The traded-set is computed
    with a single aggregate (not per-row) so the `has_traded` filter and the
    pagination counts stay correct together.
    """
    profile = await _require_ib_profile(user_id, db)

    # 1. All referrals matching the search/date filters (ids only, ordered).
    base = (
        select(
            Referral.id, Referral.referred_id, Referral.created_at,
            Referral.utm_source, Referral.utm_medium, Referral.utm_campaign,
            User.email, User.first_name, User.last_name,
            User.created_at.label("user_created"),
        )
        .join(User, Referral.referred_id == User.id)
        .where(Referral.ib_profile_id == profile.id)
    )
    if search and search.strip():
        like = f"%{search.strip()}%"
        base = base.where(
            User.email.ilike(like)
            | func.concat(func.coalesce(User.first_name, ""), " ", func.coalesce(User.last_name, "")).ilike(like)
        )
    if date_from:
        base = base.where(Referral.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        base = base.where(Referral.created_at <= datetime.combine(date_to, time.max))
    base = base.order_by(Referral.created_at.desc())
    all_rows = (await db.execute(base)).all()

    all_ids = [r.referred_id for r in all_rows]

    # 2. Trades-per-user in one aggregate → has_traded set.
    trade_counts: dict = {}
    if all_ids:
        tc = await db.execute(
            select(TradingAccount.user_id, func.count(Position.id))
            .select_from(Position)
            .join(TradingAccount, Position.account_id == TradingAccount.id)
            .where(TradingAccount.user_id.in_(all_ids))
            .group_by(TradingAccount.user_id)
        )
        trade_counts = {uid: cnt for uid, cnt in tc.all()}

    # 3. Apply has_traded filter to the row set BEFORE totalling/paginating.
    if has_traded is not None:
        all_rows = [r for r in all_rows if (trade_counts.get(r.referred_id, 0) > 0) == has_traded]

    total = len(all_rows)
    page_rows = all_rows[(page - 1) * per_page: (page - 1) * per_page + per_page]
    page_ids = [r.referred_id for r in page_rows]

    # 4. Account count + balance sum for just this page, in one aggregate.
    acct_agg: dict = {}
    if page_ids:
        aa = await db.execute(
            select(
                TradingAccount.user_id,
                func.count(TradingAccount.id),
                func.coalesce(func.sum(TradingAccount.balance), 0),
            )
            .where(TradingAccount.user_id.in_(page_ids))
            .group_by(TradingAccount.user_id)
        )
        acct_agg = {uid: (cnt, bal) for uid, cnt, bal in aa.all()}

    items = []
    for r in page_rows:
        acct_count, total_deposit = acct_agg.get(r.referred_id, (0, 0))
        trades_count = trade_counts.get(r.referred_id, 0)
        items.append({
            "id": str(r.id),
            "user_id": str(r.referred_id),
            "referred_user": {
                "id": str(r.referred_id),
                "email": r.email,
                "name": f"{r.first_name or ''} {r.last_name or ''}".strip(),
                "joined_at": r.user_created.isoformat() if r.user_created else None,
            },
            "accounts_count": acct_count,
            "total_deposit": float(total_deposit),
            "trades_count": trades_count,
            "has_traded": trades_count > 0,
            "utm_source": r.utm_source,
            "utm_medium": r.utm_medium,
            "utm_campaign": r.utm_campaign,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {
        "items": items, "total": total, "page": page, "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def ib_commissions(
    user_id: UUID, status: str | None, page: int, per_page: int, db: AsyncSession,
) -> dict:
    profile_result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="IB profile not found")

    base_query = select(func.count()).select_from(IBCommission).where(IBCommission.ib_id == profile.id)
    if status:
        base_query = base_query.where(IBCommission.status == status)
    count_result = await db.execute(base_query)
    total = count_result.scalar()

    query = (
        select(IBCommission, User.email, User.first_name, User.last_name)
        .join(User, IBCommission.source_user_id == User.id)
        .where(IBCommission.ib_id == profile.id)
    )
    if status:
        query = query.where(IBCommission.status == status)
    query = query.order_by(IBCommission.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    rows = result.all()

    items = []
    for comm, email, first_name, last_name in rows:
        items.append({
            "id": str(comm.id),
            "source_user": {
                "email": email,
                "name": f"{first_name or ''} {last_name or ''}".strip(),
            },
            "commission_type": comm.commission_type,
            "amount": float(comm.amount),
            "mlm_level": comm.mlm_level,
            "status": comm.status,
            "created_at": comm.created_at.isoformat() if comm.created_at else None,
        })

    return {
        "items": items, "total": total, "page": page, "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def ib_tree(user_id: UUID, max_depth: int, db: AsyncSession) -> dict:
    profile_result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="IB profile not found")

    cte_query = text("""
        WITH RECURSIVE ib_tree AS (
            SELECT
                ip.id, ip.user_id, ip.parent_ib_id, ip.referral_code,
                ip.level, ip.total_earned, ip.is_active,
                u.email, u.first_name, u.last_name,
                1 AS depth
            FROM ib_profiles ip
            JOIN users u ON ip.user_id = u.id
            WHERE ip.parent_ib_id = :root_id

            UNION ALL

            SELECT
                ip.id, ip.user_id, ip.parent_ib_id, ip.referral_code,
                ip.level, ip.total_earned, ip.is_active,
                u.email, u.first_name, u.last_name,
                t.depth + 1
            FROM ib_profiles ip
            JOIN users u ON ip.user_id = u.id
            JOIN ib_tree t ON ip.parent_ib_id = t.id
            WHERE t.depth < :max_depth
        )
        SELECT * FROM ib_tree ORDER BY depth, email
    """)

    result = await db.execute(cte_query, {"root_id": str(profile.id), "max_depth": max_depth})
    rows = result.fetchall()

    nodes_by_parent = {}
    for row in rows:
        parent_id = str(row.parent_ib_id) if row.parent_ib_id else None
        node = {
            "id": str(row.id), "user_id": str(row.user_id),
            "email": row.email,
            "name": f"{row.first_name or ''} {row.last_name or ''}".strip(),
            "referral_code": row.referral_code, "level": row.level,
            "depth": row.depth, "total_earned": float(row.total_earned),
            "is_active": row.is_active, "children": [],
        }
        nodes_by_parent.setdefault(parent_id, []).append(node)

    def build_tree(parent_id: str) -> list:
        children = nodes_by_parent.get(parent_id, [])
        for child in children:
            child["children"] = build_tree(child["id"])
        return children

    tree = build_tree(str(profile.id))

    return {
        "root": {
            "id": str(profile.id), "referral_code": profile.referral_code,
            "level": profile.level, "total_earned": float(profile.total_earned),
        },
        "tree": tree, "total_nodes": len(rows),
    }


async def generate_referral_link(
    user_id: UUID, utm_source: str | None, utm_medium: str | None,
    utm_campaign: str | None, db: AsyncSession,
) -> dict:
    profile_result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="IB profile not found")

    base_url = _get_frontend_url()
    link = f"{base_url}/auth/register?ref={profile.referral_code}"
    params = []
    if utm_source:
        params.append(f"utm_source={utm_source}")
    if utm_medium:
        params.append(f"utm_medium={utm_medium}")
    if utm_campaign:
        params.append(f"utm_campaign={utm_campaign}")
    if params:
        link += "&" + "&".join(params)

    return {"referral_link": link, "referral_code": profile.referral_code}


async def sub_broker_dashboard(user_id: UUID, db: AsyncSession) -> dict:
    profile_result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Sub-broker profile not found")

    direct_referrals = await db.execute(
        select(func.count()).select_from(Referral).where(Referral.ib_profile_id == profile.id)
    )
    direct_count = direct_referrals.scalar()

    client_result = await db.execute(
        select(
            Referral.referred_id, User.email, User.first_name, User.last_name,
            User.status, User.kyc_status, User.created_at,
        )
        .join(User, Referral.referred_id == User.id)
        .where(Referral.ib_profile_id == profile.id)
        .order_by(Referral.created_at.desc()).limit(50)
    )
    clients = client_result.all()

    client_list = []
    for referred_id, email, fname, lname, status, kyc, joined in clients:
        acct_result = await db.execute(
            select(func.count(), func.coalesce(func.sum(TradingAccount.balance), 0))
            .where(TradingAccount.user_id == referred_id)
        )
        acct_stats = acct_result.one()
        client_list.append({
            "user_id": str(referred_id), "email": email,
            "name": f"{fname or ''} {lname or ''}".strip(),
            "status": status, "kyc_status": kyc,
            "accounts_count": acct_stats[0],
            "total_balance": float(acct_stats[1]),
            "joined_at": joined.isoformat() if joined else None,
        })

    total_comm = await db.execute(
        select(func.coalesce(func.sum(IBCommission.amount), 0)).where(IBCommission.ib_id == profile.id)
    )

    return {
        "referral_code": profile.referral_code,
        "direct_clients": direct_count,
        "total_commission": float(total_comm.scalar()),
        "pending_payout": float(profile.pending_payout),
        "total_earned": float(profile.total_earned),
        "clients": client_list,
    }


# ══════════════════════════════════════════════════════════════════════
# Expanded IB portal — commission breakdown, drill-down, trade-on-behalf
# ══════════════════════════════════════════════════════════════════════

async def ib_commissions_by_source(
    user_id: UUID, status: str | None, date_from: date | None,
    date_to: date | None, db: AsyncSession,
) -> dict:
    """Aggregate this IB's commissions grouped by source user + type across
    ALL rows (no pagination) — answers "where is my commission coming from
    and how much". Supports status + date-range filters."""
    profile = await _require_ib_profile(user_id, db)

    q = (
        select(
            IBCommission.source_user_id,
            User.email, User.first_name, User.last_name,
            IBCommission.commission_type,
            func.coalesce(func.sum(IBCommission.amount), 0),
            func.count(IBCommission.id),
        )
        .join(User, IBCommission.source_user_id == User.id)
        .where(IBCommission.ib_id == profile.id)
    )
    if status:
        q = q.where(IBCommission.status == status)
    if date_from:
        q = q.where(IBCommission.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        q = q.where(IBCommission.created_at <= datetime.combine(date_to, time.max))
    q = q.group_by(
        IBCommission.source_user_id, User.email, User.first_name, User.last_name,
        IBCommission.commission_type,
    )
    rows = (await db.execute(q)).all()

    sources: dict = {}
    grand_total = 0.0
    for src_id, email, fn, ln, ctype, amount, count in rows:
        amt = float(amount or 0)
        grand_total += amt
        entry = sources.setdefault(str(src_id), {
            "source_user": {
                "id": str(src_id),
                "email": email,
                "name": f"{fn or ''} {ln or ''}".strip() or email,
            },
            "total_amount": 0.0,
            "total_count": 0,
            "by_type": [],
        })
        entry["total_amount"] += amt
        entry["total_count"] += int(count or 0)
        entry["by_type"].append({"commission_type": ctype, "amount": amt, "count": int(count or 0)})

    source_list = sorted(sources.values(), key=lambda s: s["total_amount"], reverse=True)
    return {
        "sources": source_list,
        "grand_total": grand_total,
        "filters": {
            "status": status,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
        },
    }


async def ib_user_detail(ib_user_id: UUID, target_user_id: UUID, db: AsyncSession) -> dict:
    """Full drill-down for ONE referred user — scoped to this IB."""
    profile = await _require_ib_profile(ib_user_id, db)
    user = await _require_referred_user(profile.id, target_user_id, db)

    accts_q = await db.execute(
        select(TradingAccount).where(TradingAccount.user_id == target_user_id)
        .order_by(TradingAccount.created_at.asc())
    )
    accounts = accts_q.scalars().all()
    account_dicts = [_account_dict(a, getattr(user, "book_type", None)) for a in accounts]

    # Live open positions across every account (price-accurate P&L reused).
    open_positions: list = []
    for a in accounts:
        try:
            open_positions.extend(await trading_service.list_positions(a.id, target_user_id, "open", db))
        except HTTPException:
            pass

    deposits_total = (await db.execute(
        select(func.coalesce(func.sum(Deposit.amount), 0)).where(
            Deposit.user_id == target_user_id,
            Deposit.status.in_(["approved", "auto_approved"]),
        )
    )).scalar()

    commission_earned = (await db.execute(
        select(func.coalesce(func.sum(IBCommission.amount), 0)).where(
            IBCommission.ib_id == profile.id,
            IBCommission.source_user_id == target_user_id,
        )
    )).scalar()

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
            "status": user.status,
            "kyc_status": user.kyc_status,
            "country": user.country,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "accounts": account_dicts,
        "open_positions": open_positions,
        "deposits_total": float(deposits_total or 0),
        "commission_earned": float(commission_earned or 0),
    }


async def ib_accounts_overview(ib_user_id: UUID, db: AsyncSession) -> dict:
    """All referred users with their trading accounts in one payload — powers
    the Trade section's follower/account list."""
    profile = await _require_ib_profile(ib_user_id, db)
    refs = (await db.execute(
        select(User.id, User.first_name, User.last_name, User.email, User.book_type, User.created_at)
        .join(Referral, Referral.referred_id == User.id)
        .where(Referral.ib_profile_id == profile.id)
        .order_by(User.created_at.desc())
    )).all()
    ids = [r.id for r in refs]
    accts_by_user: dict = {}
    if ids:
        arows = (await db.execute(
            select(TradingAccount).where(TradingAccount.user_id.in_(ids))
            .order_by(TradingAccount.created_at.asc())
        )).scalars().all()
        for a in arows:
            accts_by_user.setdefault(a.user_id, []).append(a)

    users = []
    for r in refs:
        users.append({
            "user": {
                "id": str(r.id),
                "name": f"{r.first_name or ''} {r.last_name or ''}".strip() or r.email,
                "email": r.email,
            },
            "accounts": [_account_dict(a, r.book_type) for a in accts_by_user.get(r.id, [])],
        })
    return {"users": users}


async def ib_user_accounts(ib_user_id: UUID, target_user_id: UUID, db: AsyncSession) -> dict:
    """List a referred user's trading accounts (for the trade account picker)."""
    profile = await _require_ib_profile(ib_user_id, db)
    user = await _require_referred_user(profile.id, target_user_id, db)
    accts_q = await db.execute(
        select(TradingAccount).where(TradingAccount.user_id == target_user_id)
        .order_by(TradingAccount.created_at.asc())
    )
    accounts = accts_q.scalars().all()
    return {"items": [_account_dict(a, getattr(user, "book_type", None)) for a in accounts]}


async def ib_user_positions(
    ib_user_id: UUID, target_user_id: UUID, account_id: UUID,
    status: str, db: AsyncSession,
) -> dict:
    """Positions on a referred user's account (scoped)."""
    profile = await _require_ib_profile(ib_user_id, db)
    account = await _require_referred_account(profile.id, account_id, db)
    if account.user_id != target_user_id:
        raise HTTPException(status_code=400, detail="Account does not belong to this user")
    items = await trading_service.list_positions(account_id, target_user_id, status or "open", db)
    return {"items": items}


async def _ib_audit(db: AsyncSession, ib_user_id: UUID, action: str, ip: str | None, ctx: dict) -> None:
    db.add(UserAuditLog(
        user_id=ib_user_id,
        action_type=action,
        ip_address=(ip or "")[:64] or None,
        device_info=json.dumps(ctx, default=str)[:2048],
    ))
    await db.commit()


async def ib_place_order_on_behalf(
    ib_user_id: UUID, req, request: Request, ip_address: str | None, db: AsyncSession,
    reason: str | None = None,
) -> dict:
    """IB places an order on a referred user's account. Reuses the trading
    engine verbatim with the OWNER's user_id after verifying the referral.
    `reason` (audit only) records why the IB opened the trade."""
    profile = await _require_ib_profile(ib_user_id, db)
    account = await _require_referred_account(profile.id, req.account_id, db)
    owner_id = account.user_id

    result = await trading_service.place_order(
        req=req, request=request, user_id=owner_id, ip_address=ip_address, db=db,
    )
    await _ib_audit(db, ib_user_id, "IB_ORDER_PLACED", ip_address, {
        "on_behalf_of": str(owner_id),
        "account_id": str(req.account_id),
        "symbol": getattr(req, "symbol", None),
        "side": getattr(req, "side", None),
        "lots": str(getattr(req, "lots", "")),
        "reason": (reason or "")[:500],
        "position_id": result.get("position_id") if isinstance(result, dict) else None,
    })
    return result


async def ib_impersonate_referred(
    ib_user_id: UUID, target_user_id: UUID, db: AsyncSession,
    account_id: UUID | None = None,
) -> dict:
    """Mint a single-use, 60s redemption code that logs the IB into the REAL
    trader terminal AS one of their referred users. Mirrors the admin
    `login_as_user` flow (Redis db-0 `impersonation:{code}` → JWT), but scoped
    so an IB can only impersonate users they actually referred. The trader app
    opens `/auth/impersonate?code=...&redirect=<terminal>` and redeems it into
    HttpOnly cookies on the trader domain — so trades land on the follower's own
    account, in the exact same terminal a user gets. When `account_id` is given
    the terminal opens straight on that account (else it lands on /trading)."""
    import os
    import secrets
    import jwt
    import redis.asyncio as aioredis
    from datetime import datetime, timedelta
    from urllib.parse import quote
    from packages.common.src.config import get_settings

    profile = await _require_ib_profile(ib_user_id, db)
    user = await _require_referred_user(profile.id, target_user_id, db)  # 403 if not this IB's

    # If an account is named, it must belong to this referred user (so the
    # terminal deep-link is valid and can't point at someone else's account).
    if account_id is not None:
        acct = (await db.execute(
            select(TradingAccount).where(
                TradingAccount.id == account_id, TradingAccount.user_id == target_user_id,
            )
        )).scalar_one_or_none()
        if not acct:
            raise HTTPException(status_code=404, detail="Account not found for this user")

    s = get_settings()
    expire = datetime.utcnow() + timedelta(hours=2)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "type": "trader",              # gateway decode_token enforces trader realm
        "impersonated_by": str(ib_user_id),
        "impersonated_via": "ib_portal",
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, s.JWT_SECRET, algorithm=s.JWT_ALGORITHM)

    code = secrets.token_hex(16)
    payload_json = json.dumps({
        "access_token": token,
        "user_email": user.email,
        "user_id": str(user.id),
        "impersonated_by": str(ib_user_id),
    })
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    pool = aioredis.from_url(redis_url.rsplit("/", 1)[0] + "/0", decode_responses=True)
    try:
        await pool.setex(f"impersonation:{code}", 60, payload_json)
    finally:
        try:
            await pool.aclose()
        except Exception:
            pass

    # audit on the IB's own trail
    await _ib_audit(db, ib_user_id, "IB_IMPERSONATE_TERMINAL", None, {
        "target_user": str(user.id), "email": user.email,
    })

    base = _get_frontend_url().rstrip("/")
    # Deep-link to the terminal on the chosen account. The whole terminal path
    # (incl. its own ?account=&view= query) is percent-encoded so it survives
    # as a single `redirect` value on the impersonate URL.
    if account_id is not None:
        terminal_path = f"/trading/terminal?account={account_id}&view=chart"
    else:
        terminal_path = "/trading/terminal"
    return {
        "code": code,
        "expires_in": 60,
        "redirect_url": f"{base}/auth/impersonate?code={code}&redirect={quote(terminal_path, safe='')}",
    }


async def ib_close_position_on_behalf(
    ib_user_id: UUID, position_id: UUID, req, ip_address: str | None, db: AsyncSession,
) -> dict:
    """IB closes a position on a referred user's account (scoped)."""
    profile = await _require_ib_profile(ib_user_id, db)
    pos_q = await db.execute(select(Position).where(Position.id == position_id))
    pos = pos_q.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    account = await _require_referred_account(profile.id, pos.account_id, db)
    owner_id = account.user_id

    result = await trading_service.close_position(position_id, req, owner_id, db)
    await _ib_audit(db, ib_user_id, "IB_POSITION_CLOSED", ip_address, {
        "on_behalf_of": str(owner_id),
        "account_id": str(pos.account_id),
        "position_id": str(position_id),
    })
    return result
