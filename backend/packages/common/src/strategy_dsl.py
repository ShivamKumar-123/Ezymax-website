"""AI Strategy DSL — schema, indicators, and signal evaluation.

The AI strategy builder NEVER generates or executes code. The LLM (and the
user, via the JSON editor) produces a *declarative* strategy definition that
validates against the Pydantic schema below; this module evaluates it
deterministically over OHLC bars. Execution then goes through the canonical
trading_service.place_order / close_position paths — the strategy layer only
decides *when*, never *how*, a trade happens.

Everything here is pure (no I/O): indicator math over float lists, and
condition evaluation at a bar index. Both the backtester and the live engine
call the same evaluate_* functions so backtest and live behavior can't drift.
"""
from __future__ import annotations

import math
from typing import Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator

# ─── Schema ───────────────────────────────────────────────────────────────

ALLOWED_TIMEFRAMES = ("5m", "15m", "30m", "1h", "4h", "1d")

IndicatorName = Literal[
    "sma", "ema", "rsi", "macd", "macd_signal", "atr", "bb_upper", "bb_lower"
]
PriceField = Literal["close", "open", "high", "low"]
Op = Literal[">", "<", "crosses_above", "crosses_below"]


class IndicatorOperand(BaseModel):
    type: Literal["indicator"]
    name: IndicatorName
    period: int = Field(default=14, ge=1, le=500)
    source: PriceField = "close"


class PriceOperand(BaseModel):
    type: Literal["price"]
    field: PriceField = "close"


class ConstOperand(BaseModel):
    type: Literal["const"]
    value: float


Operand = Union[IndicatorOperand, PriceOperand, ConstOperand]


class Condition(BaseModel):
    left: Operand
    op: Op
    right: Operand

    @model_validator(mode="after")
    def _crosses_need_series(self):
        # A constant can't "cross" anything meaningfully on the left side.
        if self.op in ("crosses_above", "crosses_below") and self.left.type == "const":
            raise ValueError("crosses_* requires a series (indicator/price) on the left")
        return self


class ConditionGroup(BaseModel):
    """`all` = AND, `any` = OR. Exactly one must be provided."""
    all: Optional[list[Condition]] = None
    any: Optional[list[Condition]] = None

    @model_validator(mode="after")
    def _exactly_one(self):
        if bool(self.all) == bool(self.any):
            raise ValueError("condition group needs exactly one of 'all' or 'any'")
        conds = self.all or self.any
        if len(conds) > 8:
            raise ValueError("at most 8 conditions per group")
        return self


class RiskConfig(BaseModel):
    lots: float = Field(default=0.01, gt=0, le=100)
    # Percent of entry price. Percent (not pips) so the same DSL works across
    # forex, metals, indices, and crypto without per-symbol pip tables.
    stop_loss_pct: Optional[float] = Field(default=None, gt=0, le=50)
    take_profit_pct: Optional[float] = Field(default=None, gt=0, le=100)
    max_open_positions: int = Field(default=1, ge=1, le=10)
    max_trades_per_day: int = Field(default=10, ge=1, le=100)


class StrategyDSL(BaseModel):
    symbol: str = Field(min_length=2, max_length=20)
    timeframe: str
    direction: Literal["long", "short", "both"] = "both"
    entry_long: Optional[ConditionGroup] = None
    entry_short: Optional[ConditionGroup] = None
    exit_long: Optional[ConditionGroup] = None
    exit_short: Optional[ConditionGroup] = None
    risk: RiskConfig = Field(default_factory=RiskConfig)

    @field_validator("symbol")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("timeframe")
    @classmethod
    def _tf(cls, v: str) -> str:
        if v not in ALLOWED_TIMEFRAMES:
            raise ValueError(f"timeframe must be one of {ALLOWED_TIMEFRAMES}")
        return v

    @model_validator(mode="after")
    def _entries_match_direction(self):
        if self.direction in ("long", "both") and self.entry_long is None:
            raise ValueError("direction includes long but entry_long is missing")
        if self.direction in ("short", "both") and self.entry_short is None:
            raise ValueError("direction includes short but entry_short is missing")
        if self.risk.stop_loss_pct is None and self.exit_long is None and self.exit_short is None:
            raise ValueError(
                "strategy has no exit: set risk.stop_loss_pct/take_profit_pct "
                "or an exit_long/exit_short condition group"
            )
        return self

    def warmup_bars(self) -> int:
        """Bars needed before the first valid signal (longest indicator period)."""
        longest = 1
        for group in (self.entry_long, self.entry_short, self.exit_long, self.exit_short):
            if not group:
                continue
            for cond in (group.all or group.any or []):
                for operand in (cond.left, cond.right):
                    if isinstance(operand, IndicatorOperand):
                        p = operand.period
                        if operand.name in ("macd", "macd_signal"):
                            p = 26 + 9  # slow EMA + signal
                        longest = max(longest, p)
        return longest + 5  # small safety margin


