"""Profile + change-password schemas (POST /profile/...)."""
from pydantic import BaseModel, Field


class UpdateProfileRequest(BaseModel):
    """All fields optional — clients send only what they're changing."""
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
    # Self-declared Islamic preference. When true, the account picker
    # hides non-swap-free groups and the overnight fee engine skips
    # this user's leveraged positions (Trading_Mechanism.docx —
    # Islamic accounts).
    is_islamic: bool | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)
