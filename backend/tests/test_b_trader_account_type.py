"""Section B2 / B3 — trader-side account-type fixes.

* manual orders are refused on platform-created copy / MAM sub-accounts;
* copy sub-account leverage follows the KYC cap (fallback 50, never 500);
* leverage update on a group-less account caps at 50, not 500;
* investors see aggregates + their own row only; masters see masked emails;
* PAMM trades are visible only with an ACTIVE allocation;
* users can't self-set is_islamic; support attachments https-only, max 5;
* a push token owned by another user is never re-bound;
* the risk engine stops out an account whose equity is gone even when its
  margin_used was zeroed (inactive / margin-less accounts are monitored).
"""
import asyncio
import importlib.util
import os
import sys
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from packages.common.src import trading_guards as tg
from services.gateway.src.services import account_service
from services.gateway.src.services import profile_service
from services.gateway.src.services import social_service as ss
from services.gateway.src.services import support_service
from services.gateway.src.services import trading_service


class _Res:
    def __init__(self, scalar=None, scalarv=None, items=None, first=None, one=None):
        self._scalar = scalar
        self._scalarv = scalarv
        self._items = items or []
        self._first = first
        self._one = one

    def scalar_one_or_none(self):
        return self._scalar

    def scalar(self):
        return self._scalarv

    def first(self):
        return self._first

    def one(self):
        return self._one

    def scalars(self):
        return self

    def all(self):
        return self._items


class _DB:
    def __init__(self, results):
        self._results = list(results)
        self.added = []
        self.commits = 0

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    async def get(self, *a, **k):
        return None

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def refresh(self, *a, **k):
        return None


class ManualOrderOnCopyAccountTests(unittest.TestCase):
    def test_guard_classification(self):
        self.assertTrue(tg.is_platform_copy_subaccount(SimpleNamespace(account_number="CF12345678")))
        self.assertTrue(tg.is_platform_copy_subaccount(SimpleNamespace(account_number="IF12345678")))
        self.assertFalse(tg.is_platform_copy_subaccount(SimpleNamespace(account_number="PT12345678")))
        self.assertFalse(tg.is_platform_copy_subaccount(SimpleNamespace(account_number=None)))

    def test_place_order_refused_on_copy_account(self):
        from packages.common.src import settings_store

        saved = {n: getattr(settings_store, n) for n in ("get_bool_setting", "get_int_setting", "get_float_setting")}
        saved_validate = trading_service.validate_account

        async def _b(_k, d=False):
            return False

        async def _i(_k, d=0):
            return d

        async def _f(_k, d=0.0):
            return d

        async def _validate(*a, **k):
            return SimpleNamespace(id=uuid4(), account_number="CF12345678", is_active=True)

        settings_store.get_bool_setting = _b
        settings_store.get_int_setting = _i
        settings_store.get_float_setting = _f
        trading_service.validate_account = _validate
        db = _DB([])
        try:
            req = SimpleNamespace(account_id=uuid4(), symbol="EURUSD", lots=Decimal("1"), order_type="market")
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(trading_service.place_order(req, None, uuid4(), None, db))
        finally:
            for n, f in saved.items():
                setattr(settings_store, n, f)
            trading_service.validate_account = saved_validate
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(db.commits, 0)


class CopyLeverageTests(unittest.TestCase):
    def test_fallback_is_50(self):
        self.assertEqual(tg.copy_subaccount_leverage(SimpleNamespace(kyc_status="approved")), 50)

    def test_non_kyc_capped_at_50(self):
        grp = SimpleNamespace(max_leverage=500, leverage_default=500)
        self.assertEqual(tg.copy_subaccount_leverage(SimpleNamespace(kyc_status="pending"), grp), 50)

    def test_kyc_gets_group_default(self):
        grp = SimpleNamespace(max_leverage=500, leverage_default=200)
        self.assertEqual(tg.copy_subaccount_leverage(SimpleNamespace(kyc_status="approved"), grp), 200)

    def test_groupless_account_leverage_capped_at_50(self):
        acct = SimpleNamespace(id=uuid4(), account_group=None, leverage=50)
        db = _DB([_Res(scalar=acct)])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(account_service.update_account_leverage(acct.id, uuid4(), 500, db))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(acct.leverage, 50)


