---
slug: "p9-o-selling-risk-and-margin"
title: "Selling options: risk and margin"
summary: "Why option sellers can lose many times the premium, how Ezymex calculates scenario-based margin, what happens at margin call and stop-out, and practical sizing rules for options."
order: 8
version: 1
takeaways:
  - "Selling an option earns a limited premium in exchange for a large or unlimited potential loss: unlimited for short calls, up to the strike minus the premium for short puts."
  - "Margin for sold options is scenario-based: Ezymex revalues your options on each underlying under 16 price and volatility scenarios and charges the worst loss. It is higher over the weekend."
  - "Options share one account and one margin pool with your CFDs. At stop-out, the position using the most margin is closed first, which is often a short option."
  - "There is no assignment because options are European and cash-settled, but Ezymex is the counterparty and sets prices, spreads widen in fast markets, and bonus or credit funds cannot pay premiums or margin."
  - "Size options by their worst case: the premium at risk for buyers, the scenario loss for sellers, and prefer spreads with a capped loss to naked short options."
practice:
  label: "Write down the equity of your demo account. Calculate the most premium you would pay for options on one idea at 1% risk, and how many short calls needing about 330 USD of margin each you could hold while keeping your margin level above 500%."
  symbol: "EURUSD"
quiz:
  - question: "You sell 5 one-week EURUSD 1.1750 calls at 10 USD each. EURUSD settles at 1.1950. What is the result?"
    options:
      - "-950 USD"
      - "+50 USD"
      - "-1,000 USD"
      - "-200 USD"
    answer: 0
    explanation: "Each call pays (1.1950 - 1.1750) x 10,000 = 200 USD, so you pay 1,000 USD in total. With the 50 USD premium received, the result is -950 USD, 19 times the premium."
  - question: "How does Ezymex calculate margin for sold options?"
    options:
      - "A fixed percentage of the contract value"
      - "It equals the premium received"
      - "The worst loss across 16 price and volatility scenarios for each underlying"
      - "There is no margin on options"
    answer: 2
    explanation: "Margin is scenario-based, similar to the SPAN method used by futures exchanges. Positions are revalued under 16 combinations of price and volatility moves, and the worst loss is charged."
  - question: "An account holding short options reaches the stop-out level. Which position is closed first?"
    options:
      - "The newest position"
      - "The position that uses the most margin"
      - "The most profitable position"
      - "All positions at once"
    answer: 1
    explanation: "With options in the account, stop-out closes the biggest margin consumer first and then checks again. That is often a short option, but it can also be a large CFD position."
  - question: "Can a deposit bonus be used to pay an option premium or options margin?"
    options:
      - "Yes, bonus funds work like cash"
      - "Only for buying calls"
      - "Only on Fridays"
      - "No, bonus or credit cannot pay premiums or margin"
    answer: 3
    explanation: "Premiums and options margin must be covered by your own cash balance. Bonus or credit funds do not count towards either."
---

Selling options feels comfortable: most of the time the option expires worthless and the seller keeps the premium. The problem is the rest of the time. This chapter covers what can go wrong for sellers, how Ezymex calculates the margin that guards against it, and how to size option trades on both sides.

## Small premium, large risk

When you sell an option, your maximum gain is fixed at the premium. Your maximum loss is not.

- A **short call** has no limit, because there is no limit to how high a price can rise.
- A **short put** can lose up to the strike minus the premium, which is almost the full value of the contract.

> **Example:** You sell 5 one-week EURUSD 1.1750 calls at 10 USD each and receive 50 USD. An unexpected policy announcement lifts EURUSD, and it settles at 1.1950. Each call pays (1.1950 - 1.1750) x 10,000 = 200 USD, so you pay 1,000 USD. Your result is 50 - 1,000 = -950 USD, 19 times the premium you collected.

> **Example:** You sell 2 one-month XAUUSD 3,700 puts at 13 USD each and receive 26 USD. Gold falls sharply and settles at 3,450. You pay (3,700 - 3,450) x 2 = 500 USD, a result of -474 USD.

