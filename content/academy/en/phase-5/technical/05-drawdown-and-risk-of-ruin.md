---
slug: "p5-t-drawdown-and-risk-of-ruin"
title: "Drawdown maths and risk of ruin"
summary: "Why losses are harder to recover than they look, how often long losing streaks really occur, and how risk per trade drives the chance of ruin."
order: 5
version: 1
takeaways:
  - "The gain needed to recover a drawdown D is D / (1 - D): 11.1% after a 10% loss, 25% after 20%, 100% after 50% and 300% after 75%."
  - "Long losing streaks are normal: a strategy that wins 40% of trades has roughly a three-in-four chance of at least one run of eight straight losses in 200 trades."
  - "Risk of ruin rises steeply with risk per trade; for the same edge, risking 10% instead of 1% can turn a near-zero chance of ruin into a double-digit one."
  - "Set a maximum drawdown in advance at which you stop, reduce size and review, rather than deciding in the middle of a losing run."
quiz:
  - question: "An account falls from $10,000 to $6,000. What percentage gain is required to return to $10,000?"
    options:
      - "40%"
      - "50%"
      - "66.7%"
      - "100%"
    answer: 2
    explanation: "The account must grow by $4,000 from $6,000: 4,000 / 6,000 = 66.7%. Equivalently, D / (1 - D) = 0.40 / 0.60 = 0.667."
  - question: "A trader risks 2% of current equity per trade and suffers ten consecutive losses. What is the approximate drawdown?"
    options:
      - "18.3%"
      - "20.0%"
      - "10.0%"
      - "22.4%"
    answer: 0
    explanation: "Equity after ten losses = 0.98 to the power of 10 = 0.817, a drawdown of about 18.3%. It is less than 20% because each loss is 2% of a slightly smaller balance. 22.4% is the gain then needed to recover."
  - question: "A strategy wins 40% of its trades. Which statement about losing streaks is most accurate?"
    options:
      - "Streaks longer than three losses indicate the strategy is broken"
      - "The chance of ten losses in a row at any point is exactly 0.6%"
      - "Losing streaks cannot happen if the expectancy is positive"
      - "Over a few hundred trades, a streak of eight or more losses is more likely than not"
    answer: 3
    explanation: "0.6% is the chance that a specific set of ten trades are all losers. Across 200 trades there are many possible starting points, and the probability of at least one run of eight or more losses is about 75%."
  - question: "Why does risking a fixed percentage of current equity make total ruin very unlikely in theory, yet still leave a real risk of serious damage?"
    options:
      - "Because the broker refunds losses beyond 50%"
      - "Because position sizes shrink as the account falls, so equity never mathematically reaches zero, but deep drawdowns still require very large gains to recover"
      - "Because percentage risk eliminates losing streaks"
      - "Because leverage is reduced automatically"
    answer: 1
    explanation: "Each loss is a fraction of a smaller balance, so the account approaches zero only gradually. But a 60% drawdown still needs a 150% gain to recover, which in practice is often the end of a trading account."
---

Most traders think about drawdowns in the wrong direction. They see a 30% loss and assume a 30% gain will repair it. It will not. This chapter works through the arithmetic of losses, shows how long losing streaks become in practice and explains why risk per trade is the main lever you have over the chance of ruining an account.

## The asymmetry of losses

A drawdown is the fall in equity from its previous peak. To recover it you need a percentage gain calculated on the smaller, post-loss balance.

```text
Required gain to recover = D / (1 - D)

Drawdown 10%  ->  gain needed  11.1%
Drawdown 20%  ->  gain needed  25.0%
Drawdown 30%  ->  gain needed  42.9%
Drawdown 40%  ->  gain needed  66.7%
Drawdown 50%  ->  gain needed 100.0%
Drawdown 60%  ->  gain needed 150.0%
Drawdown 75%  ->  gain needed 300.0%
Drawdown 90%  ->  gain needed 900.0%
```

