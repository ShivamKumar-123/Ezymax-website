"""Broker branding + custom-domain lifecycle (admin side).

Port of stock4x's admin branding endpoints:

  * get/update own branding (brand name, logo upload, support contacts)
  * set custom domain            → status pending_dns
  * verify DNS                   → dns_verified → provisioning (kicks the
                                   nginx/certbot provisioner in background)
  * disconnect domain            → clears state + best-effort cert teardown

Each broker mutates ONLY its own profile. The platform super-admin can
also edit any broker's branding through the same service functions by
passing that broker's profile.

DNS verification uses the system resolver (socket.getaddrinfo) rather
than adding a dnspython dependency — we only need "does this hostname
resolve to our origin IP yet".
"""
import asyncio
import logging
import socket
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.models import User, BrokerProfile
from packages.common.src import broker_tenancy
from packages.common.src.models.broker import (
    DOMAIN_STATUS_DNS_VERIFIED,
    DOMAIN_STATUS_PENDING_DNS,
)
from packages.common.src.file_validation import validate_upload

logger = logging.getLogger("branding-admin")
settings = get_settings()

_LOGO_ALLOWED = {".png", ".jpg", ".jpeg", ".webp"}
_LOGO_MAX_BYTES = 2 * 1024 * 1024  # logos should be tiny
LOGO_MEDIA_PREFIX = "/api/v1/branding/logo"


def _logo_dir() -> Path:
    import os
    env = os.environ.get("BRANDING_UPLOAD_DIR", "").strip()
    p = Path(env) if env else Path(__file__).resolve().parents[3] / "uploads" / "branding"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _require_enabled() -> None:
    if not settings.BRANDING_ENABLED:
        raise HTTPException(status_code=503, detail="White-label branding is disabled on this deployment")


