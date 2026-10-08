---
slug: "p8-t-copy-trading-pamm"
title: "Running copy-trading and PAMM strategies responsibly"
summary: "Learn how copy trading and PAMM accounts work, how performance fees and high-water marks are calculated, and what a strategy provider owes the investors who follow them."
order: 6
version: 1
takeaways:
  - "In copy trading and PAMM, investors carry the full risk of the provider's decisions, so the provider's first duty is honest risk control and disclosure."
  - "A high-water mark ensures performance fees are only charged on new profits above the previous peak."
  - "Followers can receive different results from the provider because of account size, minimum lot rounding, slippage and fees."
  - "Strategies with hidden tail risk, such as martingale or grid systems without stops, can show smooth records until a single event causes very large losses."
practice:
  label: "Open the Copy trading / PAMM section of the Client Area on a demo login and review how a strategy's statistics, drawdown and fee terms are displayed before any allocation."
  symbol: "EURUSD"
quiz:
  - question: "An investor starts with 10,000 USD. Month 1: +800. Month 2: -500. Month 3: +700 (before fees). With a 20% performance fee and a high-water mark, what fee is charged in month 3?"
    options:
      - "140 USD"
      - "200 USD"
      - "40 USD"
      - "0 USD"
    answer: 2
    explanation: "After month 1 the fee is 160 and equity is 10,640, which becomes the high-water mark. Month 2 takes equity to 10,140. Month 3 brings it to 10,840, only 200 above the mark, so the fee is 20% x 200 = 40 USD."
  - question: "A provider with a 5,000 USD account opens 0.03 lots. A follower with 1,000 USD copies proportionally, but the minimum lot is 0.01. What happens?"
    options:
      - "The follower trades exactly 0.006 lots"
      - "The follower's trade is rounded up to 0.01 lots, about 1.67 times the proportional risk"
      - "The follower's trade is rounded to 0.03 lots, the same risk"
      - "The follower's account is closed"
    answer: 1
    explanation: "0.03 x 1,000 / 5,000 = 0.006 lots, which is below the minimum. Rounding up to 0.01 gives 0.01 / 0.006 = 1.67 times the intended risk, unless the platform skips the trade."
  - question: "Why can a martingale strategy show a very smooth equity curve for many months?"
    options:
      - "Because it has a genuine edge in all markets"
      - "Because brokers subsidise the losses"
      - "Because it never opens losing positions"
      - "Because losing trades are held and doubled until a small win closes the sequence, hiding a large risk that appears only in a strong trend"
    answer: 3
    explanation: "Doubling size after losses converts many small wins into a smooth curve, while exposure grows with each loss. A long enough move against the position can wipe out the account."
  - question: "Which disclosure is most important for a provider to make to potential investors?"
    options:
      - "The maximum risk per trade, maximum historical drawdown and the style of the strategy, including whether it uses stops"
      - "The provider's favourite indicator"
      - "Only the best month of returns"
      - "A promise of a fixed monthly return"
    answer: 0
    explanation: "Investors need to understand risk, not only returns. Promising fixed returns is misleading because no trading strategy can guarantee them."
---

Copy trading and PAMM (percentage allocation management module) let investors connect their funds to a strategy run by someone else. In Ezymex, these appear in the Copy trading / PAMM (Social) section of the Client Area. For a provider, running such a strategy is a step up in responsibility: other people's savings now depend on your discipline. For investors, it can offer access to a trader's approach, but it never removes risk. This chapter covers both sides.

## How the two models differ

- **Copy trading:** each follower keeps their own account. When the provider opens a trade, a proportional trade is opened in each follower's account, usually scaled by equity or by a chosen multiplier. Followers can typically stop copying at any time.
- **PAMM:** investors' funds are pooled in one managed account. The provider trades the pool, and profits and losses are allocated to each investor in proportion to their share. Deposits and withdrawals are usually processed at set intervals.

In both models the investor bears the full loss if the strategy loses. Past performance shown on a leaderboard does not predict future results.

## Fees and the high-water mark

Providers are commonly paid through a performance fee on profits, sometimes with a management fee on assets or a volume-based fee. A **high-water mark** means performance fees are only charged on profits that take the investor's equity above its previous peak, so an investor never pays twice for the same gains.

```text
Investor starts with 10,000 USD, performance fee 20%, high-water mark

Month 1: +800   equity 10,800  new profit 800   fee 160  -> 10,640 (HWM 10,640)
Month 2: -500   equity 10,140  below HWM         fee   0  -> 10,140
Month 3: +700   equity 10,840  above HWM by 200  fee  40  -> 10,800 (HWM 10,800)

Total fees 200 USD on a net gain of 800 USD after fees.
```

Without a high-water mark, month 3 would have attracted a fee of 140 USD on profits that mostly just recovered the month 2 loss. As an investor, always check the fee model, how often fees are calculated, and whether a high-water mark applies.

## Why follower results differ from the provider's

Even with perfect copying, followers rarely match the provider exactly:

- **Minimum lot rounding.** If a provider with 5,000 USD opens 0.03 lots, a 1,000 USD follower should trade 0.006 lots. The minimum is 0.01, so the trade is either rounded up (about 1.67 times the intended risk) or skipped. Small follower accounts can therefore carry very different risk from the provider.
- **Execution timing and slippage.** Follower orders are placed after the provider's, and in fast markets fill at different prices.
- **Fees and swaps.** These reduce follower returns compared with the gross statistics.
- **Different start dates.** Joining after a strong run means experiencing the next drawdown without having enjoyed the gains.

## Responsibilities of a strategy provider

Before offering a strategy, a responsible provider should be able to answer yes to all of these:

1. The strategy has a documented edge from backtests and a live or demo record long enough to include losing periods.
2. Every position has a defined stop loss, and maximum risk per trade is fixed and disclosed.
3. There is a published maximum drawdown level at which the provider reduces risk or pauses trading.
4. The strategy works at the likely range of follower account sizes, given minimum lot rounding.
5. Fees are clearly stated, and no fixed return is promised.
6. The provider trades the same way when followers are watching as when they are not.

Strategies that average down without stops, martingale systems that double size after losses, and grid systems without a total exposure cap can produce unusually smooth records. Their risk is hidden: a sustained trend against the position can cause losses far larger than anything in the history. A record that looks too smooth, with a very high win rate and small average wins, deserves scrutiny from investors and should never be offered by a responsible provider.

## Guidance for investors

> **Example:** An investor compares two strategies. Strategy X shows +4% a month with a 3% maximum drawdown over eight months, a 92% win rate and open positions often held for weeks without stops. Strategy Y shows +1.5% a month with a 14% maximum drawdown over three years, a 48% win rate, and fixed stops on every trade. X looks better on the leaderboard, but its short history and missing stops suggest hidden tail risk. Y's record includes real drawdowns, a longer sample and transparent risk. A careful investor would allocate only a small amount, if anything, to X, and size any allocation to Y assuming a future drawdown larger than 14%.

Sensible investor habits include diversifying across providers with different styles, setting an equity stop on each allocation where the platform allows, and never allocating money needed for living costs.

## Common mistakes

- **Providers raising risk to climb a leaderboard,** exposing followers to losses they did not sign up for.
- **Investors choosing the best recent return** rather than the most transparent risk.
- **Ignoring the gap between gross and net returns** after fees.

> **Risk warning:** Copy trading and PAMM investments carry the full risk of leveraged CFD trading. Investors can lose some or all of their allocated capital, past performance does not guarantee future results, and no provider can promise returns.
