---
slug: "p3-t-market-structure"
title: "Market structure: highs, lows and trend"
summary: "Read trends objectively through swing highs and lows, spot a break of structure early, and tell a healthy pullback from a genuine change of trend."
order: 2
version: 1
takeaways:
  - "An uptrend is a sequence of higher highs and higher lows; a downtrend is lower highs and lower lows; anything else is a range or transition."
  - "Swing points should be defined consistently, for example a high with lower highs on both sides, so your structure reading is repeatable."
  - "The key level in an uptrend is the most recent higher low; a close below it is the first objective sign the trend may be changing."
  - "Structure depends on timeframe, so always state which timeframe's trend you are describing."
practice:
  label: "On an XAUUSD H4 chart, label the last six swing points as HH, HL, LH or LL and decide whether the structure is up, down or ranging."
  symbol: "XAUUSD"
quiz:
  - question: "Which sequence describes an uptrend?"
    options:
      - "Lower highs and lower lows"
      - "Equal highs and equal lows"
      - "Higher highs and higher lows"
      - "Higher highs and lower lows"
    answer: 2
    explanation: "An uptrend requires both: each rally makes a new high and each pullback holds above the previous low."
  - question: "In an XAUUSD uptrend the last higher low is 2,338 and the last higher high is 2,365. Which event is the first objective warning that the uptrend may be failing?"
    options:
      - "A candle closing below 2,338"
      - "Price pulling back to 2,350"
      - "A new high at 2,372"
      - "A doji candle at 2,360"
    answer: 0
    explanation: "Losing the most recent higher low breaks the sequence of higher lows. A pullback that holds above it, or a new high, keeps the trend intact."
  - question: "The daily chart of GBPUSD shows an uptrend while the M15 chart shows lower highs and lower lows. What is the best description?"
    options:
      - "The charts contradict each other, so one is wrong"
      - "The M15 downtrend is likely a pullback within the larger daily uptrend"
      - "The daily trend has definitely ended"
      - "Structure only applies to the M15"
    answer: 1
    explanation: "Structure is timeframe-specific. A short-term downtrend is often just the corrective phase of a higher-timeframe uptrend."
  - question: "You are long 0.10 lot of XAUUSD from 2,345.00 with a stop just below the higher low at 2,336.00. What is the risk?"
    options:
      - "9 USD"
      - "900 USD"
      - "0.90 USD"
      - "90 USD"
    answer: 3
    explanation: "0.10 lot is 10 oz, so each 1 USD move is worth 10 USD. The stop is 9 USD away, giving a risk of 9 × 10 = 90 USD."
---

Phase 1 introduced trends and ranges at first sight. This chapter makes that reading objective. Instead of saying a chart "looks bullish", you will describe it through the sequence of its swing highs and swing lows. That sequence, called **market structure**, tells you the direction of the trend, where it would be invalidated, and when to stop assuming it will continue.

## Swing highs and swing lows

A **swing high** is a peak with lower highs on both sides. A **swing low** is a trough with higher lows on both sides. A simple, repeatable rule is to require at least two candles on each side, so a swing high is a candle whose high is above the highs of the two candles before and the two after.

Consistency matters more than the exact rule. If you sometimes count tiny wiggles and sometimes ignore them, your reading of structure will change from day to day. Choose a timeframe and a definition and stick to it.

## The three states

- **Uptrend:** higher highs (HH) and higher lows (HL). Buyers push price to new highs and step in at progressively higher prices on pullbacks.
- **Downtrend:** lower highs (LH) and lower lows (LL).
- **Range:** highs and lows roughly level, or a mix such as higher highs with lower lows (an expanding, volatile market).

```svg
<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <line x1="30" y1="270" x2="610" y2="270" stroke="#3a3a44"/>
    <line x1="30" y1="20" x2="30" y2="270" stroke="#3a3a44"/>
    <text x="36" y="288">Time</text>
    <polyline fill="none" stroke="#22c55e" stroke-width="2" points="40,240 100,170 140,205 210,120 250,160 320,70"/>
    <polyline fill="none" stroke="#ef4444" stroke-width="2" points="320,70 370,130 410,95 460,185 500,150 560,230"/>
    <text x="92" y="162">HH</text>
    <text x="130" y="222">HL</text>
    <text x="202" y="112">HH</text>
    <text x="240" y="178">HL</text>
    <text x="312" y="62">HH</text>
    <line x1="230" y1="160" x2="600" y2="160" stroke="#ff5a1f" stroke-dasharray="5 4"/>
    <text x="525" y="153" fill="#ff5a1f">Last HL broken</text>
    <text x="402" y="87">LH</text>
    <text x="492" y="142">LH</text>
    <text x="452" y="203">LL</text>
    <text x="552" y="248">LL</text>
  </g>
</svg>
```

The diagram shows an uptrend making higher highs and higher lows, then a pullback that breaks the last higher low, followed by lower highs and lower lows. The transition is not instant: first the higher-low sequence fails, then a lower high confirms sellers are in control.

## Break of structure and change of character

Two terms describe what happens at the edges of a trend:

- **Break of structure (BOS)** in the trend direction: in an uptrend, price closes above the previous higher high. This confirms continuation.
- **Change of character (CHoCH)** against the trend: in an uptrend, price closes below the most recent higher low. This is the first objective sign the trend may be ending.

A change of character is a warning, not a guaranteed reversal. Price often breaks a higher low, ranges for a while, and then resumes the original trend. Confirmation comes when the next rally fails to make a new high, producing a lower high.

Use **closes** rather than wicks to judge breaks where possible. A wick below a higher low that closes back above it is often just stops being triggered, which is covered in the breakouts chapter.

## A worked example on gold

> **Example:** On the XAUUSD H4 chart, gold makes a higher low at 2,320.00, rallies to a higher high at 2,365.00, and pulls back to 2,338.00, which holds above 2,320.00 and becomes the new higher low. As long as price stays above 2,338.00, the structure is bullish. A close above 2,365.00 would be a break of structure to the upside. A close below 2,338.00 would be a change of character and the first warning; a close below 2,320.00 would leave little doubt that the uptrend structure has failed.

A trader buying the pullback might enter at 2,345.00 with a stop at 2,336.00, just below the higher low, because that is where the bullish reading is invalidated.

```text
XAUUSD contract: 100 oz per lot
0.10 lot = 10 oz → each 1.00 USD move = 10 USD
Stop distance: 2,345.00 - 2,336.00 = 9.00 USD
Risk: 9.00 × 10 = 90 USD
```

> **Risk warning:** Gold can move 20 to 40 dollars in a day and more around news. CFDs are leveraged and losses can exceed expectations; always size positions from the stop distance.

## Timeframes change the story

Structure is always tied to a timeframe. The daily chart of GBPUSD can be in a clear uptrend while the M15 chart shows a neat downtrend: that M15 downtrend is simply the pullback within the daily move. When you describe a trend, say which timeframe you mean, for example "H4 uptrend, H1 pullback". The chapter on multi-timeframe analysis builds on this.

## Common mistakes

- **Counting every wiggle.** On lower timeframes, noise creates endless small swings. Use a consistent swing definition.
- **Calling a reversal too early.** One break of a higher low is a warning; a lower high afterwards is confirmation.
- **Mixing timeframes.** An M5 lower low says nothing about the daily trend.
- **Placing stops inside structure.** A stop above the last higher low in a long trade will often be hit by normal pullbacks.
