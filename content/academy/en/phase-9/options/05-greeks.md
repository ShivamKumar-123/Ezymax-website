---
slug: "p9-o-greeks"
title: "The Greeks in plain words"
summary: "Delta, gamma, theta, vega and rho explained without formulas, implied versus realised volatility, and why options behave so differently in their final hours."
order: 5
version: 1
takeaways:
  - "Delta is how much the premium moves for a small move in the underlying. Delta x contract size gives your equivalent exposure, and delta is also a rough guide to the chance of finishing in the money."
  - "Gamma is how fast delta changes. It is highest for at-the-money options close to expiry, which is why their value can swing so sharply."
  - "Theta is time decay: what the option loses per day if nothing else changes. It speeds up in the final days and works against buyers and for sellers."
  - "Vega is the change in premium for a one-point change in implied volatility. Buyers gain when implied volatility rises; sellers lose."
  - "Implied volatility is the movement priced into the option; realised volatility is the movement that actually happens. A buyer needs the market to move more than the premium implies."
practice:
  label: "On your demo account, note EURUSD's daily close-to-close change for the last 20 trading days. Compare the typical size with the one-day move implied by 6.6% volatility: 6.6% / sqrt(260) x 1.1650, about 48 pips."
  symbol: "EURUSD"
quiz:
  - question: "A EURUSD call has a delta of 0.40. EURUSD rises 25 pips. Roughly how much does the premium of one contract change?"
    options:
      - "+25 USD"
      - "+10 USD"
      - "+4 USD"
      - "-10 USD"
    answer: 1
    explanation: "The premium moves by about delta x the move: 0.40 x 25 pips = 10 pips. On a 10,000-euro contract one pip is 1 USD, so about +10 USD."
  - question: "Which Greek describes how much value an option loses each day if nothing else changes?"
    options:
      - "Delta"
      - "Vega"
      - "Theta"
      - "Rho"
    answer: 2
    explanation: "Theta measures time decay. It is a daily cost for option buyers and a daily source of income for option sellers."
  - question: "A one-month option has a vega of 13 USD per contract. Implied volatility rises from 7% to 9%. What happens to the premium, all else being equal?"
    options:
      - "It rises by about 26 USD"
      - "It rises by about 13 USD"
      - "It falls by about 26 USD"
      - "It does not change"
    answer: 0
    explanation: "Vega is the change per one volatility point. A two-point rise adds about 2 x 13 = 26 USD per contract, without any move in spot."
  - question: "Why can an at-the-money 0DTE option double or lose most of its value within hours?"
    options:
      - "Its gamma is very high, so small price moves swing its delta and value sharply"
      - "Its vega is at its highest on expiry day"
      - "Interest rates change during the day"
      - "Ezymex reprices it only once a day"
    answer: 0
    explanation: "Close to expiry, at-the-money gamma is very large: a few pips decide whether the option ends in or out of the money. Vega, by contrast, is tiny at that stage."
---

An option's premium depends on several inputs at once: the price of the underlying, time, volatility and interest rates. The **Greeks** measure how much the premium changes when one of those inputs changes and the others stay the same. The option chain shows them for every strike, in USD per contract where that makes sense. You do not need the formulas, but you do need to know what each one tells you.

## Delta: sensitivity to the price

**Delta** is the change in the premium for a small move in the underlying, as a fraction of that move.

- Calls have a delta between 0 and 1; puts between 0 and -1.
- At-the-money options have a delta of about 0.5, or -0.5 for puts.
- Deep in-the-money options approach 1 (or -1) and move almost like the underlying; far out-of-the-money options approach 0.

> **Example:** EURUSD is at 1.1650. The one-week 1.1700 call has a delta of 0.33. If EURUSD rises 20 pips, the premium rises by about 0.33 x 20 = 6.6 pips, or about 6.60 USD per contract.

Delta also gives your **equivalent exposure**. One EURUSD contract is 10,000 euros, so a delta of 0.33 behaves like 3,300 euros, or 0.033 lot of a EURUSD CFD, for small moves. Traders also read delta as a rough guide to the chance of the option finishing in the money: about one in three for that call.

## Gamma: how fast delta changes

**Gamma** measures how much delta changes as the price moves. It is what makes options non-linear.

> **Example:** With EURUSD at 1.1650, a one-week 1.1650 call has a delta of about 0.52. If EURUSD rises to 1.1700, its delta increases to about 0.69; if EURUSD falls to 1.1600, delta drops to about 0.33. The option gains faster as the price moves in its favour and loses more slowly as it moves against it.

Gamma is highest for at-the-money options close to expiry. For buyers, gamma helps: the position grows into a move. For sellers it is dangerous: a short option's exposure increases just as the market moves against it.

## Theta: time decay

**Theta** is how much the premium falls over one day if nothing else changes. On the chain it is shown in USD per contract.

| EURUSD 1.1650 call, 6.6% volatility | Premium | Theta per day | Share lost per day |
|---|---|---|---|
| One month to expiry | about 96 USD | about -1.75 USD | about 2% |
| One week to expiry | about 44 USD | about -3.40 USD | about 8% |

Decay speeds up as expiry approaches and is fastest for at-the-money options. Ezymex measures time for volatility in business time, so a quiet weekend removes less value than a trading day does. Theta is a cost for buyers and the main source of income for sellers.

## Vega: sensitivity to volatility

**Vega** is the change in premium for a one-point change in implied volatility, for example from 7% to 8%. A one-month at-the-money EURUSD option has a vega of about 13 USD per contract, a one-week option about 6 USD. Longer-dated options are more sensitive to volatility.

Vega explains why option prices can change when spot does not. Ahead of a central-bank decision, implied volatility often rises and options become more expensive. After the announcement it usually drops, and premiums fall even if the price has moved. This **volatility crush** often surprises new buyers.

## Rho: sensitivity to interest rates

**Rho** measures the effect of interest rates. For the short expiries listed on Ezymex, from one day to a few months, it is small and you can usually ignore it.

## Implied versus realised volatility

**Implied volatility** is the volatility figure that, put into the pricing model, gives the option's price. It is the market's expected movement, quoted as an annual percentage. **Realised volatility** is how much the price actually moved, measured from past prices. Ezymex sets its implied volatility from a volatility surface for each underlying, blended with recent realised volatility.

The comparison matters. A buyer pays for the implied movement. If the market then moves less than implied, time decay wins and the buyer usually loses. If it moves more, the buyer usually wins. A seller takes the opposite bet.

## Near expiry and 0DTE options

In the final day, and especially the final hours, these effects become extreme:

- **Gamma** of at-the-money options is very high. Six hours before the cut, delta can move from about 0.25 to about 0.75 as EURUSD moves 30 pips.
- **Theta** is large compared with the premium: the remaining time value disappears within hours.
- **Vega** is tiny. Volatility expectations hardly matter any more; only where the price settles does.

> **Example:** Six hours before the cut, with EURUSD at 1.1650, a 0DTE 1.1650 call is worth about 8 USD. If EURUSD rises 15 pips it is worth about 18 USD; if it falls 15 pips, about 3 USD.

In the last 30 minutes, the settlement average is already being built, so each passing minute locks in part of the result and the option reacts less and less to new price moves.

> **Risk warning:** 0DTE options are cheap in dollars but can lose their entire value within hours. Selling them earns small premiums against the risk of a sudden move with very little time to react.

## Common mistakes

- **Ignoring vega around events.** You can be right on direction and still lose if implied volatility collapses.
- **Treating delta as fixed.** It changes with the price, through gamma, and with time.
- **Underestimating theta in the final week.** Decay is steepest just when many buyers are still waiting for their move.
