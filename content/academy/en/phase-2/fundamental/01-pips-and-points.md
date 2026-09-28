---
slug: "p2-f-pips-and-points"
title: "Pips, points and pip value"
summary: "How price movement is measured on FX, metals and indices, and how to turn a move in pips into money."
order: 1
version: 1
takeaways:
  - "A pip is 0.0001 on most currency pairs and 0.01 on JPY pairs; the extra quoted digit is a fraction of a pip, not a full pip."
  - "Pip value in the quote currency is simply position size in units multiplied by the pip size."
  - "One standard lot of EURUSD is worth 10 USD per pip, but pip value is not 10 USD on every symbol or at every lot size."
  - "Metals, indices and crypto are usually measured in price points, so always check the contract specification before judging a move in money."
practice:
  label: "Open EURUSD and USDJPY side by side on your demo account, note how many decimals each quote has, and count the pips between today's high and low on each."
  symbol: "EURUSD"
quiz:
  - question: "EURUSD moves from 1.0850 to 1.0885. How many pips is that?"
    options:
      - "3.5 pips"
      - "35 pips"
      - "350 pips"
      - "0.35 pips"
    answer: 1
    explanation: "The difference is 0.0035, and one pip on EURUSD is 0.0001, so 0.0035 / 0.0001 = 35 pips. 350 would be the count in fractional pips (points)."
  - question: "USDJPY falls from 155.20 to 154.75. How many pips has it moved?"
    options:
      - "4.5 pips"
      - "450 pips"
      - "0.45 pips"
      - "45 pips"
    answer: 3
    explanation: "On JPY pairs a pip is 0.01. The move is 0.45, and 0.45 / 0.01 = 45 pips."
  - question: "What is the pip value of a 0.10 lot EURUSD position, in USD?"
    options:
      - "1 USD per pip"
      - "10 USD per pip"
      - "0.10 USD per pip"
      - "100 USD per pip"
    answer: 0
    explanation: "0.10 lot is 10,000 EUR. 10,000 x 0.0001 = 1 USD per pip. 10 USD per pip applies to a full standard lot."
  - question: "A EURUSD quote changes from 1.08503 to 1.08547. What is the move?"
    options:
      - "44 pips"
      - "0.44 pips"
      - "4.4 pips"
      - "440 pips"
    answer: 2
    explanation: "The difference is 0.00044. Dividing by the pip size of 0.0001 gives 4.4 pips; the fifth decimal is a tenth of a pip."
---

Every price you see in Kalks Trader changes in small steps. Before you can talk sensibly about profit, loss, stops or costs, you need a shared unit for measuring those steps. In currency trading that unit is the **pip**; on metals, indices and crypto traders usually talk in **points**. This chapter explains both and shows how to convert a move in pips into an amount of money.

## What a pip is

A pip ("percentage in point") is the conventional minimum meaningful move in a currency pair. For most pairs it is the fourth decimal place, **0.0001**. For pairs quoted against the Japanese yen, where the price is a much larger number, it is the second decimal place, **0.01**.

| Symbol | Example quote | One pip |
|---|---|---|
| EURUSD | 1.0850 | 0.0001 |
| GBPUSD | 1.2700 | 0.0001 |
| USDCAD | 1.3700 | 0.0001 |
| USDJPY | 155.20 | 0.01 |
| GBPJPY | 195.00 | 0.01 |

Modern platforms quote one more decimal than the pip: EURUSD appears as 1.08503 and USDJPY as 155.204. That last digit is a **fractional pip**, one tenth of a pip. Many platforms call this smallest step a *point*. It is useful for precision, but the pip remains the unit traders use for stops, targets and spreads, so do not confuse the two: 35 pips and 350 points describe the same move on EURUSD.

## Counting pips

Counting a move is just subtraction followed by division by the pip size.

```text
EURUSD  1.0850 -> 1.0885   difference 0.0035 / 0.0001 = 35 pips
USDJPY  155.20 -> 154.75   difference 0.45   / 0.01   = 45 pips
EURUSD  1.08503 -> 1.08547 difference 0.00044 / 0.0001 = 4.4 pips
```

The direction tells you whether that move helped or hurt you. If you bought EURUSD, a rise from 1.0850 to 1.0885 is 35 pips in your favour; if you sold, it is 35 pips against you.

## Points on metals, indices and crypto

Outside FX there is no universal pip. Gold (XAUUSD) is quoted to two decimals, for example 2,350.40, and traders normally describe moves in dollars: "gold is up 12 dollars" means the price rose by 12.00. Indices such as US30 or GER40 are quoted in index points, so US30 moving from 39,200 to 39,285 is an 85-point move. Crypto such as BTCUSD at 64,000 is usually described in dollars too.

Because conventions vary, the reliable approach is to open the contract specification for the symbol in Kalks Trader and check three things: the number of digits, the contract size and the tick (minimum price step). Everything else follows from those.

## Pip value: turning pips into money

A pip only matters because of the amount of money attached to it. The pip value, in the **quote currency** (the second currency of the pair), is:

```text
pip value (quote currency) = position size in units x pip size
```

For EURUSD the quote currency is USD, so the answer is already in dollars. One standard lot is 100,000 units (lots are covered in the next chapter):

```text
1.00 lot EURUSD: 100,000 x 0.0001 = 10.00 USD per pip
0.10 lot EURUSD:  10,000 x 0.0001 =  1.00 USD per pip
0.01 lot EURUSD:   1,000 x 0.0001 =  0.10 USD per pip
```

When USD is not the quote currency, the result comes out in another currency and must be converted to your account currency at the current rate:

```text
1.00 lot USDJPY: 100,000 x 0.01   = 1,000 JPY per pip
                 1,000 / 155.00    = 6.45 USD per pip  (USDJPY at 155.00)

1.00 lot USDCAD: 100,000 x 0.0001 = 10 CAD per pip
                 10 / 1.3700       = 7.30 USD per pip  (USDCAD at 1.3700)
```

This is why pip value on USDJPY or USDCAD changes slightly as the exchange rate moves, while EURUSD, GBPUSD and AUDUSD stay fixed at 10 USD per lot for a USD account.

> **Example:** Gold is quoted per troy ounce and one XAUUSD lot is 100 oz. A 1.00 move in price (2,350.40 to 2,351.40) is worth 100 x 1.00 = 100 USD per lot, and the smallest step of 0.01 is worth 1 USD per lot. On an index, on a 1-unit-per-point contract, one lot of US30 earns or loses 1 USD per index point; check the contract specification in Kalks Trader for the real size of each symbol.

## Why this matters

Pips let you describe a trade independently of its size. A plan such as "stop 25 pips below entry, target 50 pips above" works whether you trade 0.01 or 1.00 lot. Pip value then converts that plan into money, which is what you actually risk. A 25-pip stop on 0.10 lot EURUSD risks about 25 USD; the same stop on 1.00 lot risks about 250 USD. Same chart, very different consequence.

## Common mistakes

- Confusing points with pips. A 4-pip spread is 40 points, and typing 30 into a field measured in points gives a 3-pip stop, not a 30-pip one.
- Applying 0.0001 to JPY pairs. On USDJPY a move from 155.20 to 155.30 is 10 pips, not 1,000.
- Assuming every symbol is worth 10 USD per pip per lot. That only holds for pairs quoted in USD on a USD account.
- Judging a gold or index move by its size in points without checking what one point is worth on that contract.
