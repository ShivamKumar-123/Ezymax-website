---
slug: "p6-t-building-in-the-strategy-builder"
title: "Building a strategy in the Ezymex strategy builder"
summary: "How to translate a written rule set into the Ezymex strategy builder under Client Area, Developer, Strategies, and check that the strategy does what you intended."
order: 3
version: 1
takeaways:
  - "The strategy builder, found in the Client Area under Developer and then Strategies, turns written rules into conditions on price and indicators, entries, exits, filters and position sizing."
  - "Always write the rules on paper first; the builder is for encoding a finished idea, not for inventing one by trial and error."
  - "Before any backtest, verify a handful of signals by hand on the chart to catch logic errors such as a wrong comparison or timeframe."
  - "Save each change as a new, clearly named version so you can compare results and never lose a working configuration."
practice:
  label: "Take the EURUSD trend-pullback rules from this chapter, find three recent signals by hand on the demo H1 chart, and record the entry, stop and target for each."
  symbol: "EURUSD"
quiz:
  - question: "Where in Ezymex do you build a rule-based strategy?"
    options:
      - "In the Client Area under Developer, then Strategies"
      - "In the Portfolio section under statements"
      - "In the Academy under Phase 6"
      - "In the Accounts section under leverage settings"
    answer: 0
    explanation: "The strategy builder is part of the Developer module in the Client Area. Backtests are run from Developer, then Backtests."
  - question: "Why should you check several signals by hand before running a backtest?"
    options:
      - "Because backtests do not use historical data"
      - "To choose the best-looking signals to keep"
      - "Because manual checks replace the need for a backtest"
      - "To confirm the builder's conditions match your written rules and catch errors such as a reversed comparison"
    answer: 3
    explanation: "A single reversed operator or wrong timeframe produces a completely different strategy. Checking a few signals by hand confirms that what you built is what you meant, before any results influence you."
  - question: "Balance 10,000 USD, risk 1%, stop = 1.5 x ATR with ATR 11 pips on EURUSD. What lot size should the sizing rule produce?"
    options:
      - "0.06 lots"
      - "0.60 lots"
      - "0.91 lots"
      - "1.65 lots"
    answer: 1
    explanation: "Stop = 16.5 pips. Size = 100 / (16.5 x 10 USD per pip per lot) = 0.606, rounded down to 0.60 lots."
  - question: "What is the main benefit of saving each modification as a new version?"
    options:
      - "It makes the strategy more profitable"
      - "It reduces the spread charged in backtests"
      - "It lets you compare results between versions and return to an earlier configuration"
      - "It is required to open a live account"
    answer: 2
    explanation: "Versioning keeps a record of what changed and when, so you can attribute differences in results to specific changes and roll back if a change makes things worse."
---

Once your rules are written, the next step is to encode them so they can be tested on history. In Ezymex, this happens in the **strategy builder**, found in the Client Area under **Developer**, then **Strategies**. The builder lets you express a strategy as a set of conditions on price and indicators, combined with entry, exit, filter and position-sizing rules, and then send it to **Developer**, then **Backtests**, for testing.

This chapter walks through the process in general terms. The exact layout of the screens may change as the platform develops, but the logic of building a strategy does not.

## Start from a written specification

The builder is a translation tool, not an idea generator. Opening it without a finished rule set invites trial and error: adding a condition here, changing a number there, until the backtest looks good. That is the fastest route to an overfitted strategy.

Before you open the builder, you should have a table like this one, based on the example system from the first chapter of this track:

| Block | Rule |
|---|---|
| Symbol and timeframe | EURUSD, H1 |
| Trading hours | Entries 08:00 to 19:00 server time |
| Filter | EMA(50) above EMA(200) |
| Setup | Candle low touched or went below EMA(50) within the last 3 candles |
| Entry trigger | RSI(14) crosses above 50 at candle close; buy at next open |
| Stop-loss | 1.5 x ATR(14) below entry |
| Take profit | 2 x stop distance |
| Time exit | Close after 48 candles |
| Position size | 1% of balance per trade |
| Limits | Maximum one open position on the symbol |

