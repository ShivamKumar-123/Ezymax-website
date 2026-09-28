---
slug: "p3-t-breakouts-and-false-breaks"
title: "Breakouts and false breaks"
summary: "Tell a genuine breakout from a false one, choose between entering on the break or the retest, and turn failed breakouts into opportunities."
order: 5
version: 1
takeaways:
  - "A breakout is a close beyond a well-defined level that leads to acceptance, not just a brief spike through it."
  - "Genuine breakouts tend to show strong closes, follow-through, and a context such as tightening price action and the higher-timeframe trend."
  - "Entering on the retest gives a tighter stop and better reward to risk but means missing some moves; entering on the close catches more moves but with a wider stop."
  - "A false break that quickly closes back inside the range often traps traders and can drive price to the opposite side."
practice:
  label: "On a NAS100 M15 chart, find the high and low of the Asian-hours range and watch how price behaves when it first moves beyond either side during the European or US session."
  symbol: "NAS100"
quiz:
  - question: "NAS100 has a range between 18,200 and 18,400. A candle spikes to 18,430 but closes at 18,380. What is this most likely?"
    options:
      - "A confirmed breakout"
      - "A break of structure to the upside"
      - "A false break (failed breakout) above resistance"
      - "A retest of support"
    answer: 2
    explanation: "Price traded above resistance but could not hold, closing back inside the range. Buyers who entered on the spike are now trapped."
  - question: "What is the main advantage of entering a breakout on the retest rather than on the breakout candle?"
    options:
      - "A tighter stop and better reward to risk, at the cost of missing moves that never retest"
      - "The retest always happens"
      - "Spreads are always lower on retests"
      - "No stop loss is needed"
    answer: 0
    explanation: "On the retest you are closer to the level that invalidates the trade, so the stop is shorter. But strong breakouts often run without looking back."
  - question: "Which condition makes a breakout more likely to be genuine?"
    options:
      - "It happens against the higher-timeframe trend during the quietest hour of the day"
      - "The breakout candle closes with a long wick back towards the range"
      - "The level has only been touched once"
      - "Price has made progressively tighter swings into the level and closes strongly beyond it"
    answer: 3
    explanation: "Compression into a level shows the other side is being absorbed; a strong close beyond it shows acceptance. Wicks back into the range show rejection."
  - question: "After a false break below support, where would a trader looking to buy the failure typically place the stop?"
    options:
      - "Inside the middle of the range"
      - "Just below the low of the false break"
      - "At the top of the range"
      - "No stop is needed after a false break"
    answer: 1
    explanation: "If price returns below the false-break low, the failure idea is wrong. The low of the spike marks clear invalidation."
---

Every support or resistance level eventually breaks. The challenge is that many apparent breaks fail: price pokes through, triggers orders, then snaps back. Distinguishing a real breakout from a false one, and knowing how to trade either, is one of the most practical skills in price action. This chapter builds on the levels and structure from the earlier chapters in this section.

## What a breakout really is

A **breakout** is not just price trading beyond a level. It is price **accepting** the new area. The clearest signs of acceptance are:

- A candle that **closes** beyond the level, ideally near its own extreme, rather than just a wick through it.
- **Follow-through**: the next candle or two continue in the breakout direction instead of stalling.
- The broken level **holds on a retest** in its new role, old resistance acting as support.

A **false break** (failed breakout) happens when price moves beyond the level but cannot stay there. It closes back inside, often quickly, trapping those who bought the break and those whose stops were triggered.

## Why false breaks happen

Obvious levels attract obvious orders. Above a clear range high sit the buy stops of short sellers and the buy-stop entries of breakout traders. When price reaches that area, those orders are filled. If no fresh buying follows, the participants who sold into those orders, including larger traders who needed liquidity to sell, now control the market, and price falls back. The spike was fuelled by stops, not by new demand.

## Clues that separate real from false

