---
slug: "p1-t-reading-a-price-chart"
title: "What a price chart shows: line, bar and candlestick"
summary: "The two axes of every chart, how open, high, low and close are recorded, and when to use a line, bar or candlestick chart."
order: 1
version: 1
takeaways:
  - "A price chart plots price on the vertical axis against time on the horizontal axis, one data point or bar per period."
  - "Each period can be summarised by four prices: open, high, low and close, known together as OHLC."
  - "A line chart joins only the closing prices, which makes the overall direction easy to see but hides the range of each period."
  - "Bar and candlestick charts show the full OHLC of every period; candlesticks make the direction and size of each period easier to read at a glance."
  - "Charts in Kalks Trader are normally drawn from bid prices, so buy orders fill slightly above the plotted price by the spread."
practice:
  label: "Open an XAUUSD H1 chart on your demo account and switch between line, bars and candles, noting what each view shows or hides about the last ten hours."
  symbol: "XAUUSD"
quiz:
  - question: "Which four prices make up OHLC?"
    options:
      - "Offer, high, last, current"
      - "Open, high, low, close"
      - "Opening bid, highest ask, lowest bid, closing ask"
      - "Order, hold, limit, close"
    answer: 1
    explanation: "OHLC stands for open, high, low and close: the first price, the extreme prices and the last price in the period."
  - question: "What information does a line chart hide compared with a candlestick chart?"
    options:
      - "The closing price of each period"
      - "The overall direction of the market"
      - "The high, low and open of each period"
      - "The time axis"
    answer: 2
    explanation: "A standard line chart connects closing prices only, so you cannot see how far price travelled within each period or where it opened."
  - question: "On an OHLC bar, what does the small tick on the right side mark?"
    options:
      - "The closing price"
      - "The opening price"
      - "The spread"
      - "The average price"
    answer: 0
    explanation: "On a bar chart, the left tick is the open and the right tick is the close. The vertical line spans the high to the low."
  - question: "An EURUSD H1 candle opened at 1.0850, reached 1.0872 and 1.0841, and closed at 1.0866. What was its range?"
    options:
      - "16 pips"
      - "22 pips"
      - "25 pips"
      - "31 pips"
    answer: 3
    explanation: "Range is high minus low: 1.0872 - 1.0841 = 0.0031, which is 31 pips. The 16 pips is the body (close minus open), not the range."
---

A price chart is the most compact record of a market's history. Every trend, every reaction to news and every hesitation of buyers and sellers is stored in it. Before you can analyse a chart, you need to read it fluently: what the axes mean, what each mark represents and which chart type suits which job.

## The two axes

Every price chart in Kalks Trader has the same basic layout:

- The **vertical axis** (on the right) shows price. Higher on the chart means a higher price.
- The **horizontal axis** (at the bottom) shows time, in Kalks server time. The newest data is on the right.

The chart is split into equal periods set by the **timeframe**. On an H1 chart each period is one hour; on a D1 chart each period is one trading day. Timeframes get their own chapter, so for now remember: one bar or candle equals one period.

## Four prices per period: OHLC

Within a single period, price may move hundreds of times. A chart summarises all that activity with four numbers:

- **Open:** the first price of the period.
- **High:** the highest price reached.
- **Low:** the lowest price reached.
- **Close:** the last price of the period.

Together these are called **OHLC**. From them you can calculate two useful measures. The **range** is high minus low, which tells you how far price travelled. The **body** is close minus open, which tells you where the period finished relative to where it started.

> **Example:** An EURUSD one-hour period opens at 1.0850, rises to 1.0872, dips to 1.0841 and closes at 1.0866. The range is 1.0872 - 1.0841 = 0.0031, or 31 pips. The close minus the open is 1.0866 - 1.0850 = 0.0016, so the hour gained 16 pips. Buyers ended the hour in control, but sellers pushed price 9 pips below the open at one point.

## Three ways to draw the same data

The same OHLC data can be drawn in different ways. The diagram shows five identical periods as a line chart, a bar chart and a candlestick chart.

