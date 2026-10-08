---
slug: "p1-f-what-is-a-cfd"
title: "What is a CFD?"
summary: "How a contract for difference lets you trade price movements in currencies, gold, indices, oil, crypto and shares without owning the asset."
order: 3
version: 1
takeaways:
  - "A CFD is an agreement with your broker to exchange the difference between the opening and closing price of an instrument, multiplied by your position size."
  - "You can go long (buy) to profit from a rise or short (sell) to profit from a fall, with the same mechanics in both directions."
  - "You never own the underlying asset, so you have no delivery, no voting rights and no wallet, only price exposure."
  - "CFDs are leveraged: you post margin, a fraction of the full position value, but profit and loss are calculated on the full value."
  - "The main costs are the spread, any commission, and overnight swaps on positions held past 00:00 server time."
practice:
  label: "On your demo account, open 0.01 lot of XAUUSD, note the entry price and the margin shown, then close it and compare the result with the price difference."
  symbol: "XAUUSD"
quiz:
  - question: "You buy 1 lot of EURUSD CFD at 1.0851 and later close it at 1.0891. With a contract size of 100,000 euros, what is the gross profit?"
    options:
      - "40 USD"
      - "4,000 USD"
      - "400 USD"
      - "4 USD"
    answer: 2
    explanation: "The price moved 1.0891 - 1.0851 = 0.0040. Multiplied by 100,000 units, that is 400 USD. 4,000 would require a 400-pip move."
  - question: "What do you own when you buy an AAPL CFD?"
    options:
      - "A contract whose value tracks the AAPL share price, but not the share itself"
      - "Apple shares held in your name at a custodian"
      - "Voting rights at the Apple annual meeting"
      - "An exchange-traded option on Apple"
    answer: 0
    explanation: "A CFD is a contract with the broker that mirrors the price of the underlying. You gain or lose from price moves but do not own the share or receive shareholder rights."
  - question: "How do you profit from a falling price with a CFD?"
    options:
      - "You cannot; CFDs only profit from rising prices"
      - "By opening a sell (short) position and closing it at a lower price"
      - "By buying and waiting for the swap to pay you"
      - "By asking the broker to deliver the asset"
    answer: 1
    explanation: "Selling first and buying back lower produces a profit equal to the price difference times size. The mechanics are symmetrical to a long position."
  - question: "Why can a small price move produce a large profit or loss relative to the money you deposited?"
    options:
      - "Because spreads amplify every move"
      - "Because swaps are charged every hour"
      - "Because CFDs are traded on exchanges"
      - "Because profit and loss are calculated on the full position value while you only post a fraction of it as margin"
    answer: 3
    explanation: "Leverage means your exposure is much larger than your margin. A 1% move on the full position can be 50% or more of the margin, which is why position size matters so much."
---

When you trade on Ezymex you are not buying euros, gold bars, barrels of oil or Apple shares. You are trading **contracts for difference**, or CFDs. Understanding exactly what that means will save you from several common misunderstandings about costs, ownership and risk.

## The core idea

A CFD is an agreement between you and your broker to exchange the **difference** in the price of an instrument between the moment you open the contract and the moment you close it. If the price moves in your favour, the broker pays you the difference multiplied by your position size. If it moves against you, you pay the broker.

The formula is the same for every instrument:

```text
Profit or loss = (closing price - opening price) x position size in units   (for a buy)
Profit or loss = (opening price - closing price) x position size in units   (for a sell)
```

The CFD's price is derived from the underlying market. EURUSD on Ezymex follows the interbank FX price, XAUUSD follows spot gold, US30 follows the Dow Jones Industrial Average, and AAPL follows the share price on its US exchange.

## Long and short

Because a CFD is simply a contract on price, you can take either side with the same ease.

- **Long (buy):** you open at the ask and close by selling at the bid. You profit if the price rises.
- **Short (sell):** you open at the bid and close by buying at the ask. You profit if the price falls.

There is no need to borrow anything to go short, which is one reason CFDs are popular for trading both directions.

> **Example:** You buy 1 lot of EURUSD at 1.0851. The contract size is 100,000 euros. A few hours later the bid is 1.0891 and you close. The profit is (1.0891 - 1.0851) x 100,000 = 0.0040 x 100,000 = 400 USD, before any commission or swap.

A second example on gold shows the short side:

```text
Instrument:     XAUUSD, contract size 100 oz per lot
Action:         Sell 0.10 lot (10 oz) at the bid, 2,350.40
Close:          Buy back at the ask, 2,337.90
Price change:   2,350.40 - 2,337.90 = 12.50 USD per oz
Result:         12.50 x 10 oz = +125.00 USD
```

Had gold risen by 12.50 instead, the same position would have lost 125 USD.

## What you do and do not own

With a CFD you have **price exposure only**. That has practical consequences:

- There is no physical delivery. You will never receive gold or oil.
- With share CFDs you have no voting rights. When a share pays a dividend, CFD positions typically receive (long) or pay (short) a cash adjustment instead.
- With crypto CFDs such as BTCUSD you have no wallet and nothing to transfer on a blockchain; you are exposed to the price, not holding the coin.
- Your counterparty is the broker. That is why the broker's regulation, client-money handling and execution policy matter, covered in the chapter on how a broker works.

## Leverage and margin in one paragraph

To open a CFD you post **margin**, a deposit that is a fraction of the position's full value (its notional). The ratio is the leverage. On a 1:100 account, 0.10 lot of gold at 2,350.40 has a notional of 10 x 2,350.40 = 23,504 USD, and the margin required is 23,504 / 100 = 235.04 USD. But the 125 USD profit or loss in the example above is calculated on the full 23,504, not on the 235.04 you posted. A 12.50 move is about 0.5% of the gold price, yet it equals roughly 53% of that margin. Phase 2 covers the maths in detail.

> **Risk warning:** CFDs are leveraged products. Small price moves can create losses that are large relative to your deposit, and losses can exceed what you expected when you opened the trade. Only trade money you can afford to lose, and start on a demo account.

## What a CFD trade costs

Three costs appear on almost every CFD trade:

1. **Spread.** You buy at the ask and sell at the bid, so every trade starts with a small loss equal to the spread.
2. **Commission.** Some account types charge a fixed commission per lot, usually in exchange for tighter spreads.
3. **Swap (overnight financing).** A position still open at 00:00 server time is credited or debited a swap, reflecting interest-rate differences and financing. FX and metals take a triple swap on Wednesday night to cover the weekend; indices, energies and stocks do so on Friday; crypto is charged every night. Swap-free accounts are available for clients who need them.

For a trade held a few hours, the spread is usually the main cost. For a trade held for weeks, swaps can become significant, so check the swap rates in the symbol's contract specification in Ezymex Trader.

## Common mistakes

- **Confusing margin with risk.** The margin is not the maximum you can lose on a trade. Your loss depends on how far the price moves against the full position.
- **Forgetting the spread on the close.** A buy closes at the bid. If the spread widens when you exit, your result is worse than the chart suggests.
- **Holding CFDs like investments without checking swaps.** Holding a leveraged index CFD for months can cost more in financing than expected.

Try both a buy and a sell on a free demo account in Ezymex Trader and check that your results match the formula above.
