---
slug: "p5-f-bonds-and-yields"
title: "Bonds and yields: the market behind every market"
summary: "Why bond prices and yields move in opposite directions, what the 2-year and 10-year yields tell you, and how yield differentials drive currency pairs."
order: 1
version: 1
takeaways:
  - "Bond prices and yields move in opposite directions because the fixed coupon is repriced against the yield newly available in the market."
  - "The 2-year yield mostly reflects expected central-bank policy, while the 10-year yield adds growth, inflation and a term premium."
  - "Longer bonds are more sensitive to a change in yield, so the same 0.50% yield move hurts a 10-year bond roughly four times more than a 2-year bond."
  - "Changes in the yield gap between two countries are one of the most reliable fundamental drivers of their currency pair."
practice:
  label: "Open a daily USDJPY chart on your demo account and note the dates of its three largest moves this year; then check the economic calendar for US rate or inflation news on those dates."
  symbol: "USDJPY"
quiz:
  - question: "A one-year zero-coupon bond pays 100 at maturity. If the market yield rises from 4% to 5%, what happens to its price?"
    options:
      - "It rises from 95.24 to 96.15"
      - "It falls from 96.15 to 95.24"
      - "It stays at 100 because the bond still pays 100 at maturity"
      - "It falls from 100 to 95"
    answer: 1
    explanation: "The price is the present value of 100: 100 / 1.04 = 96.15 and 100 / 1.05 = 95.24. Higher yield means a lower price today, even though the payment at maturity is unchanged."
  - question: "Which yield is most closely tied to market expectations for the next moves in the policy rate?"
    options:
      - "The 30-year yield"
      - "The 10-year yield"
      - "The 2-year yield"
      - "The dividend yield of the S&P 500"
    answer: 2
    explanation: "The 2-year yield is dominated by expected policy rates over the next two years. Longer maturities also carry growth, inflation and term-premium components."
  - question: "The US 10-year yield rises from 4.20% to 4.50% while the German 10-year yield is unchanged at 2.40%. All else equal, what is the typical pressure on EURUSD?"
    options:
      - "Downward, because the US-German spread widened from 180 to 210 basis points in favour of the dollar"
      - "Upward, because higher US yields mean US bonds are falling"
      - "None, because only short-term yields affect currencies"
      - "Upward, because German bonds become relatively cheaper"
    answer: 0
    explanation: "A wider yield advantage for US assets tends to attract capital into dollars, pushing EURUSD lower. It is a pressure, not a guarantee; other drivers can dominate on any given day."
  - question: "Why does a 10-year bond lose more value than a 2-year bond when all yields rise by the same amount?"
    options:
      - "Because 10-year bonds are issued by riskier governments"
      - "Because its cash flows lie further in the future, so they are discounted more heavily by the higher yield"
      - "Because 10-year bonds pay no coupon"
      - "Because 2-year bonds are guaranteed to be repaid at par before maturity"
    answer: 1
    explanation: "This is duration: the longer the time until the cash flows arrive, the more their present value changes when the discount rate changes."
---

Most people who trade FX, gold or indices never buy a bond. Yet the government bond market is the largest and most rate-sensitive market in the world, and its prices are quietly built into the valuation of almost everything on your watchlist. When a currency pair moves sharply on an inflation release, it is usually because bond yields moved first. This chapter explains how bonds work, what yields tell you and how to use them as context for trades in Kalks Trader.

## How a bond works

A government bond is a loan to the state. The investor pays a price today and receives fixed interest payments, called coupons, plus the face value (usually quoted as 100) at maturity. A US 10-year Treasury note with a 4% coupon pays 2 per 100 of face value every six months for ten years, then returns the 100.

The **yield** is the annual return an investor earns if they buy the bond at today's price and hold it to maturity. Because the coupon is fixed when the bond is issued, the only way the market can adjust the return on an existing bond is through its price. That is why price and yield always move in opposite directions.

```text
One-year zero-coupon bond, pays 100 in one year

Market yield 4%:  price = 100 / 1.04 = 96.15
Market yield 5%:  price = 100 / 1.05 = 95.24

Yield up 1 percentage point -> price down 0.91 (about -0.95%)
```

When you read "yields jumped", translate it as "bond prices fell because investors demanded a higher return". The cause might be higher inflation, expectations of rate hikes, heavy government borrowing or simply selling pressure.

## Duration: why maturity matters

Not every bond reacts equally. The further away the cash flows are, the more their present value changes when the yield changes. This sensitivity is called **duration**.

```text
4% coupon bonds priced at 100 when the yield is 4.00%
Yield rises to 4.50%:

2-year bond:   price about 99.05   (-0.95%)
10-year bond:  price about 96.01   (-3.99%)
```

The same half-point move costs the 10-year holder about four times as much. This is why the long end of the market swings more on inflation surprises, and why long-duration assets such as high-growth technology shares (see the NAS100 discussion later in this section) tend to move with the 10-year yield.

## What the key yields tell you

Traders focus on two points on the curve:

| Yield | Main drivers | What it signals |
|---|---|---|
| 2-year | Expected central-bank policy over the next two years | How many hikes or cuts the market is pricing |
| 10-year | Expected policy plus long-run growth, inflation and a term premium | The market's view of the longer-run economy and the cost of long-term money |

Central banks set the overnight rate, but markets set every other yield. When a US CPI release comes in hot, the 2-year yield typically jumps first as traders price a more hawkish Federal Reserve. Phase 3 covered monetary policy and inflation; here the point is that the bond market is where those expectations are expressed in real time.

## Yield differentials and currencies

Money moves towards a better risk-adjusted return. If US yields rise relative to those in Japan, holding dollars becomes more attractive than holding yen, and USDJPY tends to rise. The useful measure is the **spread** between two countries' yields, quoted in basis points (1 bp = 0.01%).

> **Example:** The US 10-year yields 4.20% and the German 10-year yields 2.40%, a spread of 180 bp. After a strong US jobs report the US yield rises to 4.50% while the German yield is unchanged. The spread widens to 210 bp in favour of the dollar, and EURUSD comes under downward pressure, perhaps from 1.0850 towards 1.0800.

For short-term FX moves the 2-year spread often tracks the pair more closely than the 10-year spread, because it reflects the policy gap between the two central banks. USDJPY has historically been one of the pairs most tightly linked to US-Japan yield spreads, which is why many JPY traders watch US yields as closely as the chart itself.

> **In Kalks Trader:** Government bonds may not be available as tradable symbols on your account, but you can still follow yields through the News and Economic calendar modules in the Client Area and use them as context for FX, gold and index trades.

## In practice

Use yields as a **context filter**, not as an entry signal. A practical routine looks like this:

1. Before the session, note whether US 2-year and 10-year yields rose or fell over the past day and week.
2. Check whether the move is consistent with your trade idea. A long USDJPY setup has a stronger backdrop when US yields are rising than when they are falling.
3. Around major data (CPI, NFP, central-bank decisions), expect yields and currency pairs to reprice together within seconds.

Common mistakes to avoid:

- Confusing price and yield. "Bonds sold off" means yields rose.
- Assuming the link is fixed. In a panic, investors buy bonds for safety, yields fall and the dollar can still rise because it is a safe haven. Correlations shift with the regime.
- Ignoring the other country. A currency pair is a relative price; a rise in US yields means little if German yields rose by the same amount.

> **Risk warning:** Yield-driven moves can be fast around data releases, and CFDs are leveraged, so losses can exceed what you expected. Fundamental context does not remove the need for a stop loss and a properly sized position.
