---
slug: "p1-f-fx-market-structure-sessions"
title: "The FX market: structure and trading sessions"
summary: "How currency pairs are quoted, how the global FX market is layered, and why the time of day changes how a pair behaves."
order: 2
version: 1
takeaways:
  - "A currency pair shows how many units of the quote currency one unit of the base currency costs, so buying EURUSD means buying euros and selling dollars."
  - "The FX market is a tiered dealer network: big banks at the core, then prime brokers and electronic venues, then retail brokers."
  - "FX trades around the clock from Monday 00:00 to Friday close in Kalks server time, passing through the Sydney, Tokyo, London and New York sessions."
  - "The London and New York overlap, roughly 15:00 to 19:00 server time, usually brings the most liquidity and the largest moves in the major pairs."
  - "Quiet hours and the daily rollover bring thinner liquidity and wider spreads, which affects both costs and the reliability of price moves."
practice:
  label: "On a demo EURUSD H1 chart, mark 10:00 and 15:00 server time for the last five days and compare the size of the candles before and after each mark."
  symbol: "EURUSD"
quiz:
  - question: "GBPUSD is quoted at 1.2700. What does this number mean?"
    options:
      - "One US dollar costs 1.2700 pounds"
      - "One pound costs 1.2700 US dollars"
      - "The pound has risen 1.27% today"
      - "The spread is 1.27 pips"
    answer: 1
    explanation: "In a pair, the first currency is the base and the price is how many units of the second (quote) currency one unit of the base costs. So one GBP costs 1.2700 USD."
  - question: "If you sell USDJPY, what position do you effectively hold?"
    options:
      - "Long US dollars, short yen"
      - "Long both currencies"
      - "Short US dollars, long yen"
      - "No currency exposure, only price exposure"
    answer: 2
    explanation: "Selling a pair means selling the base currency (USD) and buying the quote currency (JPY). You profit if the dollar weakens against the yen."
  - question: "In Kalks server time, when is the London and New York overlap approximately?"
    options:
      - "15:00 to 19:00"
      - "00:00 to 04:00"
      - "08:00 to 10:00"
      - "20:00 to 24:00"
    answer: 0
    explanation: "London trades roughly 10:00 to 19:00 and New York roughly 15:00 to 24:00 server time, so they overlap from about 15:00 to 19:00. This is typically the most liquid part of the FX day."
  - question: "Which statement about the FX market's structure is correct?"
    options:
      - "All FX trades are matched on one exchange in London"
      - "Retail brokers set the global price of EURUSD"
      - "There is one official price that every participant sees"
      - "Large banks form the core of a dealer network, and retail brokers source prices from that wider network"
    answer: 3
    explanation: "FX is decentralised. Major banks and electronic venues form the core; brokers aggregate prices from liquidity providers. There is no single exchange or single official price."
---

The foreign exchange market is the largest financial market in the world, with average turnover well above 7 trillion US dollars a day according to the Bank for International Settlements' triennial surveys. It has no central exchange and no closing bell during the week. To trade it well you need to understand two things: how currencies are quoted and who stands behind the prices, and how the market's character changes as the trading day moves around the globe.

## How a currency pair is quoted

Currencies are always traded in pairs, because buying one currency means paying with another. In EURUSD 1.0850, the first currency (EUR) is the **base** and the second (USD) is the **quote**. The price tells you how many units of the quote currency one unit of the base costs: one euro costs 1.0850 dollars.

- **Buying** EURUSD means buying euros and selling dollars. You profit if the euro strengthens against the dollar.
- **Selling** EURUSD means selling euros and buying dollars. You profit if the euro weakens.

Pairs are grouped by liquidity. **Majors** all include the US dollar and a large economy: EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD. **Crosses** exclude the dollar, such as EURJPY and GBPJPY. **Exotics** pair a major currency with an emerging-market currency, such as USDINR, and usually have wider spreads and specific trading-hour rules.

For most pairs the smallest standard price step you will talk about is the **pip**, the fourth decimal place (0.0001). For yen pairs it is the second decimal (0.01). Brokers usually quote one extra digit, a fractional pip, so EURUSD 1.08505 is a normal quote. Pip values and lot sizes are covered properly in Phase 2.

## A market in layers

FX is a dealer network organised in tiers.

1. **The interbank core.** A small group of global banks deal with each other in very large sizes and provide most of the market's liquidity.
2. **Prime brokers and electronic venues.** Institutions, funds and non-bank market makers access that liquidity through prime brokerage relationships and electronic communication networks.
3. **Retail brokers.** Brokers such as Kalks aggregate prices from one or more liquidity providers and offer them to clients, typically as CFDs.

