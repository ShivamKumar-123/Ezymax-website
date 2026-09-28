---
slug: "p8-f-business-cycle-regimes"
title: "The business cycle and macro regimes"
summary: "Use the direction of growth and inflation to classify the macro regime, and understand why the same news moves markets differently in each one."
order: 1
version: 1
takeaways:
  - "A macro regime is defined by the direction of change in growth and inflation, not by their absolute levels."
  - "The four classic regimes (goldilocks, reflation, stagflation and disinflationary slowdown) tend to favour different assets and currencies."
  - "Markets price the rate of change, so a regime shift usually shows up in leading indicators and prices before it shows up in GDP."
  - "Regime labels are probabilistic tools for setting bias and risk, not signals that time individual trades."
practice:
  label: "Open weekly charts of NAS100, XAUUSD and AUDUSD on your demo account and note how each behaved during the last clear change in PMI direction."
  symbol: "NAS100"
quiz:
  - question: "Which combination best describes a reflation regime?"
    options:
      - "Growth slowing, inflation falling"
      - "Growth accelerating, inflation rising"
      - "Growth slowing, inflation rising"
      - "Growth accelerating, inflation falling"
    answer: 1
    explanation: "Reflation is accelerating growth together with rising inflation. Growth up with inflation down is goldilocks; growth down with inflation up is stagflation."
  - question: "Why do regime frameworks focus on the rate of change rather than the level of growth?"
    options:
      - "Because GDP levels are not published"
      - "Because central banks ignore levels"
      - "Because prices react to whether conditions are improving or deteriorating relative to expectations"
      - "Because levels are always negative in a recession"
    answer: 2
    explanation: "Markets discount the future, so a weak economy that is getting less weak can see rising risk assets. The level matters less than the direction and the surprise versus what was priced."
  - question: "In a stagflation regime, which outcome has historically been most common?"
    options:
      - "Stocks and bonds both come under pressure while some commodities hold up"
      - "Bonds rally strongly while stocks rise"
      - "Commodity currencies outperform in every case"
      - "Volatility falls to multi-year lows"
    answer: 0
    explanation: "Rising inflation pushes yields up (bonds fall) while slowing growth hurts earnings (stocks fall). Real assets such as energy or gold have tended to hold up better, although nothing is guaranteed."
  - question: "The ISM manufacturing PMI moves from 47 to 51 over four months while core inflation keeps easing. What regime tilt does this suggest?"
    options:
      - "Stagflation"
      - "Disinflationary slowdown"
      - "Reflation"
      - "Goldilocks"
    answer: 3
    explanation: "Growth indicators are improving while inflation is falling, which is the goldilocks combination. Reflation would need inflation to be rising as well."
---

Every earlier phase gave you tools to read a single data release or a single chart. At the professional level the question changes: *what kind of environment are we in, and which assets does that environment tend to reward?* That environment is called the macro regime. Knowing it does not tell you where EURUSD will be at 15:00 tomorrow, but it tells you which direction deserves the benefit of the doubt and how much risk the backdrop can carry.

## The business cycle in four phases

Economies move through expansion, slowdown, contraction and recovery. The length of each phase varies enormously: some US expansions lasted over a decade, while the 2020 recession lasted two months. What matters for traders is less the textbook sequence and more the observable signals:

- **Recovery:** output is below potential but improving; central banks are still easy; credit spreads tighten.
- **Expansion:** growth above trend, unemployment falling, profits rising; central banks start to normalise rates.
- **Slowdown:** growth still positive but decelerating; inflation often peaks late; policy is tight.
- **Contraction:** output falling, unemployment rising, central banks cutting.

Because GDP is published quarterly and revised, professionals watch faster indicators: PMIs, weekly jobless claims, the yield curve, credit spreads, and cyclical prices such as copper and oil.

## Two axes: growth and inflation

A more practical framework reduces the cycle to two questions. Is growth accelerating or decelerating? Is inflation accelerating or decelerating? That gives four regimes.

