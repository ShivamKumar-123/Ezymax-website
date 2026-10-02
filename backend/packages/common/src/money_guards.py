"""Shared guards for money-moving paths.

Two rules every main-wallet / trading-account debit must follow:

* Bonus laundering — deposit bonuses are credited into ``main_wallet_balance``
  but are NOT the user's money until released. Any debit out of the main
  wallet (withdrawal, transfer, copy-trade start, PAMM/MAM invest, opening a
  live account, migrate-to-wallet-account) may only spend
  ``spendable_main_wallet`` = balance − outstanding bonus.

* Managed pools — the trading account behind a PAMM / MAM master holds
  INVESTOR capital. The master must never be able to withdraw it, transfer it
  out, migrate it or delete the account. ``assert_not_managed_pool`` is the
  single check for that.
"""
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .bonus_service import outstanding_bonus
from .models import InvestorAllocation, MasterAccount

# Master types whose trading account is a pooled fund of investor capital.
MANAGED_POOL_MASTER_TYPES = ("pamm", "mamm")


async def spendable_main_wallet(db: AsyncSession, user) -> Decimal:
    """Main-wallet amount the user may actually spend: balance minus any
    outstanding (un-released) bonus. Never negative. Pass a User row that was
    loaded/locked in the same transaction as the debit."""
    balance = Decimal(str(getattr(user, "main_wallet_balance", None) or 0))
    bonus = Decimal(str(await outstanding_bonus(db, user.id) or 0))
    spendable = balance - bonus
    return spendable if spendable > 0 else Decimal("0")


async def is_managed_pool(db: AsyncSession, account_id) -> bool:
    """True if this trading account is the pool behind a PAMM/MAM master."""
    if not account_id:
        return False
    try:
        acct_uuid = account_id if isinstance(account_id, UUID) else UUID(str(account_id))
    except (ValueError, TypeError):
        return False
    row = await db.execute(
        select(MasterAccount.id).where(
            MasterAccount.account_id == acct_uuid,
            MasterAccount.master_type.in_(MANAGED_POOL_MASTER_TYPES),
        ).limit(1)
    )
    return row.first() is not None


async def assert_not_managed_pool(db: AsyncSession, account_id) -> None:
    """Refuse any transfer-out / withdrawal / migrate / delete on a managed pool."""
    if await is_managed_pool(db, account_id):
        raise HTTPException(
            status_code=409,
            detail="This is a managed (PAMM/MAM) pool account holding investor capital; "
                   "funds can't be moved out of it and it can't be closed.",
        )


async def assert_not_active_copy_subaccount(db: AsyncSession, account) -> None:
    """Refuse a transfer-out / withdrawal from a platform-created copy / MAM
    follower sub-account (CF…/IF…) while its allocation is still active —
    its balance is managed by the strategy; the user must Stop Copy, which
    refunds the real available cash exactly once."""
    from .trading_guards import is_platform_copy_subaccount  # B-owned helper
    if account is None or not is_platform_copy_subaccount(account):
        return
    row = await db.execute(
        select(InvestorAllocation.id).where(
            InvestorAllocation.investor_account_id == account.id,
            InvestorAllocation.status == "active",
        ).limit(1)
    )
    if row.first() is not None:
        raise HTTPException(
            status_code=409,
            detail="This is a copy-trading account with an active allocation. "
                   "Use Stop Copy to release its funds.",
        )


async def assert_transfer_out_allowed(db: AsyncSession, account) -> None:
    """Every transfer-out / withdrawal source check in one place (B1, B2):
    the account must be active, must not be a managed pool, and must not be
    an actively-allocated copy sub-account."""
    if account is None or not getattr(account, "is_active", False):
        raise HTTPException(status_code=409, detail="Source account is not active")
    await assert_not_managed_pool(db, account.id)
    await assert_not_active_copy_subaccount(db, account)
