"""Single implementation of deposit/welcome bonus application (H-MONEY-2).

Previously three copies of this loop lived in wallet_service (OxaPay + Razorpay
paths) and chain_verifier_engine, and none recorded a UserBonus row — so the
same offer could be granted on every deposit, unbounded. This consolidates them
and enforces **one bonus per offer per user** (app-level check + a DB unique
index, migration 0069). A UserBonus row is written for each grant so the amount
is tracked (for later release / clawback).

DECISION: the bonus is still credited to `main_wallet_balance` and no wagering
release logic is added in this pass. Making the granted amount non-withdrawable
(a main-wallet credit bucket + release-after-lots) is tracked as an open item in
REMEDIATION.md.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import BonusOffer, Transaction, UserBonus


async def outstanding_bonus(db: AsyncSession, user_id) -> Decimal:
    """H-MONEY-2: total un-released bonus credit for a user (status='active').
    Subtracted from the main-wallet withdrawable so bonuses can't be cashed out."""
    total = (await db.execute(
        select(func.coalesce(func.sum(UserBonus.amount), 0)).where(
            UserBonus.user_id == user_id,
            UserBonus.status == "active",
        )
    )).scalar()
    return Decimal(str(total or 0))


async def apply_deposit_bonus(db: AsyncSession, user_row, deposit) -> list[tuple[str, Decimal]]:
    """Apply every eligible, not-yet-granted deposit/welcome bonus for this
    deposit. Mutates user_row.main_wallet_balance, adds Transaction + UserBonus
    rows (caller commits). Returns [(offer_name, amount), ...]."""
    now = datetime.utcnow()
    applied: list[tuple[str, Decimal]] = []

    offers = (await db.execute(
        select(BonusOffer).where(
            BonusOffer.is_active == True,  # noqa: E712
            BonusOffer.bonus_type.in_(["deposit", "welcome"]),
            BonusOffer.min_deposit <= deposit.amount,
        )
    )).scalars().all()

    for offer in offers:
        if offer.starts_at and offer.starts_at > now:
            continue
        if offer.expires_at and offer.expires_at < now:
            continue

        # H-MONEY-2: one grant per (user, offer), ever.
        already = (await db.execute(
            select(UserBonus.id).where(
                UserBonus.user_id == user_row.id,
                UserBonus.offer_id == offer.id,
            ).limit(1)
        )).first()
        if already:
            continue

        if offer.percentage and offer.percentage > 0:
            amount = deposit.amount * offer.percentage / Decimal("100")
        elif offer.fixed_amount and offer.fixed_amount > 0:
            amount = offer.fixed_amount
        else:
            continue
        if offer.max_bonus and amount > offer.max_bonus:
            amount = offer.max_bonus

        user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + amount
        db.add(Transaction(
            user_id=user_row.id,
            account_id=None,
            type="bonus",
            amount=amount,
            balance_after=user_row.main_wallet_balance,
            description=f"Bonus: {offer.name} ({offer.percentage or 0}%)",
        ))
        db.add(UserBonus(
            user_id=user_row.id,
            offer_id=offer.id,
            amount=amount,
            lots_required=offer.lots_required or Decimal("0"),
            status="active",
        ))
        applied.append((offer.name, amount))

    return applied
