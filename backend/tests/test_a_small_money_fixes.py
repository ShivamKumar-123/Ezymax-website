"""A12 smaller money fixes: amount schemas, FX fail-closed, LP receiver
one-shot signatures / 5 s tolerance / finite prices.
"""
import asyncio
import hashlib
import hmac
import json
import time
import unittest
from decimal import Decimal
from types import SimpleNamespace

from fastapi import HTTPException
from pydantic import ValidationError

from packages.common.src.schemas.wallet import (
    OnchainWithdrawRequest, RazorpayOrderRequest, WithdrawalRequest, validate_money_amount,
)
from services.gateway.src.api import lp_receiver
from services.gateway.src.services import razorpay_service


class AmountSchemaTests(unittest.TestCase):
    def test_rejects_non_finite_zero_negative_huge_and_too_precise(self):
        for bad in ("NaN", "Infinity", "-1", "0", "10000000.01", "1.123456789"):
            with self.assertRaises(ValidationError, msg=bad):
                WithdrawalRequest(amount=bad, method="x")
        with self.assertRaises(ValidationError):
            OnchainWithdrawRequest(network="eth", amount="NaN", destination_address="0x")
        with self.assertRaises(ValidationError):
            RazorpayOrderRequest(amount="-5")

    def test_accepts_normal_amounts(self):
        self.assertEqual(WithdrawalRequest(amount="10.5", method="x").amount, Decimal("10.5"))
        self.assertEqual(WithdrawalRequest(amount="10000000", method="x").amount, Decimal("10000000"))

    def test_form_validator(self):
        self.assertEqual(validate_money_amount("0", allow_zero=True), Decimal("0"))
        for bad in ("nan", "inf", "0", "-3", "abc", "10000001", "0.000000001"):
            with self.assertRaises(ValueError, msg=bad):
                validate_money_amount(bad)


class FxFailClosedTests(unittest.TestCase):
    def setUp(self):
        self._cache = dict(razorpay_service._fx_cache)
        self._client = razorpay_service.httpx.AsyncClient

    def tearDown(self):
        razorpay_service._fx_cache.update(self._cache)
        razorpay_service.httpx.AsyncClient = self._client

    def _broken_feed(self):
        class _C:
            def __init__(self, *a, **k):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def get(self, *a, **k):
                raise RuntimeError("feed down")
        razorpay_service.httpx.AsyncClient = _C

    def test_no_hardcoded_fallback(self):
        self._broken_feed()
        razorpay_service._fx_cache.update({"rate": 0.0, "fetched_at": 0.0})
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(razorpay_service.get_usd_to_inr_rate())
        self.assertEqual(ctx.exception.status_code, 503)

    def test_recent_cached_rate_still_used(self):
        self._broken_feed()
        razorpay_service._fx_cache.update({"rate": 84.0, "fetched_at": time.time() - 2 * 3600})
        self.assertEqual(asyncio.run(razorpay_service.get_usd_to_inr_rate()), Decimal("84.0"))

    def test_too_stale_cached_rate_refused(self):
        self._broken_feed()
        razorpay_service._fx_cache.update({"rate": 84.0, "fetched_at": time.time() - 48 * 3600})
        with self.assertRaises(HTTPException):
            asyncio.run(razorpay_service.get_usd_to_inr_rate())


class _FakeRedis:
    def __init__(self):
        self.kv = {}
        self.pushed = []

    async def set(self, key, val, ex=None, nx=False):
        if nx and key in self.kv:
            return None
        self.kv[key] = val
        return True

    def pipeline(self):
        outer = self

        class _P:
            def rpush(self, k, v):
                outer.pushed.append(json.loads(v))

            def ltrim(self, *a):
                pass

            def set(self, *a, **k):
                pass

            async def execute(self):
                return []
        return _P()


class _Req:
    method = "POST"

    def __init__(self, body: bytes):
        self._body = body
        self.url = SimpleNamespace(path="/api/lp/prices/batch")

    async def body(self):
        return self._body


class LpReceiverTests(unittest.TestCase):
    SECRET = "lp-secret"

    def setUp(self):
        self._redis = lp_receiver.redis_client
        self._gs = lp_receiver.get_settings
        self.redis = _FakeRedis()
        lp_receiver.redis_client = self.redis
        lp_receiver.get_settings = lambda: SimpleNamespace(
            CORECEN_LP_ENABLED=True, CORECEN_LP_API_KEY="k", CORECEN_LP_API_SECRET=self.SECRET,
            CORECEN_LP_TIMESTAMP_TOLERANCE_MS=60_000,
        )

    def tearDown(self):
        lp_receiver.redis_client = self._redis
        lp_receiver.get_settings = self._gs

    def _call(self, ticks, ts_ms=None):
        body = json.dumps({"ticks": ticks})
        ts = str(ts_ms if ts_ms is not None else int(time.time() * 1000))
        msg = f"POST/api/lp/prices/batch{ts}{body}".encode()
        sig = hmac.new(self.SECRET.encode(), msg, hashlib.sha256).hexdigest()
        return asyncio.run(lp_receiver.receive_prices_batch(
            _Req(body.encode()), x_api_key="k", x_timestamp=ts, x_signature=sig,
        )), (body, ts, sig)

    def test_tolerance_capped_at_5s(self):
        with self.assertRaises(HTTPException):
            self._call([{"symbol": "EURUSD", "bid": 1.1, "ask": 1.2}],
                       ts_ms=int(time.time() * 1000) - 30_000)

    def test_signature_is_one_shot(self):
        out, (body, ts, sig) = self._call([{"symbol": "EURUSD", "bid": 1.1, "ask": 1.2}])
        self.assertEqual(out["accepted"], 1)
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(lp_receiver.receive_prices_batch(
                _Req(body.encode()), x_api_key="k", x_timestamp=ts, x_signature=sig,
            ))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_non_finite_prices_dropped(self):
        out, _ = self._call([
            {"symbol": "A", "bid": "NaN", "ask": 1.0},
            {"symbol": "B", "bid": 1.0, "ask": "Infinity"},
            {"symbol": "C", "bid": 1.0, "ask": 1.1},
        ])
        self.assertEqual(out["accepted"], 1)
        self.assertEqual([t["symbol"] for t in self.redis.pushed], ["C"])


if __name__ == "__main__":
    unittest.main()
