"""Section F8: the copy engine reconciles against the DURABLE CopyTrade table —
a pair that was ever mirrored (in ANY status) is never mirrored again, no
in-memory snapshot is needed, and catch-up pricing is derived from timestamps.
"""
import asyncio
import json
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from packages.common.src.models import Position
from services.gateway.src.engines import copy_engine
from services.gateway.src.engines.copy_engine import CopyTradeEngine, is_catch_up


class _Res:
    def __init__(self, scalar=None, rows=None, items=None):
        self._scalar = scalar
        self._rows = rows or []
        self._items = items or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalar(self):
        return self._scalar

    def all(self):
        return self._rows if self._rows else self._items

    def scalars(self):
        return self


class _DedupeDB:
    """_open_copy: the dedupe query returns an existing CopyTrade id."""

    def __init__(self, existing):
        self.existing = existing
        self.added = []

    async def execute(self, *a, **k):
        return _Res(scalar=self.existing)

    async def flush(self):
        return None

    def add(self, obj):
        self.added.append(obj)
        if not getattr(obj, "id", None):
            try:
                obj.id = uuid4()
            except Exception:
                pass


def _instr():
    return SimpleNamespace(
        symbol="EURUSD", contract_size=Decimal("100000"),
        lot_step=Decimal("0.01"), min_lot=Decimal("0.01"), max_lot=Decimal("100"),
    )


class OpenCopyDedupeTests(unittest.TestCase):
    def setUp(self):
        self._orig_rct = copy_engine.resolve_copy_type
        self._orig_cache = copy_engine.price_cache
        copy_engine.resolve_copy_type = lambda inv, m: "signal"

        class _C:
            async def get(self, *a, **k):
                return json.dumps({"bid": 1.0, "ask": 1.0})
        copy_engine.price_cache = _C()

    def tearDown(self):
        copy_engine.resolve_copy_type = self._orig_rct
        copy_engine.price_cache = self._orig_cache

    def _run(self, existing):
        master_pos = SimpleNamespace(
            id=uuid4(), instrument=_instr(), instrument_id=uuid4(), side="buy",
            lots=Decimal("1"), open_price=Decimal("1"), stop_loss=None, take_profit=None,
        )
        investor = SimpleNamespace(
            id=uuid4(), max_drawdown_pct=None, max_lot_override=None,
            allocation_amount=Decimal("1000"), total_profit=Decimal("0"),
            investor_user_id=uuid4(), investor_account_id=uuid4(),
        )
        acct = SimpleNamespace(
            id=uuid4(), is_active=True, leverage=100, free_margin=Decimal("1e9"),
            equity=Decimal("1000"), margin_used=Decimal("0"), user_id=uuid4(),
            account_number="A1",
        )
        ce = CopyTradeEngine()
        ce.compute_lot_size = lambda *a, **k: (1.0, None)
        db = _DedupeDB(existing)
        asyncio.run(ce._open_copy(
            SimpleNamespace(id=uuid4()), master_pos, investor, acct,
            SimpleNamespace(id=uuid4()), 0.0, db,
        ))
        return [o for o in db.added if isinstance(o, Position)]

    def test_existing_closed_copy_is_never_reopened(self):
        # The dedupe query matches a CopyTrade in ANY status (here: a closed one).
        self.assertEqual(self._run(existing=uuid4()), [])

    def test_no_existing_copy_opens(self):
        self.assertEqual(len(self._run(existing=None)), 1)


class _CycleDB:
    """process_master: scripted results in call order."""

    def __init__(self, results, account):
        self.results = list(results)
        self.account = account

    async def execute(self, *a, **k):
        return self.results.pop(0)

    async def get(self, model, pk):
        return self.account


