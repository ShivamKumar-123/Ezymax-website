---
slug: "p6-t-entry-exit-filter-rules"
title: "Writing rules for entries, exits and filters"
summary: "How to turn setups into unambiguous conditions, choose entry and exit mechanics, add filters that earn their place, and attach a position-sizing rule."
order: 2
version: 1
takeaways:
  - "Good rules are objective, evaluated at a defined moment (usually the candle close) and executed with a defined order type."
  - "Entries fall into three families, breakout, pullback and reversal, and each needs a matching exit logic."
  - "Exits usually matter more than entries: define the stop-loss, profit exit and time exit before you test anything."
  - "A filter should remove trades that are worse than average; if it only removes trades at random, it adds complexity without value."
  - "Position size should be derived from the stop distance so every trade risks the same share of the account."
practice:
  label: "On a demo XAUUSD M15 chart, mark the Asian-session high and low for the last five days and note how often London broke each side first."
  symbol: "XAUUSD"
quiz:
  - question: "Why do most systematic rules evaluate conditions on the candle close rather than while the candle is forming?"
    options:
      - "Because spreads are always zero at the close"
      - "Because it guarantees a better entry price"
      - "Because closing prices are never used in backtests"
      - "Because an indicator can cross a level intrabar and then uncross before the close, creating signals that never really existed"
    answer: 3
    explanation: "Intrabar values change until the candle closes. Evaluating at the close makes each signal final and reproducible, which is essential for honest backtesting."
  - question: "Account balance 10,000 USD, risk 1% per trade. The EURUSD stop is 1.5 x ATR, and ATR(14) is 0.0012. What is the position size?"
    options:
      - "0.55 lots"
      - "0.18 lots"
      - "1.00 lot"
      - "5.50 lots"
    answer: 0
    explanation: "Stop = 1.5 x 12 pips = 18 pips. Risk = 100 USD. Pip value per lot on EURUSD = 10 USD. Size = 100 / (18 x 10) = 0.555, rounded down to 0.55 lots."
  - question: "Which exit fits a pullback-in-trend entry best?"
    options:
      - "A tight fixed target of 3 pips"
      - "No stop-loss, exit only when the trade is profitable"
      - "A stop below the pullback low and a trailing stop or a target near the prior high or beyond"
      - "Exit at a random time"
    answer: 2
    explanation: "A pullback entry expects the trend to resume, so it needs a stop where the pullback idea is invalidated and a profit exit that lets the resumed trend pay."
  - question: "You add a filter and the backtest shows fewer trades, but the average result per trade is unchanged. What does this suggest?"
    options:
      - "The filter has doubled the edge"
      - "The filter is removing trades roughly at random and adds little value"
      - "The filter must be kept because fewer trades always means lower risk"
      - "The backtest is broken"
    answer: 1
    explanation: "A useful filter removes trades that are worse than average, so expectancy per trade should improve. If it does not, the filter just reduces opportunity and adds a parameter to overfit."
---

In the previous chapter you saw that a system must answer a fixed set of questions. This chapter is about *how* to answer them well. The goal is rules that are objective, testable and sensible: objective so there is no doubt about what to do, testable so a strategy builder can apply them to history, and sensible so they reflect a real reason for price to behave the way you expect.

## Making conditions objective

A rule is objective when it can be written as a comparison: a value, an operator and a threshold.

| Vague | Objective |
|---|---|
| Market is trending up | Close above 200-period SMA and 50 EMA above 200 EMA |
| RSI looks oversold | RSI(14) below 30 at candle close |
| Price broke out | H1 close above the highest high of the previous 20 candles |
| Volatility is high | ATR(14) above its own 100-period average |

Two further details make rules reproducible.

- **When is the rule checked?** Most systems evaluate conditions at the **candle close**. An indicator can cross a level halfway through a candle and cross back before it closes; if your rule fires intrabar, the signal may never appear on the finished chart, and a backtest built on closed candles will not match what you would actually have done.
- **How is it executed?** A signal on the close is usually executed as a market order at the next candle's open, or as a pending order: a buy stop above a level for breakouts, or a buy limit below price for pullbacks. The order type changes your fill price and your costs, so specify it.