| Clue | Genuine breakout | Likely false break |
|---|---|---|
| Close | Strong close beyond the level | Long wick, close back inside |
| Build-up | Tighter swings pressing into the level | Sudden spike from the middle of the range |
| Trend context | With the higher-timeframe trend | Against it, into a higher-timeframe level |
| Timing | Active session, for example the London or New York open | Thin liquidity hours or just before major news |
| Follow-through | Next candles extend the move | Immediate stall and reversal |

No single clue is decisive. The more of them agree, the higher the odds.

## Two ways to enter a breakout

```svg
<svg viewBox="0 0 640 280" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <line x1="30" y1="120" x2="610" y2="120" stroke="#ff5a1f" stroke-dasharray="5 4"/>
    <text x="36" y="112">Resistance 18,400</text>
    <line x1="30" y1="230" x2="330" y2="230" stroke="#3a3a44" stroke-dasharray="5 4"/>
    <text x="36" y="250">Support 18,200</text>
    <polyline fill="none" stroke="#c9c9d1" stroke-width="2" points="40,200 80,130 120,220 160,128 200,190 240,126 270,160 300,95 330,80 370,118 410,70 460,40"/>
    <circle cx="300" cy="95" r="5" fill="#22c55e"/>
    <text x="190" y="72">A: close above</text>
    <circle cx="370" cy="118" r="5" fill="#22c55e"/>
    <text x="378" y="145">B: retest holds</text>
    <line x1="30" y1="265" x2="610" y2="265" stroke="#3a3a44"/>
    <text x="300" y="278">Time</text>
  </g>
</svg>
```

**Entry A, on the breakout close.** You buy when a candle closes above resistance. You catch every genuine breakout, including those that never look back, but your stop must go below the level or below the breakout candle, which is usually wider. You will also be caught by more false breaks.

**Entry B, on the retest.** You wait for price to return to the broken level and hold. The stop is tighter, just below the retested zone, and reward to risk improves. The cost: strong breakouts often leave without a retest, and you miss them.

> **Example:** NAS100 has ranged between 18,200 and 18,400 for two sessions. At the New York open a 15-minute candle closes at 18,460. Entry A buys at 18,460 with a stop at 18,370, below the range high: 90 points of risk. Entry B waits; price pulls back to 18,410, holds, and B buys at 18,415 with a stop at 18,375: 40 points of risk. Both target 18,600, the height of the range (200 points) added to the breakout level. On an example contract worth 1 USD per point, A risks 90 USD to make 140 USD; B risks 40 USD to make 185 USD. Check the contract specification in Kalks Trader for the actual value per point.

```text
Range height:  18,400 - 18,200 = 200 points → target 18,400 + 200 = 18,600
Entry A: risk 18,460 - 18,370 = 90   reward 18,600 - 18,460 = 140   ratio ≈ 1.6
Entry B: risk 18,415 - 18,375 = 40   reward 18,600 - 18,415 = 185   ratio ≈ 4.6
```

## Trading the false break

A failed breakout can be a setup in itself. If price spikes below support, then closes back inside the range, sellers who shorted the break are trapped and must buy to exit. A trader can buy after the close back inside, with a stop just below the false-break low and a first target at the middle or top of the range.

> **In Kalks Trader:** A buy stop order a few points above resistance enters as soon as price trades through the level, a faster but less filtered version of Entry A because it does not wait for the close. Once price has broken out, a buy limit order at the broken level automates Entry B. Give each order an expiry so a stale idea does not fill days later.

> **Risk warning:** Breakouts often occur around news and session opens, when spreads widen and stop orders can slip. CFDs are leveraged, and losses can exceed what you planned. Size each position from the stop distance.

## Common mistakes

- **Buying the wick.** Wait for the close; many spikes reverse within the same candle.
- **Trading every range edge.** Breakouts from well-defined, multi-touch levels are far more meaningful than breaks of minor swings.
- **Stops just inside the range.** On Entry A, price commonly dips back towards the level; a stop too close is taken out before the move continues.
- **Ignoring the calendar.** A breakout seconds before CPI or NFP is a coin flip with wide spreads.
