---
slug: "p1-t-trend-vs-range"
title: "Trend or range: a first look"
summary: "Recognise the three basic market states, uptrend, downtrend and range, using swing highs and swing lows."
order: 4
version: 1
takeaways:
  - "Markets alternate between trending phases, where price makes progress in one direction, and ranging phases, where it moves sideways between boundaries."
  - "An uptrend is a series of higher highs and higher lows; a downtrend is a series of lower highs and lower lows."
  - "A range is defined by a ceiling and a floor that price has reacted to several times without breaking."
  - "The same market can trend on one timeframe and range on another, so always state which timeframe you are describing."
  - "Identifying the current state first helps you avoid using a trend approach in a range or a range approach in a trend."
practice:
  label: "On a demo EURUSD D1 chart, mark the last four swing highs and swing lows and decide whether the market is in an uptrend, a downtrend or a range."
  symbol: "EURUSD"
quiz:
  - question: "Swing lows on a chart are 1.0720, 1.0765 and 1.0810, and swing highs are 1.0790, 1.0840 and 1.0895. What market state does this describe?"
    options:
      - "A downtrend"
      - "A range"
      - "No structure can be identified"
      - "An uptrend"
    answer: 3
    explanation: "Each high is higher than the last and each low is higher than the last, which is the definition of an uptrend."
  - question: "What is a swing high?"
    options:
      - "A peak with lower highs on both sides of it"
      - "The highest price of the year"
      - "Any green candle"
      - "The ask price at the daily open"
    answer: 0
    explanation: "A swing high is a local turning point: the price made a peak and then fell away, with lower highs before and after. Swing lows are the mirror image."
  - question: "Gold has bounced from 2,330 three times and turned down from 2,365 three times over two weeks. Which description fits best?"
    options:
      - "A strong uptrend"
      - "A range between roughly 2,330 and 2,365"
      - "A downtrend"
      - "A market with no support or resistance"
    answer: 1
    explanation: "Repeated reactions at the same floor and ceiling without a break define a range. Here the range is about 35 dollars wide."
  - question: "In an uptrend, what is the first structural warning sign that the trend may be weakening?"
    options:
      - "A new higher high"
      - "A red candle"
      - "Price falls below the most recent higher low"
      - "The spread narrows"
    answer: 2
    explanation: "An uptrend is defined by higher lows. When price breaks below the last higher low, the sequence is broken. A single red candle on its own does not change the structure."
---

Before you think about entries, indicators or strategies, answer one question about any chart: **is this market trending or ranging?** The answer shapes almost every decision that follows. This chapter gives you a simple, objective way to tell the difference, which Phase 3 builds on with support, resistance and market structure.

## Swing highs and swing lows

Price never moves in a straight line. It moves in waves: a push, a pullback, another push. The turning points of those waves are the building blocks of structure.

- A **swing high** is a peak where price turned down, with lower highs on each side of it.
- A **swing low** is a trough where price turned up, with higher lows on each side of it.

A simple rule many traders use is that a swing high needs at least two candles with lower highs on each side, and a swing low at least two candles with higher lows on each side. The exact rule matters less than using the same one consistently.

## The three market states

