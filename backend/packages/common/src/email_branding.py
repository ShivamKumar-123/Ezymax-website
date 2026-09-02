"""Per-tenant branding for transactional email.

White-label rule: a tenant's user must never receive email carrying the
platform's (SwissCresta) identity. Rather than threading a brand
parameter through every render_* signature and call site, the brand
rides a contextvar:

    brand = await resolve_email_brand(db, user)
    with email_brand(brand):
        subject, html, text = render_welcome(...)   # shell picks it up

`render_layout` (email_templates/base.py) reads the contextvar — when a
brand is set, the header shows the brand NAME (no platform logo) and the
footer carries the brand name + the tenant's support address (or drops
the support line when they have none). No brand set → the classic
SwissCresta shell, byte-identical to before.

The contextvar is task-local, so concurrent requests can't leak each
other's brand as long as the `with` block wraps the RENDER call (sending
may be fire-and-forgotten afterwards — the HTML is already built).
"""
from __future__ import annotations

import contextlib
import contextvars
from typing import Any, Optional

_current_brand: contextvars.ContextVar[Optional[dict]] = contextvars.ContextVar(
    "email_brand", default=None
)


def current_email_brand() -> Optional[dict]:
    """The active tenant brand for email rendering, or None (platform)."""
    return _current_brand.get()


@contextlib.contextmanager
def email_brand(brand: Optional[dict]):
    """Scope a tenant brand over one or more render_* calls. Passing None
    is a no-op (platform shell), so callers never need to branch."""
    token = _current_brand.set(brand)
    try:
        yield
    finally:
        _current_brand.reset(token)


async def apply_email_brand(db, user) -> None:
    """Set the brand context for the CURRENT task before rendering an
    email — one-line wiring for call sites:

        await apply_email_brand(db, user_row)
        subject, html, text = render_x(...)

    Always sets (None for platform users), so loops that email many
    users in one task can never carry a previous user's brand over.
    Request handlers run one task per request, so nothing leaks across
    requests either."""
    _current_brand.set(await resolve_email_brand(db, user))


async def apply_email_brand_for_signup(db, *, referral_code, host) -> None:
    """Same, for pre-signup emails (no user row yet — attribution from
    the ?ref partner code / custom-domain host)."""
    _current_brand.set(
        await resolve_email_brand_for_signup(db, referral_code=referral_code, host=host)
    )


async def resolve_email_brand(db, user) -> Optional[dict]:
    """Brand dict for a user's owning broker, or None for platform users.

    Fast path: platform-pool users (no broker ancestry) return None with
    zero extra queries — the overwhelmingly common case. Never raises:
    email must go out with the platform shell rather than not at all.
    """
    try:
        from .config import get_settings
        if not get_settings().BRANDING_ENABLED:
            return None
        if user is None:
            return None
        if not getattr(user, "assigned_broker_id", None) and not (
            getattr(user, "broker_ancestry", None) or []
        ):
            return None
        from . import broker_tenancy
        owner = await broker_tenancy.resolve_branding_owner_for_user(db, user)
        if owner is None:
            return None
        profile = await broker_tenancy.get_broker_profile(db, owner.id)
        if profile is None or profile.is_suspended:
            return None
        name = (profile.brand_name or "").strip()
        if not name:
            return None
        return {
            "name": name,
            "support_email": (profile.support_email or "").strip() or None,
        }
    except Exception:
        return None


async def resolve_email_brand_for_signup(
    db, *, referral_code: str | None, host: str | None
) -> Optional[dict]:
    """Brand for a signup that has NO user row yet (register-start OTP):
    attribution comes from the partner code / custom-domain host, exactly
    like pool assignment does. Never raises."""
    try:
        from .config import get_settings
        if not get_settings().BRANDING_ENABLED:
            return None
        from . import broker_tenancy
        owner, _origin = await broker_tenancy.resolve_owner_for_request(
            db, referral_code=referral_code, host=host
        )
        if owner is None:
            return None
        profile = await broker_tenancy.get_broker_profile(db, owner.id)
        if profile is None or profile.is_suspended:
            return None
        name = (profile.brand_name or "").strip()
        if not name:
            return None
        return {
            "name": name,
            "support_email": (profile.support_email or "").strip() or None,
        }
    except Exception:
        return None
