---
slug: "p9-o-calls-and-puts"
title: "Calls and puts"
summary: "The four basic option positions, what in, at and out of the money mean, and worked examples on EURUSD and gold in USD per contract."
order: 2
version: 1
takeaways:
  - "A call pays the amount by which the settlement price is above the strike; a put pays the amount by which it is below. Both are multiplied by the contract size."
  - "There are four basic positions: long call (bullish), long put (bearish), short call (not bullish) and short put (not bearish). Long positions pay the premium; short positions receive it."
  - "In the money means the option would pay something if it expired now, at the money means the strike is at or very near the current price, and out of the money means it would pay nothing."
  - "The payout at expiry is not the profit: subtract the premium paid, or add the premium received, to get the result."
practice:
  label: "On your demo account, note the current XAUUSD price and list the strikes 50 USD apart from 100 below it to 100 above it. Mark each call and each put as in, at or out of the money."
  symbol: "XAUUSD"
quiz:
  - question: "You expect EURUSD to rise and want your maximum loss fixed in advance. Which position fits?"
    options:
      - "Short call"
      - "Long call"
      - "Short put"
      - "Long put"
    answer: 1
    explanation: "A long call profits from a rise and its maximum loss is the premium paid. A short put also benefits if the price holds up, but its loss is not limited to the premium."
  - question: "EURUSD trades at 1.1650. How would you describe a 1.1600 put?"
    options:
      - "In the money"
      - "At the money"
      - "Out of the money"
      - "Knocked out"
    answer: 2
    explanation: "A put pays when the price settles below the strike. With EURUSD at 1.1650, above 1.1600, the put would pay nothing now, so it is out of the money. The 1.1600 call is in the money."
  - question: "You bought one XAUUSD 3,850 put. Gold settles at 3,780. What is the payout before subtracting the premium?"
    options:
      - "70 USD"
      - "7,000 USD"
      - "0 USD"
      - "3,780 USD"
    answer: 0
    explanation: "The put pays (3,850 - 3,780) x 1 ounce = 70 USD per contract. Whether the trade made money depends on the premium you paid."
  - question: "You sold one EURUSD 1.1700 call for 24 USD. EURUSD settles at 1.1760. What is your result?"
    options:
      - "+24 USD"
      - "-60 USD"
      - "-36 USD"
      - "+36 USD"
    answer: 2
    explanation: "As the seller you must pay (1.1760 - 1.1700) x 10,000 = 60 USD. You kept the 24 USD premium, so the result is 24 - 60 = -36 USD."
---

The previous chapter introduced options as rights that are bought and sold for a premium. Every option on Ezymex is either a **call** or a **put**, and you can either buy it or sell it. That gives four basic positions, and every strategy later in this course is built from them.

## Calls: a right to the upside

A **call** gives its buyer the difference when the market settles **above** the strike. At expiry:

```text
Call payout = max(settlement price - strike, 0) x contract size
```

If the settlement is at or below the strike, the call pays nothing. Calls are bought by traders who expect the price to rise.

## Puts: a right to the downside

A **put** gives its buyer the difference when the market settles **below** the strike:

```text
Put payout = max(strike - settlement price, 0) x contract size
```

Puts are bought by traders who expect the price to fall, or who want to protect a long position against a fall.

## The four basic positions

| Position | You | View | Best case | Worst case |
|---|---|---|---|---|
| Long call | Pay the premium | Price rises | Unlimited gain | Lose the premium |
| Long put | Pay the premium | Price falls | Gain up to the strike minus the premium | Lose the premium |
| Short call | Receive the premium | Price stays at or below the strike | Keep the premium | Unlimited loss |
| Short put | Receive the premium | Price stays at or above the strike | Keep the premium | Loss up to the strike minus the premium |

Note the asymmetry. Buyers know their maximum loss from the start. Sellers know their maximum gain, but not their maximum loss.

Buying a put and selling a call are both bearish, but they are not the same trade. The long put risks only its premium. The short call risks an unlimited amount for a limited premium.

## In, at and out of the money

**Moneyness** describes where the strike sits compared with the current price. With EURUSD at 1.1650:

| Strike | Call | Put |
|---|---|---|
| 1.1600 | In the money by 0.0050 | Out of the money |
| 1.1650 | At the money | At the money |
| 1.1700 | Out of the money | In the money by 0.0050 |

An **in-the-money** (ITM) option would pay something if it expired right now. An **out-of-the-money** (OTM) option would pay nothing. **At the money** (ATM) means the strike is at, or as close as possible to, the current price. Moneyness changes every time the price moves, and only the settlement price at expiry decides the final payout.

## Worked example: a EURUSD call

EURUSD is at 1.1650 and you think it will rise over the next week. You buy one EURUSD call with a 1.1700 strike, expiring next Friday, at an ask of 0.0024. One contract is 10,000 euros, so the premium is 0.0024 x 10,000 = 24 USD, paid in full from your account.

```text
Settlement 1.1780:  payout (1.1780 - 1.1700) x 10,000 = 80 USD   result 80 - 24 = +56 USD
Settlement 1.1720:  payout (1.1720 - 1.1700) x 10,000 = 20 USD   result 20 - 24 =  -4 USD
Settlement 1.1690:  payout 0                                     result          -24 USD
```

Look at the middle line. The option finished in the money and paid 20 USD, yet the trade still lost money because the payout did not cover the premium.

## Worked example: a gold put

XAUUSD is at 3,900 and you want to profit from a fall over the next month without the risk of a short CFD being stopped out by a spike. You buy one one-month XAUUSD 3,850 put for 54 USD. One contract is 1 ounce, so each 1.00 USD that gold settles below the strike is worth 1 USD.

```text
Settlement 3,760:  payout (3,850 - 3,760) x 1 = 90 USD   result 90 - 54 = +36 USD
Settlement 3,820:  payout (3,850 - 3,820) x 1 = 30 USD   result 30 - 54 = -24 USD
Settlement 3,900:  payout 0                              result          -54 USD
```

## The seller's side

Every option has a seller. Suppose you had **sold** the EURUSD 1.1700 call for 24 USD instead, ignoring the bid/ask spread. The results are exactly reversed: +24 USD if EURUSD settles at or below 1.1700, +4 USD at 1.1720 and -56 USD at 1.1780. If EURUSD settled at 1.1900, the seller would pay 200 USD against the 24 USD received. Selling options looks easy because it usually wins small amounts; the occasional large loss is the price of that.

> **Risk warning:** Most out-of-the-money options expire worthless, so buyers often lose the whole premium. Sellers collect premiums most of the time but can suffer losses many times larger than what they received.

## Common mistakes

- **Treating in the money as profitable.** The payout must exceed the premium before the trade makes money.
- **Buying far out-of-the-money options because they are cheap.** They are cheap because they usually expire worthless.
- **Confusing a long put with a short call.** Both gain from a fall, but their risks are completely different.
