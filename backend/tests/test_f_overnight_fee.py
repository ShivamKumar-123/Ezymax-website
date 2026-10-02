"""Section F8: overnight fee — account locked BEFORE positions, positions
locked SKIP LOCKED, last_swap_at re-checked on the locked row, so a second run
(or an overlapping process) can never double-charge."""
import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy.dialects import postgresql

from services.gateway.src.engines import overnight_fee_engine as ofe


class _Res:
    def __init__(self, items=None, scalar=None):
        self._items = items or []
        self._scalar = scalar

    def scalars(self):
        return self

    def all(self):
        return self._items

    def scalar_one_or_none(self):
        return self._scalar


class _DB:
    def __init__(self, positions, log):
        self.positions = positions
        self.log = log
        self.added = []

    async def execute(self, stmt, *a, **k):
        sql = str(stmt.compile(dialect=postgresql.dialect()))
        if "FROM positions" in sql:
            self.log.append(("lock_positions", "FOR UPDATE" in sql and "SKIP LOCKED" in sql))
            return _Res(items=self.positions)
        return _Res(scalar=False)  # User.is_islamic

    def add(self, obj):
        self.added.append(obj)


def _setup(last_swap_at, created_hours_ago=48):
    now = datetime.now(timezone.utc)
    account = SimpleNamespace(
        id=uuid4(), user_id=uuid4(), leverage=100, balance=Decimal("1000"),
        credit=Decimal("0"), margin_used=Decimal("0"), account_group=None,
        account_group_id=None,
    )
    pos = SimpleNamespace(
        id=uuid4(), account_id=account.id, status="open", side="buy",
        lots=Decimal("1"), open_price=Decimal("1"), swap=Decimal("0"),
        last_swap_at=last_swap_at, created_at=now - timedelta(hours=created_hours_ago),
        instrument=SimpleNamespace(contract_size=Decimal("100000")),
    )
    return now, account, pos


class OvernightFeeTests(unittest.TestCase):
    def setUp(self):
        self._orig_lock = ofe.lock_account
        self._orig_rate = ofe.resolve_swap_rate

        async def rate(*a, **k):
            return Decimal("0.0001"), False

        ofe.resolve_swap_rate = rate

    def tearDown(self):
        ofe.lock_account = self._orig_lock
        ofe.resolve_swap_rate = self._orig_rate

    def _run(self, now, account, pos):
        log = []

        async def fake_lock(db, account_id, **k):
            log.append(("lock_account", account_id))
            return account

        ofe.lock_account = fake_lock
        db = _DB([pos], log)
        n = asyncio.run(ofe._charge_batch(db, [(pos.id, account.id)], now))
        return n, db, log

    def test_charges_once_and_locks_account_first(self):
        now, account, pos = _setup(last_swap_at=None)
        n, db, log = self._run(now, account, pos)
        self.assertEqual(n, 1)
        self.assertEqual(log[0][0], "lock_account")          # account before positions
        self.assertEqual(log[1], ("lock_positions", True))     # FOR UPDATE SKIP LOCKED
        fee = Decimal("100000") * Decimal("0.99") * Decimal("0.0001")
        self.assertEqual(account.balance, Decimal("1000") - fee.quantize(Decimal("0.00000001")))
        self.assertEqual(len(db.added), 1)
        # Second run (e.g. another worker / next tick): last_swap_at was set → no charge.
        n2, db2, _ = self._run(now, account, pos)
        self.assertEqual(n2, 0)
        self.assertEqual(db2.added, [])

    def test_recheck_on_locked_row_skips_freshly_charged(self):
        # Candidate list was built before a concurrent run stamped last_swap_at.
        now, account, pos = _setup(last_swap_at=datetime.now(timezone.utc) - timedelta(hours=1))
        n, db, _ = self._run(now, account, pos)
        self.assertEqual(n, 0)
        self.assertEqual(account.balance, Decimal("1000"))

    def test_position_under_24h_not_charged(self):
        now, account, pos = _setup(last_swap_at=None, created_hours_ago=2)
        n, _, _ = self._run(now, account, pos)
        self.assertEqual(n, 0)

    def test_closed_position_skipped(self):
        now, account, pos = _setup(last_swap_at=None)
        pos.status = "closed"
        n, _, _ = self._run(now, account, pos)
        self.assertEqual(n, 0)


if __name__ == "__main__":
    unittest.main()
