---
slug: "p2-t-market-orders"
title: "Market orders: buying and selling now"
summary: "How a market order is filled, which side of the quote you get, how to read the order ticket and how to close a position."
order: 1
version: 1
takeaways:
  - "A market order buys at the current ask or sells at the current bid, filled at the best price available when it reaches the server."
  - "Closing a position is simply the opposite deal: a long is closed by selling at the bid, a short by buying at the ask."
  - "Check symbol, direction and volume before confirming, and attach a stop loss at the moment of entry."
  - "Market orders guarantee a fill in normal conditions but not an exact price, which matters most around news and market opens."
practice:
  label: "On your demo account, open a 0.01 lot EURUSD market buy with a stop loss, note the fill price against the ask, then close it and compare the result with the spread."
  symbol: "EURUSD"
quiz:
  - question: "EURUSD is quoted 1.0850 / 1.0851. At what price is a market buy normally filled?"
    options:
      - "1.0850"
      - "1.08505"
      - "1.0851"
      - "At the last traded price on the chart"
    answer: 2
    explanation: "Buys are filled at the ask, the higher price, 1.0851. The bid of 1.0850 is where you would sell."
  - question: "You hold a long XAUUSD position. How is it closed?"
    options:
      - "By selling the same volume, at the bid"
      - "By buying the same volume, at the ask"
      - "By cancelling the original order"
      - "It closes automatically at the New York close"
    answer: 0
    explanation: "Closing a long means selling it, and sells are filled at the bid. A position does not close by itself unless a stop, target or stop-out is hit."
  - question: "Immediately after buying 0.50 lot EURUSD at 1.0851 with the quote at 1.0850 / 1.0851, what is the floating result?"
    options:
      - "0 USD"
      - "-5 USD"
      - "-0.50 USD"
      - "+5 USD"
    answer: 1
    explanation: "The position would be closed at the bid, 1.0850, one pip below entry. 0.50 lot is 5 USD per pip, so it shows -5 USD, the spread cost."
  - question: "Which statement about market orders is correct?"
    options:
      - "They are always filled at exactly the price shown when you click"
      - "They can only be used during the London session"
      - "They do not use margin"
      - "They are filled at the best available price, which can differ from the price you saw"
    answer: 3
    explanation: "A market order prioritises getting filled. The price can move between clicking and execution, producing slippage in either direction."
---

The market order is the simplest instruction you can give: buy or sell this symbol, this volume, now. It is how most beginners place their first trade and how most traders exit when they want out immediately. Simple does not mean careless, though. Knowing exactly which price you will get, and what to check before clicking, prevents the most common and most expensive beginner errors.

## Which price you get

As covered in the fundamental track, every symbol has a bid and an ask. A market **buy** is filled at the **ask**; a market **sell** is filled at the **bid**. The chart in Ezymex Trader normally plots the bid, so a buy fill will usually sit slightly above the last candle.

A market order is executed at the best price available when it reaches the server. In calm conditions on a liquid symbol such as EURUSD, that is almost always the price you saw. When prices are moving fast, it can be a little better or a little worse. That difference is **slippage**, covered in detail later in this track.

## The order ticket

Opening a new order in Ezymex Trader shows an order ticket. Before confirming a market order, check each field:

1. **Symbol.** It is easy to have GBPUSD selected when you meant EURUSD, or US30 instead of NAS100.
2. **Direction.** Buy if you expect the price to rise, sell if you expect it to fall.
3. **Volume in lots.** 0.10 and 1.00 look similar at a glance and differ by a factor of ten.
4. **Stop loss and take profit.** You can attach both at entry. A stop at entry means you are never unprotected, even for a few seconds.
5. **Margin.** Know roughly how much margin the trade will use and compare it with your free margin, using the formula from the fundamental track.

Reading the ticket back takes three seconds. Fixing a 1.00 lot trade that should have been 0.10 lot can cost far more.

## Worked example: opening and closing

```text
Quote EURUSD 1.0850 / 1.0851
Market buy 0.20 lot, filled at ask 1.0851
Pip value: 20,000 x 0.0001 = 2.00 USD
Immediate floating result (close at bid 1.0850): -1 pip x 2.00 = -2.00 USD

Later: quote 1.0874 / 1.0875
Close = market sell 0.20 lot at bid 1.0874
Result: (1.0874 - 1.0851) x 20,000 = 0.0023 x 20,000 = +46.00 USD
```

The closing deal uses the bid because closing a long means selling. For a short the roles reverse: you open at the bid and close by buying at the ask.

> **In Ezymex Trader:** Open positions appear in the positions panel with their entry price, current price, volume and floating result. Closing a position sends an opposite market order for its full volume; you can also close part of it, as covered in the chapter on OCO and partial close.

## When a market order is the right tool

Use a market order when getting in or out **now** matters more than the exact price:

- Your analysis says the setup is valid at the current price and waiting risks missing it.
- You need to exit quickly because the reason for the trade has disappeared.
- The market is liquid, spreads are normal and no high-impact news is due within minutes.

Consider a pending order instead when you have a specific price in mind, when you cannot watch the screen, or when spreads are wide. Pending orders are the subject of the next chapter.

> **Risk warning:** A market order placed during high-impact news, at the weekly open or at the daily rollover can be filled at a noticeably worse price than displayed, because liquidity is thin and spreads widen. CFDs are leveraged, so a few pips of slippage on a large position is real money.

## Opening a short

Selling first feels strange to people used to buying shares, but for CFDs it is symmetrical. A market sell on USDJPY at 155.20 opens a short position; if USDJPY falls to 154.70 and you buy back at that ask, you gain 50 pips. You do not need to own dollars or borrow anything yourself: the CFD simply pays the price difference.

## Common mistakes

- Clicking sell when you meant buy. Many terminals put the two buttons side by side; slow down.
- Opening without a stop loss, intending to add one "in a moment", then getting distracted.
- Clicking repeatedly because the fill seemed slow, and ending up with two or three positions. Check the positions panel before trying again.
- Placing market orders seconds before scheduled news or at 00:00 server time, when spreads are at their widest.
- Forgetting that the chart shows the bid. A short's stop is triggered by the ask, which can be above the highest candle on the chart.
