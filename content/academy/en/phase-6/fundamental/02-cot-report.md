---
slug: "p6-f-cot-report"
title: "The Commitments of Traders report"
summary: "What the weekly COT report shows about futures positioning in currencies, gold, oil and indices, and how to turn it into a useful sentiment gauge."
order: 2
version: 1
takeaways:
  - "The COT report, published by the CFTC every Friday, shows futures positions as of the previous Tuesday, so it is a slow, lagged view of positioning."
  - "For currencies and indices the most watched group is leveraged funds; for commodities such as gold and oil it is managed money."
  - "Positioning is most informative at extremes, measured relative to its own history, and it tells you where a crowded trade could unwind rather than when."
  - "Use the COT as background context for risk and trade selection, never as a timing signal on its own."
quiz:
  - question: "A COT report released on Friday reflects positions held as of which day?"
    options:
      - "The previous Tuesday"
      - "The same Friday"
      - "The previous Monday"
      - "The last trading day of the month"
    answer: 0
    explanation: "The CFTC collects positions as of Tuesday's close and publishes them on Friday afternoon US time, so the data is already three days old when you read it."
  - question: "Leveraged funds hold 105,000 long and 45,000 short CME euro futures, each for 125,000 euros. What is their net position in euros?"
    options:
      - "5.6 billion euros net short"
      - "13.1 billion euros net long"
      - "60,000 euros net long"
      - "7.5 billion euros net long"
    answer: 3
    explanation: "Net contracts = 105,000 - 45,000 = 60,000. 60,000 x 125,000 = 7,500,000,000 euros, or 7.5 billion net long."
  - question: "Why is an extreme net long position by speculators considered a risk signal?"
    options:
      - "Because the CFTC forces speculators to close positions at extremes"
      - "Because most willing buyers are already in, so bad news can trigger a crowded exit"
      - "Because it guarantees that price will reverse the following week"
      - "Because commercial hedgers are always right"
    answer: 1
    explanation: "An extreme shows the trade is crowded. It does not guarantee a reversal or give timing, but it means the pool of new buyers is smaller and a surprise can force many holders to sell at once."
  - question: "Which statement about using the COT for trading is most accurate?"
    options:
      - "It is best used to time intraday entries"
      - "It shows positions in the spot FX and CFD markets directly"
      - "It is context about crowding, to be combined with price action and fundamentals"
      - "Rising open interest always means prices will rise"
    answer: 2
    explanation: "COT covers regulated US futures only, arrives with a lag and says nothing about timing. It is most useful as background context on how crowded a theme is."
---

Price tells you what the market did. Positioning tells you *who is already in the trade*. That second question matters because markets move when people change their minds, and the people most able to change their minds quickly are the ones who already hold large positions. The most widely used public source of positioning data is the **Commitments of Traders (COT)** report, published by the US Commodity Futures Trading Commission (CFTC).

## What the report contains

Every week the CFTC collects the positions of large traders in US-regulated futures markets and publishes a summary. The data is taken as of **Tuesday's close** and released on **Friday afternoon, US Eastern time**. By the time you read it, it is already three trading days old, and more if a holiday delays publication.

The report covers the futures markets that matter to Ezymex traders: CME currency futures (euro, yen, pound, Australian dollar, Canadian dollar, Swiss franc), COMEX gold and silver, NYMEX crude oil, and equity index futures such as the E-mini S&P 500, Nasdaq 100 and Dow. Your CFDs on EURUSD, XAUUSD, USOIL or NAS100 are not in the report themselves, but the futures on the same underlying are, and they reflect the same macro bets.

There are three main versions:

| Report | Used for | Key trader groups |
|---|---|---|
| Legacy | All markets, longest history | Commercials, non-commercials, non-reportables |
| Traders in Financial Futures | Currencies, indices, rates | Dealers, asset managers, leveraged funds, other reportables |
| Disaggregated | Physical commodities such as gold and oil | Producers and merchants, swap dealers, managed money, other reportables |

