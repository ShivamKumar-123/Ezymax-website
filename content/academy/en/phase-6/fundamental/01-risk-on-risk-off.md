---
slug: "p6-f-risk-on-risk-off"
title: "Risk-on and risk-off"
summary: "How global risk appetite pushes many markets in the same direction at once, and how to recognise which regime you are trading in."
order: 1
version: 1
takeaways:
  - "Risk-on and risk-off describe a shared mood that moves many assets together, often overriding each asset's own news for days or weeks."
  - "In risk-off phases equity indices, commodity currencies, oil and crypto tend to fall while the Japanese yen, Swiss franc, US dollar and often gold tend to rise."
  - "You can read the regime from a small dashboard of cross-asset moves rather than from any single market."
  - "When the regime is strong, positions that look diversified can behave like one large bet, so total exposure must be measured across the whole book."
practice:
  label: "On your demo account, open NAS100, AUDUSD, USDJPY and XAUUSD on the H1 chart and note which direction each moved during the last big equity sell-off."
  symbol: "NAS100"
quiz:
  - question: "On a sharp risk-off day, which move in USDJPY is most typical?"
    options:
      - "USDJPY rises because investors buy dollars and sell yen for higher yield"
      - "USDJPY always rises by the same percentage that NAS100 falls"
      - "USDJPY does not move because both currencies are safe havens"
      - "USDJPY falls because the yen tends to strengthen as carry positions are closed"
    answer: 3
    explanation: "The yen is a funding currency for carry trades; when risk appetite drops, those trades are unwound and yen is bought back, so USDJPY usually falls. The dollar can also be bid, but the yen effect normally dominates in this pair."
  - question: "Why is a portfolio of long NAS100, long AUDUSD and long BTCUSD not truly diversified?"
    options:
      - "Because all three tend to fall together when risk appetite drops"
      - "Because all three have the same contract size"
      - "Because all three are quoted in US dollars"
      - "Because they trade in different sessions"
    answer: 0
    explanation: "All three are risk-on assets. In a risk-off move their correlation rises and they tend to lose together, so the book behaves like one bigger position. Quoting currency is not the problem."
  - question: "Which is the most reliable way to judge the current risk regime?"
    options:
      - "Watch a single stock that you know well"
      - "Look only at the latest headline on the news feed"
      - "Check whether several risk-sensitive and safe-haven markets are confirming the same story"
      - "Use the colour of today's first H1 candle on EURUSD"
    answer: 2
    explanation: "Regimes are cross-asset by definition. When equities, commodity currencies, the yen, volatility and bonds all tell the same story, the signal is much stronger than any one market or headline."
  - question: "Gold during a risk-off episode is best described as:"
    options:
      - "Always rising, without exception"
      - "Often supported as a haven, but it can be sold early in a panic when traders raise cash"
      - "Always falling because it is a commodity"
      - "Unrelated to risk sentiment in any circumstance"
    answer: 1
    explanation: "Gold is often bought in stress, but in acute liquidations traders sometimes sell winners like gold to cover margin elsewhere. That is why gold is a less consistent haven than the yen."
---

Most of the time, each market has its own story: a central bank decision for a currency, an earnings report for a stock, an inventory figure for oil. But there are periods when one question dominates everything else: *do investors want more risk or less?* In those periods, dozens of markets move together, and the individual stories fade into the background. Traders call this the **risk-on / risk-off** regime.

Understanding it matters because it changes how your positions behave. Trades that look unrelated on paper can win or lose together, and a correct analysis of one market can still lose money if the whole market mood turns against it.

## What drives risk appetite

Risk appetite is the collective willingness of investors to hold assets whose value depends on growth, earnings and easy financing. It rises when growth looks solid, inflation is under control, central banks are not tightening aggressively, and volatility is low. It falls when something threatens those conditions: a banking scare, a geopolitical shock, a sudden jump in yields, a recession signal or a disorderly move in a major currency.

The mechanism is partly psychological and partly mechanical. Many large funds size positions according to recent volatility. When volatility rises, their models tell them to cut exposure, so they sell whatever they hold, regardless of the individual asset. Leveraged traders facing margin calls do the same. This forced, indiscriminate selling is why correlations between risk assets rise sharply in a sell-off.

## Who wins and who loses

The typical pattern is consistent enough to memorise, though never guaranteed.

| Tends to rise in risk-on | Tends to rise in risk-off |
|---|---|
| Equity indices: NAS100, SPX500, US30, GER40 | Japanese yen (USDJPY, EURJPY, GBPJPY fall) |
| Commodity currencies: AUD, and often CAD | Swiss franc (USDCHF tends to fall) |
| Crude oil: USOIL, UKOIL | US dollar against most other currencies |
| Crypto: BTCUSD, ETHUSD, SOLUSD | Government bonds (yields fall) |
| High-beta stocks such as TSLA and NVDA | Gold, although less consistently |

The yen and franc are havens partly because Japan and Switzerland are large net creditors: in stress, their investors bring money home. The yen is also the classic funding currency for carry trades, which you will study later in this phase, so a risk-off move forces carry traders to buy yen back.

The dollar is special. It is the world's main funding and reserve currency, so in acute stress there is a scramble for dollars and it usually rises. But if the stress originates in the US itself, for example a US growth scare that makes markets expect Fed rate cuts, the dollar can fall against the yen and franc while still rising against the Australian dollar.

