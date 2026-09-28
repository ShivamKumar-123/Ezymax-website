---
slug: "p5-f-the-yield-curve"
title: "The yield curve: shape, shifts and signals"
summary: "Read normal, flat and inverted curves, recognise bull and bear steepening or flattening, and understand what each shift says about policy and growth."
order: 2
version: 1
takeaways:
  - "The yield curve plots government yields against maturity; a normal curve slopes upward because lenders usually demand more to lock money away for longer."
  - "An inverted curve, with short yields above long yields, signals that markets expect policy rates to fall, often because growth is expected to weaken."
  - "The four curve moves (bull steepener, bear steepener, bull flattener, bear flattener) tell you whether the short end or the long end is driving the market."
  - "Inversions have preceded most US recessions, but the lag is long and variable, so the curve is a backdrop for positioning, not a timing tool."
quiz:
  - question: "The US 2-year yield is 4.70% and the 10-year yield is 4.25%. How is the 2s10s spread quoted and what does it indicate?"
    options:
      - "+45 bp, a normal upward-sloping curve"
      - "-45 bp, an inverted curve"
      - "-4.25%, an extremely steep curve"
      - "+0.45 bp, a flat curve"
    answer: 1
    explanation: "The 2s10s spread is the 10-year minus the 2-year: 4.25% - 4.70% = -0.45%, or -45 bp. A negative spread means the curve is inverted."
  - question: "The 2-year yield falls 0.30% and the 10-year yield falls 0.05% in a week. What is this move called?"
    options:
      - "Bear flattener"
      - "Bear steepener"
      - "Bull flattener"
      - "Bull steepener"
    answer: 3
    explanation: "Yields fell (bull) and the short end fell more, so the gap between 10-year and 2-year widened (steepener). This is typical when markets start pricing rate cuts."
  - question: "Why does an inverted curve often appear before an economic slowdown?"
    options:
      - "Because governments stop issuing long-term bonds"
      - "Because markets expect the central bank to cut rates in the future, pulling long yields below current short yields"
      - "Because inflation must be negative for the curve to invert"
      - "Because banks are legally required to buy short-term bonds"
    answer: 1
    explanation: "Long yields embed expected future short rates. If the market expects cuts after a period of tight policy, the long end trades below the short end."
  - question: "A hawkish central-bank surprise pushes the 2-year yield up 0.25% and the 10-year yield up 0.08%. Which description fits?"
    options:
      - "Bear flattener"
      - "Bull steepener"
      - "Bear steepener"
      - "Bull flattener"
    answer: 0
    explanation: "Yields rose (bear) and the short end rose more than the long end, so the curve flattened. This is the classic reaction to a more hawkish policy outlook."
---

The previous chapter looked at individual yields. Put all the maturities of one government's bonds on a single chart and you get the **yield curve**, one of the most watched indicators in macro analysis. Its shape summarises what the market expects from the central bank, from growth and from inflation, and changes in that shape often lead moves in currencies, gold and equity indices.

## Drawing the curve

The horizontal axis shows time to maturity (3 months, 2 years, 5 years, 10 years, 30 years) and the vertical axis shows the yield. The most quoted summary is the **2s10s spread**: the 10-year yield minus the 2-year yield, expressed in basis points.

```svg
<svg viewBox="0 0 640 340" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <line x1="70" y1="280" x2="600" y2="280" stroke="#3a3a44"/>
    <line x1="70" y1="40" x2="70" y2="280" stroke="#3a3a44"/>
    <line x1="70" y1="100" x2="600" y2="100" stroke="#3a3a44" stroke-dasharray="3 5"/>
    <line x1="70" y1="160" x2="600" y2="160" stroke="#3a3a44" stroke-dasharray="3 5"/>
    <line x1="70" y1="220" x2="600" y2="220" stroke="#3a3a44" stroke-dasharray="3 5"/>
    <text x="30" y="104">5%</text>
    <text x="30" y="164">4%</text>
    <text x="30" y="224">3%</text>
    <text x="90" y="300">3m</text>
    <text x="190" y="300">2y</text>
    <text x="300" y="300">5y</text>
    <text x="420" y="300">10y</text>
    <text x="555" y="300">30y</text>
    <text x="270" y="325">Maturity</text>
    <text x="14" y="30">Yield</text>
    <polyline points="100,235 200,200 310,175 430,150 565,135" fill="none" stroke="#22c55e" stroke-width="2.5"/>
    <polyline points="100,90 200,110 310,140 430,150 565,145" fill="none" stroke="#ef4444" stroke-width="2.5"/>
    <polyline points="100,165 200,162 310,160 430,158 565,157" fill="none" stroke="#ff5a1f" stroke-width="2" stroke-dasharray="6 4"/>
    <rect x="360" y="40" width="12" height="4" fill="#22c55e"/>
    <text x="380" y="46">Normal (upward sloping)</text>
    <rect x="360" y="58" width="12" height="4" fill="#ef4444"/>
    <text x="380" y="64">Inverted (short above long)</text>
    <rect x="360" y="76" width="12" height="4" fill="#ff5a1f"/>
    <text x="380" y="82">Flat</text>
  </g>
</svg>
```

