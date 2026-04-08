from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import get_current_admin
from packages.common.src.models import User
from packages.common.src.admin_schemas import AdminLoginRequest, AdminLoginResponse, AdminRefreshRequest
from services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(body: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.admin_login(body=body, db=db)


@router.post("/refresh", response_model=AdminLoginResponse)
async def admin_refresh(body: AdminRefreshRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.admin_refresh(body=body, db=db)


@router.get("/me")
async def get_admin_me(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.get_admin_me(admin=admin, db=db)
