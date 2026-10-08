---
slug: "p6-t-forward-testing-on-demo"
title: "Forward testing on a demo account"
summary: "How to forward-test a backtested strategy on a Ezymex demo account, what to record, how to compare the results fairly with the backtest, and when to stop, adjust or move to small live size."
order: 7
version: 1
takeaways:
  - "Forward testing runs the unchanged strategy on live prices in a demo account, checking execution, costs and your ability to follow the rules in real time."
  - "Set the demo account up like the live account you intend to use, and decide the test length, success criteria and stop criteria before you start."
  - "Compare demo and backtest results with the uncertainty of small samples in mind; a short weak patch is not proof of failure, and a short strong patch is not proof of success."
  - "Moving to live should be gradual, with small size, because live execution and emotions add costs that a demo does not fully capture."
practice:
  label: "Open a demo account in Ezymex Trader with the same account type and leverage you plan to use live, and log every signal of one strategy for the next four weeks."
  symbol: "EURUSD"
quiz:
  - question: "What is the main thing a forward test on demo checks that a backtest cannot?"
    options:
      - "How the strategy behaves on unseen live prices with real-time spreads, fills and your own execution"
      - "Whether the strategy was profitable in 2019"
      - "Whether the historical data was correct"
      - "The strategy's maximum possible profit"
    answer: 0
    explanation: "A forward test uses prices that did not exist when the strategy was built, with real-time conditions and a human or system executing it. Those are exactly the things a backtest has to assume."
  - question: "Backtest expectancy is +0.25R with a standard deviation of 1.2R per trade. After 40 demo trades expectancy is +0.05R. What is the most reasonable conclusion?"
    options:
      - "The strategy is broken and must be abandoned"
      - "Increase the position size to recover the gap"
      - "The strategy is proven to work"
      - "The difference is about one standard error, so it is not yet conclusive; keep testing"
    answer: 3
    explanation: "Standard error = 1.2 / sqrt(40) = 0.19R. The gap of 0.20R is only about one standard error, well within normal variation for 40 trades. More trades are needed."
  - question: "Why should the demo account match the intended live account type?"
    options:
      - "Because demo accounts cannot be changed"
      - "So spreads, commissions, swaps, leverage and contract specifications match, making the comparison meaningful"
      - "Because live accounts require a demo with the same balance"
      - "It does not matter"
    answer: 1
    explanation: "Different account groups can have different spreads, commission and leverage. Testing on a different setup measures a different cost structure from the one you will trade."
  - question: "Which is a sensible pre-defined stop criterion for a forward test?"
    options:
      - "Stop after the first losing trade"
      - "Stop when you feel the market has changed"
      - "Stop if the demo drawdown exceeds about 1.5 times the backtest maximum drawdown"
      - "Never stop, whatever happens"
    answer: 2
    explanation: "A drawdown well beyond the tested maximum is objective evidence that something may differ from the backtest. Stopping after one loss or on a feeling is not a rule."
---

A strategy that has passed a careful backtest and a walk-forward test has earned the right to one more test, not to real money. **Forward testing** means running the strategy, unchanged, on live prices in a demo account. It is the bridge between history and reality, and it catches problems that no amount of historical testing can reveal.

## What forward testing checks

A backtest has to *assume* many things. A forward test *observes* them.

- **Unseen data.** Every price in the forward test arrived after the strategy was finalised, so it cannot have been fitted to them.
- **Real-time spreads and fills.** You see the actual spread when the signal fires, including in the hours after the New York close and around news.
- **Operational reality.** Does the signal arrive when you can act on it? Do you place orders correctly? Does a rule turn out to be ambiguous when you face it in real time?
- **You.** Following rules through a losing streak is much harder in real time than it looks on a backtest report, even on demo.

## Setting up the test

Practise on a free demo account in Ezymex Trader, set up as closely as possible to the live account you intend to use:

