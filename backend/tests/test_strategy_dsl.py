"""Unit tests for the AI Strategy DSL and backtester.

Run from the backend/ directory:

    python -m unittest tests.test_strategy_dsl
"""
import random
import unittest

from packages.common.src.strategy_dsl import StrategyDSL, rsi, sma
from packages.common.src.strategy_backtest import run_backtest


GOOD_DSL = {
    "symbol": "eurusd", "timeframe": "1h", "direction": "both",
    "entry_long": {"all": [
        {"left": {"type": "indicator", "name": "ema", "period": 10},
         "op": "crosses_above",
         "right": {"type": "indicator", "name": "ema", "period": 30}}]},
    "entry_short": {"all": [
        {"left": {"type": "indicator", "name": "ema", "period": 10},
         "op": "crosses_below",
         "right": {"type": "indicator", "name": "ema", "period": 30}}]},
    "risk": {"lots": 0.1, "stop_loss_pct": 1.0, "take_profit_pct": 2.0},
}


def synthetic_bars(n=600, seed=42):
    random.seed(seed)
    bars, price, ts = [], 1.1000, 1_700_000_000
    for i in range(n):
        drift = 0.0004 if (i // 100) % 2 == 0 else -0.0004
        o = price
        c = price + drift + random.uniform(-0.0006, 0.0006)
        bars.append({
            "time": ts, "open": o,
            "high": max(o, c) + 0.0003, "low": min(o, c) - 0.0003,
            "close": c,
        })
        price = c
        ts += 3600
    return bars


class DslValidationTests(unittest.TestCase):
    def test_valid_dsl_parses_and_normalizes(self):
        d = StrategyDSL.model_validate(GOOD_DSL)
        self.assertEqual(d.symbol, "EURUSD")
        self.assertEqual(d.warmup_bars(), 35)

    def test_rejects_strategy_with_no_exit(self):
        with self.assertRaises(Exception):
            StrategyDSL.model_validate({**GOOD_DSL, "risk": {"lots": 0.1}})

    def test_rejects_unknown_timeframe(self):
        with self.assertRaises(Exception):
            StrategyDSL.model_validate({**GOOD_DSL, "timeframe": "2h"})

    def test_rejects_constant_on_cross_left(self):
        bad = {**GOOD_DSL, "entry_long": {"all": [
            {"left": {"type": "const", "value": 1}, "op": "crosses_above",
             "right": {"type": "price", "field": "close"}}]}}
        with self.assertRaises(Exception):
            StrategyDSL.model_validate(bad)

    def test_rejects_missing_entry_for_direction(self):
        with self.assertRaises(Exception):
            StrategyDSL.model_validate({**GOOD_DSL, "entry_long": None})


class IndicatorTests(unittest.TestCase):
    def test_sma(self):
        s = sma([float(i) for i in range(1, 21)], 5)
        self.assertEqual(s[4], 3.0)
        self.assertEqual(s[19], 18.0)

    def test_rsi_monotonic_up_is_100(self):
        r = rsi([float(i) for i in range(1, 16)], 14)
        self.assertAlmostEqual(r[14], 100.0)


class BacktestTests(unittest.TestCase):
    def test_accounting_invariants(self):
        d = StrategyDSL.model_validate(GOOD_DSL)
        res = run_backtest(d, synthetic_bars(),
                           contract_size=100000, commission_per_lot=7.0)
        st = res.stats
        self.assertGreater(st["total_trades"], 0)
        self.assertEqual(st["wins"] + st["losses"], st["total_trades"])
        self.assertAlmostEqual(
            st["gross_profit"] - st["gross_loss"], st["net_profit"], places=2)
        self.assertAlmostEqual(
            st["final_balance"], st["initial_balance"] + st["net_profit"], places=2)
        self.assertEqual(len(res.equity_curve), st["bars_used"])
        for t in res.trades:
            self.assertGreaterEqual(t["exit_ts"], t["entry_ts"])
            self.assertIn(t["exit_reason"],
                          ("stop_loss", "take_profit", "exit_rule", "end_of_data"))

    def test_insufficient_history_raises(self):
        d = StrategyDSL.model_validate(GOOD_DSL)
        with self.assertRaises(ValueError):
            run_backtest(d, synthetic_bars(20))


if __name__ == "__main__":
    unittest.main()
