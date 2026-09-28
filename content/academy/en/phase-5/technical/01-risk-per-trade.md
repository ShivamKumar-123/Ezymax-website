---
slug: "p5-t-risk-per-trade"
title: "Risk per trade: the decision that comes first"
summary: "Why professionals fix the amount they can lose before they think about profit, and how to choose and apply a risk percentage per trade."
order: 1
version: 1
takeaways:
  - "Risk per trade is the amount of money you lose if your stop loss is hit, including spread and commission, and it is decided before the trade is placed."
  - "Risking a fixed percentage of current equity, typically 0.5% to 2%, keeps losses survivable and automatically reduces position size during drawdowns."
  - "At 1% risk, ten consecutive losses cost about 9.6% of the account; at 10% risk they cost about 65%."
  - "Daily and weekly loss limits stop a bad session from turning into a damaging week."
practice:
  label: "On your demo account, write down 1% of your current equity, then plan one EURUSD trade whose stop loss would cost exactly that amount before placing it."
  symbol: "EURUSD"
quiz:
  - question: "Your equity is $8,000 and you risk 1.5% per trade. How much should you lose if the stop is hit?"
    options:
      - "$80"
      - "$120"
      - "$150"
      - "$1,200"
    answer: 1
    explanation: "1.5% of $8,000 = 0.015 x 8,000 = $120. The position size is then chosen so that the stop distance costs $120."
  - question: "What happens to the dollar amount at risk under fixed-percentage risk when the account falls from $10,000 to $9,000?"
    options:
      - "It stays at $100 per trade"
      - "It depends on the leverage setting"
      - "It rises to recover the loss faster"
      - "It falls from $100 to $90 per trade at 1% risk"
    answer: 3
    explanation: "1% of $9,000 is $90. Fixed-fractional risk shrinks positions during drawdowns and grows them during winning periods, which slows losses when you are trading badly."
  - question: "Which cost should be included when you measure the risk of a trade?"
    options:
      - "The distance from entry to stop plus spread and any commission"
      - "Only the distance from entry to stop"
      - "Only the margin required to open the trade"
      - "The distance from entry to take profit"
    answer: 0
    explanation: "Spread and commission are paid whether or not the trade works, so they are part of what you lose if the stop is hit. Margin is collateral, not risk."
  - question: "A trader risks 10% per trade. Roughly what drawdown do ten consecutive losses produce?"
    options:
      - "About 10%"
      - "About 35%"
      - "About 65%"
      - "Exactly 100%"
    answer: 2
    explanation: "With compounding, equity after ten losses is 0.90 to the power of 10 = 0.349 of the start, a drawdown of about 65%. It is not 100% because each loss is 10% of a smaller balance."
---

Every trade has two outcomes you can control: where you get out if you are wrong, and how large the position is. Together they fix the amount you lose when the market proves you wrong. This chapter is about deciding that amount, your **risk per trade**, before anything else. It is the single most important number in trading, because no strategy, however good, survives a position size that one bad sequence can wipe out.

## What "risk" means

In this section, risk has a precise meaning: **the money you lose if the stop loss is filled at its level, including costs**. It is not the margin, not the notional value and not a feeling.

```text
Risk = (stop distance x value per point x position size) + spread cost + commission
```

Three consequences follow:

- A trade without a stop loss has undefined risk. Mental stops fail precisely when markets move fastest.
- Margin tells you how much collateral is locked, not how much you can lose. A $87 margin can sit behind a $500 loss.
- Risk is fixed **before** entry. If the stop needs to be wider, the position must be smaller, not the other way round.

## Choosing a percentage

Most professional guidance places risk per trade between 0.5% and 2% of equity. The reason is survival through losing streaks, which every strategy has.

| Risk per trade | Equity after 10 straight losses | Drawdown |
|---|---|---|
| 1% | 90.4% of start | 9.6% |
| 2% | 81.7% of start | 18.3% |
| 5% | 59.9% of start | 40.1% |
| 10% | 34.9% of start | 65.1% |

A 10% drawdown is uncomfortable but recoverable. A 65% drawdown needs a gain of about 187% just to get back to the start, which is why large risk percentages end most trading accounts. The drawdown chapter of this section works through these recovery numbers in detail.

Good starting points:

- **0.5% to 1%** while learning, or when trading a new strategy.
- **1% to 2%** for an experienced trader with a tested edge and a stable routine.
- **Lower** when trading around news, holding over weekends or trading several correlated positions at once.

## Fixed percentage of current equity

The standard method is **fixed-fractional** risk: the same percentage of current equity on every trade, recalculated as the account changes.

> **Example:** You start with $10,000 and risk 1%, so $100 per trade. After a run of losses equity is $9,000, and 1% is now $90. After a good month equity is $11,500, and 1% is $115. You never need to decide whether to "size up" or "size down"; the rule does it for you.

The advantage is that position sizes shrink automatically in a drawdown, slowing the damage when you are trading badly or conditions are unfavourable, and grow gradually as the account grows.

Some traders use a **fixed dollar amount** instead, such as $100 per trade until the account moves by a set step. It is simpler to track, but risk grows as a percentage when the account falls, which is the opposite of what you want in a drawdown.

## Loss limits beyond the single trade

Risk per trade controls one trade. Two further limits control a session and a week:

1. **Daily loss limit**, often two to three times your risk per trade. At 1% per trade, stop trading for the day after a 3% loss.
2. **Weekly loss limit**, often around 5% to 6%. Reaching it means a pause and a review, not a bigger position to win it back.

These limits exist because losses are rarely independent in practice. Tiredness, frustration and a market that does not suit your method all tend to produce clusters of bad trades. Prop-firm challenges enforce similar daily and maximum drawdown rules, which Phase 8 covers.

## Including costs

Spread and commission are paid on every trade, so they belong in the risk figure.

```text
EURUSD, 0.40 lots, stop 25 pips, pip value $10 per lot
Stop loss:     0.40 x 25 x $10     = $100.00
Spread 1 pip:  0.40 x 1 x $10      =   $4.00
Commission:    $7 per lot x 0.40   =   $2.80
Total risk if stopped out          = $106.80
```

On a 1% target of $100 this trade is slightly oversized. For short-term trades with tight stops, costs can be a large fraction of the risk and must be built into the size.

## Common mistakes

- **Choosing the lot size first.** Traders often think "I trade 1 lot" and then place a stop wherever it fits. The stop comes from the chart; the size comes from the risk.
- **Raising risk after losses.** Doubling up to recover is the fastest route to a large drawdown.
- **Measuring risk on balance instead of equity.** If you have open losing trades, your real capital is lower than your balance.
- **Forgetting open trades.** Five positions at 1% each is 5% at risk right now. The correlation chapter shows how to cap total exposure.

> **Risk warning:** CFDs are leveraged products. Even with a stop loss, gaps and slippage around news or weekend openings can cause a loss larger than your planned risk, so keep your risk per trade modest enough to absorb that.
