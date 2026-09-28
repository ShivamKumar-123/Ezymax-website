---
slug: "p4-t-macd"
title: "MACD"
summary: "How the MACD line, signal line and histogram are built from 12, 26 and 9-period EMAs, and how to read them in context."
order: 3
version: 1
takeaways:
  - "The MACD line is the 12-period EMA minus the 26-period EMA; the signal line is a 9-period EMA of the MACD line; the histogram is MACD minus signal."
  - "MACD is measured in price units, so its values cannot be compared across instruments or with fixed overbought levels."
  - "The zero line shows whether the fast average is above or below the slow one, which is a trend filter."
  - "A shrinking histogram shows momentum slowing, not that price has reversed."
practice:
  label: "Add MACD (12, 26, 9) to a daily US30 chart and mark three signal-line crossovers that occurred above the zero line and three below it."
  symbol: "US30"
quiz:
  - question: "The 12 EMA is 2,352.60 and the 26 EMA is 2,347.10. The signal line is 4.20. What is the histogram value?"
    options:
      - "1.30"
      - "5.50"
      - "9.70"
      - "-1.30"
    answer: 0
    explanation: "MACD = 2,352.60 - 2,347.10 = 5.50. Histogram = MACD - signal = 5.50 - 4.20 = 1.30."
  - question: "What does the signal line represent?"
    options:
      - "A 9-period SMA of price"
      - "The difference between price and the 12 EMA"
      - "The 26-period EMA of price"
      - "A 9-period EMA of the MACD line"
    answer: 3
    explanation: "The signal line is a 9-period exponential moving average of the MACD line itself, which is why it lags the MACD line."
  - question: "Why can you not say MACD above 50 is overbought?"
    options:
      - "MACD only ranges from -1 to 1"
      - "MACD cannot go above zero"
      - "MACD is in price units and has no fixed range"
      - "MACD above 50 is always bearish"
    answer: 2
    explanation: "MACD is the difference between two price averages, so its size depends on the instrument's price and volatility. It has no fixed upper or lower bound."
  - question: "The MACD line crosses above the zero line. What has happened?"
    options:
      - "The 12 EMA has moved above the 26 EMA"
      - "Price has crossed its 9 EMA"
      - "The histogram has turned negative"
      - "RSI has crossed 50"
    answer: 0
    explanation: "MACD = 12 EMA - 26 EMA. It becomes positive exactly when the 12 EMA rises above the 26 EMA."
---

MACD, short for Moving Average Convergence Divergence, was created by Gerald Appel and remains one of the most popular indicators on any platform. It turns the relationship between two moving averages into a single line, then adds a second line and a histogram to show how that relationship is changing. It combines trend and momentum information in one panel.

## The three components

The standard settings are 12, 26 and 9, all based on closing prices and exponential moving averages.

```text
MACD line   = EMA(12) of close - EMA(26) of close
Signal line = EMA(9) of the MACD line
Histogram   = MACD line - Signal line
```

When the fast average pulls away from the slow one, the two averages diverge and MACD grows. When they come together, they converge and MACD shrinks towards zero, which gives the indicator its name.

## A worked example

> **Example:** On a daily EURUSD chart, the 12 EMA is 1.0874 and the 26 EMA is 1.0851. The MACD line is 1.0874 - 1.0851 = 0.0023, which you can read as 23 pips. The signal line is 0.0018, so the histogram is 0.0023 - 0.0018 = 0.0005, or 5 pips. MACD is above zero and above its signal: the short-term average is above the long-term one and the gap is widening.

Now suppose the next day MACD eases to 0.0020. The signal line uses a 9-period EMA, with multiplier 2 / (9 + 1) = 0.2:

```text
New signal    = 0.0018 + 0.2 x (0.0020 - 0.0018)
              = 0.0018 + 0.00004 = 0.00184
New histogram = 0.0020 - 0.00184 = 0.00016  (about 1.6 pips)
```

The histogram fell from 5 pips to 1.6 pips. Price may still be rising, but momentum is slowing. If MACD keeps falling, the histogram will turn negative, which is a signal-line crossover.

## Reading MACD

**Zero line.** MACD above zero means the 12 EMA is above the 26 EMA, a basic uptrend condition. Below zero means the reverse. Many traders use this as a filter: only take long setups when MACD is above zero.

**Signal-line crossovers.** MACD crossing above its signal line shows momentum turning up; crossing below shows it turning down. Crossovers happen often and are most useful when they agree with the zero-line context: a bullish crossover while MACD is above zero is a pullback ending within an uptrend, while a bullish crossover deep below zero is only a pause in a downtrend unless other evidence says otherwise.

**Histogram.** The histogram is the fastest part of MACD. A series of shrinking bars shows momentum fading before the lines actually cross. Because it is the difference of two lagging lines, it turns earlier than MACD itself, but it also produces more false turns, so it is best read alongside the price structure.

| Reading | Typical interpretation |
|---|---|
| MACD above zero and rising | Uptrend with increasing momentum |
| MACD above zero, histogram shrinking | Uptrend intact, momentum slowing |
| MACD crosses below signal, still above zero | Possible pullback in an uptrend |
| MACD crosses below zero | Fast average now below slow; trend weakening or turning |

## Why MACD has no overbought level

Unlike RSI, MACD has no fixed range. It is measured in the price units of the instrument: pips on EURUSD, dollars on XAUUSD, points on US30. A MACD of 150 on US30 and 0.0015 on EURUSD can represent similar momentum. It also means historical MACD values on one instrument are only comparable within similar volatility conditions. To judge whether MACD is stretched, compare it with its own recent history on the same chart and timeframe.

## Settings and timeframes

The 12, 26, 9 settings are often said to date from the era of six-day trading weeks, and they were not optimised for modern markets. They remain the standard because everyone uses them, so behaviour at common levels is widely observed. Some traders use faster settings such as 5, 35, 5 for sharper histogram signals, but faster settings produce more false signals. Whatever you choose, test it on demo and in the Backtests module of the Client Area before relying on it.

## Common mistakes

- Taking every signal-line crossover, which in a range produces a constant stream of small losses.
- Comparing MACD values across different instruments.
- Reading a shrinking histogram as a reversal rather than slowing momentum.
- Forgetting that MACD is built from moving averages and therefore lags price.

> **Risk warning:** MACD signals lag and are often wrong in sideways markets. Past indicator behaviour does not guarantee future results, and leveraged CFD trading can lead to losses larger than you expect.
