---
slug: "p5-t-r-multiples-and-expectancy"
title: "R-multiples and expectancy"
summary: "Measure every trade in units of risk, calculate the expectancy of a strategy, and understand why win rate alone tells you almost nothing."
order: 3
version: 1
takeaways:
  - "One R is the amount risked on a trade; expressing results as R-multiples makes trades of different sizes and instruments comparable."
  - "Expectancy = (win rate x average win in R) - (loss rate x average loss in R); it is the average result per trade you can expect over a large sample."
  - "The breakeven win rate for a reward-to-risk ratio of X is 1 / (1 + X): 50% at 1:1, 33.3% at 2:1 and 25% at 3:1, before costs."
  - "A positive expectancy estimated from a small sample is unreliable; at least 50 to 100 trades are needed before the numbers mean much."
quiz:
  - question: "A strategy wins 40% of trades with an average win of 2R and an average loss of 1R. What is its expectancy?"
    options:
      - "+0.8R per trade"
      - "-0.2R per trade"
      - "+0.2R per trade"
      - "+1.4R per trade"
    answer: 2
    explanation: "(0.40 x 2) - (0.60 x 1) = 0.80 - 0.60 = +0.20R per trade. Over 100 trades at $100 per R, that is an expected $2,000 before any change in costs."
  - question: "You risked $80 on a trade and closed it for a $200 profit. What is the R-multiple?"
    options:
      - "+2.0R"
      - "+2.5R"
      - "+0.4R"
      - "+1.2R"
    answer: 1
    explanation: "R-multiple = result / initial risk = 200 / 80 = 2.5R."
  - question: "What is the breakeven win rate for trades that target 3R and risk 1R, ignoring costs?"
    options:
      - "25%"
      - "33.3%"
      - "50%"
      - "75%"
    answer: 0
    explanation: "Breakeven win rate = 1 / (1 + 3) = 0.25. At 25% wins, each 3R win offsets three 1R losses."
  - question: "A strategy wins 70% of the time with an average win of 0.4R and an average loss of 1.1R. Which statement is correct?"
    options:
      - "It is profitable because the win rate is above 50%"
      - "Its expectancy is -0.05R, so it loses money over time despite winning most trades"
      - "Its expectancy is +0.28R"
      - "Win rate and payoff cannot be combined"
    answer: 1
    explanation: "(0.70 x 0.4) - (0.30 x 1.1) = 0.28 - 0.33 = -0.05R. A high win rate does not compensate for small wins and larger losses."
---

Traders love to quote win rates. Yet a strategy that wins 70% of the time can lose money, and one that wins 35% of the time can be excellent. What matters is the combination of how often you win and how much you win or lose each time. This chapter introduces two tools that capture both: **R-multiples** and **expectancy**.

## R: the unit of risk

**1R** is the amount you risk on a trade, the loss you take if the stop is hit. Every result is then expressed as a multiple of that risk:

```text
R-multiple = profit or loss / initial risk

Risk $100, stopped out:           -$100 / $100 = -1.0R
Risk $100, closed at +$250:        $250 / $100 = +2.5R
Risk $80,  closed early at -$40:   -$40 / $80  = -0.5R
```

R-multiples remove the effect of position size and account size. A gold trade that made $300 on $150 risk and a EURUSD trade that made $100 on $50 risk were equally good: both were +2R. When you review your Portfolio history in the Client Area, converting results to R shows whether your decisions were good independent of how large you happened to trade that day.

Losses larger than -1R are important warning signs. They mean slippage, a gap, or a stop that was moved or not placed.

## Expectancy

Expectancy is the average R-multiple per trade over a large sample.

```text
Expectancy = (Win rate x Average win) - (Loss rate x Average loss)
```

> **Example:** A breakout strategy wins 40% of trades. Winners average +2R and losers average -1R. Expectancy = (0.40 x 2) - (0.60 x 1) = 0.80 - 0.60 = +0.20R. At 1R = $100, the expected result over 100 trades is 100 x 0.20 x $100 = $2,000. This is a statistical average, not a promise: any given 100 trades can do considerably better or worse.

Compare three profiles:

| Win rate | Avg win | Avg loss | Expectancy |
|---|---|---|---|
| 40% | 2.0R | 1.0R | +0.20R |
| 60% | 0.8R | 1.0R | +0.08R |
| 70% | 0.4R | 1.1R | -0.05R |

The 70% strategy wins most of the time and still loses money. The 40% strategy loses most of the time and is the best of the three.

## Breakeven win rate

