---
slug: "p6-f-carry-trade"
title: "The carry trade"
summary: "How traders earn interest-rate differentials through swaps, why carry trades build up slowly and unwind violently, and how to judge carry against risk."
order: 5
version: 1
takeaways:
  - "A carry trade buys a higher-yielding currency against a lower-yielding one to earn the interest-rate differential, which in CFD trading arrives through the daily swap."
  - "Carry is small and steady, while the price risk is large and sudden, so a modest adverse move can wipe out months of swap income."
  - "Carry trades do best in calm, risk-on regimes and unwind together when volatility rises, which is why funding currencies such as the yen rally in risk-off episodes."
  - "Comparing the rate differential with volatility (carry-to-risk) is a better guide than the differential alone."
practice:
  label: "In Kalks Trader, open the contract specification for USDJPY and note the long and short swap rates and the day on which triple swap is charged."
  symbol: "USDJPY"
quiz:
  - question: "In a CFD account, how does a trader holding a carry trade overnight actually receive or pay the interest differential?"
    options:
      - "Through a monthly dividend paid by the central bank"
      - "It is paid only when the position is closed at a profit"
      - "Through a lower spread when opening the trade"
      - "Through the swap credited or debited at the daily rollover"
    answer: 3
    explanation: "The interest differential, after the broker's markup, is applied as a swap at 00:00 server time each night the position is held. It is paid or charged whether the position is in profit or loss."
  - question: "A long 1 lot USDJPY position earns a swap of 11 USD per night. At USDJPY 150.00, roughly how many nights of swap does a 150-pip adverse move cost?"
    options:
      - "About 91 nights"
      - "About 14 nights"
      - "About 9 nights"
      - "About 150 nights"
    answer: 0
    explanation: "Pip value per lot = 100,000 x 0.01 = 1,000 JPY, or 1,000 / 150 = 6.67 USD. 150 pips x 6.67 = about 1,000 USD. 1,000 / 11 = about 91 nights of swap."
  - question: "Why do yen crosses often fall sharply when global risk appetite drops?"
    options:
      - "Because Japan always raises interest rates in a crisis"
      - "Because the yen is not traded in the Asian session"
      - "Because the yen is a common funding currency and carry traders buy it back to close positions"
      - "Because swaps on yen pairs are charged in euros"
    answer: 2
    explanation: "Borrowing in low-yielding yen to buy higher-yielding assets is a classic carry structure. When volatility rises, many traders close at once, buying yen and pushing yen crosses lower."
  - question: "Currency A offers a 4% differential with 12% annual volatility; currency B offers 3% with 6% volatility. On a carry-to-risk basis:"
    options:
      - "A is better because 4% is higher than 3%"
      - "B is better because 3 / 6 = 0.50 is higher than 4 / 12 = 0.33"
      - "They are equal"
      - "Volatility is irrelevant to carry"
    answer: 1
    explanation: "Carry-to-risk divides the differential by volatility. B earns more carry per unit of risk, even though its headline differential is lower."
---

Every currency has an interest rate attached to it. When you hold one currency against another overnight, you are effectively lending one and borrowing the other, and the difference in their rates has to be paid by someone. The **carry trade** is the strategy of deliberately holding the higher-yielding currency against a lower-yielding one to collect that difference. It is one of the oldest and largest positioning themes in currency markets, and it shapes how prices behave in both calm and stressed conditions.

## How carry reaches your account

In CFD trading, the interest differential arrives through the **swap**, charged or credited at 00:00 server time for each position held past rollover. For FX and metals, Wednesday night carries a triple swap to cover the weekend. The broker's swap rate is based on the underlying rate differential with a markup, which is why long and short swaps on the same pair are usually not mirror images, and why both can occasionally be negative.

Swap-free accounts exist for clients who cannot receive or pay interest. On those accounts, carry cannot be earned, although other fees may apply instead.

> **In Kalks Trader:** The contract specification for each symbol shows the current long and short swap rates and the triple-swap day. Swap rates change when central-bank rates change, so check them again after policy decisions.

## Worked example: long USDJPY

