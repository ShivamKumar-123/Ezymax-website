---
slug: "p7-f-fx-majors-and-crosses"
title: "FX majors and crosses"
summary: "How the major pairs differ from one another, how cross rates are built, and why a cross such as GBPJPY behaves so differently from EURUSD."
order: 1
version: 1
takeaways:
  - "Every major pair contains the US dollar, so a single US data release can move all of them at once."
  - "A cross rate is derived from two dollar pairs, which is why its spread and volatility are usually wider than either leg."
  - "Each major has a personality shaped by its central bank, its economy and its sessions, and your stops and expectations should reflect that."
  - "Pip value depends on the quote currency, so one lot of USDJPY or GBPJPY is not worth 10 USD per pip."
  - "Trading several pairs that share a currency is often one bet in disguise; check your total exposure per currency."
practice:
  label: "On your demo account, open EURUSD, USDJPY and EURJPY side by side on the H1 chart and multiply EURUSD by USDJPY to check it matches the EURJPY quote."
  symbol: "EURJPY"
quiz:
  - question: "EURUSD is 1.0850 and USDJPY is 157.20. Approximately where should EURJPY trade?"
    options:
      - "144.88"
      - "170.56"
      - "158.29"
      - "156.12"
    answer: 1
    explanation: "EURJPY = EURUSD x USDJPY = 1.0850 x 157.20 = 170.56. Dividing or adding the rates gives meaningless numbers."
  - question: "Why is the spread on a cross such as GBPJPY usually wider than on EURUSD?"
    options:
      - "Crosses are only traded on weekends"
      - "Brokers charge a fixed penalty on crosses"
      - "Crosses carry the liquidity and pricing risk of two dollar legs and trade in lower volume"
      - "Crosses are always more trending"
    answer: 2
    explanation: "A cross is priced from two underlying dollar pairs and has less direct interbank volume, so market makers quote it wider. Trend character has nothing to do with spread."
  - question: "What is the value of one pip on 1.00 lot of USDJPY when USDJPY is 157.20?"
    options:
      - "About 6.36 USD"
      - "Exactly 10 USD"
      - "About 15.72 USD"
      - "1,000 USD"
    answer: 0
    explanation: "One pip is 0.01 JPY x 100,000 = 1,000 JPY. Converted at 157.20 that is 1,000 / 157.20 = 6.36 USD. The 10 USD figure only applies to pairs quoted in USD."
  - question: "A trader is long EURUSD, long GBPUSD and short USDCHF. What is the main risk?"
    options:
      - "The positions hedge each other perfectly"
      - "Swap charges will cancel out"
      - "Only the Swiss franc exposure matters"
      - "All three are effectively short the US dollar, so exposure is concentrated"
    answer: 3
    explanation: "Each position profits if the dollar weakens, so a strong US release hits all three together. They do not hedge; they stack."
---

The foreign exchange market is often described as one market, but the pairs inside it behave very differently. EURUSD can drift quietly through an Asian session while GBPJPY swings 80 pips on the same morning. Knowing why helps you choose pairs that suit your strategy, size positions correctly and avoid building one oversized bet out of several "different" trades.

## Majors, minors and crosses

The **majors** are the most traded pairs and all contain the US dollar: EURUSD, USDJPY, GBPUSD, USDCHF, AUDUSD, USDCAD and NZDUSD. The dollar sits on one side of most FX transactions worldwide, which is why these pairs have the deepest liquidity and the tightest spreads.

A **cross** is a pair without the dollar, such as EURJPY, GBPJPY or EURGBP. Crosses built from two major currencies are sometimes called minors. Pairs involving an emerging-market currency, such as USDINR, are often called **exotics** and can have wider spreads, lower leverage limits and occasional capital-control effects.

## How a cross rate is built

In the interbank market, most liquidity runs through the dollar. A cross rate is therefore derived from two dollar legs:

```text
EURJPY = EURUSD x USDJPY
       = 1.0850 x 157.20 = 170.56

EURGBP = EURUSD / GBPUSD
       = 1.0850 / 1.2700 = 0.8543
```

This has two consequences. First, a cross inherits the movement of both legs. If the euro strengthens against the dollar while the dollar strengthens against the yen, EURJPY rises from both sides. Second, a market maker pricing a cross carries the risk of two legs, so crosses usually show wider spreads and larger daily ranges.

