---
slug: "p3-t-trendlines-and-channels"
title: "Trendlines and channels"
summary: "Draw trendlines that reflect real market behaviour, project them forward, build channels, and read what a steepening, flattening or broken line is telling you."
order: 3
version: 1
takeaways:
  - "An uptrend line connects rising swing lows and a downtrend line connects falling swing highs; two points draw a line, a third touch validates it."
  - "A channel adds a parallel line through the opposite swings and helps frame where price is extended or cheap within the trend."
  - "Very steep trendlines are rarely sustainable; a shift to a shallower angle often signals slowing momentum."
  - "A trendline break is a warning about momentum, but market structure (highs and lows) should confirm any change of trend."
practice:
  label: "On a US30 H1 chart, draw a trendline through two clear swing lows, extend it to the right, and note where it will sit in 20 bars' time."
  symbol: "US30"
quiz:
  - question: "How many touches are usually needed before a trendline is treated as validated?"
    options:
      - "One"
      - "Three: two to draw it and a third reaction to confirm"
      - "Two, and the more distant they are the less valid"
      - "Ten"
    answer: 1
    explanation: "Any two points can form a line. A third reaction at the projected line shows that other traders are responding to it too."
  - question: "A trendline connects lows at 38,600 (bar 0) and 38,900 (bar 10). Where does it project at bar 20?"
    options:
      - "38,900"
      - "39,500"
      - "39,200"
      - "39,050"
    answer: 2
    explanation: "The slope is 300 points over 10 bars, or 30 points per bar. At bar 20: 38,600 + 20 × 30 = 39,200."
  - question: "Price breaks below a steep uptrend line but keeps making higher lows at a shallower angle. What is the most reasonable reading?"
    options:
      - "Momentum has slowed, but the uptrend structure remains intact"
      - "The trend has reversed to a downtrend"
      - "The line was drawn wrong and should be deleted"
      - "A short position is guaranteed to profit"
    answer: 0
    explanation: "Losing a steep line shows the pace has eased. As long as higher lows continue, the trend is intact; structure decides, not the line alone."
  - question: "In an ascending channel, what does price trading at the upper channel line usually suggest for a trend-following buyer?"
    options:
      - "It is the best place to buy"
      - "The trend has ended"
      - "Stops should be widened"
      - "Price is extended within the trend, so buying here offers poor reward to risk"
    answer: 3
    explanation: "The upper line marks the extended side of the trend. Buyers usually get better reward to risk nearer the lower line, closer to their stop."
---

Horizontal support and resistance mark prices. Trendlines mark **direction and pace**. A well-drawn trendline shows where buyers in an uptrend (or sellers in a downtrend) have been stepping in at progressively better prices. It gives you a dynamic level that moves with time, and when combined with a parallel line it becomes a channel that frames the whole trend.

## Drawing a valid trendline

An **uptrend line** connects rising swing lows and sits below price. A **downtrend line** connects falling swing highs and sits above price. Follow a few rules to keep your lines honest:

1. Use clear swing points, as defined in the market structure chapter, not random candles.
2. Two points draw a line; a **third reaction** near the projected line validates it.
3. Be consistent: either connect wicks or connect candle bodies, and use the same method each time. Wicks are the most common choice, but bodies can give a cleaner line on volatile instruments.
4. Do not force a line through candles. If you have to cut through several bodies to make it fit, it is not a real trendline.
5. Draw on the timeframe you are analysing. A daily trendline usually carries more weight than an M15 one.

The **angle** matters. Trendlines at very steep angles are rarely sustainable because they require price to keep accelerating. Lines around a moderate slope tend to last longer and receive more touches.

## Projecting a trendline

A trendline's value is that it tells you where the level will be in the future, not just where it was.

> **Example:** On a US30 H1 chart, a swing low forms at 38,600 on bar 0 and a higher swing low at 38,900 on bar 10. The line rises 300 points in 10 bars, or 30 points per bar. You can calculate where it will be at any later bar.

```text
Slope = (38,900 - 38,600) / 10 bars = 30 points per bar

Projected line at bar 15: 38,600 + 15 × 30 = 39,050
Projected line at bar 20: 38,600 + 20 × 30 = 39,200
```

If price pulls back to about 39,200 around bar 20 and shows a rejection, that is the third touch, and the line becomes more meaningful. A trader who buys there with a stop 60 points below the line would, on an example contract worth 1 USD per point, risk 60 USD per contract. Check the contract specification in Ezymex Trader for the actual contract size of each index.

## Channels

A **channel** adds a line parallel to the trendline through the swing points on the other side. In an uptrend you draw the trendline through the lows, then copy it through a significant swing high.

Continuing the example, suppose a swing high formed at 39,100 on bar 5. At bar 5 the trendline is at 38,600 + 5 × 30 = 38,750, so the channel is 350 points wide. Projected forward, the upper line at bar 20 sits at 39,550, still 350 points above the trendline at 39,200.

Channels help in three ways:

- **Location.** Price near the lower line is relatively cheap within the trend; price near the upper line is extended.
- **Targets.** In an uptrend, the upper line is a logical area to take partial profit.
- **Behaviour.** If price starts failing to reach the upper line, buying pressure is weakening. If it breaks above the upper line with strength, the trend may be accelerating.

## Reading breaks

A break of a trendline is a signal about **momentum**, not automatically a reversal. Common patterns:

- **Steepening:** price leaves the channel upward and a new, steeper line forms. Trends that go vertical often end in sharp reversals, so be cautious about buying late.
- **Flattening:** price breaks a steep line but continues higher at a shallower angle. The trend is intact but slowing.
- **Genuine reversal:** the line breaks, then price makes a lower high and a lower low. Structure confirms what the line suggested.

The line gives an early warning; swing highs and lows give confirmation. When a trendline and a horizontal level coincide, that confluence is often stronger than either alone.

> **Risk warning:** Trendlines are subjective and can be redrawn after the fact to look perfect. Treat them as one input among several. CFDs are leveraged, and losses can exceed expectations if a level fails suddenly.

## Common mistakes

- **Redrawing the line every time it breaks.** If you keep adjusting it to fit, it tells you nothing.
- **Using minor wiggles as anchor points.** Anchor lines to significant swings.
- **Buying at the top of a channel.** In a trend, patience for a pullback nearer the lower line usually gives better reward to risk.
- **Treating a break as an automatic reversal trade.** Wait for structure to confirm.
- **Ignoring log versus linear scale.** On long-term charts of fast-rising assets such as BTCUSD or NVDA, trendlines can look different on a logarithmic scale; for intraday work this rarely matters.

> **In Ezymex Trader:** Use the trendline tool and extend it to the right so you can see where it projects. A parallel channel can be built by copying the line through the opposite swing point.
