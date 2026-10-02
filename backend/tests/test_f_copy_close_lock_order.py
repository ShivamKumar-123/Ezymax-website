"""Copy-engine mirror close: position row locked and refreshed first; with a
performance fee both USERS are locked (ascending id) before the follower and
master ACCOUNTS (ascending id); an already-closed mirror is never re-booked."""
import asyncio
import json
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

from services.gateway.src.engines import copy_engine
from services.gateway.src.engines.copy_engine import CopyTradeEngine


class _Res:
    def __init__(self, v):
        self.v = v

    def scalar_one_or_none(self):
        return self.v


class _DB:
    def __init__(self, pos, alloc, log):
        self.pos, self.alloc, self.log = pos, alloc, log
        self.added = []

    async def execute(self, stmt, *a, **k):
        self.log.append(("lock_position", stmt.get_execution_options().get("populate_existing")))
        return _Res(self.pos)

    async def get(self, model, pk):
        return self.alloc

    def add(self, obj):
        self.added.append(obj)


class CopyCloseLockOrderTests(unittest.TestCase):
    def setUp(self):
        self._orig = (copy_engine.lock_user, copy_engine.lock_account, copy_engine.price_cache,
                      copy_engine.apply_hwm_fee, copy_engine.credit_admin_fee)
        import packages.common.src.trading_service as ts
        self._ts = (ts.quote_to_account_pnl, ts.cross_rate_for)

        async def no_cross(*a, **k):
            return None

        ts.cross_rate_for = no_cross
        ts.quote_to_account_pnl = lambda pnl, *a, **k: pnl

        class _PC:
            async def get(self, *a):
                return json.dumps({"bid": 1.2, "ask": 1.2})

        copy_engine.price_cache = _PC()

        async def no_admin_fee(*a, **k):
            return None

        copy_engine.credit_admin_fee = no_admin_fee

    def tearDown(self):
        (copy_engine.lock_user, copy_engine.lock_account, copy_engine.price_cache,
         copy_engine.apply_hwm_fee, copy_engine.credit_admin_fee) = self._orig
        import packages.common.src.trading_service as ts
        ts.quote_to_account_pnl, ts.cross_rate_for = self._ts

    def _run(self, fee, status="open"):
        log = []
        u_lo, u_hi = UUID(int=1), UUID(int=2)
        a_lo, a_hi = UUID(int=10), UUID(int=20)
        accounts = {
            a_hi: SimpleNamespace(id=a_hi, balance=Decimal("100"), credit=Decimal("0"),
                                  margin_used=Decimal("100"), leverage=100, user_id=u_hi),
            a_lo: SimpleNamespace(id=a_lo, balance=Decimal("100"), credit=Decimal("0"),
                                  margin_used=Decimal("0"), leverage=100, user_id=u_lo),
        }

        async def fake_lock_user(db, uid):
            log.append(("lock_user", uid))

        async def fake_lock_account(db, aid, **k):
            log.append(("lock_account", aid))
            return accounts.get(aid)

        copy_engine.lock_user = fake_lock_user
        copy_engine.lock_account = fake_lock_account
        copy_engine.apply_hwm_fee = lambda alloc, gross, pct: Decimal(fee)

        pos = SimpleNamespace(
            id=uuid4(), status=status, side="buy", lots=Decimal("1"),
            open_price=Decimal("1"), account_id=a_hi, instrument_id=uuid4(),
            instrument=SimpleNamespace(symbol="EURUSD", contract_size=Decimal("1")),
            swap=Decimal("0"), commission=Decimal("0"), created_at=None,
        )
        alloc = SimpleNamespace(investor_user_id=u_hi, total_profit=Decimal("0"))
        master = SimpleNamespace(
            id=uuid4(), user_id=u_lo, account_id=a_lo, performance_fee_pct=Decimal("20"),
            admin_commission_pct=Decimal("0"), total_fee_earned=Decimal("0"),
        )
        copy = SimpleNamespace(investor_position_id=pos.id, investor_allocation_id=uuid4(),
                               master_position_id=uuid4(), status="open")
        db = _DB(pos, alloc, log)
        ce = CopyTradeEngine()
        asyncio.run(ce._close_copy(copy, master, db))
        return log, copy, db

    def test_fee_close_locks_position_then_users_then_accounts_ascending(self):
        log, copy, _ = self._run(fee="0.02")
        self.assertEqual(log[0], ("lock_position", True))
        self.assertEqual(log[1:], [
            ("lock_user", UUID(int=1)), ("lock_user", UUID(int=2)),
            ("lock_account", UUID(int=10)), ("lock_account", UUID(int=20)),
        ])
        self.assertEqual(copy.status, "closed")

    def test_no_fee_locks_only_follower_account(self):
        log, _, _ = self._run(fee="0")
        self.assertEqual([e for e in log if e[0] != "lock_position"],
                         [("lock_account", UUID(int=20))])

    def test_already_closed_mirror_not_rebooked(self):
        log, copy, db = self._run(fee="0.02", status="closed")
        self.assertEqual(copy.status, "closed")
        self.assertEqual(db.added, [])
        self.assertEqual([e for e in log if e[0] != "lock_position"], [])


if __name__ == "__main__":
    unittest.main()
