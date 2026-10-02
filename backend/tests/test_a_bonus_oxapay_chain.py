"""A4 (bonus paid twice), A9 (OxaPay), A11 (on-chain min credit), A8 (daily
management fee once per day).
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy.dialects import postgresql
from sqlalchemy.sql.dml import Insert

from services.gateway.src.api import webhooks
from services.gateway.src.engines import chain_verifier_engine as cve
from services.gateway.src.engines import stats_engine as se
from services.gateway.src.services import wallet_service as ws


class _Res:
    def __init__(self, v=None, items=None):
        self._v = v
        self._items = items or []

    def scalar_one_or_none(self):
        return self._v

    def scalar(self):
        return self._v

    def scalars(self):
        return self

    def all(self):
        return self._items


class _LedgerDB:
    def __init__(self, select_results=None):
        self.select_results = list(select_results or [])
        self.inserts = []
        self.keys = set()
        self.commits = 0

    async def execute(self, stmt, *a, **k):
        if isinstance(stmt, Insert):
            params = stmt.compile(dialect=postgresql.dialect()).params
            self.inserts.append(params)
            key = params.get("idempotency_key")
            if key in self.keys:
                return _Res(None)
            self.keys.add(key)
            return _Res(uuid4())
        return self.select_results.pop(0) if self.select_results else _Res(None)

    def add(self, obj):
        pass

    async def flush(self):
        return None

    async def commit(self):
        self.commits += 1


class BonusReleaseTests(unittest.TestCase):
    def test_release_flips_status_without_crediting_again(self):
        uid = uuid4()
        bonus = SimpleNamespace(id=uuid4(), amount=Decimal("50"), lots_required=Decimal("1"),
                                lots_traded=Decimal("0"), status="active", released_at=None)
        db = _LedgerDB([
            _Res(items=[bonus]),          # active bonuses FOR UPDATE
            _Res(Decimal("150")),         # main_wallet_balance (marker row)
        ])
        asyncio.run(ws.release_bonuses_after_trade(
            user_id=uid, traded_lots=Decimal("2"), is_demo_account=False, db=db,
        ))
        self.assertEqual(bonus.status, "released")
        # exactly one marker row, zero amount, keyed per bonus
        self.assertEqual(len(db.inserts), 1)
        self.assertEqual(Decimal(str(db.inserts[0]["amount"])), Decimal("0"))
        self.assertEqual(db.inserts[0]["idempotency_key"], f"bonus_release:{bonus.id}")
        self.assertEqual(db.inserts[0]["type"], "bonus_release")

    def test_partial_wagering_keeps_bonus_active(self):
        bonus = SimpleNamespace(id=uuid4(), amount=Decimal("50"), lots_required=Decimal("5"),
                                lots_traded=Decimal("0"), status="active", released_at=None)
        db = _LedgerDB([_Res(items=[bonus])])
        asyncio.run(ws.release_bonuses_after_trade(
            user_id=uuid4(), traded_lots=Decimal("2"), is_demo_account=False, db=db,
        ))
        self.assertEqual(bonus.status, "active")
        self.assertEqual(bonus.lots_traded, Decimal("2"))
        self.assertEqual(db.inserts, [])


def _oxa_deposit(**kw):
    base = dict(id=uuid4(), status="pending", amount=Decimal("100"), user_id=uuid4(),
                transaction_id=None, rejection_reason=None, approved_at=None, method="oxapay",
                account_id=None)
    base.update(kw)
    return SimpleNamespace(**base)


class OxapayTests(unittest.TestCase):
    def _run(self, deposit, status, payload):
        db = _LedgerDB([_Res(deposit)])
        asyncio.run(ws.handle_oxapay_webhook(
            order_id=str(deposit.id), oxapay_status=status, track_id="T1", payload=payload, db=db,
        ))
        return db

    def test_non_usd_goes_to_manual_review_with_received_amount(self):
        dep = _oxa_deposit()
        self._run(dep, "Paid", {"amount": "95", "currency": "EUR"})
        self.assertEqual(dep.status, "manual_review")
        self.assertEqual(dep.amount, Decimal("95"))
        self.assertIn("non_usd", dep.rejection_reason)

    def test_more_than_3x_goes_to_manual_review(self):
        dep = _oxa_deposit()
        self._run(dep, "paid", {"amount": "301", "currency": "USD"})
        self.assertEqual(dep.status, "manual_review")
        self.assertEqual(dep.amount, Decimal("301"))
        self.assertIn("3x", dep.rejection_reason)

    def test_credited_deposit_never_flipped_back(self):
        dep = _oxa_deposit(status="auto_approved")
        self._run(dep, "expired", {})
        self.assertEqual(dep.status, "auto_approved")

    def test_paid_credits_through_ledger_key(self):
        dep = _oxa_deposit()
        user = SimpleNamespace(id=dep.user_id, main_wallet_balance=Decimal("0"), email=None, first_name="x")
        saved = (ws.lock_user, ws._credit_from_deposit_row, ws.apply_deposit_bonus, ws.create_notification,
                 ws.apply_email_brand)

        async def _lu(db, uid):
            return user

        async def _t(db, d, u):
            return ("main_wallet", u)

        async def _noop(*a, **k):
            return []
        ws.lock_user, ws._credit_from_deposit_row = _lu, _t
        ws.apply_deposit_bonus = ws.create_notification = ws.apply_email_brand = _noop
        try:
            db = self._run(dep, "paid", {"amount": "100", "currency": "USD"})
        finally:
            (ws.lock_user, ws._credit_from_deposit_row, ws.apply_deposit_bonus,
             ws.create_notification, ws.apply_email_brand) = saved
        self.assertEqual(dep.status, "auto_approved")
        self.assertEqual(user.main_wallet_balance, Decimal("100"))
        self.assertIn(f"oxapay:{dep.id}:100", db.keys)

    def test_webhook_dedup_id_includes_payload_hash(self):
        a = webhooks._dedup_external_id("ord-1", b'{"status":"paid","amount":1}')
        b = webhooks._dedup_external_id("ord-1", b'{"status":"paid","amount":2}')
        self.assertNotEqual(a, b)
        self.assertTrue(a.startswith("ord-1:"))
        self.assertEqual(a, webhooks._dedup_external_id("ord-1", b'{"status":"paid","amount":1}'))
        self.assertLessEqual(len(a), 120)


class ChainVerifierMinCreditTests(unittest.TestCase):
    def test_credit_is_min_of_claimed_and_onchain(self):
        # claimed 1000 USDT, chain saw 995 USDT (6 decimals) → credit 995
        self.assertEqual(cve.credit_amount_for(Decimal("1000"), 995_000_000, 6), Decimal("995"))
        # chain saw more than claimed → credit the claim
        self.assertEqual(cve.credit_amount_for(Decimal("1000"), 1_004_000_000, 6), Decimal("1000"))
        # client reported no value → claimed (still inside the tolerance check)
        self.assertEqual(cve.credit_amount_for(Decimal("1000"), None, 6), Decimal("1000"))

    def test_onchain_value_extraction(self):
        self.assertEqual(cve._onchain_value({"ok": True, "amount_received": 5}), 5)
        self.assertEqual(cve._onchain_value({"ok": True, "value": "7"}), 7)
        self.assertIsNone(cve._onchain_value({"ok": True}))


class MgmtFeeOncePerDayTests(unittest.TestCase):
    def test_second_run_same_day_charges_nothing(self):
        macct, inv = uuid4(), uuid4()
        master = SimpleNamespace(id=uuid4(), account_id=macct, management_fee_pct=Decimal("36.5"),
                                 admin_commission_pct=Decimal("0"), user_id=uuid4(),
                                 total_fee_earned=Decimal("0"))
        alloc = SimpleNamespace(id=uuid4(), allocation_amount=Decimal("1000"),
                                investor_account_id=inv, investor_user_id=uuid4())
        inv_acc = SimpleNamespace(id=inv, balance=Decimal("500"), credit=Decimal("0"), margin_used=Decimal("0"))
        m_acc = SimpleNamespace(id=macct, balance=Decimal("0"), credit=Decimal("0"),
                                margin_used=Decimal("0"), account_number="PM1")
        lock_order = []

        async def _lock(db, aid):
            lock_order.append(aid)
            return inv_acc if aid == inv else m_acc
        orig = se.lock_account
        se.lock_account = _lock
        keys = set()
        try:
            for _ in range(2):  # e.g. two uvicorn workers, or a restart
                db = _LedgerDB([_Res(items=[master]), _Res(items=[alloc])])
                db.keys = keys
                asyncio.run(se.StatsEngine()._collect_management_fees(db))
        finally:
            se.lock_account = orig
        self.assertEqual(inv_acc.balance, Decimal("499"))   # charged ONCE
        self.assertEqual(m_acc.balance, Decimal("1"))
        self.assertTrue(any(k.startswith(f"mgmt_fee:{alloc.id}:") for k in keys))
        # accounts locked in ascending id order
        first_two = lock_order[:2]
        self.assertEqual(first_two, sorted(first_two))


if __name__ == "__main__":
    unittest.main()
