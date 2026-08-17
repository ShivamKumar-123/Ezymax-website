"""Unit tests for CopyTradeEngine.compute_lot_size.

Extracted from services/gateway/src/engines/copy_engine.py, where they
lived inline in the production module (importing unittest into a hot-path
engine). Run from the backend/ directory:

    python -m unittest tests.test_copy_engine_lot_size
"""
import unittest
from decimal import Decimal
from types import SimpleNamespace

from services.gateway.src.engines.copy_engine import CopyTradeEngine, MIN_COPY_LOT


class _ComputeLotSizeTests(unittest.TestCase):
    """Covers PAMM pool math, MAM scaling, Signal ratio, zero-pool, min-lot guards."""

    def _accounts(self, m_eq, i_eq):
        master = SimpleNamespace(equity=Decimal(str(m_eq)), balance=Decimal(str(m_eq)))
        inv = SimpleNamespace(equity=Decimal(str(i_eq)), balance=Decimal(str(i_eq)))
        return master, inv

    def test_signal_equity_ratio(self):
        ma, ia = self._accounts(10000, 2500)
        alloc = SimpleNamespace(allocation_amount=100, allocation_pct=None, copy_type="signal")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=0, copy_type="signal")
        self.assertIsNone(err)
        self.assertEqual(lots, 0.25)

    def test_signal_zero_investor_equity(self):
        ma, ia = self._accounts(10000, 0)
        alloc = SimpleNamespace(allocation_amount=100, allocation_pct=None, copy_type="signal")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=0, copy_type="signal")
        self.assertIsNone(lots)
        self.assertEqual(err, "signal_zero_investor_equity")

    def test_signal_zero_master_equity(self):
        ma, ia = self._accounts(0, 5000)
        alloc = SimpleNamespace(allocation_amount=100, allocation_pct=None, copy_type="signal")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=0, copy_type="signal")
        self.assertIsNone(lots)
        self.assertEqual(err, "signal_zero_master_equity")

    def test_pamm_pool_share(self):
        ma, ia = self._accounts(1, 1)
        alloc = SimpleNamespace(allocation_amount=3000, allocation_pct=None, copy_type="pamm")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=10000, copy_type="pamm")
        self.assertIsNone(err)
        self.assertEqual(lots, 0.3)

    def test_pamm_zero_pool(self):
        ma, ia = self._accounts(1, 1)
        alloc = SimpleNamespace(allocation_amount=100, allocation_pct=None, copy_type="pamm")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=0, copy_type="pamm")
        self.assertIsNone(lots)
        self.assertEqual(err, "pamm_zero_total_pool")

    def test_mam_volume_scaling(self):
        ma, ia = self._accounts(1, 1)
        alloc = SimpleNamespace(allocation_amount=5000, allocation_pct=Decimal("150"), copy_type="mam")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=10000, copy_type="mam")
        self.assertIsNone(err)
        self.assertEqual(lots, 0.75)

    def test_mam_zero_allocation_pct(self):
        ma, ia = self._accounts(1, 1)
        alloc = SimpleNamespace(allocation_amount=5000, allocation_pct=Decimal("0"), copy_type="mam")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=10000, copy_type="mam")
        self.assertIsNone(lots)
        self.assertEqual(err, "mam_zero_allocation_pct")

    def test_below_min_lot_clamps_to_minimum(self):
        # Proportional size rounds below 0.01 (1.0 * 10/10000 = 0.001) — the
        # engine must clamp up to the minimum lot instead of skipping the copy,
        # otherwise a master trading small sizes never mirrors to followers.
        ma, ia = self._accounts(10000, 10)
        alloc = SimpleNamespace(allocation_amount=100, allocation_pct=None, copy_type="signal")
        lots, err = CopyTradeEngine.compute_lot_size(1.0, ma, alloc, ia, total_pool=0, copy_type="signal")
        self.assertIsNone(err)
        self.assertEqual(lots, MIN_COPY_LOT)


if __name__ == "__main__":
    unittest.main()
