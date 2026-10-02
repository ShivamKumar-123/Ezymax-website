---
slug: "p9-o-payoff-and-breakeven"
title: "Payoff and breakeven"
summary: "Payoff tables for the four basic positions, how to find the breakeven and the maximum gain and loss, and how the result changes if you close before expiry."
order: 4
version: 1
takeaways:
  - "Result at expiry = payout minus premium for a buyer, and premium minus payout for a seller, multiplied by the number of contracts."
  - "Breakeven for a call is the strike plus the premium per unit; for a put it is the strike minus the premium per unit."
  - "Long calls and long puts can lose only the premium. Short calls have unlimited loss, and short puts can lose up to the strike minus the premium."
  - "Before expiry an option still has time value, so closing early gives a different result from the expiry payoff. Bought options close at the bid and sold options at the ask."
practice:
  label: "Take the current EURUSD price on your demo account, pick the strike 50 pips above it and assume a call premium of 25 pips. Build a payoff table for settlements from 100 pips below to 200 pips above the strike, and mark the breakeven."
  symbol: "EURUSD"
quiz:
  - question: "You buy a EURUSD 1.1650 put for 0.0040. What is the breakeven at expiry?"
    options:
      - "1.1690"
      - "1.1610"
      - "1.1650"
      - "1.1250"
    answer: 1
    explanation: "A put breaks even at the strike minus the premium: 1.1650 - 0.0040 = 1.1610. Below that level the payout exceeds the 40 USD paid."
  - question: "You sell one XAUUSD 3,900 put for 70 USD. What is your maximum possible loss per contract?"
    options:
      - "70 USD"
      - "3,900 USD"
      - "3,830 USD"
      - "Unlimited"
    answer: 2
    explanation: "If gold fell to zero you would pay 3,900 x 1 ounce = 3,900 USD and keep the 70 USD premium, a loss of 3,830 USD. It is a theoretical extreme, but it shows how large short-put risk is."
  - question: "You buy 3 EURUSD 1.1700 calls at 24 USD each. EURUSD settles at 1.1760. What is the total result?"
    options:
      - "+108 USD"
      - "+36 USD"
      - "+180 USD"
      - "-72 USD"
    answer: 0
    explanation: "Each call pays (1.1760 - 1.1700) x 10,000 = 60 USD, a result of 60 - 24 = +36 USD per contract. Three contracts make +108 USD."
  - question: "Which basic position has an unlimited potential loss?"
    options:
      - "Long call"
      - "Long put"
      - "Short put"
      - "Short call"
    answer: 3
    explanation: "A short call must pay the amount by which the price settles above the strike, and there is no ceiling on how high a price can go. A short put's loss is large but capped at the strike minus the premium."
---

Before trading any option you should be able to answer three questions. At what price do I start making money? What is the most I can make? What is the most I can lose? This chapter answers them for each of the four basic positions. All examples are per contract and ignore commission.

## Payout, result and breakeven

The **payout** is what the option pays at expiry. The **result** is the payout after the premium:

```text
Long option result  = (payout - premium paid) x contracts
Short option result = (premium received - payout) x contracts
```

The **breakeven** is the settlement price at which the result is exactly zero:

```text
Call breakeven = strike + premium per unit
Put breakeven  = strike - premium per unit
```

The buyer and the seller of the same option share the same breakeven: one side's gain is the other side's loss.

## Long call: EURUSD

You buy one EURUSD 1.1700 call for 0.0024, or 24 USD. Breakeven = 1.1700 + 0.0024 = 1.1724.

| Settlement | Payout | Result |
|---|---|---|
| 1.1600 | 0 | -24 USD |
| 1.1700 | 0 | -24 USD |
| 1.1724 | 24 USD | 0 |
| 1.1750 | 50 USD | +26 USD |
| 1.1800 | 100 USD | +76 USD |
| 1.1900 | 200 USD | +176 USD |

Maximum loss is the 24 USD premium. Maximum gain has no fixed limit: every 0.0001 above 1.1724 adds 1 USD.

