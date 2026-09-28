---
slug: "p4-f-news-trading-risk-and-planning"
title: "News-trading risk and your plan"
summary: "The main ways traders approach scheduled news, the risks of each, and a checklist that turns the calendar into rules."
order: 7
version: 1
takeaways:
  - "Standing aside, reducing exposure, trading the aftermath and trading the release are distinct approaches with very different risk profiles."
  - "Trading the first second of a release competes with algorithms and exposes you to maximum spread and slippage."
  - "News risk should be sized by a realistic worst-case fill, not by the stop distance alone."
  - "A written news checklist, reviewed weekly, is more valuable than any single news strategy."
practice:
  label: "Write a one-page news rule set, then test it on your demo account through the next two high-impact USD releases without changing it mid-event."
  symbol: "XAUUSD"
quiz:
  - question: "Which approach generally carries the highest execution risk?"
    options:
      - "Placing buy and sell stop orders a few pips either side of price seconds before the release"
      - "Closing positions before the release"
      - "Waiting 15 minutes and trading a retest of the release candle"
      - "Reducing position size by half"
    answer: 0
    explanation: "Pending orders close to price at release time trigger during the widest spreads and fastest moves. A whipsaw can fill both, each with slippage."
  - question: "Your normal stop on EURUSD is 20 pips. For a news trade you allow for a 1.5x worse fill. With a 150 USD risk budget, what is the maximum size?"
    options:
      - "0.50 lots"
      - "0.75 lots"
      - "0.25 lots"
      - "1.00 lot"
    answer: 0
    explanation: "Worst-case distance = 20 x 1.5 = 30 pips. At 10 USD per pip per lot, 150 / (30 x 10) = 0.50 lots."
  - question: "What is the main benefit of trading the aftermath rather than the release?"
    options:
      - "It guarantees a profit"
      - "It gives a better entry price in every case"
      - "Spreads have normalised and the full data has been digested, so the direction is clearer"
      - "It avoids all slippage"
    answer: 2
    explanation: "Waiting sacrifices part of the move in exchange for normal execution conditions and a better-informed read. It does not guarantee a result or eliminate slippage."
  - question: "Which item belongs in a pre-release checklist?"
    options:
      - "Move stop losses closer to price to limit loss"
      - "Increase leverage to benefit from volatility"
      - "List open positions that share exposure to the releasing currency"
      - "Disable take-profit orders"
    answer: 2
    explanation: "Identifying correlated exposure shows the true risk from one event. Tightening stops just before news increases the chance of being stopped by a spread spike."
---

The chapters in this section covered how the calendar works, how surprises are measured, and how execution changes around a release. This final chapter brings those threads together. It compares the main ways traders handle scheduled news and ends with a checklist you can adopt and adapt.

## Four approaches to scheduled news

| Approach | What you do | Main risk |
|---|---|---|
| Stand aside | No open positions in affected symbols | Missing a move; the least risky choice |
| Reduce exposure | Hold, but at smaller size or with a wider stop | Still exposed to gaps and slippage |
| Trade the aftermath | Wait 5 to 30 minutes, then trade a defined setup | Worse entry, false follow-through |
| Trade the release | Enter at or immediately after the number | Widest spreads, heaviest slippage, whipsaws |

Most retail traders who struggle with news are using the fourth approach without realising what they are up against. Banks and high-frequency firms receive and parse the number in microseconds and have their orders in before a person can click. By the time a manual order reaches the market, the first leg of the move is usually complete, and the order joins at the point of greatest uncertainty.

## Why the straddle often disappoints

A popular idea is to place a buy stop above price and a sell stop below it just before a release, linked as an OCO pair so that one cancels the other. In theory the move triggers one side and the other is cancelled.

In practice, three things go wrong. The triggering side fills with slippage at the widest spread. A whipsaw can reverse through the entry before the cancel is processed or after the OCO is resolved, hitting the stop at a poor price. And an in-line number can trigger one side with no follow-through. The strategy can work on some releases, but its results depend heavily on execution quality, which is exactly what deteriorates at the moment you need it.

## Sizing for the worst realistic fill

The core risk principle for news is simple: size the position so that a realistic bad fill is still acceptable.

```text
Account equity: 10,000 USD. Risk budget for news trade: 1.5% = 150 USD
Instrument: EURUSD, 10 USD per pip per lot
Planned stop: 20 pips. Allowance for slippage and spread: x 1.5
Worst-case distance: 20 x 1.5 = 30 pips

Position size = 150 / (30 x 10) = 0.50 lots
Normal-conditions size would be 150 / (20 x 10) = 0.75 lots
```

The news version is a third smaller. For gold, where a 30-dollar spike is common on CPI, the same method shows how small a news position needs to be: with a 150 USD budget and a 30-dollar worst case, 150 / (30 x 100) = 0.05 lots.

Phase 5 covers position sizing in depth; the point here is that news requires its own, more conservative inputs.

## A weekly news checklist

1. Sunday or Monday: review the Economic calendar for high-impact events in every currency you trade, plus the USD.
2. Mark release times in server time on your charts.
3. For each event, note consensus, the typical surprise and the outcome that would count as large.
4. List all open or planned positions exposed to each event, including correlated ones.
5. Decide an approach per event: stand aside, reduce, or trade the aftermath with a named setup.
6. Size any news-related trade for the worst realistic fill.
7. After the event, record what happened, the spread you saw and the slippage you received.

Step 7 matters most over time. Your own records of spreads and slippage on Kalks Trader are more reliable than any rule of thumb.

## Unscheduled news

Not all news is on the calendar. Geopolitical events, surprise central-bank interventions, comments from officials and company announcements can arrive at any time. You cannot plan for the timing, but you can plan for the possibility: keep position sizes that survive a sudden gap, use the News section of the Client Area to stay informed, and avoid holding maximum leverage through weekends.

## Common mistakes

- Tightening stops just before a release, where a spread spike alone can trigger them.
- Increasing size because volatility is expected to be large.
- Changing the plan in the seconds after the number appears.
- Treating a few winning news trades as proof of an edge, rather than testing a rule over many releases on demo.

> **Risk warning:** Trading news with leveraged CFDs is high risk. Prices can move faster than orders can be executed, spreads can widen sharply and stops can slip, so losses can exceed your planned risk. No news strategy guarantees profits.