```svg
<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g stroke="#3a3a44">
    <line x1="20" y1="190" x2="200" y2="190"/>
    <line x1="230" y1="190" x2="410" y2="190"/>
    <line x1="440" y1="190" x2="620" y2="190"/>
    <line x1="440" y1="70" x2="620" y2="70" stroke-dasharray="4 3"/>
    <line x1="440" y1="140" x2="620" y2="140" stroke-dasharray="4 3"/>
  </g>
  <polyline points="20,170 50,130 75,150 110,100 135,120 170,65 200,85" fill="none" stroke="#22c55e" stroke-width="2"/>
  <polyline points="230,60 260,100 285,80 320,130 345,110 380,165 410,145" fill="none" stroke="#ef4444" stroke-width="2"/>
  <polyline points="440,140 470,72 500,138 530,72 560,138 590,72 620,110" fill="none" stroke="#ff5a1f" stroke-width="2"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1" text-anchor="middle">
    <text x="320" y="22" font-size="14">Uptrend, downtrend and range</text>
    <text x="110" y="92">HH</text>
    <text x="170" y="57">HH</text>
    <text x="75" y="166">HL</text>
    <text x="135" y="136">HL</text>
    <text x="285" y="72">LH</text>
    <text x="345" y="102">LH</text>
    <text x="380" y="182">LL</text>
    <text x="320" y="146">LL</text>
    <text x="600" y="62">Resistance</text>
    <text x="600" y="156">Support</text>
    <text x="110" y="210">Uptrend</text>
    <text x="320" y="210">Downtrend</text>
    <text x="530" y="210">Range</text>
  </g>
</svg>
```

**Uptrend.** A sequence of **higher highs (HH)** and **higher lows (HL)**. Each push up goes further than the last, and each pullback stops above the previous one. Buyers are consistently willing to pay more.

**Downtrend.** A sequence of **lower highs (LH)** and **lower lows (LL)**. Each rally fails below the previous high, and each drop goes further.

**Range.** Price moves between a roughly horizontal ceiling, called **resistance**, and floor, called **support**. Highs are similar to each other, and so are lows. Neither buyers nor sellers are strong enough to break out.

## Worked examples

> **Example:** On the EURUSD daily chart, the last three swing lows are 1.0720, 1.0765 and 1.0810, and the last three swing highs are 1.0790, 1.0840 and 1.0895. Every low is higher than the one before, and every high is higher too. This is an uptrend. The key level to watch is the most recent higher low, 1.0810: as long as it holds, the structure is intact.

A range looks different:

```text
XAUUSD H4, last two weeks
Swing highs:  2,364.80   2,365.20   2,363.90   (ceiling near 2,365)
Swing lows:   2,330.60   2,329.80   2,331.10   (floor near 2,330)
Range width:  2,365 - 2,330 = 35 USD
Position now: 2,350.40, roughly mid-range
```

Here, buying at 2,350.40 because gold "looks bullish" has little structural support: price is in the middle of a box, with room to fall 20 dollars before reaching the floor.

## One market, several states

State always belongs to a timeframe. EURUSD can be in a daily uptrend while the H1 chart is ranging for two days as the market pauses. That is not a contradiction: the H1 range is simply a small sideways section inside the larger trend.

Always describe state with its timeframe: "D1 uptrend, H1 range". It keeps your analysis honest and makes it easier to review your trades later.

## When states change

Trends do not last forever, and ranges eventually break. Early warning signs include:

- In an uptrend, price **fails to make a new higher high**, then **falls below the last higher low**.
- In a downtrend, price fails to make a new lower low, then rises above the last lower high.
- In a range, price **closes decisively outside** the ceiling or floor and holds there.

A single candle in the opposite direction does not change the state. Structure changes when swing points change.

## In practice

Why does this matter so early? Because different states suit different behaviour. In a trend, buying pullbacks in an uptrend or selling rallies in a downtrend works with the dominant flow. In a range, buying near support and selling near resistance respects the boundaries. Using a trend approach inside a range, or fading every move in a strong trend, is one of the most common reasons beginners lose money.

> **Risk warning:** Identifying a trend or range does not make any trade safe. Trends reverse and ranges break, often suddenly. Every position on a leveraged CFD needs a defined stop loss and a size you can afford to lose.

## Common mistakes

- **Seeing trends in noise.** Two candles in a row do not make a trend. Look for at least two swing highs and two swing lows.
- **Forgetting the timeframe.** A "downtrend" on M5 may be a small pullback in a D1 uptrend.
- **Calling a change too early.** Wait for the structure to break, not just for a strong candle.

Use the horizontal line and trend line tools in Kalks Trader on a free demo account to mark swing points on several symbols and classify each one.