- **Normal curve:** longer maturities yield more. Investors demand compensation, the term premium, for locking money away and bearing more inflation and duration risk.
- **Flat curve:** short and long yields are similar, often during a tightening cycle as the central bank pushes short rates up towards long rates.
- **Inverted curve:** short yields exceed long yields. The market believes today's policy rate is restrictive and will have to come down.

## Why inversion matters

A 10-year yield is roughly the average of expected short-term rates over the next ten years plus a term premium. If the 2-year yield is 4.70% and the 10-year yield is 4.25%, the market is effectively saying that policy rates will be lower in the years ahead, usually because the tightening is expected to slow the economy.

In the United States, an inverted 2s10s curve has preceded most recessions of the past half century. The warning, however, has come anywhere from several months to around two years in advance, and in 2022 the curve inverted and stayed inverted for roughly two years. The signal is about the balance of risks, not a countdown clock.

## The four curve moves

Traders describe changes in the curve by combining two words. **Bull** means yields fall (bond prices rise); **bear** means yields rise. **Steepener** means the 2s10s spread widens; **flattener** means it narrows.

| Move | What happens | Typical cause | Typical FX reading |
|---|---|---|---|
| Bull steepener | Short yields fall faster than long | Market pricing rate cuts | Currency weakens as its rate advantage fades |
| Bear steepener | Long yields rise faster than short | Inflation fears, heavy debt issuance, term premium rising | Mixed; can hurt equities and the currency if fiscal worries dominate |
| Bull flattener | Long yields fall faster than short | Growth fears, flight to safety | Safe havens (JPY, CHF, gold) often firm |
| Bear flattener | Short yields rise faster than long | Hawkish central bank | Currency usually strengthens |

> **Example:** On a hot US CPI release the 2-year yield jumps from 4.40% to 4.65% (+25 bp) while the 10-year rises from 4.20% to 4.28% (+8 bp). The 2s10s spread moves from -20 bp to -37 bp: a bear flattener. The market is pricing a more hawkish Fed, so the typical reaction is a stronger dollar: EURUSD might drop from 1.0850 to 1.0790 and XAUUSD from 2,350 towards 2,325 as the return on cash rises.

## Using the curve as a trader

The curve is most useful as a slow-moving backdrop:

1. **Regime identification.** A steepening from deeply inverted levels, driven by falling short yields, often coincides with the start of an easing cycle. That has historically been a difficult period for the currency concerned and, if it reflects a slowdown, for equity indices too.
2. **Comparing curves.** If the US curve is bear flattening (hawkish Fed) while the euro-area curve is bull steepening (cuts priced), the policy gap is moving in the dollar's favour.
3. **Reading headlines correctly.** "Long-end sell-off" means a bear steepener, often linked to fiscal concerns. That can weigh on long-duration stocks in NAS100 even without any change in central-bank expectations.

## Common mistakes

- **Treating inversion as a sell signal for stocks.** Equity indices have often risen for months after an inversion. Using it as a timing trigger has been costly.
- **Forgetting which end is moving.** Yields up by 10 bp means different things if the 2-year led (policy) or the 10-year led (inflation, supply or term premium).
- **Mixing up bull and bear.** The words refer to bond prices, not to stocks or the currency. Bull means yields are falling.

> **Note:** Curve data is published by government debt offices and summarised by major news services. The News module in the Client Area and the Economic calendar will show you the events, such as CPI, central-bank decisions and bond auctions, that most often reshape it.
