---
slug: "p8-f-monetary-cycles-qe-qt"
title: "Monetary cycles: rates, QE and QT"
summary: "Understand hiking and easing cycles, how quantitative easing and tightening work, and how markets price the path of policy long before it happens."
order: 3
version: 1
takeaways:
  - "Monetary cycles move in multi-year phases, and markets trade the expected path of rates rather than the current level."
  - "Quantitative easing expands central bank balance sheets and compresses longer-term yields; quantitative tightening does the reverse, more slowly and less predictably."
  - "Relative monetary cycles between two central banks are one of the most powerful long-term drivers of currency pairs."
  - "Interest rate futures let you read how many cuts or hikes are already priced, which tells you what counts as a surprise."
quiz:
  - question: "The policy rate midpoint is 4.375% and a futures contract for a meeting six months ahead is priced at 96.10. Roughly how much easing is priced?"
    options:
      - "About 47.5 basis points"
      - "About 3.90 percentage points"
      - "About 96 basis points"
      - "No easing is priced"
    answer: 0
    explanation: "Implied rate = 100 - 96.10 = 3.90%. The difference from 4.375% is 0.475 percentage points, or about 47.5 basis points, close to two 25bp cuts."
  - question: "How does quantitative easing mainly lower long-term yields?"
    options:
      - "By raising the policy rate"
      - "By buying bonds, which reduces the supply available to investors and lowers the term premium"
      - "By selling gold reserves"
      - "By directly lending to retail traders"
    answer: 1
    explanation: "Large-scale purchases remove duration from the market and signal that rates will stay low, which compresses the extra yield investors demand for holding long bonds."
  - question: "Two central banks: one has just started hiking, the other is near the end of a cutting cycle. What is the usual long-term effect on the currency pair?"
    options:
      - "No effect, because only current rates matter"
      - "The currency of the cutting central bank tends to strengthen"
      - "The currency of the hiking central bank tends to be supported as the rate differential widens"
      - "Both currencies always weaken against gold"
    answer: 2
    explanation: "A widening expected rate differential attracts capital and carry demand towards the higher-yielding currency, though other factors such as risk appetite can override it."
  - question: "Why is the start of a cutting cycle not automatically bullish for equity indices?"
    options:
      - "Because cuts always raise inflation immediately"
      - "Because futures cannot price cuts"
      - "Because index CFDs are closed during cutting cycles"
      - "Because cuts often happen in response to a weakening economy, which can hurt earnings"
    answer: 3
    explanation: "Cuts made to insure against a slowdown have often been followed by rising stocks, but cuts made because recession has arrived have often come with falling indices. The reason for the cut matters."
---

Central banks do not change policy randomly. They move in cycles: a run of hikes to fight inflation, a pause, and a run of cuts as the economy weakens. Since 2008 there has been a second dimension, the size of the central bank balance sheet. Understanding where each major central bank sits in both cycles gives you the backbone of any long-term view on currencies, bonds, gold and indices.

## The rate cycle

A typical cycle has four stages:

1. **Easing:** rates cut towards or below neutral to support a weakening economy.
2. **Low for long:** rates held low while the recovery builds.
3. **Tightening:** a series of hikes as inflation and employment pick up.
4. **Hold:** rates held at a restrictive level until inflation is under control.

Monetary policy works with long and variable lags, often estimated at twelve to twenty-four months for the full effect on inflation. That is why central banks tend to overshoot in both directions, and why the peak of the rate cycle frequently arrives close to the start of an economic slowdown.

## Markets trade the expected path

The level of the policy rate today is already in prices. What moves markets is a change in the **expected path**. Short-term interest rate futures and overnight index swaps show that path.

```text
Current policy range         4.25% - 4.50%  (midpoint 4.375%)
Futures price, 6 months out  96.10
Implied rate                 100 - 96.10 = 3.90%
Easing priced                4.375% - 3.90% = 0.475% = 47.5 bp
In 25 bp moves               47.5 / 25 = 1.9 cuts
```

