---
slug: "p2-t-first-demo-trade"
title: "A guided first demo trade"
summary: "Plan, size, place, manage and review a complete EURUSD trade on a Kalks demo account, using everything from this phase."
order: 7
version: 1
takeaways:
  - "A trade starts with a written plan: direction, entry, stop, target and the maximum amount you accept to lose."
  - "Size follows from the plan: money at risk divided by stop distance in pips gives the pip value, and pip value gives the lot size."
  - "Check margin, spread and upcoming news before sending the order, and attach the stop loss and take profit at entry."
  - "Every trade ends with a review in the Portfolio module, comparing what happened with what you planned."
practice:
  label: "Complete the full plan-size-place-manage-review cycle on a EURUSD demo trade using the checklist in this chapter, then write two sentences on what you would do differently."
  symbol: "EURUSD"
quiz:
  - question: "You want to risk 50 USD with a 25-pip stop on EURUSD. What lot size fits?"
    options:
      - "0.50 lot"
      - "0.02 lot"
      - "2.00 lots"
      - "0.20 lot"
    answer: 3
    explanation: "Required pip value is 50 / 25 = 2 USD per pip. On EURUSD, 1 lot is 10 USD per pip, so 2 / 10 = 0.20 lot."
  - question: "What margin does 0.20 lot EURUSD at 1.0851 require at 1:100 leverage?"
    options:
      - "217.02 USD"
      - "21.70 USD"
      - "2,170.20 USD"
      - "108.51 USD"
    answer: 0
    explanation: "Notional is 20,000 x 1.0851 = 21,702 USD, divided by 100 gives 217.02 USD."
  - question: "Why should you check the economic calendar before placing the order?"
    options:
      - "Because orders cannot be placed on news days"
      - "Because high-impact releases can widen spreads and cause slippage or gaps through your stop"
      - "Because the calendar shows your margin level"
      - "Because swaps are only charged on news days"
    answer: 1
    explanation: "Major releases change liquidity, spreads and fills. Knowing their timing lets you avoid entering seconds before them or decide to stay flat."
  - question: "When is the best time to decide what to do if the trade reaches half of its target?"
    options:
      - "When price gets there, based on how you feel"
      - "After the trade is closed"
      - "Before entry, as part of the written plan"
      - "It never needs deciding"
    answer: 2
    explanation: "Management rules such as partial close or moving the stop should be set in advance. Decisions made in the moment are driven by fear or greed."
---

This chapter brings the whole phase together. You will place one complete trade on a Kalks demo account, from plan to review, doing every calculation yourself. The aim is not to make money; demo money is virtual. The aim is to build a routine you can repeat, where nothing about the mechanics surprises you.

## Step 1: set up

1. Open a free demo account from the Accounts module in the Client Area and choose a balance you could realistically fund in future. We use 10,000 USD and 1:100 leverage.
2. Confirm the position mode, netting or hedging, so you know how a second order would behave.
3. Launch Kalks Trader and open a EURUSD chart. Choose a timeframe you can follow calmly, for example H1.
4. Open the EURUSD contract specification and note contract size (100,000), digits (typically 5), minimum volume (0.01) and the swap long and short values.
5. Check the economic calendar for high-impact USD or EUR events in the next few hours. If one is due within 30 minutes, wait until it has passed.

## Step 2: write the plan

Before touching the order ticket, write the plan down. The reasoning for direction and levels will come from the chart-reading skills in later phases; for now the focus is on mechanics, so choose simple levels and write them clearly.

```text
Symbol:       EURUSD, quote 1.0850 / 1.0851
Direction:    long (buy)
Entry:        market, expected fill at ask 1.0851
Stop loss:    1.0826   (25 pips below entry)
Take profit:  1.0901   (50 pips above entry)
Max risk:     0.5% of 10,000 USD = 50 USD
Management:   at +25 pips, move stop to breakeven. No other changes.
```

The management line matters. Deciding in advance what you will do stops you improvising when the position is moving.

## Step 3: size the position and check margin

```text
Required pip value = risk / stop distance = 50 / 25 = 2.00 USD per pip
EURUSD pip value per lot = 10.00 USD  ->  2.00 / 10.00 = 0.20 lot

Margin at 1:100 = 20,000 x 1.0851 / 100 = 217.02 USD
Margin level after entry = 10,000 / 217.02 x 100% = about 4,608%
Spread cost at 1 pip = 1 x 2.00 = 2.00 USD
Target profit = 50 x 2.00 = 100.00 USD, reward to risk 2 : 1
```

Everything is known before the order exists: the most you plan to lose, the margin you tie up, the cost to enter and the reward if the target is hit. The Academy covers position sizing in far more depth later, but this simple formula is the core of it.

> **Risk warning:** On a live account the same trade carries real risk. CFDs are leveraged, stops can slip in fast markets and gaps, and losses can exceed the planned amount. Keep risk per trade small and never size a trade from the margin you have available.

## Step 4: place the order

1. Open the order ticket for EURUSD and select a market order.
2. Enter a volume of 0.20. Read it back: not 2.0, not 0.02.
3. Enter stop loss 1.0826 and take profit 1.0901.
4. Check that the direction is Buy.
5. Confirm, then look at the positions panel: note the actual fill price and compare it with 1.0851. A difference is slippage.

If the fill was, say, 1.0852, your stop is now 26 pips away and your risk is 52 USD. That is normal; record it.

## Step 5: manage the trade

Follow the plan and only the plan. Watch the floating result, equity and margin level update. When the bid reaches 1.0876, 25 pips above entry, modify the position and move the stop loss to 1.0851. Then leave it alone.

Three things commonly tempt beginners at this stage: closing early because a small profit feels good, moving the stop further away because price is approaching it, and adding a second position because "it must turn". None of them is in the plan.

## Step 6: close and review

The trade ends at the stop, the breakeven stop or the target. Then open the Portfolio module in the Client Area and find the trade in your history.

| Review question | Your answer |
|---|---|
| Fill price vs planned entry | Slippage in pips |
| Exit price vs planned exit | Why any difference? |
| Net P&L after commission and swap | Matches your calculation? |
| Did you follow the management rule? | Yes or no |
| One thing to change next time | One sentence |

> **Example:** Target hit at 1.0901 with entry 1.0851 on 0.20 lot: 50 pips x 2.00 = +100.00 USD gross. With no commission and closed the same day, net is also 100.00 USD. If instead the breakeven stop was hit, the result is about 0 USD, and the review should ask whether the stop was moved too early.

## Common mistakes

- Skipping the written plan because it is "only demo". Habits formed on demo carry into live trading.
- Trading many symbols at once on day one. Repeat this cycle on EURUSD several times first.
- Judging the trade only by profit. A losing trade that followed the plan is a good trade; a winning one that broke it is a warning.