Because prices come from different providers, EURUSD can differ by a fraction of a pip between brokers at the same instant. In a liquid pair these differences are tiny; in thin conditions they can be larger.

## The trading day in sessions

FX follows the sun. As one financial centre closes, another opens. Kalks Trader shows time in **server time** (GMT+2 in winter, GMT+3 when the US is on daylight saving). This offset is chosen so that 00:00 server time always equals 17:00 in New York, the traditional end of the FX day. The market opens for the week at Monday 00:00 server time and closes on Friday at the New York close.

| Session | Approximate server time | Character |
|---|---|---|
| Sydney | 00:00 to 09:00 | Quiet; AUD and NZD active |
| Tokyo | 03:00 to 12:00 | JPY pairs active; majors often range |
| London | 10:00 to 19:00 | Highest single-session volume; trends often start |
| New York | 15:00 to 24:00 | US data and US equities drive the USD |

Asia-Pacific times shift by about an hour during parts of the year because Australia and Japan follow different daylight-saving rules from the US and Europe. Treat the table as a guide, not an exact schedule.

```svg
<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <text x="320" y="22" text-anchor="middle" font-size="14">FX sessions in Kalks server time (approximate)</text>
    <text x="52" y="58" text-anchor="end">Sydney</text>
    <text x="52" y="88" text-anchor="end">Tokyo</text>
    <text x="52" y="118" text-anchor="end">London</text>
    <text x="52" y="148" text-anchor="end">New York</text>
    <text x="60" y="195" text-anchor="middle">00</text>
    <text x="192" y="195" text-anchor="middle">06</text>
    <text x="324" y="195" text-anchor="middle">12</text>
    <text x="456" y="195" text-anchor="middle">18</text>
    <text x="588" y="195" text-anchor="middle">24</text>
    <text x="434" y="218" text-anchor="middle" fill="#ff5a1f">London / New York overlap</text>
  </g>
  <rect x="390" y="36" width="88" height="142" fill="#ff5a1f" fill-opacity="0.15"/>
  <line x1="60" y1="178" x2="588" y2="178" stroke="#3a3a44"/>
  <line x1="60" y1="36" x2="60" y2="182" stroke="#3a3a44"/>
  <line x1="192" y1="36" x2="192" y2="182" stroke="#3a3a44" stroke-dasharray="3 3"/>
  <line x1="324" y1="36" x2="324" y2="182" stroke="#3a3a44" stroke-dasharray="3 3"/>
  <line x1="456" y1="36" x2="456" y2="182" stroke="#3a3a44" stroke-dasharray="3 3"/>
  <line x1="588" y1="36" x2="588" y2="182" stroke="#3a3a44"/>
  <rect x="60" y="46" width="198" height="16" fill="#3a3a44"/>
  <rect x="126" y="76" width="198" height="16" fill="#3a3a44"/>
  <rect x="280" y="106" width="198" height="16" fill="#22c55e" fill-opacity="0.7"/>
  <rect x="390" y="136" width="198" height="16" fill="#22c55e" fill-opacity="0.7"/>
</svg>
```

## Why the session matters to you

The session changes three practical things.

**Spreads.** When London and New York are both open, many dealers are competing and spreads on majors are usually at their tightest. Around 00:00 server time, the daily rollover, liquidity is at its thinnest and spreads can widen sharply for a few minutes.

**Movement.** Most of the daily range in EURUSD and GBPUSD is typically made during London and New York hours. A pair that barely moved 15 pips overnight can travel 60 pips after the London open.

**What drives the price.** During Tokyo, Japanese flows and Asian data matter most. In New York, US economic releases, often at 15:30 server time (08:30 New York), and the US equity open dominate.

> **Example:** Suppose EURUSD traded between 1.0842 and 1.0858 during the Asian session, a 16-pip range. After the London open it breaks above 1.0858 and reaches 1.0895 by the New York afternoon. The day's full range is 1.0895 - 1.0842 = 0.0053, or 53 pips, and 37 of those pips (1.0895 - 1.0858) came after London opened. Patterns like this are common, but not guaranteed, which is why many traders plan their activity around the main sessions.

## Common mistakes

- **Trading majors in dead hours by default.** Entering EURUSD at 01:00 server time means paying wider spreads for a market that often does little.
- **Forgetting daylight-saving changes.** Session times in your local clock move twice a year. Server time is designed to stay aligned with New York, which is why it is the better reference.
- **Treating all pairs the same.** AUDUSD and USDJPY can be more active in Asian hours than EURUSD; exotic pairs like USDINR may have restricted trading hours. Always check the symbol's trading hours in Kalks Trader.

Open a demo account in Kalks Trader and watch one major pair through a full day: note the spread and candle size in each session.
