"""Admin routes for the decentralized deposit-wallet registry."""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from services import deposit_wallet_service

router = APIRouter(prefix="/deposit-wallets", tags=["DepositWallets"])


class UpsertDepositWalletRequest(BaseModel):
    network: str  # eth | bsc | tron
    address: str
    min_confirmations: int = 12


@router.get("")
async def list_deposit_wallets(
    admin: User = Depends(require_permission("settings.view")),
    db: AsyncSession = Depends(get_db),
):
    return {"wallets": await deposit_wallet_service.list_wallets(db=db)}


@router.put("")
async def upsert_deposit_wallet(
    body: UpsertDepositWalletRequest,
    request: Request,
    admin: User = Depends(require_permission("settings.edit")),
    db: AsyncSession = Depends(get_db),
):
    return await deposit_wallet_service.upsert_wallet(
        db=db, admin_id=admin.id,
        ip_address=request.client.host if request.client else None,
        network=body.network, address=body.address,
        min_confirmations=body.min_confirmations,
    )
