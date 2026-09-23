"""Live /ws/prices spread override must resolve the SAME priority chain as
execution: user+instrument > user+blanket > group+instrument > group+blanket.
This is what makes an admin per-tier (account-group) spread edit show up live on
the quote stream (previously only user-scope was loaded).
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from services.gateway.src import main as gw


class _Res:
    def __init__(self, first=None, items=None, scalar=None):
        self._first = first
        self._items = items or []
        self._scalar = scalar

    def first(self):
        return self._first

    def scalars(self):
        return self

    def all(self):
        return self._items

    def scalar_one_or_none(self):
        return self._scalar


class _DB:
    def __init__(self, results):
        self._results = list(results)

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


def _cfg(scope, value, instrument_id=None, account_group_id=None, user_id=None, trading_account_id=None):
    return SimpleNamespace(scope=scope, value=Decimal(str(value)), spread_type="pips",
                           instrument_id=instrument_id, account_group_id=account_group_id,
                           user_id=user_id, trading_account_id=trading_account_id, is_enabled=True)


def _inst(iid, sym):
    return SimpleNamespace(id=iid, symbol=sym, pip_size=Decimal("0.0001"), digits=5, is_active=True)


class SpreadOverridePriorityTests(unittest.TestCase):
    def _run(self, rows, inst):
        uid, gid, acct = uuid4(), uuid4(), uuid4()
        results = [
            _Res(first=(gid, uid)),   # account_group_id + owner check
            _Res(items=rows),         # SpreadConfig rows
            _Res(items=[inst]),       # active instruments
        ]
        orig = gw.AsyncSessionLocal
        gw.AsyncSessionLocal = lambda: _DB(results)
        try:
            return asyncio.run(gw._load_user_spread_overrides(str(uid), str(acct)))
        finally:
            gw.AsyncSessionLocal = orig

    def test_user_blanket_beats_group_instrument(self):
        iid = uuid4()
        rows = [_cfg("user", 2), _cfg("account_group", 5, instrument_id=iid)]
        out = self._run(rows, _inst(iid, "EURUSD"))
        self.assertEqual(out["EURUSD"][0], Decimal("2"))  # user blanket wins

    def test_group_instrument_applies_when_no_user(self):
        iid = uuid4()
        rows = [_cfg("account_group", 5, instrument_id=iid)]
        out = self._run(rows, _inst(iid, "EURUSD"))
        self.assertEqual(out["EURUSD"][0], Decimal("5"))  # tier spread now live

    def test_user_instrument_beats_user_blanket(self):
        iid = uuid4()
        rows = [_cfg("user", 2), _cfg("user", 3, instrument_id=iid)]
        out = self._run(rows, _inst(iid, "EURUSD"))
        self.assertEqual(out["EURUSD"][0], Decimal("3"))

    def test_group_blanket_applies_to_all(self):
        iid = uuid4()
        rows = [_cfg("account_group", 4)]
        out = self._run(rows, _inst(iid, "EURUSD"))
        self.assertEqual(out["EURUSD"][0], Decimal("4"))


if __name__ == "__main__":
    unittest.main()
