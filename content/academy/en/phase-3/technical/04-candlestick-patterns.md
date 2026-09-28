---
slug: "p3-t-candlestick-patterns"
title: "Candlestick patterns that matter"
summary: "Read the most useful single and multi-candle patterns as evidence of who won the battle in a period, and learn why location matters more than the pattern itself."
order: 4
version: 1
takeaways:
  - "A candlestick pattern summarises the fight between buyers and sellers in one or a few periods; it is evidence, not a signal on its own."
  - "Pin bars, engulfing candles, inside bars, dojis and three-candle stars cover most of what you need."
  - "Location is everything: the same pattern at a key level with the trend is far more meaningful than one in the middle of nowhere."
  - "Wait for the candle to close before judging it; an unfinished candle can change completely."
practice:
  label: "Scroll back through a GBPUSD H4 chart and find three pin bars. For each, note whether it formed at a support or resistance zone and what happened over the next five candles."
  symbol: "GBPUSD"
quiz:
  - question: "A GBPUSD H4 candle has open 1.2702, high 1.2710, low 1.2650, close 1.2705. What is it?"
    options:
      - "A bullish pin bar, with a long lower wick showing rejection of lower prices"
      - "A bearish engulfing candle"
      - "An inside bar"
      - "A shooting star"
    answer: 0
    explanation: "The lower wick is 52 of the 60-pip range with a small body near the top, which is a bullish pin bar (hammer shape)."
  - question: "What defines a bearish engulfing pattern?"
    options:
      - "A small bearish candle inside a large bullish one"
      - "Two dojis in a row"
      - "A bearish candle whose body fully covers the prior bullish candle's body"
      - "A gap up followed by a bullish candle"
    answer: 2
    explanation: "The second candle opens at or above the prior close and closes below the prior open, so its body engulfs the previous body, showing sellers overwhelmed buyers."
  - question: "Why is it important to wait for the candle to close before acting on a pattern?"
    options:
      - "Kalks Trader does not show open candles"
      - "Patterns only exist on daily charts"
      - "Spreads are always zero at the close"
      - "Until it closes, the candle's body and wicks can change and the pattern may disappear"
    answer: 3
    explanation: "A hammer halfway through the hour can become a bearish candle by the close. The pattern only exists once the period is complete."
  - question: "Which setting gives a bullish engulfing pattern the most weight?"
    options:
      - "In the middle of a sideways range with no nearby levels"
      - "At a daily support zone after a pullback in an uptrend"
      - "Immediately after a large gap on the M1 chart"
      - "At the top of an ascending channel"
    answer: 1
    explanation: "Context matters: the pattern at support, in the direction of the higher-timeframe trend, combines three pieces of evidence rather than one."
---

A single candle tells you four prices: open, high, low and close. Read together, they tell a short story about who controlled that period and where the other side was pushed back. Candlestick patterns are named versions of the stories that repeat often. Phase 1 covered candle anatomy; this chapter covers the handful of patterns worth knowing and, more importantly, how to judge whether a pattern means anything.

## Reading the story in a candle

- A **long body** with small wicks means one side dominated from open to close.
- A **long wick** means price went somewhere and was rejected. A long lower wick shows sellers pushed down and buyers pushed back.
- A **small body** with wicks on both sides shows indecision: neither side won.

Patterns are useful because they compress this into something you can recognise quickly. They are not predictions. They show what happened, and you decide whether that evidence matters given where it happened.

## Single-candle patterns