class PrivacyTests(unittest.TestCase):
    def test_mask_email(self):
        self.assertEqual(ss._mask_email("john.doe@gmail.com"), "jo***@gmail.com")
        self.assertNotIn("john.doe", ss._mask_email("john.doe@gmail.com"))
        self.assertEqual(ss._display_name("", "", "ab@x.io"), ss._mask_email("ab@x.io"))

    def test_provider_followers_only_aggregates_and_own_row(self):
        me = uuid4()
        master = SimpleNamespace(id=uuid4())
        mine = SimpleNamespace(id=uuid4(), allocation_amount=Decimal("100"),
                               total_profit=Decimal("10"), created_at=None)
        db = _DB([
            _Res(scalar=master),
            _Res(one=(7, Decimal("70"), Decimal("1000"))),   # 7 followers aggregate
            _Res(items=[mine]),                              # caller's own allocation
            _Res(scalarv=3),                                 # copied trades
        ])
        out = asyncio.run(ss.get_provider_followers(master.id, db, user_id=me))
        self.assertEqual(out["total_followers"], 7)
        self.assertEqual(out["avg_profit_pct"], 7.0)
        self.assertEqual(len(out["followers"]), 1)
        self.assertTrue(out["followers"][0]["is_you"])
        self.assertNotIn("user_email", out["followers"][0])

    def test_master_investors_masks_email(self):
        master = SimpleNamespace(id=uuid4(), master_type="pamm")
        alloc = SimpleNamespace(id=uuid4(), allocation_amount=Decimal("100"), total_profit=Decimal("0"),
                                copy_type="pamm", created_at=None)
        inv = SimpleNamespace(id=uuid4(), first_name="", last_name="", email="investor@corp.com")
        db = _DB([_Res(scalar=master), _Res(items=[(alloc, inv, None)])])
        out = asyncio.run(ss.master_investors(uuid4(), db))
        row = out["investors"][0]
        self.assertEqual(row["user_email"], "in***@corp.com")
        self.assertNotIn("investor@", row["user_name"])

    def test_pamm_trades_require_active_allocation(self):
        uid = uuid4()
        alloc = SimpleNamespace(id=uuid4(), copy_type="pamm", status="withdrawn", master_id=uuid4())
        db = _DB([_Res(scalar=alloc)])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ss.pamm_master_trades(alloc.id, uid, db))
        self.assertEqual(ctx.exception.status_code, 403)


class ProfileSupportTests(unittest.TestCase):
    def test_is_islamic_not_self_settable(self):
        user = SimpleNamespace(id=uuid4(), is_islamic=False, first_name="A", last_name="", phone="",
                               country="", address="", city="", state="", postal_code="",
                               date_of_birth=None, email="a@b.c", avatar=None, language="en",
                               welcome_email_sent=True)
        db = _DB([_Res(scalar=user)])
        try:
            asyncio.run(profile_service.update_profile(user.id, {"is_islamic": True, "first_name": "Z"}, db))
        except Exception:
            pass  # response-building details are irrelevant here
        self.assertFalse(user.is_islamic)
        self.assertEqual(user.first_name, "Z")

    def test_attachments_https_only_max_5(self):
        ok = support_service.validate_attachments(["https://cdn.example.com/a.png"])
        self.assertEqual(ok, ["https://cdn.example.com/a.png"])
        for bad in (["http://x.com/a"], ["javascript:alert(1)"], ["data:text/html,x"],
                    [{"url": "ftp://x"}], [123], ["https://"]):
            with self.assertRaises(HTTPException):
                support_service.validate_attachments(bad)
        with self.assertRaises(HTTPException):
            support_service.validate_attachments(["https://x.com/%d" % i for i in range(6)])
        self.assertIsNone(support_service.validate_attachments(None))


class PushTokenTests(unittest.TestCase):
    def test_token_of_other_user_not_rebound(self):
        from services.gateway.src.api import profile as profile_api

        captured = {}

        class _PDB(_DB):
            async def execute(self, stmt, params=None, *a, **k):
                captured["sql"] = str(stmt)
                return _Res(first=None)   # ON CONFLICT ... WHERE owner mismatch → no row

        body = profile_api.PushTokenBody(token="ExponentPushToken[abc]", platform="ios")
        out = asyncio.run(profile_api.register_push_token(body, {"user_id": uuid4()}, _PDB([])))
        self.assertEqual(out, {"ok": True, "bound": False})
        self.assertIn("WHERE user_push_tokens.user_id = EXCLUDED.user_id", captured["sql"])
        self.assertNotIn("SET user_id", captured["sql"])


def _load_risk_engine():
    path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "risk-engine", "src", "main.py"))
    spec = importlib.util.spec_from_file_location("risk_engine_main_b", path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("risk_engine_main_b", mod)
    spec.loader.exec_module(mod)
    return mod


class RiskEngineTests(unittest.TestCase):
    def test_margin_level_without_margin(self):
        re_mod = _load_risk_engine()
        self.assertEqual(re_mod.margin_level_for(Decimal("-5"), Decimal("0")), Decimal("0"))
        self.assertEqual(re_mod.margin_level_for(Decimal("100"), Decimal("0")), Decimal("9999"))
        self.assertEqual(re_mod.margin_level_for(Decimal("50"), Decimal("100")), Decimal("50"))

    def test_stored_margin_level_fits_numeric_10_4(self):
        # NUMERIC(10,4) overflow on one account used to abort the whole pass.
        re_mod = _load_risk_engine()
        huge = re_mod.margin_level_for(Decimal("5000000"), Decimal("0.01"))
        self.assertEqual(re_mod.margin_level_for_storage(huge), Decimal("999999.9999"))
        self.assertEqual(re_mod.margin_level_for_storage(-huge), Decimal("-999999.9999"))
        self.assertEqual(re_mod.margin_level_for_storage(Decimal("123.456789")), Decimal("123.4568"))

    def test_monitor_query_not_filtered_on_is_active(self):
        path = os.path.join(os.path.dirname(__file__), "..", "services", "risk-engine", "src", "main.py")
        src = open(path, encoding="utf-8").read()
        start = src.index("async def _margin_monitor")
        body = src[start:src.index("async def _execute_stop_out")]
        self.assertNotIn("TradingAccount.is_active", body.split("accounts = result.scalars().all()")[0])
        self.assertIn("Position.account_id", body)


if __name__ == "__main__":
    unittest.main()
