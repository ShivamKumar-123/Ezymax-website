"""White-label tenancy core — scoping, isolation, and brand resolution.

Faithful port of the stock4x broker logic (dependencies.scoped_admin_filter,
assert_user_in_scope, branding_service.user_belongs_to_owner /
pool_assignment_for_owner / find_admin_by_domain) onto SwissCresta's
SQLAlchemy stack, with the P&L-share economics removed (rental model).

Shared by the gateway (signup pool assignment, login isolation, public
brand lookup) and the admin service (broker CRUD, pool-scoped queries).

Vocabulary:
  * "broker"  — a users row with role='broker' + a broker_profiles row.
    The white-label tenant. Brokers can mint sub-brokers (nested).
  * "pool"    — the set of users a broker owns: everyone whose
    broker_ancestry contains the broker's id (sub-brokers included).
  * "platform pool" — users with assigned_broker_id IS NULL; owned by
    SwissCresta itself.
"""
import re
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .models import User, BrokerProfile
from .models.broker import (
    BROKER_SECTIONS,
    DOMAIN_STATUS_READY,
    PERMISSION_EDIT,
    PERMISSION_OFF,
    PERMISSION_VIEW,
    permission_at_least,
)

SIGNUP_ORIGIN_PLATFORM = "platform"
SIGNUP_ORIGIN_BROKER_REFERRAL = "broker_referral"
SIGNUP_ORIGIN_CUSTOM_DOMAIN = "custom_domain"


# ── Host / domain normalisation ──────────────────────────────────────────

_DOMAIN_RE = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$")
_SUBDOMAIN_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


def normalise_domain(raw: str | None) -> str:
    """Lowercase apex domain: strips scheme, path, port, and a leading
    www. Raises ValueError when the result isn't a plausible domain."""
    d = (raw or "").strip().lower()
    d = re.sub(r"^[a-z]+://", "", d)
    d = d.split("/", 1)[0].split(":", 1)[0].strip(".")
    if d.startswith("www."):
        d = d[4:]
    if not d or not _DOMAIN_RE.match(d):
        raise ValueError("Enter a valid domain like example.com (no http://, no path)")
    return d


def normalise_subdomain(raw: str | None) -> str:
    """Single-label subdomain (e.g. 'trade'). Empty string = apex mode."""
    s = (raw or "").strip().lower().strip(".")
    if not s:
        return ""
    if not _SUBDOMAIN_RE.match(s) or s in ("www", "admin"):
        raise ValueError(
            "Subdomain must be a single label like 'trade' — 'www' and 'admin' are reserved"
        )
    return s


def platform_hosts() -> set[str]:
    s = get_settings()
    return {h.strip().lower() for h in s.PLATFORM_HOSTS.split(",") if h.strip()}


def is_platform_domain(domain: str) -> bool:
    """A broker must not claim a platform host OR any subdomain of one — e.g.
    api.swisscresta.com / admin.swisscresta.com would hijack the platform's own
    API / admin routing. Blocks exact matches and any `*.that-host` subdomain."""
    d = (domain or "").strip().lower().strip(".")
    for h in platform_hosts():
        if d == h or d.endswith("." + h):
            return True
    return False


def is_platform_host(host: str | None) -> bool:
    if not host:
        return True
    h = host.strip().lower().split(":", 1)[0]
    return h in platform_hosts()


def host_from_request_headers(origin: str | None, referer: str | None) -> str | None:
    """Hostname the browser request came from. Prefers Origin (reliable on
    POST), falls back to Referer. Used to attribute signups/logins on a
    tenant's custom domain to that tenant's pool."""
    for src in (origin, referer):
        if not src:
            continue
        m = re.match(r"^[a-z]+://([^/:]+)", src.strip().lower())
        if m:
            return m.group(1)
    return None


def admin_hostname(domain: str) -> str:
    """The tenant's admin-panel hostname. Convention-based: every
    connected domain also serves the (scoped) admin panel on
    admin.<domain>, so brokers log in on THEIR domain, never on
    admin.swisscresta.com."""
    return f"admin.{domain}"


def served_hostnames(domain: str, app_subdomain: str | None) -> list[str]:
    """Hostnames the platform serves for a tenant's trader app.
    Apex mode → [domain, www.domain]; subdomain mode → [sub.domain]."""
    sub = (app_subdomain or "").strip().lower()
    if sub:
        return [f"{sub}.{domain}"]
    return [domain, f"www.{domain}"]


