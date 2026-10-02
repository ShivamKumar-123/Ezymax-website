"""A2/A5/A11/B1/B2/D3 on withdrawal + transfer-out paths.

* withdrawals lock user → source first (no unlocked pre-read) and spend only
  balance − outstanding bonus;
* the on-chain withdraw debits the REAL balance (it used to wipe the bonus);
* inactive / managed-pool / actively-copied sources are refused;
* the withdrawal step-up is consumed only when the flag is on.
"""
import asyncio
import sys
import types
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from packages.common.src import money_guards, settings_store
from services.gateway.src.services import account_service
from services.gateway.src.services import onchain_withdraw_service as ows
from services.gateway.src.services import wallet_service as ws


class _Res:
    def __init__(self, v=None, first=None):
        self._v = v
        self._first = first

    def scalar_one_or_none(self):
        return self._v

    def scalar(self):
        return self._v

    def first(self):
        return self._first


class _DB:
    def __init__(self, bonus=Decimal("0"), pool=False, active_copy=False):
        self.bonus = bonus
        self.pool = pool
        self.active_copy = active_copy
        self.added = []

    async def execute(self, stmt, *a, **k):
        sql = str(stmt)
        if "user_bonuses" in sql:
            return _Res(self.bonus)
        if "master_accounts" in sql:
            return _Res(first=(uuid4(),) if self.pool else None)
        if "investor_allocations" in sql:
            return _Res(first=(uuid4(),) if self.active_copy else None)
        if "kyc_status" in sql:
            return _Res("approved")
        return _Res(None)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        return None

    async def refresh(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid4()


class _Base(unittest.TestCase):
    def setUp(self):
        self.saved = []
        self.user = SimpleNamespace(
            id=uuid4(), main_wallet_balance=Decimal("100"), kyc_status="approved",
            wallet_address="0xabc", email="u@example.com", first_name="U",
        )
        self.wallet_acc = None
        self.locks = []

        async def _lock_user(db, uid):
            self.locks.append("user")
            return self.user

        async def _lock_account(db, aid, *, user_id=None):
            self.locks.append("account")
            return self.wallet_acc

        async def _get_wallet_account(uid, db):
            return self.wallet_acc

        async def _gb(name, default=None):
            return default

        async def _noop(*a, **k):
            return None

        self._patch(ws, "lock_user", _lock_user)
        self._patch(ws, "lock_account", _lock_account)
        self._patch(account_service, "get_wallet_account", _get_wallet_account)
        self._patch(settings_store, "get_bool_setting", _gb)
        self._patch(ws, "create_notification", _noop)
        self._patch(ws, "send_withdrawal_requested_email", _noop)

    def _patch(self, mod, name, val):
        self.saved.append((mod, name, getattr(mod, name)))
        setattr(mod, name, val)

    def tearDown(self):
        for mod, name, val in reversed(self.saved):
            setattr(mod, name, val)


class CreateWithdrawalTests(_Base):
    def _req(self, amount, **kw):
        base = dict(amount=Decimal(amount), method="crypto_usdt", bank_details=None,
                    crypto_address=None, source=None, step_up_challenge_id=None)
        base.update(kw)
        return SimpleNamespace(**base)

    def test_bonus_is_not_withdrawable_and_locks_come_first(self):
        db = _DB(bonus=Decimal("80"))
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ws.create_withdrawal(self._req("50"), self.user.id, db))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(self.locks[0], "user")  # locked before any check

    def test_spendable_amount_passes(self):
        db = _DB(bonus=Decimal("80"))
        out = asyncio.run(ws.create_withdrawal(self._req("20"), self.user.id, db))
        self.assertEqual(out["status"], "pending")

    def test_inactive_wallet_account_refused(self):
        self.wallet_acc = SimpleNamespace(id=uuid4(), is_active=False, account_number="W1",
                                          balance=Decimal("500"), margin_used=Decimal("0"),
                                          free_margin=Decimal("500"))
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ws.create_withdrawal(self._req("10"), self.user.id, _DB()))
        self.assertEqual(ctx.exception.status_code, 409)

    def test_managed_pool_source_refused(self):
        self.wallet_acc = SimpleNamespace(id=uuid4(), is_active=True, account_number="PM1",
                                          balance=Decimal("500"), margin_used=Decimal("0"),
                                          free_margin=Decimal("500"))
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ws.create_withdrawal(self._req("10"), self.user.id, _DB(pool=True)))
        self.assertEqual(ctx.exception.status_code, 409)

    def test_active_copy_subaccount_refused(self):
        self.wallet_acc = SimpleNamespace(id=uuid4(), is_active=True, account_number="CF1234",
                                          balance=Decimal("500"), margin_used=Decimal("0"),
                                          free_margin=Decimal("500"))
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ws.create_withdrawal(self._req("10"), self.user.id, _DB(active_copy=True)))
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("Stop Copy", ctx.exception.detail)


