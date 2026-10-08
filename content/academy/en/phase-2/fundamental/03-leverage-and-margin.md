---
slug: "p2-f-leverage-and-margin"
title: "Leverage and margin"
summary: "How margin is calculated, what leverage really changes, and why effective leverage on your equity is the number that matters."
order: 3
version: 1
takeaways:
  - "Margin is a deposit set aside to open a position: notional value divided by leverage, adjusted by any symbol margin percentage."
  - "Leverage changes how much margin a trade needs, not how much each pip or point is worth."
  - "Effective leverage, total notional divided by equity, tells you how hard a price move will hit your account."
  - "Leverage on Ezymex can only be changed when you have no open positions, and some symbols carry lower maximum leverage."
quiz:
  - question: "What margin is required for 1.00 lot of EURUSD at 1.0850 with 1:100 leverage on a USD account?"
    options:
      - "108.50 USD"
      - "1,085 USD"
      - "10,850 USD"
      - "1,000 USD"
    answer: 1
    explanation: "Notional is 100,000 x 1.0850 = 108,500 USD, and 108,500 / 100 = 1,085 USD. 108.50 USD would be the margin for 0.10 lot."
  - question: "A trader switches from 1:100 to 1:500 leverage and keeps trading 0.50 lot EURUSD. What changes?"
    options:
      - "Each pip is worth five times more"
      - "The margin required falls to one fifth; the profit or loss per pip stays the same"
      - "The spread becomes five times smaller"
      - "Nothing changes at all"
    answer: 1
    explanation: "Pip value depends on position size, not leverage. Higher leverage only lowers the margin set aside, from 542.50 USD to 108.50 USD here."
  - question: "Equity is 2,000 USD and open positions have a total notional value of 60,000 USD. What is the effective leverage?"
    options:
      - "1:60"
      - "1:20"
      - "1:30"
      - "1:500"
    answer: 2
    explanation: "Effective leverage is 60,000 / 2,000 = 30, so 1:30. Account leverage is only the maximum you are allowed to use."
  - question: "What is the margin for 1.00 lot of USDJPY at 1:200 on a USD account?"
    options:
      - "500 USD"
      - "775 USD"
      - "155 USD"
      - "5,000 USD"
    answer: 0
    explanation: "The base currency is USD, so notional is 100,000 USD regardless of the rate. 100,000 / 200 = 500 USD."
---

CFDs are traded on margin. You do not pay the full value of the position; you set aside a fraction of it as a deposit, and the broker lets you control the rest. The ratio between the full value and that deposit is **leverage**. Leverage is the feature that makes small accounts able to trade meaningful sizes, and also the reason small price moves can cause large losses.

## What margin is

Margin is not a fee and not the cost of the trade. It is part of your own money, locked while the position is open so that you can absorb losses on it. When you close the position the margin is released back to free margin, and only the profit or loss changes your balance.

On Ezymex the required margin is:

```text
margin = notional value in account currency / leverage   (x symbol margin %)
notional = contract size x lots x price
```

The symbol margin percentage is normally 100%. Some symbols, for example crypto or single stocks, may carry a lower maximum leverage than your account, which has the same effect as a higher margin percentage. The contract specification in Ezymex Trader shows the figure for each symbol.

## Worked margin calculations

All examples assume a USD account.

```text
EURUSD 1.00 lot at 1.0850, 1:100
  notional 100,000 x 1.0850 = 108,500 USD
  margin   108,500 / 100    =   1,085.00 USD

EURUSD 0.10 lot at 1.0850, 1:100
  notional  10,000 x 1.0850 =  10,850 USD
  margin    10,850 / 100    =     108.50 USD

USDJPY 1.00 lot, 1:200  (base currency is USD)
  notional 100,000 USD
  margin   100,000 / 200    =     500.00 USD

XAUUSD 0.10 lot at 2,350.40, 1:100
  notional 100 x 0.10 x 2,350.40 = 23,504 USD
  margin   23,504 / 100          =    235.04 USD

BTCUSD 0.10 lot at 64,000, symbol capped at 1:20 (1 BTC per lot example)
  notional 0.1 x 64,000 = 6,400 USD
  margin   6,400 / 20   =   320.00 USD
```

Note the last example: even if your account is set to 1:500, a symbol with a lower cap uses its own limit.

## What leverage does and does not change

Leverage changes only the deposit. It does **not** change the value of a pip, the spread, the swap or the profit and loss of the trade. A 0.50 lot EURUSD position makes or loses 5 USD per pip at 1:50, 1:100 or 1:1000. At 1:100 it ties up 542.50 USD of margin; at 1:500, 108.50 USD.

So why does leverage feel dangerous? Because lower margin requirements let you open far larger positions relative to your account. The risk lies in the size you choose, and high leverage removes the brake that would otherwise stop you choosing too large a size.

## Effective leverage: the number that matters

Account leverage is a ceiling. What actually drives your risk is **effective leverage**:

```text
effective leverage = total notional of open positions / equity
```

> **Example:** Equity is 1,000 USD. You buy 0.50 lot EURUSD at 1.0850, notional 54,250 USD. Effective leverage is 54,250 / 1,000 = about 54:1. A 1% fall in EURUSD is 0.01085, about 108.5 pips. At 5 USD per pip that is a loss of 542.50 USD, or 54% of your equity, from a move that EURUSD can make within a single volatile week.

This is why experienced traders pay attention to effective leverage and keep it modest, even on accounts that allow 1:500 or 1:1000. The size of a position relative to equity, not the leverage setting, decides how quickly an account can be damaged.

> **Risk warning:** CFDs are leveraged products. A small adverse price move can produce a loss that is large relative to your deposit, and losses can exceed what you expected when you opened the trade. Only trade with money you can afford to lose, and practise on a free demo account in Ezymex Trader first.

## Leverage settings on Ezymex

Leverage options typically range from 1:50 to 1:1000 depending on the account group and symbol. You choose it per trading account in the Client Area, and it can only be changed when that account has no open positions, because changing it would instantly alter the margin of existing trades. Lower leverage does not make you safer if you still open oversized positions, but it does make it harder to over-trade by accident.

## Common mistakes

- Treating free margin as money you should use. Free margin is a buffer against losses, not a target.
- Believing higher leverage increases profit per pip. It does not; only lot size does.
- Ignoring currency conversion. EURUSD margin depends on the EURUSD rate because the notional is in euros.
- Forgetting symbol caps. Gold, crypto and stocks may require more margin than a major FX pair at the same account leverage.
