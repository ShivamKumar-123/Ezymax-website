"""Super-admin routes for managing read-only `demo_admin` user accounts.

All endpoints reject non-super_admin callers — even a regular `admin`
can't create or remove demo accounts. The actual permission check
lives inside the service (demo_admin_service._require_super_admin) so
the AdminReadOnlyMiddleware can't be tricked into thinking these are
viewer-safe ".view" GETs that mutate something.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import User
from dependencies import get_current_admin
from services import demo_admin_service

router = APIRouter(prefix="/demo-admins", tags=["DemoAdmins"])


class CreateDemoAdminBody(BaseModel):
    email: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


@router.get("")
async def list_demo_admins(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await demo_admin_service.list_demo_admins(admin=admin, db=db)


@router.post("")
async def create_demo_admin(
    body: CreateDemoAdminBody,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await demo_admin_service.create_demo_admin(
        email=body.email,
        password=body.password,
        first_name=body.first_name,
        last_name=body.last_name,
        admin=admin,
        ip_address=request.client.host if request.client else None,
        db=db,
    )


@router.delete("/{demo_admin_id}")
async def delete_demo_admin(
    demo_admin_id: uuid.UUID,
    request: Request,
    hard: bool = False,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await demo_admin_service.delete_demo_admin(
        demo_admin_id=demo_admin_id,
        hard=hard,
        admin=admin,
        ip_address=request.client.host if request.client else None,
        db=db,
    )
