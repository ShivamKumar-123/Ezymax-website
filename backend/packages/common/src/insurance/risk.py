"""RiskScore computation — leverage × volatility × trade-size factors."""
from __future__ import annotations


def leverage_factor(leverage: float) -> float:
    """Linear from 1.0 @ 10× leverage up to 1.5 @ 500×, clamped."""
    if leverage <= 10:
        return 1.0
    if leverage >= 500:
        return 1.5
    return 1.0 + (leverage - 10) * (0.5 / 490)


def volatility_factor(atr: float) -> float:
    """Linear from 0.8 @ atr=0.0005 up to 2.0 @ atr=0.005, clamped."""
    if atr <= 0.0005:
        return 0.8
    if atr >= 0.005:
        return 2.0
    return 0.8 + (atr - 0.0005) * (1.2 / 0.0045)


def trade_size_factor(lots: float) -> float:
    """Linear from 0.8 @ 0.01 lot up to 1.2 @ 5+ lots, clamped."""
    if lots <= 0.01:
        return 0.8
    if lots >= 5:
        return 1.2
    return 0.8 + (lots - 0.01) * (0.4 / 4.99)


def risk_score(leverage: float, atr: float, lots: float) -> float:
    return (
        leverage_factor(leverage)
        * volatility_factor(atr)
        * trade_size_factor(lots)
    )