For currency and index futures, **leveraged funds** (mostly hedge funds and trading advisers) are the fast, speculative money. For gold and oil, the equivalent group is **managed money**. **Asset managers** tend to hold slower, longer-horizon positions, while **commercials** and **producers** are mainly hedging real business exposure.

## From contracts to a position you can read

Raw contract numbers mean little on their own. Convert them into net positions and then compare them with history.

```text
CME euro futures: 1 contract = 125,000 EUR

Leveraged funds long      118,000 contracts
Leveraged funds short      48,000 contracts
Net position               70,000 contracts long

Net in euros = 70,000 x 125,000 = 8,750,000,000 EUR
Approx. in USD at EURUSD 1.0850 = 8.75bn x 1.0850 = 9.49bn USD

3-year range of net position: -20,000 (min) to +80,000 (max)
Positioning index = (70,000 - (-20,000)) / (80,000 - (-20,000))
                  = 90,000 / 100,000 = 90%
```

A reading of 90% means leveraged funds are close to the most bullish they have been on the euro in three years. The same method works for gold (1 COMEX contract = 100 troy ounces) or crude oil (1 NYMEX WTI contract = 1,000 barrels). Some traders use a z-score instead of a range index; the idea is the same.

The weekly *change* is also useful. A large jump in net longs during a week when price barely moved suggests buyers are absorbing supply; a drop in net longs while price keeps rising suggests speculators are taking profits into strength, so the rally is being carried by other participants and may have less speculative fuel behind it.

## How to use positioning

Positioning works best at extremes and as a risk filter.

- **Crowded trades are fragile.** When speculators are near a multi-year extreme long, most of the people who wanted to buy have already bought. If the news turns, they all head for the same exit and the move against them can be fast.
- **Extremes can persist.** A crowded trade can stay crowded for months while price keeps trending. Positioning tells you where the fuel for a reversal is stored, not when it will ignite.
- **Confirm with price.** A useful combination is an extreme positioning reading plus a clear break in market structure, such as a lower high and a lower low on the daily chart after a long uptrend.
- **Watch for divergence with fundamentals.** If speculators are heavily short the yen while the Bank of Japan is turning more hawkish, the gap between positioning and fundamentals is exactly where sharp unwinds come from.

> **Example:** Suppose managed money holds a net long in gold that is in the top 5% of its five-year range, while XAUUSD has rallied from 2,180 to 2,350 in six weeks. On a Friday, US inflation data comes in hot and real yields jump. Gold falls to 2,310 on the day and then breaks below the previous swing low at 2,295 the following week. The positioning did not predict the drop, but it explains why the drop was fast: many long holders were exiting at once.

## Limitations

The COT has real weaknesses, and a disciplined trader keeps them in mind:

- **Lag.** Tuesday data, Friday release. In fast markets the picture may already have changed.
- **Partial view.** Futures are a small share of the global FX market, which trades mostly over the counter. Currency COT data is a sample of speculative sentiment, not the whole market.
- **Classification is imperfect.** A trader's category is based on their main business, and some hedging and speculative activity is mixed together.
- **No US dollar contract in most analyses.** Dollar positioning is usually estimated by summing the positions in the other currency futures, which is an approximation.

## Common mistakes

- **Treating an extreme as a sell signal by itself.** Extreme longs can get more extreme. Always wait for price to confirm.
- **Comparing raw numbers across years.** Market size changes; use a range index or z-score over a consistent look-back.
- **Ignoring the lag.** If a huge move happened on Wednesday and Thursday, Friday's report does not include it.
- **Reading commercials as smart money in every market.** In currencies and indices, dealers are often on the other side of client flow, so their position reflects hedging rather than a directional view.

A practical routine is to update a small positioning table every weekend for the markets you trade: net position, positioning index and weekly change. Then read it alongside the economic calendar in the Client Area when planning the week ahead.
