---
slug: "p2-f-spreads-commissions-and-swaps"
title: "Trading costs: spreads, commissions and swaps"
summary: "The three costs of holding a CFD position, how to calculate each one in money, and when they tend to be highest."
order: 5
version: 1
takeaways:
  - "You buy at the ask and sell at the bid, so every new position starts at a loss equal to the spread."
  - "Spread cost equals spread in pips x pip value; commission, where charged, is quoted per lot round turn."
  - "Swaps are charged or paid at 00:00 server time, tripled on Wednesday for FX and metals and on Friday for indices, energies and stocks, and applied every night on crypto."
  - "Spreads usually widen around rollover, major news and market opens, so costs are not constant through the day."
practice:
  label: "Open the contract specification for EURUSD and XAUUSD in Ezymex Trader and note the current spread and the swap long and swap short values."
  symbol: "EURUSD"
quiz:
  - question: "EURUSD is quoted 1.0850 / 1.0851. You buy 0.30 lot. What is the spread cost?"
    options:
      - "0.30 USD"
      - "30.00 USD"
      - "3.00 USD"
      - "10.00 USD"
    answer: 2
    explanation: "The spread is 1 pip and 0.30 lot is worth 3 USD per pip, so the cost is 1 x 3 = 3 USD."
  - question: "A position is held from Monday to Friday on EURUSD. On which night is the swap normally tripled?"
    options:
      - "Wednesday night"
      - "Friday night"
      - "Monday night"
      - "Every night"
    answer: 0
    explanation: "For FX and metals the triple swap is applied on Wednesday night to cover the weekend. Friday is the triple day for indices, energies and stocks."
  - question: "Commission is 7 USD per lot round turn. What is the commission on a 0.40 lot trade that is opened and closed?"
    options:
      - "7.00 USD"
      - "2.80 USD"
      - "5.60 USD"
      - "1.40 USD"
    answer: 1
    explanation: "Round turn means opening and closing combined. 0.40 x 7 = 2.80 USD in total."
  - question: "Why can a short position be stopped out even though the bid price on the chart never reached the stop?"
    options:
      - "Stops on short positions trigger on the bid"
      - "The swap was deducted from the stop level"
      - "Stops never trigger on the chart price"
      - "A short position is closed at the ask, so a widening spread can lift the ask to the stop"
    answer: 3
    explanation: "A short is closed by buying, at the ask. If the spread widens, for example at rollover, the ask can touch the stop while the bid shown on the chart stays below it."
---

Every trade has a price of admission. On Ezymex it comes in up to three forms: the **spread**, a **commission** on some account types, and a **swap** for positions held overnight. None of them is large on a single trade, but together, repeated over hundreds of trades, they decide whether a strategy that looks profitable on a chart actually makes money.

## Bid, ask and the spread

Each symbol has two prices. The **bid** is the price at which you can sell; the **ask** is the price at which you can buy. The ask is always higher, and the gap between them is the spread.

```svg
<svg viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <line x1="40" y1="70" x2="400" y2="70" stroke="#22c55e" stroke-width="2"/>
  <text x="410" y="74" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="13">Ask 1.0851: you buy here</text>
  <line x1="40" y1="130" x2="400" y2="130" stroke="#ef4444" stroke-width="2"/>
  <text x="410" y="134" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="13">Bid 1.0850: you sell here</text>
  <line x1="220" y1="74" x2="220" y2="126" stroke="#ff5a1f" stroke-width="2"/>
  <line x1="212" y1="74" x2="228" y2="74" stroke="#ff5a1f" stroke-width="2"/>
  <line x1="212" y1="126" x2="228" y2="126" stroke="#ff5a1f" stroke-width="2"/>
  <text x="236" y="104" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="13">Spread = 1 pip</text>
  <text x="40" y="30" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="14">EURUSD quote</text>
  <text x="40" y="175" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Long: open at ask, close at bid. Short: open at bid, close at ask.</text>
</svg>
```

Because you buy at the ask and would sell at the bid, a new long position shows an immediate loss equal to the spread. A short position opens at the bid and must be closed at the ask, with the same effect. The market has to move by the spread in your favour just for you to break even.

```text
spread cost = spread (in pips or points) x pip or point value x lots

EURUSD 1.0850 / 1.0851, 0.20 lot:        1 pip  x 2.00 USD   = 2.00 USD
XAUUSD 2,350.40 / 2,350.60, 0.10 lot:    0.20   x 10 oz      = 2.00 USD
US30 39,200 / 39,202, 1 lot (1 USD/pt):  2 pts  x 1.00 USD   = 2.00 USD
```

Spreads on Ezymex vary by account group and by market conditions. They are usually tightest when the main sessions overlap and widest around the daily rollover at 00:00 server time, during high-impact news and at the weekly open. This also matters for stops: a short position's stop is triggered by the ask, so a spike in the spread can trigger it even though the bid line on the chart never reached it.

## Commission

Some account types charge a commission in exchange for tighter raw spreads. It is quoted **per lot, round turn**, meaning the total for opening and closing. At 7 USD per lot round turn, 3.50 USD is typically charged when you open and 3.50 USD when you close, pro rata for smaller sizes.

> **Example:** 0.20 lot EURUSD on a commission account with a 1-pip spread. Spread cost 2.00 USD, commission 0.20 x 7 = 1.40 USD, total 3.40 USD. With a pip value of 2 USD, the trade needs to move 3.40 / 2 = 1.7 pips in your favour just to cover costs.

Comparing account types means comparing the total: spread plus commission. Suppose one account offers a 1.2-pip spread with no commission and another a 0.2-pip spread plus 7 USD per lot. On EURUSD, where a lot is worth 10 USD per pip, 7 USD is 0.7 pip, so the second account costs 0.2 + 0.7 = 0.9 pip per round turn, cheaper than 1.2 pips.

## Swaps: the cost of holding overnight

A CFD position held past **00:00 server time** is rolled over to the next day, and a **swap** is credited or debited. For currency pairs it reflects the interest-rate difference between the two currencies plus a broker markup; for indices, energies and stocks it is usually a financing rate on the notional value. Swap long and swap short differ, and either can be negative.

The schedule matters:

- **FX and metals:** triple swap on Wednesday night, because the value date rolls over the weekend.
- **Indices, energies and stocks:** triple swap on Friday night.
- **Crypto:** charged every night, including Saturday and Sunday, since it trades around the clock.

```text
EURUSD long, swap -7.20 USD per lot per night (illustrative), 0.50 lot = -3.60 per night
Open Monday, close Friday:
  Mon night x1, Tue night x1, Wed night x3, Thu night x1 = 6 charges
  6 x -3.60 = -21.60 USD

US30 long 1 lot at 39,200 (1 USD per point), financing 5.5% a year, 360-day basis
  39,200 x 0.055 / 360 = 5.99 USD per night; Friday night x3 = 17.97 USD
```

Current swap values are shown in each symbol's contract specification in Ezymex Trader. **Swap-free accounts** exist for clients who cannot pay or receive overnight interest; they may carry other conditions, so check the account terms.

## In practice

- For short-term trades the spread dominates; for trades held for weeks, swaps can outweigh everything else.
- Avoid opening positions in the minutes around rollover, when spreads are often at their widest.
- Include costs when judging a strategy. A system that averages 2 pips per trade gross may be losing money after 1.7 pips of costs.
- Do not choose a trade direction just to earn a positive swap. A small daily credit is easily erased by a single adverse move.
