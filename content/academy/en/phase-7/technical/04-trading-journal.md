---
slug: "p7-t-trading-journal"
title: "Keeping a trading journal"
summary: "What to record for every trade, how to measure results in R, and how MAE and MFE reveal whether your stops and targets are well placed."
order: 4
version: 1
takeaways:
  - "A journal records the decision as well as the result, so you can separate good process from lucky outcomes."
  - "Recording each trade in R, a multiple of the amount risked, makes results comparable across symbols and position sizes."
  - "Tags for setup, session and rule adherence turn a diary into data that can be filtered and analysed."
  - "Maximum adverse and favourable excursion (MAE and MFE) show whether stops are too tight and targets too close or too far."
  - "The Client Area Portfolio supplies the raw fills, but the reasons, emotions and grades must be added by you."
practice:
  label: "For your next ten demo trades, record entry reason, R result, MAE and MFE in pips, and a rule-adherence grade from A to C."
  symbol: "GBPUSD"
quiz:
  - question: "A trade risked 60 USD and closed with a profit of 150 USD. What is the result in R?"
    options:
      - "+2.5R"
      - "+1.5R"
      - "+0.4R"
      - "+9.0R"
    answer: 0
    explanation: "R = profit / initial risk = 150 / 60 = 2.5. Dividing the other way (60 / 150 = 0.4) is a common slip."
  - question: "Across many trades, winning positions frequently go 15 to 20 pips against you before turning, and your stop is 12 pips. What does the MAE data suggest?"
    options:
      - "The target is too far"
      - "The stop may be too tight and is cutting off trades that would have worked"
      - "The strategy has no edge"
      - "Position size is too small"
    answer: 1
    explanation: "If winners routinely experience more adverse movement than your stop allows, you are stopped out of good trades. MAE is about stop placement, not target distance."
  - question: "Which journal field is most useful for separating process from outcome?"
    options:
      - "The account balance after the trade"
      - "The time of day"
      - "A rule-adherence grade recorded for each trade"
      - "The symbol's spread"
    answer: 2
    explanation: "A grade shows whether the plan was followed, regardless of profit. A losing A-grade trade is fine; a winning C-grade trade is a warning sign."
  - question: "Why should journal entries be written when the trade is opened rather than at the end of the week?"
    options:
      - "The platform deletes history after a week"
      - "It makes the trade more likely to win"
      - "Brokers require it"
      - "Reasons and emotions are recorded before the outcome can reshape memory"
    answer: 3
    explanation: "Hindsight bias rewrites why we took a trade once we know the result. Ezymex keeps trade history in the Portfolio module, so data loss is not the reason."
---

Almost every experienced trader keeps a journal, and almost every struggling trader has tried one and given up. The difference is usually what gets recorded. A list of profits and losses tells you little that your account statement does not. A useful journal records the decision, the context and your state of mind at the moment of the trade, in a format you can later analyse.

## Why a journal matters

Trading outcomes are noisy. A poor decision can win and a good one can lose, so you cannot improve by looking at profit alone. The journal separates the two by capturing what you intended and whether you followed your plan. Over time it answers the questions that matter: which setups actually work for you, in which sessions, and which mistakes cost the most.

## What to record

The platform already knows the fills. In the Client Area, Portfolio holds your trade history and statements with entry and exit prices, volume, commission and swap. Your journal adds what the platform cannot see.

| Field | Example |
|---|---|
| Date, time (server) and session | 2026-03-12, 10:40, London |
| Symbol, direction, volume | GBPUSD, buy, 0.30 lot |
| Setup tag | Breakout-retest |
| Entry, stop, target | 1.2705 / 1.2680 / 1.2755 |
| Initial risk in USD | 75 USD |
| Reason (one or two sentences) | Retest of prior-day high, H4 uptrend |
| Exit price and reason | 1.2730, closed manually before target |
| Result in USD and in R | +75 USD, +1.0R |
| MAE / MFE in pips | 12 / 38 |
| Rule-adherence grade | B: manual early exit not in plan |
| Emotional state | Impatient after a flat morning |
| Screenshot | Chart at entry and at exit |

Screenshots are worth the effort. A chart at entry shows what you actually saw, not what you remember seeing.

## Recording results in R

R is the amount you risked on the trade. Expressing results as multiples of R makes a 0.05 lot gold trade comparable with a 0.50 lot EURUSD trade.

```text
GBPUSD long 0.30 lot at 1.2705, stop 1.2680 (25 pips)
Initial risk = 25 pips x 10 USD x 0.30 = 75 USD = 1R

Planned target 1.2755 (50 pips) = 150 USD = +2R
Actual exit 1.2730 (25 pips)    =  75 USD = +1R

Result: +1R instead of the planned +2R.
Price later reached 1.2743 (MFE 38 pips), so the target
was not hit, but a trailing stop may have captured more.
```

Many traders use a spreadsheet for the journal, with one row per trade. Commission and swap should be included in the final R figure, since they are part of the real result.

## MAE and MFE: what the trade went through

**Maximum adverse excursion (MAE)** is the furthest a trade moved against you before it closed. **Maximum favourable excursion (MFE)** is the furthest it moved in your favour. Both are measured from entry, usually in pips or points, and are easy to read off the chart after the trade.

Across 30 or more trades they become revealing:

- If many winning trades had an MAE close to your stop distance, your stop is barely surviving normal noise, and a small widening (with a smaller lot size to keep the risk constant) might improve results.
- If losers rarely show any MFE, the entry may be poorly timed.
- If winners often reach 3R of MFE but you exit at 1R, your exits are leaving a lot on the table.
- If trades rarely reach your target but frequently reach 1.5R, the target may be too ambitious.

> **Risk warning:** Adjusting stops and targets based on a small sample can overfit your rules to recent noise. Test changes on a demo account before applying them with real money on leveraged CFDs.

## Tags and grades

Tags make the journal searchable: setup, session, symbol, market condition (trending or ranging), and mistakes such as "moved stop", "chased entry" or "traded after daily limit". A simple grade for each trade works well:

- **A:** Plan followed fully.
- **B:** Minor deviation, such as an early exit.
- **C:** Rule broken, such as a trade outside the plan or a widened stop.

When you later compare the average R of A-grade trades with C-grade trades, the cost of indiscipline becomes a number rather than a feeling.

## Common mistakes

- Recording only losing trades, which hides what your best trades have in common.
- Writing entries days later, when hindsight has already reshaped the reasons.
- Journalling in so much detail that the habit collapses after a week. Aim for two minutes per trade.
- Collecting data and never reviewing it. The next chapter covers how to turn journal data into decisions.