```svg
<svg viewBox="0 0 560 360" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <line x1="280" y1="30" x2="280" y2="330" stroke="#3a3a44" stroke-width="2"/>
  <line x1="40" y1="180" x2="520" y2="180" stroke="#3a3a44" stroke-width="2"/>
  <text x="530" y="176" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="end">Growth rising</text>
  <text x="44" y="176" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Growth falling</text>
  <text x="286" y="24" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Inflation rising</text>
  <text x="286" y="348" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Inflation falling</text>
  <text x="400" y="80" fill="#ff5a1f" font-family="Inter, Arial, sans-serif" font-size="14" text-anchor="middle">REFLATION</text>
  <text x="400" y="102" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Cyclicals, commodities,</text>
  <text x="400" y="118" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">AUD, CAD; bonds weak</text>
  <text x="160" y="80" fill="#ef4444" font-family="Inter, Arial, sans-serif" font-size="14" text-anchor="middle">STAGFLATION</text>
  <text x="160" y="102" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Energy, gold; stocks</text>
  <text x="160" y="118" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">and bonds both weak</text>
  <text x="400" y="240" fill="#22c55e" font-family="Inter, Arial, sans-serif" font-size="14" text-anchor="middle">GOLDILOCKS</text>
  <text x="400" y="262" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Equities, growth stocks,</text>
  <text x="400" y="278" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">low volatility, carry</text>
  <text x="160" y="240" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="14" text-anchor="middle">DISINFLATIONARY SLOWDOWN</text>
  <text x="160" y="262" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Government bonds, JPY,</text>
  <text x="160" y="278" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">CHF, USD; cyclicals weak</text>
</svg>
```

The tendencies in each quadrant come from simple logic. When growth improves and inflation cools, earnings rise while central banks have no reason to tighten, so equities and carry trades do well. When both rise, commodities and commodity currencies benefit but bonds sell off as rate expectations climb. When inflation rises as growth falls, the central bank cannot rescue the economy, so stocks and bonds can fall together, as in 2022. When both fall, investors move towards duration and safe havens.

> **Note:** These are historical tendencies, not rules. In 2022 the US dollar rallied hard in a stagflation-like regime because the Fed was tightening faster than other central banks. Relative policy often matters more than the quadrant for currencies.

## Why the rate of change matters most

Markets discount the future. A PMI of 46 is a contracting economy, but if the previous three readings were 43, 44 and 45, the direction is improving. Equity indices often bottom while the economic news is still terrible, because the second derivative has turned. Conversely, a strong but decelerating economy can see risk assets struggle.

This is why professionals track **three-month or six-month changes** in indicators rather than single prints, and why surprise indices (actual data versus consensus) are popular: they measure whether reality is beating or missing what was priced.

> **Example:** Over four months the manufacturing PMI moves 47.2, 48.1, 49.6, 51.0 while the three-month annualised core CPI falls from 3.8% to 2.6%. Growth momentum is up 3.8 points and inflation momentum is down 1.2 points. That is a goldilocks tilt. A trader might lean towards buying dips in NAS100 and SPX500, be cautious about being long JPY or CHF against higher-yielding currencies, and treat gold as neutral because falling real yields help it while strong risk appetite does not.

## Using the regime in practice

A regime is a filter, not an entry signal. A workable process:

1. Once a month, score growth momentum and inflation momentum as rising, flat or falling using a fixed set of indicators.
2. Place the economy in a quadrant and note your confidence (for example 60%).
3. Write down which asset classes the regime historically favours and which it penalises.
4. Let the regime shift your technical bias and position size, for example taking full-size longs in favoured assets and half-size trades against the regime.
5. Define in advance what data would move you to a different quadrant.

Different economies can sit in different quadrants at the same time. The US may be in goldilocks while the eurozone is in a disinflationary slowdown, and that divergence is exactly what drives EURUSD trends.

## Common mistakes

- **Relabelling every month.** One weak print does not change a regime. Require several indicators to agree.
- **Confusing level with direction.** High inflation that is falling is a different regime from low inflation that is rising.
- **Treating the quadrant as a trade.** A favourable regime does not stop a 5% correction in NAS100. Technical risk management still decides entries and stops.
- **Ignoring relative regimes.** Currency pairs are relative prices; you need a view on both economies.

> **Risk warning:** Macro frameworks improve context but do not make outcomes predictable. CFDs are leveraged, and positions held for weeks on a macro view carry overnight swaps and weekend gap risk. Losses can be larger than you expect.
