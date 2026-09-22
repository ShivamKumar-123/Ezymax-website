"""C-TRADE-2: close/modify lots must be bounded (0 < lots <= 100).

Before the fix these fields were `Optional[Decimal] = None` with no bound, so
a client could send 0, a negative, or an absurd size. Pure-unit: exercise the
Pydantic schema directly.
"""
import unittest
from decimal import Decimal

from pydantic import ValidationError

from packages.common.src.schemas.trading import (
    ClosePositionRequest,
    ModifyOrderRequest,
)


class LotsBoundTests(unittest.TestCase):
    def test_zero_rejected(self):
        with self.assertRaises(ValidationError):
            ClosePositionRequest(lots=Decimal("0"))

    def test_negative_rejected(self):
        with self.assertRaises(ValidationError):
            ClosePositionRequest(lots=Decimal("-1"))

    def test_over_max_rejected(self):
        with self.assertRaises(ValidationError):
            ClosePositionRequest(lots=Decimal("101"))

    def test_none_allowed(self):
        self.assertIsNone(ClosePositionRequest(lots=None).lots)

    def test_valid_allowed(self):
        self.assertEqual(ClosePositionRequest(lots=Decimal("0.5")).lots, Decimal("0.5"))

    def test_modify_order_bounds(self):
        with self.assertRaises(ValidationError):
            ModifyOrderRequest(lots=Decimal("0"))
        self.assertEqual(ModifyOrderRequest(lots=Decimal("2")).lots, Decimal("2"))


if __name__ == "__main__":
    unittest.main()
