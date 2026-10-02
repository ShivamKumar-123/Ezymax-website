---
slug: "p9-o-strategies"
title: "Option strategies"
summary: "Protective puts and covered calls with a CFD position, vertical spreads, straddles, strangles, iron condors and butterflies: when each fits, and its maximum profit, maximum loss and breakevens."
order: 6
version: 1
takeaways:
  - "A protective put sets a floor under a long CFD position for a known cost; a covered call earns premium on a long position in exchange for capping its upside."
  - "Vertical spreads such as the bull call spread and the bear put spread cut the cost of a directional view by selling a further strike, which also caps the profit. The maximum loss is the net premium paid."
  - "Long straddles and strangles profit from a large move in either direction. Selling them profits from a quiet market but carries large or unlimited risk."
  - "Iron condors and butterflies are ways to trade a range with a maximum loss that is known in advance."
  - "Multi-leg orders fill all-or-nothing, but every leg pays its own spread, and closing one leg on its own can leave a much riskier position."
practice:
  label: "Note the current EURUSD price on your demo account. Using the premiums in this chapter as estimates, write down the legs, net premium, maximum profit, maximum loss and breakevens of a bull call spread and an iron condor centred on that price."
  symbol: "EURUSD"
quiz:
  - question: "You buy a EURUSD 1.1650 call for 0.0102 and sell a 1.1750 call for 0.0056, same expiry. What is the maximum profit per contract at expiry?"
    options:
      - "46 USD"
      - "54 USD"
      - "100 USD"
      - "Unlimited"
    answer: 1
    explanation: "The spread costs 0.0102 - 0.0056 = 0.0046, or 46 USD. Its payout is capped at the 0.0100 distance between strikes, 100 USD, so the maximum profit is 100 - 46 = 54 USD."
  - question: "A long EURUSD 1.1650 straddle costs 87 USD in total. What are its breakevens at expiry?"
    options:
      - "1.1563 and 1.1737"
      - "1.1607 and 1.1693"
      - "1.1650 only"
      - "1.1563 and 1.1650"
    answer: 0
    explanation: "The straddle needs a move larger than its total cost of 0.0087 in either direction: 1.1650 - 0.0087 = 1.1563 and 1.1650 + 0.0087 = 1.1737."
  - question: "An iron condor is opened for a net credit of 20 USD, with its bought strikes 0.0050 beyond its sold strikes on each side. What is the maximum loss per contract?"
    options:
      - "20 USD"
      - "50 USD"
      - "70 USD"
      - "30 USD"
    answer: 3
    explanation: "On either side the most the sold option can lose beyond the bought one is the 50-pip width, 50 USD. The 20 USD credit offsets part of that, so the maximum loss is 50 - 20 = 30 USD."
  - question: "What does it mean that a multi-leg order fills all-or-nothing?"
    options:
      - "Every leg is filled together at the quoted prices, or no leg is filled"
      - "The order stays open until expiry"
      - "Legs are filled one at a time as prices allow"
      - "Only the cheapest leg is filled"
    answer: 0
    explanation: "All legs execute together or none do, so you never end up holding only part of a spread. Closing legs one by one later is a separate decision with its own risks."
---

Single options are building blocks. Combining them, or combining an option with a CFD position, lets you shape exactly how a trade makes and loses money. This chapter covers the most common combinations. All figures are per contract at expiry, with options bought at the ask and sold at the bid, and ignore commission. The premiums assume implied volatility of 6.6% for one-week and 7% for one-month EURUSD options, and 18% for one-month gold options.

## Options with a CFD position

**Protective put.** You are long 0.10 lot of EURUSD as a CFD, 10,000 euros, from 1.1650, and you worry about a sharp fall. You buy one one-month 1.1600 put for 65 USD. However far EURUSD falls, the put pays everything below 1.1600. If you close the CFD at the settlement price, your worst case is the 50 USD loss on the CFD down to 1.1600 plus the 65 USD premium: 115 USD. Unlike a stop loss, this floor cannot be skipped by a weekend gap. The upside stays open, reduced by the premium.

**Covered call.** You are long 0.01 lot of XAUUSD, 1 ounce, from 3,900, and expect a slow month. You sell one one-month 4,000 call for 43 USD. If gold settles at or above 4,000, your total gain is capped at 100 + 43 = 143 USD. If gold falls, the premium cushions the loss by 43 USD, moving your breakeven to 3,857. The short call still needs margin, because if you closed the CFD, the call would be uncovered.

