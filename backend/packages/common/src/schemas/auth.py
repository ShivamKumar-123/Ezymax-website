"""Auth + user-account Pydantic schemas."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = None
    country: Optional[str] = None
    referral_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=16, max_length=512)
    new_password: str = Field(min_length=8, max_length=128)


class BootstrapSessionRequest(BaseModel):
    """Establish HttpOnly cookies from a valid access JWT (e.g. admin impersonation)."""

    access_token: str = Field(min_length=20, max_length=4096)


class GoogleAuthRequest(BaseModel):
    """Sign in or sign up with Google. id_token is the JWT returned by Google Sign-In on the client."""

    id_token: str = Field(min_length=20, max_length=8192)
    referral_code: Optional[str] = None


# ─── Wallet (SIWE / EIP-4361) sign-in ────────────────────────────────


class WalletNonceRequest(BaseModel):
    """Issued before the user signs a SIWE message. The address is the
    EVM account they're about to sign with."""

    address: str = Field(..., min_length=42, max_length=42, pattern=r"^0x[0-9a-fA-F]{40}$")
    chain_id: int = Field(..., ge=1)


class WalletNonceResponse(BaseModel):
    """Server tells the client what to put inside the SIWE message so the
    server-side validator and the client stay in lock-step. The client
    builds the SIWE message locally with these fields, then asks the
    wallet to sign it."""

    nonce: str
    issued_at: str   # ISO-8601 UTC
    expires_at: str
    domain: str
    statement: str


class WalletVerifyRequest(BaseModel):
    """Submitted after the wallet returns a signature. The full SIWE
    message is required because the server re-parses it (don't trust the
    client's interpretation of nonce/address/chain)."""

    message: str = Field(..., min_length=20, max_length=4096)
    signature: str = Field(..., pattern=r"^0x[0-9a-fA-F]{130}$")
    referral_code: Optional[str] = None


class OpenLiveAccountRequest(BaseModel):
    account_group_id: UUID
    leverage: Optional[int] = Field(default=None, ge=1, le=2000)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    expires_at: datetime


class UserResponse(BaseModel):
    id: UUID
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    country: Optional[str]
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    role: str
    status: str
    kyc_status: str
    is_demo: bool = False
    main_wallet_balance: float = 0.0
    two_factor_enabled: bool
    language: str
    theme: str
    # True when all the required fields needed before a user can deposit /
    # trade are populated (first/last name, phone, country, DOB). Derived
    # in auth_service.get_me — the frontend uses it to gate the
    # profile-completion modal.
    profile_complete: bool = False
    # Linked SIWE wallet address (lowercase). Null when the user hasn't
    # connected one. Drives the LinkedWalletCard UI.
    wallet_address: Optional[str] = None
    # Onboarding-gate flags (computed in get_me). The OnboardingGate on
    # the trader app reads these to decide whether to render the
    # non-dismissible modal. All four together are required before
    # dashboard access is unlocked for a non-demo/non-staff user.
    wallet_linked: bool = False
    email_verified: bool = False
    is_wallet_placeholder: bool = False
    onboarding_complete: bool = False
    # Whether the account has each non-wallet sign-in method available —
    # used by the FE to disable the "unlink wallet" button when wallet is
    # the user's only credential.
    has_password: bool = False
    has_google: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str
