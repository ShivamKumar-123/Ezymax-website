"""H-AUTH-2: disconnecting the wallet (the only way to change the withdrawal
address) requires a verified step-up challenge.
"""
import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from services.gateway.src.api import profile as profile_api
from services.gateway.src.services import sensitive_action_service as sas


class _Res:
    def __init__(self, scalar=None):
        self._scalar = scalar

    def scalar_one_or_none(self):
        return self._scalar


class _DB:
    def __init__(self, results):
        self._results = list(results)

    async def execute(self, *a, **k):
        return self._results.pop(0) if self._results else _Res()

    async def commit(self):
        return None


class UnlinkStepUpTests(unittest.TestCase):
    def test_unlink_without_challenge_refused(self):
        uid = uuid4()
        user = SimpleNamespace(id=uid, password_hash="bcrypt$x", google_id=None,
                               wallet_address="0xabc")
        db = _DB([_Res(scalar=user)])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(profile_api.unlink_wallet(
                request=SimpleNamespace(), challenge_id="not-a-uuid",
                current_user={"user_id": uid}, db=db,
            ))
        self.assertEqual(ctx.exception.status_code, 400)


class ConsumeChallengeTests(unittest.TestCase):
    def test_missing_challenge_403(self):
        db = _DB([_Res(scalar=None)])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(sas.consume_verified_challenge(uuid4(), uuid4(), "wallet_disconnect", db))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_wrong_action_403(self):
        ch = SimpleNamespace(action="email_change", verified_at=datetime.now(timezone.utc),
                             consumed_at=None)
        db = _DB([_Res(scalar=ch)])
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(sas.consume_verified_challenge(uuid4(), uuid4(), "wallet_disconnect", db))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_valid_challenge_consumed(self):
        ch = SimpleNamespace(action="wallet_disconnect",
                             verified_at=datetime.now(timezone.utc), consumed_at=None)
        db = _DB([_Res(scalar=ch)])
        out = asyncio.run(sas.consume_verified_challenge(uuid4(), uuid4(), "wallet_disconnect", db))
        self.assertIsNotNone(out.consumed_at)  # marked consumed (one-shot)


if __name__ == "__main__":
    unittest.main()