# ─── Indicators (pure, full-series) ───────────────────────────────────────
# All return a list aligned with the input; positions before the indicator is
# defined hold nan.

def _nan_list(n: int) -> list[float]:
    return [math.nan] * n


def sma(values: list[float], period: int) -> list[float]:
    out = _nan_list(len(values))
    acc = 0.0
    for i, v in enumerate(values):
        acc += v
        if i >= period:
            acc -= values[i - period]
        if i >= period - 1:
            out[i] = acc / period
    return out


def ema(values: list[float], period: int) -> list[float]:
    out = _nan_list(len(values))
    if len(values) < period:
        return out
    k = 2.0 / (period + 1)
    seed = sum(values[:period]) / period
    out[period - 1] = seed
    for i in range(period, len(values)):
        out[i] = values[i] * k + out[i - 1] * (1 - k)
    return out


def rsi(values: list[float], period: int) -> list[float]:
    out = _nan_list(len(values))
    if len(values) <= period:
        return out
    gains = losses = 0.0
    for i in range(1, period + 1):
        d = values[i] - values[i - 1]
        gains += max(d, 0.0)
        losses += max(-d, 0.0)
    avg_gain, avg_loss = gains / period, losses / period
    out[period] = 100.0 if avg_loss == 0 else 100.0 - 100.0 / (1 + avg_gain / avg_loss)
    for i in range(period + 1, len(values)):
        d = values[i] - values[i - 1]
        avg_gain = (avg_gain * (period - 1) + max(d, 0.0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-d, 0.0)) / period
        out[i] = 100.0 if avg_loss == 0 else 100.0 - 100.0 / (1 + avg_gain / avg_loss)
    return out


def macd_lines(values: list[float]) -> tuple[list[float], list[float]]:
    """Standard 12/26/9 MACD. Returns (macd, signal)."""
    fast, slow = ema(values, 12), ema(values, 26)
    macd = [
        f - s if not (math.isnan(f) or math.isnan(s)) else math.nan
        for f, s in zip(fast, slow)
    ]
    # Signal: EMA(9) of macd, starting where macd becomes defined.
    first = next((i for i, v in enumerate(macd) if not math.isnan(v)), None)
    signal = _nan_list(len(values))
    if first is not None:
        tail = ema(macd[first:], 9)
        for j, v in enumerate(tail):
            signal[first + j] = v
    return macd, signal


def atr(highs: list[float], lows: list[float], closes: list[float], period: int) -> list[float]:
    out = _nan_list(len(closes))
    if len(closes) <= period:
        return out
    trs = [highs[0] - lows[0]]
    for i in range(1, len(closes)):
        trs.append(max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        ))
    acc = sum(trs[1:period + 1]) / period
    out[period] = acc
    for i in range(period + 1, len(closes)):
        acc = (acc * (period - 1) + trs[i]) / period
        out[i] = acc
    return out


def bollinger(values: list[float], period: int, mult: float = 2.0) -> tuple[list[float], list[float]]:
    """Returns (upper, lower) bands."""
    mid = sma(values, period)
    upper, lower = _nan_list(len(values)), _nan_list(len(values))
    for i in range(period - 1, len(values)):
        window = values[i - period + 1:i + 1]
        m = mid[i]
        var = sum((v - m) ** 2 for v in window) / period
        sd = math.sqrt(var)
        upper[i], lower[i] = m + mult * sd, m - mult * sd
    return upper, lower


