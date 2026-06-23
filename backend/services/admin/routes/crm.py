"""CRM integration API (read-only) — for a third-party CRM to pull
leads / customers / revenue / dashboard data.

Auth: a static key in the `X-API-Key` header, compared to settings.CRM_API_KEY
(constant-time). No admin JWT / permission scope — this is a separate
machine-to-machine surface mounted at /api/v1/crm. Optionally restricted to
an IP allowlist (CRM_API_IP_ALLOWLIST).
"""
import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.database import get_db
from services import crm_service

logger = logging.getLogger("crm-api")
router = APIRouter(prefix="/crm", tags=["CRM Integration"])


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else ""


async def verify_crm_key(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> bool:
    """Gate CRM endpoints on the static API key (+ optional IP allowlist)."""
    settings = get_settings()
    configured = (settings.CRM_API_KEY or "").strip()
    if not configured:
        raise HTTPException(status_code=503, detail="CRM API not configured")
    if not x_api_key or not hmac.compare_digest(x_api_key.strip(), configured):
        raise HTTPException(status_code=401, detail="Invalid API key")

    allowlist = {ip.strip() for ip in (settings.CRM_API_IP_ALLOWLIST or "").split(",") if ip.strip()}
    if allowlist:
        ip = _client_ip(request)
        if ip not in allowlist:
            logger.warning("crm api: blocked IP %s (not in allowlist)", ip)
            raise HTTPException(status_code=403, detail="IP not allowed")
    return True


@router.get("/dashboard")
async def crm_dashboard(
    _: bool = Depends(verify_crm_key),
    db: AsyncSession = Depends(get_db),
):
    return await crm_service.dashboard(db)


@router.get("/leads")
async def crm_leads(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    search: str | None = Query(None),
    date_from: str | None = Query(None, description="YYYY-MM-DD (UTC)"),
    date_to: str | None = Query(None, description="YYYY-MM-DD (UTC)"),
    _: bool = Depends(verify_crm_key),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date as _date
    df = _date.fromisoformat(date_from) if date_from else None
    dt = _date.fromisoformat(date_to) if date_to else None
    return await crm_service.list_leads(
        db, page=page, per_page=per_page, search=search, date_from=df, date_to=dt,
    )


@router.get("/customers")
async def crm_customers(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    search: str | None = Query(None),
    _: bool = Depends(verify_crm_key),
    db: AsyncSession = Depends(get_db),
):
    return await crm_service.list_customers(db, page=page, per_page=per_page, search=search)