1. **Same account type and group,** so spreads, commissions and swaps match.
2. **Same leverage and a realistic balance.** Testing a 1% risk rule on a 100,000 USD demo when you plan to trade 5,000 USD live changes the rounding of lot sizes and hides the effect of the 0.01 minimum lot.
3. **Same strategy version** as the one you backtested, with no changes during the test.
4. **Written criteria before the first trade:** how long the test runs, what counts as success, and what would stop it.

A practical rule for length is a minimum number of trades rather than a number of weeks. For a strategy that trades 10 times a month, three months gives about 30 trades, which is a start; six months or more is better. Low-frequency strategies need longer.

## What to record

For every signal, record both what the rules said and what actually happened:

| Field | Why it matters |
|---|---|
| Signal time and intended entry | Checks the rules fire as in the backtest |
| Actual fill price and spread at entry | Measures real costs and slippage |
| Stop, target and size | Confirms the sizing rule was applied |
| Exit time, price and reason | Separates stop, target, time exit and manual exits |
| Result in USD and in R | Allows direct comparison with the backtest |
| Rule breaks | Any deviation, including skipped signals |

The Portfolio section in the Client Area holds your trade history and statements, which makes it straightforward to reconcile your log with what was actually executed.

## Comparing demo results with the backtest

This is where most traders make their biggest error: judging too early. A small sample varies a lot, even when nothing is wrong.

```text
Backtest: expectancy +0.25R, standard deviation 1.2R per trade

After 40 demo trades: expectancy +0.05R
Standard error = 1.2 / sqrt(40) = 1.2 / 6.32 = 0.19R
Gap = 0.25 - 0.05 = 0.20R = about 1.05 standard errors
-> Well within normal variation. Not conclusive either way.

After 150 demo trades, still +0.05R
Standard error = 1.2 / sqrt(150) = 1.2 / 12.25 = 0.098R
Gap = 0.20R = about 2.0 standard errors
-> Now real evidence that live performance is weaker than tested.
```

Look at the parts as well as the total. If the win rate and average win match the backtest but the average loss is larger, slippage on stops may be the cause. If the number of signals is lower than expected, a filter may be behaving differently in real time. If the results are poor only on trades you skipped or closed early, the issue is execution discipline, not the strategy.

> **Example:** A GBPUSD strategy assumed a 1.2-pip spread and no slippage. Over 60 demo trades, the average spread at entry was 1.6 pips and slippage on entries and stops averaged 0.4 pips per trade. With an average stop of 20 pips, those extra 0.8 pips per trade cost 0.8 / 20 = 0.04R per trade. On a backtested edge of 0.12R, that is a third of the edge, which the backtest's cost settings should now be updated to reflect.

## Deciding what happens next

Your pre-written criteria make the decision, not your mood:

- **Continue** if results sit within the expected range and rules are being followed.
- **Stop and investigate** if drawdown exceeds about 1.5 times the backtest maximum, if the number of signals differs sharply from the backtest, or if the evidence of underperformance becomes statistically meaningful.
- **Move to live gradually** once the test is complete and consistent. Start with a fraction of the intended risk, for example 0.25% per trade instead of 1%, and increase only after the live results also match.

Be aware that demo fills can be more forgiving than live ones. Live orders interact with real liquidity, and real money changes behaviour. Treat the demo as a necessary test, not a guarantee.

> **Risk warning:** Successful demo results do not guarantee live profits. Live trading involves real slippage, emotions and leverage, and CFD losses can exceed what you saw in testing. Only trade live with money you can afford to lose.

## Common mistakes

- **Changing the rules mid-test.** Any change restarts the test.
- **Judging after a few weeks.** Short samples are dominated by luck in both directions.
- **Oversized demo balances.** They hide real-world sizing constraints.
- **Skipping the log.** Without a record of fills and spreads, you cannot tell costs from strategy problems.
- **Jumping straight to full size live.** Scale up only after live results confirm the demo.
