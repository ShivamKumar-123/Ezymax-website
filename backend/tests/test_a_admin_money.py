"""A10 (admin approval), A11 (payout hash), A12 (PAMM lock order), plus the
local-banking one-shot confirm.
"""
import asyncio
import importlib.util
import os
import sys
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql.dml import Insert

from services.gateway.src.services import wallet_service as ws


def _load_admin(name):
    admin_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "admin"))
    if admin_dir not in sys.path:
        sys.path.append(admin_dir)
    path = os.path.join(admin_dir, "services", f"{name}.py")
    spec = importlib.util.spec_from_file_location(f"a_admin_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ds = _load_admin("deposit_service")
ss = _load_admin("social_service")


class _Res:
    def __init__(self, v=None, first=None, items=None):
        self._v = v
        self._first = first
        self._items = items or []

    def scalar_one_or_none(self):
        return self._v

    def scalar(self):
        return self._v

    def first(self):
        return self._first

    def scalars(self):
        return self

    def all(self):
        return self._items


class _DB:
    def __init__(self, results=None):
        self.results = list(results or [])
        self.keys = set()
        self.added = []
        self.commits = 0

    async def execute(self, stmt, *a, **k):
        if isinstance(stmt, Insert):
            key = stmt.compile(dialect=postgresql.dialect()).params.get("idempotency_key")
            if key in self.keys:
                return _Res(None)
            self.keys.add(key)
            return _Res(uuid4())
        return self.results.pop(0) if self.results else _Res(None)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        return None

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        return None


def _dep(**kw):
    base = dict(id=uuid4(), user_id=uuid4(), account_id=None, amount=Decimal("100"),
                method="bank_transfer", status="pending", approved_by=None, approved_at=None,
                rejection_reason=None)
    base.update(kw)
    return SimpleNamespace(**base)


class AdminApproveDepositTests(unittest.TestCase):
    def setUp(self):
        self.saved = []

        async def _noop(*a, **k):
            return []
        for name in ("write_audit_log", "create_notification", "apply_email_brand", "apply_deposit_bonus"):
            self.saved.append((name, getattr(ds, name)))
            setattr(ds, name, _noop)

    def tearDown(self):
        for name, val in self.saved:
            setattr(ds, name, val)

    def test_gateway_pending_refused(self):
        for method in ("razorpay", "oxapay", "wallet_connect"):
            dep = _dep(method=method, status="pending")
            db = _DB([_Res(dep)])
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(ds.approve_deposit(dep.id, uuid4(), None, db))
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertEqual(dep.status, "pending")

    def test_gateway_manual_review_approved_once_with_key(self):
        dep = _dep(method="oxapay", status="manual_review", amount=Decimal("95"))
        user = SimpleNamespace(id=dep.user_id, main_wallet_balance=Decimal("0"), email=None, first_name="x")
        db = _DB([_Res(dep), _Res(user), _Res(None)])  # deposit, user, wallet acc (none)
        asyncio.run(ds.approve_deposit(dep.id, uuid4(), None, db))
        self.assertEqual(dep.status, "approved")
        self.assertEqual(user.main_wallet_balance, Decimal("95"))
        self.assertIn(f"deposit:{dep.id}", db.keys)

    def test_manual_pending_approved(self):
        dep = _dep(method="bank_transfer", status="pending")
        user = SimpleNamespace(id=dep.user_id, main_wallet_balance=Decimal("5"), email=None, first_name="x")
        db = _DB([_Res(dep), _Res(user), _Res(None)])
        asyncio.run(ds.approve_deposit(dep.id, uuid4(), None, db))
        self.assertEqual(user.main_wallet_balance, Decimal("105"))

    def test_cpa_min_deposit_setting(self):
        from packages.common.src import config
        real = config.get_settings
        try:
            config.get_settings = lambda: SimpleNamespace(IB_CPA_MIN_DEPOSIT_USD="50")
            self.assertEqual(ds._cpa_min_deposit(), Decimal("50"))
            config.get_settings = lambda: SimpleNamespace(IB_CPA_MIN_DEPOSIT_USD="garbage")
            self.assertEqual(ds._cpa_min_deposit(), Decimal("0"))
        finally:
            config.get_settings = real

    def test_reject_manual_review_allowed(self):
        dep = _dep(method="oxapay", status="manual_review")
        asyncio.run(ds.reject_deposit(dep.id, "bad", uuid4(), None, _DB([_Res(dep)])))
        self.assertEqual(dep.status, "rejected")


class MarkPaidTests(unittest.TestCase):
    def setUp(self):
        self.saved = []

        async def _noop(*a, **k):
            return None
        for name in ("write_audit_log", "create_notification"):
            self.saved.append((name, getattr(ds, name)))
            setattr(ds, name, _noop)

    def tearDown(self):
        for name, val in self.saved:
            setattr(ds, name, val)

    def test_hash_normalised(self):
        w = SimpleNamespace(id=uuid4(), user_id=uuid4(), status="approved", amount=Decimal("1"),
                            crypto_tx_hash=None, completed_at=None, method="wallet_connect")
        db = _DB([_Res(w), _Res(first=None)])
        asyncio.run(ds.mark_withdrawal_paid(w.id, "  0xABCdef  ", None, uuid4(), None, db))
        self.assertEqual(w.crypto_tx_hash, "0xabcdef")
        self.assertEqual(w.status, "paid")

    def test_hash_reuse_refused(self):
        w = SimpleNamespace(id=uuid4(), user_id=uuid4(), status="approved", amount=Decimal("1"),
                            crypto_tx_hash=None, completed_at=None, method="wallet_connect")
        db = _DB([_Res(w), _Res(first=(uuid4(),))])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ds.mark_withdrawal_paid(w.id, "0xabc", None, uuid4(), None, db))
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(w.status, "approved")