## Three families of entries

Most entries belong to one of three families. Each makes a different assumption about the market.

1. **Breakout.** Buy strength or sell weakness when price leaves a range, assuming movement will continue. Examples: breaking the high of the Asian session, a 20-candle high, or the upper Bollinger Band. Breakouts suit expanding volatility and often have lower win rates with larger winners.
2. **Pullback.** Wait for a counter-move within an established trend, then enter as the trend resumes. Examples: a touch of a moving average followed by a bullish close, or RSI dipping below 40 and recovering in an uptrend.
3. **Reversal or mean reversion.** Fade stretched moves, assuming price returns towards an average. Examples: RSI extremes at the edges of a range, or price outside a Bollinger Band in a flat market. These often have higher win rates and smaller winners, and they are dangerous in strong trends.

> **Example:** A London breakout rule on XAUUSD: at 09:00 server time, place a buy stop 0.50 above the Asian-session high and a sell stop 0.50 below the low, as an OCO pair. The high is 2,352.10 and the low is 2,341.60, so the buy stop is at 2,352.60 with its stop-loss at the range low, 2,341.60, a distance of 11.00. One lot is 100 oz, so 11.00 x 100 = 1,100 USD per lot. Risking 100 USD gives 100 / 1,100 = 0.09 lots after rounding down.

## Exits: where most of the edge lives

Two traders with identical entries and different exits can have completely different results. Define exits before you test.

- **Stop-loss.** Placed where the trade idea is proven wrong: beyond the pullback low, the other side of the range, or a multiple of ATR. Volatility-based stops adapt automatically to changing conditions.
- **Profit exit.** A fixed target in R (for example 2R), a structural target such as the previous swing high, a trailing stop that follows price, or an opposite signal. Breakout and trend systems usually benefit from trailing exits that let big winners run; mean-reversion systems usually use fixed targets near the average.
- **Time exit.** Close trades that have not worked after a set number of candles. Capital tied up in a stagnant trade is capital not available for the next signal, and dead trades often turn into losers.
- **Partial exits.** Closing half at 1R and trailing the rest is common. It smooths results but reduces the average winner; test both versions.

Also decide what happens when both the stop and target fall inside the same candle. Historical candles do not show which was hit first, so a conservative assumption is that the stop was hit.

## Filters that earn their place

A filter should switch the system off in conditions where its setups do worse than average. Useful categories:

- **Trend filters** for pullback and breakout systems, such as trading only in the direction of the 200-period moving average.
- **Volatility filters**, such as skipping trades when ATR is unusually low (breakouts fail) or extremely high (stops are too wide).
- **Session filters**, such as avoiding the thin hours after the New York close when spreads widen.
- **News filters**, such as blocking entries around high-impact releases on the economic calendar.
- **Spread filters**, such as not entering if the current spread exceeds a set maximum.

Test every filter by what it removes. If the trades removed were no worse than the trades kept, the filter does nothing except add a parameter that can be overfitted.

## Sizing rules

The last rule converts the signal into lots. A fixed-fractional rule keeps risk constant:

```text
Account 10,000 USD, risk 1% = 100 USD
EURUSD ATR(14) = 0.0012 = 12 pips, stop = 1.5 x ATR = 18 pips
Pip value per standard lot = 10 USD

Lots = 100 / (18 x 10) = 0.555 -> round down to 0.55 lots
Actual risk = 0.55 x 18 x 10 = 99 USD
```

Always round down, and remember that minimum lot size is 0.01. If the calculated size is below the minimum, skip the trade rather than increasing the risk.

> **Risk warning:** Rules control your decisions, not the market. Gaps, slippage and widening spreads can make real losses larger than the stop-loss implies, especially on leveraged CFD positions held through news or weekends.

## Common mistakes

- **Mixing families.** A reversal entry with a trend-following trailing exit, or a breakout entry with a tiny fixed target, usually combines the weaknesses of both.
- **Undefined order type.** "Buy on the breakout" without saying market, stop or limit leaves the fill price to chance.
- **Filters added after looking at losing trades.** Removing specific past losers is curve fitting, not filtering.
- **Sizing by feel.** A fixed lot size means the risk changes with every stop distance.
