---
slug: "p5-t-leverage-discipline"
title: "Leverage discipline"
summary: "Separate the account's leverage setting from the leverage you actually use, keep effective leverage and margin level in safe ranges, and build a pre-trade risk checklist."
order: 7
version: 1
takeaways:
  - "Effective leverage is total notional exposure divided by equity; it measures how hard your capital is working, regardless of the account's maximum leverage setting."
  - "With position size fixed by a stop and a risk percentage, a higher leverage setting only lowers the margin required; it does not change the loss if the stop is hit."
  - "High available leverage is dangerous because it allows oversizing: at 1:500, a $10,000 account fully used on EURUSD reaches a 50% stop-out after a move of only about 11 pips."
  - "A written pre-trade checklist covering risk, size, heat, margin level and events turns leverage discipline into a routine rather than a decision made under pressure."
practice:
  label: "On your demo account, open a 0.10 lot EURUSD position and note the used margin, free margin and margin level in Kalks Trader; then calculate your effective leverage by hand."
  symbol: "EURUSD"
quiz:
  - question: "Equity is $10,000 and you hold 0.40 lots EURUSD at 1.0850. What is your effective leverage?"
    options:
      - "1:500"
      - "0.4x"
      - "About 43x"
      - "About 4.3x"
    answer: 3
    explanation: "Notional = 0.40 x 100,000 x 1.0850 = $43,400. Effective leverage = 43,400 / 10,000 = 4.34x, whatever the account's leverage setting."
  - question: "You switch from 1:100 to 1:500 leverage and keep the same 0.40 lot EURUSD trade with a 25-pip stop. What changes?"
    options:
      - "The loss if the stop is hit rises five times"
      - "The margin required falls from $434 to $86.80; the loss at the stop is unchanged at $100"
      - "The pip value increases to $50"
      - "Nothing at all changes"
    answer: 1
    explanation: "Margin = notional / leverage: 43,400 / 100 = $434 and 43,400 / 500 = $86.80. Profit and loss depend on size and price movement, not on the leverage setting."
  - question: "Why is a very high leverage setting still risky for an undisciplined trader?"
    options:
      - "Because it allows much larger positions on the same equity, so a small move can trigger a margin call or stop-out"
      - "Because it increases spreads"
      - "Because it changes the contract size"
      - "Because swaps are charged on margin"
    answer: 0
    explanation: "Leverage is permission, not an instruction. The danger is the extra size it makes possible; used to its maximum, even a normal intraday move can wipe out a large share of the account."
  - question: "When can you change the leverage on a Kalks account?"
    options:
      - "At any time, even with open trades"
      - "Only at the weekend"
      - "Only when there are no open positions"
      - "Only by opening a new account"
    answer: 2
    explanation: "Leverage can only be changed with no open positions. Symbols may also have lower maximum leverage than the account setting."
---

Leverage is the feature that makes CFD trading accessible with modest capital, and the feature that ends most failed accounts. The problem is rarely leverage itself; it is the confusion between the leverage an account **allows** and the leverage a trader actually **uses**. This final chapter of the section ties together risk per trade, position sizing and exposure into a set of habits that keep leverage under control.

## Two different numbers

- **Account leverage** is the setting, for example 1:100 or 1:500. It determines the margin required to open a position: margin = notional / leverage (times any symbol margin percentage).
- **Effective leverage** is what you are using: total notional value of open positions divided by equity.

```text
Equity $10,000, long 0.40 lots EURUSD at 1.0850
Notional = 0.40 x 100,000 x 1.0850 = $43,400
Effective leverage = 43,400 / 10,000 = 4.34x

Margin at 1:30  = 43,400 / 30  = $1,446.67
Margin at 1:100 = 43,400 / 100 = $434.00
Margin at 1:500 = 43,400 / 500 =    $86.80
```

The loss if the 25-pip stop is hit is 0.40 x 25 x $10 = $100 in every case. When size comes from the risk-and-stop method, the leverage setting affects only how much margin is locked up, and therefore how much free margin remains.

## Why high leverage is still dangerous

The risk is what high leverage makes **possible**. Consider the same account used to its limit:

```text
Equity $10,000, account leverage 1:500, EURUSD at 1.0850
Maximum notional = 10,000 x 500 = $5,000,000
Per lot notional = $108,500 -> about 46 lots
Margin used for 46 lots = 46 x 108,500 / 500 = $9,982
Margin level at entry = 10,000 / 9,982 = about 100% (margin call already)

Pip value = 46 x $10 = $460 per pip
Stop-out at 50% margin level -> equity falls to $4,991
Loss to stop-out = 10,000 - 4,991 = $5,009 -> about 11 pips
```

An ordinary 11-pip move, smaller than many five-minute candles on a news day, would cost half the account and trigger forced closures. The broker's stop-out protects the account from going negative in normal conditions; it does not protect your capital. Remember too that at stop-out the largest losing position is closed first, which may not be the one you would have chosen.

## Guidelines for effective leverage and margin level

There is no single correct number, but these ranges are widely used as sensible limits for discretionary traders:

| Measure | Comfortable | Warning | Danger |
|---|---|---|---|
| Effective leverage (total) | below 5x | 5x to 10x | above 10x |
| Margin level | above 1,000% | 300% to 1,000% | below 300% |
| Portfolio heat | up to 5% | 5% to 8% | above 8% |

In the first example the margin level at 1:500 is 10,000 / 86.80 = about 11,500%, far into the comfortable zone. Effective leverage depends on the instrument: 0.12 lots of XAUUSD at 2,350.40 is a notional of 0.12 x 100 x 2,350.40 = $28,204.80, or about 2.8x on $10,000, while carrying the same 1% stop risk as the EURUSD trade.

Note that some instruments have their own lower maximum leverage than the account setting, and leverage can be changed only when you have no open positions. Plan the setting before trading, not in the middle of a trade.

> **In Kalks Trader:** The account panel shows equity, used margin, free margin and margin level in real time. Watching margin level is the quickest way to see whether your total exposure is creeping up.

## A pre-trade checklist

Leverage discipline works best as a routine. Before each trade, confirm:

1. The stop is at the level that invalidates the idea.
2. Size = risk amount / (stop distance x value per unit), rounded down.
3. Risk including spread and commission is within your per-trade limit.
4. Portfolio heat after this trade stays within your total limit, and the theme limit is respected for correlated positions.
5. Margin level after the trade stays in the comfortable zone.
6. No high-impact release, earnings report or weekend gap risk is due that your plan does not account for.
7. The daily and weekly loss limits have not been reached.

> **Example:** A trader with $5,000 equity wants to buy BTCUSD at 64,000 with a stop at 62,400. At 1% risk ($50), and an example contract of 1 BTC per lot, the size is 50 / 1,600 = 0.031, rounded down to 0.03 lots. Notional is 0.03 x 64,000 = $1,920, effective leverage 0.38x. Existing open risk is 3.5%, so heat after the trade is 4.5%, within a 5% limit. The trade passes the checklist; had heat been 5% already, it would have been skipped.

## Common mistakes

- Choosing the highest leverage available and then sizing by free margin.
- Believing lower leverage makes a trade safer when the lot size is the same; it only locks more margin.
- Adding to losing positions because free margin allows it.
- Ignoring crypto's nightly swaps and weekend moves, which affect equity while FX is closed.

> **Risk warning:** CFDs are complex, leveraged instruments and losses can build quickly. Keep effective leverage low, always use a stop loss, and practise these routines on a free demo account in Kalks Trader before applying them with real money.
