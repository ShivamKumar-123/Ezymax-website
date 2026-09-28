---
slug: "p3-t-supply-and-demand-zones"
title: "Supply and demand zones"
summary: "Identify the price areas where strong imbalances between buyers and sellers started big moves, and learn how to grade and trade them."
order: 6
version: 1
takeaways:
  - "A demand zone is the base from which price rallied strongly; a supply zone is the base from which price dropped strongly."
  - "The strength of the move away from the zone (the departure) matters more than how long price spent in it."
  - "Fresh zones that have not been revisited tend to react better than zones that have been tested several times."
  - "Zones give a precise area for entries and a logical place for stops just beyond the far edge of the zone."
practice:
  label: "On a USDJPY H1 chart, find one demand zone and one supply zone where price left in a strong move of several candles. Mark them with rectangles and note whether each is still fresh."
  symbol: "USDJPY"
quiz:
  - question: "What best defines a demand zone?"
    options:
      - "Any price where the market has touched three times"
      - "A round number below current price"
      - "The area where price paused briefly before a strong, impulsive rally"
      - "The lowest price of the year"
    answer: 2
    explanation: "A demand zone is the base (the consolidation) that preceded a strong move up, suggesting buyers overwhelmed sellers there."
  - question: "Why do traders prefer fresh zones?"
    options:
      - "Unfilled orders may still be waiting in a zone that has not been revisited"
      - "Fresh zones are always on the daily chart"
      - "Brokers give lower spreads at fresh zones"
      - "Fresh zones cannot fail"
    answer: 0
    explanation: "The idea is that some orders were left unfilled when price left quickly. Each return fills more of them, so later tests tend to react less."
  - question: "Which feature makes a supply zone stronger?"
    options:
      - "Price drifted slowly away from it over many small candles"
      - "It has been tested five times"
      - "It sits in the middle of a range"
      - "Price dropped away sharply in large bearish candles and broke a prior swing low"
    answer: 3
    explanation: "A sharp departure that also breaks structure shows a significant imbalance. Slow drifts and repeated tests suggest the imbalance was small or has been used up."
  - question: "A USDJPY demand zone is 154.20-154.45. You buy at 154.50 with a stop at 154.10. How many pips of risk is this?"
    options:
      - "4 pips"
      - "40 pips"
      - "400 pips"
      - "0.40 pips"
    answer: 1
    explanation: "On JPY pairs a pip is 0.01. 154.50 - 154.10 = 0.40, which is 40 pips."
---

Support and resistance mark where price has turned. **Supply and demand zones** go one step further: they focus on where a strong move **started**. The idea is that a sharp, one-directional move shows an imbalance, far more buy orders than sell orders or the reverse, and that some of those orders may still be waiting when price returns. Many traders use zones as a more precise way to locate entries than broad horizontal levels.

## Where zones come from

Large participants such as banks and funds cannot fill big orders at one price without moving the market. They often build positions over a period of relatively quiet trading, then price moves away quickly once the other side is exhausted. On a chart this looks like:

- A **base**: a few small-bodied candles where price paused.
- A **departure**: large candles moving strongly away from the base.

A **demand zone** is a base followed by a strong rally. A **supply zone** is a base followed by a strong drop. The zone itself is drawn around the base.

The two common shapes are:

- **Continuation zones:** rally-base-rally (demand) and drop-base-drop (supply), which form inside trends.
- **Reversal zones:** drop-base-rally (demand) and rally-base-drop (supply), which form at turning points.

## Drawing a zone

1. Find a strong departure: several large candles in one direction, ideally breaking a prior swing high or low.
2. Look to the left of the departure for the base, the small candles just before it.
3. Draw the **proximal line** (the edge nearest current price) at the top of the base bodies for a demand zone, or the bottom of the base bodies for a supply zone.
4. Draw the **distal line** (the far edge) at the lowest wick of the base for demand, or the highest wick for supply.
5. Extend the rectangle to the right until price returns.

If the zone is very wide relative to the instrument's normal movement, look on a lower timeframe to refine it; a wide zone forces a wide stop.

## Grading a zone

Not all zones are worth trading. Score them on a few questions:

- **Departure strength.** Did price leave with large, decisive candles? A slow drift suggests little imbalance.
- **Structure.** Did the departure break a prior swing high (for demand) or low (for supply)? That shows the move changed the balance of power.
- **Freshness.** Has price already returned? The first return usually reacts best; each later test uses up remaining orders.
- **Time in the base.** Fewer base candles are generally better. A long, sprawling base is really a range.
- **Trend alignment.** Demand zones in an uptrend and supply zones in a downtrend have the wind behind them.
- **Room to move.** Is there enough distance to the opposing zone to make the trade worthwhile?

## A worked example

> **Example:** On the USDJPY H1 chart, price pauses for three small candles between 154.20 and 154.45, then rallies in four strong candles to 155.60, breaking the previous swing high at 155.10. That base is a fresh demand zone: proximal line 154.45, distal line 154.20. Two days later price pulls back into the zone. A trader places a buy limit at 154.50, just above the proximal line to allow for spread, with a stop at 154.10, below the distal line, and a target at 155.30, below the recent high where sellers may appear.

```text
USDJPY pip size = 0.01
Risk:    154.50 - 154.10 = 0.40 = 40 pips
Reward:  155.30 - 154.50 = 0.80 = 80 pips
Reward : risk = 2 : 1

Pip value at 0.20 lot: 0.20 × 100,000 × 0.01 = 200 JPY per pip
Risk in JPY:  40 × 200 = 8,000 JPY
Risk in USD:  8,000 / 154.50 ≈ 51.78 USD
```

Because the profit or loss on USDJPY is in yen, it is converted to USD at the current rate, so the dollar value per pip changes slightly as the price moves.

> **Risk warning:** Zones are an interpretation, not a guarantee. A zone can be broken without any reaction, especially around news. CFDs are leveraged and losses can exceed expectations; use a stop beyond the zone and size positions from it.

## Zones versus support and resistance

The two ideas overlap. The practical differences:

- Support and resistance often come from **multiple touches**; zones come from **one strong departure**.
- Support and resistance are thought to get stronger with confirmation; zones are thought to weaken with each test.
- Zones are usually narrower and more precise, giving tighter stops.

The best setups often combine both: a fresh demand zone that also sits on a daily support level or at the lower line of a channel.

## Common mistakes

- **Marking every base.** Only bases followed by strong departures qualify.
- **Zones that are too wide.** A 100-pip zone on H1 is not a precise area; refine it on a lower timeframe or skip it.
- **Trading tested zones.** A zone that has already been hit three times has probably used up its orders.
- **Fighting the trend.** A supply zone in a strong uptrend is often simply run through.
- **Stops on the distal line.** Place the stop a little beyond it to allow for spread and wicks.

> **In Kalks Trader:** Use a rectangle drawing to mark zones and a pending limit order with an attached stop loss and take profit, so the plan executes even if you are away from the screen. Set an expiry so the order does not fill after the setup has changed.
