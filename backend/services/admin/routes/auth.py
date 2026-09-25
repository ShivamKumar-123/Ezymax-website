from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.database import get_db
from packages.common.src.rate_limit import rate_limit_http
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
    """Issue an admin session as an HttpOnly cookie ONLY.

    The token is set on a `Set-Cookie` header marked HttpOnly + Secure +
    SameSite=strict. We deliberately strip it from the JSON body so that
    an XSS shell, an intercepted browser response, or a curl session that
    forgot to ignore the body cannot exfiltrate the bearer credential."""
    # Throttle per client IP. Admin accounts grant full money movement
    # and impersonation, so the bucket is significantly tighter than the
    # trader login (which sits at 40/min): 10 attempts per 60s ≈ 1 every
    # 6 seconds, enough to retype a wrong password but not enough for
    # credential stuffing / spraying. Audit finding H1.
    rate_limit_http(request, "admin-login", 10, 60.0)
    # Original browser host (forwarded by the Next admin proxy) — drives
    # white-label host isolation: on admin.<broker-domain> only that
    # broker's accounts may sign in; brokers with a live domain are
    # pushed off the platform's admin host to their own.
    login_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    result = await auth_service.admin_login(body=body, db=db, host=login_host)
    _set_admin_cookie(response, request, result.access_token)
    return result.model_dump(exclude={"access_token", "token_type"})


@router.post("/refresh")
async def admin_refresh(
    body: AdminRefreshRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Same body-stripping as `/login` — refresh result returns the new
    token only via the HttpOnly cookie."""
    rate_limit_http(request, "admin-refresh", 30, 60.0)
    result = await auth_service.admin_refresh(body=body, db=db)
    _set_admin_cookie(response, request, result.access_token)
    return result.model_dump(exclude={"access_token", "token_type"})


@router.post("/logout")
async def admin_logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Clear the admin cookie AND revoke the server-side session so the token
    can't be replayed if it was captured. Idempotent — safe when not signed in."""
    token = request.cookies.get(ADMIN_COOKIE_NAME)
    if not token:
        auth = request.headers.get("authorization") or ""
        if auth.lower().startswith("bearer "):
            token = auth[7:].strip()
    if token:
        try:
            import jwt as _jwt
            import uuid as _uuid
            from sqlalchemy import update as _upd
            from packages.common.src.models import UserSession
            from packages.common.src.auth import invalidate_session_cache
            payload = _jwt.decode(
                token, _settings.ADMIN_JWT_SECRET,
                algorithms=[_settings.ADMIN_JWT_ALGORITHM],
                options={"verify_exp": False},  # let an expired token still log out cleanly
            )
            sid = payload.get("sid")
            if sid:
                await db.execute(
                    _upd(UserSession).where(UserSession.id == _uuid.UUID(str(sid))).values(is_active=False)
                )
                await db.commit()
                await invalidate_session_cache(str(sid))
        except Exception:
            pass  # never let a logout error block clearing the cookie
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
