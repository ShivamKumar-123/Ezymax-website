---
slug: "p8-t-professional-routines-review"
title: "Professional routines and structured review"
summary: "Build daily, weekly, monthly and quarterly routines that turn trading into a managed process, with clear metrics, contingency plans and decision rules."
order: 7
version: 1
takeaways:
  - "Professional trading runs on routines at several time scales: daily preparation, weekly planning, monthly performance review and quarterly strategy review."
  - "Reviews should compare live results with the expected range from testing, not with the trader's hopes."
  - "Process metrics such as rule adherence are as important as outcome metrics, because they are fully under your control."
  - "Contingency plans for technology failures, news shocks and personal issues protect the account when things go wrong."
practice:
  label: "Download last month's statement from the Portfolio section of the Client Area and calculate win rate, average win and loss in R, expectancy and rule adherence for your demo trades."
  symbol: "EURUSD"
quiz:
  - question: "A month has 62 trades, a 41% win rate, an average win of 2.1R and an average loss of 1R. What is the expectancy per trade?"
    options:
      - "0.86R"
      - "0.41R"
      - "About 0.27R"
      - "-0.18R"
    answer: 2
    explanation: "Expectancy = 0.41 x 2.1 - 0.59 x 1 = 0.861 - 0.59 = 0.271R per trade."
  - question: "Why should a monthly review compare results with the range expected from testing?"
    options:
      - "Because one month's results are noisy, and the key question is whether performance is within the normal variation of the strategy"
      - "Because testing results are always better"
      - "Because live results must match the backtest exactly"
      - "Because monthly reviews are only about costs"
    answer: 0
    explanation: "Short samples vary a lot. Comparing against an expected range shows whether a poor month is normal variance or a sign that something has changed."
  - question: "Which is a process metric rather than an outcome metric?"
    options:
      - "Monthly profit in USD"
      - "Largest winning trade"
      - "Maximum drawdown"
      - "Percentage of trades taken exactly according to the written rules"
    answer: 3
    explanation: "Rule adherence measures behaviour you control directly. Profit, largest win and drawdown are outcomes influenced by market randomness."
  - question: "Which contingency step best protects open positions against a sudden loss of your internet connection?"
    options:
      - "Relying on memory of where you would exit"
      - "Having server-side stop losses on every position and a backup way to access Kalks Trader"
      - "Keeping positions without stops so they cannot be triggered by accident"
      - "Only trading when the connection feels reliable"
    answer: 1
    explanation: "Stop losses and trailing stops placed on the server work even when you are disconnected, and a second device or connection lets you manage positions."
---

What separates professional traders from talented amateurs is rarely a secret indicator. It is process: the same preparation every day, consistent execution, measured results and decisions based on evidence. Phase 7 covered journaling and psychology. This final chapter pulls everything in this programme into routines at four time scales, plus the contingency planning that protects you when something goes wrong.

## The daily routine

A daily routine has three parts.

**Before the session (20 to 40 minutes):**

1. Check the economic calendar in the Client Area for high-impact releases and central bank speakers; mark no-trade windows.
2. Review overnight moves in major indices, USD, gold and oil, and note any regime or macro changes.
3. Update levels and setups for your watchlist using your multi-timeframe rules.
4. Confirm risk limits for the day: maximum risk per trade, personal daily stop, maximum open positions.

**During the session:** execute only setups that meet written rules, log each trade as it happens with the decision price and reason, and stop trading when the daily stop or a predefined number of trades is reached.

**After the session (10 to 20 minutes):** complete journal entries including screenshots, rate your rule adherence, and note anything unusual about execution such as slippage or wide spreads.

## Weekly planning

Once a week, typically at the weekend while FX markets are closed:

- Update your macro view and scenario probabilities from the fundamental track.
- Review the week's trades by strategy: were losses normal losses or mistakes?
- Check total exposure by currency and asset class for the week ahead.
- Plan around major events such as central bank meetings, NFP and CPI, including whether to reduce size.

## Monthly performance review

The monthly review compares live results with what testing predicted.

```text
Strategy: H4 trend-pullback, month of review
Trades                 62
Win rate               41%
Average win            2.1R
Average loss           1.0R
Expectancy             0.41 x 2.1 - 0.59 x 1.0 = 0.271R per trade
Profit factor          (0.41 x 2.1) / (0.59 x 1.0) = 1.46
Net result             62 x 0.271 = 16.8R  (at 0.5% per R: about +8.4%)
Max drawdown           -4.5R
Rule adherence         94% (4 trades broke a rule)

Backtest expectation   expectancy 0.30R, max drawdown range 6R to 10R
Verdict                within expected range; review the 4 rule breaks
```

Notice the order of questions. First, is the strategy performing within its expected range? Second, did I follow the rules? Third, what did the rule breaks cost or earn? A profitable month with poor rule adherence is a warning, not a success, because the profits did not come from the tested process. Also review execution statistics from the costs chapter: average slippage, spread paid and swap by strategy.

## Quarterly strategy review

Every quarter, step back further:

- Re-run backtests including the latest data to see if the edge is stable.
- Review portfolio allocation and correlation between strategies; rebalance risk as planned.
- Apply the switch-off and reinstatement rules from the portfolio chapter.
- Decide on scaling steps using the evidence criteria set earlier.
- Set one or two process goals for the next quarter, such as improving adherence to the daily stop.

## Contingency planning

Professional operations assume things will go wrong and prepare in advance.

| Risk | Preparation |
|---|---|
| Internet or power failure | Server-side stop loss on every position; second device with mobile data; know how to reach support |
| Extreme news or gap | Reduced size before scheduled events; no full-size positions over high-risk weekends |
| Platform or data issue | Written list of open positions and levels; do not open new trades until resolved |
| Personal factors | Rule to stop trading when ill, exhausted or emotionally shaken; lower size after long breaks |
| Large drawdown | Pre-set levels at which risk is halved and trading paused for review |

> **Example:** A trader's home connection drops during a volatile NY session with three positions open. Because every position has a server-side stop and trailing stop in Kalks Trader, risk is already capped. The trader switches to a phone on mobile data, checks positions, and follows the written rule: manage existing trades only, no new entries until the main connection is restored.

## Common mistakes

- **Reviewing only when losing,** which turns review into blame rather than learning.
- **Changing rules mid-month** based on a few trades.
- **Skipping preparation on busy days,** exactly when mistakes are most likely.
- **Treating contingency plans as optional** until the first serious failure.

> **Risk warning:** Routines and reviews improve consistency but cannot remove market risk. CFDs are leveraged and losses can exceed what you expect. Keep practising on a free demo account in Kalks Trader whenever you change strategy, size or process.
