---
slug: "p7-f-equity-indices"
title: "Equity indices"
summary: "How US30, NAS100, SPX500, GER40, UK100 and JP225 are built, what drives them, and the practical details of trading index CFDs."
order: 4
version: 1
takeaways:
  - "How an index is weighted decides which companies move it: the Dow and the Nikkei are price-weighted, most others are weighted by market capitalisation."
  - "Index levels reflect expected earnings discounted by interest rates, so both earnings news and bond yields move them."
  - "Concentration in a few mega-cap stocks means single earnings reports can move NAS100 and SPX500."
  - "The DAX behind GER40 is a total-return index, while most others are price indices whose CFDs receive dividend adjustments."
  - "Index CFDs trade outside the cash session, so gaps and thinner liquidity occur around the underlying market's open."
practice:
  label: "On your demo account, compare NAS100 and US30 on the daily chart over the last three months and note which one moved more in percentage terms on big technology earnings days."
  symbol: "NAS100"
quiz:
  - question: "In a price-weighted index such as the Dow Jones Industrial Average, which stock has the most influence?"
    options:
      - "The one with the largest market capitalisation"
      - "The one with the highest share price"
      - "The one with the most employees"
      - "All stocks have equal influence"
    answer: 1
    explanation: "A price-weighted index adds up share prices, so a high-priced share moves the index more per 1% change, regardless of company size. Market-cap weighting is used by the S&P 500 and Nasdaq-100."
  - question: "A trader buys 2 lots US30 at 39,200 on a contract of 1 USD per point per lot and closes at 39,085. What is the result?"
    options:
      - "A loss of 115 USD"
      - "A profit of 230 USD"
      - "A loss of 230 USD"
      - "A loss of 2,300 USD"
    answer: 2
    explanation: "The index fell 115 points against a long position. 115 x 1 USD x 2 lots = 230 USD loss."
  - question: "Why do rising bond yields often weigh on NAS100 more than on other indices?"
    options:
      - "Growth companies' value depends more on distant future earnings, which are discounted more heavily when yields rise"
      - "Nasdaq companies all have large debts"
      - "NAS100 is priced in euros"
      - "Bond yields only affect technology stocks"
    answer: 0
    explanation: "Higher discount rates reduce the present value of earnings far in the future, and growth stocks rely more on those earnings. Yields affect all equities, just not equally."
  - question: "What happens to a long position in a price-return index CFD when constituent stocks go ex-dividend?"
    options:
      - "Nothing, dividends are ignored"
      - "The position is closed automatically"
      - "The long pays a dividend adjustment"
      - "The long typically receives a dividend adjustment that offsets the index drop"
    answer: 3
    explanation: "When stocks go ex-dividend, a price index drops mechanically. Longs usually receive, and shorts pay, an adjustment so the drop does not create an artificial gain or loss."
---

An equity index is a single number that summarises the value of a basket of shares. Trading an index CFD lets you take a view on a whole market, such as large US companies or German blue chips, without choosing individual stocks. But indices are not all built the same way, and those construction details decide how they react to news.

## How the main indices are built

| Ezymex symbol | Underlying index | Constituents | Weighting |
|---|---|---|---|
| US30 | Dow Jones Industrial Average | 30 large US companies | Price-weighted |
| SPX500 | S&P 500 | About 500 large US companies | Free-float market cap |
| NAS100 | Nasdaq-100 | 100 largest non-financial Nasdaq listings | Modified market cap |
| GER40 | DAX | 40 large German companies | Free-float market cap, total return |
| UK100 | FTSE 100 | 100 largest UK-listed companies | Free-float market cap |
| JP225 | Nikkei 225 | 225 Japanese companies | Price-weighted |

In a **price-weighted** index, a stock trading at 500 USD moves the index five times as much for a 1% change as a stock at 100 USD, whatever the size of the companies. In a **market-cap-weighted** index, the largest companies by value dominate. For SPX500 and NAS100 that means a small group of very large technology and communication companies can account for a large share of the index, so the earnings of a handful of firms can move the whole benchmark.

The UK100 is weighted toward banks, energy, miners and consumer staples, and many of its companies earn most revenue abroad. A weaker pound often lifts UK100 because overseas earnings are worth more in sterling. JP225 has a similar relationship with the yen: a weaker yen tends to support exporters and the index.

## What moves an index

In simple terms, an equity index reflects the expected future earnings of its companies, discounted back to today at a rate linked to bond yields plus a risk premium. That gives three main drivers:

- **Earnings expectations.** Earnings season, guidance and economic growth data change what investors expect companies to earn.
- **Interest rates and yields.** Higher yields raise the discount rate and reduce the present value of future earnings. Growth-heavy indices such as NAS100 are more sensitive because more of their value lies in earnings many years ahead.
- **Risk appetite.** In risk-off periods investors demand a higher premium to hold stocks, so indices fall even if earnings forecasts are unchanged.

This is why a hot US CPI print can hit NAS100 harder than US30: the inflation surprise lifts yield expectations, and long-duration growth stocks feel it most.

## Contract sizes and a worked example

Index contract sizes vary by broker, so always check the contract specification in Ezymex Trader. The examples below use a contract of 1 USD per point per lot.

```text
Buy 1.5 lots US30 at 39,200, stop 38,980, target 39,640
Risk:   (39,200 - 38,980) = 220 points x 1 USD x 1.5 = 330 USD
Reward: (39,640 - 39,200) = 440 points x 1 USD x 1.5 = 660 USD
Reward-to-risk = 660 / 330 = 2.0

Margin at 1:100 (notional 39,200 x 1 x 1.5 = 58,800 USD): 588 USD
```

Index symbols often have lower maximum leverage than major FX pairs. The margin shown in the order ticket reflects the symbol's own margin settings.

> **Risk warning:** Index CFDs are leveraged and can gap when the underlying cash market opens, especially after overnight earnings or geopolitical news. Losses can exceed what the stop distance suggests.

## Sessions, cash and futures pricing

The underlying cash indices trade only while their stock exchanges are open: 09:30 to 16:00 New York time for the US indices, and the local session for GER40, UK100 and JP225. Index CFDs usually quote for much longer, following the index futures market. Outside cash hours the price reflects futures trading, which is thinner, so spreads can be wider and moves can be exaggerated.

The cash open is often the most volatile part of the day. For the US indices that is 16:30 server time during US daylight saving time. Many short-term traders either focus on that window deliberately or avoid it entirely; drifting into it without a plan is where trouble starts.

## Dividends and the DAX exception

When a company pays a dividend, its share price drops by roughly the dividend amount on the ex-dividend date. For a **price-return** index such as SPX500 or UK100, those drops reduce the index level. To keep things fair, index CFD positions typically receive a dividend adjustment if long and pay one if short. You will see these as balance entries in your trade history in the Client Area Portfolio.

The DAX is different: it is a **total-return** (performance) index, which assumes dividends are reinvested. It does not drop on ex-dividend dates, so GER40 positions usually see no dividend adjustments.

## In practice

- Know the weighting before you interpret a move. A 3% jump in one high-priced Dow stock can move US30 noticeably while SPX500 barely reacts.
- Check the earnings calendar for the largest constituents of NAS100 and SPX500 before holding over their release dates.
- Remember that indices and USD pairs are linked through yields and risk appetite; a long NAS100 and a long AUDUSD can be the same risk-on bet.
- Watch swap: index CFDs typically carry a triple swap on Friday night, not Wednesday.
