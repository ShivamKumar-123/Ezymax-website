"""White-label broker (tenant) management — port of stock4x's
broker_management_service onto SwissCresta, rental model.

Brokers are users rows with role='broker' plus a broker_profiles row.
The super-admin (or a full admin) mints top-level brokers; a broker with
sub_brokers=edit can mint sub-brokers nested under itself, never with
permissions above its own (cap validation + downgrade cascade)."""
import secrets
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import hash_password
from packages.common.src.models import User, BrokerProfile
from packages.common.src import broker_tenancy
from packages.common.src.broker_tenancy import (
    broker_pool_condition,
    clip_permissions_to_cap,
    max_grantable_permissions,
    resolve_creator_chain,
    validate_permissions_against_cap,
)
from dependencies import write_audit_log


def _gen_partner_code() -> str:
    """Short, unambiguous referral handle, e.g. WL-7K2M9QX3."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "WL-" + "".join(secrets.choice(alphabet) for _ in range(8))


async def _unique_partner_code(db: AsyncSession) -> str:
    for _ in range(20):
        code = _gen_partner_code()
        exists = (
            await db.execute(
                select(BrokerProfile.user_id).where(BrokerProfile.partner_code == code)
            )
        ).scalar_one_or_none()
        if exists is None:
            return code
    raise HTTPException(status_code=500, detail="Could not allocate partner code")


async def get_broker_or_404(db: AsyncSession, broker_id: uuid.UUID) -> tuple[User, BrokerProfile]:
    user = (
        await db.execute(
            select(User).where(User.id == broker_id, User.role == "broker")
        )
    ).scalar_one_or_none()
    profile = await broker_tenancy.get_broker_profile(db, broker_id)
    if user is None or profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broker not found")
    return user, profile


async def _assert_actor_may_touch(db: AsyncSession, actor: User, broker: User) -> None:
    """The platform super-admin manages every broker; a broker manages only
    brokers inside its own subtree (its sub-brokers)."""
    if actor.role == "super_admin":
        return
    if actor.role == "broker" and actor.id in (broker.broker_ancestry or []):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Broker not in your scope")


async def _actor_cap(db: AsyncSession, actor: User) -> dict[str, str]:
    actor_profile = None
    if actor.role == "broker":
        actor_profile = await broker_tenancy.get_broker_profile(db, actor.id)
    return max_grantable_permissions(actor, actor_profile)


def _serialize(user: User, profile: BrokerProfile, *, user_count: int | None = None) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "status": user.status,
        "partner_code": profile.partner_code,
        "permissions": profile.permissions or {},
        "brand_name": profile.brand_name,
        "logo_url": profile.logo_url,
        "support_email": profile.support_email,
        "support_whatsapp": profile.support_whatsapp,
        "custom_domain": profile.custom_domain,
        "app_subdomain": profile.app_subdomain,
        "custom_domain_status": profile.custom_domain_status,
        "rental_plan": profile.rental_plan,
        "rental_amount": str(profile.rental_amount or 0),
        "rental_currency": profile.rental_currency,
        "rental_period": profile.rental_period,
        "rental_next_due": profile.rental_next_due.isoformat() if profile.rental_next_due else None,
        "rental_notes": profile.rental_notes,
        "is_suspended": profile.is_suspended,
        "suspended_reason": profile.suspended_reason,
        "is_sub_broker": bool(user.assigned_broker_id),
        "parent_broker_id": str(user.assigned_broker_id) if user.assigned_broker_id else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "user_count": user_count,
    }


async def create_broker(
    db: AsyncSession,
    actor: User,
    *,
    email: str,
    password: str,
    first_name: str,
    last_name: str | None,
    permissions: dict,
    brand_name: str | None,
    rental_plan: str | None,
    rental_amount,
    rental_currency: str | None,
    rental_period: str | None,
    rental_next_due=None,
    rental_notes: str | None = None,
    ip_address: str | None = None,
) -> dict:
    email_norm = (email or "").strip().lower()
    if not email_norm or "@" not in email_norm:
        raise HTTPException(status_code=422, detail="Valid email required")
    if len(password or "") < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    dupe = (
        await db.execute(select(User.id).where(func.lower(User.email) == email_norm))
    ).scalar_one_or_none()
    if dupe is not None:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    cap = await _actor_cap(db, actor)
    try:
        cleaned_perms = validate_permissions_against_cap(permissions or {}, cap)
        assigned_broker_id, ancestry = resolve_creator_chain(actor)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    user = User(
        email=email_norm,
        email_verified=True,
        password_hash=hash_password(password),
        first_name=(first_name or "").strip() or brand_name or "Broker",
        last_name=(last_name or "").strip() or None,
        role="broker",
        status="active",
        kyc_status="approved",
        assigned_broker_id=assigned_broker_id,
        broker_ancestry=ancestry,
    )
    db.add(user)
    await db.flush()

    profile = BrokerProfile(
        user_id=user.id,
        partner_code=await _unique_partner_code(db),
        permissions=cleaned_perms,
        brand_name=(brand_name or "").strip() or None,
        rental_plan=(rental_plan or "").strip() or None,
        rental_amount=rental_amount or 0,
        rental_currency=(rental_currency or "USD").upper(),
        rental_period=rental_period or "monthly",
        rental_next_due=rental_next_due,
        rental_notes=rental_notes,
        created_by=actor.id,
    )
    db.add(profile)

    await write_audit_log(
        db, actor.id, "broker.create", "User", user.id,
        new_values={
            "email": email_norm,
            "permissions": cleaned_perms,
            "brand_name": profile.brand_name,
            "rental_plan": profile.rental_plan,
            "rental_amount": profile.rental_amount,
            "is_sub_broker": bool(assigned_broker_id),
        },
        ip_address=ip_address,
    )
    await db.commit()
    return _serialize(user, profile, user_count=0)


async def update_broker(
    db: AsyncSession, actor: User, broker_id: uuid.UUID, fields: dict,
    ip_address: str | None = None,
) -> dict:
    """Edit the broker's account fields (email / names) + brand name.
    Permissions, rental, domain and password have their own endpoints;
    this covers the identity fields that previously had no edit path."""
    user, profile = await get_broker_or_404(db, broker_id)
    await _assert_actor_may_touch(db, actor, user)

    old = {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "brand_name": profile.brand_name,
    }

    if "email" in fields and fields["email"]:
        email_norm = str(fields["email"]).strip().lower()
        if "@" not in email_norm:
            raise HTTPException(status_code=422, detail="Valid email required")
        dupe = (
            await db.execute(
                select(User.id).where(
                    func.lower(User.email) == email_norm, User.id != user.id
                )
            )
        ).scalar_one_or_none()
        if dupe is not None:
            raise HTTPException(status_code=409, detail="Email already in use by another account")
        user.email = email_norm
    if "first_name" in fields:
        user.first_name = (fields["first_name"] or "").strip() or user.first_name
    if "last_name" in fields:
        user.last_name = (fields["last_name"] or "").strip() or None
    if "brand_name" in fields:
        profile.brand_name = (fields["brand_name"] or "").strip() or None
        profile.updated_at = datetime.utcnow()

    await write_audit_log(
        db, actor.id, "broker.update", "User", user.id,
        old_values=old,
        new_values={k: str(v) for k, v in fields.items()},
        ip_address=ip_address,
    )
    await db.commit()
    return _serialize(user, profile)


async def list_brokers(
    db: AsyncSession, actor: User, *, page: int, per_page: int, search: str | None
) -> dict:
    query = select(User).where(User.role == "broker")
    if actor.role == "broker":
        # A broker sees only its own subtree of sub-brokers.
        query = query.where(broker_pool_condition(actor.id))
    if search:
        like = f"%{search.strip()}%"
        query = query.where(
            or_(
                User.email.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
            )
        )
    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar_one()
    rows = (
        (
            await db.execute(
                query.order_by(User.created_at.desc())
                .offset((page - 1) * per_page)
                .limit(per_page)
            )
        )
        .scalars()
        .all()
    )
    items = []
    for u in rows:
        profile = await broker_tenancy.get_broker_profile(db, u.id)
        if profile is None:
            continue
        count = (
            await db.execute(
                select(func.count()).select_from(User).where(
                    broker_pool_condition(u.id),
                    User.role.notin_(["admin", "super_admin", "broker"]),
                )
            )
        ).scalar_one()
        items.append(_serialize(u, profile, user_count=count))
    return {"items": items, "total": total, "page": page, "per_page": per_page}


async def get_broker_detail(db: AsyncSession, actor: User, broker_id: uuid.UUID) -> dict:
    user, profile = await get_broker_or_404(db, broker_id)
    await _assert_actor_may_touch(db, actor, user)
    count = (
        await db.execute(
            select(func.count()).select_from(User).where(
                broker_pool_condition(user.id),
                User.role.notin_(["admin", "super_admin", "broker"]),
            )
        )
    ).scalar_one()
    return _serialize(user, profile, user_count=count)


async def update_broker_permissions(
    db: AsyncSession, actor: User, broker_id: uuid.UUID, permissions: dict,
    ip_address: str | None = None,
) -> dict:
    user, profile = await get_broker_or_404(db, broker_id)
    await _assert_actor_may_touch(db, actor, user)
    cap = await _actor_cap(db, actor)
    try:
        cleaned = validate_permissions_against_cap(permissions or {}, cap)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    old = profile.permissions or {}
    profile.permissions = cleaned
    profile.updated_at = datetime.utcnow()

    # Cascade DOWN: no sub-broker may keep a level above its (possibly
    # downgraded) parent. Same clip stock4x cascades on parent downgrade.
    descendants = (
        (
            await db.execute(
                select(User).where(User.role == "broker", broker_pool_condition(user.id))
            )
        )
        .scalars()
        .all()
    )
    for child in descendants:
        child_profile = await broker_tenancy.get_broker_profile(db, child.id)
        if child_profile is None:
            continue
        clipped, changed = clip_permissions_to_cap(child_profile.permissions or {}, cleaned)
        if changed:
            child_profile.permissions = clipped
            child_profile.updated_at = datetime.utcnow()

    await write_audit_log(
        db, actor.id, "broker.permissions_update", "User", user.id,
        old_values={"permissions": old}, new_values={"permissions": cleaned},
        ip_address=ip_address,
    )
    await db.commit()
    return _serialize(user, profile)


async def update_rental(
    db: AsyncSession, actor: User, broker_id: uuid.UUID, body: dict,
    ip_address: str | None = None,
) -> dict:
    """Rental terms are the platform owner's business — never editable by
    the tenant itself or a parent broker."""
    if actor.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin required")
    user, profile = await get_broker_or_404(db, broker_id)
    old = {
        "rental_plan": profile.rental_plan,
        "rental_amount": profile.rental_amount,
        "rental_period": profile.rental_period,
        "rental_next_due": str(profile.rental_next_due),
    }
    for field in ("rental_plan", "rental_currency", "rental_period", "rental_notes"):
        if field in body:
            setattr(profile, field, body[field])
    if "rental_amount" in body:
        profile.rental_amount = body["rental_amount"] or 0
    if "rental_next_due" in body:
        profile.rental_next_due = body["rental_next_due"]
    profile.updated_at = datetime.utcnow()
    await write_audit_log(
        db, actor.id, "broker.rental_update", "User", user.id,
        old_values=old, new_values={k: str(v) for k, v in body.items()},
        ip_address=ip_address,
    )
    await db.commit()
    return _serialize(user, profile)


async def set_suspended(
    db: AsyncSession, actor: User, broker_id: uuid.UUID, suspended: bool,
    reason: str | None = None, ip_address: str | None = None,
) -> dict:
    if actor.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin required")
    user, profile = await get_broker_or_404(db, broker_id)
    profile.is_suspended = suspended
    profile.suspended_reason = (reason or "").strip() or None if suspended else None
    profile.updated_at = datetime.utcnow()
    await write_audit_log(
        db, actor.id, "broker.suspend" if suspended else "broker.unsuspend",
        "User", user.id, new_values={"reason": reason},
        ip_address=ip_address,
    )
    await db.commit()
    return _serialize(user, profile)


async def reset_password(
    db: AsyncSession, actor: User, broker_id: uuid.UUID, new_password: str,
    ip_address: str | None = None,
) -> dict:
    user, profile = await get_broker_or_404(db, broker_id)
    await _assert_actor_may_touch(db, actor, user)
    if len(new_password or "") < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    user.password_hash = hash_password(new_password)
    await write_audit_log(
        db, actor.id, "broker.password_reset", "User", user.id, ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Password reset"}


async def assign_user(
    db: AsyncSession, actor: User, broker_id: uuid.UUID, target_user_id: uuid.UUID,
    ip_address: str | None = None,
) -> dict:
    """Moves an existing client into a broker's pool. Platform admins can
    move anyone; a broker can only move users already inside its own
    subtree deeper (to one of its sub-brokers)."""
    broker, _profile = await get_broker_or_404(db, broker_id)
    if actor.role == "broker":
        await _assert_actor_may_touch(db, actor, broker)
    target = (
        await db.execute(select(User).where(User.id == target_user_id))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role in ("admin", "super_admin", "broker"):
        raise HTTPException(status_code=422, detail="Target must be a trading user")
    if actor.role == "broker" and actor.id not in (target.broker_ancestry or []):
        raise HTTPException(status_code=403, detail="User not in your scope")

    old_broker = str(target.assigned_broker_id) if target.assigned_broker_id else None
    target.assigned_broker_id = broker.id
    target.broker_ancestry = list(broker.broker_ancestry or []) + [broker.id]
    await write_audit_log(
        db, actor.id, "broker.assign_user", "User", target.id,
        old_values={"assigned_broker_id": old_broker},
        new_values={"assigned_broker_id": str(broker.id)},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "User assigned", "user_id": str(target.id), "broker_id": str(broker.id)}
