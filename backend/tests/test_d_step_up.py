"""Section D3/D4 regressions: withdrawal step-up consume (single use, inside
the caller's transaction), method policy, atomic attempt reservation, SIWE
wallet-age rule, wallet-link step-up requirement.
"""
import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from services.gateway.src.services import sensitive_action_service as sas


class _Res:
    def __init__(self, scalar=None):
        self._scalar = scalar

    def scalar_one_or_none(self):
        return self._scalar


class _DB:
    def __init__(self, results=()):
        self._results = list(results)
        self.statements = []
        self.commits = 0
        self.rollbacks = 0

    async def execute(self, stmt, *a, **k):
        self.statements.append(stmt)
        return self._results.pop(0) if self._results else _Res()

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


class _FakeRedis:
    def __init__(self):
        self.store = {}

    async def incr(self, key):
        self.store[key] = int(self.store.get(key, 0)) + 1
        return self.store[key]

    async def expire(self, key, ttl):
        return True


class ConsumeWithdrawalStepUpTests(unittest.TestCase):
    def test_missing_challenge_id(self):
        for cid in (None, "", "not-a-uuid"):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(sas.consume_withdrawal_step_up(_DB(), uuid4(), cid))
            self.assertEqual(ctx.exception.status_code, 403)
            self.assertEqual(ctx.exception.detail, "STEP_UP_REQUIRED")

    def test_invalid_or_used_challenge(self):
        db = _DB([_Res(None)])  # conditional UPDATE matched nothing
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(sas.consume_withdrawal_step_up(db, uuid4(), str(uuid4())))
        self.assertEqual(ctx.exception.detail, "STEP_UP_INVALID")
        self.assertEqual(db.commits, 0)

    def test_valid_consumed_without_commit_and_scoped(self):
        ch = SimpleNamespace(action="withdrawal", verified_at=datetime.now(timezone.utc),
                             consumed_at=None)
        db = _DB([_Res(ch)])
        asyncio.run(sas.consume_withdrawal_step_up(db, uuid4(), uuid4()))
        self.assertIsNotNone(ch.consumed_at)
        self.assertEqual(db.commits, 0)  # caller's transaction owns the commit
        sql = str(db.statements[0])
        self.assertIn("UPDATE sensitive_action_challenges", sql)
        self.assertIn("consumed_at IS NULL", sql)
        self.assertIn("verified_at IS NOT NULL", sql)
        self.assertIn("RETURNING", sql)
        params = db.statements[0].compile().params
        self.assertIn("withdrawal", params.values())

    def test_other_action_challenge_refused(self):
        ch = SimpleNamespace(action="email_change", verified_at=datetime.now(timezone.utc),
                             consumed_at=None)
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(sas.consume_withdrawal_step_up(_DB([_Res(ch)]), uuid4(), uuid4()))
        self.assertEqual(ctx.exception.detail, "STEP_UP_INVALID")


class MethodPolicyTests(unittest.TestCase):
    def test_2fa_user_must_use_totp(self):
        u = SimpleNamespace(two_factor_enabled=True)
        self.assertEqual(sas._resolve_method(u, "withdrawal", "auto"), "totp")
        with self.assertRaises(HTTPException):
            sas._resolve_method(u, "withdrawal", "otp_old_email")
        with self.assertRaises(HTTPException):
            sas._resolve_method(u, "withdrawal", "siwe")

    def test_no_2fa_uses_email_otp(self):
        u = SimpleNamespace(two_factor_enabled=False)
        self.assertEqual(sas._resolve_method(u, "withdrawal", "auto"), "otp_old_email")
        self.assertEqual(sas._resolve_method(u, "withdrawal", "email_otp"), "otp_old_email")
        with self.assertRaises(HTTPException):
            sas._resolve_method(u, "withdrawal", "totp")

    def test_unknown_action_refused(self):
        uid = uuid4()
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(sas.start_challenge(uid, "drain_everything", "auto", {}, _DB()))
        self.assertEqual(ctx.exception.status_code, 400)


