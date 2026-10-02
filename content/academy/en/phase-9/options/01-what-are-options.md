---
slug: "p9-o-what-are-options"
title: "What options are"
summary: "An option gives its buyer a right, not an obligation. How Kalks FX Options work, why traders use options and how they differ from the CFDs you already know."
order: 1
version: 1
takeaways:
  - "An option gives its buyer the right, but not the obligation, to a payoff based on a fixed strike price at expiry. The seller, or writer, takes on the matching obligation in exchange for the premium."
  - "Kalks FX Options are European style and cash-settled in USD: they are exercised automatically at expiry, an in-the-money option pays the difference and an out-of-the-money option expires worthless."
  - "A buyer pays the full premium upfront with no leverage, so the most a buyer can lose is the premium. A seller receives the premium but posts margin and can lose many times that amount."
  - "Traders use options for directional views with a known maximum loss, for hedging existing positions and for income, and each use has a very different risk profile."
  - "Options sit in the same trading account as your CFDs, and Kalks is the counterparty to every trade, quoting a bid and an ask for every strike."
practice:
  label: "Open EURUSD and XAUUSD on your demo account, note the current prices, and write down which strike would be at the money for each and what one option contract represents (10,000 euros and 1 ounce)."
  symbol: "EURUSD"
quiz:
  - question: "What does the buyer of an option receive in exchange for the premium?"
    options:
      - "An obligation to buy the underlying at the strike price"
      - "The right, but not the obligation, to the option's payoff at expiry"
      - "A CFD position with lower margin"
      - "A guarantee that the trade will be profitable"
    answer: 1
    explanation: "The buyer pays the premium for a right. If the option finishes in the money it pays out; if not, the buyer has lost only the premium. The obligation sits with the seller."
  - question: "Kalks FX Options are European style. What does that mean?"
    options:
      - "They can be exercised at any time before expiry"
      - "They can only be traded during European market hours"
      - "They are exercised only at expiry, automatically, based on the settlement price"
      - "They are settled by delivering euros to your account"
    answer: 2
    explanation: "European options cannot be exercised early. At the cut, every option is settled automatically against the settlement price, in USD cash. You can still close the position before expiry by trading it."
  - question: "You buy one EURUSD call for 24 USD. What is the most you can lose on this position?"
    options:
      - "24 USD"
      - "240 USD"
      - "The full value of 10,000 euros"
      - "There is no limit"
    answer: 0
    explanation: "A buyer pays the full premium upfront and has no further obligation, so the maximum loss is the 24 USD premium. Unlimited losses belong to sellers of calls, not buyers."
  - question: "A EURUSD option you hold finishes in the money at expiry. What happens?"
    options:
      - "You receive 10,000 euros in your account"
      - "A CFD position is opened for you at the strike price"
      - "Nothing, unless you exercise it manually before the cut"
      - "It is exercised automatically and the difference is paid to your account in USD"
    answer: 3
    explanation: "Kalks options are cash-settled. An in-the-money option pays the difference between the settlement price and the strike, multiplied by the contract size, in USD. There is no delivery and no manual exercise."
---

Up to now this course has been about CFDs, where profit and loss move in a straight line with the price. Options work differently. With an option you pay a price today, the **premium**, for a payoff that depends on where the market settles on a future date. Kalks FX Options lets you trade options on currencies, metals and oil from the same account you use for CFDs. This chapter explains what you are actually buying or selling.

## A right, not an obligation

An option is a contract between a buyer and a seller.

- The **buyer** (or holder) pays the premium and receives a **right**. If the market finishes on the right side of an agreed price, the buyer is paid. If not, the option simply expires and the buyer has lost only the premium.
- The **seller** (or **writer**) receives the premium and takes on an **obligation**. If the option finishes in the buyer's favour, the seller must pay. The seller's gain is capped at the premium; the loss is not.