If the central bank then signals three cuts, that is a dovish surprise relative to the roughly two already priced, and the currency tends to weaken. If it signals only one, the currency tends to strengthen even though the central bank is cutting. The two-year government yield tracks this expected path closely and is one of the best single indicators of a currency's policy outlook.

## Quantitative easing and tightening

When policy rates approach zero, central banks can ease further by buying government bonds and other securities with newly created reserves. This is quantitative easing (QE). It works through several channels: it removes long-dated bonds from the market so investors move into riskier assets, it lowers the term premium on long yields, and it signals that rates will stay low for a long time.

Quantitative tightening (QT) reverses the process. Usually the central bank lets bonds mature without reinvesting the proceeds rather than selling them. The balance sheet shrinks, reserves fall and more duration has to be absorbed by private investors.

```svg
<svg viewBox="0 0 560 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <line x1="60" y1="250" x2="530" y2="250" stroke="#3a3a44" stroke-width="1.5"/>
  <line x1="60" y1="30" x2="60" y2="250" stroke="#3a3a44" stroke-width="1.5"/>
  <text x="20" y="40" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Size</text>
  <text x="470" y="270" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Time</text>
  <polyline points="60,230 110,228 130,180 200,160 240,140 280,142 310,150 340,100 370,60 400,58 430,80 470,110 510,118" fill="none" stroke="#ff5a1f" stroke-width="3"/>
  <text x="100" y="170" fill="#22c55e" font-family="Inter, Arial, sans-serif" font-size="12">QE rounds</text>
  <text x="270" y="170" fill="#ef4444" font-family="Inter, Arial, sans-serif" font-size="12">QT</text>
  <text x="330" y="50" fill="#22c55e" font-family="Inter, Arial, sans-serif" font-size="12">Crisis QE</text>
  <text x="440" y="70" fill="#ef4444" font-family="Inter, Arial, sans-serif" font-size="12">QT</text>
  <text x="60" y="290" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Schematic central bank balance sheet: fast expansions in crises, slow partial reductions afterwards</text>
</svg>
```

The pattern above is schematic but matches the broad history of the Federal Reserve: expansion after 2008, a modest QT from 2017 to 2019, a very rapid expansion from roughly 4 trillion to nearly 9 trillion dollars in 2020 to 2022, then a multi-year QT that removed more than 2 trillion before the pace was slowed and then stopped. Balance sheets expand quickly in emergencies and shrink slowly, because tightening too fast can drain liquidity from funding markets.

For traders, QE periods have generally coincided with compressed volatility, strong equity markets and weaker currencies for the issuing central bank. QT periods have been associated with higher term premiums and occasional stress in funding markets, as in September 2019. These are tendencies with many exceptions.

## Relative cycles drive currencies

Currencies are relative prices, so the useful question is how one central bank's cycle compares with another's.

> **Example:** The US two-year yield is 4.00% and the Japanese two-year yield is 0.80%, a differential of 3.20 percentage points in favour of the dollar. Over the following year the Fed cuts by 1.00 point while the Bank of Japan hikes by 0.50 point. If two-year yields follow policy, the differential narrows to about 3.00 - 1.30 = 1.70 points. A narrowing of 1.50 points removes much of the carry incentive to hold long USDJPY, and historically such narrowing has tended to coincide with a lower USDJPY, sometimes abruptly as carry positions are unwound.

Similar logic applies to EURUSD (ECB versus Fed), GBPUSD (Bank of England versus Fed) and commodity currencies, where the Reserve Bank of Australia and Bank of Canada cycles interact with commodity prices.

## Common mistakes

- **Assuming cuts are always bullish for stocks.** Insurance cuts in a healthy economy differ from emergency cuts in a recession.
- **Trading the decision instead of the surprise.** Compare the outcome with futures pricing, not with the previous rate.
- **Ignoring the balance sheet.** A central bank can hold rates while tightening through QT.
- **Forgetting lags.** The effect of hikes made a year ago may only now be reaching the labour market.

> **Risk warning:** Central bank decision days can produce large gaps and spread widening in FX, gold and indices. Leveraged CFD positions held through them can lose more than a normal day's range.
