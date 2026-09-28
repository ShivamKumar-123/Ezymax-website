---
slug: "p4-t-fibonacci-retracements"
title: "Fibonacci retracements and extensions"
summary: "How to draw Fibonacci levels on a swing, calculate them by hand, and use them as zones rather than magic numbers."
order: 5
version: 1
takeaways:
  - "Retracement levels of 23.6%, 38.2%, 50%, 61.8% and 78.6% are measured back from the end of a completed swing towards its start."
  - "Extensions such as 127.2% and 161.8% project possible targets beyond the end of the swing."
  - "The choice of swing points matters more than the tool; use clear, significant highs and lows on the timeframe you trade."
  - "Fibonacci levels are most useful where they overlap with other evidence, such as prior support and resistance or a moving average."
practice:
  label: "On an H4 EURUSD chart, draw the Fibonacci tool from the most recent clear swing low to swing high and check whether any retracement level lines up with an earlier support zone."
  symbol: "EURUSD"
quiz:
  - question: "A USDJPY swing runs from 150.00 up to 152.00. Where is the 61.8% retracement?"
    options:
      - "151.236"
      - "150.764"
      - "151.000"
      - "150.472"
    answer: 1
    explanation: "Range = 2.00. 61.8% of 2.00 = 1.236. The retracement is measured back from the high: 152.00 - 1.236 = 150.764."
  - question: "In a downtrend, how should the Fibonacci retracement tool be drawn?"
    options:
      - "From the swing low to the swing high"
      - "From the swing high to the swing low"
      - "From any two candles of the same colour"
      - "From the daily open to the daily close"
    answer: 1
    explanation: "Draw it in the direction of the move being measured: from the start of the down-swing (the high) to its end (the low). Retracements then appear above the low."
  - question: "Which statement about the 50% level is correct?"
    options:
      - "It is a Fibonacci ratio derived from the sequence"
      - "It is only used for extensions"
      - "It is always the strongest level"
      - "It is not a Fibonacci ratio but is included because half-way retracements are commonly watched"
    answer: 3
    explanation: "50% does not come from the Fibonacci sequence. It is included by convention because traders commonly watch half-way pullbacks."
  - question: "EURUSD swings from 1.0720 to 1.0920. Where is the 161.8% extension measured from the swing low?"
    options:
      - "1.0996"
      - "1.1044"
      - "1.1244"
      - "1.0844"
    answer: 1
    explanation: "Range = 200 pips. 1.618 x 200 = 323.6 pips. 1.0720 + 0.03236 = 1.10436, about 1.1044."
---

Few chart tools attract as much debate as Fibonacci levels. Some traders treat them as almost mystical; others dismiss them entirely. The practical view lies in between: Fibonacci retracements are a consistent way to measure how deep a pullback is relative to the move before it, and many market participants watch the same levels. Used as zones alongside other evidence, they help structure entries and targets.

## Where the ratios come from

The Fibonacci sequence (1, 1, 2, 3, 5, 8, 13, 21, 34, …) produces ratios that settle near fixed values. Dividing a number by the next gives about 0.618; by the number two places later gives about 0.382; by the number three places later gives about 0.236. The 78.6% level is the square root of 0.618. The 50% level is not a Fibonacci ratio at all but is included because half-way pullbacks are widely watched.

There is no proven physical reason why markets should respect these ratios. Their usefulness comes mainly from the fact that pullbacks of roughly one-third to two-thirds of a move are common, and these levels divide that zone neatly.

## Drawing retracements

A retracement measures a pullback against the most recent swing. In an uptrend, draw from the swing low to the swing high; in a downtrend, from the swing high to the swing low. The platform then plots each level as a percentage of the swing, measured back from its end.

```text
EURUSD swing low 1.0720, swing high 1.0920, range 0.0200 (200 pips)

23.6%  1.0920 - 0.0200 x 0.236 = 1.0920 - 0.00472 = 1.0873
38.2%  1.0920 - 0.0200 x 0.382 = 1.0920 - 0.00764 = 1.0844
50.0%  1.0920 - 0.0200 x 0.500 = 1.0920 - 0.01000 = 1.0820
61.8%  1.0920 - 0.0200 x 0.618 = 1.0920 - 0.01236 = 1.0796
78.6%  1.0920 - 0.0200 x 0.786 = 1.0920 - 0.01572 = 1.0763
```