# ── Permission caps (tri-state off < view < edit) ────────────────────────

def full_permission_cap() -> dict[str, str]:
    return {k: PERMISSION_EDIT for k in BROKER_SECTIONS}


def max_grantable_permissions(actor: User, actor_profile: BrokerProfile | None) -> dict[str, str]:
    """The ceiling an actor may grant when creating/updating a broker.
    Super-admin (and full admins) → everything EDIT. A broker minting a
    sub-broker can never grant beyond its own levels."""
    if actor.role in ("super_admin", "admin"):
        return full_permission_cap()
    if actor.role == "broker" and actor_profile is not None:
        perms = actor_profile.permissions or {}
        return {k: perms.get(k, PERMISSION_OFF) for k in BROKER_SECTIONS}
    return {k: PERMISSION_OFF for k in BROKER_SECTIONS}


def validate_permissions_against_cap(requested: dict, cap: dict[str, str]) -> dict[str, str]:
    """Sanitises + validates a requested permissions dict. Unknown sections
    and unknown levels are rejected; any level above the actor's cap raises.
    Returns the cleaned dict (only known sections, only non-off entries kept
    explicit — absent means off)."""
    cleaned: dict[str, str] = {}
    for key, raw in (requested or {}).items():
        if key not in BROKER_SECTIONS:
            raise ValueError(f"Unknown permission section '{key}'")
        level = str(raw or PERMISSION_OFF).lower()
        if level not in (PERMISSION_OFF, PERMISSION_VIEW, PERMISSION_EDIT):
            raise ValueError(f"Invalid level '{raw}' for '{key}' (off|view|edit)")
        if not permission_at_least(cap.get(key, PERMISSION_OFF), level):
            raise ValueError(
                f"Permission '{key}' = {level} exceeds your own level of {cap.get(key, PERMISSION_OFF)}"
            )
        if level != PERMISSION_OFF:
            cleaned[key] = level
    return cleaned


def clip_permissions_to_cap(current: dict, cap: dict[str, str]) -> tuple[dict[str, str], list[str]]:
    """Clips a broker's stored permissions to a (new, lower) cap. Returns
    (clipped_dict, list_of_clipped_keys). Used to cascade a parent
    downgrade to its sub-brokers so a child never outranks its parent."""
    clipped: dict[str, str] = {}
    changed: list[str] = []
    for key, level in (current or {}).items():
        ceiling = cap.get(key, PERMISSION_OFF)
        if permission_at_least(ceiling, level):
            clipped[key] = level
        else:
            changed.append(key)
            if ceiling != PERMISSION_OFF:
                clipped[key] = ceiling
    return clipped, changed


def broker_permission_level(profile: BrokerProfile | None, section: str) -> str:
    if profile is None:
        return PERMISSION_OFF
    return (profile.permissions or {}).get(section, PERMISSION_OFF)


# ── Creator chain / pool stamping ────────────────────────────────────────

def resolve_creator_chain(creator: User) -> tuple[Optional[uuid.UUID], list[uuid.UUID]]:
    """(assigned_broker_id, broker_ancestry) for a NEW broker minted by
    `creator`. Platform admins mint top-level brokers; a broker mints a
    sub-broker nested under itself."""
    if creator.role in ("super_admin", "admin"):
        return None, []
    if creator.role == "broker":
        return creator.id, list(creator.broker_ancestry or []) + [creator.id]
    raise ValueError("Only platform admins and brokers can create brokers")


def pool_assignment_for_owner(owner: User | None) -> dict:
    """Column values that place a NEW self-registered user under the broker
    who owns the referral code / custom domain they signed up through.
    Empty dict = platform pool."""
    if owner is None or owner.role != "broker":
        return {}
    return {
        "assigned_broker_id": owner.id,
        "broker_ancestry": list(owner.broker_ancestry or []) + [owner.id],
    }


# ── Scoping (the tenant-isolation core) ──────────────────────────────────

def broker_pool_condition(broker_id: uuid.UUID):
    """SQLAlchemy condition matching every user in a broker's subtree
    (sub-brokers and all their clients) via the GIN-indexed ancestry
    array: users.broker_ancestry @> ARRAY[broker_id]."""
    return User.broker_ancestry.contains([broker_id])


