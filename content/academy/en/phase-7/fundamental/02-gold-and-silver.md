---
slug: "p7-f-gold-and-silver"
title: "Gold and silver"
summary: "What drives XAUUSD and XAGUSD, how the two metals differ, and how to size positions on a 100 oz gold contract."
order: 2
version: 1
takeaways:
  - "Gold has no yield, so its main opponent is the real interest rate on US government bonds; falling real yields tend to support it."
  - "Central-bank purchases, safe-haven demand and the US dollar are the other major drivers of XAUUSD."
  - "Silver is part precious metal and part industrial metal, which makes it more volatile and more sensitive to the growth cycle than gold."
  - "On a 100 oz gold contract, a 1.00 USD move equals 100 USD per lot, so stops measured in dollars need careful sizing."
  - "The gold/silver ratio compares the two metals and helps judge whether silver is moving with or against its usual beta to gold."
practice:
  label: "On your demo account, open XAUUSD and calculate the lot size that risks 1% of your balance with a stop 12 USD away, then compare it with the volume the order ticket suggests."
  symbol: "XAUUSD"
quiz:
  - question: "Which change is usually the most supportive for gold over months?"
    options:
      - "Rising real yields on US Treasuries"
      - "Falling real yields on US Treasuries"
      - "A stronger US dollar alongside rising yields"
      - "Higher stock-market volatility with rising real yields"
    answer: 1
    explanation: "Gold pays no interest, so the opportunity cost of holding it falls when real yields fall. Rising real yields and a stronger dollar are usually headwinds."
  - question: "A trader sells 0.20 lot XAUUSD at 2,350.40 and buys back at 2,338.90. What is the gross profit on a 100 oz contract?"
    options:
      - "115 USD"
      - "11.50 USD"
      - "230 USD"
      - "2,300 USD"
    answer: 2
    explanation: "The move is 11.50 USD. 11.50 x 100 oz x 0.20 lot = 230 USD. 115 USD would be the answer for 0.10 lot."
  - question: "Why is silver usually more volatile than gold?"
    options:
      - "Its market is smaller and a large share of demand is industrial, so it responds to both safe-haven and growth news"
      - "It is priced in euros"
      - "It trades 24 hours a day, seven days a week"
      - "Central banks buy more silver than gold"
    answer: 0
    explanation: "Silver's smaller, thinner market and its industrial uses (electronics, solar panels) add growth sensitivity on top of the precious-metal drivers. Central banks hold gold, not silver, as reserves."
  - question: "XAUUSD is 2,350.40 and XAGUSD is 29.50. What is the gold/silver ratio?"
    options:
      - "29.5"
      - "2,320.9"
      - "0.0126"
      - "About 79.7"
    answer: 3
    explanation: "The ratio is gold divided by silver: 2,350.40 / 29.50 = 79.67. It means one ounce of gold buys about 80 ounces of silver."
---

Gold is one of the most actively traded instruments on any CFD platform, and it has a reputation for sudden, large moves. Those moves are easier to understand once you see gold not as a commodity like oil, but as a currency without a central bank and an asset without a yield. Silver shares some of gold's drivers but adds an industrial side that changes its behaviour.

## What drives gold

Gold pays no interest and no dividend. Holding it therefore has an opportunity cost: the return you could have earned on a safe bond. The best measure of that cost is the **real yield**, the yield on US Treasuries after inflation, usually read from inflation-protected bonds (TIPS). When real yields fall, the cost of holding gold falls and demand tends to rise; when real yields climb, gold faces a headwind. The intermarket phase covered this link in detail.

Three other drivers matter:

- **The US dollar.** Gold is priced in dollars, so a weaker dollar makes it cheaper for buyers using other currencies. The relationship is strong on average but breaks down during crises, when both can rise together.
- **Central-bank buying.** Many central banks, particularly in emerging markets, have added gold to reserves in recent years to diversify away from dollar assets. This creates steady demand that is not sensitive to price in the short term.
- **Safe-haven demand.** Geopolitical shocks, banking stress or equity sell-offs can push investors into gold. These moves are often fast and can reverse once the fear fades.

For a trader this means the calendar events that matter most for gold are the same ones that move US yields and the dollar: CPI, the payrolls report and Federal Reserve decisions.

## Contract size and position sizing

On Ezymex, one lot of XAUUSD is 100 troy ounces. A 1.00 USD move in the gold price therefore equals 100 USD per lot, or 1 USD per 0.01 lot.

```text
Balance: 10,000 USD, risk 1% = 100 USD
Entry: buy XAUUSD 2,350.40, stop 2,338.40 (12.00 USD away)
Risk per 1.00 lot: 12.00 x 100 oz = 1,200 USD
Lot size = 100 / 1,200 = 0.083 -> round down to 0.08 lot
Actual risk: 12.00 x 100 x 0.08 = 96 USD

Margin at 1:100: 2,350.40 x 100 x 0.08 / 100 = 188.03 USD
```

Gold's daily range is frequently 20 to 40 USD and can exceed that on major news, so a stop of 3 USD is usually inside noise. Traders coming from FX often place stops that look sensible in pips but are far too tight for gold.

> **Risk warning:** Gold is leveraged when traded as a CFD and can gap at the weekly open or move 20 USD or more within seconds of a US data release. Stops can be filled at worse prices than their level.

## Silver: precious and industrial

Silver (XAGUSD) follows gold much of the time but typically moves further in percentage terms. There are two reasons. The silver market is far smaller than gold, so the same flow of money moves the price more. And roughly half of silver demand is industrial, from electronics, solar panels and other uses, so silver also responds to the manufacturing cycle and growth expectations.

The practical result is that silver tends to outperform gold in strong precious-metals rallies and underperform in sell-offs or when growth fears dominate. Silver contract sizes differ between brokers (5,000 oz per lot is common), so check the contract specification in Ezymex Trader before trading it; the same lot size can carry very different risk from gold.

## The gold/silver ratio

The ratio divides the gold price by the silver price. With XAUUSD at 2,350.40 and XAGUSD at 29.50, the ratio is 2,350.40 / 29.50 = 79.7, meaning one ounce of gold buys about 80 ounces of silver.

The ratio rises when gold outperforms, often in risk-off periods, and falls when silver outperforms, often in reflationary or strong-growth periods. Traders use it as context rather than a signal: if gold is rallying but the ratio is climbing sharply, the move is defensive and silver may lag. It is not mean-reverting on any reliable timetable, so treat claims that the ratio "must" return to a particular level with caution.

## Gold during the trading day

Gold trades almost 24 hours during the week, but liquidity is uneven. The Asian session is often quieter, with physical demand from China and India in the background. The London session brings the benchmark auctions and a pick-up in volume. The US session, especially around 15:30 server time in summer when many US releases land, is usually the most volatile.

> **Example:** A trader is long 0.10 lot XAUUSD at 2,350.40 ahead of a US CPI release. CPI comes in hotter than expected, real yields jump and gold falls to 2,331.40 within minutes. The loss is 19.00 x 100 x 0.10 = 190 USD, even though the trade idea was only a few hours old.

## Common mistakes

- Using FX-sized stops on gold. A few dollars of room is often less than one minute of normal movement around news.
- Sizing silver as if it were gold, without checking that the contract size is different.
- Treating gold as a guaranteed safe haven. In sharp liquidity crises gold has sometimes fallen alongside stocks as investors sold what they could.
- Ignoring the triple swap on Wednesday night for metals when holding positions for several days.
