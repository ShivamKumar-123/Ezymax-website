---
slug: "p2-t-oco-and-partial-close"
title: "OCO orders and partial close"
summary: "Link two pending orders so that one cancels the other, and take profit on part of a position while letting the rest run."
order: 4
version: 1
takeaways:
  - "An OCO pair links two pending orders so that when one fills, the other is cancelled automatically."
  - "OCO is useful for trading a break of a range in either direction without ending up in both trades."
  - "A partial close realises profit or loss on part of a position, releases its margin and leaves the rest open with the same entry price."
  - "Partial closes must respect the 0.01 lot volume step, and every choice to bank profit early also reduces what the remaining position can earn."
practice:
  label: "On your demo account, find a quiet EURUSD range, place an OCO pair of a buy stop above it and a sell stop below it, each with a stop loss, and watch what happens when one side fills."
  symbol: "EURUSD"
quiz:
  - question: "An OCO pair contains a buy stop at 1.0880 and a sell stop at 1.0820. The buy stop fills. What happens to the sell stop?"
    options:
      - "It stays active"
      - "It becomes a sell limit"
      - "It is cancelled automatically"
      - "It fills at the same time"
    answer: 2
    explanation: "That is the definition of one-cancels-other: the fill of one order cancels its partner, so you do not end up holding both a long and a short."
  - question: "You hold 1.00 lot EURUSD bought at 1.0851 and close 0.40 lot at 1.0891. What profit is realised?"
    options:
      - "160 USD"
      - "400 USD"
      - "240 USD"
      - "16 USD"
    answer: 0
    explanation: "The move is 40 pips and 0.40 lot is 4 USD per pip, so 40 x 4 = 160 USD is realised. 0.60 lot stays open."
  - question: "After a partial close, what happens to the entry price of the remaining volume?"
    options:
      - "It is reset to the current price"
      - "It is averaged with the closing price"
      - "It becomes the stop loss level"
      - "It stays the same as the original entry"
    answer: 3
    explanation: "Only the closed part is settled. The remaining volume keeps its original entry price, SL and TP."
  - question: "You hold 0.10 lot and want to close one third. What can you actually close?"
    options:
      - "Exactly 0.0333 lot"
      - "0.03 or 0.04 lot"
      - "Only the full 0.10 lot"
      - "0.05 lot minimum"
    answer: 1
    explanation: "Volume moves in steps of 0.01 lot, so one third of 0.10 is not possible; the nearest valid sizes are 0.03 and 0.04."
---

Real trading plans rarely consist of a single entry and a single exit. You may want to trade a breakout without knowing which way it will go, or take some profit at a first target and hold the rest for a bigger move. Ezymex Trader supports two tools built for these situations: **OCO** (one-cancels-other) order pairs and **partial close**.

## OCO: one cancels the other

An OCO pair is two pending orders linked together. When either one is filled, the other is cancelled automatically. It solves a simple problem: if you place two independent pending orders and the market triggers both, you can end up with positions you never intended to hold at the same time.

Typical uses:

- **Range breakout in either direction.** A buy stop above the range and a sell stop below it. Whichever breaks first opens the trade, and the opposite order disappears.
- **Two ways into the same idea.** A buy limit at support in case of a pullback, and a buy stop above resistance in case the market runs without pulling back. You want one long, not two.

Note that the stop loss and take profit attached to a position already behave as a linked pair: once one closes the position, the other has nothing left to act on.

> **Example:** EURUSD has spent the Asian session between 1.0825 and 1.0875 and trades at 1.0850 / 1.0851. You place an OCO pair: buy stop 0.20 lot at 1.0880 with stop loss 1.0850, and sell stop 0.20 lot at 1.0820 with stop loss 1.0850. Each side risks 30 pips x 2.00 USD = 60 USD. If London pushes the ask to 1.0880, the long opens and the sell stop is cancelled, so your total risk stays 60 USD rather than 120 USD.

Remember that stop orders become market orders when triggered, so a breakout entry during a fast move can slip. Give each OCO order an expiry that matches the idea, for example Today for a session-based range.

## Partial close

A partial close closes only part of an open position. The closed part is settled: its profit or loss is realised into your balance and its share of the margin is released. The remaining volume stays open with the **same entry price, stop loss and take profit**.

```text
Long 1.00 lot EURUSD at 1.0851, stop 1.0821, target 1.0931
Bid reaches 1.0891 (+40 pips)

Partial close 0.50 lot at 1.0891
  Realised: 40 pips x 5.00 USD = +200.00 USD
  Remaining: 0.50 lot, entry still 1.0851
  Trader moves stop on the remaining 0.50 lot to 1.0851 (breakeven)

Scenario A: target 1.0931 is hit
  Remaining: 80 pips x 5.00 = +400.00 USD   Total +600.00 USD
Scenario B: price reverses to breakeven stop
  Remaining: 0.00 USD                       Total +200.00 USD
Holding the full 1.00 lot instead:
  A: 80 x 10 = +800.00 USD       B: 0.00 USD (stop moved to breakeven)
```

Both paths ignore costs for clarity. The comparison shows the real trade-off: partial closing reduces the swing between outcomes. It gives up part of the best case in exchange for banking something in the worse case. Neither is automatically right; what matters is deciding the rule before the trade, not during it.

## Partial close and position mode

How you reduce a position depends on your account's position mode, which is explained in the next chapter:

- **Netting:** there is only one position per symbol, so selling 0.50 lot against a 1.00 lot long reduces it to 0.50 lot.
- **Hedging:** a new sell order opens a separate short position instead. To reduce the existing long, use the partial close action on that position itself.

Mixing these up on a hedging account is a common way to accidentally end up holding both a long and a short.

> **Risk warning:** Moving a stop to breakeven does not make a trade risk-free. Gaps and slippage can fill the stop below entry, and CFDs are leveraged, so the remaining position can still lose money.

## Practical rules

- Partial volumes follow the 0.01 lot step, and what remains must be at least the minimum volume. Plan sizes that divide cleanly: 0.30 lot splits into 0.10 and 0.20, while 0.10 cannot be split into exact thirds.
- The smaller the position, the less room for partial exits. At 0.01 lot there is nothing to split.
- Each partial close is a separate deal in your trade history, visible in the Portfolio module in the Client Area.
- Commission, if charged, applies to each closed portion in proportion to its volume.

## Common mistakes

- Placing two unlinked pending orders around a range and ending up in both trades in a whipsaw.
- Closing half at every small profit out of nervousness, so losers run at full size and winners at half.
- Sending a sell order on a hedging account to "reduce" a long and opening a new short instead.
- Moving the stop to breakeven too early, so ordinary fluctuations close the rest of the trade.
