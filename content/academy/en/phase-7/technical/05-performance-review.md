---
slug: "p7-t-performance-review"
title: "Reviewing performance statistics"
summary: "How to calculate and interpret win rate, expectancy, profit factor and drawdown from your journal, and how to segment results to find what really works."
order: 5
version: 1
takeaways:
  - "Win rate means little on its own; expectancy combines win rate with average win and loss to show whether a strategy makes money per trade."
  - "Profit factor, average R and maximum drawdown together describe both the edge and the pain of trading it."
  - "Segmenting results by setup, session, symbol and grade reveals which parts of your trading carry the edge and which drain it."
  - "Small samples are dominated by luck, so decisions should wait for enough trades in each segment."
  - "A review should end with one or two specific changes to the plan, recorded and tested, not a long list of resolutions."
practice:
  label: "Export your demo trade history from the Client Area Portfolio, add setup tags and R results, and calculate win rate, expectancy and profit factor for each setup."
  symbol: "EURUSD"
quiz:
  - question: "A strategy wins 40% of trades with an average win of +2.1R and an average loss of -1.0R. What is its expectancy per trade?"
    options:
      - "+0.84R"
      - "+0.24R"
      - "-0.20R"
      - "+1.10R"
    answer: 1
    explanation: "Expectancy = 0.40 x 2.1 - 0.60 x 1.0 = 0.84 - 0.60 = +0.24R. The 0.84R figure ignores the losing trades."
  - question: "Gross profit across all winning trades is 50.4R and gross loss across all losing trades is 36R. What is the profit factor?"
    options:
      - "0.71"
      - "14.4"
      - "1.40"
      - "86.4"
    answer: 2
    explanation: "Profit factor = gross profit / gross loss = 50.4 / 36 = 1.40. 14.4R is the net result, not a ratio."
  - question: "One setup shows +3.0R expectancy over 6 trades. What is the most sensible conclusion?"
    options:
      - "Promising but unproven; the sample is too small to separate skill from luck"
      - "Double the risk on this setup immediately"
      - "Drop all other setups"
      - "The setup is guaranteed to stay profitable"
    answer: 0
    explanation: "Six trades can easily produce extreme averages by chance. Keep trading it at normal risk and review again after a meaningful sample."
  - question: "Why is win rate alone a poor measure of a strategy?"
    options:
      - "Win rate cannot be calculated from a journal"
      - "A high win rate always means small profits"
      - "Brokers do not report win rate"
      - "A high win rate can hide a few large losses that outweigh many small wins"
    answer: 3
    explanation: "A strategy that wins 80% of the time for +0.2R and loses 20% for -1.5R has negative expectancy. Size of wins and losses matters as much as frequency."
---

A journal full of trades is only useful if you turn it into decisions. The performance review is where that happens. Done well, it tells you whether you have an edge, where it comes from and what is draining it. Done badly, it becomes a hunt for reasons to change strategy after a bad week. This chapter builds on the metrics introduced in the strategy-design phase and applies them to your live or demo trading.

## The core statistics

Work in R, as described in the journaling chapter, so trades of different sizes and symbols are comparable.

| Metric | Formula | What it tells you |
|---|---|---|
| Win rate | Winning trades / total trades | How often you are right |
| Average win and loss | Mean R of winners and of losers | The size of typical outcomes |
| Expectancy | (Win rate x avg win) - (loss rate x avg loss) | Average R earned per trade |
| Profit factor | Gross profit / gross loss | Money made per unit lost; above 1.0 is profitable |
| Maximum drawdown | Largest peak-to-trough fall in equity | The pain you must be able to endure |
| Trade count | Number of trades in the sample | How much the other numbers can be trusted |

## A worked review

Suppose a quarter of demo trading produced 60 trades.