class VerifyAttemptTests(unittest.TestCase):
    def setUp(self):
        self._orig = sas.redis_client
        sas.redis_client = _FakeRedis()

    def tearDown(self):
        sas.redis_client = self._orig

    def test_exhausted_budget_burns_challenge(self):
        row = SimpleNamespace(consumed_at=None, verified_at=None,
                              expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
                              attempts=5)
        # reserve UPDATE → None; diagnose SELECT → row; burn UPDATE → ok
        db = _DB([_Res(None), _Res(row), _Res(None)])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(sas.verify_challenge(uuid4(), uuid4(), {"otp": "123456"},
                                             request=None, db=db))
        self.assertIn("Too many", ctx.exception.detail)
        self.assertIn("attempts <", str(db.statements[0]))  # conditional reservation
        self.assertEqual(db.commits, 1)

    def test_wrong_otp_charges_attempt_before_check(self):
        ch = SimpleNamespace(id=uuid4(), method="otp_old_email", attempts=1,
                             challenge_data={"code_hash": "nope"})
        db = _DB([_Res(ch)])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(sas.verify_challenge(uuid4(), ch.id, {"otp": "123456"},
                                             request=None, db=db))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(db.commits, 1)  # the reserved attempt was persisted
        self.assertIn("attempts", str(db.statements[0]))

    def test_correct_otp_verifies_conditionally(self):
        cid = uuid4()
        ch = SimpleNamespace(id=cid, method="otp_old_email", attempts=1, verified_at=None,
                             challenge_data={"code_hash": sas._hash_otp("123456", str(cid))})
        db = _DB([_Res(ch), _Res(cid)])
        out = asyncio.run(sas.verify_challenge(uuid4(), cid, {"otp": "123456"},
                                               request=None, db=db))
        self.assertIsNotNone(out.verified_at)
        self.assertIn("verified_at IS NULL", str(db.statements[1]))

    def test_per_user_verify_cap(self):
        uid = uuid4()
        sas.redis_client.store[f"stepup_verify:{uid}"] = sas.VERIFY_CAP_PER_HOUR
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(sas.verify_challenge(uid, uuid4(), {}, request=None, db=_DB()))
        self.assertEqual(ctx.exception.status_code, 429)


class SiweWalletAgeTests(unittest.TestCase):
    def test_recently_linked_wallet_refused(self):
        db = _DB([_Res(datetime.now(timezone.utc) - timedelta(hours=2))])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(sas.assert_wallet_old_enough_for_siwe(db, uuid4()))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_old_wallet_allowed(self):
        db = _DB([_Res(datetime.now(timezone.utc) - timedelta(days=3))])
        asyncio.run(sas.assert_wallet_old_enough_for_siwe(db, uuid4()))

    def test_wallet_without_link_record_allowed(self):
        asyncio.run(sas.assert_wallet_old_enough_for_siwe(_DB([_Res(None)]), uuid4()))

    def test_inline_siwe_refused_for_new_wallet(self):
        user = SimpleNamespace(id=uuid4(), wallet_address="0xabc")
        db = _DB([_Res(datetime.now(timezone.utc) - timedelta(minutes=5))])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(sas.verify_inline_proof(
                user, "siwe", {"message": "m", "signature": "s"}, request=None, db=db))
        self.assertEqual(ctx.exception.status_code, 403)


class WalletLinkStepUpTests(unittest.TestCase):
    def test_first_link_on_verified_email_requires_step_up(self):
        u = SimpleNamespace(email="a@x.com", email_verified=True, wallet_address=None)
        self.assertTrue(sas.wallet_link_requires_step_up(u))
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(sas.require_wallet_link_step_up(_DB(), u, None))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_not_required_for_unverified_or_placeholder(self):
        self.assertFalse(sas.wallet_link_requires_step_up(
            SimpleNamespace(email="a@x.com", email_verified=False, wallet_address=None)))
        self.assertFalse(sas.wallet_link_requires_step_up(
            SimpleNamespace(email="w@wallet.swisscresta.local", email_verified=True, wallet_address=None)))
        asyncio.run(sas.require_wallet_link_step_up(
            _DB(), SimpleNamespace(email="a@x.com", email_verified=False, wallet_address=None), None))


if __name__ == "__main__":
    unittest.main()