```svg
<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" font-family="Inter, Arial, sans-serif">
  <rect width="100%" height="100%" fill="#121216"/>
  <text x="20" y="28" fill="#c9c9d1" font-size="14">Illustrative moves on a single risk-off day (%)</text>
  <line x1="360" y1="45" x2="360" y2="270" stroke="#3a3a44" stroke-width="1"/>
  <text x="352" y="288" fill="#c9c9d1" font-size="12">0</text>
  <text x="20" y="68" fill="#c9c9d1" font-size="13">BTCUSD</text>
  <rect x="200" y="56" width="160" height="16" fill="#ef4444"/>
  <text x="160" y="69" fill="#c9c9d1" font-size="12">-4.0</text>
  <text x="20" y="98" fill="#c9c9d1" font-size="13">NAS100</text>
  <rect x="264" y="86" width="96" height="16" fill="#ef4444"/>
  <text x="224" y="99" fill="#c9c9d1" font-size="12">-2.4</text>
  <text x="20" y="128" fill="#c9c9d1" font-size="13">USOIL</text>
  <rect x="280" y="116" width="80" height="16" fill="#ef4444"/>
  <text x="240" y="129" fill="#c9c9d1" font-size="12">-2.0</text>
  <text x="20" y="158" fill="#c9c9d1" font-size="13">USDJPY</text>
  <rect x="312" y="146" width="48" height="16" fill="#ef4444"/>
  <text x="272" y="159" fill="#c9c9d1" font-size="12">-1.2</text>
  <text x="20" y="188" fill="#c9c9d1" font-size="13">AUDUSD</text>
  <rect x="316" y="176" width="44" height="16" fill="#ef4444"/>
  <text x="276" y="189" fill="#c9c9d1" font-size="12">-1.1</text>
  <text x="20" y="218" fill="#c9c9d1" font-size="13">USDCHF</text>
  <rect x="336" y="206" width="24" height="16" fill="#ef4444"/>
  <text x="296" y="219" fill="#c9c9d1" font-size="12">-0.6</text>
  <text x="20" y="248" fill="#c9c9d1" font-size="13">XAUUSD</text>
  <rect x="360" y="236" width="36" height="16" fill="#22c55e"/>
  <text x="404" y="249" fill="#c9c9d1" font-size="12">+0.9</text>
  <text x="430" y="150" fill="#ff5a1f" font-size="12">Falling USDJPY and USDCHF</text>
  <text x="430" y="168" fill="#ff5a1f" font-size="12">= stronger yen and franc</text>
</svg>
```

## Reading the regime

No single market tells you the regime. Build a small dashboard and ask whether the pieces agree:

1. **Equities:** Is NAS100 or SPX500 making lower highs and closing near daily lows?
2. **Volatility:** Is the VIX rising, especially above 20? (Covered in detail in the volatility chapter.)
3. **Yen crosses:** Are USDJPY, EURJPY and GBPJPY falling together?
4. **Commodity FX:** Is AUDUSD weaker than EURUSD?
5. **Bonds:** Are US yields falling as money moves into Treasuries?
6. **Crypto:** Is BTCUSD trading as a high-beta risk asset rather than on its own news?

When four or more of these point the same way, you are probably in a clear regime. When they disagree, the market is in a mixed or rotational phase and single-market analysis matters more.

> **Example:** On a morning when NAS100 opens 1.8% lower, the VIX jumps from 15 to 22, USDJPY drops from 151.20 to 149.40 and AUDUSD falls from 0.6650 to 0.6590, the evidence for risk-off is strong. A trader who was planning to buy AUDUSD on a technical support level at 0.6600 should recognise that the level is fighting a powerful cross-asset current and either wait for the regime to stabilise or reduce size.

## How regimes change your risk

Risk-off moves tend to be faster than risk-on moves. Markets usually grind up and fall quickly, because selling is often forced while buying is discretionary. Spreads widen, gaps are more common on the Monday open, and stop-losses can fill at worse prices than planned.

Correlation is the hidden danger. Suppose you hold long NAS100, long AUDUSD and long BTCUSD, each risking 1% of your account. In calm conditions those might behave like three separate 1% bets. In a risk-off shock they can behave like one 3% bet, and slippage can push the realised loss beyond that.

> **Risk warning:** CFDs are leveraged products. In risk-off episodes prices can gap through stop-loss levels and several correlated positions can lose at the same time, so losses can be larger than you expected when you planned each trade individually.

## Common mistakes

- **Fighting the regime with a single-market argument.** A bullish chart pattern on AUDUSD carries less weight when the whole commodity-currency complex is being sold.
- **Assuming havens are perfect.** Gold can fall in the first phase of a panic when traders sell what they can to raise cash; the dollar can weaken when the shock comes from the US.
- **Counting positions instead of exposures.** Five risk-on trades are one theme. Measure the combined loss if the regime turns.
- **Seeing regimes everywhere.** A 0.5% dip in equities on a quiet day is not a regime change. Wait for several markets to confirm.

In Ezymex Trader you can keep a watchlist that contains one representative from each group above. A glance at it before every session tells you whether the day is driven by broad risk appetite or by individual stories.
