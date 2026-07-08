"""IB / Sub-Broker Business API — Referrals, commissions, MLM tree,
per-user drill-down and IB trade-on-behalf (scoped to referred users)."""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from packages.common.src.schemas import PlaceOrderRequest, ClosePositionRequest
from ..services import business_service
from ..services.auth_service import client_ip_for_inet

router = APIRouter()


@router.post("/ib-portal/login")
async def ib_portal_login(
    payload: dict = None,
    db: AsyncSession = Depends(get_db),
):
    """Public — sign in to the standalone IB partner portal with the
    login ID + password issued (and emailed) on approval. No existing session
    required; returns an access token the IB portal uses as a Bearer header."""
    payload = payload or {}
    return await business_service.ib_portal_login(
        login_id=payload.get("login_id"),
        password=payload.get("password"),
        db=db,
    )


@router.get("/status")
async def ib_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_status(user_id=current_user["user_id"], db=db)


@router.post("/apply", status_code=201)
async def apply_ib(
    application_data: dict = None,
    referral_code: str = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.apply_ib(
        user_id=current_user["user_id"], application_data=application_data, db=db,
    )


@router.post("/apply-sub-broker", status_code=201)
async def apply_sub_broker(
    application_data: dict = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.apply_sub_broker(
        user_id=current_user["user_id"], application_data=application_data, db=db,
    )


@router.get("/ib/dashboard")
async def ib_dashboard(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_dashboard(user_id=current_user["user_id"], db=db)


@router.get("/ib/referrals")
async def ib_referrals(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    has_traded: bool | None = Query(None),
    search: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_referrals(
        user_id=current_user["user_id"], page=page, per_page=per_page, db=db,
        has_traded=has_traded, search=search, date_from=date_from, date_to=date_to,
    )


@router.get("/ib/registered-no-trade")
async def ib_registered_no_trade(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Referred users who registered but never placed a trade."""
    return await business_service.ib_referrals(
        user_id=current_user["user_id"], page=page, per_page=per_page, db=db,
        has_traded=False, search=search, date_from=date_from, date_to=date_to,
    )


@router.get("/ib/commissions")
async def ib_commissions(
    status: str = Query(None, pattern="^(pending|paid|cancelled)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_commissions(
        user_id=current_user["user_id"], status=status,
        page=page, per_page=per_page, db=db,
    )


@router.get("/ib/commissions/by-source")
async def ib_commissions_by_source(
    status: str = Query(None, pattern="^(pending|paid|cancelled)$"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Commission grouped by source user + type (where the money comes from)."""
    return await business_service.ib_commissions_by_source(
        user_id=current_user["user_id"], status=status,
        date_from=date_from, date_to=date_to, db=db,
    )


@router.get("/ib/accounts-overview")
async def ib_accounts_overview(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All referred users + their trading accounts (Trade section list)."""
    return await business_service.ib_accounts_overview(
        ib_user_id=current_user["user_id"], db=db,
    )


@router.get("/ib/users/{user_id}")
async def ib_user_detail(
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Drill-down for one referred user (403 if not this IB's referral)."""
    return await business_service.ib_user_detail(
        ib_user_id=current_user["user_id"], target_user_id=user_id, db=db,
    )


@router.get("/ib/users/{user_id}/accounts")
async def ib_user_accounts(
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_user_accounts(
        ib_user_id=current_user["user_id"], target_user_id=user_id, db=db,
    )


@router.get("/ib/users/{user_id}/positions")
async def ib_user_positions(
    user_id: UUID,
    account_id: UUID = Query(...),
    status: str = Query("open", pattern="^(open|closed|all)$"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_user_positions(
        ib_user_id=current_user["user_id"], target_user_id=user_id,
        account_id=account_id, status=status, db=db,
    )


@router.post("/ib/users/{user_id}/impersonate")
async def ib_impersonate_referred(
    user_id: UUID,
    account_id: UUID | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a one-time link that opens the REAL trader terminal as this
    referred user (scoped: only the IB's own referrals). When account_id is
    given the terminal opens straight on that account."""
    return await business_service.ib_impersonate_referred(
        ib_user_id=current_user["user_id"], target_user_id=user_id,
        account_id=account_id, db=db,
    )


@router.post("/ib/trade/order", status_code=201)
async def ib_place_order(
    req: PlaceOrderRequest,
    request: Request,
    reason: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """IB places an order on a referred user's account (scoped + audited)."""
    return await business_service.ib_place_order_on_behalf(
        ib_user_id=current_user["user_id"], req=req, request=request,
        ip_address=client_ip_for_inet(request), db=db, reason=reason,
    )


@router.post("/ib/trade/positions/{position_id}/close")
async def ib_close_position(
    position_id: UUID,
    req: ClosePositionRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_close_position_on_behalf(
        ib_user_id=current_user["user_id"], position_id=position_id,
        req=req, ip_address=client_ip_for_inet(request), db=db,
    )


@router.get("/ib/tree")
async def ib_tree(
    max_depth: int = Query(5, ge=1, le=10),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_tree(
        user_id=current_user["user_id"], max_depth=max_depth, db=db,
    )


@router.post("/ib/generate-link")
async def generate_referral_link(
    utm_source: str = Query(None),
    utm_medium: str = Query(None),
    utm_campaign: str = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.generate_referral_link(
        user_id=current_user["user_id"],
        utm_source=utm_source, utm_medium=utm_medium, utm_campaign=utm_campaign,
        db=db,
    )


@router.get("/sub-broker/dashboard")
async def sub_broker_dashboard(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.sub_broker_dashboard(
        user_id=current_user["user_id"], db=db,
    )
