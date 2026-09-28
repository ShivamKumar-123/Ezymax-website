---
slug: "p6-t-backtesting-method"
title: "Backtesting method"
summary: "How to run an honest backtest in Developer, Backtests: choosing the date range, modelling costs, splitting data, getting enough trades and avoiding the biases that make results look better than reality."
order: 4
version: 1
takeaways:
  - "A backtest applies fixed rules to historical data to estimate how a strategy would have behaved, and it is only as honest as its assumptions."
  - "Use a date range that covers several market regimes, and keep a final slice of data untouched as an out-of-sample test."
  - "Model realistic costs: spread, commission, slippage and swaps can turn a small gross edge into a net loss."
  - "Look-ahead bias, survivorship bias and intrabar ambiguity are the most common ways backtests overstate results."
  - "You need enough trades, typically well over 100, before the results say anything reliable about a small edge."
quiz:
  - question: "A strategy averages 2.5 pips gross per trade on EURUSD. Spread is 1.0 pip, commission is equivalent to 0.7 pips and slippage averages 0.3 pips. What is the net average per trade?"
    options:
      - "2.5 pips"
      - "1.5 pips"
      - "0.5 pips"
      - "-0.5 pips"
    answer: 2
    explanation: "Total cost = 1.0 + 0.7 + 0.3 = 2.0 pips. Net = 2.5 - 2.0 = 0.5 pips per trade. Costs consume 80% of the gross edge."
  - question: "Which is an example of look-ahead bias?"
    options:
      - "Testing over five years instead of one"
      - "Using the daily high to decide an entry at the daily open on the same day"
      - "Including commission in the backtest"
      - "Using ATR to size positions"
    answer: 1
    explanation: "The daily high is only known when the day ends. Using it to make a decision at the open uses information that was not available at the time, so the results are impossible to reproduce live."
  - question: "Why should part of the historical data be kept aside and not used while developing the strategy?"
    options:
      - "To make the backtest run faster"
      - "Because Kalks limits the number of backtests"
      - "Because old data is always wrong"
      - "So there is an untouched out-of-sample period to check whether the strategy works on data it was not fitted to"
    answer: 3
    explanation: "Any data you look at while designing becomes in-sample. An untouched slice gives an honest check of whether the rules generalise beyond the period used to build them."
  - question: "A backtest on a basket of US stocks includes only companies that are in the index today. Which bias does this introduce?"
    options:
      - "Survivorship bias"
      - "Look-ahead bias"
      - "Recency bias"
      - "Confirmation bias"
    answer: 0
    explanation: "Companies that failed or were removed from the index are missing, so the test only includes survivors. This tends to overstate the results of long strategies."
---

A backtest is an experiment: apply fixed rules to historical data and record what would have happened. Done well, it tells you whether an idea is worth more work. Done carelessly, it produces beautiful equity curves that collapse the moment real money is involved. In Kalks, backtests are run from the Client Area under **Developer**, then **Backtests**, using a strategy saved in the strategy builder. This chapter covers the method that makes the result worth reading.

## Start with a hypothesis

Before running anything, write down what you expect and why. For example: "EURUSD pullbacks to the 50 EMA in an uptrend on H1 resume the trend often enough that a 2R target has positive expectancy after costs." A hypothesis gives the test a purpose and protects you from running endless variations until something happens to look good.

Also decide in advance what result would make you abandon the idea. If you only define success after seeing results, every test becomes a success.

## Choosing the date range

The date range should include different market conditions: trending and ranging periods, low and high volatility, calm and stressed regimes. A strategy tested only in a strong trend will look like a trend strategy genius; a strategy tested only in a quiet range may fall apart in the first volatility spike.

A practical approach is to use several years of data and split it:

| Period | Use | Rule |
|---|---|---|
| Earlier 70% of the range | In-sample: design and adjust | You may look and change rules |
| Final 30% of the range | Out-of-sample: final check | Run once at the end; no changes afterwards |

For example, with data from January 2019 to December 2025, you might develop on 2019 to 2023 and hold back 2024 and 2025. The out-of-sample test is worth running only once. If you look at it, adjust the rules and run it again, it has become in-sample data.

## Modelling costs honestly

Small edges are fragile, and costs are where most of them disappear. Set the backtest's costs to what you would actually pay on your account type.

- **Spread.** Use a realistic average for the hours the strategy trades, not the tightest spread you have ever seen. Spreads widen after the New York close and around news.
- **Commission.** Some account types charge per lot round turn; include it.
- **Slippage.** Market and stop orders can fill worse than the trigger price, especially in fast markets.
- **Swaps.** Positions held past 00:00 server time pay or receive swap, with triple swap on Wednesday for FX and metals and on Friday for indices, energies and stocks.

```text
EURUSD strategy, 400 trades, average size 0.50 lots (5 USD per pip)

Average gross result per trade      3.0 pips
Spread                             -1.0 pips
Commission (7 USD per lot RT)      -0.7 pips
Slippage                           -0.3 pips
Average net result per trade        1.0 pips

Gross over 400 trades = 400 x 3.0 x 5 = 6,000 USD
Net over 400 trades   = 400 x 1.0 x 5 = 2,000 USD
Costs took two thirds of the gross profit.
```

Commission of 7 USD per lot round turn equals 0.7 pips on EURUSD because one pip on one lot is worth 10 USD. Short-term strategies with many trades and small targets are the most sensitive to these numbers. A useful stress test is to double your cost assumptions and see whether the strategy survives.

## The biases that flatter backtests

- **Look-ahead bias.** Using information that was not available at decision time, such as the day's high to decide an entry at the open, or an indicator value from a candle that had not yet closed.
- **Intrabar ambiguity.** On candle data, if both the stop and the target lie inside one candle's range, you cannot know which was hit first. Assume the worse outcome, or test on a lower timeframe or tick data if available.
- **Survivorship bias.** Testing stock strategies only on companies that exist today excludes those that went bankrupt or were removed from an index.
- **Data-snooping.** Testing hundreds of ideas on the same data guarantees that some look excellent by chance. The next chapter covers this in detail.
- **Unrealistic fills.** Assuming a limit order fills the instant price touches it; in reality, price often needs to trade through the level.

## How many trades are enough?

Results from a small sample are dominated by luck. As a rough guide, fewer than 30 trades tell you almost nothing, 100 trades begin to be useful, and several hundred are needed to estimate a small edge with any confidence. If a strategy produces only 20 trades a year, you need many years of data or several symbols with similar behaviour.

> **Example:** Two backtests of the same idea, one over 2023 only and one over 2019 to 2025. The first shows 34 trades and a profit factor of 2.1; the second shows 212 trades and a profit factor of 1.18. The second, less exciting number is the more reliable estimate. The first was most likely a favourable year.

## Recording the test

For every backtest, record the strategy version, symbol, timeframe, date range, cost assumptions, initial balance and sizing rule, alongside the results. Without this, you cannot compare tests or repeat them later.

> **Risk warning:** Backtest results are hypothetical. They do not include every real-world effect, they are based on the past, and they can overstate future performance. No backtest guarantees profits, and leveraged trading can produce losses larger than any historical drawdown.

## Common mistakes

- **Testing with zero or minimal costs.** Almost any short-term strategy looks good without costs.
- **Using the out-of-sample period more than once.** It then stops being out-of-sample.
- **One market, one year.** Results that hold only in one period are usually a description of that period.
- **Changing rules without logging the test count.** Every extra test increases the chance of a lucky result.
