"""Branding routes (admin panel).

  * GET    /branding/me                 — broker's own branding + domain state
  * PUT    /branding/me                 — multipart: brand_name, contacts, logo
  * POST   /branding/domain             — set custom domain → pending_dns
  * POST   /branding/domain/verify      — DNS check → provisioning kickoff
  * DELETE /branding/domain             — disconnect + cert teardown
  * GET    /branding/logo/{filename}    — serve an uploaded logo (admin UI)

A broker manages only its OWN branding. The platform super-admin can act
on any broker's branding via the ?broker_id= override (used from the
Brokers page).
"""
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import User
from packages.common.src import broker_tenancy
from packages.common.src.path_safety import safe_join_under_base, PathTraversalError
from dependencies import get_current_admin
from services import branding_admin_service as svc

router = APIRouter(prefix="/branding", tags=["Branding"])


async def _profile_for(admin: User, db: AsyncSession, broker_id: uuid.UUID | None):
    """The broker profile the actor may edit: their own, or — for the
    platform super-admin — any broker's via ?broker_id=."""
    if broker_id is not None:
        if admin.role != "super_admin":
            raise HTTPException(status_code=403, detail="Super admin required to edit another broker's branding")
        profile = await broker_tenancy.get_broker_profile(db, broker_id)
        if profile is None:
            raise HTTPException(status_code=404, detail="Broker not found")
        return profile
    return await svc.get_own_profile(db, admin)


class DomainRequest(BaseModel):
    domain: str
    app_subdomain: str = ""


@router.get("/logo/{filename}")
async def serve_logo(filename: str):
    try:
        path = safe_join_under_base(svc._logo_dir(), filename)
    except PathTraversalError:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)


@router.get("/me")
async def my_branding(
    broker_id: uuid.UUID | None = Query(None),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    profile = await _profile_for(admin, db, broker_id)
    return svc.branding_state(profile)


@router.put("/me")
async def update_branding(
    broker_id: uuid.UUID | None = Query(None),
    brand_name: str | None = Form(None),
    support_email: str | None = Form(None),
    support_whatsapp: str | None = Form(None),
    logo: UploadFile | None = File(None),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    profile = await _profile_for(admin, db, broker_id)
    return await svc.update_branding(
        db, profile,
        brand_name=brand_name,
        support_email=support_email,
        support_whatsapp=support_whatsapp,
        logo=logo,
    )


@router.post("/domain")
async def set_domain(
    body: DomainRequest,
    broker_id: uuid.UUID | None = Query(None),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    profile = await _profile_for(admin, db, broker_id)
    return await svc.set_custom_domain(db, profile, body.domain, body.app_subdomain)


@router.post("/domain/verify")
async def verify_domain(
    broker_id: uuid.UUID | None = Query(None),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    profile = await _profile_for(admin, db, broker_id)
    return await svc.verify_custom_domain(db, profile)


@router.delete("/domain")
async def disconnect_domain(
    broker_id: uuid.UUID | None = Query(None),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    profile = await _profile_for(admin, db, broker_id)
    return await svc.disconnect_custom_domain(db, profile)