## Encoding the rules

Most builders, including Ezymex, organise a strategy into the same blocks you already know.

1. **General settings.** Choose the symbol and timeframe, and name the strategy clearly, for example `EURUSD-H1-pullback-v1`.
2. **Entry conditions.** Each condition compares two things: an indicator with a number, an indicator with another indicator, or price with an indicator. Conditions are combined with AND (all must be true) or OR (any may be true). For this system the long entry is: EMA(50) greater than EMA(200) AND the low of one of the last three candles at or below EMA(50) AND RSI(14) crossing above 50.
3. **Filters.** Add the trading-hours window here and any spread or volatility filters. Keeping filters separate from the entry trigger makes it easy to test with and without each one later.
4. **Exits.** Set the stop-loss as a multiple of ATR, the take profit as a multiple of the stop distance, and the time exit as a number of candles. If you use a trailing stop, specify how far it trails and when it activates.
5. **Position sizing.** Choose between a fixed lot size and a risk-based size. For testing an idea, risk-based sizing is usually more informative because every trade carries the same weight.
6. **Direction.** Decide whether the strategy trades long only, short only or both. If both, write the short rules as a mirror image and check them separately.

A detail worth attention is **"crosses above" versus "is above"**. "RSI is above 50" is true on every candle while RSI stays above 50, which could produce repeated entries. "RSI crosses above 50" is true only on the candle where it moves from below to above. Mixing them up is one of the most common builder errors.

## Verify by hand before you test

Before running a single backtest, find three to five signals manually on the chart in Ezymex Trader and compare them with what the strategy should do.

```text
Manual check of one signal, EURUSD H1

Signal candle: 14:00 H1 candle, closing at 15:00 server time
EMA(50) = 1.0862, EMA(200) = 1.0831   -> filter true
Low of 12:00 candle = 1.0859 <= EMA(50) -> setup true
RSI(14): previous 48.6, now 51.2      -> crosses above 50, trigger true

Entry at next open (15:00):   1.0866
ATR(14) = 0.0011 = 11 pips, stop = 1.5 x 11 = 16.5 pips
Stop-loss   = 1.0866 - 0.00165 = 1.08495
Take profit = 1.0866 + 2 x 0.00165 = 1.0866 + 0.0033 = 1.0899

Size: 1% of 10,000 = 100 USD
Lots = 100 / (16.5 x 10) = 0.606 -> 0.60 lots
```

If the builder's test later shows a different entry time, a different stop or no trade at all on that candle, something in the encoding does not match the rules. Fix it before looking at any performance figures. Once you have seen results, it becomes very tempting to keep a mistake that happens to look profitable.

> **Tip:** Check at least one long and one short signal, one signal near the edge of the trading-hours window, and one case where the setup appeared but the filter should have blocked it.

## Version control and documentation

Every time you change a rule or a parameter, save the result as a new version and write down what changed and why. A simple log is enough:

| Version | Change | Reason |
|---|---|---|
| v1 | Base rules as written | Initial idea |
| v2 | Added spread filter of 1.5 pips | Avoid entries in thin hours |
| v3 | Time exit changed from 48 to 24 candles | Hypothesis: stalled pullbacks rarely recover |

This log becomes crucial in the overfitting chapter. If you have tested 40 versions, the best one's results are far less trustworthy than if you had tested three, and you can only know how many you tested if you kept a record.

> **Risk warning:** A strategy that is built correctly can still lose money. The builder encodes your rules; it does not validate whether they have an edge. Treat every new strategy as unproven until it has passed backtesting and forward testing on a demo account.

## Common mistakes

- **Building before writing.** Designing in the builder turns strategy development into curve fitting.
- **Wrong timeframe on an indicator.** An RSI calculated on M15 inside an H1 strategy is a different system.
- **Confusing "is" and "crosses".** This changes both the number of trades and their timing.
- **Overwriting working versions.** Without history, you cannot tell which change helped and which hurt.
- **Skipping the short side check.** Mirror rules often contain a reversed comparison nobody noticed.
