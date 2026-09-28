---
slug: "p4-t-moving-averages"
title: "Moving averages"
summary: "How simple and exponential moving averages are calculated, what they reveal about trend, and where they fail."
order: 1
version: 1
takeaways:
  - "A simple moving average weights every close equally; an exponential moving average weights recent closes more using the multiplier 2 / (n + 1)."
  - "All moving averages lag price, and the longer the period, the greater the lag and the smoother the line."
  - "The slope and the position of price relative to the average are more useful than any single crossover."
  - "Moving averages work well in trends and generate repeated false signals in ranges."
practice:
  label: "Add a 20 EMA and a 50 SMA to a daily EURUSD chart in Kalks Trader and mark every crossover in the last six months, noting which ones were followed by a sustained move."
  symbol: "EURUSD"
quiz:
  - question: "What is the smoothing multiplier for a 19-period EMA?"
    options:
      - "0.05"
      - "0.10"
      - "0.19"
      - "0.20"
    answer: 1
    explanation: "The multiplier is 2 / (n + 1) = 2 / 20 = 0.10. Each new close contributes 10% of the new EMA value."
  - question: "The last five closes of USDJPY are 151.20, 151.60, 151.40, 151.90 and 152.40. What is the 5-period SMA?"
    options:
      - "151.50"
      - "151.70"
      - "151.90"
      - "152.00"
    answer: 1
    explanation: "Sum = 151.20 + 151.60 + 151.40 + 151.90 + 152.40 = 758.50. Divided by 5 gives 151.70."
  - question: "In which market condition do moving-average crossover systems typically perform worst?"
    options:
      - "A strong, steady uptrend"
      - "A strong, steady downtrend"
      - "A sideways range with frequent reversals"
      - "A trend with shallow pullbacks"
    answer: 2
    explanation: "In a range, price repeatedly crosses the averages and the averages cross each other, generating signals that reverse before any follow-through, each costing spread and a small loss."
  - question: "Why does an EMA react faster than an SMA of the same period?"
    options:
      - "It uses high and low prices instead of closes"
      - "It is calculated on a higher timeframe"
      - "It uses a shorter period internally"
      - "It gives more weight to the most recent closes"
    answer: 3
    explanation: "The EMA applies exponentially decreasing weights, so recent closes count more. The SMA gives the oldest and newest close in the window the same weight."
---

Moving averages are the oldest and most widely used indicators. They smooth the noise of individual candles into a line that shows the underlying direction. Because so many traders watch the same common periods, the averages also act as reference points in their own right. This chapter explains how they are calculated, how to read them and why they cannot be used alone.

## The simple moving average

A simple moving average (SMA) of n periods is the arithmetic mean of the last n closing prices. Each new candle adds its close to the window and drops the oldest one.

```text
EURUSD last five closes: 1.0842, 1.0855, 1.0861, 1.0848, 1.0869
Sum = 5.4275
SMA(5) = 5.4275 / 5 = 1.0855
```

Every close in the window has equal weight. A large move from five bars ago counts as much as today's close, and when it drops out of the window the average can jump even if today's price barely changed.

## The exponential moving average

An exponential moving average (EMA) gives more weight to recent prices. It uses a smoothing multiplier k:

```text
k = 2 / (n + 1)
EMA today = EMA yesterday + k x (Close today - EMA yesterday)

For a 10 EMA: k = 2 / 11 = 0.1818
Yesterday's EMA 1.0850, today's close 1.0872
EMA = 1.0850 + 0.1818 x 0.0022 = 1.0850 + 0.0004 = 1.0854
```

The first EMA value is usually seeded with an SMA of the same period. Because recent closes count more, the EMA turns sooner than the SMA, at the cost of reacting more to noise.

## Choosing periods

| Period | Common use |
|---|---|
| 9 to 21 | Short-term momentum, pullback entries on intraday charts |
| 50 | Medium-term trend, widely watched on daily charts |
| 100 to 200 | Long-term trend; the 200-day SMA is a common bull or bear dividing line |

There is no correct period. What matters is choosing one that fits your holding time and then applying it consistently. Longer periods lag more but whipsaw less.

## Reading moving averages

Moving averages give three pieces of information.

**Slope.** A rising average says the average price is going up. A flat average says the market is ranging. This is the simplest and most robust use.

**Price position.** Price consistently above a rising average confirms an uptrend. In strong trends, pullbacks often stall near a short or medium average, which is why many traders use the 20 or 50 EMA as a zone for entries rather than an exact line.

**Crossovers.** When a faster average crosses above a slower one, momentum is turning up. The 50-day crossing above the 200-day is often called a golden cross; the reverse is a death cross. These signals are late by design: by the time a 50 and a 200 cross, much of the move has often happened.

```svg
<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" fill="#121216"/>
<g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
<line x1="40" y1="230" x2="620" y2="230" stroke="#3a3a44"/>
<line x1="40" y1="20" x2="40" y2="230" stroke="#3a3a44"/>
<text x="560" y="250">Time</text>
<text x="4" y="30">Price</text>
<polyline fill="none" stroke="#c9c9d1" stroke-width="1.5" points="50,150 80,170 110,160 140,185 170,175 200,195 230,180 260,170 290,150 320,140 350,120 380,125 410,100 440,90 470,95 500,75 530,70 560,55 600,50"/>
<polyline fill="none" stroke="#ff5a1f" stroke-width="2" points="50,160 110,168 170,178 230,183 290,168 350,140 410,115 470,98 530,80 600,62"/>
<polyline fill="none" stroke="#22c55e" stroke-width="2" points="50,165 110,170 170,175 230,178 290,172 350,160 410,145 470,128 530,110 600,92"/>
<circle cx="263" cy="175" r="6" fill="none" stroke="#c9c9d1"/>
<text x="275" y="205">fast crosses above slow</text>
<text x="470" y="40" fill="#ff5a1f">fast EMA</text>
<text x="540" y="115" fill="#22c55e">slow SMA</text>
<text x="60" y="210">price</text>
</g>
</svg>
```

The diagram shows why crossovers lag: price had already turned up well before the fast line crossed the slow one.

## Moving averages as dynamic support and resistance

Because many participants watch the same averages, price sometimes reacts around them. Treat an average as a zone, not a line. On XAUUSD, for example, a 50-day SMA at 2,330.00 is better read as a zone of perhaps 2,322 to 2,338, sized according to the instrument's typical daily range.

## Filtering trades with a moving average

The most robust use of a moving average is as a filter rather than a trigger. A trader might decide to take long setups on EURUSD only when the daily 50 EMA is rising and price is above it, and short setups only when the reverse is true. The average does not say when to enter; it removes trades that go against the prevailing direction. Entries then come from other tools such as support zones, candlestick patterns or oscillators, which later chapters in this section cover.

A higher-timeframe filter works the same way: an H1 trader can check the slope of the daily 50 EMA before taking any trade on the lower chart.

## Common mistakes

- Trading every crossover in a sideways market, where they reverse repeatedly.
- Optimising periods on past data until the average fits perfectly, which rarely carries forward.
- Stacking many averages that all say the same thing.
- Forgetting that the daily candle, and so the daily average, closes at the New York close on Kalks Trader; averages from platforms with a different daily close can differ slightly.

> **Risk warning:** Indicator signals describe past prices and do not predict future ones. Any strategy built on moving averages can suffer strings of losses, and leveraged CFD losses can exceed your expectations.