Assume US short-term rates are about 5% higher than Japanese rates. A long USDJPY position is long the dollar and short the yen, so it earns roughly that differential.

```text
Position: long 1 lot USDJPY = 100,000 USD notional, price 150.00
Gross differential: about 5.0% per year

Gross carry per year  = 100,000 x 5.0% = 5,000 USD
Gross carry per night = 5,000 / 365    = about 13.70 USD
Illustrative broker swap after markup  = +11.00 USD per night
Wednesday triple swap                  = 3 x 11.00 = 33.00 USD

Price risk:
Pip value per lot = 100,000 x 0.01 JPY = 1,000 JPY = 1,000 / 150 = 6.67 USD
A 300-pip fall (150.00 -> 147.00) = 300 x 6.67 = about 2,000 USD
Nights of swap needed to recover = 2,000 / 11 = about 182 nights
```

This is the core truth of the carry trade: the income is small and steady, the risk is large and sudden. Traders sometimes describe it as picking up coins in front of a steamroller. It works well for long periods, then gives back a large part of the gains in days.

## Why carry trades build up and unwind together

Carry is attractive when three conditions hold: a wide rate differential, low volatility and stable risk appetite. In such periods, many participants, from hedge funds to retail traders and Japanese households investing abroad, pile into the same trade. The funding currencies are typically those with the lowest rates, historically the Japanese yen and Swiss franc; the target currencies are those with higher rates.

Because so many positions are on the same side, carry trades are crowded by nature. When something increases volatility, whether a risk-off shock or a surprise policy change by the funding currency's central bank, the maths flips. A 5% annual carry is irrelevant if the currency can move 3% in a day, and traders rush to close. Closing a carry trade means *buying back the funding currency*, so the yen or franc can rally hard.

A clear recent case came in the summer of 2024. After the Bank of Japan raised rates and US data softened, the gap between the two was expected to narrow. USDJPY fell from above 161 in early July to below 142 in early August, a move of roughly 2,000 pips, as years of accumulated carry positions were unwound in a few weeks. That episode also dragged global equity indices lower, showing how carry, risk appetite and volatility are linked.

## Measuring carry against risk

A high rate differential on its own is not enough. A better measure is **carry-to-risk**: the annual differential divided by the pair's annual volatility.

| Pair (illustrative) | Differential | Annual volatility | Carry-to-risk |
|---|---|---|---|
| Pair A | 5.0% | 10% | 0.50 |
| Pair B | 3.0% | 5% | 0.60 |
| Pair C | 8.0% | 20% | 0.40 |

Pair C has the biggest headline yield, but also the most volatility per unit of carry. Pair B earns the most carry per unit of risk. Carry-to-risk tends to fall sharply before and during unwinds, because volatility rises, so it doubles as a warning signal.

## Using carry in your analysis

Even if you never hold a trade for the swap, carry shapes the markets you trade:

- **Trend support.** Positive carry encourages traders to hold a position, which can support a trend in the higher-yielding currency during calm periods.
- **Asymmetric reversals.** When a carry trade breaks, the move is usually fast. Yen crosses such as USDJPY, EURJPY and GBPJPY are prone to sharp drops in risk-off episodes.
- **Central-bank surprises.** The biggest risk for a carry trade is a rate change that narrows the differential, especially a hike by the funding currency's central bank.
- **Cost of the other side.** A short in a positive-carry pair pays swap every night. Holding a short USDJPY for weeks costs money even if the analysis is right.

> **Risk warning:** Carry trades are leveraged positions exposed to sudden, large moves. Swap income does not protect you from price losses, and a sharp unwind can produce losses far greater than months of accumulated swap.

## Common mistakes

- **Ignoring position size because swap is positive.** The swap is not a hedge. Size the position on price risk and a stop-loss, exactly as for any other trade.
- **Chasing the highest yield.** Very high-yielding currencies often carry very high volatility or political risk.
- **Forgetting the markup.** The swap you receive is smaller than the gross differential; check the actual rate in the specification.
- **Staying in as volatility rises.** Rising volatility is the first sign that the carry maths is turning against you.
