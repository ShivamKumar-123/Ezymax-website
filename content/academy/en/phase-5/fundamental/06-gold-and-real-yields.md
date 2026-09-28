---
slug: "p5-f-gold-and-real-yields"
title: "Gold and real yields"
summary: "Why gold has historically moved inversely to inflation-adjusted yields, what else drives it, and why the relationship can break for long periods."
order: 6
version: 1
takeaways:
  - "The real yield is the nominal yield minus expected inflation; it measures the true return on a safe, interest-paying alternative to gold."
  - "Because gold pays no interest, higher real yields raise the opportunity cost of holding it, which historically pushed gold lower, and vice versa."
  - "A stronger dollar is a second, separate headwind for gold because XAUUSD is priced in dollars."
  - "Central-bank buying, geopolitical risk and other demand can override the real-yield link for long periods, as happened from 2022 onwards."
practice:
  label: "Open XAUUSD on the daily timeframe on your demo account and mark the candles of the last two US CPI releases; note whether gold rose or fell and how the dollar moved on the same days."
  symbol: "XAUUSD"
quiz:
  - question: "The US 10-year nominal yield is 4.30% and 10-year breakeven inflation is 2.30%. What is the approximate 10-year real yield?"
    options:
      - "2.00%"
      - "6.60%"
      - "-2.00%"
      - "1.87%"
    answer: 0
    explanation: "Real yield is approximately nominal yield minus expected inflation: 4.30% - 2.30% = 2.00%. In practice it is observed directly in inflation-protected bond (TIPS) yields."
  - question: "Why do higher real yields tend to weigh on gold?"
    options:
      - "Because gold mines become more expensive to operate"
      - "Because gold pays no interest, so a higher inflation-adjusted return on safe bonds increases the cost of holding gold instead"
      - "Because central banks are forced to sell gold when yields rise"
      - "Because gold is priced in euros"
    answer: 1
    explanation: "This is the opportunity-cost argument. Holding gold means giving up the real return on safe assets; the higher that return, the less attractive gold becomes, all else equal."
  - question: "Nominal yields are unchanged, but inflation expectations rise by 0.30%. What happens to the real yield and the typical pressure on gold?"
    options:
      - "Real yield rises; gold tends to fall"
      - "Real yield falls; gold tends to fall"
      - "Real yield is unchanged; no effect"
      - "Real yield falls; gold tends to rise"
    answer: 3
    explanation: "Real yield = nominal - expected inflation, so it falls by 0.30%. Lower real yields reduce the opportunity cost of gold and are usually supportive."
  - question: "Gold rallied strongly during 2023 and 2024 even though US real yields were near their highest levels in over a decade. Which explanation is most widely cited?"
    options:
      - "Gold supply from mines fell by half"
      - "Real yields had become negative"
      - "Heavy buying by central banks and demand linked to geopolitical risk"
      - "The US dollar index fell to record lows"
    answer: 2
    explanation: "Record-level official-sector purchases and safe-haven demand overwhelmed the usual real-yield headwind. It shows that intermarket links are tendencies that can be overridden."
---

Gold is the most traded metal on most CFD platforms, and XAUUSD is among the most volatile symbols retail traders use. It does not pay interest or dividends and has no earnings to value, so traders need a different framework to understand it. The most useful single variable has historically been the **real yield**: the return on safe government bonds after inflation.

## Nominal and real yields

A nominal yield is the headline rate on a bond. A real yield subtracts expected inflation:

```text
Real yield ~ nominal yield - expected inflation

US 10-year nominal yield         4.30%
10-year breakeven inflation      2.30%
10-year real yield (approx.)     2.00%
```

Markets observe the real yield directly through inflation-protected government bonds, such as US Treasury Inflation-Protected Securities (TIPS). The gap between the ordinary 10-year yield and the 10-year TIPS yield is called the **breakeven inflation rate**: the average inflation that would make both bonds deliver the same return.

## The opportunity-cost link

An investor choosing between gold and a safe bond compares what each offers. Gold offers protection against currency debasement, crises and inflation, but no income. The bond offers income. If that bond pays a real return of 2% a year, holding gold instead has a clear cost. If the real return is -1%, cash and bonds lose purchasing power and gold looks relatively attractive.

