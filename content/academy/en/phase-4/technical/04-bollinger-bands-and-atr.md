---
slug: "p4-t-bollinger-bands-and-atr"
title: "Bollinger Bands and ATR"
summary: "Two ways to measure volatility, and how to use them for context, stop placement and position sizing."
order: 4
version: 1
takeaways:
  - "Bollinger Bands are a 20-period SMA with bands two standard deviations of the last 20 closes above and below it."
  - "Narrow bands, a squeeze, show low volatility, which often precedes expansion but says nothing about direction."
  - "True range is the largest of high minus low, high minus previous close and previous close minus low; ATR(14) is its Wilder-smoothed average."
  - "ATR converts volatility into price units, which makes it a practical tool for stop distances and position sizes."
practice:
  label: "Add Bollinger Bands (20, 2) and ATR(14) to a daily XAUUSD chart, note the current ATR, and calculate a 1.5 x ATR stop distance for a hypothetical trade."
  symbol: "XAUUSD"
quiz:
  - question: "The 20-period SMA of GBPUSD is 1.2700 and the standard deviation of the last 20 closes is 0.0030. Where are the Bollinger Bands (20, 2)?"
    options:
      - "1.2670 and 1.2730"
      - "1.2640 and 1.2760"
      - "1.2610 and 1.2790"
      - "1.2680 and 1.2720"
    answer: 1
    explanation: "Two standard deviations = 2 x 0.0030 = 0.0060. Upper = 1.2700 + 0.0060 = 1.2760, lower = 1.2700 - 0.0060 = 1.2640."
  - question: "Previous close 2,344.80, today's high 2,361.50 and low 2,348.20. What is the true range?"
    options:
      - "13.30"
      - "3.40"
      - "16.70"
      - "18.50"
    answer: 2
    explanation: "High - low = 13.30; high - previous close = 16.70; previous close - low is negative because the low is above the previous close, so its absolute value 3.40 is used. The largest is 16.70."
  - question: "What does a Bollinger squeeze tell you?"
    options:
      - "Price will break upwards"
      - "Price will break downwards"
      - "Volatility is unusually low and may expand, direction unknown"
      - "The trend is guaranteed to continue"
    answer: 2
    explanation: "A squeeze shows compressed volatility. Expansion often follows, but the bands do not reveal which way the break will go."
  - question: "With a 300 USD risk budget and a stop of 2 x ATR where ATR(14) on XAUUSD is 15.00 USD, what position size fits, given 100 oz per lot?"
    options:
      - "0.05 lots"
      - "0.10 lots"
      - "0.20 lots"
      - "1.00 lot"
    answer: 1
    explanation: "Stop distance = 2 x 15.00 = 30.00 USD per oz. Risk per lot = 30.00 x 100 = 3,000 USD. 300 / 3,000 = 0.10 lots."
---

Price direction is only half the picture. The other half is how much price typically moves. A 20-pip stop may be generous on a quiet EURUSD session and absurdly tight on a volatile XAUUSD day. Bollinger Bands and the Average True Range (ATR) both measure volatility, but they answer different questions: the bands show where price sits relative to its recent distribution, while ATR tells you how far price typically travels per bar.

## Bollinger Bands: the formula

John Bollinger's bands have three lines. The standard settings are 20 periods and 2 standard deviations.

```text
Middle band = SMA(20) of close
Upper band  = Middle + 2 x standard deviation of the last 20 closes
Lower band  = Middle - 2 x standard deviation of the last 20 closes

XAUUSD: SMA(20) = 2,350.00, standard deviation = 9.50
Upper = 2,350.00 + 19.00 = 2,369.00
Lower = 2,350.00 - 19.00 = 2,331.00
Band width = (2,369.00 - 2,331.00) / 2,350.00 = 1.62%
```

Because the standard deviation rises when prices spread out and falls when they cluster, the bands widen in volatile periods and narrow in quiet ones.

## Reading the bands

