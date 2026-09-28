---
slug: "p6-f-flows-fixings-rebalancing"
title: "Flows: month-end, fixings and rebalancing"
summary: "How large, scheduled, non-speculative orders from funds, corporates and index trackers move prices at predictable times, and how to trade around them."
order: 6
version: 1
takeaways:
  - "Some of the largest orders in markets are driven by schedules and rules rather than views, such as benchmark fixings, month-end portfolio rebalancing and index changes."
  - "The WM/Reuters 4pm London fix is the main FX benchmark, and on Kalks server time it usually falls at 18:00."
  - "Rebalancing makes funds sell what has outperformed and buy what has underperformed, which can create counter-trend moves around month-end and quarter-end."
  - "Flow effects are real but noisy; the practical use is to avoid being surprised by erratic moves and wide spreads at known times."
quiz:
  - question: "A fund targets 60% equities and 40% bonds on a 100 billion portfolio. Over the month equities rise 5% and bonds fall 1%. Roughly how much equity must it sell to rebalance?"
    options:
      - "About 1.44 billion"
      - "About 0.6 billion"
      - "About 3.0 billion"
      - "Nothing, because the portfolio has grown"
    answer: 0
    explanation: "Equities become 63 and bonds 39.6, total 102.6. The equity target is 60% of 102.6 = 61.56, so it sells 63 - 61.56 = 1.44 billion of equities and buys the same amount of bonds."
  - question: "Why does the 4pm London fix matter to FX traders?"
    options:
      - "It is the moment when all FX spreads are set to zero"
      - "It is when swaps are charged"
      - "It is when central banks announce interest-rate decisions"
      - "Many funds and corporates execute at the fix rate, concentrating large orders into a short window"
    answer: 3
    explanation: "The fix is a benchmark used to value portfolios and execute client orders. Large orders are concentrated into the calculation window, which can cause sharp, short-lived moves. Swaps are charged at 00:00 server time, not at the fix."
  - question: "US equities have strongly outperformed other markets during the month. Foreign investors holding US stocks with currency hedges may need to do what near month-end?"
    options:
      - "Buy more US dollars to increase their hedges"
      - "Sell US dollars to increase their hedges because their US holdings are now larger"
      - "Close all hedges because stocks went up"
      - "Nothing, because hedges adjust automatically"
    answer: 1
    explanation: "A hedge sells the foreign currency forward. If the value of US holdings rises, the hedge must be topped up by selling more USD, which is why strong US equity months are often linked to month-end USD selling estimates."
  - question: "What is the most sensible way for a short-term trader to use flow knowledge?"
    options:
      - "Always trade in the direction of estimated month-end flows with full size"
      - "Ignore it completely because it is random"
      - "Be aware of the timing, avoid being caught by erratic moves, and use it as context rather than a signal"
      - "Place market orders exactly at the fix to get the best price"
    answer: 2
    explanation: "Flow estimates are uncertain and effects are often short-lived. Their main value is knowing when volatility and spreads may behave abnormally, and not mistaking a flow-driven move for new information."
---

Most of this phase is about how traders *feel* and how they are *positioned*. This chapter covers something different: orders that are placed not because anyone has a view, but because a rule, a calendar or a benchmark requires it. Pension funds rebalancing their portfolios, corporates paying for imports, index funds tracking a benchmark and asset managers valuing their holdings all trade on schedule. Because these orders are large and predictable in *timing*, they leave recognisable footprints in price.

## Benchmark fixings

A fixing is a reference price calculated at a set time each day and used to settle contracts, value portfolios and execute client orders. The most important ones for Kalks symbols are:

| Fixing | Time | Relevant symbols |
|---|---|---|
| WM/Reuters closing spot rates | 16:00 London | All major FX pairs |
| Tokyo fix | 09:55 Tokyo | USDJPY, other yen crosses |
| ECB euro reference rates | Early afternoon, Central European Time | EURUSD and euro crosses |
| LBMA Gold Price auctions | 10:30 and 15:00 London | XAUUSD |

The WM/Reuters 4pm rate is the dominant FX benchmark. Index providers use it to value global stock and bond indices, so any fund tracking those indices has an incentive to execute currency trades at exactly that rate. The rate is calculated from trades over a short window around 16:00 London time. Large orders concentrate into those minutes, and if they are unbalanced in one direction, price can jump and then drift back once the window closes.

> **In Kalks Trader:** Kalks server time is GMT+2 in winter and GMT+3 during US daylight saving, while London is GMT in winter and GMT+1 in summer. For most of the year, 16:00 London is therefore 18:00 server time. In the few weeks when the US and UK change clocks on different dates, the gap shifts by an hour, so check the conversion then.

