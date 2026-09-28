---
slug: "p4-t-classic-chart-patterns"
title: "Classic chart patterns"
summary: "Head and shoulders, double tops and bottoms, triangles and flags: how to identify them, where they are confirmed and how measured targets are calculated."
order: 6
version: 1
takeaways:
  - "A reversal pattern is only confirmed when price closes beyond the neckline or trough; before that it is just a possibility."
  - "Measured targets project the pattern's height from the breakout point and are rough guides, not guaranteed destinations."
  - "Triangles show contracting volatility; ascending and descending triangles have a flat side that marks the breakout level."
  - "Flags and pennants are short pauses after a sharp move and are continuation patterns in the direction of that move."
  - "Patterns carry more weight on higher timeframes and when they form at meaningful support or resistance."
practice:
  label: "Scan daily charts of US30, XAUUSD and GBPUSD for one completed double top or bottom and calculate the measured target from its neckline."
  symbol: "US30"
quiz:
  - question: "A head and shoulders on GBPUSD has a head at 1.2850 and a flat neckline at 1.2700. Price closes below the neckline. What is the measured target?"
    options:
      - "1.2550"
      - "1.2600"
      - "1.2650"
      - "1.2400"
    answer: 0
    explanation: "Height = 1.2850 - 1.2700 = 0.0150. Target = neckline - height = 1.2700 - 0.0150 = 1.2550."
  - question: "When is a double top confirmed?"
    options:
      - "When price closes below the trough between the two peaks"
      - "When the second peak forms at the same level as the first"
      - "When RSI goes above 70"
      - "As soon as price touches the first peak again"
    answer: 0
    explanation: "Two peaks alone are just a test of resistance. The pattern is confirmed only when price closes below the intervening trough, the neckline."
  - question: "An ascending triangle has which structure?"
    options:
      - "Falling highs and a flat low"
      - "Parallel rising lines"
      - "A flat top and rising lows"
      - "Rising highs and falling lows"
    answer: 2
    explanation: "An ascending triangle has horizontal resistance and higher lows pressing into it. A break above the flat top is the usual trigger."
  - question: "NAS100 rallies from 18,000 to 18,400, then forms a small downward-sloping flag and breaks out at 18,320. Using the flagpole method, what is the target?"
    options:
      - "18,400"
      - "18,640"
      - "18,720"
      - "18,800"
    answer: 2
    explanation: "Flagpole = 18,400 - 18,000 = 400 points. Added to the breakout point: 18,320 + 400 = 18,720."
---

Chart patterns are recurring shapes that reflect a shift in the balance between buyers and sellers. In Phase 3 you learned to read market structure, support and resistance. Patterns are larger combinations of those same elements. This chapter covers the four most widely followed: head and shoulders, double tops and bottoms, triangles and flags.

## Head and shoulders

A head and shoulders top forms after an uptrend. Price makes a peak (the left shoulder), a higher peak (the head) and then a lower peak (the right shoulder). The lows between the peaks are connected by the neckline.

```svg
<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" fill="#121216"/>
<g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
<polyline fill="none" stroke="#c9c9d1" stroke-width="2" points="30,200 80,150 120,95 160,160 230,40 300,160 350,92 400,158 440,200 480,185 520,235"/>
<line x1="100" y1="160" x2="500" y2="160" stroke="#ff5a1f" stroke-width="1.5"/>
<text x="92" y="84">left shoulder</text>
<text x="210" y="30">head</text>
<text x="320" y="82">right shoulder</text>
<text x="430" y="152" fill="#ff5a1f">neckline</text>
<line x1="230" y1="40" x2="230" y2="160" stroke="#3a3a44" stroke-dasharray="4 4"/>
<text x="238" y="110">height H</text>
<line x1="560" y1="160" x2="560" y2="240" stroke="#ef4444" stroke-dasharray="4 4"/>
<text x="440" y="252" fill="#ef4444">target = neckline - H</text>
<text x="400" y="215" fill="#ef4444">close below</text>
</g>
</svg>
```

The logic is structural: the head is the last higher high; the right shoulder fails to make a new high; and the break of the neckline is the first lower low. The uptrend's sequence of higher highs and higher lows has been broken.

> **Example:** On a daily US30 chart, the left shoulder peaks at 39,450, the head at 39,700 and the right shoulder at 39,460. The neckline is roughly flat at 39,200. The height is 39,700 - 39,200 = 500 points. After a daily close below 39,200, the measured target is 39,200 - 500 = 38,700. A stop above the right shoulder at 39,480 puts risk at about 280 points from a 39,200 entry, against a potential 500.

The inverse head and shoulders is the mirror image at the end of a downtrend, with the target projected upward from the neckline. A sloping neckline is common; in that case the target is projected from the point where price actually breaks the line, not from its average level.

## Double tops and bottoms

A double top is two peaks at roughly the same level with a trough between them. It shows that buyers failed twice to push through resistance. The pattern is confirmed when price closes below the trough.

```text
XAUUSD double top: peaks 2,380.00 and 2,379.20, trough 2,350.00
Height = 2,380.00 - 2,350.00 = 30.00
Confirmation: close below 2,350.00
Measured target = 2,350.00 - 30.00 = 2,320.00
```

Many apparent double tops never break the trough. Price simply ranges between the two levels, which is why confirmation matters. A double bottom is the reverse.

## Triangles

Triangles form as the range contracts, reflecting falling volatility before a larger move.

| Type | Structure | Typical bias |
|---|---|---|
| Ascending | Flat top, rising lows | Upside break more common |
| Descending | Flat bottom, falling highs | Downside break more common |
| Symmetrical | Falling highs, rising lows | Neutral; often continues the prior trend |

The measured target is the height of the triangle at its widest point, added to or subtracted from the breakout level. Breakouts that occur very late, near the apex, are often weaker because the pattern has lost its tension.

## Flags and pennants

A flag is a small rectangle sloping against a sharp move, the flagpole. A pennant is a small symmetrical triangle in the same position. Both are pauses in which early traders take profit before the move continues.

> **Example:** NAS100 rallies from 18,000 to 18,400 in two sessions, then drifts lower in a tight channel to about 18,300. A break above the channel at 18,320 triggers the pattern. The flagpole of 400 points projected from the breakout gives a target of 18,720. A stop below the flag low at 18,290 risks 30 points for a potential 400, although the full target is often not reached.

## How reliable are patterns?

Patterns are subjective, and hindsight makes them look cleaner than they appeared in real time. Some practical rules improve their usefulness:

- Wait for a candle close beyond the breakout level, not an intrabar touch; Phase 3 covered false breaks.
- Prefer patterns on H4 and daily charts; small patterns on M5 are mostly noise.
- Prefer patterns that form at established support or resistance or after an extended trend.
- Treat measured targets as zones and consider taking partial profits before them.
- Accept that many patterns fail. Record your own results on demo to see how they behave on the instruments you trade.

## Common mistakes

- Entering before confirmation because the shape looks almost complete.
- Drawing necklines at an angle that suits the trade idea.
- Holding for the full measured target regardless of how price behaves on the way.
- Placing the stop so far away that the reward-to-risk ratio no longer makes sense.

> **Risk warning:** Chart patterns fail regularly, and breakouts can reverse immediately. Measured targets are not forecasts. Trading patterns with leveraged CFDs can lead to losses that exceed your expectations.
