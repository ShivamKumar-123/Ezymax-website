---
slug: "p5-f-equities-and-risk-appetite"
title: "Equities and risk appetite"
summary: "How stock indices act as a gauge of risk appetite, why yields move growth stocks, and which currencies tend to follow or oppose equities."
order: 5
version: 1
takeaways:
  - "Equity indices are the most visible gauge of risk appetite; when they fall sharply, safe-haven currencies such as JPY and CHF tend to strengthen and risk-sensitive currencies such as AUD tend to weaken."
  - "Higher bond yields reduce the present value of future earnings, which is why long-duration growth indices like NAS100 are especially sensitive to rising yields."
  - "The relationship between stocks and bonds changes with the inflation regime: they usually move in opposite directions when inflation is low and can fall together when inflation is the main worry."
  - "A cross-asset checklist (indices, yields, USDJPY or AUDJPY, gold) helps you judge whether a move is broad risk sentiment or a local story."
practice:
  label: "On your demo account, open NAS100 and AUDJPY on the H1 timeframe and compare their direction on the day of the next major US data release."
  symbol: "NAS100"
quiz:
  - question: "Global stock indices fall 3% in a day on a banking scare. Which move is most typical?"
    options:
      - "AUDJPY rises"
      - "Commodity currencies outperform"
      - "Gold falls sharply as a safe haven is abandoned"
      - "USDJPY falls as the yen strengthens"
    answer: 3
    explanation: "In risk-off episodes the yen typically strengthens as carry trades are unwound and investors repatriate funds, so USDJPY tends to fall. AUDJPY usually falls too."
  - question: "Why do rising bond yields tend to hurt NAS100 more than an index with more banks and energy companies?"
    options:
      - "Because technology companies pay more tax"
      - "Because growth companies' value depends more on earnings far in the future, which are discounted more heavily at higher yields"
      - "Because NAS100 is priced in euros"
      - "Because banks cannot trade when yields rise"
    answer: 1
    explanation: "Like long-dated bonds, growth stocks have 'long duration': much of their value lies in distant earnings, so a higher discount rate cuts their present value more. Banks can even benefit from higher yields."
  - question: "In 2022 both stocks and government bonds fell heavily. What regime explains this?"
    options:
      - "A period in which high inflation forced rapid rate hikes, hurting both asset classes"
      - "A deflationary recession"
      - "A period of falling interest rates"
      - "A normal year with no unusual conditions"
    answer: 0
    explanation: "When inflation is the main risk, rising rates push bond prices down and equity valuations down at the same time, so the usual diversification between the two breaks down."
  - question: "What is the S&P 500 earnings yield if the index trades at 20 times forward earnings?"
    options:
      - "20%"
      - "2%"
      - "5%"
      - "0.5%"
    answer: 2
    explanation: "Earnings yield is the inverse of the price-to-earnings ratio: 1 / 20 = 0.05, or 5%. Comparing it with bond yields shows how much extra return equities offer over risk-free assets."
---

Stock indices do more than reflect company profits. Because equities are the asset most sensitive to the economic outlook and most widely owned, their direction is a real-time reading of investors' willingness to take risk. When US30, SPX500 and NAS100 rise together, money tends to flow towards higher-yielding and growth-linked assets. When they fall hard, it flows towards safety. Knowing these patterns lets you read the mood of the whole market from a few charts.

## Stocks as a gauge of risk appetite

Two broad states are often described:

- **Risk-on:** equities rise, credit spreads narrow, commodity currencies (AUD, NZD, CAD) firm, the yen and Swiss franc soften, and volatility falls.
- **Risk-off:** equities fall, investors buy government bonds (yields fall), the yen and franc strengthen, gold often firms, and volatility jumps.

The yen's behaviour deserves explanation. Japan has had very low interest rates for decades, so investors have borrowed in yen to buy higher-yielding assets abroad, known as the carry trade. When fear rises, those positions are closed, the borrowed yen must be bought back and the yen strengthens. Japanese investors also bring money home in crises. Phase 6 covers the carry trade and sentiment measures such as the VIX in more depth.

## Why yields move stock prices

A share is a claim on future earnings. Its fair value is the present value of those earnings, discounted at a rate that includes the bond yield. When yields rise, the discount rate rises and fair value falls, just as with a bond.

The effect is uneven. Companies whose earnings are expected far in the future, typically high-growth technology firms, behave like long-duration bonds. This is why NAS100 often moves inversely with the US 10-year yield on data days, while an index with more banks, energy producers and industrial companies can be less affected. Banks can even benefit from higher yields because their lending margins improve.

A simple valuation cross-check is the **earnings yield**, the inverse of the price-to-earnings ratio.

```text
S&P 500 at 20x forward earnings
Earnings yield = 1 / 20 = 5.0%
US 10-year yield = 4.3%

Equity yield gap = 5.0% - 4.3% = 0.7 percentage points
```

A narrow gap means investors receive little extra return for owning shares instead of risk-free bonds. It does not predict the next move, but it helps explain why equities can be vulnerable when yields rise from already high levels.

## The stock-bond relationship depends on inflation

For most of the two decades before 2021, stocks and bonds tended to move in opposite directions. Growth scares pushed stocks down and bond prices up, so a mixed portfolio was cushioned.

When inflation became the main concern in 2022, the pattern broke. Rapid rate hikes pushed bond prices down and equity valuations down at the same time, and both asset classes suffered heavy losses in the same year. The lesson for a trader: the direction of the correlation depends on whether the market fears **growth** (stocks and yields fall together) or **inflation** (stocks fall as yields rise).

> **Example:** US CPI is released well above consensus. The 10-year yield jumps from 4.20% to 4.35%, NAS100 falls from 18,400 to 18,050 (about 1.9%), US30 falls from 39,200 to 38,850 (about 0.9%), and USDJPY rises from 150.00 to 151.20. This is an inflation-driven reaction: higher yields hit the growth-heavy index hardest, and the dollar gains on higher US rates rather than weakening on risk-off.

## A cross-asset checklist

When an index moves sharply, check a few related markets before drawing conclusions:

| Check | Risk-off confirmation | Inflation or rates shock |
|---|---|---|
| US 10-year yield | Falling | Rising |
| USDJPY | Falling (yen bid) | Often rising |
| AUDJPY | Falling | Mixed |
| XAUUSD | Often rising | Often falling |
| NAS100 vs US30 | Both down | NAS100 weaker |

If the other markets do not confirm the move, it may be a stock-specific or sector story, for example one heavyweight such as NVDA or AAPL reporting earnings, rather than a change in global risk appetite.

## In practice

- Before trading AUDUSD or a JPY cross, look at the index futures and the direction of the major indices.
- Before trading NAS100, check the direction of US yields.
- During earnings season, remember that a handful of mega-cap shares carry a large share of NAS100 and SPX500, so one report can move the whole index.

Common mistakes include assuming "stocks down means yields down" in every regime, and treating risk-on and risk-off as permanent states when they can switch within a single session.

> **Risk warning:** Index CFDs can gap at the open and move sharply on data and earnings. CFDs are leveraged, so losses can exceed your planned risk if price jumps through your stop.
