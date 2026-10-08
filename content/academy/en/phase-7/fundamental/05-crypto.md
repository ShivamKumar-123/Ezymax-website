---
slug: "p7-f-crypto-markets"
title: "Crypto markets"
summary: "What drives BTCUSD, ETHUSD and other crypto CFDs, why they behave differently from traditional assets, and how to manage their volatility."
order: 5
version: 1
takeaways:
  - "Crypto prices are driven by liquidity and risk appetite, adoption and flows such as spot ETFs, and events specific to each network."
  - "Bitcoin and other large tokens are typically several times more volatile than major FX pairs, so position sizes must be much smaller for the same risk."
  - "Crypto trades 24/7, but liquidity is thinner at weekends and overnight, which can produce sharp, fast moves."
  - "Crypto CFDs are charged swap every night, including weekends, which makes long holding periods costly."
  - "Altcoins such as SOLUSD and XRPUSD usually move with bitcoin but with larger swings in both directions."
practice:
  label: "On your demo account, measure the average daily range of BTCUSD over the last 20 days as a percentage of price and compare it with the same measure for EURUSD."
  symbol: "BTCUSD"
quiz:
  - question: "A trader risks 150 USD on a BTCUSD trade with a stop 1,500 USD away, on an example contract of 1 BTC per lot. What lot size is correct?"
    options:
      - "1.00 lot"
      - "0.15 lot"
      - "0.01 lot"
      - "0.10 lot"
    answer: 3
    explanation: "Risk per 1.00 lot = 1,500 USD. 150 / 1,500 = 0.10 lot. A full lot would risk 1,500 USD, ten times the plan."
  - question: "Why can crypto move sharply on a Sunday?"
    options:
      - "It trades 24/7 while most traditional markets are closed, so liquidity is thinner"
      - "Swap is charged only on Sundays"
      - "Bitcoin halvings always occur on Sundays"
      - "Crypto prices are fixed on Saturdays"
    answer: 0
    explanation: "With banks, stock exchanges and many institutional desks closed, order books are thinner and a large order can move the price further. Halvings depend on block count, not weekdays."
  - question: "What is the bitcoin halving?"
    options:
      - "A 50% price crash that happens every year"
      - "A split of each coin into two"
      - "A cut in the number of new bitcoins issued per block, roughly every four years"
      - "A regulatory limit on leverage"
    answer: 2
    explanation: "Every 210,000 blocks, about four years, the block reward to miners is halved, slowing new supply. It says nothing certain about price."
  - question: "How does swap on crypto CFDs typically differ from FX on Ezymex?"
    options:
      - "Crypto has no swap"
      - "Crypto swap is charged every night, including weekends"
      - "Crypto swap is tripled on Wednesday"
      - "Crypto swap is only charged on short positions"
    answer: 1
    explanation: "Because crypto trades seven days a week, financing is charged every night. FX and metals instead apply a triple swap on Wednesday night to cover the weekend."
---

Crypto CFDs such as BTCUSD, ETHUSD, SOLUSD and XRPUSD let you trade price movements in digital assets without holding coins or a wallet. They attract traders because they move a lot. That same volatility, together with a market structure that differs from traditional assets, is the reason many new crypto traders lose money quickly. This chapter explains what drives these markets and how to adapt your risk to them.

## What drives crypto prices

Crypto assets have no earnings or interest payments to anchor their value, so prices are driven mainly by supply and demand for the tokens themselves. The main forces are:

- **Liquidity and risk appetite.** Crypto has tended to rise when global liquidity is plentiful and interest rates are falling, and to fall hard when central banks tighten. In many periods BTCUSD has moved in the same direction as NAS100, though the correlation changes over time.
- **Flows and adoption.** The approval of US spot bitcoin exchange-traded funds in January 2024 opened a regulated channel for institutional money, and daily ETF flows are now watched as a demand gauge.
- **Supply schedule.** Bitcoin's issuance is fixed by code. Every 210,000 blocks, roughly every four years, the reward paid to miners halves. The most recent halving was in April 2024. The event reduces new supply, but its effect on price is debated and never guaranteed.
- **Network and regulatory news.** Upgrades, security incidents, exchange failures and regulatory decisions can move individual tokens or the whole market.

## Volatility: the defining feature

Bitcoin commonly moves 2% to 5% in a day, and larger altcoins can move more. EURUSD, by contrast, typically moves well under 1%. This affects every part of a trade.

```text
Example contract: 1 BTC per lot (check the contract specification
in Ezymex Trader for each crypto symbol)

Buy 0.05 lot BTCUSD at 64,000
A 4% fall takes price to 61,440
Loss = (64,000 - 61,440) x 0.05 = 2,560 x 0.05 = 128 USD

Same risk in EURUSD terms: a 4% fall from 1.0850 is about 434 pips,
a move EURUSD rarely makes in a month.
```

Because a normal day in crypto is a large day in FX, stops must be wider and lot sizes much smaller. Crypto symbols also typically carry lower maximum leverage than FX majors, and the margin shown in the order ticket reflects that.

> **Risk warning:** Crypto CFDs are leveraged and extremely volatile. Prices can fall 10% or more in hours, and during fast moves stops may be filled at significantly worse prices. Only risk an amount you can afford to lose.

## Market structure: 24/7 and fragmented

Crypto trades every hour of every day. There is no weekly close, so there is no Monday gap in the FX sense, but that does not mean smooth prices. At weekends and in the early Asian hours, many institutional participants are absent and order books are thinner. A large liquidation or a single headline can move the price sharply before liquidity returns.

Crypto is also traded across many exchanges worldwide, and heavily leveraged derivatives on those venues can create cascades: a fall triggers forced liquidations, which push prices lower and trigger more. These cascades explain many of the sudden wicks you see on crypto charts.

## Bitcoin and the altcoins

Bitcoin is the largest asset and usually sets the direction for the market. ETHUSD, SOLUSD and XRPUSD tend to follow, often with a higher beta: if bitcoin falls 5%, a smaller token might fall 8% or 10%. In strong rallies the reverse can happen. Holding several crypto positions at once is therefore rarely diversification; it is usually a larger bet on the same factor.

## Swap and holding costs

Because crypto trades seven days a week, Ezymex charges swap on crypto CFD positions every night at 00:00 server time, including Saturdays and Sundays. Crypto financing rates are often higher than on FX, so a position held for several weeks can accumulate a significant cost. Check the swap rates in the symbol specification before planning a long hold.

> **Example:** A trader holds 0.10 lot ETHUSD for 20 nights with an example swap of 1.50 USD per night on that volume. The financing cost is 20 x 1.50 = 30 USD, which must be recovered before the trade is profitable.

## Common mistakes

- Sizing crypto positions as if they were FX pairs, then being stopped out by ordinary daily movement.
- Assuming the halving or ETF approvals guarantee higher prices.
- Holding altcoins alongside bitcoin and believing the risk is spread out.
- Leaving positions open over the weekend without accounting for thin liquidity and nightly swap.
- Following social-media hype instead of a tested plan; the psychology chapters in this phase apply with extra force to crypto.
