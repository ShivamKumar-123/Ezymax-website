"""Section A5 / A6 / B1 on the trader account paths (agent B files).

* A5 bonus laundering: copy-trade start, PAMM invest, open live account and
  migrate-to-wallet-account only spend `main_wallet_balance - outstanding
  bonus`.
* A6 migrate-to-wallet-account: user locked first, then the source; refuses
  open positions / pending orders / pending withdrawals / managed pool / copy
  sub-account; moves only available cash; the bonus stays.
* B1: a PAMM/MAM pool account can't be deleted.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from packages.common.src.models import Transaction
from services.gateway.src.services import account_service
from services.gateway.src.services import profile_service
from services.gateway.src.services import social_service as ss


class _Res:
    def __init__(self, scalar=None, scalarv=None, items=None, first=None):
        self._scalar = scalar
        self._scalarv = scalarv
        self._items = items or []
        self._first = first

    def scalar_one_or_none(self):
        return self._scalar

    def scalar(self):
        return self._scalarv

    def first(self):
        return self._first

    def scalars(self):
        return self

    def all(self):
        return self._items


class _DB:
    def __init__(self, results, get_obj=None):
        self._results = list(results)
        self._get_obj = get_obj
        self.added = []
        self.commits = 0

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    async def get(self, *a, **k):
        return self._get_obj

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        return None

    async def commit(self):
        self.commits += 1

    async def refresh(self, *a, **k):
        return None


class BonusLaunderingTests(unittest.TestCase):
    def test_open_live_account_refuses_bonus_funded(self):
        uid = uuid4()
        user = SimpleNamespace(id=uid, is_demo=False, main_wallet_balance=Decimal("100"))
        group = SimpleNamespace(id=uuid4(), minimum_deposit=Decimal("100"),
                                leverage_default=100, name="Standard")
        req = SimpleNamespace(account_group_id=group.id, leverage=None, is_demo=None)
        db = _DB([_Res(scalar=user), _Res(scalar=group), _Res(scalarv=Decimal("60"))])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(account_service.open_live_account(uid, req, db))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(user.main_wallet_balance, Decimal("100"))

    def test_start_copy_refuses_bonus_funded(self):
        uid = uuid4()
        master = SimpleNamespace(id=uuid4(), user_id=uuid4(), master_type="signal_provider",
                                 min_investment=Decimal("10"), max_investors=100,
                                 account_id=uuid4(), followers_count=0)
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("100"))
        db = _DB([
            _Res(scalar=master), _Res(scalarv=0),    # master, investor count
            _Res(scalar=user),                       # lock_user
            _Res(scalar=None),                       # existing allocation
            _Res(scalarv=Decimal("80")),             # outstanding bonus
        ])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ss.start_copy(master.id, None, Decimal("50"), None, None, uid, db))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(user.main_wallet_balance, Decimal("100"))
        self.assertEqual(db.added, [])

    def test_pamm_invest_refuses_bonus_funded(self):
        uid = uuid4()
        master = SimpleNamespace(id=uuid4(), status="approved", master_type="pamm",
                                 account_id=uuid4(), user_id=uuid4(),
                                 min_investment=Decimal("0"), max_investors=100)
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("100"))
        db = _DB([
            _Res(scalar=master), _Res(scalarv=0), _Res(scalar=user),
            _Res(scalarv=Decimal("90")),             # outstanding bonus → spendable 10
        ])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(ss.invest_managed_account(master.id, Decimal("50"), None, Decimal("100"), uid, db))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(user.main_wallet_balance, Decimal("100"))


class DeletePoolTests(unittest.TestCase):
    def test_managed_pool_cannot_be_deleted(self):
        uid, acct_id = uuid4(), uuid4()
        account = SimpleNamespace(id=acct_id, user_id=uid, is_demo=False,
                                  balance=Decimal("50000"), credit=Decimal("0"), is_active=True)
        user = SimpleNamespace(id=uid, main_wallet_balance=Decimal("0"))
        master = SimpleNamespace(id=uuid4(), master_type="pamm")
        db = _DB([
            _Res(scalar=account), _Res(first=None), _Res(scalarv=0), _Res(items=[]),
            _Res(),                     # cancel pending orders (no-op)
            _Res(scalar=master),        # approved master on this account
            _Res(first=(master.id,)),   # is_managed_pool → yes
        ], get_obj=user)
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(account_service.delete_trading_account(acct_id, uid, db))
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(user.main_wallet_balance, Decimal("0"))
        self.assertEqual(account.balance, Decimal("50000"))
        self.assertTrue(account.is_active)
        self.assertEqual(db.commits, 0)


class MigrateToWalletAccountTests(unittest.TestCase):
    def setUp(self):
        self._orig = account_service.create_wallet_bound_account
        self.created = []

        async def _create(db, user_id, *, account_group_id=None, starting_balance=None):
            acc = SimpleNamespace(id=uuid4(), account_number="PT1", balance=Decimal(str(starting_balance or 0)))
            self.created.append(acc)
            return acc
        account_service.create_wallet_bound_account = _create

    def tearDown(self):
        account_service.create_wallet_bound_account = self._orig

    def _user(self, bal):
        return SimpleNamespace(id=uuid4(), wallet_address="0xabc", main_wallet_balance=Decimal(bal))

    def test_moves_spendable_only_bonus_stays(self):
        user = self._user("100")
        db = _DB([_Res(scalar=user), _Res(scalarv=Decimal("30"))])   # lock_user, bonus 30
        out = asyncio.run(profile_service.migrate_to_wallet_account(user.id, None, db))
        self.assertEqual(out["main_amount"], Decimal("70"))
        self.assertEqual(self.created[0].balance, Decimal("70"))
        self.assertEqual(user.main_wallet_balance, Decimal("30"))     # bonus stays
        txns = [t for t in db.added if isinstance(t, Transaction)]
        self.assertEqual(len(txns), 1)
        self.assertEqual(txns[0].amount, Decimal("70"))

    def _source(self, user, **kw):
        base = dict(id=uuid4(), user_id=user.id, account_number="PT77777777", is_active=True,
                    is_demo=False, is_wallet_account=False, balance=Decimal("500"),
                    credit=Decimal("0"), equity=Decimal("500"), free_margin=Decimal("500"))
        base.update(kw)
        return SimpleNamespace(**base)

    def _run_refused(self, user, results):
        db = _DB(results)
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(profile_service.migrate_to_wallet_account(user.id, uuid4(), db))
        self.assertEqual(self.created, [])
        return ctx.exception.status_code

    def test_refuses_managed_pool_source(self):
        user = self._user("0")
        src = self._source(user)
        code = self._run_refused(user, [_Res(scalar=user), _Res(scalar=src), _Res(first=(uuid4(),))])
        self.assertEqual(code, 409)
        self.assertEqual(src.balance, Decimal("500"))

    def test_refuses_copy_subaccount_source(self):
        user = self._user("0")
        src = self._source(user, account_number="CF12345678")
        code = self._run_refused(user, [_Res(scalar=user), _Res(scalar=src), _Res(first=None)])
        self.assertEqual(code, 409)

    def test_refuses_source_with_open_positions(self):
        user = self._user("0")
        src = self._source(user)
        code = self._run_refused(user, [
            _Res(scalar=user), _Res(scalar=src), _Res(first=None),
            _Res(scalar=None),          # not a copy destination
            _Res(scalar=uuid4()),       # open position
        ])
        self.assertEqual(code, 409)

    def test_refuses_source_with_pending_withdrawal(self):
        user = self._user("0")
        src = self._source(user)
        code = self._run_refused(user, [
            _Res(scalar=user), _Res(scalar=src), _Res(first=None),
            _Res(scalar=None), _Res(scalar=None), _Res(scalar=None),
            _Res(scalar=uuid4()),       # withdrawal in flight
        ])
        self.assertEqual(code, 409)

    def test_source_cash_moves_credit_stays(self):
        user = self._user("0")
        src = self._source(user, credit=Decimal("40"))
        db = _DB([
            _Res(scalar=user), _Res(scalar=src), _Res(first=None),
            _Res(scalar=None), _Res(scalar=None), _Res(scalar=None), _Res(scalar=None),
            _Res(scalarv=0),            # outstanding bonus
        ])
        out = asyncio.run(profile_service.migrate_to_wallet_account(user.id, src.id, db))
        self.assertEqual(out["sweep_amount"], Decimal("500"))
        self.assertEqual(src.balance, Decimal("0"))
        self.assertEqual(src.credit, Decimal("40"))
        self.assertTrue(src.is_active)          # kept open while it holds bonus credit


if __name__ == "__main__":
    unittest.main()