## Gap risk

A stop loss cannot protect a short option over a weekend or through a news gap: the market is either closed or jumps straight past your level. Short options near the money are the most exposed, because gamma makes their losses grow faster as a move extends. Gold, silver and oil are especially prone to weekend gaps.

## How margin for sellers works

Buyers pay the full premium and post no margin. Sellers receive the premium but must post margin, which Ezymex calculates with a **scenario-based** method similar to the SPAN system used by futures exchanges. For each underlying, all your options positions are revalued one business day ahead under 16 scenarios:

| Scenarios | Price move | Volatility |
|---|---|---|
| 1-2 | None | Up, down |
| 3-6 | One third of the scan range, up and down | Up, down |
| 7-10 | Two thirds of the scan range, up and down | Up, down |
| 11-14 | The full scan range, up and down | Up, down |
| 15-16 | Three times the scan range, up and down | Unchanged; 35% of the loss counts |

The **scan range** is set per underlying, for example 3% of the price. Your margin is the **largest loss** across the scenarios. Positions that offset each other, such as the bought leg of a spread, reduce that loss, which is why spreads with a capped loss need much less margin than naked short options.

> **Example:** With a 3% scan range, a short one-week EURUSD 1.1750 call that brought in about 10 USD needs roughly 330 USD of margin, more than 30 times the premium.

Margin is **higher over weekends**. On Fridays an add-on, for example 25%, covers the risk of a gap when the market reopens, so about 330 USD becomes about 410 USD. Margin also changes whenever spot or volatility moves: a short option moving into the money can need several times its original margin.

## Margin call and stop-out

Options and CFDs share **one trading account and one margin pool**. Option values count in your equity and option margin counts in your used margin, so margin level, margin call and stop-out work as you learned in Phase 2, with one difference: when an account holding options reaches the stop-out level, the system closes the **position that uses the most margin first**, often a short option, and then checks again. A losing short option can therefore force out your CFD positions, and a losing CFD can force out your options.

## No assignment, but other risks

Ezymex options are European and cash-settled, so there is **no early exercise and no assignment**. Nobody can exercise against you before expiry, and you never receive or deliver the underlying. At expiry, an in-the-money short option is simply debited the difference.

Other risks remain:

- **Counterparty and pricing.** Ezymex is the counterparty to every trade and sets the prices; there is no exchange order book. Spreads can widen in fast markets and around major news, and in abnormal conditions trading may be limited to closing only, or paused.
- **Expiry day.** New positions are not accepted in the last 15 minutes before the cut.
- **Bonus and credit.** Bonus or credit funds cannot pay premiums or cover options margin. Only your own cash balance counts.
- **Position limits.** There are maximum numbers of contracts per order and per client, and Ezymex may set lower individual limits.

## Sizing rules

1. **Buyers:** treat the whole premium as the amount at risk. At 1% risk on a 5,000 USD account, that is 50 USD of premium for the idea in total, not per contract.
2. **Sellers:** size by the worst realistic loss, not by the premium. Ask what a move of three times the scan range would cost, and whether your account would survive it.
3. **Prefer a capped loss.** Spreads, iron condors and butterflies limit the loss; naked short calls do not.
4. **Respect the calendar.** Weekend margin is higher, and expiry day brings the most violent price sensitivity.
5. **Keep your margin level high.** Treat options margin like CFD margin and stay well above 100% at all times.

> **Risk warning:** Selling options can produce losses many times larger than the premium received, and a gap can push your account to stop-out before you can react. Do not sell options until you can calculate the worst case of every position and have practised on a demo account.

## Common mistakes

- **Judging a short option by its premium.** The premium is the most you can make, not a measure of risk.
- **Ignoring the weekend.** Friday margin is higher and Monday gaps cannot be stopped.
- **Selling more contracts to recover a loss.** It multiplies the same open-ended risk.
