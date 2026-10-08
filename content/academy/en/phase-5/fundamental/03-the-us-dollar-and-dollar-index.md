---
slug: "p5-f-us-dollar-and-dollar-index"
title: "The US dollar and the dollar index"
summary: "Why the dollar sits at the centre of global markets, how the dollar index is built, and how to separate a broad dollar move from a single-currency story."
order: 3
version: 1
takeaways:
  - "The US dollar is on one side of almost 90% of all FX transactions and is the pricing currency for gold, oil and most commodities, so its moves ripple through every asset class."
  - "The dollar index (DXY) is a weighted basket of six currencies in which the euro alone carries about 57.6%, so it is heavily influenced by EURUSD."
  - "Comparing several USD pairs tells you whether a move is broad dollar strength or a story specific to one currency."
  - "The dollar tends to strengthen both when US growth outperforms and during global panics, a pattern often called the dollar smile."
practice:
  label: "Open EURUSD, GBPUSD, USDJPY and AUDUSD on your demo account in a four-chart layout on the H1 timeframe and identify one hour in which all four moved in the dollar's favour."
  symbol: "EURUSD"
quiz:
  - question: "Which currency has the largest weight in the US dollar index (DXY)?"
    options:
      - "Japanese yen"
      - "Chinese yuan"
      - "Euro"
      - "British pound"
    answer: 2
    explanation: "The euro carries about 57.6% of the DXY. The yuan is not in the index at all, which is one of the main criticisms of the DXY as a measure of the dollar's global value."
  - question: "In one session EURUSD falls 0.6%, GBPUSD falls 0.5%, AUDUSD falls 0.7% and USDJPY rises 0.6%. What is the most likely explanation?"
    options:
      - "A euro-specific political problem"
      - "Broad US dollar strength"
      - "Broad yen strength"
      - "A random coincidence with no common driver"
    answer: 1
    explanation: "Every pair moved in the dollar's favour by a similar amount, which points to a USD driver such as US data or yields rather than a story about one other currency."
  - question: "If the dollar strengthens broadly, what is the typical first-order effect on XAUUSD and USOIL, all else equal?"
    options:
      - "Both tend to fall, because they become more expensive for non-dollar buyers"
      - "Both tend to rise, because they are priced in dollars"
      - "Gold rises and oil falls"
      - "There is no connection between the dollar and commodity prices"
    answer: 0
    explanation: "Commodities are priced in dollars, so a stronger dollar raises their cost in other currencies and tends to reduce demand, pushing dollar prices lower. Other factors can override this."
  - question: "What does the 'dollar smile' describe?"
    options:
      - "The dollar strengthens in the Asian session and weakens in New York"
      - "The dollar tends to strengthen when US growth is strong and when global markets are in crisis, and to weaken in between"
      - "The dollar always rises after a Federal Reserve meeting"
      - "The dollar index cannot fall below 100"
    answer: 1
    explanation: "The dollar smile is a framework: both ends of the smile (US outperformance and global risk aversion) are dollar-positive, while a calm, synchronised global expansion tends to be dollar-negative."
---

If you could follow only one price outside your own chart, the US dollar would be the sensible choice. It is the world's main reserve currency, the currency in which gold, oil and most commodities are priced, and one side of almost nine in ten FX transactions. Many moves that look like a EURUSD or XAUUSD story are really a dollar story. This chapter shows how to measure the dollar and how to tell a broad dollar move from a local one.

## Why the dollar is central

Several structural facts give the dollar its weight:

- **Reserve currency.** Central banks hold the majority of their foreign reserves in dollars, mostly as US Treasuries.
- **Funding currency.** A large share of international borrowing is in dollars. When the dollar rises, repaying those debts becomes harder for non-US borrowers, which can tighten global financial conditions.
- **Pricing currency.** Oil, gold, copper and most grains are quoted in dollars. A stronger dollar makes them more expensive in euros, yen or rupees, which tends to reduce demand and push dollar prices down.
- **Safe-haven demand.** In a global panic investors sell risky assets and buy Treasuries and dollars.

## The dollar index (DXY)

The dollar index measures the dollar against a fixed basket of six currencies. It was set at 100 in March 1973 and uses a geometric weighting that has not changed since the euro replaced its predecessor currencies in 1999.

| Currency | Weight in DXY |
|---|---|
| Euro (EUR) | 57.6% |
| Japanese yen (JPY) | 13.6% |
| British pound (GBP) | 11.9% |
| Canadian dollar (CAD) | 9.1% |
| Swedish krona (SEK) | 4.2% |
| Swiss franc (CHF) | 3.6% |

Two consequences follow. First, the DXY is largely an inverted EURUSD: when EURUSD rises the index almost always falls. Second, it ignores major trading partners such as China and Mexico, so broader trade-weighted indices published by the Federal Reserve give a more complete picture of the dollar's value.

> **In Ezymex Trader:** A dollar index symbol may not be offered on your account. You can build the same picture by watching a group of USD pairs side by side, which is often more informative because it shows you which currencies are driving the move.

## Broad move or single-currency story?

The practical skill is diagnosis. Compare the percentage change over the same period across several USD pairs.

```text
London morning, percentage change since 08:00 server time

EURUSD  1.0850 -> 1.0785   -0.60%   dollar stronger
GBPUSD  1.2700 -> 1.2637   -0.50%   dollar stronger
AUDUSD  0.6600 -> 0.6554   -0.70%   dollar stronger
USDJPY  150.00 -> 150.90   +0.60%   dollar stronger

All four agree and the moves are similar in size -> broad USD driver
```

A broad move points you to US news: data, Fed speakers, Treasury yields. If only EURUSD falls while the other pairs are flat, the story is European, and a USD-based view on gold or US30 would not be supported.

This diagnosis also helps with trade selection. If you want to express a view on dollar strength, choose the pair where the other currency is weakest. If you want to express a view on euro weakness, EURJPY or a cross may isolate it better than EURUSD.

## The dollar smile

A widely used framework describes the dollar's behaviour across economic conditions:

1. **Left side of the smile: global stress.** Risk aversion drives money into Treasuries and dollars. The dollar rises even if US conditions are poor.
2. **Middle: synchronised global growth.** Capital looks for higher returns abroad; the dollar tends to drift lower and commodity currencies such as AUD often do well.
3. **Right side: US outperformance.** Strong US growth and a relatively hawkish Fed attract capital; the dollar rises.

The smile is a mental model, not a law. The yen and Swiss franc can outperform the dollar in some crises, particularly when the shock originates in the United States.

> **Example:** A trader is long XAUUSD at 2,350.40 because of geopolitical tension. Strong US retail sales and a jump in the 2-year yield then push the dollar higher across the board. Gold slips to 2,338 even though the geopolitical story is unchanged. The dollar move, the right side of the smile, has outweighed the safe-haven bid.

## Common mistakes

- **Trading several USD pairs as if they were separate ideas.** Long EURUSD, long GBPUSD and short USDCHF is largely one position: short the dollar. The technical chapter on correlation shows how to size this.
- **Ignoring the dollar when trading gold, oil or US indices.** A stronger dollar is a headwind for all three, all else equal.
- **Reading the DXY as the whole dollar.** With 57.6% in euros, a euro-specific shock can move the index without any change in the dollar's value against other currencies.

> **Risk warning:** A broad dollar move can hit several of your open positions at once. CFDs are leveraged, and losses across correlated positions can exceed what each trade looked like on its own.
