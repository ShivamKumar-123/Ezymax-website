import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import get_current_admin
from packages.common.src.models import User
from packages.common.src.admin_schemas import EmployeeIn, EmployeeUpdate
from services import employee_service

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("")
async def list_employees(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.list_employees(db=db)


@router.post("")
async def create_employee(
    body: EmployeeIn,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.create_employee(
        body=body, admin=admin,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/{employee_id}")
async def update_employee(
    employee_id: uuid.UUID,
    body: EmployeeUpdate,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.update_employee(
        employee_id=employee_id, body=body, admin=admin,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: uuid.UUID,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.delete_employee(
        employee_id=employee_id, admin=admin,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/{employee_id}/activity")
async def get_employee_activity(
    employee_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.get_employee_activity(
        employee_id=employee_id, page=page, per_page=per_page, db=db,
    )


@router.post("/{employee_id}/login-as")
async def login_as_employee(
    employee_id: uuid.UUID,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.login_as_employee(
        employee_id=employee_id, admin=admin,
        ip_address=request.client.host if request.client else None, db=db,
    )
