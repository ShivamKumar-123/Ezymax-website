---
slug: "p7-f-crude-oil"
title: "Crude oil"
summary: "How supply decisions, inventories and the futures curve drive USOIL and UKOIL, and what that means for a CFD trader."
order: 3
version: 1
takeaways:
  - "Oil prices balance supply decisions (OPEC+, US shale) against demand that follows global growth."
  - "The weekly US inventory reports are the most regular scheduled catalysts for USOIL and can move it sharply in seconds."
  - "WTI (USOIL) and Brent (UKOIL) track different benchmarks, and the spread between them reflects location, quality and transport."
  - "The shape of the futures curve, contango or backwardation, affects the cost of holding oil CFDs that follow futures."
  - "Oil is a headline-driven market, so position sizes should allow for sudden geopolitical moves."
practice:
  label: "On your demo account, mark the time of the next weekly US crude inventory report on a USOIL M5 chart and observe the spread and candle range around the release without trading."
  symbol: "USOIL"
quiz:
  - question: "What is the difference between WTI and Brent?"
    options:
      - "WTI is a US benchmark delivered inland at Cushing, Oklahoma; Brent is a North Sea waterborne benchmark"
      - "Brent is refined petrol and WTI is crude oil"
      - "WTI is always more expensive than Brent"
      - "They are the same oil quoted in different currencies"
    answer: 0
    explanation: "Both are crude benchmarks priced in USD. WTI is delivered at Cushing, while Brent is seaborne and used to price much of the world's oil. Brent usually trades at a premium, not a discount."
  - question: "The futures curve is in contango. What does that mean?"
    options:
      - "Near-dated contracts are priced above later ones"
      - "The market is closed for rollover"
      - "Later-dated contracts are priced above near-dated ones"
      - "OPEC+ has cut output"
    answer: 2
    explanation: "Contango means deferred contracts trade above the front month, usually when supply is ample and storage costs are paid. Near-dated above later-dated is backwardation."
  - question: "On an example contract of 1,000 barrels per lot, a trader buys 0.30 lot USOIL at 78.40 and closes at 79.65. What is the gross profit?"
    options:
      - "125 USD"
      - "1,250 USD"
      - "37.50 USD"
      - "375 USD"
    answer: 3
    explanation: "The move is 1.25 USD per barrel. 1.25 x 1,000 x 0.30 = 375 USD. 1,250 USD would be the result for a full lot."
  - question: "Crude inventories fall far more than expected in the weekly report. What is the usual first reaction?"
    options:
      - "Oil tends to rise because supply is tighter than expected"
      - "Oil tends to fall because demand is weak"
      - "No reaction, because only OPEC+ matters"
      - "The Canadian dollar weakens"
    answer: 0
    explanation: "A larger-than-expected draw signals tighter supply, which is usually bullish for oil. A tighter oil market tends to support, not weaken, the Canadian dollar."
---

Crude oil is the world's most important commodity and one of the most headline-driven markets you can trade. On Ezymex it is available as USOIL, tracking West Texas Intermediate (WTI), and UKOIL, tracking Brent. Both are quoted in US dollars per barrel. This chapter explains what moves them and the practical details that separate oil from currency trading.

## Supply: OPEC+ and US shale

On the supply side, the most influential group is **OPEC+**, the Organization of the Petroleum Exporting Countries plus allies including Russia. The group sets production targets at regular meetings, and announcements of cuts or increases can move prices by several percent. Markets also watch compliance: whether members actually produce what they promised.

The second major supplier is **US shale**. Shale producers respond to prices within months rather than years, so high prices tend to attract more drilling and extra supply, which can cap rallies. The weekly count of active drilling rigs is one indicator traders use to track this.

Supply can also be disrupted suddenly by conflict, sanctions, hurricanes in the Gulf of Mexico or pipeline outages. These events are unscheduled, which is why oil can gap at the weekly open.

## Demand and the growth cycle

Demand follows economic activity: transport, manufacturing and petrochemicals. China is the largest importer and a key swing factor, so Chinese PMI and trade data matter. In recessions demand falls quickly, and in 2020 the collapse was so severe that the front-month WTI futures contract briefly settled below zero because storage ran out. That episode is a reminder that commodity prices can do things that seem impossible.