```svg
<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" fill="#121216"/>
<g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
<line x1="40" y1="235" x2="620" y2="235" stroke="#3a3a44"/>
<line x1="40" y1="20" x2="40" y2="235" stroke="#3a3a44"/>
<text x="4" y="30">Price</text>
<text x="570" y="252">Time</text>
<polyline fill="none" stroke="#ff5a1f" stroke-width="1.5" points="50,80 110,95 170,115 230,128 290,132 350,128 400,110 450,70 500,45 560,35 610,40"/>
<polyline fill="none" stroke="#3a3a44" stroke-width="1.5" stroke-dasharray="5 4" points="50,140 110,142 170,145 230,147 290,148 350,146 400,138 450,118 500,100 560,88 610,86"/>
<polyline fill="none" stroke="#ff5a1f" stroke-width="1.5" points="50,200 110,190 170,175 230,166 290,164 350,164 400,166 450,166 500,155 560,141 610,132"/>
<polyline fill="none" stroke="#c9c9d1" stroke-width="2" points="50,150 80,120 110,165 140,130 170,160 200,140 230,152 260,145 290,150 320,143 350,150 380,140 410,118 440,85 470,72 500,60 530,70 560,52 590,62 610,58"/>
<text x="230" y="120">squeeze: bands narrow</text>
<text x="440" y="200">expansion after breakout</text>
<text x="560" y="28" fill="#ff5a1f">upper</text>
<text x="560" y="160" fill="#ff5a1f">lower</text>
</g>
</svg>
```

Three readings are common:

- **Squeeze.** When the bands narrow to their tightest in months, volatility is compressed. Quiet periods tend to be followed by active ones, so traders watch for a break of the range. The squeeze does not say which direction.
- **Walking the band.** In a strong trend, price can close near or outside the upper band candle after candle. A touch of the upper band is therefore not automatically a sell signal, just as an RSI above 70 is not.
- **Mean reversion in ranges.** In a sideways market with flat bands, moves to an outer band followed by a rejection candle can offer range trades back towards the middle band.

A common misconception is that 95% of prices must stay inside the bands. That figure applies to normally distributed data; market returns have fatter tails, and closes outside the bands occur more often than the textbook suggests.

## ATR: the formula

Wilder's true range captures the full movement of a bar, including any gap from the previous close:

```text
True range = the largest of:
  High - Low
  |High - Previous close|
  |Low - Previous close|

ATR(14) = Wilder-smoothed average of true range:
  New ATR = (Previous ATR x 13 + Current TR) / 14
```

> **Example:** XAUUSD daily. Previous close 2,344.80, today's high 2,361.50, low 2,348.20. High - low = 13.30; |high - previous close| = 16.70; |low - previous close| = 3.40. True range = 16.70, because gold gapped up and the gap belongs to the day's movement. With a previous ATR of 14.00, the new ATR = (14.00 x 13 + 16.70) / 14 = 198.70 / 14 = 14.19.

## Using ATR for stops and size

ATR gives a stop distance that adapts to current conditions. A stop at 1.5 x ATR sits outside most normal noise, and the position size then follows from your risk budget.

```text
Account 10,000 USD, risk 2% = 200 USD
ATR(14) = 14.19, stop = 1.5 x 14.19 = 21.29, round to 21.30 USD
Loss per 0.01 lot (1 oz) at the stop = 21.30 USD
Size = 200 / 21.30 = 9.39 -> round down to 0.09 lots
Actual risk = 9 oz x 21.30 = 191.70 USD
```

When volatility doubles, ATR doubles, the stop widens and the position halves, keeping the money at risk constant. Phase 5 builds this into a complete position-sizing method.

## Comparing volatility across instruments

ATR also lets you compare instruments that are quoted very differently. Suppose daily ATR is 60 pips on EURUSD, 15.00 USD on XAUUSD and 350 points on US30. Dividing ATR by price turns each into a percentage: about 0.55% for EURUSD at 1.0850, 0.64% for gold at 2,350 and 0.89% for US30 at 39,200. The index is the most volatile of the three relative to its price, so the same account risk buys a smaller notional position in it. Checking ATR before every trade is a simple habit that prevents treating a volatile instrument like a quiet one.

## Common mistakes

- Selling every upper-band touch in a trending market.
- Reading a squeeze as a directional signal.
- Using a fixed pip stop on all instruments regardless of ATR.
- Forgetting that ATR on the H1 chart is far smaller than on the daily; use the timeframe that matches your holding period.

> **Risk warning:** Volatility can rise suddenly, especially around news, and an ATR-based stop cannot prevent slippage or gaps. Leveraged CFD losses can exceed your planned risk.
