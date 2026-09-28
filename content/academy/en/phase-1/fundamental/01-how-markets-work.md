---
slug: "p1-f-how-financial-markets-work"
title: "How financial markets work"
summary: "What a market actually does, who the participants are, and why every price you see has two sides."
order: 1
version: 1
takeaways:
  - "A financial market is a mechanism for matching buyers and sellers, and the price is simply the level at which they currently agree to trade."
  - "Participants range from central banks and large banks to funds, companies and retail traders, and each trades for a different reason."
  - "Exchange markets have a central order book, while over-the-counter markets such as spot FX and CFDs are dealer networks without one central price."
  - "Every quote has a bid (where you can sell) and an ask (where you can buy); the gap between them, the spread, is a cost you pay on every trade."
  - "Liquidity determines how easily you can trade without moving the price, and it changes by instrument and by time of day."
practice:
  label: "Open the Market Watch in Kalks Trader on your demo account and compare the bid-ask spread of EURUSD, XAUUSD and BTCUSD."
  symbol: "EURUSD"
quiz:
  - question: "You want to buy EURUSD and the quote shows 1.0850 / 1.0851. At which price will a market buy order normally be filled?"
    options:
      - "1.0850, the bid"
      - "1.0851, the ask"
      - "1.08505, the mid price"
      - "Whatever price you type in"
    answer: 1
    explanation: "Buyers pay the ask, which is the higher of the two prices. The bid (1.0850) is where you can sell. The mid price is only a reference and is not a tradable level."
  - question: "Which of these is the best description of an over-the-counter (OTC) market?"
    options:
      - "A market where all orders go through one central exchange order book"
      - "A market that only trades after the official close"
      - "A network of dealers and counterparties quoting prices directly to each other and to clients"
      - "A market that is not regulated anywhere in the world"
    answer: 2
    explanation: "OTC means trades are agreed directly between counterparties, usually via dealers, rather than through a single exchange order book. Spot FX and CFDs are OTC. OTC does not mean unregulated."
  - question: "Why does a company that imports goods from Europe into the US buy euros in the FX market?"
    options:
      - "To pay its European suppliers, which is a commercial need rather than speculation"
      - "Because euros always rise in value"
      - "To earn the spread"
      - "Because central banks require it"
    answer: 0
    explanation: "Corporations mostly trade FX to settle real business payments or hedge them. Their flows move prices, but their motive is commercial, not a view on direction."
  - question: "What does high liquidity in an instrument usually mean for a trader?"
    options:
      - "Prices never move"
      - "Profits are more likely"
      - "Only banks are allowed to trade it"
      - "Tighter spreads and the ability to trade normal sizes without moving the price much"
    answer: 3
    explanation: "Liquidity is about how much volume is available near the current price. It reduces trading costs and slippage, but it says nothing about whether a trade will be profitable."
---

Every chart you will ever look at is a record of one thing: people agreeing on a price. Before you learn to read charts or place orders, it helps to understand what a market is, who is on the other side of your trades, and why prices are quoted the way they are. This chapter builds that foundation.

## What a market actually does

A financial market is a meeting place, physical or electronic, where buyers and sellers exchange an asset. Its job is to answer two questions at every moment: *what is this worth right now*, and *can I trade it right now*. The answer to the first is the price. The answer to the second is liquidity.

The price is not decided by anyone in particular. It is the level at which the most recent buyer and seller agreed to trade. If more people want to buy than sell at the current price, sellers can demand more and the price rises until enough buyers drop out. If sellers dominate, the price falls until buyers step in. Everything else in this course, from economic data to chart patterns, is ultimately about anticipating shifts in that balance.

## Who participates, and why

Markets work because participants have *different* reasons for trading. If everyone wanted the same thing, nobody would take the other side.