async def scoped_client_ids(db: AsyncSession, broker: User) -> list[uuid.UUID]:
    """All CLIENT user ids in the broker's pool (admin-tier rows excluded
    so brokers never appear in their own ledgers/lists)."""
    result = await db.execute(
        select(User.id).where(
            broker_pool_condition(broker.id),
            User.role.notin_(["admin", "super_admin", "broker"]),
        )
    )
    return [row[0] for row in result.all()]


async def assert_user_in_broker_scope(
    db: AsyncSession, actor: User, target_user_id: uuid.UUID
) -> User | None:
    """Raises PermissionError when a broker actor targets a user outside
    their pool. Platform admins pass through untouched (their scope is
    everything — SwissCresta's existing behaviour, deliberately kept;
    returns None without the extra lookup). Broker actors can never touch
    admin-tier rows through this path."""
    if actor.role != "broker":
        return None
    target = (
        await db.execute(select(User).where(User.id == target_user_id))
    ).scalar_one_or_none()
    if target is None:
        raise LookupError("User not found")
    if target.role in ("admin", "super_admin", "broker"):
        raise PermissionError("Cannot operate on an admin/broker account")
    if actor.id not in (target.broker_ancestry or []):
        raise PermissionError("User is not in your scope")
    return target


def user_belongs_to_owner(user: User, owner: User | None) -> bool:
    """Tenant-isolation gate for LOGIN: may `user` sign in on the login
    page owned by `owner` (the broker whose custom domain the request
    arrived on)?

      * owner is None → platform / un-attributable host. Fail OPEN:
        platform users and tenants whose domain isn't live yet must
        never be locked out.
      * owner IS the user → the broker signing into their own app.
      * otherwise → allow iff that broker is in the user's ownership
        chain — isolates one broker's users from a sibling's login page.
    """
    if owner is None or owner.role != "broker":
        return True
    if owner.id == user.id:
        return True
    return (
        user.assigned_broker_id == owner.id
        or owner.id in (user.broker_ancestry or [])
    )


# ── Active tenant hosts cache (origin allow-listing) ─────────────────────
# The gateway's same-origin guard must also accept requests arriving from
# live tenant domains. Cached in-process for 60s so every login doesn't
# pay a DB round-trip; a just-provisioned domain becomes loginable within
# a minute (same trade-off stock4x's all_active_custom_domains makes).

_tenant_hosts_cache: set[str] = set()
_tenant_hosts_cache_at: float = 0.0
_TENANT_HOSTS_TTL = 60.0


async def active_tenant_hosts(db: AsyncSession) -> set[str]:
    """Every hostname a READY, non-suspended tenant domain serves."""
    import time
    global _tenant_hosts_cache, _tenant_hosts_cache_at
    now = time.monotonic()
    if now - _tenant_hosts_cache_at < _TENANT_HOSTS_TTL:
        return _tenant_hosts_cache
    rows = (
        await db.execute(
            select(BrokerProfile.custom_domain, BrokerProfile.app_subdomain).where(
                BrokerProfile.custom_domain.isnot(None),
                BrokerProfile.custom_domain_status == DOMAIN_STATUS_READY,
                BrokerProfile.is_suspended.is_(False),
            )
        )
    ).all()
    hosts: set[str] = set()
    for domain, sub in rows:
        hosts.update(served_hostnames(domain, sub))
    _tenant_hosts_cache = hosts
    _tenant_hosts_cache_at = now
    return hosts


def invalidate_tenant_hosts_cache() -> None:
    global _tenant_hosts_cache_at
    _tenant_hosts_cache_at = 0.0


# ── Brand / owner lookups ────────────────────────────────────────────────

async def get_broker_profile(db: AsyncSession, user_id: uuid.UUID) -> BrokerProfile | None:
    return (
        await db.execute(select(BrokerProfile).where(BrokerProfile.user_id == user_id))
    ).scalar_one_or_none()


