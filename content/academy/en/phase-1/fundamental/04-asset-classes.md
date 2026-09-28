---
slug: "p1-f-asset-classes"
title: "Asset classes you can trade on Kalks"
summary: "Forex, metals, indices, energies, crypto and US shares: what each one represents, when it trades and how differently it behaves."
order: 4
version: 1
takeaways:
  - "Kalks offers CFDs on six asset classes: forex, metals, stock indices, energies, cryptocurrencies and US shares."
  - "Each class has its own drivers, trading hours and typical volatility, so the same position size carries very different risk across classes."
  - "Contract sizes differ by symbol, so always check the contract specification in Kalks Trader before sizing a trade."
  - "Crypto trades every day of the week, US shares only during New York exchange hours, and the other classes Monday to Friday."
  - "Many instruments are linked, for example the US dollar, gold and US indices, so several trades can end up being one bet."
practice:
  label: "Open the symbol specification for EURUSD, XAUUSD, US30 and BTCUSD in Kalks Trader and write down the contract size and trading hours of each."
  symbol: "US30"
quiz:
  - question: "Which asset class on Kalks can be traded on Saturday and Sunday?"
    options:
      - "Forex"
      - "Stock indices"
      - "Cryptocurrencies"
      - "Energies"
    answer: 2
    explanation: "Crypto CFDs such as BTCUSD trade 24/7. Forex, metals, indices and energies are closed at the weekend, and US shares trade only during New York exchange hours."
  - question: "On a contract worth 1 USD per point per lot, you buy 1 lot of US30 at 39,200 and close at 39,350. What is the result?"
    options:
      - "+150 USD"
      - "+1,500 USD"
      - "+15 USD"
      - "-150 USD"
    answer: 0
    explanation: "The index rose 39,350 - 39,200 = 150 points. At 1 USD per point per lot, 1 lot earns 150 USD. Contract sizes vary, so always check the specification."
  - question: "Why is 1 lot not a fixed amount of risk across different instruments?"
    options:
      - "Because lots are only used in forex"
      - "Because the broker changes lot sizes every day"
      - "Because risk depends only on leverage"
      - "Because contract sizes and typical daily movements differ widely between symbols"
    answer: 3
    explanation: "One lot of EURUSD is 100,000 euros, one lot of XAUUSD is 100 ounces, and indices or crypto have their own sizes. Combined with different volatility, the money at risk per lot varies enormously."
  - question: "During which hours can you trade a US share CFD such as NVDA?"
    options:
      - "24 hours a day, 7 days a week"
      - "09:30 to 16:00 New York time on trading days"
      - "Only during the Tokyo session"
      - "Monday 00:00 to Friday 24:00 server time without interruption"
    answer: 1
    explanation: "Share CFDs follow the underlying exchange, which trades 09:30 to 16:00 New York time. That is 16:30 to 23:00 in Kalks server time."
---

A trading account on Kalks gives you access to far more than currencies. You can trade gold, the Dow Jones, crude oil, Bitcoin and Nvidia from the same terminal. That convenience hides a trap: these markets behave very differently, and treating them the same way is one of the fastest routes to oversized risk. This chapter maps out each asset class, what drives it and what to check before you trade it.

## The six asset classes at a glance

| Class | Kalks symbols (examples) | What it tracks | When it trades |
|---|---|---|---|
| Forex | EURUSD, GBPUSD, USDJPY, EURJPY, USDINR | Exchange rates between currencies | Monday to Friday, around the clock |
| Metals | XAUUSD, XAGUSD | Spot gold and silver priced in USD | Monday to Friday, with a daily break |
| Indices | US30, NAS100, SPX500, GER40, UK100, JP225 | Major stock market indices | Monday to Friday, hours per index |
| Energies | USOIL, UKOIL | WTI and Brent crude oil | Monday to Friday, with a daily break |
| Crypto | BTCUSD, ETHUSD, SOLUSD, XRPUSD | Cryptocurrency prices in USD | 24 hours, 7 days a week |
| US shares | AAPL, TSLA, NVDA, META, NFLX | Individual company share prices | 09:30 to 16:00 New York time |

