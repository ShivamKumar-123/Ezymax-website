"""Profile API — User profile, password change, sessions, KYC."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from packages.common.src.models import User, UserAuditLog
from packages.common.src.schemas import (
    WalletNonceRequest, WalletNonceResponse, WalletVerifyRequest,
)
from ..services import profile_service, auth_service, wallet_auth_service
from ..services.auth_service import client_ip_for_inet

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=20)
    country: str | None = Field(None, max_length=100)
    address: str | None = None
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=20)
    language: str | None = Field(None, max_length=10)
    theme: str | None = Field(None, pattern="^(light|dark)$")
    date_of_birth: str | None = None
    # Self-declared Islamic preference. When true, the account picker hides
    # non-swap-free groups and the overnight fee engine skips this user's
    # leveraged positions (Trading_Mechanism.docx — Islamic accounts).
    is_islamic: bool | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


@router.get("")
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await profile_service.get_profile(
        user_id=current_user["user_id"], db=db,
    )


@router.put("")
async def update_profile(
    req: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await profile_service.update_profile(
        user_id=current_user["user_id"],
        update_data=req.model_dump(exclude_unset=True),
        db=db,
    )


@router.put("/password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await profile_service.change_password(
        user_id=current_user["user_id"],
        current_password=req.current_password,
        new_password=req.new_password,
        db=db,
    )


@router.get("/sessions")
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await profile_service.list_sessions(
        user_id=current_user["user_id"], db=db,
    )


@router.delete("/sessions/{session_id}")
async def terminate_session(
    session_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await profile_service.terminate_session(
        user_id=current_user["user_id"], session_id=session_id, db=db,
    )


# ── KYC ─────────────────────────────────────────────────────────────────────

@router.post("/kyc/submit")
async def submit_kyc(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    document_type_2: str | None = Form(default=None),
    file_2: UploadFile | None = File(default=None),
    residential_address: str | None = Form(None),
    city: str | None = Form(None),
    postal_code: str | None = Form(None),
    country_of_residence: str | None = Form(None),
):
    """Upload one or two KYC documents (multipart). Optional address fields update the user profile.

    Allowed when kyc_status is pending/rejected. Blocked when submitted, under_review, or approved.
    Sets kyc_status to 'submitted' so admin KYC queue can pick it up.
    """
    return await profile_service.submit_kyc(
        user_id=current_user["user_id"],
        document_type=document_type,
        file=file,
        document_type_2=document_type_2,
        file_2=file_2,
        residential_address=residential_address,
        city=city,
        postal_code=postal_code,
        country_of_residence=country_of_residence,
        db=db,
    )


@router.get("/kyc/file/{doc_id}")
async def get_kyc_file(
    doc_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a KYC document file. Users can only access their own documents."""
    file_path = await profile_service.get_kyc_file(
        user_id=current_user["user_id"], document_id=doc_id, db=db,
    )
    return FileResponse(str(file_path))


# ── Wallet linking (SIWE) ───────────────────────────────────────────────────


@router.post("/wallet/link/nonce", response_model=WalletNonceResponse)
async def link_wallet_nonce(
    req: WalletNonceRequest, request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Issue a single-use SIWE nonce bound to *this* authenticated user.
    Used by the profile page's 'Link Wallet' flow — separate from the
    sign-in nonce because we need to ensure the eventual signature
    verification can only succeed inside the original session."""
    try:
        return await wallet_auth_service.issue_nonce(
            req.address, req.chain_id, request, db,
            issued_for="link", user_id=current_user["user_id"],
        )
    except wallet_auth_service.AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/wallet/link")
async def link_wallet(
    req: WalletVerifyRequest, request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify a SIWE signature for the authenticated user and persist the
    wallet address on their account row.

    Strict rules per the onboarding policy:
      • Wallet address arrives from the SIWE message — never trusted from
        an out-of-band field. verify_message returns the address recovered
        from the signature, which is what we persist.
      • Address normalised lowercase before storage.
      • CASE 1: rejects 409 if the wallet is already linked to a different
        account.
      • CASE 2: rejects 400 if THIS account already has a different wallet
        — one account = one wallet. Disconnecting first is the only path
        to swap wallets.
      • Writes a UserAuditLog row with action_type=WALLET_LINKED so support
        can reconstruct any account history.
    """
    try:
        addr_lower, _nonce_row = await wallet_auth_service.verify_message(
            req.message, req.signature, request, db,
            expected_user_id=current_user["user_id"],
        )
    except wallet_auth_service.AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    addr_lower = (addr_lower or "").strip().lower()

    user_q = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = user_q.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # CASE 2 — this account already has a different wallet.
    if user.wallet_address and (user.wallet_address or "").lower() != addr_lower:
        raise HTTPException(
            status_code=400,
            detail="Only one wallet can be linked per account.",
        )

    # CASE 1 — another row already owns this address.
    existing_q = await db.execute(
        select(User.id).where(
            func.lower(User.wallet_address) == addr_lower,
            User.id != user.id,
        )
    )
    if existing_q.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="This wallet is already linked to another account.",
        )

    user.wallet_address = addr_lower
    db.add(UserAuditLog(
        user_id=user.id,
        action_type="WALLET_LINKED",
        ip_address=client_ip_for_inet(request),
        device_info=f"address={addr_lower}",
    ))
    try:
        await db.commit()
    except IntegrityError as e:
        # The partial UNIQUE index on LOWER(wallet_address) caught a race.
        # Translate to the same 409 the application-level guard uses.
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This wallet is already linked to another account.",
        ) from e
    return await auth_service.get_me(user.id, db)


@router.delete("/wallet/link")
async def unlink_wallet(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove the linked wallet from the authenticated user's account.

    Refused when the wallet is the user's only sign-in method — they'd
    lock themselves out. After disconnect the onboarding gate kicks in
    again and blocks the dashboard until a new wallet is linked. Writes
    a UserAuditLog WALLET_DISCONNECTED entry."""
    user_q = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = user_q.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    has_password = bool(user.password_hash)
    has_google = bool(user.google_id)
    if not (has_password or has_google):
        raise HTTPException(
            status_code=400,
            detail="Cannot disconnect your only sign-in method. Set a password or link Google first.",
        )

    prior_address = user.wallet_address
    user.wallet_address = None
    if prior_address:
        db.add(UserAuditLog(
            user_id=user.id,
            action_type="WALLET_DISCONNECTED",
            ip_address=client_ip_for_inet(request),
            device_info=f"prior_address={prior_address}",
        ))
    await db.commit()
    return await auth_service.get_me(user.id, db)
