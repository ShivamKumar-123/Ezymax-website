---
slug: "p6-t-performance-metrics"
title: "Reading performance metrics"
summary: "How to read the numbers in a backtest report, including net profit, win rate, profit factor, expectancy, drawdown and risk-adjusted return, and which ones matter most."
order: 6
version: 1
takeaways:
  - "No single metric is enough; read profitability, risk and reliability together."
  - "Expectancy and profit factor tell you whether there is an edge, while win rate on its own tells you almost nothing."
  - "Maximum drawdown and the longest losing streak tell you whether you could survive and keep following the strategy."
  - "Always check the number of trades and whether a few outliers produce most of the profit."
practice:
  label: "Export or review your last 30 demo trades in the Portfolio section and calculate win rate, average win, average loss, profit factor and expectancy by hand."
  symbol: "EURUSD"
quiz:
  - question: "A backtest has gross profit of 9,000 USD and gross loss of 7,500 USD. What is the profit factor?"
    options:
      - "0.83"
      - "16.5"
      - "1.50"
      - "1.20"
    answer: 3
    explanation: "Profit factor = gross profit / gross loss = 9,000 / 7,500 = 1.20. Net profit would be 1,500 USD."
  - question: "Equity peaks at 24,000 USD and later falls to 20,400 USD before recovering. What is the maximum drawdown in percent?"
    options:
      - "15.0%"
      - "3.6%"
      - "17.6%"
      - "85.0%"
    answer: 0
    explanation: "Drawdown = (24,000 - 20,400) / 24,000 = 3,600 / 24,000 = 15.0%. It is measured from the peak, not from the trough."
  - question: "Strategy X wins 70% of trades; strategy Y wins 35%. What can you conclude?"
    options:
      - "X is more profitable"
      - "Y is losing money"
      - "Nothing about profitability, without knowing average win and average loss"
      - "X has a lower drawdown"
    answer: 2
    explanation: "Win rate must be combined with the size of wins and losses. A 35% win rate with 3R winners is profitable; a 70% win rate with small wins and large losses can lose."
  - question: "Net profit is 5,000 USD over 150 trades, but the two largest trades made 4,600 USD. What is the main concern?"
    options:
      - "The strategy has too many trades"
      - "Results depend on rare outliers, so the edge is fragile"
      - "The profit factor must be below 1"
      - "There is no concern"
    answer: 1
    explanation: "Without those two trades the strategy made 400 USD over 148 trades. Missing or changing just a couple of trades in the future would erase most of the result."
---

A backtest report is a page full of numbers. Some of them tell you whether the strategy has an edge, some tell you what it would feel like to trade, and some tell you whether you can trust the rest. This chapter explains the key metrics you will see after a run in Developer, then Backtests, how they are calculated, and how to read them together rather than falling for one attractive figure.

## Profitability: is there an edge?

Start with the numbers that describe the edge itself. Here is a complete worked example from a 120-trade backtest on a 10,000 USD account.

```text
Trades: 120   Winners: 48   Losers: 72

Win rate          = 48 / 120                 = 40.0%
Average win       = 150 USD
Average loss      =  80 USD
Gross profit      = 48 x 150                 = 7,200 USD
Gross loss        = 72 x 80                  = 5,760 USD
Net profit        = 7,200 - 5,760            = 1,440 USD (+14.4%)
Profit factor     = 7,200 / 5,760            = 1.25
Payoff ratio      = 150 / 80                 = 1.875
Expectancy        = 1,440 / 120              = 12 USD per trade
Check             = 0.40 x 150 - 0.60 x 80   = 60 - 48 = 12 USD
```

- **Net profit** is the bottom line, after costs if the test modelled them. It says nothing about the risk taken to earn it.
- **Win rate** is the share of winning trades. On its own it is almost meaningless: trend-following systems often win 35% to 45% of the time and are profitable, while some mean-reversion systems win 70% and still lose.
- **Payoff ratio** is average win divided by average loss. Win rate and payoff ratio must be read together.
- **Profit factor** is gross profit divided by gross loss. Below 1.0 the strategy loses money. Many traders treat values between about 1.2 and 2.0 over a large sample as realistic; much higher figures often point to overfitting or too few trades.
- **Expectancy** is the average result per trade. Expressed in R (divide by the amount risked), it lets you compare strategies with different position sizes. If this strategy risked 80 USD per trade, expectancy is 12 / 80 = 0.15R.

## Risk: what would it feel like?

A strategy you cannot follow through its bad periods is worthless to you, whatever its long-run numbers.