```svg
<svg viewBox="0 0 520 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="13" fill="#c9c9d1">
    <circle cx="260" cy="60" r="34" fill="none" stroke="#ff5a1f" stroke-width="2"/>
    <text x="260" y="65" text-anchor="middle">USD</text>
    <circle cx="110" cy="200" r="34" fill="none" stroke="#3a3a44" stroke-width="2"/>
    <text x="110" y="205" text-anchor="middle">EUR</text>
    <circle cx="410" cy="200" r="34" fill="none" stroke="#3a3a44" stroke-width="2"/>
    <text x="410" y="205" text-anchor="middle">JPY</text>
    <line x1="235" y1="85" x2="135" y2="175" stroke="#22c55e" stroke-width="2"/>
    <line x1="285" y1="85" x2="385" y2="175" stroke="#22c55e" stroke-width="2"/>
    <line x1="144" y1="200" x2="376" y2="200" stroke="#ff5a1f" stroke-width="2" stroke-dasharray="6 4"/>
    <text x="150" y="120" text-anchor="middle">EURUSD 1.0850</text>
    <text x="372" y="120" text-anchor="middle">USDJPY 157.20</text>
    <text x="260" y="225" text-anchor="middle">EURJPY = 1.0850 x 157.20 = 170.56</text>
    <text x="260" y="250" text-anchor="middle" font-size="12">Solid: liquid dollar legs. Dashed: derived cross.</text>
  </g>
</svg>
```

## The personality of each major

Each currency reflects its central bank, its economy and the time of day it is most active.

| Pair | Main drivers | Typical character |
|---|---|---|
| EURUSD | ECB vs Fed policy, rate differentials, US data | Deepest liquidity, tightest spread, steadier ranges |
| USDJPY | US Treasury yields, Bank of Japan policy, risk mood | Sensitive to US yields; sharp moves on BoJ surprises or intervention |
| GBPUSD | Bank of England, UK inflation and wages | Livelier than EURUSD, reacts strongly to UK data |
| USDCHF | Safe-haven flows, SNB policy | Often mirrors EURUSD in the opposite direction |
| AUDUSD | China demand, iron ore, RBA, risk appetite | A "risk-on" currency, sensitive to Asian session news |
| USDCAD | Crude oil, Bank of Canada, US data | Loonie tends to firm when oil rallies |

Crosses combine these personalities. GBPJPY mixes a data-sensitive pound with a yen that jumps on risk aversion, which is why it has a reputation for wide ranges. EURGBP combines two neighbouring European economies whose news often offsets, so it tends to move in narrower, more range-bound fashion.

## Pip value is not always 10 USD

On a standard lot of 100,000 units, one pip on any pair quoted in USD (EURUSD, GBPUSD, AUDUSD) is worth 10 USD. On other pairs the pip is paid in the quote currency and must be converted.

```text
USDJPY 1.00 lot: 1 pip = 0.01 x 100,000 = 1,000 JPY
                 1,000 / 157.20 = 6.36 USD per pip

GBPJPY 1.00 lot: also 1,000 JPY per pip = 6.36 USD at USDJPY 157.20

A 40-pip stop on 0.50 lot GBPJPY:
                 40 x 6.36 x 0.50 = 127.20 USD at risk
```

If you size a GBPJPY trade as if a pip were 10 USD, your real risk will be lower than planned. On USDCHF the opposite happens: with the rate below 1.00, a pip is worth more than 10 USD (10 / 0.9000 = about 11.11 USD at 0.9000), so the same shortcut would make you risk more than planned. Kalks Trader shows the pip value and margin for the selected volume in the order ticket, so check it before you confirm.

## Choosing pairs for your strategy

A short-term strategy that pays the spread many times a day is usually best suited to the majors, where costs are lowest. Swing strategies can use crosses to express a clear view on two currencies without the dollar, for example a view that the euro will outperform the pound. Carry trades, covered in the sentiment phase, often use high-yield versus low-yield crosses. Always compare the average daily range of a pair with your stop distance: a 15-pip stop on GBPJPY is inside ordinary noise for that pair.

> **Risk warning:** FX CFDs are leveraged. A move of 1% against a position at 1:100 leverage wipes out the full margin for that position, and gaps around central-bank decisions or interventions can fill stops well beyond their level.

## Common mistakes

- Treating correlated pairs as diversification. Long EURUSD, long GBPUSD and short USDCHF are three ways of selling the dollar.
- Ignoring session timing. AUD pairs react to Asian data; trading them only in the late New York session means trading their quietest hours.
- Assuming every pip is 10 USD, which leads to wrong position sizes on yen, franc and Canadian dollar pairs.
- Holding crosses with a large negative swap for weeks without accounting for the cost, especially across the triple swap on Wednesday night.
