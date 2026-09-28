---
slug: "p6-t-overfitting-and-walk-forward"
title: "Overfitting and walk-forward testing"
summary: "Why optimised strategies often fail live, how to recognise overfitting, and how walk-forward testing gives a more honest estimate of future performance."
order: 5
version: 1
takeaways:
  - "Overfitting means fitting rules and parameters to the random noise of past data, producing a strategy that describes history instead of predicting anything."
  - "The more rules, parameters and versions you test, the more likely the best result is luck, so count your tests and keep strategies simple."
  - "Robust strategies sit on a plateau: nearby parameter values give similar results, rather than one isolated peak."
  - "Walk-forward testing repeatedly optimises on one window and tests on the next unseen window, and only the stitched-together out-of-sample results count."
quiz:
  - question: "An optimisation shows profit factor 1.9 at a moving-average length of 37, but 1.05 at 35 and 1.02 at 40. What does this suggest?"
    options:
      - "37 is the true optimal length and should be traded"
      - "The result is an isolated peak and is probably fitted to noise"
      - "The strategy is robust because one value works well"
      - "Profit factor is not a useful metric"
    answer: 1
    explanation: "A robust edge should not vanish when the parameter moves slightly. An isolated spike surrounded by weak results is the classic sign of overfitting."
  - question: "A random strategy with zero true edge has a standard error of 0.14R on its average result over 50 trades. If you test 100 such random variations, what is the best one likely to show?"
    options:
      - "About 0R, because they have no edge"
      - "A clearly negative result"
      - "Around +0.3R to +0.4R, purely by chance"
      - "Exactly +1R"
    answer: 2
    explanation: "The best of 100 random draws typically lands about 2.5 standard errors above the true mean: 2.5 x 0.14 = about +0.35R. It looks like an edge but is pure luck."
  - question: "In walk-forward testing, which results are used to judge the strategy?"
    options:
      - "The combined out-of-sample results from all windows"
      - "The best single window"
      - "The in-sample results of each window"
      - "Only the most recent in-sample window"
    answer: 0
    explanation: "Each out-of-sample window uses parameters chosen without seeing it. Stitching those windows together simulates what you would have experienced by re-optimising periodically."
  - question: "In-sample optimisation produced 20% per year, and the walk-forward out-of-sample results produced 6% per year. What is the walk-forward efficiency?"
    options:
      - "333%"
      - "14%"
      - "120%"
      - "30%"
    answer: 3
    explanation: "Walk-forward efficiency = out-of-sample annualised return / in-sample annualised return = 6 / 20 = 30%. That is a large drop and suggests much of the in-sample result was fitted."
---

Every strategy builder makes it easy to optimise: run the same strategy across dozens or hundreds of parameter combinations and pick the best. It feels like progress. Often it is the opposite. The combination that performed best on the past is usually the one that fitted the past's random noise most closely, and noise does not repeat. This problem is called **overfitting**, or curve fitting, and it is the main reason strategies that look excellent in a backtest disappoint on a demo or live account.

## Signal and noise

Price data contains two things: a small amount of repeatable behaviour, which is your potential edge, and a large amount of randomness. A strategy with few, logical rules can only capture broad behaviour. A strategy with many rules and finely tuned parameters can also capture the random wiggles of the particular period you tested, and the more it does so, the better the backtest looks and the worse the future results tend to be.

Signs that a strategy is overfitted:

- Many conditions, each justified by a few specific past trades.
- Oddly precise parameters, such as an RSI threshold of 27.4 or a 37-period average, with no reason other than "it tested best".
- Excellent in-sample results and a sharp drop out-of-sample.
- Performance that depends on one or two exceptional periods or trades.

## Why testing many versions is dangerous

Even a strategy with no edge at all will produce a spread of backtest results because of luck. Test enough versions and the best one will look impressive.

```text
A strategy with zero true edge, 50 trades per test
Standard deviation of each trade result = about 1.0R
Standard error of the average = 1.0 / sqrt(50) = 1.0 / 7.07 = 0.14R

Test 100 random variations:
The best one is typically about 2.5 standard errors above zero
Best result = 2.5 x 0.14 = about +0.35R per trade

It looks like a strong edge. It is pure luck.
```

This is why the version log from the strategy-builder chapter matters. If your final strategy is the best of 80 attempts, you should demand far stronger evidence than if it was the first or second idea you tested.

## Looking for plateaus, not peaks

When you do optimise a parameter, look at the whole landscape, not just the best value.