```svg
<svg viewBox="0 0 640 280" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" fill="#121216"/>
<g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
<line x1="60" y1="40" x2="500" y2="40" stroke="#3a3a44"/>
<line x1="60" y1="87" x2="500" y2="87" stroke="#3a3a44" stroke-dasharray="4 4"/>
<line x1="60" y1="116" x2="500" y2="116" stroke="#ff5a1f" stroke-dasharray="4 4"/>
<line x1="60" y1="140" x2="500" y2="140" stroke="#ff5a1f" stroke-dasharray="4 4"/>
<line x1="60" y1="164" x2="500" y2="164" stroke="#ff5a1f" stroke-dasharray="4 4"/>
<line x1="60" y1="197" x2="500" y2="197" stroke="#3a3a44" stroke-dasharray="4 4"/>
<line x1="60" y1="240" x2="500" y2="240" stroke="#3a3a44"/>
<rect x="60" y="116" width="440" height="48" fill="#ff5a1f" fill-opacity="0.08"/>
<polyline fill="none" stroke="#22c55e" stroke-width="2" points="70,240 115,200 150,215 200,120 235,140 275,40"/>
<polyline fill="none" stroke="#ef4444" stroke-width="2" points="275,40 310,90 335,75 375,150"/>
<polyline fill="none" stroke="#22c55e" stroke-width="2" points="375,150 410,110 435,125 490,30"/>
<text x="510" y="44">1.0920 high</text>
<text x="510" y="91">23.6%</text>
<text x="510" y="120">38.2%</text>
<text x="510" y="144">50%</text>
<text x="510" y="168">61.8%</text>
<text x="510" y="201">78.6%</text>
<text x="510" y="244">1.0720 low</text>
<text x="300" y="185">pullback into the 38.2-61.8% zone</text>
</g>
</svg>
```

The shaded band between 38.2% and 61.8% is the zone where many traders watch for a pullback in a trend to end, though nothing guarantees it will. In the sketch, price dips to just below the 50% level before the trend resumes to a new high.

## Extensions as targets

Extensions project how far a move might travel beyond the end of the swing. Measured from the swing low of the example above:

```text
127.2% extension = 1.0720 + 0.0200 x 1.272 = 1.0720 + 0.02544 = 1.0974
161.8% extension = 1.0720 + 0.0200 x 1.618 = 1.0720 + 0.03236 = 1.1044
```

Some platforms measure extensions from the pullback low instead, a three-point projection. Check which method your tool uses before comparing levels with other traders.

## Using Fibonacci in a trade plan

> **Example:** EURUSD is in a daily uptrend. After the rally from 1.0720 to 1.0920, price pulls back. The 50% level at 1.0820 coincides with a former resistance zone around 1.0815 to 1.0825 that is now expected to act as support, and the 50-day EMA is rising through 1.0818. A trader waits for a bullish rejection candle in that zone, enters around 1.0830 with a stop below the 61.8% level at 1.0790, a risk of 40 pips, and targets a retest of 1.0920, a potential 90 pips. That is a reward-to-risk ratio of 2.25. The confluence of three separate reasons makes the zone more meaningful than any single line.

The most important decision is which swing to measure. Use obvious, significant swing points on the timeframe you trade. If you have to hunt for a swing that makes the levels fit, the levels have no value.

## Reading the depth of a pullback

The level at which a pullback ends also says something about the trend. A shallow pullback that holds around 23.6% to 38.2% shows strong demand and an aggressive trend. A pullback to 61.8% or 78.6% shows that sellers came close to undoing the whole move, so the trend is weaker even if it resumes. A close beyond 78.6% usually means the swing has failed, and the structure should be reassessed rather than the tool redrawn.

## Common mistakes

- Treating a level as an exact price. Allow a zone of a few pips on EURUSD or a few dollars on XAUUSD, sized by ATR.
- Redrawing the tool on different swings until one level matches price.
- Entering at a level without any confirmation that buyers or sellers are active there.
- Using Fibonacci in a sideways market, where there is no clear swing to measure.

> **Risk warning:** Fibonacci levels frequently fail, and price can pass straight through them. Always define a stop loss before entering; leveraged CFD losses can exceed your expectations.