## Vertical spreads

A vertical spread buys one option and sells another of the same type and expiry at a different strike. The sold option lowers the cost and caps the profit.

**Bull call spread**, for a moderate rise. EURUSD at 1.1650, one month: buy the 1.1650 call at 0.0102, sell the 1.1750 call at 0.0056.

```text
Net cost (maximum loss) = 0.0102 - 0.0056 = 0.0046 = 46 USD
Maximum profit          = (1.1750 - 1.1650) x 10,000 - 46 = 54 USD, at 1.1750 or above
Breakeven               = 1.1650 + 0.0046 = 1.1696
```

**Bear put spread**, for a moderate fall. XAUUSD at 3,900, one month: buy the 3,900 put at 76 USD, sell the 3,800 put at 35 USD. The net cost of 41 USD is the maximum loss. The maximum profit is 100 - 41 = 59 USD, at 3,800 or below. Breakeven is 3,900 - 41 = 3,859.

## Straddles and strangles

These positions trade the size of a move, not its direction.

**Long straddle.** Buy a call and a put at the same strike. EURUSD at 1.1650, one week: the 1.1650 call at 45 USD plus the 1.1650 put at 42 USD costs 87 USD. The breakevens are 1.1650 - 0.0087 = 1.1563 and 1.1650 + 0.0087 = 1.1737. The maximum loss, 87 USD, happens if EURUSD settles exactly at 1.1650.

**Long strangle.** Buy an out-of-the-money call and an out-of-the-money put. The 1.1700 call at 24 USD plus the 1.1600 put at 22 USD costs 46 USD. The breakevens are 1.1746 and 1.1554. It is cheaper than the straddle, but it needs a bigger move.

Selling a straddle or strangle reverses these results. The seller keeps the premium if the market stays quiet, and faces unlimited loss on the upside and a large loss on the downside.

## Iron condor and butterfly

**Iron condor**, for a range with a capped loss. All one-week: sell the 1.1600 put at 20 USD and the 1.1700 call at 22 USD; buy the 1.1550 put at 10 USD and the 1.1750 call at 12 USD.

```text
Net credit (maximum profit) = 20 + 22 - 10 - 12 = 20 USD, between 1.1600 and 1.1700
Maximum loss                = 50 - 20 = 30 USD, at or below 1.1550 or at or above 1.1750
Breakevens                  = 1.1600 - 0.0020 = 1.1580 and 1.1700 + 0.0020 = 1.1720
```

**Butterfly**, for a price that finishes near one level. All one-week: buy the 1.1600 call at 75 USD, sell two 1.1650 calls at 43 USD each, buy the 1.1700 call at 24 USD. The net cost is 75 + 24 - 86 = 13 USD, which is the maximum loss. The maximum profit is 50 - 13 = 37 USD if EURUSD settles exactly at 1.1650. The breakevens are 1.1613 and 1.1687.

## Which strategy fits

| View | Strategy | Maximum loss |
|---|---|---|
| Strong rise | Long call | Premium |
| Moderate rise | Bull call spread | Net premium |
| Moderate fall | Bear put spread | Net premium |
| Protect a long CFD | Protective put | Premium plus distance to the strike |
| Slow market, holding the underlying | Covered call | CFD downside, less the premium |
| Big move, direction unknown | Long straddle or strangle | Premium |
| Range | Iron condor or butterfly | Width minus credit, or net premium |

## Placing multi-leg orders

A strategy can be sent as one multi-leg order. It fills **all-or-nothing**: either every leg is filled together at the quoted prices, or none is, so you never end up holding only half of a spread. Every leg still pays its own bid/ask spread, so a four-leg iron condor costs more to trade than a single option.

You can close the whole strategy at once or close legs separately. Be careful with the second route. Closing the bought leg of a spread or condor leaves a **naked short option**, with large or unlimited risk and a higher margin requirement.

> **Risk warning:** Strategies with a capped loss limit losses at expiry, but their short legs still need margin and can be left uncovered if you close the bought legs first. Short straddles and strangles can lose many times the premium received.

## Common mistakes

- **Comparing strategies by cost alone.** A cheaper strategy usually needs a bigger or more precise move.
- **Forgetting the spread on every leg.** Four legs mean four bid/ask spreads.
- **Legging out carelessly.** Closing the protective leg first can turn a defined-risk trade into an open-ended one.
