---
slug: "p5-t-stop-placement"
title: "Where to place the stop loss"
summary: "Place stops where your trade idea is proven wrong, using market structure and volatility, then size the position to fit the stop rather than the reverse."
order: 4
version: 1
takeaways:
  - "A stop loss belongs at the price that invalidates your trade idea, not at an arbitrary number of pips or a dollar amount you are comfortable with."
  - "Structure-based stops sit beyond a swing high or low with a buffer; volatility-based stops use a multiple of ATR so they adapt to current conditions."
  - "The stop decides the distance and the risk budget decides the size: a wider stop means a smaller position, never a larger risk."
  - "Short positions are closed at the ask price, so stops on sells need extra room for the spread, especially when spreads widen."
practice:
  label: "On a demo EURUSD H1 chart, find the last clear swing low, add ATR(14) to the chart, and calculate where a structure stop and a 1.5 x ATR stop would sit for a long trade."
  symbol: "EURUSD"
quiz:
  - question: "Which statement best describes a well-placed stop loss?"
    options:
      - "It is always 20 pips from entry"
      - "It sits at a level where the reason for the trade is no longer valid"
      - "It is set so that the loss equals the margin used"
      - "It is placed exactly on a round number"
    answer: 1
    explanation: "The stop should mark the point at which your analysis is proven wrong. The position size is then adjusted so that hitting it costs your chosen risk."
  - question: "XAUUSD ATR(14) on H1 is $6.50. A trader uses a 1.5 x ATR stop on a long entry at 2,350.40. Where is the stop?"
    options:
      - "2,343.90"
      - "2,334.15"
      - "2,344.00"
      - "2,340.65"
    answer: 3
    explanation: "1.5 x 6.50 = $9.75, and 2,350.40 - 9.75 = 2,340.65."
  - question: "Your analysis requires a 50-pip stop instead of your usual 25 pips on EURUSD. What should you do to keep risk at $100?"
    options:
      - "Keep the usual 0.40 lots"
      - "Double the size to 0.80 lots"
      - "Halve the position size to 0.20 lots"
      - "Use a 25-pip stop anyway"
    answer: 2
    explanation: "Risk = lots x pips x $10. At 50 pips, $100 / (50 x $10) = 0.20 lots. The stop defines the distance; the size adjusts."
  - question: "Why can a sell trade's stop be triggered even though the bid price on the chart never reached it?"
    options:
      - "Because stops on sells are triggered by the ask price, which is above the bid by the spread"
      - "Because the platform always adds 10 pips to sell stops"
      - "Because sell stops only work on hedging accounts"
      - "Because charts show the ask price only"
    answer: 0
    explanation: "A short position is closed by buying, at the ask. Charts usually show the bid, so if the spread widens the ask can reach the stop while the bid line stays below it."
---

The previous chapters showed how to turn a risk amount and a stop distance into a lot size. That leaves the most practical question: where should the stop actually go? A stop that is too tight gets hit by normal noise; one that is too wide makes the position so small that the trade is hardly worth taking, or, if the size is not reduced, it quietly multiplies your risk. This chapter gives you a method.

## Principle: the stop marks where you are wrong

Every trade rests on an idea. "EURUSD is making higher lows and has bounced from support at 1.0830" is an idea. The stop belongs at the price that would prove it wrong, for example a break below the last higher low. If price reaches that level, the reason for the trade no longer exists and you should be out.

This leads to the order of operations used by professionals:

1. Identify the entry and the invalidation level from the chart.
2. Measure the stop distance.
3. Calculate the position size from your risk amount.
4. Check the reward available to the first logical target. If it is less than the minimum reward-to-risk ratio your strategy needs, skip the trade.

Choosing the lot size first and then fitting a stop to a comfortable dollar amount reverses this logic and places stops where the market has no reason to respect them.

## Structure-based stops

The most common approach is to place the stop beyond a level that matters: below the swing low for a long, above the swing high for a short, or beyond the far side of a support or resistance zone. Add a small **buffer** so that a brief spike through the level does not take you out.

