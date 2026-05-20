"""Share Trade API — authenticated create + public fetch of share cards."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from packages.common.src.schemas import CreateShareRequest
from ..services import share_service

router = APIRouter()
public_router = APIRouter()


@router.post("/positions/{position_id}/share")
async def create_share(
    position_id: UUID,
    body: CreateShareRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await share_service.create_share_link(
        position_id=position_id,
        user_id=current_user["user_id"],
        description=body.description,
        link_description=body.link_description,
        display_mode=body.display_mode,
        db=db,
    )


@public_router.get("/share/{code}")
async def get_public_share(code: str, db: AsyncSession = Depends(get_db)):
    return await share_service.get_public_share(code=code, db=db)
