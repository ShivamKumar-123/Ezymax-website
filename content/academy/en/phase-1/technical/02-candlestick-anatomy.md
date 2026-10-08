---
slug: "p1-t-candlestick-anatomy"
title: "Candlestick anatomy"
summary: "Bodies, wicks and closing position: how to read what buyers and sellers did inside a single candle."
order: 2
version: 1
takeaways:
  - "A candle's body spans the open and the close; its colour tells you whether the period finished higher or lower than it started."
  - "Wicks show prices that were reached but not held, so a long wick marks a level where the other side pushed back."
  - "Where a candle closes within its range is often more informative than its colour."
  - "A candle only has meaning in context: its size relative to recent candles and where it forms on the chart matter more than its shape alone."
  - "A candle is not final until its period closes, so judge completed candles rather than the one still forming."
practice:
  label: "On a demo XAUUSD H4 chart, measure the body, upper wick and lower wick of the last three completed candles using the crosshair."
  symbol: "XAUUSD"
quiz:
  - question: "A candle opens at 2,350.40, reaches 2,362.10 and 2,341.80, and closes at 2,344.20. How long is its upper wick?"
    options:
      - "6.20"
      - "11.70"
      - "17.90"
      - "20.30"
    answer: 1
    explanation: "The candle is bearish, so the top of the body is the open, 2,350.40. The upper wick is 2,362.10 - 2,350.40 = 11.70. 6.20 is the body and 20.30 is the full range."
  - question: "What does a long lower wick on a candle generally show?"
    options:
      - "Price was pushed lower during the period but buyers drove it back up before the close"
      - "The market was closed for part of the period"
      - "The spread widened"
      - "Sellers controlled the close"
    answer: 0
    explanation: "A lower wick records prices that traded but were not held. A long one means sellers pushed price down and buyers absorbed that selling and lifted the price again."
  - question: "Which candle shows the strongest control by buyers?"
    options:
      - "A small green candle with a long upper wick"
      - "A red candle closing near its low"
      - "A candle with open and close almost equal"
      - "A large green candle closing at or near its high"
    answer: 3
    explanation: "A large body closing near the high shows buyers were in control and still pushing at the end. A long upper wick means sellers took some control back before the close."
  - question: "Why should you avoid reading too much into the candle that is still forming?"
    options:
      - "Because it is always drawn in the wrong colour"
      - "Because it uses ask prices instead of bid prices"
      - "Because its open, high, low and close can still change until the period ends"
      - "Because Ezymex Trader hides its wicks"
    answer: 2
    explanation: "Until the period ends, the close is just the latest price, and the high or low can still be extended. A candle that looks strong halfway through can close very differently."
---

A candlestick packs four prices into one symbol, but its real value is the story it tells. Read carefully, a single candle shows who had control during a period, where the other side pushed back, and who was winning when time ran out. This chapter teaches you to take a candle apart.

## The parts of a candle

```svg
<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <line x1="200" y1="40" x2="200" y2="190" stroke="#22c55e" stroke-width="2"/>
  <rect x="180" y="80" width="40" height="70" fill="#22c55e"/>
  <line x1="440" y1="40" x2="440" y2="190" stroke="#ef4444" stroke-width="2"/>
  <rect x="420" y="70" width="40" height="70" fill="#ef4444"/>
  <g stroke="#3a3a44" stroke-dasharray="3 3">
    <line x1="206" y1="40" x2="270" y2="40"/>
    <line x1="222" y1="80" x2="270" y2="80"/>
    <line x1="222" y1="150" x2="270" y2="150"/>
    <line x1="206" y1="190" x2="270" y2="190"/>
    <line x1="446" y1="40" x2="510" y2="40"/>
    <line x1="462" y1="70" x2="510" y2="70"/>
    <line x1="462" y1="140" x2="510" y2="140"/>
    <line x1="446" y1="190" x2="510" y2="190"/>
  </g>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <text x="275" y="44">High</text>
    <text x="275" y="84">Close</text>
    <text x="275" y="154">Open</text>
    <text x="275" y="194">Low</text>
    <text x="515" y="44">High</text>
    <text x="515" y="74">Open</text>
    <text x="515" y="144">Close</text>
    <text x="515" y="194">Low</text>
    <text x="120" y="64" text-anchor="end">Upper wick</text>
    <text x="120" y="119" text-anchor="end">Body</text>
    <text x="120" y="174" text-anchor="end">Lower wick</text>
    <text x="200" y="218" text-anchor="middle" font-size="13">Bullish: close above open</text>
    <text x="440" y="218" text-anchor="middle" font-size="13">Bearish: close below open</text>
    <text x="320" y="22" text-anchor="middle" font-size="14">Candlestick anatomy</text>
  </g>
  <g stroke="#3a3a44">
    <line x1="124" y1="60" x2="194" y2="60"/>
    <line x1="124" y1="115" x2="178" y2="115"/>
    <line x1="124" y1="170" x2="194" y2="170"/>
  </g>
</svg>
```

