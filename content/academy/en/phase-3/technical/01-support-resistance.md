---
slug: "p3-t-support-and-resistance"
title: "Support and resistance"
summary: "How to find the price levels where buying or selling has repeatedly appeared, draw them as zones, and use them to plan entries, stops and targets."
order: 1
version: 1
takeaways:
  - "Support and resistance are price areas where orders have repeatedly entered the market, so they are better drawn as zones than as single lines."
  - "A level gains weight from clear reactions, higher timeframes, round numbers and how recently it was respected."
  - "Once broken convincingly, support often becomes resistance and resistance often becomes support (role reversal)."
  - "Levels are for planning: they help define where a trade is wrong (the stop) and where it may stall (the target)."
practice:
  label: "On a EURUSD H4 chart in your demo account, mark the two most obvious support zones and two resistance zones from the last three months using horizontal lines."
  symbol: "EURUSD"
quiz:
  - question: "Why is support better drawn as a zone than as an exact line?"
    options:
      - "Because charts are inaccurate"
      - "Because orders cluster around an area and spreads and wicks vary, so reactions rarely occur at one exact price"
      - "Because zones always hold"
      - "Because brokers require it"
    answer: 1
    explanation: "Buyers and sellers do not coordinate to one exact tick. Wicks overshoot, spreads differ, so a narrow zone captures the real area of interest."
  - question: "Former resistance at 1.0900 is broken and price later pulls back to it and bounces. What is this called?"
    options:
      - "Role reversal: old resistance acting as new support"
      - "A false breakout"
      - "A gap fill"
      - "A double top"
    answer: 0
    explanation: "After a convincing break, traders who missed the move or who were short and want out often buy on a return to the level, so it acts as support."
  - question: "Which factor makes a support level more significant?"
    options:
      - "It was touched once on the M1 chart"
      - "Price crashed straight through it last time"
      - "It is visible on the daily chart with several clean reactions"
      - "It sits halfway between two random prices"
    answer: 2
    explanation: "Higher-timeframe visibility and repeated clean reactions show that many participants act there. Single touches on tiny timeframes carry little weight."
  - question: "You buy EURUSD at 1.0812 with a stop at 1.0785 and target 1.0866, trading 0.10 lot. What are the risk and potential reward in USD?"
    options:
      - "Risk 2.70 USD, reward 5.40 USD"
      - "Risk 270 USD, reward 540 USD"
      - "Risk 54 USD, reward 27 USD"
      - "Risk 27 USD, reward 54 USD"
    answer: 3
    explanation: "Stop distance is 27 pips and target 54 pips. At 0.10 lot EURUSD is worth 1 USD per pip, so risk is 27 USD and reward 54 USD, a 1:2 ratio."
---

Look at any chart long enough and you will notice prices where the market has turned more than once. Traders call a floor where falling prices tend to stop **support** and a ceiling where rising prices tend to stall **resistance**. They are the foundation of price action trading, because nearly every other concept in this section, from trendlines to breakouts, is built on them.

## Why levels exist

Support and resistance are not magic lines. They reflect memory and orders. When EURUSD rallies strongly from 1.0800, several things happen: traders who bought there remember it as a good price, traders who missed it want a second chance, and short sellers who were caught place their buy stops nearby. When price returns, that cluster of buy orders can absorb selling and push price up again.

The same logic works in reverse at resistance, where sellers who missed the top, and buyers who want to exit at breakeven, wait with sell orders. Round numbers such as 1.1000, 2,400.00 on XAUUSD or 39,000 on US30 attract extra orders simply because people like round prices.

## Drawing zones, not lines

Price rarely reverses at the exact same tick. Wicks overshoot, spreads differ between brokers, and orders are spread across an area. Draw levels as **zones**:

1. Start on a higher timeframe such as daily or H4 so you see the levels that matter to more traders.
2. Find areas where price turned sharply at least twice.
3. Draw the zone from where most candle bodies stopped to where the wicks extended.
4. Keep the zone narrow relative to the instrument's volatility, for example 8 to 15 pips on EURUSD H4, or a few dollars on XAUUSD.

