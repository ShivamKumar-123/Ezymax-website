---
slug: "p2-f-account-types"
title: "Account types: demo, live, standard and cent"
summary: "What distinguishes demo from live, standard from cent, and how account conditions such as spreads, commission, leverage and position mode change the economics of each trade."
order: 7
version: 1
takeaways:
  - "A demo account uses virtual money with live-like prices and is the right place to learn the platform and test ideas at no cost."
  - "Cent accounts show balances in USC, where 1 USD = 100 USC, so a figure of 1,500 USC is only 15 USD."
  - "Account groups differ in spreads, commission, maximum leverage, stop-out level and swap treatment, so compare total trading cost, not one headline number."
  - "Each trading account has its own currency, leverage and position mode (netting or hedging), and you can hold several accounts for different purposes."
quiz:
  - question: "A cent account shows a balance of 4,250.00 USC. How much is that in US dollars?"
    options:
      - "4,250 USD"
      - "425 USD"
      - "42.50 USD"
      - "4.25 USD"
    answer: 2
    explanation: "1 USD = 100 USC, so 4,250 / 100 = 42.50 USD."
  - question: "What is the main limitation of a demo account compared with a live account?"
    options:
      - "Demo prices are random and unrelated to the market"
      - "Demo accounts cannot use stop losses"
      - "Demo accounts cannot trade gold"
      - "Demo fills and emotions do not fully reflect trading with real money"
    answer: 3
    explanation: "Demo accounts use realistic prices but no real money is at stake, so the psychological pressure is missing and fills in fast markets may differ from live execution."
  - question: "When comparing a spread-only account and a commission account, what should you compare?"
    options:
      - "The total cost per round turn: spread plus commission"
      - "Only the spread, because commission is small"
      - "Only the maximum leverage"
      - "The number of symbols available"
    answer: 0
    explanation: "A low spread with a commission can be cheaper or more expensive than a wider spread with none. Only the total cost per round turn makes them comparable."
  - question: "Which of these is set per trading account on Kalks?"
    options:
      - "The price of EURUSD"
      - "Leverage and position mode (netting or hedging)"
      - "The time of the New York close"
      - "The contract size of gold"
    answer: 1
    explanation: "Leverage and position mode belong to each trading account. Prices, session times and contract specifications belong to the symbol."
---

In the Client Area, the Accounts module lets you open more than one trading account, and they are not all the same. An account's type and group decide what you trade with, what each trade costs and how the platform treats your positions. Choosing well does not make you profitable, but choosing badly can make the same strategy noticeably more expensive or riskier.

## Demo and live

A **demo account** is funded with virtual money and connected to realistic live prices. It is free, it can be reset, and it lets you learn Kalks Trader, test order types and practise a routine without risking anything. Everything in the technical track of this phase is designed to be tried on demo first.

A **live account** uses real money. Prices and order types work the same way, but two things change:

- **Execution.** In fast markets live orders are subject to real liquidity, so slippage and fills may differ from what you experienced on demo.
- **Behaviour.** Losing virtual money is easy to shrug off. Losing real money changes how people act: they hesitate, move stops or close winners too early.

The sensible path is to use demo until your process is consistent, then move to live with a small size and treat the first weeks as a continuation of practice, not a change of plan.

## Standard and cent accounts

A **standard account** is denominated in a normal currency such as USD, so a balance of 500.00 means 500 dollars.

A **cent account** shows balances and results in US cents, labelled **USC**. The conversion is fixed: **1 USD = 100 USC**. A deposit of 20 USD appears as 2,000.00 USC. Cent accounts let beginners trade real money in very small amounts, with numbers large enough to be readable.

> **Example:** You deposit 20 USD into a cent account and see 2,000.00 USC. After a week, trade history shows a closed loss of 150.00 USC and a closed profit of 1,240.00 USC. In dollars, that is a 1.50 USD loss and a 12.40 USD profit, leaving a balance of 2,000 - 150 + 1,240 = 3,090 USC, or 30.90 USD.

The risk with cent accounts is psychological: a number like 3,090 looks large and can encourage careless sizing when you later move to a standard account where the same figure means real dollars. Always translate USC back into USD when you review results. Check the contract specification in Kalks Trader for how lot size maps to real exposure on a cent account, because it is not the same as on a standard account.

## Account groups and their conditions

Within live accounts, each account belongs to a group that sets its trading conditions. The main differences are:

| Condition | What varies | Why it matters |
|---|---|---|
| Spread | Wider on some groups, raw on others | Cost of every trade |
| Commission | None, or charged per lot round turn | Adds to spread cost |
| Maximum leverage | Typically 1:50 up to 1:1000 | Margin needed, room for over-sizing |
| Margin call / stop-out | Typically 100% / 50% | When positions are forcibly closed |
| Swaps | Standard or swap-free | Cost of holding overnight |

As shown in the chapter on trading costs, compare groups on total cost per round turn. A trader who holds positions for weeks should weigh swaps more heavily; a trader who opens many short trades a day should weigh spread and commission.

**Swap-free accounts** are available for clients who cannot pay or receive overnight interest. They can have different conditions, such as fees on positions held beyond a certain period, so read the account terms before choosing one.

> **Risk warning:** Higher leverage options do not make an account better. They make it easier to open positions that are too large for your equity. CFDs are leveraged products and losses can build quickly; start with conservative settings.

## Settings that belong to the account

Several choices are fixed per trading account rather than per trade:

- **Account currency**, which determines currency conversion on every result.
- **Leverage**, which can only be changed when the account has no open positions.
- **Position mode**, netting or hedging, covered in the technical track. Netting keeps one position per symbol; hedging allows several, including opposite ones.

Because these are per account, many traders keep separate accounts for separate purposes, for example one for longer-term swing trades and one for testing a new approach at small size. Other Client Area features, such as copy trading, PAMM and prop challenges, also run on their own accounts with their own rules, and are covered in later phases.

## In practice

- Open a demo account first and use it for every exercise in this phase.
- If you move to live, start with a cent account or the smallest size your plan allows.
- Write down your account's leverage, stop-out level, commission and typical spread on your most-traded symbols. These are the inputs to every calculation in this track.
- Review results in the Portfolio module in account currency, and for cent accounts convert to dollars.