```svg
<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1" text-anchor="middle">
    <line x1="80" y1="40" x2="80" y2="190" stroke="#22c55e" stroke-width="2"/>
    <rect x="68" y="50" width="24" height="18" fill="#22c55e"/>
    <text x="80" y="220">Bullish pin bar</text>
    <text x="80" y="238">(hammer)</text>
    <line x1="210" y1="40" x2="210" y2="190" stroke="#ef4444" stroke-width="2"/>
    <rect x="198" y="164" width="24" height="18" fill="#ef4444"/>
    <text x="210" y="220">Bearish pin bar</text>
    <text x="210" y="238">(shooting star)</text>
    <line x1="340" y1="60" x2="340" y2="170" stroke="#c9c9d1" stroke-width="2"/>
    <rect x="326" y="113" width="28" height="3" fill="#c9c9d1"/>
    <text x="340" y="220">Doji</text>
    <line x1="450" y1="95" x2="450" y2="165" stroke="#ef4444" stroke-width="2"/>
    <rect x="440" y="105" width="20" height="45" fill="#ef4444"/>
    <line x1="485" y1="75" x2="485" y2="185" stroke="#22c55e" stroke-width="2"/>
    <rect x="472" y="85" width="26" height="85" fill="#22c55e"/>
    <text x="468" y="220">Bullish engulfing</text>
    <line x1="570" y1="60" x2="570" y2="190" stroke="#22c55e" stroke-width="2"/>
    <rect x="558" y="75" width="24" height="95" fill="#22c55e"/>
    <line x1="602" y1="95" x2="602" y2="160" stroke="#ef4444" stroke-width="2"/>
    <rect x="592" y="105" width="20" height="40" fill="#ef4444"/>
    <text x="586" y="220">Inside bar</text>
  </g>
</svg>
```

**Pin bar.** A candle with a long wick, at least about two-thirds of its range, and a small body at the other end. A bullish pin bar (hammer shape) has a long lower wick and shows rejection of lower prices. A bearish pin bar (shooting star shape) has a long upper wick and shows rejection of higher prices.

> **Example:** A GBPUSD H4 candle opens at 1.2702, trades up to 1.2710, drops to 1.2650, and closes at 1.2705. Range = 60 pips. Lower wick = 1.2702 - 1.2650 = 52 pips, about 87% of the range. Body = 3 pips, upper wick = 5 pips. Sellers pushed price 52 pips below the open and buyers took it all back: a clear bullish pin bar.

**Doji.** Open and close are almost equal. It signals indecision. After a strong run into resistance, a doji shows the trend lost its push for that period; in the middle of a range it means very little.

## Two-candle patterns

**Engulfing.** A bullish engulfing candle opens at or below the prior bearish candle's close and closes above its open, so its body covers the previous body entirely. It shows buyers overwhelmed sellers in one period. The bearish version is the mirror image. Because FX trades continuously, opens often equal the previous close, so some traders only require the second body to exceed the first.

**Inside bar.** A candle whose high and low are entirely within the previous candle's range (the "mother bar"). It shows contraction and pause. Traders often use a break of the mother bar's high or low as the trigger, in the direction of the trend.

## Three-candle patterns

**Morning star and evening star.** A morning star is a strong bearish candle, then a small-bodied candle (indecision), then a strong bullish candle closing well into the first candle's body. It represents a shift from selling to buying over three periods. The evening star is the bearish version at a top. These are slower but often clearer than single candles.

## Location beats pattern

The same pin bar can be meaningful or meaningless. Ask three questions:

1. **Is it at a level?** A pin bar rejecting a daily support zone is evidence that buyers defended it.
2. **Is it with the trend?** Bullish patterns in an uptrend's pullback are more reliable than bullish patterns fighting a downtrend.
3. **Is it significant in size?** A pin bar that is tiny compared with recent candles shows little; one larger than average shows real rejection.

A practical plan for a bullish pin bar at support: enter on a break of the pin bar's high, place the stop a few pips below its low, and target the next resistance. With the GBPUSD example, entry 1.2712 and stop 1.2645 gives 67 pips of risk. At 0.10 lot GBPUSD is worth 1 USD per pip (USD is the quote currency), so 67 USD is at risk.

> **Risk warning:** No candlestick pattern works every time, and studies of patterns in isolation show weak results. CFDs are leveraged and losses can exceed expectations; treat patterns as confirmation at a level you already planned, not as a system.

## Common mistakes

- **Pattern hunting everywhere.** Most candles in the middle of a range mean nothing.
- **Acting before the close.** A hammer at 20 minutes into the hour can close as a bearish candle.
- **Ignoring the timeframe.** A pin bar on M1 carries far less information than one on H4 or daily. Daily candles in Kalks Trader close at 00:00 server time, the New York close, so daily patterns reflect a full trading day.
- **Memorising dozens of names.** The few patterns here, read in context, cover most useful situations.
