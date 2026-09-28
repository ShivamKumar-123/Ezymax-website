---
slug: "p8-f-inflation-regimes"
title: "Inflation regimes and what they change"
summary: "Learn how low-and-stable, high-and-volatile and deflationary inflation regimes change asset correlations, real yields and the behaviour of gold, bonds and currencies."
order: 2
version: 1
takeaways:
  - "Inflation regimes change the relationships between assets, most importantly the correlation between stocks and bonds."
  - "Real yields, meaning nominal yields minus expected inflation, are a key driver of gold, growth stocks and currency valuations."
  - "Base effects can make headline inflation fall or rise sharply even when monthly price changes are stable."
  - "Sticky components such as services and wages decide how long an inflation regime lasts."
practice:
  label: "Put XAUUSD and NAS100 on a weekly chart side by side and compare how they moved during 2022 and during a calmer inflation year."
  symbol: "XAUUSD"
quiz:
  - question: "The US 10-year nominal yield is 4.30% and the 10-year breakeven inflation rate is 2.30%. What is the approximate real yield?"
    options:
      - "6.60%"
      - "2.00%"
      - "1.87%"
      - "4.30%"
    answer: 1
    explanation: "Real yield is approximately nominal yield minus expected inflation: 4.30% - 2.30% = 2.00%."
  - question: "What typically happens to the stock-bond correlation when inflation becomes high and volatile?"
    options:
      - "It tends to turn positive, so stocks and bonds can fall together"
      - "It becomes strongly negative, making bonds a better hedge"
      - "It stays exactly zero"
      - "It no longer affects portfolios"
    answer: 0
    explanation: "When inflation dominates, rising inflation hits both bonds (higher yields) and stocks (higher discount rates, margin pressure), so they often move together, as in 2022."
  - question: "Prices rose 6% last year. This year prices rise 0.2% every month. Roughly what will annual inflation be after twelve months?"
    options:
      - "6.0%"
      - "0.2%"
      - "3.6%"
      - "About 2.4%"
    answer: 3
    explanation: "Once last year's large increases drop out of the comparison, annual inflation reflects the new pace: 1.002 to the power 12 is about 1.0243, or roughly 2.4%."
  - question: "Why do central banks watch services inflation and wage growth closely?"
    options:
      - "Because they are the most volatile components"
      - "Because they are set by the central bank"
      - "Because they tend to be persistent and signal whether inflation is embedded"
      - "Because they are excluded from core inflation"
    answer: 2
    explanation: "Goods and energy prices can reverse quickly, but services prices and wages adjust slowly, so they indicate whether inflation has become entrenched."
---

In Phase 3 you learned how CPI and PCE are measured and why central banks care. Here the focus shifts from individual releases to **inflation regimes**: long periods in which inflation behaves in a characteristic way. The regime matters because it changes how assets relate to each other, which in turn changes how you hedge, diversify and size positions.

## Three broad inflation regimes

| Regime | Typical features | Market consequences |
|---|---|---|
| Low and stable (roughly 1% to 3%) | Anchored expectations, credible central banks | Bonds hedge equities; volatility tends to be low; growth stocks favoured |
| High and volatile (above 4% and unstable) | Supply shocks, wage-price feedback, policy behind the curve | Stocks and bonds can fall together; commodities and value sectors hold up better; rate volatility high |
| Deflationary or near zero | Weak demand, excess debt, falling prices | Bonds rally, yields near zero, safe-haven currencies strong, central banks use unconventional tools |

Most of the period from the late 1990s to 2020 was the first regime in developed economies. The years 2021 to 2023 were a sharp move into the second. Japan spent much of the 1990s and 2000s in the third.

## The stock-bond correlation

The single most important consequence of an inflation regime is the sign of the correlation between equities and government bonds.

When inflation is low and stable, the main shock to markets is growth. Bad growth news hurts stocks and pushes yields down, so bonds rise. The two assets offset each other, and a balanced portfolio is well diversified.

When inflation is high, the main shock is inflation itself. An upside CPI surprise raises rate expectations, which pushes bond prices down and also raises the discount rate applied to company earnings. Stocks and bonds fall together. In 2022 both US equities and long-dated Treasuries had among their worst years in decades at the same time.

For a CFD trader this matters in two ways. First, a long SPX500 position combined with a long bond-proxy position (or long JPY as a haven) may not diversify at all in a high inflation regime. Second, index reactions to CPI releases become much larger when inflation is the dominant theme, so position sizes around those releases need to be smaller.

## Real yields: the price of money after inflation

The real yield is the nominal yield minus expected inflation. It is the true return on holding safe government debt, and it acts as a hurdle rate for every other asset.

```text
10-year nominal yield           4.30%
10-year breakeven inflation     2.30%
Approximate 10-year real yield  4.30% - 2.30% = 2.00%

Six months later:
Nominal yield                   4.10%
Breakeven inflation             2.60%
Real yield                      4.10% - 2.60% = 1.50%
```

Nominal yields fell only 20 basis points, but real yields fell 50. Falling real yields reduce the opportunity cost of holding gold, which pays no interest, and they support long-duration assets such as growth stocks. In Phase 5 you saw the gold and real yield link; the regime lens adds that the link has weakened at times, for example when central bank gold buying was strong enough to lift gold despite high real yields. Treat the relationship as a strong tendency, not a law.

## Base effects and persistence

Annual inflation compares today's price level with the level twelve months ago. That creates base effects.

> **Example:** A price index rises from 100 to 106 over a year, so inflation is 6%. Over the next twelve months prices rise a steady 0.2% per month. After twelve months the index is about 106 x 1.0243 = 108.58, and annual inflation is roughly 2.4%. Headline inflation has collapsed, yet nothing dramatic happened in any single month. Markets that focus on the annual rate can overreact; professionals watch three-month and six-month annualised rates to see the current pace.

Whether a regime persists depends on the sticky parts of the price basket. Energy and goods prices can reverse in months. Services, rents and wages adjust slowly, and when they are rising fast, inflation tends to stay high even after the original shock fades. That is why central banks focus on core services ex-housing, wage growth and inflation expectations surveys.

## Signposts of a regime change

Watch for these when judging whether inflation is shifting regime:

- Three-month annualised core inflation moving persistently above or below the central bank target.
- Wage growth running well above productivity growth plus the inflation target.
- Long-term inflation expectations (breakevens, consumer surveys) drifting away from target.
- The stock-bond correlation changing sign over rolling three-month windows.
- Central banks changing language from patience to urgency, or the reverse.

## In practice

When the inflation regime is uncertain, reduce reliance on any single hedge. Check whether your open positions are really diversified by asking what an upside CPI surprise would do to each of them. If the answer is that they all lose, you effectively have one large trade. Use the economic calendar in the Client Area to mark CPI, PCE and wage data, and consider cutting size before those releases when inflation is the market's main theme.

> **Risk warning:** Inflation releases can move indices, gold and USD pairs sharply within seconds, with wider spreads and slippage. CFDs are leveraged and losses can exceed what you planned; size positions for the regime's volatility, not a calm market's.