```svg
<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <rect x="40" y="50" width="560" height="22" fill="#ef4444" fill-opacity="0.15" stroke="#ef4444" stroke-dasharray="4 3"/>
    <text x="48" y="44">Resistance zone 1.0895 - 1.0905</text>
    <rect x="40" y="215" width="560" height="22" fill="#22c55e" fill-opacity="0.15" stroke="#22c55e" stroke-dasharray="4 3"/>
    <text x="48" y="256">Support zone 1.0795 - 1.0805</text>
    <polyline fill="none" stroke="#ff5a1f" stroke-width="2" points="40,150 90,225 140,120 190,58 240,140 290,228 340,170 390,62 440,110 490,60 540,130 590,35"/>
    <circle cx="90" cy="225" r="4" fill="#22c55e"/>
    <circle cx="290" cy="228" r="4" fill="#22c55e"/>
    <circle cx="190" cy="58" r="4" fill="#ef4444"/>
    <circle cx="390" cy="62" r="4" fill="#ef4444"/>
    <circle cx="490" cy="60" r="4" fill="#ef4444"/>
    <text x="545" y="30">Break</text>
    <line x1="40" y1="280" x2="600" y2="280" stroke="#3a3a44"/>
    <text x="280" y="296">Time</text>
  </g>
</svg>
```

## What makes a level strong

Not all levels are equal. Give more weight to a zone when:

- **It is visible on a higher timeframe.** A daily level is watched by far more participants than an M5 level.
- **Reactions were clean and strong.** A sharp rejection of 60 pips says more than a slow drift.
- **It has been respected recently.** A level from last month matters more than one from three years ago.
- **It aligns with a round number** or with other tools such as a trendline.

Multiple touches cut both ways. Each test absorbs some of the waiting orders, so a level tested five times in quick succession is often closer to breaking, not stronger. Watch whether each bounce gets weaker.

## Role reversal

When a level breaks convincingly, its role often flips. Former resistance becomes support and former support becomes resistance. Traders who were short below resistance and are now losing may buy back on a return to the level to exit near breakeven, and traders who missed the breakout buy the retest. This **role reversal** gives some of the clearest price action setups. Breakouts and false breaks get their own chapter later in this section.

## Using levels to plan a trade

Levels are most useful for deciding where a trade idea is wrong and where it might stall.

> **Example:** EURUSD has bounced twice from the 1.0795-1.0805 zone on the H4 chart, and the next resistance zone is 1.0860-1.0870. Price returns to support and prints a bullish rejection candle. You buy at 1.0812, place the stop at 1.0785, just below the zone and beyond the wicks, and set the target at 1.0866, just inside resistance.

```text
Stop distance:   1.0812 - 1.0785 = 0.0027 = 27 pips
Target distance: 1.0866 - 1.0812 = 0.0054 = 54 pips
Reward : risk    54 / 27 = 2 : 1

Position 0.10 lot → 0.10 × 100,000 × 0.0001 = 1 USD per pip
Risk   = 27 × 1 = 27 USD
Reward = 54 × 1 = 54 USD
```

The stop sits where the idea is invalidated: if price trades below the zone, buyers have clearly failed. The target sits before the opposing zone, where sellers are expected.

> **Risk warning:** No level is guaranteed to hold. CFDs are leveraged, gaps and slippage can fill your stop at a worse price, and losses can exceed what you planned. Size every position from the stop distance, not from how confident you feel.

## Common mistakes

- **Drawing too many lines.** A chart covered in levels gives you a reason to do anything. Keep the few that clearly matter.
- **Stops exactly at the level.** Put stops beyond the zone and the typical wick, not on the obvious line.
- **Ignoring the higher timeframe.** An M15 support directly under a daily resistance is a weak buy.
- **Assuming more touches means stronger.** Repeated tests often wear a level down.

> **In Ezymex Trader:** Use the chart's drawing tools to mark each zone on the daily or H4 chart first, then switch to a lower timeframe to see how price behaves as it approaches the zone.
