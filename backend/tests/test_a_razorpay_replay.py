"""A3 (Critical): Razorpay replay mint.

* the generic POST /wallet/deposit refuses gateway methods and never stores a
  client transaction_id on a gateway row;
* verify / webhook find the deposit by the server-written razorpay_order_id,
  never by transaction_id;
* a payment id settles at most one deposit and is never overwritten;
* the credit is keyed razorpay:{payment_id};
* the webhook cross-checks captured amount + currency;
* verify reports status credited|not_credited.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql.dml import Insert

from packages.common.src import settings_store
from services.gateway.src.services import wallet_service as ws


def _sql(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect()))


class _Res:
    def __init__(self, scalar=None, first=None):
        self._scalar = scalar
        self._first = first

    def scalar_one_or_none(self):
        return self._scalar

    def scalar(self):
        return self._scalar

    def first(self):
        return self._first

    def scalars(self):
        return self

    def all(self):
        return []


class _DB:
    def __init__(self, deposit=None, other_payment_owner=None):
        self.deposit = deposit
        self.other_payment_owner = other_payment_owner
        self.keys = set()
        self.selects = []
        self.added = []
        self.commits = 0

    async def execute(self, stmt, *a, **k):
        if isinstance(stmt, Insert):
            key = stmt.compile(dialect=postgresql.dialect()).params.get("idempotency_key")
            if key in self.keys:
                return _Res(None)
            self.keys.add(key)
            return _Res(uuid4())
        sql = _sql(stmt)
        self.selects.append(sql)
        if "deposits.razorpay_payment_id =" in sql and "deposits.id !=" in sql:
            return _Res(first=(self.other_payment_owner,) if self.other_payment_owner else None)
        if "FROM deposits" in sql:
            return _Res(self.deposit)
        return _Res(None)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def refresh(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid4()

    async def flush(self):
        return None


def _deposit(**kw):
    base = dict(
        id=uuid4(), user_id=uuid4(), account_id=None, amount=Decimal("100"), method="razorpay",
        status="pending", transaction_id="order_X", razorpay_order_id="order_X",
        razorpay_payment_id=None, razorpay_amount_paise=830000, approved_at=None,
        rejection_reason=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


class _Patched(unittest.TestCase):
    def setUp(self):
        self._saved = {}
        user = SimpleNamespace(id=uuid4(), main_wallet_balance=Decimal("0"), email=None, first_name="T")
        self.user = user

        async def _lock_user(db, uid):
            return user

        async def _target(db, deposit, user_row):
            return ("main_wallet", user_row)

        async def _noop(*a, **k):
            return []

        for name, val in {
            "lock_user": _lock_user,
            "_credit_from_deposit_row": _target,
            "apply_deposit_bonus": _noop,
            "create_notification": _noop,
            "apply_email_brand": _noop,
        }.items():
            self._saved[name] = getattr(ws, name)
            setattr(ws, name, val)
        self._sig = ws.razorpay_service.verify_checkout_signature
        ws.razorpay_service.verify_checkout_signature = lambda *a: True

    def tearDown(self):
        for name, val in self._saved.items():
            setattr(ws, name, val)
        ws.razorpay_service.verify_checkout_signature = self._sig


class VerifyTests(_Patched):
    def test_lookup_by_razorpay_order_id_not_transaction_id(self):
        dep = _deposit()
        db = _DB(deposit=dep)
        out = asyncio.run(ws.verify_and_credit_razorpay(
            razorpay_order_id="order_X", razorpay_payment_id="pay_1",
            razorpay_signature="sig", user_id=dep.user_id, db=db,
        ))
        lookup = db.selects[0]
        self.assertIn("deposits.razorpay_order_id", lookup)
        self.assertNotIn("deposits.transaction_id =", lookup)
        self.assertIn("FOR UPDATE", lookup)
        self.assertEqual(out["status"], "credited")
        self.assertTrue(out["credited_now"])
        self.assertEqual(self.user.main_wallet_balance, Decimal("100"))
        self.assertEqual(dep.razorpay_payment_id, "pay_1")
        self.assertIn("razorpay:pay_1", db.keys)

    def test_second_settlement_is_noop(self):
        dep = _deposit()
        db = _DB(deposit=dep)
        for _ in range(2):
            out = asyncio.run(ws.verify_and_credit_razorpay(
                razorpay_order_id="order_X", razorpay_payment_id="pay_1",
                razorpay_signature="sig", user_id=dep.user_id, db=db,
            ))
        self.assertEqual(self.user.main_wallet_balance, Decimal("100"))
        self.assertEqual(out["status"], "credited")
        self.assertFalse(out["credited_now"])

    def test_payment_already_bound_to_other_deposit_not_credited(self):
        # The replay: a captured payment re-presented against a second row.
        dep = _deposit()
        db = _DB(deposit=dep, other_payment_owner=uuid4())
        out = asyncio.run(ws.verify_and_credit_razorpay(
            razorpay_order_id="order_X", razorpay_payment_id="pay_1",
            razorpay_signature="sig", user_id=dep.user_id, db=db,
        ))
        self.assertEqual(out["status"], "not_credited")
        self.assertEqual(self.user.main_wallet_balance, Decimal("0"))
        self.assertIsNone(dep.razorpay_payment_id)

    def test_payment_id_never_overwritten(self):
        dep = _deposit(razorpay_payment_id="pay_OLD")
        db = _DB(deposit=dep)
        asyncio.run(ws.verify_and_credit_razorpay(
            razorpay_order_id="order_X", razorpay_payment_id="pay_NEW",
            razorpay_signature="sig", user_id=dep.user_id, db=db,
        ))
        self.assertEqual(dep.razorpay_payment_id, "pay_OLD")
        self.assertEqual(self.user.main_wallet_balance, Decimal("0"))

    def test_unknown_order_404(self):
        db = _DB(deposit=None)
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ws.verify_and_credit_razorpay(
                razorpay_order_id="order_X", razorpay_payment_id="pay_1",
                razorpay_signature="sig", user_id=uuid4(), db=db,
            ))
        self.assertEqual(ctx.exception.status_code, 404)


class WebhookTests(_Patched):
    def test_amount_mismatch_goes_to_manual_review(self):
        dep = _deposit()
        db = _DB(deposit=dep)
        asyncio.run(ws.handle_razorpay_webhook(
            order_id="order_X", payment_id="pay_1", db=db, amount_paise=100, currency="INR",
        ))
        self.assertEqual(dep.status, "manual_review")
        self.assertEqual(self.user.main_wallet_balance, Decimal("0"))

    def test_currency_mismatch_goes_to_manual_review(self):
        dep = _deposit()
        db = _DB(deposit=dep)
        asyncio.run(ws.handle_razorpay_webhook(
            order_id="order_X", payment_id="pay_1", db=db, amount_paise=830000, currency="USD",
        ))
        self.assertEqual(dep.status, "manual_review")

    def test_matching_capture_credits(self):
        dep = _deposit()
        db = _DB(deposit=dep)
        asyncio.run(ws.handle_razorpay_webhook(
            order_id="order_X", payment_id="pay_1", db=db, amount_paise=830000, currency="INR",
        ))
        self.assertEqual(dep.status, "auto_approved")
        self.assertEqual(self.user.main_wallet_balance, Decimal("100"))
        self.assertIn("deposits.razorpay_order_id", db.selects[0])


class GenericDepositTests(unittest.TestCase):
    def setUp(self):
        self._gb = settings_store.get_bool_setting
        self._notif = ws.create_notification

        async def _gb(name, default=None):
            return default
        settings_store.get_bool_setting = _gb

        async def _noop(*a, **k):
            return None
        ws.create_notification = _noop

    def tearDown(self):
        settings_store.get_bool_setting = self._gb
        ws.create_notification = self._notif

    def _req(self, method, tid="order_STOLEN"):
        return SimpleNamespace(
            account_id=None, amount=Decimal("100"), method=method, transaction_id=tid,
            screenshot_url=None, crypto_tx_hash=None, crypto_address=None, crypto_currency=None,
        )

    def test_razorpay_method_refused(self):
        db = _DB()
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ws.create_deposit(self._req("razorpay"), uuid4(), db))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(db.added, [])

    def test_unknown_method_refused(self):
        db = _DB()
        with self.assertRaises(HTTPException):
            asyncio.run(ws.create_deposit(self._req("wallet_connect"), uuid4(), db))
        with self.assertRaises(HTTPException):
            asyncio.run(ws.create_deposit(self._req("free_money"), uuid4(), db))

    def test_gateway_row_never_stores_client_transaction_id(self):
        db = _DB()
        asyncio.run(ws.create_deposit(self._req("oxapay"), uuid4(), db))
        self.assertIsNone(db.added[0].transaction_id)
        self.assertIsNone(db.added[0].razorpay_order_id)

    def test_manual_row_keeps_reference(self):
        db = _DB()
        asyncio.run(ws.create_deposit(self._req("bank", tid="UTR123"), uuid4(), db))
        self.assertEqual(db.added[0].transaction_id, "UTR123")
        self.assertEqual(db.added[0].method, "bank_transfer")


if __name__ == "__main__":
    unittest.main()
