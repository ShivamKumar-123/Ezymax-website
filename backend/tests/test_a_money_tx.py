"""A1/A2: money_tx — idempotent ledger entries, credit-only-on-claim, canonical
lock order and the bounded-retry unit of work.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import DBAPIError

from packages.common.src import money_tx


class _Res:
    def __init__(self, value):
        self._v = value

    def scalar_one_or_none(self):
        return self._v


class _LedgerDB:
    """Simulates the UNIQUE(idempotency_key) + ON CONFLICT DO NOTHING."""

    def __init__(self):
        self.keys = set()
        self.statements = []

    async def execute(self, stmt, *a, **k):
        self.statements.append(stmt)
        params = stmt.compile(dialect=postgresql.dialect()).params
        key = params.get("idempotency_key")
        if key in self.keys:
            return _Res(None)
        self.keys.add(key)
        return _Res(uuid4())


class LedgerEntryTests(unittest.TestCase):
    def test_statement_is_insert_on_conflict_do_nothing_returning(self):
        db = _LedgerDB()
        asyncio.run(money_tx.post_ledger_entry(
            db, idempotency_key="razorpay:pay_1", user_id=uuid4(), type="deposit", amount=Decimal("5"),
        ))
        sql = str(db.statements[0].compile(dialect=postgresql.dialect())).upper()
        self.assertIn("INSERT INTO TRANSACTIONS", sql)
        self.assertIn("ON CONFLICT (IDEMPOTENCY_KEY) DO NOTHING", sql)
        self.assertIn("RETURNING", sql)

    def test_key_required(self):
        with self.assertRaises(ValueError):
            asyncio.run(money_tx.post_ledger_entry(
                _LedgerDB(), idempotency_key="", user_id=uuid4(), type="deposit", amount=1,
            ))

    def test_credit_main_wallet_only_once_per_key(self):
        db = _LedgerDB()
        user = SimpleNamespace(id=uuid4(), main_wallet_balance=Decimal("10"))
        first = asyncio.run(money_tx.credit_main_wallet(
            db, user, Decimal("100"), idempotency_key="oxapay:d1:100"))
        replay = asyncio.run(money_tx.credit_main_wallet(
            db, user, Decimal("100"), idempotency_key="oxapay:d1:100"))
        self.assertTrue(first)
        self.assertFalse(replay)
        self.assertEqual(user.main_wallet_balance, Decimal("110"))  # credited once

    def test_credit_trading_account_moves_balance_equity_free_margin_once(self):
        db = _LedgerDB()
        acc = SimpleNamespace(id=uuid4(), balance=Decimal("1"), equity=Decimal("1"), free_margin=Decimal("1"))
        for _ in range(3):
            asyncio.run(money_tx.credit_trading_account(
                db, acc, Decimal("4"), user_id=uuid4(), idempotency_key="onchain:d9"))
        self.assertEqual((acc.balance, acc.equity, acc.free_margin),
                         (Decimal("5"), Decimal("5"), Decimal("5")))


class LockOrderTests(unittest.TestCase):
    def test_user_first_then_accounts_ascending(self):
        calls = []
        orig_u, orig_a = money_tx.lock_user, money_tx.lock_account

        async def _lu(db, uid):
            calls.append(("user", uid))
            return SimpleNamespace(id=uid)

        async def _la(db, aid, *, user_id=None):
            calls.append(("account", aid))
            return SimpleNamespace(id=aid)
        money_tx.lock_user, money_tx.lock_account = _lu, _la
        try:
            uid = uuid4()
            ids = [UUID(int=9), UUID(int=3), UUID(int=7), UUID(int=3)]
            user, accs = asyncio.run(money_tx.lock_for_money_op(object(), uid, ids))
        finally:
            money_tx.lock_user, money_tx.lock_account = orig_u, orig_a
        self.assertEqual(calls[0], ("user", uid))
        self.assertEqual([c[1] for c in calls[1:]], [UUID(int=3), UUID(int=7), UUID(int=9)])
        self.assertEqual(len(accs), 3)


class _PgErr(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.sqlstate = code


class _Session:
    def __init__(self, log):
        self.log = log

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def execute(self, stmt, *a, **k):
        self.log.append(str(stmt))

    async def commit(self):
        self.log.append("COMMIT")

    async def rollback(self):
        self.log.append("ROLLBACK")


class RunMoneyUnitTests(unittest.TestCase):
    def test_retries_deadlock_then_succeeds_with_timeouts_set(self):
        log, attempts = [], []

        async def fn(db):
            attempts.append(1)
            if len(attempts) == 1:
                raise DBAPIError("stmt", {}, _PgErr("40P01"))
            return "done"

        out = asyncio.run(money_tx.run_money_unit(
            fn, session_factory=lambda: _Session(log), base_backoff_s=0))
        self.assertEqual(out, "done")
        self.assertEqual(len(attempts), 2)
        self.assertTrue(any("lock_timeout" in x for x in log))
        self.assertTrue(any("statement_timeout" in x for x in log))
        self.assertIn("ROLLBACK", log)
        self.assertEqual(log[-1], "COMMIT")

    def test_non_retryable_error_raises_immediately(self):
        attempts = []

        async def fn(db):
            attempts.append(1)
            raise DBAPIError("stmt", {}, _PgErr("23505"))

        with self.assertRaises(DBAPIError):
            asyncio.run(money_tx.run_money_unit(
                fn, session_factory=lambda: _Session([]), base_backoff_s=0))
        self.assertEqual(len(attempts), 1)

    def test_retry_is_bounded(self):
        attempts = []

        async def fn(db):
            attempts.append(1)
            raise DBAPIError("stmt", {}, _PgErr("55P03"))

        with self.assertRaises(DBAPIError):
            asyncio.run(money_tx.run_money_unit(
                fn, session_factory=lambda: _Session([]), attempts=3, base_backoff_s=0))
        self.assertEqual(len(attempts), 3)


if __name__ == "__main__":
    unittest.main()