async def get_own_profile(db: AsyncSession, admin: User) -> BrokerProfile:
    if admin.role != "broker":
        raise HTTPException(status_code=403, detail="Only broker accounts have branding")
    profile = await broker_tenancy.get_broker_profile(db, admin.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Broker profile not found")
    return profile


def branding_state(profile: BrokerProfile) -> dict:
    served = (
        broker_tenancy.served_hostnames(profile.custom_domain, profile.app_subdomain)
        if profile.custom_domain else []
    )
    # The tenant's own admin-panel host (admin.<domain>) — provisioned
    # alongside the trader hosts so brokers never log in on the
    # platform's admin domain.
    admin_host = (
        broker_tenancy.admin_hostname(profile.custom_domain)
        if profile.custom_domain else None
    )
    return {
        "partner_code": profile.partner_code,
        "brand_name": profile.brand_name,
        "logo_url": profile.logo_url,
        "support_email": profile.support_email,
        "support_whatsapp": profile.support_whatsapp,
        "custom_domain": profile.custom_domain,
        "app_subdomain": profile.app_subdomain,
        "custom_domain_status": profile.custom_domain_status,
        "custom_domain_last_error": profile.custom_domain_last_error,
        "custom_domain_provisioned_at": (
            profile.custom_domain_provisioned_at.isoformat()
            if profile.custom_domain_provisioned_at else None
        ),
        "served_hostnames": served,
        "admin_hostname": admin_host,
        "dns_hostnames": served + ([admin_host] if admin_host else []),
        "platform_public_ip": settings.PLATFORM_PUBLIC_IP or None,
        "referral_link": f"{settings.TRADER_APP_URL}/auth/register?ref={profile.partner_code}",
    }


async def update_branding(
    db: AsyncSession,
    profile: BrokerProfile,
    *,
    brand_name: str | None = None,
    support_email: str | None = None,
    support_whatsapp: str | None = None,
    logo: UploadFile | None = None,
) -> dict:
    _require_enabled()
    if brand_name is not None:
        profile.brand_name = brand_name.strip()[:100] or None
    if support_email is not None:
        profile.support_email = support_email.strip()[:255] or None
    if support_whatsapp is not None:
        profile.support_whatsapp = support_whatsapp.strip()[:32] or None

    if logo is not None:
        content = await logo.read()
        if len(content) > _LOGO_MAX_BYTES:
            raise HTTPException(status_code=400, detail="Logo too large (max 2MB)")
        ext = "." + (logo.filename or "").rsplit(".", 1)[-1].lower() if "." in (logo.filename or "") else ""
        try:
            canonical = validate_upload(
                content, ext, allowed_extensions=_LOGO_ALLOWED, label="logo"
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        out_name = f"{profile.user_id.hex}-{uuid.uuid4().hex[:8]}{canonical}"
        (_logo_dir() / out_name).write_bytes(content)
        profile.logo_url = f"{LOGO_MEDIA_PREFIX}/{out_name}"

    profile.updated_at = datetime.utcnow()
    await db.commit()
    return branding_state(profile)


# ── Custom domain lifecycle ──────────────────────────────────────────────

async def set_custom_domain(
    db: AsyncSession, profile: BrokerProfile, domain_raw: str, app_subdomain_raw: str | None
) -> dict:
    _require_enabled()
    try:
        domain = broker_tenancy.normalise_domain(domain_raw)
        app_subdomain = broker_tenancy.normalise_subdomain(app_subdomain_raw)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if broker_tenancy.is_platform_domain(domain):
        raise HTTPException(status_code=422, detail="That domain belongs to the platform")

    # Partial unique index enforces this too, but a friendly 409 beats an
    # IntegrityError.
    from sqlalchemy import select
    taken = (
        await db.execute(
            select(BrokerProfile.user_id).where(
                BrokerProfile.custom_domain == domain,
                BrokerProfile.user_id != profile.user_id,
            )
        )
    ).scalar_one_or_none()
    if taken is not None:
        raise HTTPException(status_code=409, detail="Domain is already connected to another broker")

    profile.custom_domain = domain
    profile.app_subdomain = app_subdomain or None
    profile.custom_domain_status = DOMAIN_STATUS_PENDING_DNS
    profile.custom_domain_last_error = None
    profile.custom_domain_provisioned_at = None
    profile.updated_at = datetime.utcnow()
    await db.commit()
    return branding_state(profile)


async def _resolve_a_records(host: str) -> set[str]:
    def _lookup() -> set[str]:
        try:
            infos = socket.getaddrinfo(host, None, family=socket.AF_INET, type=socket.SOCK_STREAM)
            return {i[4][0] for i in infos}
        except socket.gaierror:
            return set()
    return await asyncio.get_running_loop().run_in_executor(None, _lookup)


async def verify_custom_domain(db: AsyncSession, profile: BrokerProfile) -> dict:
    """Checks that every served hostname resolves to PLATFORM_PUBLIC_IP.
    On success flips to dns_verified and launches the SSL provisioner in
    the background (the wizard polls /branding/me for status)."""
    _require_enabled()
    if not profile.custom_domain:
        raise HTTPException(status_code=422, detail="No custom domain set")
    if not settings.PLATFORM_PUBLIC_IP:
        raise HTTPException(
            status_code=503,
            detail="PLATFORM_PUBLIC_IP is not configured on the server",
        )

    hosts = broker_tenancy.served_hostnames(profile.custom_domain, profile.app_subdomain)
    # The admin panel rides admin.<domain> — its A record is required too,
    # so a broker can never end up with a live site but a dead back office.
    hosts = hosts + [broker_tenancy.admin_hostname(profile.custom_domain)]
    misses: list[str] = []
    for h in hosts:
        ips = await _resolve_a_records(h)
        if settings.PLATFORM_PUBLIC_IP not in ips:
            misses.append(f"{h} → {', '.join(sorted(ips)) or 'no A record'}")

    if misses:
        profile.custom_domain_status = DOMAIN_STATUS_PENDING_DNS
        profile.custom_domain_last_error = (
            "DNS not pointing at the platform yet: " + "; ".join(misses)
        )
        await db.commit()
        return branding_state(profile)

    profile.custom_domain_status = DOMAIN_STATUS_DNS_VERIFIED
    profile.custom_domain_last_error = None
    await db.commit()

    # Kick provisioning without blocking the request. The provisioner
    # re-reads + updates the profile row through its own session.
    from services.branding_provisioner import schedule_provision
    schedule_provision(profile.user_id)
    return branding_state(profile)


async def disconnect_custom_domain(db: AsyncSession, profile: BrokerProfile) -> dict:
    _require_enabled()
    old_domain = profile.custom_domain
    old_sub = profile.app_subdomain
    profile.custom_domain = None
    profile.app_subdomain = None
    profile.custom_domain_status = None
    profile.custom_domain_last_error = None
    profile.custom_domain_provisioned_at = None
    profile.updated_at = datetime.utcnow()
    await db.commit()

    if old_domain:
        from services.branding_provisioner import schedule_teardown
        schedule_teardown(old_domain, old_sub)
    return branding_state(profile)