```svg
<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" font-family="Inter, Arial, sans-serif">
  <rect width="100%" height="100%" fill="#121216"/>
  <text x="20" y="24" fill="#c9c9d1" font-size="14">EURUSD M1 around the 4pm London fix (illustrative)</text>
  <rect x="305" y="40" width="70" height="180" fill="#ff5a1f" fill-opacity="0.12"/>
  <text x="305" y="56" fill="#ff5a1f" font-size="12">Fix window</text>
  <line x1="60" y1="220" x2="620" y2="220" stroke="#3a3a44"/>
  <line x1="60" y1="40" x2="60" y2="220" stroke="#3a3a44"/>
  <polyline fill="none" stroke="#c9c9d1" stroke-width="2" points="60,150 100,148 140,152 180,145 220,147 260,142 290,138 305,135 320,110 340,90 365,80 385,92 420,118 460,130 500,134 540,136 580,138 620,137"/>
  <text x="400" y="80" fill="#22c55e" font-size="12">Burst of buying into the fix</text>
  <text x="440" y="160" fill="#c9c9d1" font-size="12">Partial fade after the window</text>
  <text x="20" y="80" fill="#c9c9d1" font-size="12">1.0870</text>
  <text x="20" y="150" fill="#c9c9d1" font-size="12">1.0855</text>
  <text x="80" y="244" fill="#c9c9d1" font-size="12">15:40</text>
  <text x="324" y="244" fill="#c9c9d1" font-size="12">16:00</text>
  <text x="560" y="244" fill="#c9c9d1" font-size="12">16:20 London</text>
</svg>
```

## Month-end and quarter-end rebalancing

Many institutional portfolios have fixed target weights: for example 60% equities and 40% bonds, or a fixed share of foreign assets. When markets move, the actual weights drift away from those targets, and funds trade back towards them, often in the last days of the month or quarter.

```text
Fund: 100bn, target 60% equities / 40% bonds

Start of month:  equities 60.0bn   bonds 40.0bn
Equities +5%:    equities 63.0bn
Bonds -1%:       bonds    39.6bn
New total:       102.6bn

Equity target = 60% x 102.6 = 61.56bn
Equities to sell = 63.00 - 61.56 = 1.44bn
Bonds to buy     = 41.04 - 39.60 = 1.44bn
```

Rebalancing is mechanically **counter-trend**: funds sell what has risen and buy what has fallen. Multiply this across trillions of dollars of assets and month-end can bring selling pressure in equity indices after a strong month, or buying after a weak one.

There is an FX angle too. Foreign investors who own US stocks often hedge the currency risk by selling USD forward. If US stocks rally hard during the month, the hedged holdings are larger, so the hedge must be topped up, meaning *more USD selling* around month-end. Banks publish estimates of these flows ahead of each month-end. They are rough and frequently wrong in size, but they explain some otherwise puzzling moves in the final days of the month, particularly around the 4pm fix on the last trading day.

## Index rebalancing and expiries

Equity index providers periodically change their constituents and weights. For the S&P 500, the regular quarterly rebalance takes effect after the close on the third Friday of March, June, September and December, which is also when quarterly index futures and options expire. Index funds must trade the changes at the closing price, so volumes in the US closing auction on those days are among the largest of the year. Single stocks being added to or removed from a major index, for example a large technology name, can move noticeably in the days around the change.

Options expiries themselves create flows, as dealers adjust their hedges. That is covered in the next chapter on options-market signals.

## Other scheduled flows

- **Corporate flows.** Exporters converting foreign revenue, importers paying suppliers, and multinationals repatriating profits, often clustered around month-end and fiscal year-end. Japan's fiscal year ends in March, which is often associated with yen repatriation talk.
- **Dividend and coupon flows.** Large dividend payments and bond coupons paid to foreign holders must often be converted.
- **Central bank and sovereign fund flows.** Reserve managers rebalance currency holdings, usually quietly and over time.

## Using flow knowledge

The honest assessment is that flow effects are real but noisy and short-lived. They are useful mainly as *risk awareness*:

- Know when the fixes fall in server time, and avoid tight stops just before 18:00 on month-end days.
- Do not mistake a flow-driven spike at the fix for new information. If nothing changed fundamentally, the move often partly reverses.
- Expect thinner liquidity and wider spreads around quarter-end and year-end, especially in the last two weeks of December.
- Treat published month-end flow estimates as context, not as a signal to trade with full size.

> **Risk warning:** Flow-driven moves are short and sharp, and spreads can widen during them. Trading into a fix with leverage can lead to slippage and losses larger than planned; flow estimates are never a guarantee of direction.

## Common mistakes

- **Reading too much into one fix.** A single spike at 16:00 London says little about the trend.
- **Forgetting the time zones.** London, New York and Kalks server time do not always move together.
- **Treating estimates as facts.** Bank flow models disagree with each other regularly.
