"""AI Strategy backtester — pure simulation over OHLC bars.

Uses the exact same DSL evaluation (strategy_dsl.entry_signal/exit_signal) as
the live engine, so a backtested rule can't behave differently in production.

Execution model (deliberately simple and honest about its approximations):
  - Signals are evaluated on each bar CLOSE; entries fill at the NEXT bar's
    open (no look-ahead).
  - While a position is open, SL/TP are checked intra-bar against the bar's
    low/high. If both could have hit within one bar, the STOP is assumed to
    hit first (conservative).
  - DSL exit conditions are evaluated on close and fill at that close.
  - One position at a time (backtest ignores max_open_positions > 1 — the
    live engine enforces it; pyramiding in a bar-based sim overstates edge).
  - P&L = Δprice × lots × contract_size, minus commission_per_lot per round
    trip. Quote-currency ≈ account-currency (fine for USD-quoted symbols;
    an approximation for crosses — the stats page says so).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

from .strategy_dsl import Bars, StrategyDSL, entry_signal, exit_signal


@dataclass
class BacktestTrade:
    side: str
    entry_ts: int
    entry_price: float
    exit_ts: int = 0
    exit_price: float = 0.0
    lots: float = 0.0
    pnl: float = 0.0
    exit_reason: str = ""


@dataclass
class BacktestResult:
    stats: dict = field(default_factory=dict)
    equity_curve: list = field(default_factory=list)
    trades: list = field(default_factory=list)


def run_backtest(
    dsl: StrategyDSL,
    raw_bars: list[dict],
    *,
    contract_size: float = 100000.0,
    initial_balance: float = 10000.0,
    commission_per_lot: float = 0.0,
) -> BacktestResult:
    bars = Bars(raw_bars)
    n = len(bars)
    warmup = dsl.warmup_bars()
    if n <= warmup + 2:
        raise ValueError(
            f"not enough history: {n} bars for {dsl.symbol} {dsl.timeframe}, "
            f"need at least {warmup + 3}"
        )

    lots = dsl.risk.lots
    sl_pct = dsl.risk.stop_loss_pct
    tp_pct = dsl.risk.take_profit_pct

    balance = initial_balance
    equity_curve: list[dict] = []
    trades: list[BacktestTrade] = []
    open_trade: Optional[BacktestTrade] = None
    sl_price = tp_price = None
    trades_today = 0
    current_day = None

    def _close(trade: BacktestTrade, price: float, ts: int, reason: str):
        nonlocal balance, open_trade, sl_price, tp_price
        direction = 1.0 if trade.side == "buy" else -1.0
        gross = (price - trade.entry_price) * direction * trade.lots * contract_size
        commission = commission_per_lot * trade.lots
        trade.exit_ts, trade.exit_price = ts, price
        trade.pnl = gross - commission
        trade.exit_reason = reason
        balance += trade.pnl
        trades.append(trade)
        open_trade = None
        sl_price = tp_price = None

    pending_side: Optional[str] = None

    for i in range(warmup, n):
        ts = bars.ts[i]
        day = ts // 86400
        if day != current_day:
            current_day, trades_today = day, 0

        # 1. Fill a signal from the previous bar's close at this bar's open.
        if pending_side is not None and open_trade is None:
            entry = bars.open[i]
            open_trade = BacktestTrade(
                side=pending_side, entry_ts=ts, entry_price=entry, lots=lots
            )
            direction = 1.0 if pending_side == "buy" else -1.0
            sl_price = entry * (1 - direction * sl_pct / 100.0) if sl_pct else None
            tp_price = entry * (1 + direction * tp_pct / 100.0) if tp_pct else None
            trades_today += 1
        pending_side = None

        # 2. Manage the open position within this bar.
        if open_trade is not None:
            if open_trade.side == "buy":
                if sl_price is not None and bars.low[i] <= sl_price:
                    _close(open_trade, sl_price, ts, "stop_loss")
                elif tp_price is not None and bars.high[i] >= tp_price:
                    _close(open_trade, tp_price, ts, "take_profit")
            else:
                if sl_price is not None and bars.high[i] >= sl_price:
                    _close(open_trade, sl_price, ts, "stop_loss")
                elif tp_price is not None and bars.low[i] <= tp_price:
                    _close(open_trade, tp_price, ts, "take_profit")
        if open_trade is not None and exit_signal(dsl, bars, i, open_trade.side):
            _close(open_trade, bars.close[i], ts, "exit_rule")

        # 3. New entry signal on this bar's close → fills next bar.
        if open_trade is None and trades_today < dsl.risk.max_trades_per_day:
            sig = entry_signal(dsl, bars, i)
            if sig is not None:
                pending_side = sig

        # 4. Mark-to-market equity point.
        float_pnl = 0.0
        if open_trade is not None:
            direction = 1.0 if open_trade.side == "buy" else -1.0
            float_pnl = (
                (bars.close[i] - open_trade.entry_price)
                * direction * open_trade.lots * contract_size
            )
        equity_curve.append({"ts": ts, "equity": round(balance + float_pnl, 2)})

    # Close any dangling position at the last close so stats are complete.
    if open_trade is not None:
        _close(open_trade, bars.close[n - 1], bars.ts[n - 1], "end_of_data")
        equity_curve[-1] = {"ts": bars.ts[n - 1], "equity": round(balance, 2)}

    wins = [t for t in trades if t.pnl > 0]
    losses = [t for t in trades if t.pnl <= 0]
    gross_profit = sum(t.pnl for t in wins)
    gross_loss = abs(sum(t.pnl for t in losses))
    net = gross_profit - gross_loss

    peak, max_dd = -math.inf, 0.0
    for point in equity_curve:
        peak = max(peak, point["equity"])
        if peak > 0:
            max_dd = max(max_dd, (peak - point["equity"]) / peak * 100.0)

    stats = {
        "total_trades": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(len(wins) / len(trades) * 100.0, 2) if trades else 0.0,
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "net_profit": round(net, 2),
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else None,
        "max_drawdown_pct": round(max_dd, 2),
        "return_pct": round(net / initial_balance * 100.0, 2),
        "start_ts": bars.ts[warmup],
        "end_ts": bars.ts[n - 1],
        "bars_used": n - warmup,
        "initial_balance": initial_balance,
        "final_balance": round(balance, 2),
    }

    return BacktestResult(
        stats=stats,
        equity_curve=equity_curve,
        trades=[t.__dict__ for t in trades],
    )