| Participant | Main reason for trading | Typical effect |
|---|---|---|
| Central banks | Manage interest rates, currency stability, reserves | Can shift trends for months |
| Commercial and investment banks | Serve clients, make markets, manage their own risk | Provide most of the liquidity |
| Asset managers and pension funds | Invest long-term capital, hedge currency exposure | Large, slow, persistent flows |
| Hedge funds and proprietary firms | Speculate on price moves | Fast, sometimes aggressive flows |
| Corporations | Pay suppliers, repatriate profits, hedge costs | Steady commercial demand |
| Retail traders | Speculate, usually via brokers and CFDs | Small individually, visible in sentiment |

A retail trader on Kalks is at the small end of this table. That matters: you cannot move the market, so your edge has to come from understanding what the bigger participants are likely to do, not from forcing prices.

## Exchanges versus over-the-counter markets

There are two basic ways a market can be organised.

On an **exchange**, such as a stock or futures exchange, all orders go to a central order book. Everyone sees the same prices, trades are recorded centrally, and there is one official volume figure. US shares like AAPL or NVDA trade this way on their home exchanges.

In an **over-the-counter (OTC)** market there is no single order book. Dealers, mostly large banks, quote prices to each other and to their clients. The spot foreign exchange market is the largest OTC market in the world. Because there is no central venue, two dealers can show very slightly different prices for EURUSD at the same moment, and there is no official total volume.

Contracts for difference (CFDs), which is what you trade on Kalks, are also OTC products: your contract is with your broker, and the broker's prices are derived from the underlying market. You will learn exactly how that works in the CFD chapter.

## Two prices: the bid and the ask

Any tradable quote has two sides:

- The **bid** is the price at which the market will buy from you, so it is where you *sell*.
- The **ask** (or offer) is the price at which the market will sell to you, so it is where you *buy*.
- The **spread** is the difference between them, and it is a cost you pay every time you open a trade.

> **Example:** EURUSD is quoted 1.0850 / 1.0851. You buy one standard lot (100,000 euros) at the ask, 1.0851. If you closed immediately you would sell at the bid, 1.0850. The difference is 0.0001, or 1 pip. On 100,000 euros that is 100,000 x 0.0001 = 10 US dollars, which is the cost of crossing the spread.

```text
Quote:          1.0850 (bid) / 1.0851 (ask)
Spread:         1.0851 - 1.0850 = 0.0001 = 1 pip
Position size:  100,000 EUR (1 standard lot)
Spread cost:    100,000 x 0.0001 = 10.00 USD
```

This is why a trade always starts slightly negative. The price has to move in your favour by at least the spread before you break even.

## Liquidity: why some markets are cheaper to trade

Liquidity describes how much buying and selling interest sits close to the current price. In a liquid market you can trade a normal size without pushing the price away, and spreads are tight. In a thin market, even modest orders move the price, and spreads widen.

Liquidity is not fixed. EURUSD is extremely liquid during the London and New York trading day and noticeably thinner around the daily rollover, when many dealers step back. Spreads on almost every instrument widen around major news releases and at the weekly open. Crypto trades around the clock but liquidity on Sunday is typically thinner than midweek.

> **Tip:** When you compare instruments on Kalks, look at the spread relative to the instrument's normal daily movement, not the spread in isolation. A 1-pip spread on a pair that moves 70 pips a day is a smaller hurdle than a 3-pip spread on a pair that moves 30.

## Common mistakes

- **Thinking the chart price is the price you get.** Most charts plot the bid. A buy order fills at the ask, so a buy stop placed exactly at a chart high may trigger or not depending on the spread.
- **Ignoring spread changes.** A strategy that works with a 1-pip spread can fail if you trade at times when the spread is three or four times wider.
- **Assuming someone is "controlling" the price.** In deep markets like major FX pairs and gold, prices reflect the combined actions of thousands of participants. Moves that look deliberate are usually large flows or news.

Practise on a free demo account in Kalks Trader: watch how the bid and ask of a few symbols move through the day, and note when spreads are tightest.