Exact trading hours, including any daily breaks, are listed in each symbol's specification in Kalks Trader.

## Forex and metals

**Forex** is the deepest and most liquid class. Major pairs usually have the tightest spreads on the platform and respond mainly to interest rates, economic data and central-bank policy. Typical daily moves in EURUSD are well under 1% of the price.

**Gold (XAUUSD)** is priced in dollars per troy ounce, and one lot is 100 ounces. Gold is influenced by the US dollar, real interest rates and demand for safety during stress. It usually moves more than major FX pairs in percentage terms. Silver (XAGUSD) follows similar drivers but is more volatile and has more industrial demand.

> **Example:** With XAUUSD at 2,350.40, one lot is 100 x 2,350.40 = 235,040 USD of gold. A 20-dollar move, which is an ordinary day for gold in many periods, changes the value of 1 lot by 20 x 100 = 2,000 USD. The same 2,000 USD on EURUSD would take a 200-pip move on 1 lot, which is far larger than a typical day.

## Indices and energies

A stock **index** measures a basket of shares. US30 tracks 30 large US companies, NAS100 the largest non-financial Nasdaq companies with a heavy technology weighting, SPX500 the broad S&P 500, GER40 major German companies, UK100 the FTSE 100 and JP225 the Nikkei 225. Indices respond to company earnings, interest rates and general risk appetite. They are most active when their home stock market is open.

Index contract sizes vary by broker. As an illustration, on a contract worth 1 USD per point per lot:

```text
Buy 1 lot US30 at 39,200
Close at 39,350
Move:   39,350 - 39,200 = 150 points
Result: 150 x 1 USD = +150 USD
```

**Energies** track crude oil: USOIL follows US benchmark WTI and UKOIL follows Brent. Oil is driven by supply decisions of producers, inventories, global growth and geopolitics, and can gap sharply on news. Weekly US inventory data often moves it.

## Crypto and US shares

**Crypto CFDs** trade every day, including weekends, and swaps are charged every night. Percentage moves are usually much larger than in FX: a 3% day in BTCUSD is not unusual, while a 3% day in EURUSD would be exceptional. Weekend liquidity can be thin.

> **Example:** On an illustrative contract of 1 BTC per lot, 0.05 lot of BTCUSD at 64,000 is worth 0.05 x 64,000 = 3,200 USD. A fall to 62,400, a 2.5% move, loses 0.05 x (64,000 - 62,400) = 0.05 x 1,600 = 80 USD.

**US share CFDs** follow individual companies such as AAPL, TSLA, NVDA, META and NFLX. They trade during the US exchange session, 09:30 to 16:00 New York time, which is 16:30 to 23:00 server time. Prices can gap between sessions, especially around quarterly earnings reports, when a single stock can move 5 to 10% or more overnight.

## Why the differences matter

The same lot size, or the same margin, can represent completely different risk depending on the symbol. Two practical rules follow:

1. **Size by money at risk, not by lots.** Decide how much you could lose if the price moves a normal amount against you, then choose the size. Phase 5 teaches exact formulas.
2. **Watch for overlap.** A long XAUUSD, a short USDJPY and a short EURUSD position are not three independent ideas. The first two both benefit from a weaker dollar, the third from a stronger one. The first two also react strongly to US interest-rate news. Many instruments share drivers.

> **Risk warning:** Instruments with higher volatility, such as crypto, oil and single shares, can move against a leveraged position very quickly and can gap past stop-loss levels. Losses can exceed what you expected. Use smaller sizes on more volatile instruments.

## Common mistakes

- **Copying the lot size from one symbol to another.** 0.50 lot on EURUSD and 0.50 lot on XAUUSD are very different exposures.
- **Holding share CFDs through earnings without realising it.** Check the company's reporting date in the economic calendar or news.
- **Forgetting weekend crypto trading.** A crypto position stays open and exposed on Saturday and Sunday, when you might not be watching.

Explore each class on a free demo account in Kalks Trader before trading any of them with real money.
