---
slug: "p5-t-correlation-and-total-exposure"
title: "Correlation and total exposure"
summary: "Why several positions can be one bet in disguise, how to measure net currency exposure and open risk, and how to cap risk per theme."
order: 6
version: 1
takeaways:
  - "Correlation measures how closely two markets move together, from +1 (in step) to -1 (opposite); highly correlated positions behave like a single larger position."
  - "Adding up open risk across all positions, often called portfolio heat, shows what you would lose if every stop were hit at once."
  - "Breaking positions down by currency reveals hidden concentration, such as three different USD pairs that are all short the dollar."
  - "Cap risk per theme, for example 2% on any single driver such as the dollar, and split that budget between correlated trades instead of taking full risk on each."
practice:
  label: "On your demo account, list your open positions and write down, for each currency, whether you are net long or short and by roughly how much notional value."
  symbol: "GBPUSD"
quiz:
  - question: "A trader is long EURUSD, long GBPUSD and short USDCHF, each with 1% risk. Which description is most accurate?"
    options:
      - "Three independent trades with 1% risk each, fully diversified"
      - "A hedged position with almost no risk"
      - "Largely one bet against the US dollar, with close to 3% at risk if the dollar strengthens broadly"
      - "A bet on the Swiss franc weakening"
    answer: 2
    explanation: "All three positions profit from dollar weakness and lose from dollar strength. Because these pairs are usually highly correlated, a broad dollar move could stop out all three together."
  - question: "What does a correlation coefficient of -0.9 between two pairs indicate?"
    options:
      - "They are unrelated"
      - "They tend to move strongly in opposite directions"
      - "They move together 90% of the time"
      - "One pair is 90% more volatile"
    answer: 1
    explanation: "A value near -1 means a strong inverse relationship. EURUSD and USDCHF have historically shown values in this region because USD is on opposite sides of the two quotes."
  - question: "You hold long 0.40 lots EURUSD at 1.0850. What is your US dollar exposure?"
    options:
      - "Long USD 40,000"
      - "Long USD 43,400"
      - "Short USD 40,000"
      - "Short USD 43,400"
    answer: 3
    explanation: "Buying 40,000 EUR at 1.0850 means selling 40,000 x 1.0850 = 43,400 USD. You are long EUR 40,000 and short USD 43,400."
  - question: "Your rule caps risk at 2% for any single theme. You want three trades that all express US dollar weakness. How could you allocate risk?"
    options:
      - "About 0.67% on each trade, 2% in total"
      - "2% on each trade, 6% in total"
      - "1% on each trade, because they are different symbols"
      - "No risk limit is needed because the trades are on different pairs"
    answer: 0
    explanation: "Treat the three correlated trades as one theme and divide the 2% budget: 2% / 3 = about 0.67% each."
---

A trader who risks 1% per trade and holds four positions may believe their exposure is well controlled. If all four positions depend on the same driver, the real risk is closer to 4% on a single idea. Correlation is how risk hides. This chapter shows how to find it, measure it and cap it.

## What correlation measures

The **correlation coefficient** summarises how two price series move relative to each other over a period, on a scale from -1 to +1.

| Value | Meaning | Examples often seen historically |
|---|---|---|
| +0.8 to +1.0 | Move strongly together | USOIL and UKOIL; NAS100 and SPX500; EURUSD and GBPUSD in many periods |
| around 0 | Little consistent relationship | Many unrelated pairs over short windows |
| -0.8 to -1.0 | Move strongly in opposite directions | EURUSD and USDCHF |

Three cautions apply. Correlations are **measured over a window** (for example, 50 daily closes) and change as conditions change. They can **jump towards +1 or -1 in a crisis**, just when diversification is needed most. And correlation says nothing about **size**: two pairs can be highly correlated while one moves twice as far as the other.

Pairs sharing a currency tend to be correlated for structural reasons. EURUSD and USDCHF have USD on opposite sides of the quote, which is why they usually move inversely. Buying one and selling the other is therefore not a hedge but close to a doubled position.

## Net currency exposure

Every FX position is long one currency and short another. Breaking positions down by currency reveals concentration that symbol names hide.

```text
Account equity: $10,000

Long  0.40 EURUSD at 1.0850   ->  +EUR 40,000   -USD 43,400
Long  0.30 GBPUSD at 1.2700   ->  +GBP 30,000   -USD 38,100
Short 0.35 USDCHF at 0.9000   ->  -USD 35,000   +CHF 31,500

Total USD exposure: -43,400 - 38,100 - 35,000 = -USD 116,500
Short-dollar exposure as a multiple of equity: 116,500 / 10,000 = 11.65x
```

Three symbols, one bet: short the US dollar at more than eleven times equity. A strong US data release could move all three against you in the same minute.

The same logic applies across asset classes. A long XAUUSD position is also short USD. Long USOIL and short USDCAD are both, in many periods, bets on higher oil. Long NAS100 and long NVDA overlap heavily because the share is a large component of the index. The intermarket chapters in the fundamental track of this phase explain why these links exist.

## Portfolio heat

**Portfolio heat** is the total of the open risk on all positions: what you would lose if every stop were hit.

```text
Position       Risk to stop
EURUSD long    $100  (1.0%)
GBPUSD long    $100  (1.0%)
USDCHF short   $100  (1.0%)
XAUUSD long    $100  (1.0%)
US30 long      $50   (0.5%)
Total heat     $450  (4.5% of $10,000)
```

Many traders cap total heat at around 5% to 6%, and cap risk on any single theme at around 2%. In this example four of the five positions (the three FX trades and gold) are short-dollar bets carrying 4% between them, double a 2% theme limit.

## Sizing correlated trades

When you want several positions on the same idea, split one risk budget between them instead of taking full risk on each.

> **Example:** You expect dollar weakness after a soft US inflation report and like setups on EURUSD, GBPUSD and AUDUSD. Your theme cap is 2%, or $200 on a $10,000 account. Instead of risking $100 on each (3% total), you risk about $66 on each. On EURUSD with a 25-pip stop: 66 / (25 x $10) = 0.264, so 0.26 lots, an actual risk of $65. If the dollar rallies and all three are stopped out, the loss is roughly 2%, which is your planned theme risk.

Alternatively, choose the single best expression of the idea and trade only that one. Often the pair with the clearest chart and the weakest counter-currency does the job better than three average ones.

## Hedging accounts and offsetting trades

On a hedging account you can hold a buy and a sell on the same symbol. The net exposure is zero, but you still pay spread and possibly swap on both, and you still have to decide when to close each leg. Opposite positions on different symbols are not a hedge unless the relationship is reliably one-to-one: long EURUSD and short GBPUSD is not flat, it is effectively a position in EUR against GBP.

## In practice

- Before each new trade, check which existing positions share a currency or driver.
- Keep a simple exposure note: net long or short per currency, and total heat.
- Review correlations periodically on the charts rather than relying on remembered values.

Common mistakes include counting positions instead of risk, treating crosses as independent of their USD legs, and assuming yesterday's correlation still holds after a regime change.

> **Risk warning:** Correlated positions can all move against you at once, especially during news and crises. CFDs are leveraged, so combined losses can be much larger than any single trade's planned risk.
