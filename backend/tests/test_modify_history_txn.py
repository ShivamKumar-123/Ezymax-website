"""H-ADMIN-3: editing a closed trade that changes P&L must write a balance
adjustment Transaction (previously the delta was applied silently).
"""
import asyncio
import importlib.util
import os
import sys
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from packages.common.src.models import Transaction


def _load_trade_service():
    admin_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "admin"))
    if admin_dir not in sys.path:
        sys.path.append(admin_dir)
    path = os.path.join(admin_dir, "services", "trade_service.py")
    spec = importlib.util.spec_from_file_location("admin_trade_service", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ts = _load_trade_service()


class _Res:
    def __init__(self, val):
        self._val = val

    def scalar_one_or_none(self):
        return self._val


class _DB:
    def __init__(self, results):
        self._results = list(results)
        self.added = []

    async def execute(self, *a, **k):
        return _Res(self._results.pop(0) if self._results else None)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        return None

    async def commit(self):
        return None


class ModifyHistoryTxnTests(unittest.TestCase):
    def test_balance_delta_writes_transaction(self):
        acc_id, uid = uuid4(), uuid4()
        th = SimpleNamespace(
            id=uuid4(), account_id=acc_id, instrument_id=uuid4(),
            profit=Decimal("10"), open_price=Decimal("100"), close_price=Decimal("110"),
            lots=Decimal("1"), commission=Decimal("0"), swap=Decimal("0"),
            side="buy", opened_at=None, closed_at=None,
        )
        inst = SimpleNamespace(contract_size=Decimal("1"), base_currency=None,
                               quote_currency=None, symbol="EURUSD")
        acc = SimpleNamespace(id=acc_id, user_id=uid, balance=Decimal("1000"),
                              credit=Decimal("0"), margin_used=Decimal("0"),
                              equity=Decimal("1000"), free_margin=Decimal("1000"))
        # new close_price 120 → profit 20 → delta +10
        body = SimpleNamespace(open_price=None, close_price=Decimal("120"), lots=None,
                               commission=None, swap=None, side=None,
                               opened_at=None, closed_at=None, reason="correction")
        db = _DB([th, inst, acc])
        out = asyncio.run(ts.modify_trade_history(th.id, body, uuid4(), "1.2.3.4", db))

        self.assertEqual(out["balance_delta"], 10.0)
        self.assertEqual(acc.balance, Decimal("1010"))
        txns = [t for t in db.added if isinstance(t, Transaction) and t.type == "adjustment"]
        self.assertEqual(len(txns), 1)
        self.assertEqual(txns[0].amount, Decimal("10"))


if __name__ == "__main__":
    unittest.main()
