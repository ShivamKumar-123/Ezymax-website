---
slug: "p3-f-interest-rates-and-currencies"
title: "Interest rates and currencies"
summary: "Why rate differentials drive exchange rates, how real rates change the picture, and how the same differential shows up in your swap charges."
order: 2
version: 1
takeaways:
  - "Currencies tend to follow changes in expected interest-rate differentials between the two countries in the pair."
  - "Real interest rates (nominal rate minus inflation) often explain currency moves better than nominal rates alone."
  - "Two-year government bond yields are a useful market-based proxy for expected policy rates."
  - "The overnight swap on an FX position reflects the rate differential between the two currencies, plus the broker's markup."
practice:
  label: "Open the contract specification for USDJPY in Ezymex Trader and compare the long and short swap rates. Which side earns and which side pays?"
  symbol: "USDJPY"
quiz:
  - question: "Country A has a 5% policy rate and 6% inflation. Country B has a 3% policy rate and 1% inflation. Which has the higher real rate?"
    options:
      - "Country A, because its nominal rate is higher"
      - "Country B, with a real rate of about 2%"
      - "They are equal"
      - "It cannot be estimated"
    answer: 1
    explanation: "Real rate is roughly nominal minus inflation: A is 5% - 6% = -1%, B is 3% - 1% = 2%. B's real rate is higher despite the lower nominal rate."
  - question: "Why do traders watch the 2-year government bond yield when analysing a currency?"
    options:
      - "It is set directly by the finance ministry every week"
      - "It shows the long-term growth rate of the economy"
      - "It closely reflects the market's expected path of the policy rate over the next two years"
      - "It is the rate brokers use to calculate commission"
    answer: 2
    explanation: "Short-dated yields are dominated by expected central-bank policy, so changes in the 2-year spread between two countries often track the exchange rate."
  - question: "You hold 1 lot long of a pair where the base currency yields much less than the quote currency. What should you expect for the overnight swap?"
    options:
      - "You will usually pay swap"
      - "You will usually earn swap"
      - "Swap is always zero on FX"
      - "Swap only applies to crypto"
    answer: 0
    explanation: "Long the pair means holding the low-yield base and borrowing the high-yield quote currency, so the differential is negative and you pay (plus the broker markup)."
  - question: "Rates in both the US and the eurozone are unchanged, but markets start pricing two more Fed cuts than before. What is the typical effect on EURUSD?"
    options:
      - "EURUSD falls, because lower US rates weaken the euro"
      - "No effect, because actual rates did not change"
      - "Only USDJPY is affected"
      - "EURUSD tends to rise as the expected rate differential moves in the euro's favour"
    answer: 3
    explanation: "Currencies respond to expected differentials. Lower expected US rates make the dollar less attractive, so EURUSD tends to rise."
---

Chapter 1 explained what central banks do. This chapter connects their decisions to the exchange rate itself. The core idea is simple: money tends to flow towards where it earns a better risk-adjusted return. Interest rates are the most direct measure of that return, so the **difference** between two countries' rates, and especially how that difference is expected to change, is one of the strongest drivers of currency pairs.

## The rate differential

Every currency pair is a comparison of two economies. If the Federal Reserve holds rates at 4.50% and the ECB at 2.50%, the differential is 2.00 percentage points in favour of the dollar. A global investor choosing where to hold short-term cash earns more in dollars, all else equal.

What matters for price is how this differential **changes**. If markets begin to expect the ECB to raise rates while the Fed stays put, the expected differential narrows, euro assets become relatively more attractive, and EURUSD tends to rise. The level of rates explains why some currencies are attractive over long periods; changes in expectations explain the moves you see on the chart.

## Bond yields as the market's forecast

Central banks meet only eight times a year, but expectations change every day. The best real-time gauge is the government bond market, especially the **2-year yield**. A 2-year bond's yield is dominated by what investors expect the policy rate to average over the next two years.

Traders therefore watch the 2-year spread, for example US 2-year yield minus German 2-year yield for EURUSD. When the spread widens in the dollar's favour, EURUSD usually drifts lower, and the reverse. The relationship is not perfect and can break down during risk-off episodes, but it is one of the most reliable fundamentals in FX. Intermarket relationships like this are developed further in Phase 5.

## Nominal versus real rates

A 5% interest rate is not attractive if prices are rising at 7%. Investors care about the **real rate**, roughly the nominal rate minus inflation.

```text
Real rate  ≈  nominal rate  -  inflation

Country A:  5.00% - 6.00%  =  -1.00%
Country B:  3.00% - 1.00%  =  +2.00%
```

Country B offers a higher real return even though its headline rate is lower. That is why a currency can weaken after a rate hike if inflation is rising even faster, and why a central bank that is seen as behind the curve on inflation often sees its currency sold. Gold is especially sensitive to real yields: when real yields fall, the opportunity cost of holding a non-yielding metal drops, which tends to support XAUUSD.

## Risk appetite changes the rule

The differential rule works best in calm markets. In a panic, investors sell higher-yielding currencies and buy perceived safe havens such as the Japanese yen, the Swiss franc and often the US dollar, regardless of rates. This is why yen crosses such as GBPJPY and EURJPY can fall sharply in a sell-off even when rate differentials have not moved. Treat rate differentials as the underlying current and risk sentiment as the weather that can overpower it for a while.

## Where you feel the differential: swaps

When you hold an FX position past 00:00 server time, you effectively hold one currency and borrow the other overnight. The swap charged or credited to your account reflects that interest-rate differential, adjusted by the broker's markup.

> **Example:** Suppose USD rates are 4.50% and EUR rates are 2.50%. One lot of EURUSD at 1.0850 is 100,000 EUR, a notional of 108,500 USD. The raw differential of 2.00% on that notional is about 108,500 × 0.02 / 365 = 5.95 USD per night. A short EURUSD position (long the higher-yielding USD) would be credited roughly this amount before markup, while a long position would pay roughly this plus markup. Actual swap rates are set per symbol and are shown in the contract specification in Ezymex Trader.

Remember the Wednesday triple swap for FX and metals, which covers the weekend. For a trade held for weeks, swap can become a meaningful part of the result, positive or negative.

> **Risk warning:** Earning positive swap is not free money. Carry positions are leveraged and a small adverse move in price can wipe out months of swap income. Losses on CFDs can exceed what you expected.

## Common mistakes

- **Looking only at today's rate.** The market trades the expected path. A currency with high rates that are expected to fall can weaken steadily.
- **Ignoring inflation.** High nominal rates with higher inflation mean negative real rates, which rarely support a currency for long.
- **Forgetting both sides.** USDJPY depends on the Fed and the BoJ. A shift in either central bank moves the differential.
- **Holding long trades without checking swap.** On a multi-week position, a negative swap can quietly turn a small winner into a loser.

When you form a view on a pair, write down in one line which central bank is expected to move next and in which direction. If the data you see over the coming weeks pushes that expectation further, the pair usually follows.
