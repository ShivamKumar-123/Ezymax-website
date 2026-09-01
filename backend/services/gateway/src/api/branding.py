"""White-label branding API (trader-facing).

  * GET /branding/by-domain?host=…  — PUBLIC brand lookup for the host the
    visitor is on. Powers the trader frontend's BrandingProvider: on a
    tenant's custom domain it swaps the chrome (name/logo/support) before
    login. Only READY, non-suspended domains resolve; everything else
    returns the platform-default payload.
  * GET /branding/me                — the brand the AUTHED user should see
    (resolved from their owning broker chain), regardless of host.
  * GET /branding/logo/{filename}   — serves uploaded tenant logos from the
    shared uploads volume (same-origin <img> on the trader app).
"""
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from packages.common.src.models import User
from packages.common.src import broker_tenancy
from packages.common.src.path_safety import safe_join_under_base, PathTraversalError

router = APIRouter()
settings = get_settings()


def _logo_dir() -> Path:
    env = os.environ.get("BRANDING_UPLOAD_DIR", "").strip()
    if env:
        return Path(env)
    # services/gateway/src/api → backend/uploads/branding (matches the
    # admin service's default and the shared ./backend/uploads volume).
    return Path(__file__).resolve().parents[4] / "uploads" / "branding"


@router.get("/by-domain")
async def branding_by_domain(
    request: Request,
    host: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """Public. Explicit ?host= wins (the Next.js server proxy forwards the
    browser's host this way); otherwise falls back to Origin/Referer."""
    if not settings.BRANDING_ENABLED:
        return broker_tenancy.branding_payload(None)
    lookup_host = (host or "").strip().lower() or broker_tenancy.host_from_request_headers(
        request.headers.get("origin"), request.headers.get("referer")
    )
    owner = await broker_tenancy.find_broker_by_domain(db, lookup_host)
    if owner is None:
        return broker_tenancy.branding_payload(None)
    profile = await broker_tenancy.get_broker_profile(db, owner.id)
    return broker_tenancy.branding_payload(profile)


@router.get("/me")
async def branding_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.BRANDING_ENABLED:
        return broker_tenancy.branding_payload(None)
    user = (
        await db.execute(select(User).where(User.id == current_user["user_id"]))
    ).scalar_one_or_none()
    if user is None:
        return broker_tenancy.branding_payload(None)
    owner = await broker_tenancy.resolve_branding_owner_for_user(db, user)
    if owner is None:
        return broker_tenancy.branding_payload(None)
    profile = await broker_tenancy.get_broker_profile(db, owner.id)
    return broker_tenancy.branding_payload(profile)


@router.get("/logo/{filename}")
async def serve_logo(filename: str):
    try:
        path = safe_join_under_base(_logo_dir(), filename)
    except PathTraversalError:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)