class PammDistributeLockOrderTests(unittest.TestCase):
    def test_users_then_accounts_ascending(self):
        order = []
        u_hi, u_lo = UUID(int=900), UUID(int=100)
        a_hi, a_lo, a_master = UUID(int=80), UUID(int=20), UUID(int=50)
        master = SimpleNamespace(id=uuid4(), account_id=a_master, master_type="pamm", status="approved",
                                 performance_fee_pct=Decimal("20"), admin_commission_pct=Decimal("0"),
                                 user_id=UUID(int=500), total_fee_earned=Decimal("0"))
        allocs = [
            (SimpleNamespace(id=uuid4(), allocation_amount=Decimal("500"), total_profit=Decimal("0"),
                             investor_user_id=u_hi, investor_account_id=a_hi), None),
            (SimpleNamespace(id=uuid4(), allocation_amount=Decimal("500"), total_profit=Decimal("0"),
                             investor_user_id=u_lo, investor_account_id=a_lo), None),
        ]
        accounts = {a: SimpleNamespace(id=a, balance=Decimal("0"), credit=Decimal("0"),
                                       margin_used=Decimal("0")) for a in (a_hi, a_lo, a_master)}

        async def _lu(db, uid):
            order.append(("u", uid))

        async def _la(db, aid):
            order.append(("a", aid))
            return accounts[aid]

        async def _noop(*a, **k):
            return None
        saved = (ss.lock_user, ss.lock_account, ss.write_audit_log, ss.credit_admin_fee)
        ss.lock_user, ss.lock_account, ss.write_audit_log, ss.credit_admin_fee = _lu, _la, _noop, _noop
        try:
            db = _DB([_Res(master), _Res(Decimal("1000")), _Res(items=allocs)])
            asyncio.run(ss.distribute_pamm_profit(master.id, uuid4(), None, db))
        finally:
            ss.lock_user, ss.lock_account, ss.write_audit_log, ss.credit_admin_fee = saved
        users = [x[1] for x in order if x[0] == "u"]
        accts = [x[1] for x in order if x[0] == "a"]
        self.assertEqual(users, sorted(users))
        self.assertEqual(accts, sorted(accts))
        last_user = max(i for i, x in enumerate(order) if x[0] == "u")
        first_acct = min(i for i, x in enumerate(order) if x[0] == "a")
        self.assertLess(last_user, first_acct)
        # 1000 profit, 50/50, 20% fee → 400 net each; master 200
        self.assertEqual(accounts[a_hi].balance, Decimal("400"))
        self.assertEqual(accounts[a_master].balance, Decimal("200"))


class LocalBankingOneShotTests(unittest.TestCase):
    def test_second_confirmation_refused(self):
        dep = SimpleNamespace(id=uuid4(), user_id=uuid4(), method="local_banking", status="pending",
                              payment_link="https://pay", screenshot_url="/x/proof.png",
                              transaction_id="UTR1", amount=Decimal("100"))
        db = _DB([_Res(dep)])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ws.confirm_local_banking_payment(
                deposit_id=dep.id, user_id=dep.user_id, amount=Decimal("5000"),
                transaction_id="UTR2", file=SimpleNamespace(filename="p.png"), db=db,
            ))
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(dep.amount, Decimal("100"))


if __name__ == "__main__":
    unittest.main()