That is why, for much of the period from the mid-2000s to 2021, gold tended to rise when real yields fell and to fall when they rose.

```svg
<svg viewBox="0 0 640 330" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <text x="20" y="28" font-size="14">Stylised relationship (illustrative, not real data)</text>
    <line x1="70" y1="270" x2="600" y2="270" stroke="#3a3a44"/>
    <line x1="70" y1="50" x2="70" y2="270" stroke="#3a3a44"/>
    <text x="150" y="300">Time</text>
    <text x="14" y="160">Level</text>
    <polyline points="80,90 150,110 220,150 290,200 360,230 430,190 500,140 580,100" fill="none" stroke="#ef4444" stroke-width="2.5"/>
    <polyline points="80,230 150,210 220,170 290,120 360,90 430,130 500,180 580,215" fill="none" stroke="#22c55e" stroke-width="2.5"/>
    <rect x="400" y="46" width="12" height="4" fill="#ef4444"/>
    <text x="418" y="52">Real yield (falling = supportive)</text>
    <rect x="400" y="64" width="12" height="4" fill="#22c55e"/>
    <text x="418" y="70">Gold price</text>
    <line x1="360" y1="60" x2="360" y2="270" stroke="#ff5a1f" stroke-dasharray="4 4"/>
    <text x="300" y="290" fill="#ff5a1f">Real yields turn up</text>
  </g>
</svg>
```

Real yields change through two channels, and both matter:

| Change | Real yield | Typical gold pressure |
|---|---|---|
| Nominal yields rise, inflation expectations flat | Up | Down |
| Nominal yields flat, inflation expectations rise | Down | Up |
| Central bank hikes more than expected | Up | Down |
| Central bank signals cuts | Down | Up |

## The dollar channel

Gold is priced in dollars, so a stronger dollar makes it more expensive for buyers using euros, rupees or yuan and tends to lower the dollar price. The dollar and real yields often move together, because a hawkish Fed lifts both, which is why hawkish surprises can hit gold twice.

> **Example:** US CPI prints at 0.4% month on month against a 0.2% consensus. The 2-year yield rises 15 bp, the 10-year real yield rises 10 bp and EURUSD falls from 1.0850 to 1.0800. XAUUSD drops from 2,350.40 to 2,318.40, a fall of $32.00. On one standard lot of 100 oz that is a $3,200 move; on 0.05 lots it is $160. The same headline hit gold through both real yields and the dollar.

## When the link breaks

From 2022 US real yields climbed from deeply negative to around 2%, the highest in over a decade. On the opportunity-cost model gold should have fallen substantially. Instead it held up and then rallied to repeated record highs in 2024. The most widely cited reasons:

- **Central-bank buying.** Official purchases ran at record levels, with several emerging-market central banks diversifying reserves away from the dollar.
- **Geopolitical demand.** Wars and sanctions increased demand for an asset outside the banking system.
- **Strong demand in Asia.** Investment and jewellery demand from China and India added support.

The lesson is general: an intermarket relationship is a tendency that holds while other drivers are quiet. When a large, persistent new buyer arrives, the old model can be wrong for years. Watch real yields and the dollar as short-term drivers of gold's reaction to news, but do not assume they set its long-run direction.

## In practice

1. On US data days, expect XAUUSD to react to the change in yields and the dollar within seconds of the release.
2. Treat silver (XAGUSD) as gold with extra industrial sensitivity; it usually moves further in percentage terms.
3. Remember gold's size: at 2,350 a move of $10 is under 0.5% but is $1,000 per standard lot. Position sizing for gold is covered in the technical chapters of this phase.

Common mistakes: treating gold as a guaranteed crisis hedge (it can fall in the first phase of a liquidity panic as investors sell whatever they can), and assuming "inflation up means gold up" when the central bank is responding with rapid hikes that lift real yields.

> **Risk warning:** XAUUSD can move tens of dollars in minutes around US data. CFDs are leveraged, and slippage around releases can make losses larger than planned.