Oil also links to currencies. Oil exporters such as Canada benefit when prices rise, so USDCAD often falls when oil rallies. For importers, higher oil feeds into inflation and can shift central-bank expectations.

## Inventories: the weekly catalyst

The most regular scheduled event is the US Energy Information Administration (EIA) weekly petroleum status report, released on Wednesdays at 10:30 New York time (17:30 server time in summer), with an industry estimate from the American Petroleum Institute the previous evening. The market compares the change in crude stocks with the consensus forecast.

- A **larger draw** than expected (stocks falling more) suggests tight supply and is usually bullish.
- A **larger build** than expected suggests weak demand or ample supply and is usually bearish.

Gasoline and distillate stocks and refinery utilisation are also watched. Spreads can widen for a short time around the release, as with any news event.

```text
Example contract: 1,000 barrels per lot (check the contract specification
in Ezymex Trader for USOIL and UKOIL)

Buy 0.20 lot USOIL at 78.40 before the inventory report
Surprise build, price drops to 76.90
Loss = (78.40 - 76.90) x 1,000 x 0.20 = 1.50 x 200 = 300 USD
```

> **Risk warning:** Oil CFDs are leveraged and can move 2% to 5% in a single day on OPEC+ decisions or geopolitical news. Weekend gaps can fill stops far from their level. Size positions for the move you cannot predict, not only the one you expect.

## WTI, Brent and the spread

WTI is delivered at Cushing, Oklahoma, an inland hub. Brent is a seaborne North Sea blend and serves as the reference for much of the world's traded oil. Brent usually trades at a premium to WTI, reflecting transport costs and global demand. With UKOIL at 82.60 and USOIL at 78.40, the Brent-WTI spread is 4.20 USD. Changes in that spread can reflect US pipeline bottlenecks, export flows or Middle East risk that affects seaborne supply more than US inland supply.

## The futures curve: contango and backwardation

Oil is traded mainly through futures with monthly expiries. The prices of successive contracts form a **futures curve**.

```svg
<svg viewBox="0 0 520 270" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <line x1="60" y1="30" x2="60" y2="220" stroke="#3a3a44"/>
    <line x1="60" y1="220" x2="490" y2="220" stroke="#3a3a44"/>
    <text x="20" y="130" transform="rotate(-90 20 130)" text-anchor="middle">Price (USD/bbl)</text>
    <text x="275" y="255" text-anchor="middle">Contract month (front to later)</text>
    <text x="90" y="238" text-anchor="middle">M1</text>
    <text x="190" y="238" text-anchor="middle">M2</text>
    <text x="290" y="238" text-anchor="middle">M3</text>
    <text x="390" y="238" text-anchor="middle">M4</text>
    <text x="470" y="238" text-anchor="middle">M5</text>
    <polyline points="90,150 190,130 290,115 390,103 470,95" fill="none" stroke="#22c55e" stroke-width="2.5"/>
    <polyline points="90,70 190,95 290,115 390,132 470,142" fill="none" stroke="#ef4444" stroke-width="2.5"/>
    <text x="100" y="52" fill="#ef4444">Backwardation: front month above later months</text>
    <text x="100" y="185" fill="#22c55e">Contango: front month below later months</text>
  </g>
</svg>
```

In **contango**, later contracts are more expensive than the front month. This usually happens when supply is plentiful and holders must pay for storage. In **backwardation**, the front month is more expensive, a sign of a tight market where buyers pay up for immediate barrels.

Oil CFDs that follow futures must roll from one contract to the next before expiry. Because the two contracts trade at different prices, the rollover is usually handled with a price or balance adjustment so that your profit or loss is not distorted by the jump itself. Holding oil for many weeks in steep contango can still be costly through financing and roll effects, so check the contract specification and swap rates in Ezymex Trader before holding oil positions for long periods.

## Common mistakes

- Trading through the Wednesday inventory report without knowing it is scheduled.
- Assuming a chart gap at rollover is a trading signal, when it may simply reflect the switch to a new contract.
- Using the same lot size on USOIL as on EURUSD without checking the value per point.
- Ignoring OPEC+ meeting dates, which can reprice the market over a weekend.