The agreed price is the **strike**, and the date is the **expiry**. There are two basic types. A **call** pays when the price finishes above the strike, and a **put** pays when it finishes below. The next chapter covers both in detail.

## European style and cash settlement

Kalks FX Options are **European style**. They cannot be exercised early: the only moment that decides the payoff is expiry. You do not have to do anything at expiry, because exercise is automatic.

They are also **cash-settled in USD**. Nobody receives euros, gold bars or barrels of oil. At expiry:

- an option that is **in the money** pays the difference between the settlement price and the strike, multiplied by the contract size, in USD;
- an option that is **out of the money** expires worthless.

The **settlement price** is not the last tick. It is the time-weighted average (TWAP) of the mid price over the last 30 minutes before the **cut**, which is 10:00 New York time by default. Averaging over half an hour makes the settlement much harder to distort with one sharp spike.

> **Example:** You hold one EURUSD call with a strike of 1.1700. The average mid price from 09:30 to 10:00 New York time on expiry day is 1.1760. The option is in the money by 0.0060, and one contract is 10,000 euros, so 0.0060 x 10,000 = 60 USD is credited to your account automatically.

## Why traders use options

| Use | What you do | Why |
|---|---|---|
| Directional view with a known maximum loss | Buy a call or a put | The most you can lose is the premium, fixed before you trade, and no gap can skip past it |
| Hedging | Buy a put against a long CFD, or a call against a short CFD | Puts a floor or a ceiling under an existing position for a known cost |
| Income | Sell options and collect the premium | Earns the premium if the market stays away from the strike, but with large potential losses |

The first two uses buy protection or opportunity for a fixed price. The third sells it, which is a very different business. The last chapter of this course is dedicated to the risks of selling.

## How options differ from CFDs

| | CFD | Bought option |
|---|---|---|
| Profit and loss | Moves one-for-one with the price | Nothing below the strike (for a call), then rises with the price |
| Cost to open | Margin, a fraction of the position value | The full premium, paid upfront |
| Leverage | Yes | No: you pay the full price of what you buy |
| Maximum loss | Can exceed your planned stop, especially through gaps | The premium paid |
| Time | No expiry | Loses value as expiry approaches |
| Direction | Long or short the same instrument | Calls for rises, puts for falls |

A sold option behaves differently again: the seller posts margin and can face losses many times the premium received.

## What you can trade

Kalks FX Options covers 13 underlyings, each with a fixed contract size.

| Underlying | Symbols | One contract |
|---|---|---|
| FX pairs | EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD, EURJPY, GBPJPY | 10,000 units of the base currency |
| Gold | XAUUSD | 1 troy ounce |
| Silver | XAGUSD | 50 troy ounces |
| Crude oil | USOIL (WTI), UKOIL (Brent) | 10 barrels |

Premiums are always shown in USD per contract. The options are priced with standard models: Garman-Kohlhagen for currency pairs, Black-Scholes for gold and silver, and Black-76 for oil. You do not need the formulas, but the next chapters explain what drives the price.

## Who is on the other side

There is no exchange order book. **Kalks is the counterparty** to every option trade and quotes a bid and an ask for every listed strike. You buy at the ask, and you can close before expiry by selling at the bid, in full or in part. Options positions live in the **same trading account** as your CFDs and share its margin, so a losing options position reduces the margin available to your CFD trades, and the other way round. Whether options are available on a given account depends on your broker's settings.

> **Risk warning:** Buying options can lose 100% of the premium, and this happens often: many options expire worthless. Selling options can lose much more than the premium received. Learn the mechanics on a demo account before trading options with real money.

## Common mistakes

- **Thinking an option is a cheap CFD.** A bought option needs the move to happen before expiry and to be large enough to cover the premium.
- **Expecting delivery.** Settlement is cash in USD only.
- **Assuming you must act at expiry.** Exercise is automatic; your only decision is whether to hold until then or close earlier at the bid.
