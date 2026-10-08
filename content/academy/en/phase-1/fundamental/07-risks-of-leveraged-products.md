---
slug: "p1-f-risks-of-leveraged-products"
title: "The risks of leveraged products"
summary: "How leverage, gaps, volatility and your own behaviour can turn a small price move into a large loss, and what to do about it from day one."
order: 7
version: 1
takeaways:
  - "Leverage lets you control a large position with a small deposit, which magnifies both gains and losses relative to your account."
  - "Account size, position size and leverage together decide how far the price can move against you before a margin call or stop-out."
  - "Stop losses limit risk in normal conditions, but gaps and fast markets can fill them at worse prices."
  - "Most retail CFD accounts lose money; the risk comes mainly from oversized positions and behaviour, not from the product being mysterious."
  - "Practising on a demo account and keeping position sizes small relative to your balance are the most effective early protections."
practice:
  label: "On a demo account with 1,000 USD, open 0.01 lot of EURUSD and watch how the margin level in Ezymex Trader changes as the price moves."
  symbol: "EURUSD"
quiz:
  - question: "A 1,000 USD account on 1:500 leverage buys 1 lot of EURUSD at 1.0851. Ignoring the spread, how much will the account lose if EURUSD falls 50 pips?"
    options:
      - "50 USD"
      - "217 USD"
      - "1,000 USD"
      - "500 USD"
    answer: 3
    explanation: "One pip on 1 lot of EURUSD is worth 10 USD, so 50 pips is 500 USD, half the account. The 217 USD figure is the margin, which has nothing to do with the size of the loss."
  - question: "Why might a stop loss be filled at a price worse than the level you set?"
    options:
      - "Because the market gapped or moved so fast that no trades were available at your level"
      - "Because stop losses are only suggestions"
      - "Because the broker always adds 10 pips"
      - "Because stop losses only work on demo accounts"
    answer: 0
    explanation: "A stop becomes a market order once triggered and fills at the next available price. After a weekend gap or during fast news, that price can be well beyond your stop level."
  - question: "What happens at stop-out on a typical Ezymex account group?"
    options:
      - "All positions are closed at a profit"
      - "The broker adds funds to your account"
      - "Positions are closed, starting with the largest losing position, until the margin level recovers"
      - "Nothing, it is only a warning"
    answer: 2
    explanation: "At stop-out, typically a 50% margin level, the system closes the largest losing position first and repeats until the margin level is back above the threshold. The margin call at 100% is the warning stage."
  - question: "Which change reduces the risk of a trade the most?"
    options:
      - "Increasing leverage from 1:100 to 1:500 with the same lot size"
      - "Reducing the position from 1 lot to 0.10 lot"
      - "Moving the stop loss further away with the same lot size"
      - "Removing the stop loss so it cannot be hit"
    answer: 1
    explanation: "Position size decides how much money each pip or point is worth. Cutting size by 90% cuts the loss per pip by 90%. Changing leverage alone only changes the margin required, not the loss per pip."
---

Leverage is the feature that makes CFDs attractive, and it is also the feature that causes most losses. It is not dangerous by itself; it is dangerous when a position is too large for the account holding it. This chapter shows, with numbers, how that happens, and which other risks come with leveraged trading.

## What leverage really does

Leverage lets you open a position worth much more than the money you post as margin. On a 1:100 account, each 1,000 USD of position requires 10 USD of margin. On 1:500, it requires 2 USD.

The crucial point: **leverage changes the margin you need, not the money you make or lose per pip.** Profit and loss depend on your position size. What higher leverage does is allow you to open a much larger position with the same account, and that is where the danger lies.

## A worked example

A trader deposits 1,000 USD on a 1:500 account and buys 1 lot of EURUSD at 1.0851. For simplicity, ignore the spread.

```text
Notional:       100,000 x 1.0851      = 108,510.00 USD
Margin:         108,510 / 500         =     217.02 USD
Value per pip:  100,000 x 0.0001      =      10.00 USD
```

Now EURUSD falls:

| Fall | Loss | Equity | Margin level (equity / margin) |
|---|---|---|---|
| 20 pips | 200 USD | 800.00 USD | 368.6% |
| 50 pips | 500 USD | 500.00 USD | 230.4% |
| 78.3 pips | 782.98 USD | 217.02 USD | 100% (margin call) |
| 89.1 pips | 891.49 USD | 108.51 USD | 50% (stop-out) |

