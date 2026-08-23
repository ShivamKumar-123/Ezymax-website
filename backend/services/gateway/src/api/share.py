"""Share Trade API — authenticated create + public fetch of share cards.

A link covers one of three scopes: a single position, every open position
on an account, or an account's entire history (open + closed).
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from packages.common.src.schemas import CreateShareRequest, CreateAccountShareRequest
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


@router.post("/accounts/{account_id}/share")
async def create_account_share(
    account_id: UUID,
    body: CreateAccountShareRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Share every trade on an account — `scope` is 'open' or 'history'."""
    return await share_service.create_account_share_link(
        account_id=account_id,
        user_id=current_user["user_id"],
        scope=body.scope,
        description=body.description,
        link_description=body.link_description,
        display_mode=body.display_mode,
        db=db,
    )


@router.get("/accounts/{account_id}/share-preview")
async def preview_account_share(
    account_id: UUID,
    scope: str = Query(pattern="^(open|history)$"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Figures the share modal renders before any link is minted."""
    return await share_service.preview_account_share(
        account_id=account_id,
        user_id=current_user["user_id"],
        scope=scope,
        db=db,
    )


@public_router.get("/share/{code}")
async def get_public_share(code: str, db: AsyncSession = Depends(get_db)):
    return await share_service.get_public_share(code=code, db=db)