class ProcessMasterReconcileTests(unittest.TestCase):
    def setUp(self):
        self._orig_rct = copy_engine.resolve_copy_type
        copy_engine.resolve_copy_type = lambda inv, m: "signal"

    def tearDown(self):
        copy_engine.resolve_copy_type = self._orig_rct

    def _run(self, existing=(), considered=()):
        """existing / considered: subsets of {"old", "new"}."""
        now = datetime.now(timezone.utc)
        p_old = SimpleNamespace(id=uuid4(), comment=None, created_at=now - timedelta(hours=1))
        p_new = SimpleNamespace(id=uuid4(), comment=None, created_at=now)
        by = {"old": p_old, "new": p_new}
        alloc = SimpleNamespace(
            id=uuid4(), status="active", investor_account_id=uuid4(),
            created_at=now - timedelta(days=1), copy_type="signal",
        )
        master = SimpleNamespace(id=uuid4(), account_id=uuid4(), master_type="signal_provider")
        account = SimpleNamespace(id=uuid4(), is_active=True)
        results = [
            _Res(items=[p_old, p_new]),                                  # master open positions
            _Res(items=[alloc]),                                         # active allocations
            _Res(scalar=0),                                              # pool sum
            _Res(rows=[(by[k].id, alloc.id) for k in existing]),         # CopyTrade pairs, ANY status
            _Res(items=[]),                                              # orphan copies
        ]
        db = _CycleDB(results, account)
        ce = CopyTradeEngine()
        calls = []

        async def fake_open(master, mp, inv, acct, macct, pool, db, catch_up=False):
            calls.append((mp.id, catch_up))

        async def fake_considered(ids):
            return {(str(by[k].id), str(alloc.id)) for k in considered}

        ce._open_copy = fake_open
        ce._load_considered = fake_considered
        asyncio.run(ce.process_master(master, db))
        return dict(calls), ce._pending_considered, p_old, p_new

    def test_mirrors_only_pairs_without_any_copytrade(self):
        opened, pending, p_old, p_new = self._run()
        self.assertEqual(set(opened), {p_old.id, p_new.id})
        self.assertTrue(opened[p_old.id])    # hour-old master position -> catch-up price
        self.assertFalse(opened[p_new.id])   # brand-new -> real-time mirror at master price
        self.assertEqual(len(pending), 2)    # recorded as considered (post-commit)

    def test_existing_copytrade_in_any_status_blocks_reopen(self):
        opened, _, p_old, p_new = self._run(existing={"old"})
        self.assertEqual(set(opened), {p_new.id})

    def test_previously_skipped_pair_not_retried(self):
        opened, _, p_old, p_new = self._run(considered={"new"})
        self.assertEqual(set(opened), {p_old.id})

    def test_pairs_already_in_db_not_reopened(self):
        now = datetime.now(timezone.utc)
        p = SimpleNamespace(id=uuid4(), comment=None, created_at=now)
        alloc = SimpleNamespace(id=uuid4(), status="active", investor_account_id=uuid4(),
                                created_at=now - timedelta(days=1))
        results = [
            _Res(items=[p]), _Res(items=[alloc]), _Res(scalar=0),
            _Res(rows=[(p.id, alloc.id)]),   # a CLOSED mirror still blocks it
            _Res(items=[]),
        ]
        db = _CycleDB(results, SimpleNamespace(id=uuid4(), is_active=True))
        ce = CopyTradeEngine()
        calls = []

        async def fake_open(*a, **k):
            calls.append(1)

        async def no_considered(ids):
            return set()

        ce._open_copy = fake_open
        ce._load_considered = no_considered
        asyncio.run(ce.process_master(
            SimpleNamespace(id=uuid4(), account_id=uuid4(), master_type="signal_provider"), db,
        ))
        self.assertEqual(calls, [])


class CatchUpRuleTests(unittest.TestCase):
    def test_position_older_than_allocation_is_catch_up(self):
        now = datetime.now(timezone.utc)
        pos = SimpleNamespace(created_at=now - timedelta(seconds=2))
        alloc = SimpleNamespace(created_at=now - timedelta(seconds=1))
        self.assertTrue(is_catch_up(pos, alloc, now))

    def test_fresh_position_after_join_is_realtime(self):
        now = datetime.now(timezone.utc)
        pos = SimpleNamespace(created_at=now - timedelta(seconds=2))
        alloc = SimpleNamespace(created_at=now - timedelta(days=1))
        self.assertFalse(is_catch_up(pos, alloc, now))

    def test_stale_position_is_catch_up(self):
        now = datetime.now(timezone.utc)
        pos = SimpleNamespace(created_at=now - timedelta(minutes=5))
        alloc = SimpleNamespace(created_at=now - timedelta(days=1))
        self.assertTrue(is_catch_up(pos, alloc, now))


if __name__ == "__main__":
    unittest.main()
