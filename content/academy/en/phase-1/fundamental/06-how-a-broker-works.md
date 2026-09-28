---
slug: "p1-f-how-a-broker-works"
title: "How a broker works"
summary: "Where your broker's prices come from, how orders are executed, how brokers earn money and what protects your funds."
order: 6
version: 1
takeaways:
  - "A CFD broker gives you prices, executes your orders, holds your funds and manages margin, and is the counterparty to your contracts."
  - "Prices are built from quotes supplied by liquidity providers, then adjusted by the broker's pricing rules for each account group."
  - "Brokers earn mainly from spreads, commissions and swaps; comparing accounts means comparing total cost per trade, not the spread alone."
  - "Execution models range from passing trades to liquidity providers to internalising them; every model has costs and conflicts that regulation is meant to control."
  - "Regulation, segregation of client money and transparent execution policies are what you should check before depositing with any broker."
practice:
  label: "In the Client Area, open the Accounts page and compare the spread and commission details of the account types available to you, then check the contract specification of EURUSD in Kalks Trader."
  symbol: "EURUSD"
quiz:
  - question: "An account offers EURUSD with a 0.2-pip spread plus a 7 USD commission per lot round turn. What is the total cost of trading 1 lot, opening and closing once?"
    options:
      - "7 USD"
      - "2 USD"
      - "9 USD"
      - "14 USD"
    answer: 2
    explanation: "0.2 pip on 1 lot is 0.2 x 10 = 2 USD, and the round-turn commission is 7 USD, so the total is 9 USD. Round turn means the commission already covers both opening and closing."
  - question: "What is a liquidity provider?"
    options:
      - "A bank or market maker that supplies tradable prices to the broker"
      - "The regulator that supervises the broker"
      - "A payment company that processes deposits"
      - "Another retail client on the opposite side of your trade"
    answer: 0
    explanation: "Liquidity providers are banks and non-bank market makers that stream prices and accept trades. Brokers aggregate their quotes to build the prices you see."
  - question: "Why does segregation of client money matter?"
    options:
      - "It guarantees that client trades are profitable"
      - "It lets the broker use client money for its own trading"
      - "It removes the need for margin"
      - "It keeps client funds separate from the broker's own money, which helps protect them if the broker gets into difficulty"
    answer: 3
    explanation: "Segregation separates client funds from the firm's operating money. It is a protection against the broker's business risk, not against trading losses."
  - question: "Which statement about CFD execution models is most accurate?"
    options:
      - "Only one model is legal worldwide"
      - "In any model the broker is your counterparty, and it may hedge your trade with a liquidity provider or keep the risk internally"
      - "In any model your trade is placed directly on a stock exchange"
      - "Execution models have no effect on the client"
    answer: 1
    explanation: "Your CFD contract is with the broker. How the broker manages the resulting risk varies. Regulators require brokers to manage the conflicts of interest this creates and to execute fairly."
---

When you press Buy in Kalks Trader, a chain of events happens in a fraction of a second: a price is quoted, your order is checked against your margin, it is filled, and the resulting risk is managed somewhere. Understanding that chain helps you judge costs, read execution quality and ask the right questions of any broker.

## What a broker actually does

A CFD broker performs five jobs at once:

1. **Provides prices.** It streams bid and ask quotes for each symbol.
2. **Executes orders.** It fills your market orders and monitors your pending orders, stop losses and take profits.
3. **Acts as counterparty.** Your CFD is a contract with the broker, not with another trader or an exchange.
4. **Manages margin.** It calculates your used margin, margin level and, if necessary, triggers margin calls and stop-outs.
5. **Holds your funds.** It processes deposits and withdrawals, verifies your identity, and keeps your money according to its regulatory obligations.

On Kalks, the first four happen in Kalks Trader. Account management, funding, statements and trade history live in the Client Area.

## Where the prices come from

A broker does not invent prices. It receives streaming quotes from **liquidity providers**: large banks and non-bank market makers. A pricing engine aggregates these quotes, typically selecting the best available bid and ask, and then applies the pricing rules for each account group, such as a markup or a minimum spread.