```svg
<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g stroke="#3a3a44">
    <line x1="20" y1="190" x2="210" y2="190"/>
    <line x1="230" y1="190" x2="420" y2="190"/>
    <line x1="440" y1="190" x2="630" y2="190"/>
  </g>
  <polyline points="50,132.8 85,143.2 120,104.2 155,125 190,75.6" fill="none" stroke="#ff5a1f" stroke-width="2"/>
  <g stroke-width="2">
    <line x1="260" y1="122.4" x2="260" y2="174.4" stroke="#22c55e"/>
    <line x1="253" y1="164" x2="260" y2="164" stroke="#22c55e"/>
    <line x1="260" y1="132.8" x2="267" y2="132.8" stroke="#22c55e"/>
    <line x1="295" y1="109.4" x2="295" y2="151" stroke="#ef4444"/>
    <line x1="288" y1="132.8" x2="295" y2="132.8" stroke="#ef4444"/>
    <line x1="295" y1="143.2" x2="302" y2="143.2" stroke="#ef4444"/>
    <line x1="330" y1="96.4" x2="330" y2="148.4" stroke="#22c55e"/>
    <line x1="323" y1="143.2" x2="330" y2="143.2" stroke="#22c55e"/>
    <line x1="330" y1="104.2" x2="337" y2="104.2" stroke="#22c55e"/>
    <line x1="365" y1="86" x2="365" y2="138" stroke="#ef4444"/>
    <line x1="358" y1="104.2" x2="365" y2="104.2" stroke="#ef4444"/>
    <line x1="365" y1="125" x2="372" y2="125" stroke="#ef4444"/>
    <line x1="400" y1="65.2" x2="400" y2="130.2" stroke="#22c55e"/>
    <line x1="393" y1="125" x2="400" y2="125" stroke="#22c55e"/>
    <line x1="400" y1="75.6" x2="407" y2="75.6" stroke="#22c55e"/>
  </g>
  <g>
    <line x1="470" y1="122.4" x2="470" y2="174.4" stroke="#22c55e"/>
    <rect x="463" y="132.8" width="14" height="31.2" fill="#22c55e"/>
    <line x1="505" y1="109.4" x2="505" y2="151" stroke="#ef4444"/>
    <rect x="498" y="132.8" width="14" height="10.4" fill="#ef4444"/>
    <line x1="540" y1="96.4" x2="540" y2="148.4" stroke="#22c55e"/>
    <rect x="533" y="104.2" width="14" height="39" fill="#22c55e"/>
    <line x1="575" y1="86" x2="575" y2="138" stroke="#ef4444"/>
    <rect x="568" y="104.2" width="14" height="20.8" fill="#ef4444"/>
    <line x1="610" y1="65.2" x2="610" y2="130.2" stroke="#22c55e"/>
    <rect x="603" y="75.6" width="14" height="49.4" fill="#22c55e"/>
  </g>
  <g font-family="Inter, Arial, sans-serif" font-size="13" fill="#c9c9d1" text-anchor="middle">
    <text x="320" y="24">The same five periods drawn three ways</text>
    <text x="115" y="210">Line (closes only)</text>
    <text x="325" y="210">Bars (OHLC)</text>
    <text x="535" y="210">Candlesticks</text>
  </g>
</svg>
```

**Line chart.** Joins the closing prices. It removes noise and makes the overall direction very clear, which is why it is useful for a quick overview or for spotting major turning points on a long timeframe. Its weakness is that it hides everything that happened inside each period.

**Bar chart (OHLC bars).** Each period is a vertical line from the high to the low, with a small tick on the left for the open and on the right for the close. It shows all four prices but can be harder to read quickly.

**Candlestick chart.** Shows the same four prices, but draws the area between open and close as a filled **body**, coloured by direction. In Kalks Trader green means the close was above the open and red means it was below. Thin **wicks** extend to the high and low. Most traders use candlesticks because direction and strength stand out immediately. The next chapter covers candle anatomy in detail.

Kalks Trader also offers an **area** chart, a line chart with the space beneath it shaded. It is a presentation choice, useful for clean overviews.

## Which price is plotted?

Charts in Kalks Trader are normally built from the **bid** price. That has a practical consequence: when you buy, you pay the ask, which sits above the plotted price by the spread.

```text
Chart shows XAUUSD high at 2,350.40 (bid)
Spread at that moment: 0.30
Ask at that moment:    2,350.40 + 0.30 = 2,350.70
A buy stop at 2,350.50 would have triggered, because the ask reached 2,350.70,
even though the plotted bid high never touched 2,350.50.
```

This is why sell orders and stop losses on long positions behave as the chart suggests, while buy orders and stop losses on short positions can trigger a little before the plotted candle reaches them.

## Common mistakes

- **Using only line charts for trading decisions.** You miss the highs and lows where stops and entries actually sit.
- **Judging a period by its colour only.** A small green candle with a long upper wick tells a different story from a large green candle that closed at its high.
- **Forgetting the spread.** The chart is the bid; your buy fills at the ask.

Switch between chart types on a free demo account in Kalks Trader and describe the last five candles of any symbol out loud: open, high, low, close.