```text
Winners: 24 trades, average +2.1R  -> gross profit = 24 x 2.1 = 50.4R
Losers:  36 trades, average -1.0R  -> gross loss   = 36 x 1.0 = 36.0R

Win rate      = 24 / 60 = 40%
Expectancy    = 0.40 x 2.1 - 0.60 x 1.0 = 0.84 - 0.60 = +0.24R per trade
Check         = net 50.4 - 36.0 = 14.4R, and 14.4 / 60 = 0.24R
Profit factor = 50.4 / 36.0 = 1.40

At 1% risk per trade, +14.4R is roughly +14.4% before compounding.
```

A 40% win rate might feel poor, but the positive expectancy shows the strategy made money because winners were more than twice the size of losers. This is why win rate alone is misleading.

## Segmenting: where does the edge live?

The total hides the detail. Split the same 60 trades by setup tag:

```text
Pullback: 35 trades, 16 wins x 2.2R = 35.2R, 19 losses = -19.0R
          Net +16.2R, expectancy 16.2 / 35 = +0.46R, win rate 46%
Breakout: 25 trades,  8 wins x 1.9R = 15.2R, 17 losses = -17.0R
          Net  -1.8R, expectancy -1.8 / 25 = -0.07R, win rate 32%
```

```svg
<svg viewBox="0 0 520 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <text x="260" y="24" text-anchor="middle" font-size="13">Net result by setup, 60 trades (R)</text>
    <line x1="70" y1="180" x2="480" y2="180" stroke="#3a3a44"/>
    <line x1="70" y1="40" x2="70" y2="220" stroke="#3a3a44"/>
    <text x="62" y="184" text-anchor="end">0R</text>
    <text x="62" y="104" text-anchor="end">+10R</text>
    <line x1="70" y1="100" x2="480" y2="100" stroke="#3a3a44" stroke-dasharray="3 4"/>
    <rect x="110" y="50.4" width="70" height="129.6" fill="#22c55e"/>
    <text x="145" y="44" text-anchor="middle">+16.2R</text>
    <text x="145" y="238" text-anchor="middle">Pullback (35)</text>
    <rect x="240" y="180" width="70" height="14.4" fill="#ef4444"/>
    <text x="275" y="172" text-anchor="middle">-1.8R</text>
    <text x="275" y="238" text-anchor="middle">Breakout (25)</text>
    <rect x="370" y="64.8" width="70" height="115.2" fill="#ff5a1f"/>
    <text x="405" y="58" text-anchor="middle">+14.4R</text>
    <text x="405" y="238" text-anchor="middle">Total (60)</text>
  </g>
</svg>
```

All of the profit came from pullbacks; breakouts were slightly negative. Useful splits include setup, session, symbol, day of week, direction, and rule-adherence grade. The grade split is often the most sobering: many traders find their C-grade trades, the ones that broke the plan, account for most of their losses.

## Sample size: do not over-read the data

Each segment is smaller than the total, so it carries more luck. The breakout result above, -0.07R over 25 trades, is close enough to zero that it could be a break-even setup having a mediocre run. A reasonable response is not to delete it immediately but to check it against its backtest in Developer, Backtests, and either reduce its risk or pause it while gathering more evidence on demo.

As a rough guide, treat fewer than 30 trades in a segment as anecdotal, 30 to 100 as indicative, and more than 100 as reasonably informative, provided market conditions were varied.

> **Risk warning:** Past performance, whether from a backtest, a demo account or live trading, does not guarantee future results. Leveraged CFD trading can produce losses larger than any recent drawdown in your statistics.

## Running the review

A monthly review works well for most traders:

1. Export or copy the month's trades from the Client Area Portfolio and complete missing journal fields.
2. Calculate the core statistics for the month and for the last three months combined.
3. Segment by setup and grade; compare each with its backtest or earlier results.
4. Check maximum drawdown and whether any risk limits were broken.
5. Decide on at most one or two changes, write them into the plan with a version number, and note what evidence would confirm or reverse them.

## Common mistakes

- Judging a strategy on its win rate or on a single week.
- Reviewing only when results are bad, which ties the process to emotion.
- Changing several rules at once, so you cannot tell which change mattered.
- Ignoring costs. Commission and swap must be inside the R figures, or the statistics flatter the strategy.