```svg
<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" font-family="Inter, Arial, sans-serif">
  <rect width="100%" height="100%" fill="#121216"/>
  <text x="20" y="26" fill="#c9c9d1" font-size="14">Equity curve and maximum drawdown (illustrative)</text>
  <line x1="80" y1="40" x2="80" y2="220" stroke="#3a3a44"/>
  <line x1="80" y1="220" x2="620" y2="220" stroke="#3a3a44"/>
  <text x="20" y="224" fill="#c9c9d1" font-size="12">10,000</text>
  <text x="20" y="144" fill="#c9c9d1" font-size="12">11,000</text>
  <text x="20" y="64" fill="#c9c9d1" font-size="12">12,000</text>
  <line x1="80" y1="140" x2="620" y2="140" stroke="#3a3a44" stroke-dasharray="4 4"/>
  <polyline fill="none" stroke="#c9c9d1" stroke-width="2" points="80,220 120,205 160,190 200,196 240,160 280,130 320,100 350,76 380,110 410,140 440,158 470,170 500,150 530,128 560,118 590,110 620,105"/>
  <line x1="350" y1="76" x2="470" y2="76" stroke="#ef4444" stroke-dasharray="4 3"/>
  <line x1="470" y1="76" x2="470" y2="170" stroke="#ef4444"/>
  <circle cx="350" cy="76" r="4" fill="#22c55e"/>
  <circle cx="470" cy="170" r="4" fill="#ef4444"/>
  <text x="300" y="66" fill="#22c55e" font-size="12">Peak 11,800</text>
  <text x="480" y="186" fill="#ef4444" font-size="12">Trough 10,620</text>
  <text x="480" y="124" fill="#ef4444" font-size="12">Max drawdown</text>
  <text x="480" y="140" fill="#ef4444" font-size="12">1,180 = 10.0%</text>
  <text x="560" y="96" fill="#c9c9d1" font-size="12">End 11,440</text>
  <text x="300" y="248" fill="#c9c9d1" font-size="12">Trades (1 to 120)</text>
</svg>
```

- **Maximum drawdown** is the largest fall from an equity peak to a subsequent low. In the chart, equity peaks at 11,800 and falls to 10,620: a drawdown of 1,180 USD, or 1,180 / 11,800 = 10.0%. Remember from the risk-management phase that recovery requires more than the loss: a 10% drawdown needs an 11.1% gain to get back to the peak.
- **Longest losing streak** tells you how many losses in a row you must be ready to sit through. At a 40% win rate, streaks of 8 to 10 losses are normal over a few hundred trades.
- **Drawdown duration** is how long equity stayed below a previous peak. Months without a new high are psychologically much harder than the percentage suggests.
- **Recovery factor** is net profit divided by maximum drawdown: 1,440 / 1,180 = 1.22 here. It shows how much the strategy earned relative to its worst pain.

Expect live drawdowns to be larger than the backtest's maximum. The historical maximum is one path; the future will be another, and it is sensible to plan for at least one and a half to two times the tested figure.

## Risk-adjusted return

The **Sharpe ratio** compares the average return with its variability: roughly, excess return divided by the standard deviation of returns, usually annualised. A higher figure means smoother returns for the same profit. It treats upside and downside volatility equally, so some traders also look at the **Sortino ratio**, which only penalises downside volatility. For comparing two versions of a strategy, the simple ratio of annual return to maximum drawdown is often clear enough: here 14.4% / 10.0% = 1.44.

## Reliability: can you trust the numbers?

- **Number of trades.** 120 trades is a modest sample; the true expectancy could easily be well above or below 12 USD.
- **Concentration.** Remove the two or three largest winners and recalculate. If the strategy becomes a loser, the edge depends on rare events.
- **Consistency across time.** Split results by year or by quarter. A strategy that made all its money in one period is describing that period.
- **Consistency across markets.** Does the same logic work, even modestly, on related symbols such as GBPUSD or AUDUSD?
- **Exposure.** The percentage of time a position is open. Low exposure with good returns is efficient; high exposure means more swap costs and more weekend gap risk.

> **Risk warning:** All metrics in a backtest report are based on historical, hypothetical trades. They describe the past under the test's assumptions and do not guarantee future performance. Leveraged CFD trading can produce drawdowns larger than any tested figure.

## Common mistakes

- **Optimising for net profit alone.** The highest-profit version is often the one with the deepest drawdown or the most overfitting.
- **Chasing a high win rate.** It often comes from small targets and wide stops, with occasional large losses.
- **Ignoring the sample size.** Excellent metrics on 25 trades are anecdotes, not evidence.
- **Assuming the maximum drawdown is the worst case.** It is only the worst case that happened in that sample.
