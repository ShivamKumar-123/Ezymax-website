---
slug: "p2-t-netting-vs-hedging"
title: "Netting vs hedging accounts"
summary: "How the two position modes treat new orders on the same symbol, how average prices and reversals work in netting, and how Close By works in hedging."
order: 5
version: 1
takeaways:
  - "In netting mode there is one position per symbol; new orders add to it, reduce it or reverse it."
  - "Adding to a netting position creates a volume-weighted average entry price."
  - "In hedging mode every fill is its own position, so a long and a short on the same symbol can exist together."
  - "Close By closes two opposite hedging positions against each other, saving one spread, but holding a hedge only freezes a loss while swaps continue on both legs."
quiz:
  - question: "On a netting account you buy 0.30 lot EURUSD at 1.0850 and then 0.10 lot at 1.0870. What is the resulting position?"
    options:
      - "Two positions: 0.30 at 1.0850 and 0.10 at 1.0870"
      - "0.40 lot long at 1.0860"
      - "0.40 lot long at 1.0855"
      - "0.20 lot long at 1.0850"
    answer: 2
    explanation: "Netting combines them into one position with a volume-weighted price: (0.30 x 1.0850 + 0.10 x 1.0870) / 0.40 = 1.0855. The simple average of 1.0860 ignores the different sizes."
  - question: "On a netting account you are long 1.00 lot USDJPY and sell 1.50 lot. What do you hold afterwards?"
    options:
      - "A long of 1.00 and a short of 1.50"
      - "Nothing, the sell is rejected"
      - "A long of 0.50 lot"
      - "A short of 0.50 lot"
    answer: 3
    explanation: "The first 1.00 lot of the sell closes the long; the remaining 0.50 lot opens a new short. Holding both sides at once is only possible in hedging mode."
  - question: "On a hedging account you hold a long 0.50 lot EURUSD at 1.0851 and a short 0.50 lot at 1.0830. You use Close By. What is the combined result?"
    options:
      - "-105 USD"
      - "+105 USD"
      - "0 USD"
      - "-210 USD"
    answer: 0
    explanation: "Closing the pair against each other settles the long at the short's price: (1.0830 - 1.0851) x 50,000 = -105 USD, without paying a further spread."
  - question: "What is the main drawback of keeping a losing position hedged with an equal opposite position?"
    options:
      - "It doubles the profit when the market turns"
      - "It locks in the loss while spreads and swaps continue to cost money on both legs"
      - "It is not allowed on any account"
      - "It removes the loss from your equity"
    answer: 1
    explanation: "A full hedge freezes the floating result but does not remove it. Both legs pay costs, and you still have to decide later which side to close."
---

Suppose you are long EURUSD and you place a sell order on EURUSD. What should happen? There are two legitimate answers, and your account's **position mode** decides which one applies. Ezymex supports both modes, set per trading account: **netting** and **hedging**. Knowing which you are using is essential, because the same click produces a different result in each.

## Netting: one position per symbol

In netting mode an account holds at most one position per symbol. Every new deal on that symbol changes the existing position:

- **Same direction:** it is added, and the entry becomes a volume-weighted average.
- **Opposite direction, smaller volume:** the position is reduced and the closed part is realised.
- **Opposite direction, equal volume:** the position is closed.
- **Opposite direction, larger volume:** the position is closed and a new one opens in the other direction for the difference.

```text
Buy 0.50 lot EURUSD at 1.0850
Buy 0.50 lot EURUSD at 1.0870
  Position: 1.00 lot long at (0.50 x 1.0850 + 0.50 x 1.0870) / 1.00 = 1.0860

Sell 0.40 lot at 1.0880
  Realised on 0.40: (1.0880 - 1.0860) x 40,000 = +80.00 USD
  Position: 0.60 lot long at 1.0860

Sell 1.20 lot at 1.0870
  Closes 0.60 long: (1.0870 - 1.0860) x 60,000 = +60.00 USD
  Opens 0.60 lot short at 1.0870
```

Netting is simple to read: the positions panel always shows your true net exposure per symbol. It is also how positions are reported on many exchange-traded markets. The price you see is an average, though, so remember that adding to a position changes its break-even point.

## Hedging: every fill is its own position

In hedging mode each filled order creates a separate position with its own entry, stop loss and take profit. A sell order on EURUSD while you are long does not reduce the long; it opens an independent short. You can hold several longs at different prices, or a long and a short together.

This suits traders who manage entries individually, for example scaling in with separate stops for each part, or running two strategies on the same symbol in one account. To reduce a specific position you use the close or partial close action on that position, not a new opposite order.

## Close By

When a hedging account holds opposite positions on the same symbol, **Close By** closes them against each other. Instead of closing each position at the market and paying the spread twice, the two are matched: the long is effectively closed at the short's entry price and vice versa. If the volumes differ, the smaller one closes fully and the larger one is reduced.

> **Example:** You are long 0.50 lot EURUSD at 1.0851 and later sold 0.50 lot at 1.0830 as a hedge. Close By settles both: (1.0830 - 1.0851) x 50,000 = -105.00 USD. That is the same loss as if the long had been closed at 1.0830, the moment you opened the short. Closing each leg separately at the market would add one more spread on top.

## The truth about hedging a losing trade

Opening an equal opposite position on a losing trade is sometimes called "locking". It feels like protection, but it only freezes the floating loss at its current size. Meanwhile:

- Each leg pays its own spread and, if held overnight, its own swap. The swap on one side rarely offsets the other, so the pair usually costs money every night.
- The loss still exists. At some point you must remove one leg, and then you are exposed again, often at a worse moment.
- Margin treatment for opposite positions depends on the account group, so do not assume a hedge frees up margin.

> **Risk warning:** Hedging does not eliminate risk or loss, and CFDs are leveraged. A plain stop loss is usually a cleaner and cheaper way to limit a losing trade than opening an opposite position.

## Which mode should you choose?

| Question | Netting | Hedging |
|---|---|---|
| Positions per symbol | One | Many |
| Opposite order | Reduces or reverses | Opens a new position |
| Average entry price | Yes | No, each has its own |
| Close By available | No | Yes |
| Easiest to read net exposure | Yes | Needs adding up |

Beginners often find netting easier because the panel shows one clear position per market. Hedging gives more flexibility but more ways to make mistakes. Whichever you pick, confirm the mode on your account in the Client Area before trading, since it cannot be seen from the chart.

## Common mistakes

- Selling on a hedging account to "close" a long and ending up with two positions.
- Buying more on a netting account and not noticing that the average entry, and your risk, changed.
- Treating a locked hedge as a solution rather than a delay.
- Forgetting that a larger opposite order on netting reverses the position instead of just closing it.