async def find_broker_by_partner_code(db: AsyncSession, code: str) -> User | None:
    """Owner lookup for ?ref=<partner_code> signup links. Suspended
    tenants don't collect new users."""
    code = (code or "").strip()
    if not code:
        return None
    profile = (
        await db.execute(
            select(BrokerProfile).where(
                BrokerProfile.partner_code == code,
                BrokerProfile.is_suspended.is_(False),
            )
        )
    ).scalar_one_or_none()
    if profile is None:
        return None
    owner = (
        await db.execute(
            select(User).where(User.id == profile.user_id, User.role == "broker")
        )
    ).scalar_one_or_none()
    if owner is None or owner.status != "active":
        return None
    return owner


async def find_broker_by_domain(db: AsyncSession, host: str | None) -> User | None:
    """Owner lookup by hostname. Only READY, non-suspended domains resolve
    — half-configured tenants stay invisible so visitors fall through to
    the platform brand. Handles apex, www.apex and <sub>.apex forms."""
    if not host or is_platform_host(host):
        return None
    h = host.strip().lower().split(":", 1)[0]
    apex = h[4:] if h.startswith("www.") else h
    candidates = {h, apex}
    # <sub>.<apex> form: strip the first label too.
    if "." in apex:
        candidates.add(apex.split(".", 1)[1])
    profile = (
        await db.execute(
            select(BrokerProfile).where(
                BrokerProfile.custom_domain.in_(list(candidates)),
                BrokerProfile.custom_domain_status == DOMAIN_STATUS_READY,
                BrokerProfile.is_suspended.is_(False),
            )
        )
    ).scalar_one_or_none()
    if profile is None:
        return None
    # Hosts this tenant owns: the trader hosts (apex+www, or the chosen
    # subdomain) AND their admin panel on admin.<domain> — the admin
    # login page brands itself via this same lookup.
    expected = set(served_hostnames(profile.custom_domain, profile.app_subdomain))
    expected.add(admin_hostname(profile.custom_domain))
    if h not in expected and apex not in expected:
        return None
    owner = (
        await db.execute(
            select(User).where(User.id == profile.user_id, User.role == "broker")
        )
    ).scalar_one_or_none()
    if owner is None or owner.status != "active":
        return None
    return owner


async def resolve_owner_for_request(
    db: AsyncSession, *, referral_code: str | None, host: str | None
) -> tuple[User | None, str]:
    """Signup attribution, in stock4x's priority order:
        1. explicit ?ref=<partner_code>
        2. custom domain the request arrived on
        3. platform pool
    Returns (owner_or_none, signup_origin)."""
    if not get_settings().BRANDING_ENABLED:
        return None, SIGNUP_ORIGIN_PLATFORM
    if referral_code:
        owner = await find_broker_by_partner_code(db, referral_code)
        if owner is not None:
            return owner, SIGNUP_ORIGIN_BROKER_REFERRAL
    owner = await find_broker_by_domain(db, host)
    if owner is not None:
        return owner, SIGNUP_ORIGIN_CUSTOM_DOMAIN
    return None, SIGNUP_ORIGIN_PLATFORM


async def resolve_branding_owner_for_user(db: AsyncSession, user: User) -> User | None:
    """The brand a logged-in user should see: immediate broker first, then
    the top of the broker chain. None → platform brand."""
    candidates: list[uuid.UUID] = []
    if user.assigned_broker_id:
        candidates.append(user.assigned_broker_id)
    if user.broker_ancestry:
        top = user.broker_ancestry[0]
        if top not in candidates:
            candidates.append(top)
    for cid in candidates:
        owner = (
            await db.execute(
                select(User).where(User.id == cid, User.role == "broker")
            )
        ).scalar_one_or_none()
        if owner is None:
            continue
        profile = await get_broker_profile(db, owner.id)
        if profile is not None and not profile.is_suspended and (
            profile.brand_name or profile.logo_url or profile.custom_domain
        ):
            return owner
    return None


def branding_payload(profile: BrokerProfile | None) -> dict:
    """Public brand payload (safe for unauthenticated /by-domain lookups).
    Empty-ish payload = platform defaults."""
    if profile is None:
        return {
            "is_white_label": False,
            "brand_name": None,
            "logo_url": None,
            "support_email": None,
            "support_whatsapp": None,
            "partner_code": None,
        }
    return {
        "is_white_label": True,
        "brand_name": profile.brand_name,
        "logo_url": profile.logo_url,
        "support_email": profile.support_email,
        "support_whatsapp": profile.support_whatsapp,
        "partner_code": profile.partner_code,
    }