```svg
<svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <polyline points="40,90 110,200 170,140 240,245 300,170 360,210 420,120" fill="none" stroke="#c9c9d1" stroke-width="2"/>
    <circle cx="240" cy="245" r="4" fill="#ff5a1f"/>
    <text x="118" y="252">Swing low 1.0822</text>
    <circle cx="360" cy="210" r="4" fill="#22c55e"/>
    <line x1="340" y1="210" x2="620" y2="210" stroke="#22c55e" stroke-dasharray="5 4"/>
    <text x="470" y="203">Entry 1.0850 (long)</text>
    <line x1="200" y1="265" x2="620" y2="265" stroke="#ef4444" stroke-width="2"/>
    <text x="470" y="284">Stop 1.0818 (4-pip buffer)</text>
    <line x1="340" y1="80" x2="620" y2="80" stroke="#22c55e" stroke-dasharray="2 4"/>
    <text x="470" y="73">First target 1.0914 (2R)</text>
    <line x1="600" y1="210" x2="600" y2="265" stroke="#ff5a1f"/>
    <text x="500" y="242">32 pips = 1R</text>
    <text x="20" y="310">Illustrative EURUSD H1 structure (not to scale)</text>
  </g>
</svg>
```

> **Example:** EURUSD pulls back to a higher low at 1.0822 and turns up. You buy at 1.0850 and place the stop 4 pips below the swing low at 1.0818, a 32-pip stop. With $100 risk: 100 / (32 x $10) = 0.3125, rounded down to 0.31 lots, an actual risk of 0.31 x 32 x $10 = $99.20. A 2R target is 64 pips above entry at 1.0914. If the nearest resistance is at 1.0880, only about 0.9R away, the trade does not offer enough reward for a 2R strategy.

Avoid placing stops exactly on obvious levels such as round numbers (1.0800) or just beyond a very clean double bottom. Many other stops cluster there, and price often probes those levels before reversing.

## Volatility-based stops

The Average True Range (ATR), covered in Phase 4, measures the typical range of a candle. A stop set at a multiple of ATR, usually 1 to 3, automatically widens in volatile markets and tightens in quiet ones.

```text
XAUUSD long at 2,350.40, ATR(14) on H1 = $6.50
Stop = 1.5 x ATR = $9.75  ->  stop at 2,340.65
Size for $100 risk = 100 / (9.75 x 100) = 0.1026 -> 0.10 lots
Actual risk = 0.10 x 100 x 9.75 = $97.50
```

The best practice combines the two: find the structural invalidation level, then check that it is at least about one ATR away. If the structure stop is inside normal noise, widen it and reduce the size, or wait for a better entry.

## Spread, sessions and news

- **Sell stops need the spread.** A short position is closed by buying at the ask. Charts usually show the bid, so add the typical spread, plus a margin for widening, to stops on sells.
- **Rollover and news widen spreads.** Around 00:00 server time and major releases, spreads can widen several times over. Tight stops placed just beyond the bid can be triggered by the spread alone.
- **Gaps ignore stops.** Over weekends and on sharp news, price can open beyond your stop and fill at a worse level. This is why risk per trade should stay modest.

## Moving the stop

Once a trade is working, a stop can be moved to reduce risk, never to increase it:

- **To breakeven** after price has moved a meaningful distance, commonly 1R, or after a new swing forms.
- **Trailing behind structure**, moving the stop under each new higher low in a long trade.
- **Server-side trailing stop** in Ezymex Trader, which follows price at a fixed distance and keeps working when you are offline.

Moving to breakeven too early is a common error: it turns many trades that would have worked into scratch trades after normal pullbacks.

## Common mistakes

- Using the same pip stop on every symbol and every timeframe.
- Widening a stop as price approaches it. This converts a planned 1R loss into an unplanned 2R or 3R loss.
- Placing a stop inside the normal range of the last few candles.
- Forgetting that a wider stop requires a proportionally smaller size.

> **Risk warning:** A stop loss limits losses in normal conditions but is not guaranteed. CFDs are leveraged, and gaps or slippage can result in a fill beyond your stop level and a loss larger than planned.