class StepUpWiringTests(_Base):
    def test_step_up_consumed_only_when_flag_on(self):
        consumed = []
        fake_mod = types.ModuleType("services.gateway.src.services.sensitive_action_service")

        async def _consume(db, user_id, challenge_id):
            consumed.append(challenge_id)
        fake_mod.consume_withdrawal_step_up = _consume
        key = "services.gateway.src.services.sensitive_action_service"
        real = sys.modules.get(key)
        sys.modules[key] = fake_mod
        import services.gateway.src.services as pkg
        real_attr = getattr(pkg, "sensitive_action_service", None)
        pkg.sensitive_action_service = fake_mod
        try:
            self._patch(ws, "get_settings", lambda: SimpleNamespace(WITHDRAWAL_STEP_UP_REQUIRED=False))
            asyncio.run(ws.enforce_withdrawal_step_up(None, uuid4(), "c1"))
            self.assertEqual(consumed, [])
            ws.get_settings = lambda: SimpleNamespace(WITHDRAWAL_STEP_UP_REQUIRED=True)
            asyncio.run(ws.enforce_withdrawal_step_up(None, uuid4(), "c2"))
            self.assertEqual(consumed, ["c2"])
        finally:
            if real is not None:
                sys.modules[key] = real
            else:
                sys.modules.pop(key, None)
            if real_attr is not None:
                pkg.sensitive_action_service = real_attr


class OnchainWithdrawTests(_Base):
    def test_main_wallet_debit_keeps_bonus(self):
        # balance 100, bonus 30 → spendable 70; withdraw 50 → balance 50
        # (the old code wrote `available - amt` = 20, wiping the bonus).
        db = _DB(bonus=Decimal("30"))
        out = asyncio.run(ows.create_onchain_withdrawal(
            self.user.id, "eth", Decimal("50"), "0x" + "a" * 40, db,
        ))
        self.assertEqual(out["status"], "pending")
        self.assertEqual(self.user.main_wallet_balance, Decimal("50"))

    def test_trading_source_is_locked_and_debited(self):
        self.wallet_acc = SimpleNamespace(id=uuid4(), is_active=True, account_number="W1",
                                          balance=Decimal("100"), equity=Decimal("100"),
                                          margin_used=Decimal("0"), free_margin=Decimal("100"))
        asyncio.run(ows.create_onchain_withdrawal(
            self.user.id, "eth", Decimal("40"), "0x" + "b" * 40, _DB(),
        ))
        self.assertEqual(self.locks[:2], ["user", "account"])
        self.assertEqual(self.wallet_acc.balance, Decimal("60"))

    def test_overdraw_refused(self):
        db = _DB(bonus=Decimal("90"))
        with self.assertRaises(HTTPException):
            asyncio.run(ows.create_onchain_withdrawal(
                self.user.id, "eth", Decimal("20"), "0x" + "c" * 40, db,
            ))
        self.assertEqual(self.user.main_wallet_balance, Decimal("100"))


class TransferGuardTests(_Base):
    def _acc(self, **kw):
        base = dict(id=uuid4(), is_active=True, account_number="T1", balance=Decimal("100"),
                    margin_used=Decimal("0"), credit=Decimal("0"))
        base.update(kw)
        return SimpleNamespace(**base)

    def _run_t2m(self, acc, db):
        orig = db.execute

        async def _exec(stmt, *a, **k):
            if "FROM trading_accounts" in str(stmt):
                return _Res(acc)
            return await orig(stmt, *a, **k)
        db.execute = _exec
        req = SimpleNamespace(amount=Decimal("10"), from_account_id=acc.id)
        return asyncio.run(ws.transfer_trading_to_main(req, self.user.id, db))

    def test_trading_to_main_from_pool_refused(self):
        with self.assertRaises(HTTPException) as ctx:
            self._run_t2m(self._acc(), _DB(pool=True))
        self.assertEqual(ctx.exception.status_code, 409)

    def test_trading_to_main_from_inactive_refused(self):
        with self.assertRaises(HTTPException) as ctx:
            self._run_t2m(self._acc(is_active=False), _DB())
        self.assertEqual(ctx.exception.status_code, 409)

    def test_trading_to_main_ok(self):
        acc = self._acc()
        self._run_t2m(acc, _DB())
        self.assertEqual(acc.balance, Decimal("90"))
        self.assertEqual(self.user.main_wallet_balance, Decimal("110"))


class GuardHelperTests(unittest.TestCase):
    def test_assert_transfer_out_allowed_none(self):
        with self.assertRaises(HTTPException):
            asyncio.run(money_guards.assert_transfer_out_allowed(_DB(), None))


if __name__ == "__main__":
    unittest.main()