| MA length | 20 | 25 | 30 | 35 | 40 | 45 | 50 |
|---|---|---|---|---|---|---|---|
| Strategy A profit factor | 1.21 | 1.26 | 1.30 | 1.28 | 1.27 | 1.22 | 1.19 |
| Strategy B profit factor | 0.94 | 1.02 | 0.97 | 1.88 | 1.01 | 0.92 | 0.96 |

Strategy A has a **plateau**: results are similar across a wide range, so small changes in market behaviour are unlikely to break it. Strategy B has a single **peak** at 35 surrounded by losses. Strategy B's best number is higher, but Strategy A is the far better candidate. When choosing from a plateau, pick a value near its middle, not the edge.

## Walk-forward testing

A single in-sample and out-of-sample split, described in the backtesting chapter, gives one honest check. **Walk-forward testing** repeats that check many times, simulating what you would do in reality: optimise on recent history, trade the next period, then re-optimise.

```svg
<svg viewBox="0 0 640 250" xmlns="http://www.w3.org/2000/svg" font-family="Inter, Arial, sans-serif">
  <rect width="100%" height="100%" fill="#121216"/>
  <text x="20" y="26" fill="#c9c9d1" font-size="14">Rolling walk-forward: optimise in-sample, test on the next window</text>
  <text x="20" y="64" fill="#c9c9d1" font-size="12">Run 1</text>
  <rect x="80" y="50" width="240" height="22" fill="#3a3a44"/>
  <rect x="320" y="50" width="60" height="22" fill="#ff5a1f"/>
  <text x="20" y="100" fill="#c9c9d1" font-size="12">Run 2</text>
  <rect x="140" y="86" width="240" height="22" fill="#3a3a44"/>
  <rect x="380" y="86" width="60" height="22" fill="#ff5a1f"/>
  <text x="20" y="136" fill="#c9c9d1" font-size="12">Run 3</text>
  <rect x="200" y="122" width="240" height="22" fill="#3a3a44"/>
  <rect x="440" y="122" width="60" height="22" fill="#ff5a1f"/>
  <text x="20" y="172" fill="#c9c9d1" font-size="12">Run 4</text>
  <rect x="260" y="158" width="240" height="22" fill="#3a3a44"/>
  <rect x="500" y="158" width="60" height="22" fill="#ff5a1f"/>
  <line x1="80" y1="200" x2="600" y2="200" stroke="#3a3a44"/>
  <text x="80" y="218" fill="#c9c9d1" font-size="12">2021</text>
  <text x="320" y="218" fill="#c9c9d1" font-size="12">2023</text>
  <text x="560" y="218" fill="#c9c9d1" font-size="12">2025</text>
  <rect x="80" y="230" width="14" height="12" fill="#3a3a44"/>
  <text x="100" y="240" fill="#c9c9d1" font-size="12">In-sample (2 years)</text>
  <rect x="260" y="230" width="14" height="12" fill="#ff5a1f"/>
  <text x="280" y="240" fill="#c9c9d1" font-size="12">Out-of-sample (6 months), stitched together</text>
</svg>
```

The procedure:

1. Choose an in-sample window length (for example two years) and an out-of-sample length (for example six months).
2. Optimise on the first in-sample window, using a plateau choice rather than the single best value.
3. Apply those parameters, unchanged, to the following six months and record the results.
4. Move both windows forward by six months and repeat until the data runs out.
5. Join all the out-of-sample periods into one equity curve. That curve, and only that curve, is your estimate of real performance.

A common summary figure is **walk-forward efficiency**: the annualised out-of-sample return divided by the annualised in-sample return. If in-sample optimisation shows 18% per year and the stitched out-of-sample result is 9% per year, efficiency is 9 / 18 = 50%. A figure close to zero or negative means the optimisation was mainly fitting noise. Some drop is always expected, because in-sample results are the best of many tries.

> **Example:** A GBPUSD breakout strategy is optimised for the breakout lookback period on four rolling windows. The chosen values are 18, 20, 20 and 22 candles, all within a stable plateau, and every out-of-sample window is profitable after costs. A second strategy selects 9, 41, 15 and 60 in successive windows, and two of four out-of-sample windows lose. Even if their totals were similar, the first strategy's stability is far more convincing.

> **Risk warning:** Passing a walk-forward test reduces the risk of overfitting but does not remove it, and it does not guarantee future profits. Market behaviour changes, and leveraged CFD trading can lose more than any historical test suggests.

## Common mistakes

- **Optimising everything at once.** Each extra parameter multiplies the combinations tested and the room for luck.
- **Using walk-forward windows that are too short.** Six months with ten trades per window cannot tell you anything reliable.
- **Re-running walk-forward with different settings until it passes.** That turns the whole exercise back into in-sample fitting.
- **Ignoring logic.** A rule should have a reason to work. Results without a reason are the easiest to overfit.