```svg
<svg viewBox="0 0 640 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1" text-anchor="middle">
    <rect x="16" y="30" width="130" height="40" fill="none" stroke="#3a3a44"/>
    <text x="81" y="55">Liquidity provider A</text>
    <rect x="16" y="80" width="130" height="40" fill="none" stroke="#3a3a44"/>
    <text x="81" y="105">Liquidity provider B</text>
    <rect x="16" y="130" width="130" height="40" fill="none" stroke="#3a3a44"/>
    <text x="81" y="155">Liquidity provider C</text>
    <rect x="200" y="70" width="140" height="60" fill="none" stroke="#ff5a1f"/>
    <text x="270" y="95">Broker pricing and</text>
    <text x="270" y="112">risk engine</text>
    <rect x="394" y="70" width="100" height="60" fill="none" stroke="#3a3a44"/>
    <text x="444" y="95">Kalks Trader</text>
    <text x="444" y="112">bid / ask</text>
    <rect x="548" y="70" width="76" height="60" fill="none" stroke="#3a3a44"/>
    <text x="586" y="104">Client</text>
    <text x="320" y="22" font-size="13">Quotes flow right, orders flow left</text>
    <text x="518" y="160">orders</text>
  </g>
  <g stroke="#c9c9d1" fill="none">
    <line x1="146" y1="50" x2="200" y2="90"/>
    <line x1="146" y1="100" x2="200" y2="100"/>
    <line x1="146" y1="150" x2="200" y2="110"/>
    <line x1="340" y1="100" x2="394" y2="100"/>
    <line x1="494" y1="100" x2="548" y2="100"/>
    <path d="M548 145 L360 145 L340 125" stroke="#ff5a1f" stroke-dasharray="4 3"/>
  </g>
</svg>
```

This is why spreads vary. When liquidity providers widen their quotes, for example around a major release or at the daily rollover, the prices you see widen too. It is also why prices can differ very slightly between brokers.

## Execution models

Once you open a trade, the broker carries the opposite side of your contract. It can manage that exposure in different ways:

- **Pass-through (often called A-book or STP).** The broker hedges each trade, or aggregated client flow, with a liquidity provider and earns from spreads or commissions.
- **Internalisation (often called B-book or market making).** The broker keeps the risk on its own book, offsetting clients' opposing positions against each other.
- **Hybrid.** Most brokers combine the two, hedging some flow externally and internalising the rest according to risk limits.

Every model contains potential conflicts of interest. Regulators require brokers to manage those conflicts, to execute orders on fair terms, and to publish an execution policy. As a client, the practical indicators of fair execution are consistent spreads, slippage that occurs in both directions, and clear records of every fill in your trade history.

## How brokers earn money

A broker's main revenue sources are the **spread**, **commissions** and **swaps**. Account types package these differently, so compare total cost rather than headline spreads.

> **Example:** Account A quotes EURUSD at a 1.0-pip spread with no commission. Account B quotes a 0.2-pip spread plus 7 USD per lot round turn. On 1 lot, one pip is worth 10 USD.

```text
Account A:  1.0 pip x 10 USD             = 10.00 USD per round trip
Account B:  0.2 pip x 10 USD + 7.00 USD  =  9.00 USD per round trip
Difference per lot:                          1.00 USD in favour of B
Over 100 lots a month:                     100.00 USD
```

For a trader doing a few small trades, the difference is negligible. For a very active trader it adds up. Also check swaps if you hold positions overnight, and remember that cent accounts show balances in US cents (1 USD = 100 USC), which suits very small test sizes.

## What protects your money

Before funding any account, check three things:

- **Regulation.** Which authority supervises the broker, and what rules apply to leverage, reporting and client protection in that jurisdiction.
- **Client-money handling.** Whether client funds are held in segregated accounts, separate from the firm's own money. Segregation protects you against the broker's business problems, not against trading losses.
- **Transparency.** Published contract specifications, execution policy, risk disclosures and complete statements. In the Kalks Client Area, the Portfolio section keeps your trade history and statements.

Identity verification (KYC) is part of this protection. It is required by anti-money-laundering rules and is why withdrawals normally go back to the original funding method.

> **Risk warning:** No broker structure or regulation protects you from losses caused by your own leveraged trading. CFDs are high-risk products, and losses can exceed what you expected.

## Common mistakes

- **Choosing an account on spread alone.** Include commission and swaps in the comparison.
- **Blaming every loss on the broker.** Check the fill price, spread and time in your trade history before drawing conclusions.
- **Not reading the contract specification.** Contract size, trading hours, swap rates and maximum leverage differ per symbol.

Open a free demo account in Kalks Trader and review a few fills in your history to see exactly how your orders were priced.
