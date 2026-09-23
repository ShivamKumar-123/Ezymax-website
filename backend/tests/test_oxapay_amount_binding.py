"""Phase 3: an OxaPay 'paid' callback whose stated amount doesn't match the
recorded deposit is routed to manual_review, never auto-credited.
"""
import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from services.gateway.src.services import wallet_service as ws


class _Res:
    def __init__(self, scalar):
        self._scalar = scalar

    def scalar_one_or_none(self):
        return self._scalar


class _DB:
    def __init__(self, results):
        self._results = list(results)
        self.execute_calls = 0

    async def execute(self, *a, **k):
        self.execute_calls += 1
        return _Res(self._results.pop(0) if self._results else None)

    async def commit(self):
        return None


class OxapayAmountBindingTests(unittest.TestCase):
    def test_amount_mismatch_manual_review(self):
        did = uuid4()
        deposit = SimpleNamespace(
            id=did, status="pending", amount=Decimal("1000"), user_id=uuid4(),
            transaction_id=None, rejection_reason=None, approved_at=None,
        )
        db = _DB([deposit])
        asyncio.run(ws.handle_oxapay_webhook(
            order_id=str(did), oxapay_status="paid", track_id=None,
            payload={"amount": 10}, db=db,
        ))
        self.assertEqual(deposit.status, "manual_review")
        self.assertIn("mismatch", (deposit.rejection_reason or "").lower())
        # only the Deposit was queried — no User credit path was entered.
        self.assertEqual(db.execute_calls, 1)


if __name__ == "__main__":
    unittest.main()
