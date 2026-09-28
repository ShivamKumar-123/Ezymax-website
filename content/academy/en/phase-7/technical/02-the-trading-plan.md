---
slug: "p7-t-the-trading-plan"
title: "The trading plan"
summary: "What a complete trading plan contains, how to write one that removes in-the-moment decisions, and how to update it without drifting."
order: 2
version: 1
takeaways:
  - "A trading plan is a written rulebook covering markets, setups, risk, execution and review, so decisions are made before money is at risk."
  - "Risk rules should be expressed in exact numbers: risk per trade, maximum daily loss, maximum open risk and maximum number of trades."
  - "Every setup in the plan needs objective entry, stop, target and invalidation criteria that another trader could follow."
  - "A plan should be changed only at scheduled reviews and on evidence from a meaningful sample, never during a trading session."
practice:
  label: "Write a one-page plan for a single EURUSD setup on your demo account, including exact risk per trade and a daily loss limit, then trade only that setup for two weeks."
  symbol: "EURUSD"
quiz:
  - question: "Which rule is written clearly enough to belong in a trading plan?"
    options:
      - "Buy when the market looks strong"
      - "Risk a sensible amount per trade"
      - "Buy EURUSD on the first H1 close above the prior day's high when the H4 50 EMA is rising; stop below the breakout candle's low"
      - "Avoid bad trades"
    answer: 2
    explanation: "A plan rule must be objective and testable, so two traders would take the same trade. The other options depend on feeling and cannot be checked."
  - question: "Balance is 5,000 USD, risk per trade is 1% and the EURUSD stop is 25 pips. What is the position size?"
    options:
      - "2.00 lots"
      - "0.02 lot"
      - "0.50 lot"
      - "0.20 lot"
    answer: 3
    explanation: "Risk = 50 USD. Risk per lot = 25 pips x 10 USD = 250 USD. 50 / 250 = 0.20 lot."
  - question: "When is the right time to change the rules in your plan?"
    options:
      - "At a scheduled review, based on a meaningful sample of recorded trades"
      - "Immediately after any losing trade"
      - "During the session, when the market changes character"
      - "Whenever a new indicator becomes popular"
    answer: 0
    explanation: "Changes made in the moment are driven by emotion and recent results. Scheduled, evidence-based reviews protect the plan from recency bias."
  - question: "What is the purpose of a maximum daily loss rule?"
    options:
      - "To guarantee a profitable month"
      - "To stop trading before a bad day, and the emotions it creates, turn into a large drawdown"
      - "To increase position size after losses"
      - "To satisfy the broker's margin requirements"
    answer: 1
    explanation: "A daily limit caps the damage of both bad luck and tilt. It cannot guarantee profits, and it has nothing to do with margin requirements."
---

A strategy tells you when a trade setup exists. A trading plan tells you everything else: which markets you trade, when, how much you risk, what you do when things go wrong, and how you will judge whether it is working. Traders without a written plan end up making those decisions in real time, under pressure, and that is exactly where the biases from the previous chapter do the most damage.

## Why write it down

A plan in your head changes with your mood. A written plan is fixed until you deliberately change it. Writing it also exposes vague ideas: "I trade breakouts" is not a rule until you define what counts as a breakout, where the stop goes and what happens if the level fails. A good test is whether another trader, reading only your plan, would take the same trades you do.

## The sections of a complete plan

| Section | What it should state |
|---|---|
| Purpose and constraints | Goals, capital, time available, account type and leverage |
| Markets and sessions | Exact symbols and the hours you will trade them, in server time |
| Setups | For each setup: context, trigger, entry, stop, target, invalidation |
| Risk rules | Risk per trade, maximum daily and weekly loss, maximum open risk |
| Execution rules | Order types, when to use pending vs market orders, news handling |
| Trade management | Moving to breakeven, partial closes, trailing stops, time exits |
| Routine | Pre-session, in-session and post-session tasks |
| Review | When and how performance is reviewed and the plan updated |

Keep it short enough to read before every session. One or two pages is plenty for most traders.

## Setups: objective and testable

Each setup should read like instructions. For example:

- **Context:** EURUSD H4 above a rising 50-period EMA.
- **Trigger:** An H1 candle closes above the previous day's high.
- **Entry:** Market order at the open of the next H1 candle, or a limit order at the breakout level for a retest.
- **Stop:** Below the low of the breakout candle, minimum 15 pips.
- **Target:** 2R, with the option to trail the remainder after 1R.
- **Invalidation:** An H1 close back below the previous day's high cancels the idea.
- **Skip if:** A high-impact release on either currency is due within 30 minutes.

If you built and tested this rule set in the Client Area under Developer, Strategies and Backtests, the plan should match the tested version exactly. A plan that differs from what you tested has no evidence behind it.

## Risk rules in numbers

Risk rules only work if they are numeric.

```text
Account balance:       5,000 USD
Risk per trade:        1%   = 50 USD
Maximum daily loss:    2%   = 100 USD  (stop trading for the day)
Maximum weekly loss:   4%   = 200 USD  (stop until next week's review)
Maximum open risk:     3%   = 150 USD  across all positions
Maximum trades/day:    3

Position size for a 25-pip EURUSD stop:
Risk per 1.00 lot = 25 x 10 USD = 250 USD
Lot size = 50 / 250 = 0.20 lot
```

The daily and weekly limits are there for the days when judgement deteriorates. They are easy to accept in advance and hard to follow in the moment, so decide now what you will physically do when a limit is hit, such as closing Kalks Trader and writing the day's journal entry.

> **Risk warning:** CFDs are leveraged and losses can exceed what you plan. A plan improves consistency but does not guarantee profits; even a well-tested strategy can have long losing periods.

## News and exceptional conditions

State in advance how you handle scheduled events: flat before high-impact releases on your currencies, no new trades for a set time after, or a reduced size. Also decide what happens around weekends, holidays and unusual spreads. Kalks Trader shows live spreads; a rule such as "no entry if the spread is more than twice its normal level" is simple and effective.

## Updating the plan without drifting

Plans should evolve, but only through a deliberate process:

1. Collect results in a journal, tagged by setup.
2. Review on a fixed schedule, such as the last day of each month.
3. Change one thing at a time, and only when a sample of at least 30 to 50 trades supports it.
4. Record the change with a date and version number so later results can be compared.

The most common failure is not a bad plan but a plan that is quietly ignored. If you break a rule, record it. If the same rule is broken repeatedly, either the rule is unrealistic or discipline needs work, and the review is where you decide which.

## Common mistakes

- Writing goals ("make 10% a month") instead of rules. Profit targets cannot be controlled; behaviour can.
- Leaving risk as a range ("0.5 to 2%"), which invites increasing size after losses.
- Trading setups that are not in the plan because they "looked good".
- Rewriting the plan after every losing week.
