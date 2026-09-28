---
slug: "p2-t-stop-loss-take-profit-trailing"
title: "Stop loss, take profit and trailing stops"
summary: "How protective stops and profit targets are triggered and filled, how to translate them into money, and how a server-side trailing stop follows the price."
order: 3
version: 1
takeaways:
  - "A stop loss closes a losing position at the next available price once its level is touched, so it limits loss but can slip in fast markets."
  - "A take profit closes at your target price or better once it is reached."
  - "Stops and targets on long positions trigger on the bid; on short positions they trigger on the ask."
  - "A server-side trailing stop moves only in your favour at a fixed distance and keeps working when Kalks Trader is closed."
practice:
  label: "Open a 0.01 lot EURUSD demo position with a 20-pip stop and 40-pip target, then add a 15-pip trailing stop and watch how the stop level updates."
  symbol: "EURUSD"
quiz:
  - question: "You buy 0.20 lot EURUSD at 1.0851 with a stop loss at 1.0821. How much do you lose if the stop is filled exactly?"
    options:
      - "30 USD"
      - "600 USD"
      - "6 USD"
      - "60 USD"
    answer: 3
    explanation: "The stop is 30 pips away and 0.20 lot is worth 2 USD per pip, so the loss is 30 x 2 = 60 USD."
  - question: "Which price triggers the stop loss of a short position?"
    options:
      - "The ask"
      - "The bid"
      - "The mid price"
      - "The previous candle close"
    answer: 0
    explanation: "A short is closed by buying, and buys are executed at the ask, so its stop loss triggers on the ask."
  - question: "A long position has a 20-pip trailing stop. Price rises 50 pips, then falls 10 pips. Where is the stop?"
    options:
      - "20 pips below entry"
      - "30 pips above entry"
      - "40 pips above entry"
      - "At entry"
    answer: 1
    explanation: "At the peak, 50 pips above entry, the stop is 20 pips below it: 30 pips above entry. A trailing stop never moves back, so the 10-pip fall does not change it."
  - question: "Why can a stop loss be filled at a worse price than its level?"
    options:
      - "Because stops are filled at the previous day's close"
      - "Because the broker adds a fixed penalty"
      - "Because once triggered it becomes a market order and executes at the next available price"
      - "Because stops only work while the terminal is open"
    answer: 2
    explanation: "A triggered stop is executed as a market order. In a gap or fast market the next available price can be beyond the stop level."
---

Placing a trade is a decision about where you think price is going. Placing a **stop loss** is a decision about where you admit you were wrong. Placing a **take profit** is a decision about where you will be satisfied. Kalks Trader lets you attach both to any market or pending order, and adds a server-side **trailing stop** that follows the price for you. This chapter explains how each behaves in practice.

## Stop loss: the exit when you are wrong

A stop loss is an instruction to close the position if price moves against you to a given level. For a long position it sits below the entry; for a short, above.

Two mechanics matter:

- **Trigger side.** A long is closed by selling, so its stop triggers when the **bid** reaches the level. A short is closed by buying, so its stop triggers when the **ask** reaches the level. Since the chart normally shows the bid, a short's stop can trigger when the chart appears not to have reached it, especially when spreads widen.
- **Fill.** Once triggered, a stop becomes a market order. In calm markets you are filled at or very near the level. In a fast market, a news spike or a weekend gap, the fill can be worse. A stop loss limits your loss; it does not guarantee an exact price.

## Take profit: the exit when you are right

A take profit closes the position once price reaches your target. It behaves like a limit order: filled at the target price or better. A long's take profit triggers on the bid, a short's on the ask.

A take profit forces you to decide the reward before emotion takes over. Without one, traders often watch a winning trade return to breakeven while waiting for "a bit more".

## Turning levels into money

```text
Long 0.20 lot EURUSD at 1.0851 (pip value 2.00 USD)
Stop loss   1.0821  -> 30 pips x 2.00 = 60.00 USD risk
Take profit 1.0911  -> 60 pips x 2.00 = 120.00 USD target
Reward to risk = 120 / 60 = 2 : 1

Short 0.10 lot XAUUSD at 2,350.40 (10 oz, 10 USD per 1.00 move)
Stop loss   2,362.40 -> 12.00 x 10 = 120.00 USD risk
Take profit 2,326.40 -> 24.00 x 10 = 240.00 USD target
```

Doing this before placing the order tells you whether the potential loss is acceptable. How much to risk per trade, and where to put stops relative to market structure, are covered in depth in later phases.

> **Risk warning:** CFDs are leveraged and stop losses can be filled at worse prices during gaps or fast markets, so your actual loss can exceed the planned amount. A stop loss is still far better than none: it is the main tool that keeps a single trade from damaging your account.

## Trailing stops

A trailing stop is a stop loss that moves automatically in your favour. You set a distance, for example 20 pips. For a long, each time the bid makes a new high the stop is moved up so it stays 20 pips below that high. If the price falls, the stop stays where it is. It never moves against you.

On Kalks the trailing stop is **server-side**: it is managed by the server, so it keeps trailing when your browser or Kalks Trader is closed.

```svg
<svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <line x1="60" y1="30" x2="60" y2="290" stroke="#3a3a44" stroke-width="1"/>
  <line x1="60" y1="290" x2="560" y2="290" stroke="#3a3a44" stroke-width="1"/>
  <text x="8" y="59" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0905</text>
  <text x="8" y="119" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0885</text>
  <text x="8" y="224" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0850</text>
  <text x="8" y="281" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0831</text>
  <polyline points="60,217 140,190 220,160 280,175 340,100 400,115 450,55 520,115" fill="none" stroke="#22c55e" stroke-width="2"/>
  <path d="M60,277 H140 V250 H220 V220 H340 V160 H450 V115 H520" fill="none" stroke="#ff5a1f" stroke-width="2"/>
  <circle cx="520" cy="115" r="5" fill="#ef4444"/>
  <text x="530" y="112" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Stop hit</text>
  <text x="530" y="128" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0885</text>
  <line x1="380" y1="250" x2="410" y2="250" stroke="#22c55e" stroke-width="2"/>
  <text x="416" y="254" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Bid price</text>
  <line x1="380" y1="270" x2="410" y2="270" stroke="#ff5a1f" stroke-width="2"/>
  <text x="416" y="274" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Trailing stop, 20 pips</text>
  <text x="310" y="312" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Time (simplified: the stop rises only when price makes a new high)</text>
</svg>
```

> **Example:** You buy 0.20 lot EURUSD at 1.0851 with a 20-pip trailing stop. The bid climbs to 1.0890, so the stop moves to 1.0870. The bid dips to 1.0875; the stop stays at 1.0870. The bid then rises to 1.0905 and the stop moves to 1.0885. When the bid falls back to 1.0885, the position closes: (1.0885 - 1.0851) = 34 pips x 2.00 USD = 68.00 USD profit.

The distance is the key choice. Too tight, and normal fluctuations close the trade early; too wide, and you give back much of the profit before exiting. A distance based on the symbol's typical movement (gold needs far more room than EURUSD) works better than a fixed number used everywhere.

## Common mistakes

- Placing stops at round numbers or obvious levels where many other stops sit, making them easy to reach in a quick spike.
- Widening the stop when price approaches it. This turns a planned loss into an unplanned larger one.
- Setting a take profit so far away that it is rarely reached, or so close that costs eat most of the gain.
- Forgetting the spread on short positions: the ask, not the bid shown on the chart, triggers the stop.
