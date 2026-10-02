"""Money-ledger primitives (spec A1): idempotent ledger entries + credits,
canonical lock acquisition and a bounded-retry unit of work.

Why
---
A gateway credit (OxaPay / Razorpay / on-chain), a daily fee or any other
"exactly once" money movement used to rely only on a status flag on its source
row. A missed lock, a stale read, a second worker or a replayed webhook could
then move the balance twice. Every such movement now first CLAIMS a
deterministic ledger key:

    INSERT INTO transactions (..., idempotency_key) VALUES (...)
    ON CONFLICT (idempotency_key) DO NOTHING RETURNING id

and only moves the balance when the insert actually happened. The UNIQUE index
on ``transactions.idempotency_key`` (migration 0072) is the authority — a
replay returns no row and the balance is left alone.

Key conventions (keep them stable — changing a format re-opens replays):
    oxapay:{deposit_id}:{cumulative_amount}
    razorpay:{payment_id}
    onchain:{deposit_id}
    deposit:{deposit_id}                  (admin hand-approval)
    withdrawal:{withdrawal_id}            (admin approval debit / marker)
    mgmt_fee:{allocation_id}:{YYYY-MM-DD}
    bonus_release:{user_bonus_id}

Lock order (all money paths): user first, then trading accounts ascending id.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Awaitable, Callable, Iterable

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Transaction
from .row_locks import lock_account, lock_user

logger = logging.getLogger("money_tx")

# Postgres SQLSTATEs worth retrying the whole unit for.
RETRYABLE_SQLSTATES = frozenset({
    "40P01",  # deadlock_detected
    "40001",  # serialization_failure
    "55P03",  # lock_not_available (lock_timeout)
})

DEFAULT_LOCK_TIMEOUT_MS = 5_000
DEFAULT_STATEMENT_TIMEOUT_MS = 30_000
DEFAULT_ATTEMPTS = 3


def _d(v) -> Decimal:
    return Decimal(str(v)) if v is not None else Decimal("0")


async def post_ledger_entry(
    db: AsyncSession,
    *,
    idempotency_key: str,
    user_id,
    type: str,
    amount,
    account_id=None,
    balance_after=None,
    reference_id=None,
    description: str | None = None,
    created_by=None,
) -> uuid.UUID | None:
    """Insert one ledger row keyed by ``idempotency_key``.

    Returns the new row id when this call claimed the key, ``None`` when the
    key already existed (a replay — the caller must NOT move any balance)."""
    if not idempotency_key:
        raise ValueError("post_ledger_entry requires an idempotency_key")
    stmt = (
        pg_insert(Transaction)
        .values(
            id=uuid.uuid4(),
            user_id=user_id,
            account_id=account_id,
            type=type,
            amount=_d(amount),
            balance_after=balance_after,
            reference_id=reference_id,
            description=description,
            created_by=created_by,
            created_at=datetime.utcnow(),
            idempotency_key=idempotency_key[:160],
        )
        .on_conflict_do_nothing(index_elements=["idempotency_key"])
        .returning(Transaction.id)
    )
    res = await db.execute(stmt)
    new_id = res.scalar_one_or_none()
    if new_id is None:
        logger.info("ledger key already claimed — no-op: %s", idempotency_key)
    return new_id


async def credit_main_wallet(
    db: AsyncSession,
    user,
    amount,
    *,
    idempotency_key: str,
    type: str = "deposit",
    reference_id=None,
    description: str | None = None,
    created_by=None,
) -> bool:
    """Credit ``user.main_wallet_balance`` exactly once per key.

    ``user`` MUST be the row locked (``lock_user`` / ``lock_for_money_op``) in
    this transaction. Returns True when the credit was applied, False on a
    replay (balance untouched)."""
    amt = _d(amount)
    new_balance = _d(getattr(user, "main_wallet_balance", None)) + amt
    claimed = await post_ledger_entry(
        db,
        idempotency_key=idempotency_key,
        user_id=user.id,
        account_id=None,
        type=type,
        amount=amt,
        balance_after=new_balance,
        reference_id=reference_id,
        description=description,
        created_by=created_by,
    )
    if claimed is None:
        return False
    user.main_wallet_balance = new_balance
    return True


async def credit_trading_account(
    db: AsyncSession,
    account,
    amount,
    *,
    user_id,
    idempotency_key: str,
    type: str = "deposit",
    reference_id=None,
    description: str | None = None,
    created_by=None,
) -> bool:
    """Trading-account twin of :func:`credit_main_wallet` (balance, equity and
    free margin move together). ``account`` MUST be locked by the caller."""
    amt = _d(amount)
    new_balance = _d(getattr(account, "balance", None)) + amt
    claimed = await post_ledger_entry(
        db,
        idempotency_key=idempotency_key,
        user_id=user_id,
        account_id=account.id,
        type=type,
        amount=amt,
        balance_after=new_balance,
        reference_id=reference_id,
        description=description,
        created_by=created_by,
    )
    if claimed is None:
        return False
    account.balance = new_balance
    account.equity = _d(getattr(account, "equity", None)) + amt
    account.free_margin = _d(getattr(account, "free_margin", None)) + amt
    return True


async def lock_for_money_op(
    db: AsyncSession,
    user_id,
    account_ids: Iterable = (),
    *,
    owned_by_user: bool = True,
):
    """Take every lock a money operation needs, in the canonical order:
    the user row first, then each trading account in ascending id.

    Returns ``(user, {account_id: account})``. Missing accounts are simply
    absent from the dict — the caller decides whether that is a 404. With
    ``owned_by_user`` the account lock also enforces ownership. All locks use
    ``populate_existing`` (A2) via the row_locks helpers."""
    user = await lock_user(db, user_id)
    accounts: dict = {}
    for aid in sorted({a for a in account_ids if a is not None}, key=lambda x: uuid.UUID(str(x))):
        acc = await lock_account(db, aid, user_id=user_id if owned_by_user else None)
        if acc is not None:
            accounts[acc.id] = acc
    return user, accounts


def _sqlstate(exc: BaseException) -> str | None:
    """Dig the SQLSTATE out of a SQLAlchemy-wrapped asyncpg/psycopg error."""
    seen = 0
    cur: BaseException | None = exc
    while cur is not None and seen < 5:
        for attr in ("sqlstate", "pgcode"):
            code = getattr(cur, attr, None)
            if isinstance(code, str) and code:
                return code
        cur = getattr(cur, "orig", None) or cur.__cause__
        seen += 1
    return None


def is_retryable_db_error(exc: BaseException) -> bool:
    return isinstance(exc, DBAPIError) and _sqlstate(exc) in RETRYABLE_SQLSTATES


async def run_money_unit(
    fn: Callable[[AsyncSession], Awaitable[Any]],
    *,
    session_factory=None,
    attempts: int = DEFAULT_ATTEMPTS,
    lock_timeout_ms: int = DEFAULT_LOCK_TIMEOUT_MS,
    statement_timeout_ms: int = DEFAULT_STATEMENT_TIMEOUT_MS,
    base_backoff_s: float = 0.05,
) -> Any:
    """Run ``fn(db)`` as one transaction with lock + statement timeouts,
    retrying (bounded) on deadlock / serialization failure / lock timeout.

    ``fn`` may commit itself; whatever it leaves open is committed here. Any
    other exception is re-raised after a rollback. Because every balance move
    inside goes through a ledger key, a retried unit can't double-apply."""
    if session_factory is None:
        from .database import AsyncSessionLocal as session_factory  # lazy: avoid engine at import
    attempts = max(1, int(attempts))
    last_exc: BaseException | None = None
    for attempt in range(1, attempts + 1):
        async with session_factory() as db:
            try:
                await db.execute(text(f"SET LOCAL lock_timeout = '{int(lock_timeout_ms)}ms'"))
                await db.execute(text(f"SET LOCAL statement_timeout = '{int(statement_timeout_ms)}ms'"))
                result = await fn(db)
                await db.commit()
                return result
            except DBAPIError as exc:
                last_exc = exc
                try:
                    await db.rollback()
                except Exception:  # pragma: no cover - best effort
                    pass
                if attempt < attempts and is_retryable_db_error(exc):
                    logger.warning(
                        "money unit retry %d/%d after %s", attempt, attempts, _sqlstate(exc),
                    )
                    await asyncio.sleep(base_backoff_s * (2 ** (attempt - 1)))
                    continue
                raise
            except BaseException:
                try:
                    await db.rollback()
                except Exception:  # pragma: no cover
                    pass
                raise
    raise last_exc  # pragma: no cover - loop always returns or raises