EURUSD commonly moves 60 to 90 pips in a day. This trader could lose close to 90% of the account on an ordinary day, without any unusual event.

```svg
<svg viewBox="0 0 640 170" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <text x="320" y="22" text-anchor="middle" font-size="14">Equity of a 1,000 USD account holding 1 lot EURUSD</text>
    <text x="60" y="118" text-anchor="middle">0</text>
    <text x="580" y="118" text-anchor="middle">1,000 USD</text>
    <text x="320" y="118" text-anchor="middle">500</text>
    <text x="173" y="142" text-anchor="middle" fill="#ff5a1f">Margin call 217 USD</text>
    <text x="116" y="160" text-anchor="middle" fill="#ef4444">Stop-out 109 USD</text>
    <text x="450" y="50" text-anchor="middle">Each pip against you removes 10 USD</text>
  </g>
  <rect x="60" y="64" width="520" height="30" fill="#3a3a44"/>
  <rect x="60" y="64" width="113" height="30" fill="#ff5a1f" fill-opacity="0.35"/>
  <rect x="60" y="64" width="56" height="30" fill="#ef4444" fill-opacity="0.6"/>
  <line x1="173" y1="58" x2="173" y2="130" stroke="#ff5a1f"/>
  <line x1="116" y1="58" x2="116" y2="148" stroke="#ef4444"/>
  <line x1="320" y1="94" x2="320" y2="104" stroke="#c9c9d1"/>
</svg>
```

Now compare the same trader with **0.10 lot**. Value per pip is 1 USD, margin is 21.70 USD, and the same 89-pip fall costs about 89 USD, under 9% of the account. Same market, same leverage, completely different risk.

> **Risk warning:** CFDs are leveraged. A position that is large relative to your balance can be closed out by a normal daily move, and losses can exceed what you expected when you opened the trade. Never trade money you cannot afford to lose.

## Margin call and stop-out

Ezymex tracks your **margin level**, equity divided by used margin, as a percentage. On typical account groups:

- At **100%** you reach a **margin call**: you cannot open new positions, and it is a warning that your buffer is gone.
- At **50%** you reach **stop-out**: the system closes your largest losing position first, and repeats until the margin level recovers.

Stop-out is a last line of defence for the account, not a risk-management plan. Phase 2 explains the calculations in full.

## Risks beyond leverage

**Gaps.** Markets can open at a very different price from where they closed, especially after weekends or major news. A stop loss becomes a market order when triggered, so it fills at the next available price.

> **Example:** You hold 0.50 lot of XAUUSD (50 oz) long from 2,350.40 over the weekend, with a stop loss at 2,340.00. Your planned maximum loss is (2,350.40 - 2,340.00) x 50 = 10.40 x 50 = 520 USD. On Monday gold opens at 2,320.00 after weekend news. The stop fills near 2,320.00, and the loss is 30.40 x 50 = 1,520 USD, almost three times the plan.

**Volatility and liquidity.** Around high-impact news or during thin hours, spreads widen and prices jump. Orders may be filled with slippage.

**Instrument-specific risk.** Single shares gap on earnings, oil gaps on supply news, crypto trades through the weekend while you may be away.

**Overnight costs.** Swaps accumulate on positions held for days or weeks.

**Behavioural risk.** Increasing size after losses, removing stop losses, and trading to "win back" money cause more damage than any market event. Regulators in several jurisdictions require CFD brokers to disclose the percentage of retail accounts that lose money, and it is typically a clear majority.

## In practice: sensible habits from day one

1. Start on a free demo account in Ezymex Trader and stay there until you can follow a plan consistently.
2. Size positions so that a normal daily move against you is a small percentage of your balance.
3. Use a stop loss on every trade, and accept that it is a limit in normal conditions, not a guarantee.
4. Check the economic calendar and be aware of weekends before holding positions.
5. Treat high leverage as a convenience for margin, never as a target to use fully.

## Common mistakes

- **Believing high leverage means high profit.** It only means low margin; risk is set by position size.
- **Using the margin as the risk measure.** The 217 USD of margin in the example had no connection to the 891 USD loss.
- **Assuming a stop loss is exact.** Gaps and fast markets can fill it at a worse price.
