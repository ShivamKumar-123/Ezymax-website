from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.database import get_db
from dependencies import get_current_admin, ADMIN_COOKIE_NAME
from packages.common.src.models import User
from packages.common.src.admin_schemas import AdminLoginRequest, AdminLoginResponse, AdminRefreshRequest
from services import auth_service


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


router = APIRouter(prefix="/auth", tags=["Auth"])
_settings = get_settings()


def _request_is_https(request: Request) -> bool:
    if (request.headers.get("x-forwarded-proto") or "").lower().startswith("https"):
        return True
    return request.url.scheme == "https"


def _set_admin_cookie(resp: Response, request: Request, token: str) -> None:
    """Drop the admin JWT into an HttpOnly cookie. SameSite=strict so the
    browser never attaches it to cross-site requests, plus Secure
    (auto-derived from request scheme) so it never crosses plain HTTP.
    Path is /admin-api so it's only sent to the admin gateway prefix —
    the trader-app domain never sees it."""
    secure = _request_is_https(request)
    max_age = int(_settings.ADMIN_JWT_EXPIRY_HOURS) * 3600
    resp.set_cookie(
        key=ADMIN_COOKIE_NAME,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite="strict",
        path="/",
    )


@router.post("/login")
async def admin_login(
    body: AdminLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Issue an admin session as an HttpOnly cookie.

    The legacy `access_token` field is still returned in the JSON for
    backwards compatibility with curl / scripts, but the production
    admin web app should rely solely on the cookie — that's what kills
    the localStorage-XSS exfiltration path (audit C6)."""
    result = await auth_service.admin_login(body=body, db=db)
    _set_admin_cookie(response, request, result.access_token)
    return result


@router.post("/refresh")
async def admin_refresh(
    body: AdminRefreshRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await auth_service.admin_refresh(body=body, db=db)
    _set_admin_cookie(response, request, result.access_token)
    return result


@router.post("/logout")
async def admin_logout(response: Response):
    """Clear the admin cookie. Idempotent — safe to call when not signed in."""
    response.delete_cookie(key=ADMIN_COOKIE_NAME, path="/")
    return {"message": "Signed out"}


@router.post("/change-password")
async def change_admin_password(
    body: ChangePasswordRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.change_admin_password(
        admin=admin,
        current_password=body.current_password,
        new_password=body.new_password,
        db=db,
    )


@router.get("/me")
async def get_admin_me(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.get_admin_me(admin=admin, db=db)
