---
slug: "p2-f-profit-and-loss-maths"
title: "Profit and loss maths and currency conversion"
summary: "Calculate the result of any trade by hand, convert it into your account currency, and include commission and swaps to get the true net figure."
order: 6
version: 1
takeaways:
  - "Gross P&L is price change x units: close minus open for a long, open minus close for a short."
  - "The result is in the quote currency and must be converted to your account currency at the current rate."
  - "Net P&L equals gross P&L minus commission plus or minus swaps, and it is the only figure that reaches your balance."
  - "Floating P&L changes equity every tick, but only a closed position changes your balance."
quiz:
  - question: "You buy 0.20 lot EURUSD at 1.0851 and close at 1.0816. What is the gross result?"
    options:
      - "-70 USD"
      - "-35 USD"
      - "-700 USD"
      - "+70 USD"
    answer: 0
    explanation: "The price fell 0.0035, or 35 pips. 0.20 lot is worth 2 USD per pip, so the loss is 35 x 2 = 70 USD. Check: 20,000 x -0.0035 = -70 USD."
  - question: "You sell 1.00 lot USDCAD at 1.3720 and buy it back at 1.3680. What is the profit in USD?"
    options:
      - "400.00 USD"
      - "548.80 USD"
      - "292.40 USD"
      - "40.00 USD"
    answer: 2
    explanation: "Gross is 0.0040 x 100,000 = 400 CAD, because CAD is the quote currency. Converted at 1.3680: 400 / 1.3680 = 292.40 USD."
  - question: "A short XAUUSD position of 0.10 lot is opened at 2,350.40 and closed at 2,362.90. What is the result?"
    options:
      - "+125 USD"
      - "-12.50 USD"
      - "-1,250 USD"
      - "-125 USD"
    answer: 3
    explanation: "Gold rose 12.50 against a short. 0.10 lot is 10 oz, so the loss is 12.50 x 10 = 125 USD."
  - question: "Gross profit is 126 USD, commission is 2.10 USD and swaps total -4.32 USD. What is the net profit?"
    options:
      - "132.42 USD"
      - "119.58 USD"
      - "123.90 USD"
      - "121.68 USD"
    answer: 1
    explanation: "Net = 126 - 2.10 - 4.32 = 119.58 USD. Adding the costs instead of subtracting them gives the wrong 132.42."
---

The platform calculates your profit and loss for you, so why learn to do it by hand? Because you need the number **before** you trade, to decide on size and stop placement, and because understanding the calculation is the only way to notice when something looks wrong. The arithmetic is simple once you see its three steps: price change times size, convert the currency, subtract costs.

## Step 1: price change times size

For any CFD the gross result, in the currency the symbol is priced in, is:

```text
long:  (close price - open price) x units
short: (open price - close price) x units
units = contract size x lots
```

Remember which side of the quote you use. A long opens at the ask and closes at the bid; a short opens at the bid and closes at the ask. The prices below are the actual fill prices.

```text
Long 0.30 lot EURUSD, open 1.0851, close 1.0893
  (1.0893 - 1.0851) x 30,000 = 0.0042 x 30,000 = +126.00 USD
  (same as 42 pips x 3.00 USD per pip)

Long 0.20 lot XAUUSD, open 2,350.60, close 2,338.10
  (2,338.10 - 2,350.60) x 20 oz = -12.50 x 20 = -250.00 USD

Long 2 lots US30 on a 1-unit-per-point contract, open 39,200, close 39,285
  (39,285 - 39,200) x 2 = +170.00 USD
```

## Step 2: convert into your account currency

The result of step 1 is in the **quote currency**, the second currency of the pair. If that is your account currency, you are done. If not, convert it at the current rate.

When USD is the base currency, as in USDJPY or USDCAD, divide by the pair's own closing rate:

```text
Short 0.50 lot USDJPY, open 155.20, close 154.60
  (155.20 - 154.60) x 50,000 = 0.60 x 50,000 = 30,000 JPY
  30,000 / 154.60 = +194.05 USD

Short 1.00 lot USDCAD, open 1.3720, close 1.3680
  (1.3720 - 1.3680) x 100,000 = 400 CAD
  400 / 1.3680 = +292.40 USD
```

For a cross pair such as GBPJPY, neither currency is USD. The result is in yen and is converted using the USDJPY rate:

```text
Long 0.10 lot GBPJPY, open 195.00, close 196.20
  (196.20 - 195.00) x 10,000 = 1.20 x 10,000 = 12,000 JPY
  USDJPY at 155.00: 12,000 / 155.00 = +77.42 USD
```

If your account is in a currency other than USD, the same logic applies with one more conversion. A 126 USD profit on a EUR account, with EURUSD at 1.0893, is 126 / 1.0893 = 115.67 EUR. Kalks Trader performs these conversions automatically at current rates, which is also why the value of an open JPY or CAD position drifts slightly even when the pair itself is still.

## Step 3: subtract costs to get net P&L

The spread is already inside the fill prices, but commission and swaps are separate items. The net result is what actually reaches your balance.

| Item | Long 0.30 lot EURUSD, held 2 nights |
|---|---|
| Gross P&L | +126.00 USD |
| Commission (7 USD per lot round turn x 0.30) | -2.10 USD |
| Swap (-7.20 USD per lot per night x 0.30 x 2 nights) | -4.32 USD |
| Net P&L | +119.58 USD |

In Client Area, Portfolio shows your trade history and statements with these components listed separately, which makes it easy to see how much of your result went on costs over a month.

## Floating versus realised

While a position is open its result is **floating**. It changes equity with every tick and feeds into margin level, but your balance is untouched. When you close the position, the result is **realised**: it is added to or subtracted from the balance, and the margin is released. A partial close realises the result on the closed part only.

This distinction matters psychologically too. A floating profit is not money you have yet; it can reverse in minutes. Conversely, a floating loss is not avoided by refusing to close; it is already reflected in your equity.

> **Example:** Before entering, a trader plans a long 0.50 lot EURUSD at 1.0851 with a stop at 1.0821 and a target at 1.0911. Risk: 30 pips x 5 USD = 150 USD. Reward: 60 pips x 5 USD = 300 USD. Both figures are known before the order is placed, which is exactly the point of doing the maths in advance.

## Common mistakes

- Using the wrong direction for a short. For a short, a falling price is profit: open minus close.
- Forgetting conversion on JPY and CAD pairs and reporting 30,000 "dollars" instead of 194.05 USD.
- Leaving out swaps on trades held for weeks, where they can become a large part of the result.
- Measuring success by floating profit at the high of the move rather than by net realised P&L.