- **Body:** the filled rectangle between the open and the close. In Ezymex Trader it is green when the close is above the open (bullish) and red when the close is below the open (bearish).
- **Upper wick (or shadow):** the thin line from the top of the body to the high.
- **Lower wick:** the thin line from the bottom of the body to the low.

Note the one thing that trips up beginners: on a bullish candle the **top** of the body is the close, while on a bearish candle the top of the body is the **open**.

## Measuring a candle

Four measurements describe any candle:

```text
Range       = high - low
Body        = |close - open|
Upper wick  = high - max(open, close)
Lower wick  = min(open, close) - low
Check:        upper wick + body + lower wick = range
```

> **Example:** An XAUUSD H4 candle opens at 2,350.40, trades up to 2,362.10, down to 2,341.80 and closes at 2,344.20. It is bearish because the close is below the open. Range = 2,362.10 - 2,341.80 = 20.30. Body = 2,350.40 - 2,344.20 = 6.20. Upper wick = 2,362.10 - 2,350.40 = 11.70. Lower wick = 2,344.20 - 2,341.80 = 2.40. Check: 11.70 + 6.20 + 2.40 = 20.30.

What does this candle say? Buyers first pushed gold almost 12 dollars above the open, but could not hold it. Sellers then drove price below the open and it closed only 2.40 above the low, in the bottom 12% of the range (2.40 / 20.30). The story is a failed rally followed by selling into the close.

## What bodies and wicks tell you

**Large body, small wicks.** One side controlled almost the entire period. A large green candle closing at its high shows buyers still pushing at the final moment.

**Small body, long wicks.** Both sides pushed hard, neither won. This signals indecision, especially after a strong move.

**Long upper wick.** Price was driven higher, then rejected. The high marks a level where sellers were active.

**Long lower wick.** Price was driven lower, then bought back. The low marks a level where buyers were active.

**Open and close almost equal.** Usually called a doji. The period ended where it started, whatever happened in between.

## Closing position: the most useful single clue

Colour tells you only whether the close was above or below the open. The **closing position within the range** tells you who was in control at the end.

| Close position | Reading |
|---|---|
| Top quarter of the range | Buyers in control at the close |
| Middle of the range | Balance, no clear winner |
| Bottom quarter of the range | Sellers in control at the close |

A green candle that closes in the middle of its range, after a big upper wick, is weaker than its colour suggests. A red candle that closes near its high after a deep lower wick shows sellers failed to keep their gains.

## Context changes everything

A candle is only meaningful relative to its surroundings:

- **Size compared with recent candles.** A 20-dollar gold candle is ordinary in a volatile week and remarkable in a quiet one.
- **Location.** A long lower wick at a level where price has turned up before carries more weight than the same candle in the middle of nowhere.
- **Timeframe.** An M5 candle reflects five minutes of trading; a D1 candle reflects a full day and many more participants.

> **Tip:** Before you interpret a candle, compare its range with the last ten candles on the same timeframe. If it is two or three times larger than usual, something changed, often scheduled news. Check the economic calendar in the Client Area before reading it as a pure buyer-or-seller signal.

Named candlestick patterns, such as engulfing candles and pin bars, are covered in Phase 3. The skills in this chapter are what those patterns are built on.

## Common mistakes

- **Reading the forming candle as if it were complete.** Its close, high and low can still change until the period ends.
- **Judging by colour alone.** Check body size and closing position.
- **Ignoring wicks.** Wicks show where the market refused to stay, which is often where the next decision will be made.

Use the crosshair in Ezymex Trader on a free demo account to measure the parts of recent candles and describe each one in a sentence.
