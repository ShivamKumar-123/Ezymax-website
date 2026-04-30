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
    role: str
    status: str
    kyc_status: str
    is_demo: bool = False
    main_wallet_balance: float = 0.0
    two_factor_enabled: bool
    language: str
    theme: str
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str
