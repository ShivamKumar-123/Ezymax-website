"""Row-level locks for balance mutations (C-TRADE-4 / H-TRADE-1).

Several balance-mutating paths read a User / TradingAccount row, checked a
balance, then wrote it back without a row lock — so two concurrent requests
could both read the pre-debit balance, both pass the check, and both write,
double-spending the wallet or overdrawing an account.

These helpers take a `SELECT ... FOR UPDATE` lock so concurrent mutators
serialise on the row. To avoid deadlocks every caller MUST acquire locks in the
same canonical order:

    user first, then trading account(s) in ascending id.

(The transfer paths in wallet_service already follow this order.)

A2 — stale reads defeat row locks: SQLAlchemy's identity map returns the
object that was ALREADY loaded in this session, even when the row came back
from a fresh ``SELECT ... FOR UPDATE``. If the same User/TradingAccount was
read before the lock (an unlocked lookup earlier in the request), the locked
query hands back that stale copy and a concurrent debit's write is invisible —
two withdrawals of 100 against a balance of 100 both pass. Every lock helper
therefore sets ``populate_existing=True`` so the locked row's current column
values overwrite whatever the session had cached. Use :func:`for_update` for
inline locks so they get the same treatment.
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import User, TradingAccount


def for_update(stmt):
    """``SELECT ... FOR UPDATE`` that also refreshes any copy of the row the
    session already holds (A2). Use for every inline money-path lock."""
    return stmt.with_for_update().execution_options(populate_existing=True)


async def lock_user(db: AsyncSession, user_id: UUID) -> User | None:
    """Lock and return the User row (FOR UPDATE). Lock this BEFORE any account."""
    return (
        await db.execute(for_update(select(User).where(User.id == user_id)))
    ).scalar_one_or_none()


async def lock_account(
    db: AsyncSession, account_id: UUID, *, user_id: UUID | None = None
) -> TradingAccount | None:
    """Lock and return a TradingAccount row (FOR UPDATE). Lock AFTER the user.
    Pass user_id to also enforce ownership in the same query."""
    q = select(TradingAccount).where(TradingAccount.id == account_id)
    if user_id is not None:
        q = q.where(TradingAccount.user_id == user_id)
    return (await db.execute(for_update(q))).scalar_one_or_none()