```svg
<svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <line x1="60" y1="270" x2="610" y2="270" stroke="#3a3a44"/>
    <line x1="60" y1="40" x2="60" y2="270" stroke="#3a3a44"/>
    <line x1="60" y1="200" x2="610" y2="200" stroke="#3a3a44" stroke-dasharray="3 5"/>
    <line x1="60" y1="130" x2="610" y2="130" stroke="#3a3a44" stroke-dasharray="3 5"/>
    <line x1="60" y1="60" x2="610" y2="60" stroke="#3a3a44" stroke-dasharray="3 5"/>
    <text x="16" y="204">100%</text>
    <text x="16" y="134">200%</text>
    <text x="16" y="64">300%</text>
    <text x="54" y="288">0%</text>
    <text x="222" y="288">25%</text>
    <text x="397" y="288">50%</text>
    <text x="572" y="288">75%</text>
    <text x="250" y="310">Drawdown from peak</text>
    <text x="70" y="32">Gain required to recover</text>
    <polyline points="60,270 130,262.2 200,252.5 270,240 340,223.3 410,200 480,165 550,106.7 585,60" fill="none" stroke="#ef4444" stroke-width="2.5"/>
    <circle cx="410" cy="200" r="4" fill="#ff5a1f"/>
    <text x="420" y="218">50% loss needs +100%</text>
  </g>
</svg>
```

Up to about 20% the relationship is nearly one for one, which is why small drawdowns feel harmless. Beyond that the curve bends sharply upward. The practical conclusion is simple: the most valuable thing risk management does is keep you on the flat part of the curve.

## How losing streaks compound

With fixed-fractional risk, each loss is a percentage of the current balance, so equity after n straight losses is (1 - r) to the power n.

| Risk per trade | After 10 straight losses | Drawdown | Gain to recover |
|---|---|---|---|
| 1% | 90.4% of peak | 9.6% | 10.6% |
| 2% | 81.7% of peak | 18.3% | 22.4% |
| 5% | 59.9% of peak | 40.1% | 67.0% |
| 10% | 34.9% of peak | 65.1% | 186.8% |

## Losing streaks are normal

The chance that a *specific* sequence of ten trades are all losers is small: with a 40% win rate it is 0.6 to the power 10, about 0.6%. But you do not trade just ten times. Over hundreds of trades there are many places a streak can start.

```text
Probability of at least one losing streak (approximate)

Win rate 40%, 200 trades:  8 or more losses in a row   ~75%
Win rate 40%, 200 trades: 10 or more losses in a row   ~38%
Win rate 50%, 100 trades:  6 or more losses in a row   ~55%
```

A positive-expectancy strategy with a 40% win rate should therefore expect to live through an eight-trade losing run in a typical year. If your risk per trade cannot survive that without breaking your confidence or your account, it is too high.

## Risk of ruin

Risk of ruin is the probability of losing so much that you can no longer trade, or can no longer trade in a meaningful way. A classic simplified formula assumes each trade wins or loses the same fixed dollar amount, with a win probability p and a loss probability q = 1 - p:

```text
Risk of ruin = ((1 - A) / (1 + A)) to the power N
where A = p - q (the edge) and N = capital divided by the amount risked per trade

Win rate 55%, payoff 1:1  ->  A = 0.55 - 0.45 = 0.10
Base = 0.90 / 1.10 = 0.818

Risk 1% of capital   (N = 100):  0.818^100 = about 0.0000002%
Risk 5% of capital   (N = 20):   0.818^20  = about 1.8%
Risk 10% of capital  (N = 10):   0.818^10  = about 13.4%
Risk 20% of capital  (N = 5):    0.818^5   = about 36.7%
```

The same strategy, with the same genuine edge, goes from practically no chance of ruin to more than one in three purely because of position size. Real trading is messier than the formula, with variable payoffs, changing edges and correlated losses, so treat these numbers as a demonstration of the principle rather than a precise forecast. Most traders also consider a drawdown of 30% to 50% as practical ruin, long before the account reaches zero.

> **Example:** Two traders use the same EURUSD strategy on $10,000 accounts. Trader A risks 1% per trade; Trader B risks 5%. Both hit a streak of eight losses. Trader A is down to $9,227 (a 7.7% drawdown) and needs 8.4% to recover. Trader B is down to $6,634 (a 33.7% drawdown) and needs 50.7% to recover, while feeling strong pressure to take bigger risks to catch up.

## Setting a maximum drawdown

Decide in advance what you will do at specific drawdown levels, for example:

1. At a 5% drawdown, reduce risk per trade by half.
2. At a 10% drawdown, stop trading live for a week and review the trades in your journal.
3. At 15%, return to a demo account until the cause is clear.

Prop challenges on the Client Area apply hard maximum-drawdown limits, which Phase 8 covers. Setting your own, lower limits is good preparation.

## Common mistakes

- Assuming a 50% loss needs a 50% gain.
- Treating a long losing streak as proof that a tested strategy is broken, or as a reason to increase size.
- Using risk-of-ruin formulas as a guarantee of safety at low risk levels.

> **Risk warning:** Drawdowns in leveraged CFD trading can happen quickly and may be deeper than your stops imply because of gaps and slippage. No position-sizing method can eliminate the risk of loss.
