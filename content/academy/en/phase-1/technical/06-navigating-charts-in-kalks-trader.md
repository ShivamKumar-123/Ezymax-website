---
slug: "p1-t-navigating-charts-kalks-trader"
title: "Navigating charts in Kalks Trader"
summary: "A practical tour of the Kalks Trader chart workspace: symbols, tabs, timeframes, chart types, tools, indicators, templates and on-chart trade lines."
order: 6
version: 1
takeaways:
  - "Each chart tab in Kalks Trader holds one symbol, one timeframe, one chart type and its own drawings and indicators."
  - "The toolbar and the right-click menu give you timeframes, chart types, zoom, crosshair, indicators and screenshots in one place."
  - "Drawing tools such as horizontal lines, trend lines, rectangles and Fibonacci retracements let you mark the structure you identified in earlier chapters."
  - "Templates save a chart setup so you can apply the same view to other symbols in one step."
  - "Open positions, stop losses, take profits, pending orders and alerts appear as lines on the chart, so the chart doubles as your trade monitor."
practice:
  label: "On your demo account, build a two-chart layout with EURUSD D1 and EURUSD H1, mark the last swing high and low on each, and save the setup as a template."
  symbol: "EURUSD"
quiz:
  - question: "You want to see EURUSD on D1 and H1 at the same time, each with its own drawings. What is the best approach?"
    options:
      - "Keep one tab and switch timeframes back and forth"
      - "Open two chart tabs and show them side by side with a two-chart layout"
      - "Use the area chart type"
      - "Take a screenshot of each timeframe"
    answer: 1
    explanation: "Each tab keeps its own timeframe and drawings. A two-chart layout shows both at once, so you can compare context and detail without losing your marks."
  - question: "What is the crosshair most useful for?"
    options:
      - "Reading the exact price and time at any point on the chart and measuring moves"
      - "Placing a market order instantly"
      - "Changing the spread"
      - "Deleting indicators"
    answer: 0
    explanation: "The crosshair shows exact price and time under the cursor, which is how you measure candles, ranges and distances between levels."
  - question: "What does a template save?"
    options:
      - "Your open positions"
      - "Your account balance"
      - "Your trade history"
      - "A chart setup, such as chart type and indicators, so it can be applied to other charts"
    answer: 3
    explanation: "Templates store the look and indicator setup of a chart. They do not store trades or account data."
  - question: "Where can you see your stop loss and take profit for an open position?"
    options:
      - "Only in the monthly statement"
      - "Nowhere until the trade is closed"
      - "As labelled lines on the chart of that symbol, as well as in the positions list"
      - "Only on the D1 timeframe"
    answer: 2
    explanation: "Kalks Trader draws open positions, SL, TP, pending orders and alerts as lines on the chart, on any timeframe."
---

You now know what a chart shows, how candles are built, which timeframes exist and how to recognise trend and range. This chapter turns that knowledge into a working routine in **Kalks Trader**. It is best read with a free demo account open, trying each step as you go.

## The workspace at a glance

The chart workspace in Kalks Trader has four main areas:

- **Market Watch** lists symbols with their live bid and ask. Selecting a symbol opens or updates a chart.
- **Chart tabs** run along the top of the chart area. Each tab is one chart with its own symbol, timeframe, chart type, indicators and drawings.
- **The chart toolbar** sits above the chart: timeframes, chart type, indicators, templates, crosshair, zoom, reset view and screenshot.
- **The drawing bar** runs down the left side: cursor, crosshair, horizontal line, trend line, Fibonacci retracement and rectangle.

Nearly everything on the toolbar is also available by **right-clicking the chart**, which is often the fastest way to work.

## Symbols, tabs and layouts

Treat each tab as one view you want to keep. A useful habit is one tab per symbol and timeframe you follow regularly, for example EURUSD D1, EURUSD H1 and XAUUSD H4. Drawings belong to the tab they were made on, so keeping separate tabs for separate timeframes keeps your marks where you expect them.

The layout control shows one chart, two charts side by side, two charts stacked, or four charts in a grid. Two charts side by side is ideal for comparing a higher timeframe with a lower one.

## Timeframe, chart type and moving around

**Timeframe.** Choose from M1, M5, M15, M30, H1, H4, D1, W1 and MN.

**Chart type.** Choose candles, bars, line or area. Candles are the usual choice for analysis; line is useful for a clean long-term overview.

**Navigation.**

- Scroll or drag to move back in time; the newest candles are on the right.
- Zoom in and out with the toolbar buttons or the **+** and **-** keys.
- **Reset view** returns to the latest price at the default zoom when you have scrolled far back.
- The **crosshair** (Ctrl+F) shows the exact price and time under the cursor.

> **Example:** On EURUSD H1 you place the crosshair on the swing low at 1.0812 and then on the following swing high at 1.0869. The move is 1.0869 - 1.0812 = 0.0057, or 57 pips. If the average H1 range is about 18 pips, that swing took roughly three hours' worth of normal movement, which helps you judge how extended it is.

## Drawing tools

The drawing bar turns your analysis into marks you can return to:

| Tool | Typical use |
|---|---|
| Horizontal line | Swing highs and lows, range ceilings and floors |
| Trend line | Connecting higher lows in an uptrend or lower highs in a downtrend |
| Rectangle | Marking a range or a zone rather than a single price |
| Fibonacci retracement | Measuring pullbacks within a move (covered in Phase 4) |

Select a tool, click on the chart to place it, then return to the cursor. To clear a chart, use **Delete all objects** from the right-click menu. Keep drawings sparse: a chart covered in lines is harder to read than a clean one with three important levels.

## Indicators and templates

The **Indicators** menu groups tools by category: Trend, Oscillators, Volatility, Volume and Bill Williams. The indicators list (Ctrl+I) shows everything available. For now, two are useful from the previous chapter: **Average True Range** for volatility and **Volumes** for tick volume. Most indicators are taught in Phase 4, so resist the temptation to add many at once.

A **template** saves a chart's setup, including chart type and indicators. Use **Save template** once you have a view you like, then apply it to any other chart, or use **Apply this chart to all charts** to align every tab in one step.

## Trade lines on the chart

The chart is also your trade monitor. Kalks Trader draws labelled lines for:

- **Open positions**, showing direction and volume at the entry price.
- **SL and TP** levels attached to each position.
- **Pending orders**, showing the order type and volume.
- **Alerts** you have set.

Right-clicking at a price offers pending orders at that level, a **New order** window (F9) and **Set alert**, which notifies you when price reaches a level without placing a trade. Orders and their management are covered step by step in Phase 2.

> **Risk warning:** One-click trading places orders immediately without a confirmation step. It is convenient but makes accidental or oversized trades easier. Leave it off while you are learning, and always check the volume before sending a leveraged order.

## In practice: a five-minute chart routine

1. Open D1 for your symbol and classify the state: uptrend, downtrend or range.
2. Mark the two or three most important swing highs and lows with horizontal lines.
3. Switch to a second tab on H1 or H4 and note where price sits relative to those levels.
4. Check the Average True Range to see whether the market is calm or busy.
5. Set alerts at your key levels instead of watching the screen all day.

## Common mistakes

- **Too many indicators and drawings.** Clarity beats quantity.
- **One tab for everything.** Switching timeframes on a single tab makes it easy to lose context and marks.
- **Trading from the chart before you understand order types.** Learn them on demo first in Phase 2.

Set up your first workspace and template today on a free demo account in Kalks Trader.