For a fixed reward-to-risk ratio X (winners of X R, losers of 1R), expectancy is zero when:

```text
Breakeven win rate = 1 / (1 + X)

X = 1.0  -> 50.0%
X = 1.5  -> 40.0%
X = 2.0  -> 33.3%
X = 3.0  -> 25.0%
```

This shows why a target is meaningful only together with how often it is reached. A 3R target sounds attractive, but if price reaches it only 20% of the time, the strategy loses. Costs raise the breakeven: a round-trip spread and commission of 0.1R turn a 1R loss into 1.1R and a 2R win into 1.9R.

```text
Same 40% strategy, costs of 0.1R per trade included
Expectancy = (0.40 x 1.9) - (0.60 x 1.1) = 0.76 - 0.66 = +0.10R
```

Costs of one tenth of the risk have halved the edge, from +0.20R to +0.10R. This is why short-term strategies with tight stops, where spread and commission are a large share of 1R, need a clearly larger gross edge to survive.

## Working from a real trade log

Here are ten consecutive demo trades:

```svg
<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <text x="20" y="26" font-size="14">R-multiple per trade (10 trades, total +3.0R)</text>
    <line x1="60" y1="170" x2="610" y2="170" stroke="#3a3a44"/>
    <line x1="60" y1="50" x2="60" y2="250" stroke="#3a3a44"/>
    <text x="28" y="54">+3R</text>
    <text x="28" y="94">+2R</text>
    <text x="28" y="134">+1R</text>
    <text x="36" y="174">0</text>
    <text x="30" y="214">-1R</text>
    <line x1="60" y1="130" x2="610" y2="130" stroke="#3a3a44" stroke-dasharray="3 5"/>
    <line x1="60" y1="210" x2="610" y2="210" stroke="#3a3a44" stroke-dasharray="3 5"/>
    <rect x="75" y="90" width="34" height="80" fill="#22c55e"/>
    <rect x="129" y="170" width="34" height="40" fill="#ef4444"/>
    <rect x="183" y="170" width="34" height="40" fill="#ef4444"/>
    <rect x="237" y="50" width="34" height="120" fill="#22c55e"/>
    <rect x="291" y="170" width="34" height="40" fill="#ef4444"/>
    <rect x="345" y="110" width="34" height="60" fill="#22c55e"/>
    <rect x="399" y="170" width="34" height="40" fill="#ef4444"/>
    <rect x="453" y="170" width="34" height="20" fill="#ef4444"/>
    <rect x="507" y="90" width="34" height="80" fill="#22c55e"/>
    <rect x="561" y="170" width="34" height="40" fill="#ef4444"/>
    <text x="88" y="270">1</text>
    <text x="142" y="270">2</text>
    <text x="196" y="270">3</text>
    <text x="250" y="270">4</text>
    <text x="304" y="270">5</text>
    <text x="358" y="270">6</text>
    <text x="412" y="270">7</text>
    <text x="466" y="270">8</text>
    <text x="520" y="270">9</text>
    <text x="570" y="270">10</text>
    <text x="300" y="292">Trade number</text>
  </g>
</svg>
```

```text
Results: +2, -1, -1, +3, -1, +1.5, -1, -0.5, +2, -1

Wins:   4 trades, total +8.5R, average +2.125R
Losses: 6 trades, total -5.5R, average -0.917R
Win rate 40%

Expectancy = (0.40 x 2.125) - (0.60 x 0.917) = 0.85 - 0.55 = +0.30R
Check: total +3.0R / 10 trades = +0.30R
Profit factor = gross wins / gross losses = 8.5 / 5.5 = 1.55
```

Ten trades are far too few to trust this number. With a sample this small, a couple of lucky winners can make a poor strategy look good. As a rule of thumb, collect at least 50 to 100 trades under the same rules before drawing conclusions, and treat the result as an estimate with a wide margin of error. Phase 6 covers backtesting, which lets you test larger samples, and Phase 7 covers performance review in more depth.

## In practice

- Record the planned risk (1R) for every trade before entry, then record the result in R.
- Review expectancy monthly by strategy, not just overall; one weak setup can hide inside a profitable total.
- Watch the average loss. If it drifts above 1R, your stops are being moved or slipped.

Common mistakes include judging a method by win rate alone, cutting winners early to "lock in" a high win rate, and extrapolating a small sample into an annual return.

> **Risk warning:** Past expectancy, whether from a backtest or live trading, does not guarantee future results. Market conditions change, and leveraged CFD trading can produce losses larger than a statistical average suggests.