# ─── Series resolution & evaluation ──────────────────────────────────────

class Bars:
    """Column-oriented bar container with a per-instance indicator cache."""

    def __init__(self, bars: list[dict]):
        self.ts = [int(b["time"]) for b in bars]
        self.open = [float(b["open"]) for b in bars]
        self.high = [float(b["high"]) for b in bars]
        self.low = [float(b["low"]) for b in bars]
        self.close = [float(b["close"]) for b in bars]
        self._cache: dict[tuple, list[float]] = {}

    def __len__(self) -> int:
        return len(self.ts)

    def _source(self, field: str) -> list[float]:
        return getattr(self, field)

    def series(self, operand: Operand) -> Optional[list[float]]:
        """Full series for an operand; None for constants."""
        if isinstance(operand, ConstOperand):
            return None
        if isinstance(operand, PriceOperand):
            return self._source(operand.field)
        key = (operand.name, operand.period, operand.source)
        if key in self._cache:
            return self._cache[key]
        src = self._source(operand.source)
        if operand.name == "sma":
            out = sma(src, operand.period)
        elif operand.name == "ema":
            out = ema(src, operand.period)
        elif operand.name == "rsi":
            out = rsi(src, operand.period)
        elif operand.name in ("macd", "macd_signal"):
            macd, signal = macd_lines(src)
            self._cache[("macd", operand.period, operand.source)] = macd
            self._cache[("macd_signal", operand.period, operand.source)] = signal
            out = macd if operand.name == "macd" else signal
        elif operand.name == "atr":
            out = atr(self.high, self.low, self.close, operand.period)
        elif operand.name in ("bb_upper", "bb_lower"):
            upper, lower = bollinger(src, operand.period)
            self._cache[("bb_upper", operand.period, operand.source)] = upper
            self._cache[("bb_lower", operand.period, operand.source)] = lower
            out = upper if operand.name == "bb_upper" else lower
        else:  # pragma: no cover — schema forbids
            raise ValueError(f"unknown indicator {operand.name}")
        self._cache[key] = out
        return out

    def value_at(self, operand: Operand, i: int) -> float:
        if isinstance(operand, ConstOperand):
            return operand.value
        return self.series(operand)[i]


def _eval_condition(bars: Bars, cond: Condition, i: int) -> bool:
    lv = bars.value_at(cond.left, i)
    rv = bars.value_at(cond.right, i)
    if math.isnan(lv) or math.isnan(rv):
        return False
    if cond.op == ">":
        return lv > rv
    if cond.op == "<":
        return lv < rv
    # crosses: need previous values too
    if i == 0:
        return False
    lp = bars.value_at(cond.left, i - 1)
    rp = bars.value_at(cond.right, i - 1)
    if math.isnan(lp) or math.isnan(rp):
        return False
    if cond.op == "crosses_above":
        return lp <= rp and lv > rv
    if cond.op == "crosses_below":
        return lp >= rp and lv < rv
    return False  # pragma: no cover


def eval_group(bars: Bars, group: Optional[ConditionGroup], i: int) -> bool:
    if group is None:
        return False
    if group.all is not None:
        return all(_eval_condition(bars, c, i) for c in group.all)
    return any(_eval_condition(bars, c, i) for c in group.any)


def entry_signal(dsl: StrategyDSL, bars: Bars, i: int) -> Optional[str]:
    """Returns 'buy', 'sell', or None for the bar at index i (evaluated on close)."""
    if dsl.direction in ("long", "both") and eval_group(bars, dsl.entry_long, i):
        return "buy"
    if dsl.direction in ("short", "both") and eval_group(bars, dsl.entry_short, i):
        return "sell"
    return None


def exit_signal(dsl: StrategyDSL, bars: Bars, i: int, side: str) -> bool:
    """True when the DSL's exit conditions fire for an open position side."""
    group = dsl.exit_long if side == "buy" else dsl.exit_short
    return eval_group(bars, group, i)