```svg
<svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <text x="320" y="20" text-anchor="middle" font-size="14">Long EURUSD 1.1700 call bought at 24 USD: result at expiry per contract</text>
    <line x1="60" y1="30" x2="60" y2="280" stroke="#3a3a44" stroke-width="1"/>
    <line x1="60" y1="224" x2="590" y2="224" stroke="#3a3a44" stroke-width="1"/>
    <text x="8" y="66">+176</text>
    <text x="8" y="228">0</text>
    <text x="8" y="250">-24</text>
    <line x1="233" y1="224" x2="233" y2="290" stroke="#3a3a44" stroke-dasharray="4 3"/>
    <line x1="275" y1="200" x2="275" y2="290" stroke="#ff5a1f" stroke-dasharray="4 3"/>
    <polyline points="60,246 233,246 580,62" fill="none" stroke="#22c55e" stroke-width="2.5"/>
    <circle cx="275" cy="224" r="4" fill="#ff5a1f"/>
    <text x="282" y="244">Breakeven 1.1724</text>
    <text x="66" y="268">Max loss: 24 USD premium</text>
    <text x="430" y="200">Gain rises 1 USD per pip</text>
    <text x="60" y="304" text-anchor="middle">1.1600</text>
    <text x="233" y="304" text-anchor="middle">Strike 1.1700</text>
    <text x="420" y="304" text-anchor="middle">Settlement price at expiry</text>
    <text x="580" y="304" text-anchor="middle">1.1900</text>
  </g>
</svg>
```

## Long put: XAUUSD

You buy one XAUUSD 3,850 put for 54 USD. Breakeven = 3,850 - 54 = 3,796.

| Settlement | Payout | Result |
|---|---|---|
| 3,950 | 0 | -54 USD |
| 3,850 | 0 | -54 USD |
| 3,796 | 54 USD | 0 |
| 3,750 | 100 USD | +46 USD |
| 3,650 | 200 USD | +146 USD |

Maximum loss is 54 USD. Maximum gain is large but finite: 3,796 USD, reached only if gold fell to zero.

## Short call and short put

The seller's table is the buyer's table with the signs reversed.

- **Short EURUSD 1.1700 call at 24 USD:** keeps 24 USD at or below 1.1700, breaks even at 1.1724, and loses 76 USD at 1.1800 and 176 USD at 1.1900. There is no limit to how far EURUSD can rise, so there is no limit to the loss.
- **Short XAUUSD 3,850 put at 54 USD:** keeps 54 USD at or above 3,850, breaks even at 3,796 and loses 146 USD at 3,650. The theoretical maximum loss is 3,850 - 54 = 3,796 USD per contract.

## Summary of the four positions

| Position | Maximum gain | Maximum loss | Breakeven |
|---|---|---|---|
| Long call | Unlimited | Premium | Strike + premium |
| Long put | Strike - premium | Premium | Strike - premium |
| Short call | Premium | Unlimited | Strike + premium |
| Short put | Premium | Strike - premium | Strike - premium |

Multiply every figure by the contract size to convert it to USD, and by the number of contracts you trade.

> **Example:** You buy 5 of the EURUSD 1.1700 calls at 24 USD, 120 USD in total. EURUSD settles at 1.1750. Each contract pays 50 USD, a result of +26 USD per contract, or +130 USD in total. Had it settled at 1.1710, each would pay 10 USD and you would lose 14 x 5 = 70 USD.

## Closing before expiry

You do not have to wait for the cut. You can sell a bought option at the bid, or buy back a sold option at the ask, while the market is open, for all or part of the position. Before expiry the option still has time value, so its price is usually above the expiry payout.

> **Example:** Two days after you bought the 1.1700 call for 24 USD, EURUSD has risen to 1.1720. The option's bid is now 0.0047: 0.0020 of intrinsic value plus time value. You sell for 47 USD and make +23 USD, almost doubling the premium. If you had held to expiry and EURUSD had settled at 1.1720, the payout would have been 20 USD and the result -4 USD.

Taking profits early is often sensible for buyers, because time decay speeds up in the final days.

> **Risk warning:** Payoff tables show expiry only. Before expiry, losses on short options are driven by spot, volatility and time together, and margin requirements can rise sharply long before the expiry loss is reached.

## Common mistakes

- **Forgetting to multiply.** Prices are per unit; results depend on the contract size and the number of contracts.
- **Using the wrong side of the quote.** Bought options close at the bid, sold options at the ask.
- **Treating the maximum loss of a short put as small.** It is the strike minus the premium, which is almost the whole value of the contract.
