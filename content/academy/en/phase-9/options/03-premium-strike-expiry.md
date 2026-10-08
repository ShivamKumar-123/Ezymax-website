---
slug: "p9-o-premium-strike-expiry"
title: "Premium, strike and expiry"
summary: "What an option price is made of, what makes it rise or fall, how expiries, the 10:00 New York cut and the settlement average work, and how premiums are quoted per contract."
order: 3
version: 1
takeaways:
  - "Premium = intrinsic value + time value. Intrinsic value is what the option would pay now; time value is what you pay for the chance of a better outcome before expiry, and it falls to zero at the cut."
  - "More time to expiry and higher implied volatility raise the premium of both calls and puts. Spot moving towards or through the strike raises it too, while interest rates have a smaller effect."
  - "Options expire daily, weekly (Friday) and monthly (last Friday) at the 10:00 New York cut, moved to the previous business day for holidays. Settlement is the 30-minute average of the mid price before the cut."
  - "No new positions can be opened in an expiry during the last 15 minutes before its cut; you can still close."
  - "Premiums are shown in USD per contract alongside pips or points. You buy at the ask and sell at the bid, so the spread is a cost on every round trip."
practice:
  label: "On your demo account, note the EURUSD price at 09:30 New York time (16:30 server time) and every five minutes until 09:55, then average your readings. This is a rough version of how the settlement price is calculated."
  symbol: "EURUSD"
quiz:
  - question: "EURUSD is at 1.1650 and a 1.1600 call costs 0.0075. How much of the premium is time value?"
    options:
      - "0.0025"
      - "0.0050"
      - "0.0075"
      - "0.0125"
    answer: 0
    explanation: "Intrinsic value is 1.1650 - 1.1600 = 0.0050. Time value is the rest: 0.0075 - 0.0050 = 0.0025, or 25 USD per contract."
  - question: "Which change raises the premium of both calls and puts, all else being equal?"
    options:
      - "Spot moving towards the call strike"
      - "A rise in implied volatility"
      - "Less time to expiry"
      - "A narrower spread on the CFD"
    answer: 1
    explanation: "More expected movement makes every option more valuable, so higher implied volatility raises calls and puts alike. A move in spot helps one type and hurts the other, and less time lowers both."
  - question: "How is the settlement price of a Ezymex option determined?"
    options:
      - "The last bid before the cut"
      - "The close of the daily candle"
      - "The time-weighted average of the mid price over the 30 minutes before the cut"
      - "The price at which the most contracts traded that day"
    answer: 2
    explanation: "Settlement uses a TWAP of the mid price from 09:30 to 10:00 New York time for the default cut. Averaging makes the settlement much less sensitive to a single spike."
  - question: "An XAGUSD option is quoted at 0.40 per ounce. What does one contract cost?"
    options:
      - "0.40 USD"
      - "4 USD"
      - "40 USD"
      - "20 USD"
    answer: 3
    explanation: "One silver contract is 50 ounces, so the premium is 0.40 x 50 = 20 USD per contract."
  - question: "It is 09:50 New York time on expiry day. What can you do in that day's expiry?"
    options:
      - "Open new positions and close existing ones"
      - "Only close existing positions"
      - "Nothing until the next day"
      - "Only open new positions"
    answer: 1
    explanation: "New opens stop 15 minutes before the cut, at 09:45 for the 10:00 New York cut. Existing positions can still be closed, or left to settle automatically."
---

When you look at an option quote, you see one number per side: the premium. This chapter takes that number apart: what it is made of, what moves it, when and how options expire, and how the premium translates into dollars per contract.

## Intrinsic value and time value

Every premium has two parts:

```text
Premium              = intrinsic value + time value
Call intrinsic value = max(spot - strike, 0)
Put intrinsic value  = max(strike - spot, 0)
```

**Intrinsic value** is what the option would pay if it expired right now. **Time value** is everything else: what buyers pay for the chance that the price moves further in their favour before expiry.

> **Example:** EURUSD is at 1.1650. A one-week 1.1600 call costs 0.0075. Its intrinsic value is 1.1650 - 1.1600 = 0.0050, so its time value is 0.0075 - 0.0050 = 0.0025. A one-week 1.1700 call costs 0.0024. It has no intrinsic value, so its whole premium is time value.

Time value shrinks as expiry approaches and is zero at the cut, when only intrinsic value is left. This is called **time decay**. It works against buyers and for sellers every day.

## What drives the premium

| Factor | Effect on calls | Effect on puts |
|---|---|---|
| Spot rises | Up | Down |
| Spot falls | Down | Up |
| More time to expiry | Up | Up |
| Higher implied volatility | Up | Up |
| Quote-currency rate rises against the base-currency rate | Up, slightly | Down, slightly |

- **Spot versus strike.** The closer the price moves to the strike, or the deeper into the money, the more the option is worth.
- **Time.** Premium grows with the square root of time, not in a straight line. With EURUSD at 1.1650 and implied volatility at 6.6%, an at-the-money call costs roughly 16 USD for one day, 44 USD for one week and 96 USD for one month. About four times the time costs only about twice as much.
- **Volatility.** Implied volatility is the movement the market expects, as an annual percentage. The more movement expected, the more an option is worth. If implied volatility for that one-week call rose from 6.6% to 8.6%, its premium would rise from about 44 to about 57 USD with no change in spot.
- **Interest rates.** The gap between the two currencies' interest rates, or the financing cost of a metal or oil, shifts the forward price slightly. For short-dated options the effect is small.

## Expiries and the cut

Ezymex lists three expiry cycles on every underlying:

- **Daily** options expire every business day. On their last day they are called 0DTE (zero days to expiry) options.
- **Weekly** options expire on Fridays.
- **Monthly** options expire on the last Friday of the month.

If an expiry falls on a holiday, it moves to the **previous** business day. Options expire at the **cut**, 10:00 New York time by default, which is 17:00 server time in Ezymex Trader.

The settlement price is the **time-weighted average (TWAP) of the mid price** from 09:30 to 10:00 New York time. The mid is halfway between bid and ask, so a wider spread does not by itself move the settlement. Every passing minute fixes more of the average, so a sharp move at 09:58 has only a small effect.

In the **last 15 minutes before the cut** you cannot open new positions in that expiry. You can still close existing positions until shortly before the cut, or let them settle automatically.

## Contract sizes and how premiums are quoted

| Underlying | One contract | Price move and its value per contract |
|---|---|---|
| EURUSD, GBPUSD, AUDUSD, NZDUSD | 10,000 base currency | 0.0001 = 1 USD |
| USDJPY | 10,000 USD | 0.01 = 100 JPY, about 0.68 USD at 147.50 |
| XAUUSD | 1 oz | 1.00 = 1 USD |
| XAGUSD | 50 oz | 0.01 = 0.50 USD |
| USOIL, UKOIL | 10 barrels | 0.01 = 0.10 USD |

The other pairs follow the same rule of 10,000 units of the base currency. The quote shows the premium in the underlying's own terms, such as 24 pips for a EURUSD option, and in **USD per contract**. For pairs not quoted in USD, such as USDJPY, USDCAD or EURJPY, the premium is converted to USD at the current rate.

## Bid and ask

Ezymex quotes every strike with a **bid**, where you can sell, and an **ask**, where you can buy. The spread comes from pricing the bid at a slightly lower volatility and the ask at a slightly higher one, with a minimum spread in USD. As a result the spread in dollars is wider for options that are more sensitive to volatility, typically longer-dated and at-the-money ones.

> **Example:** The one-week EURUSD 1.1700 call is quoted 0.0022 / 0.0024. You buy at 24 USD. If you sold immediately, you would receive 22 USD and lose 2 USD per contract. That spread is a real cost on every round trip.

## Common mistakes

- **Ignoring time decay.** An option can lose value even when the price does not move against you.
- **Comparing expiries in straight lines.** A one-month option is not four times the price of a one-week option.
- **Planning to open a position at 09:50 New York time on expiry day.** New opens stop 15 minutes before the cut.
