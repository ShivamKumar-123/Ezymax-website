---
slug: "p8-t-prop-firm-readiness"
title: "Prop-firm readiness: trading within loss limits"
summary: "Understand how prop challenges work, how daily loss and maximum drawdown rules are calculated, what they cost, and how to adapt your risk so a single bad day does not end the account."
order: 5
version: 1
takeaways:
  - "Prop challenges are paid evaluations with strict rules; the fee is a real cost and most attempts do not reach a payout."
  - "Daily loss limits usually include floating losses, so an open trade can breach the rule even if it later recovers."
  - "A trailing maximum drawdown moves up with your equity peak, leaving far less room than a static limit of the same percentage."
  - "Passing requires lower risk per trade and a personal daily stop set well inside the firm's limits."
  - "Read the exact rules of each challenge, including how limits are measured, news restrictions and payout terms, before paying."
practice:
  label: "On a demo account, trade for two weeks with a personal daily stop of 2% and a maximum drawdown of 6%, and record whether you would have breached a typical challenge's rules."
  symbol: "EURUSD"
quiz:
  - question: "A 100,000 USD challenge has a 5% daily loss limit measured from the start-of-day balance of 103,000 USD, including floating losses. At what equity level is the rule breached?"
    options:
      - "95,000 USD"
      - "97,850 USD"
      - "98,000 USD"
      - "93,000 USD"
    answer: 2
    explanation: "Under this rule the limit is 5% of the initial 100,000, or 5,000 USD, subtracted from the start-of-day balance: 103,000 - 5,000 = 98,000. Some firms calculate 5% of the day's starting balance instead, which would give 97,850, so always check the exact definition."
  - question: "Equity on a 100,000 USD account peaks at 106,000. Under a 10% trailing drawdown that trails the equity peak, where is the floor?"
    options:
      - "90,000 USD"
      - "96,000 USD"
      - "95,400 USD"
      - "100,000 USD"
    answer: 1
    explanation: "A trailing limit follows the peak: 106,000 - 10,000 = 96,000. A static limit would remain at 90,000. Many firms stop trailing once the floor reaches the starting balance."
  - question: "Why do floating losses matter for daily loss rules?"
    options:
      - "They do not matter; only closed trades count"
      - "They reduce the challenge fee"
      - "They are only counted on Fridays"
      - "Many firms measure the limit on equity, so an open losing trade can breach the rule even if it would later recover"
    answer: 3
    explanation: "Equity-based rules are checked continuously. A position that is temporarily down more than the limit ends the challenge, regardless of where it would have closed."
  - question: "A strategy wins 45% of trades at an average of 1.5R and loses 1R otherwise, risking 0.5% (500 USD) on a 100,000 USD challenge. Roughly how many trades would it need on average to reach an 8% target?"
    options:
      - "About 128 trades"
      - "About 16 trades"
      - "About 40 trades"
      - "About 500 trades"
    answer: 0
    explanation: "Expectancy = 0.45 x 1.5 - 0.55 x 1 = 0.125R, or 62.50 USD per trade. 8,000 / 62.50 = 128 trades on average, and variance means some attempts will need many more."
---

Proprietary trading challenges let traders pay a fee to attempt an evaluation on a large simulated or funded account. If they meet a profit target without breaking loss rules, they may qualify for an account where a share of profits can be paid out. The Client Area includes a Prop challenges module; this chapter explains how such rules work in general, so you can judge honestly whether you are ready and whether a challenge makes sense for you.

## How a typical challenge is structured

Details vary between firms and programmes, but a common structure looks like this:

| Rule | Typical range |
|---|---|
| Profit target, phase 1 | 8% to 10% |
| Profit target, phase 2 | 4% to 5% |
| Daily loss limit | 4% to 5% |
| Maximum loss | 8% to 12%, static or trailing |
| Minimum trading days | 0 to 5 days per phase |
| Other conditions | News trading restrictions, weekend holding rules, consistency rules, maximum lot sizes |

Many funded accounts are simulated: profits paid to the trader come from the firm under its terms, not from trading real client capital. Payouts are subject to conditions, can be refused for rule breaches, and profit splits vary. **No challenge guarantees a payout, and the fee is lost if you fail.** Always read the full rules of the specific challenge in the Client Area before you pay.

## Daily loss limits

The daily limit is the rule that ends most attempts. Two details matter:

- **What it is measured from:** the start-of-day balance, the start-of-day equity, or the higher of the two.
- **Whether floating losses count:** most firms check equity continuously, so an open trade can breach the rule even if it would have recovered.

```text
Account size 100,000 USD, daily limit 5% of initial balance = 5,000 USD
Start-of-day balance 103,000 USD
Breach level = 103,000 - 5,000 = 98,000 USD equity

Open trades at 14:00: floating loss 4,200 USD -> equity 98,800 (safe)
News spike at 14:30: floating loss 5,100 USD  -> equity 97,900 (breach)
```

The trader above breached the rule on a floating loss, even if price reversed minutes later. The daily day usually resets at a fixed server time, so know exactly when it is.

## Static versus trailing maximum drawdown

```svg
<svg viewBox="0 0 560 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <line x1="60" y1="260" x2="530" y2="260" stroke="#3a3a44" stroke-width="1.5"/>
  <line x1="60" y1="30" x2="60" y2="260" stroke="#3a3a44" stroke-width="1.5"/>
  <text x="14" y="96" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">106k</text>
  <text x="14" y="144" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">100k</text>
  <text x="14" y="176" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">96k</text>
  <text x="14" y="224" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">90k</text>
  <polyline points="60,140 110,128 160,134 210,112 260,92 310,118 360,150 410,166 460,150 520,140" fill="none" stroke="#c9c9d1" stroke-width="2.5"/>
  <line x1="60" y1="220" x2="520" y2="220" stroke="#22c55e" stroke-width="2" stroke-dasharray="6 4"/>
  <polyline points="60,220 110,208 160,208 210,192 260,172 520,172" fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="6 4"/>
  <circle cx="410" cy="166" r="5" fill="#ff5a1f"/>
  <text x="360" y="194" fill="#ff5a1f" font-family="Inter, Arial, sans-serif" font-size="12">Near trailing floor</text>
  <text x="380" y="240" fill="#22c55e" font-family="Inter, Arial, sans-serif" font-size="12">Static floor 90k</text>
  <text x="270" y="164" fill="#ef4444" font-family="Inter, Arial, sans-serif" font-size="12">Trailing floor</text>
  <text x="250" y="80" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Equity</text>
  <text x="60" y="285" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Same 10% limit: static stays at 90k, trailing follows the equity peak</text>
</svg>
```

With a **static** limit, the floor stays at 90,000 on a 100,000 account however high equity climbs. With a **trailing** limit, the floor follows the highest equity or balance reached. If equity peaks at 106,000, the floor rises to 96,000. A pullback of 10,000 from the peak ends the account, even though the trader is still below the original starting balance by only 4,000. Many firms stop trailing once the floor reaches the starting balance. Trailing rules punish strategies that give back open profit, such as trend systems with wide trailing stops.

## Adapting your risk

Most retail strategies are designed for normal accounts, where a 15% drawdown is painful but survivable. A challenge compresses tolerance into a narrow band, so risk must be scaled down.

- **Risk per trade:** 0.25% to 0.5% is common among traders who pass; 1% or more leaves little room for a normal losing streak.
- **Personal daily stop:** set one well inside the firm's rule, for example 2% when the limit is 5%, and stop trading for the day when it is hit.
- **Correlated positions:** three USD trades at 0.5% each are effectively one 1.5% trade.
- **News:** check whether news trading is restricted, and remember that spikes can breach limits via floating losses.

The profit target also takes time. At 0.5% risk, a system with 45% winners averaging 1.5R and 1R losers has an expectancy of 0.45 x 1.5 - 0.55 x 1 = 0.125R, or 62.50 USD per trade on 100,000. Reaching 8,000 needs about 128 trades on average, and more in unlucky sequences. Raising risk to hit the target faster is exactly what makes most attempts fail.

## The economics of the fee

Treat the fee as a business cost. If a challenge costs 500 USD and, hypothetically, a trader's realistic pass rate is one in four, the expected fee cost per pass is 2,000 USD before any payout, and passing does not guarantee future payouts. Your demo record under the same rules is the best estimate of your pass rate. Trade at least a month on demo using the exact limits; if you would have breached them, you are not ready yet.

## Common mistakes

- **Treating the challenge like a lottery ticket,** with oversized risk to reach the target quickly.
- **Misreading the daily limit definition** or its reset time.
- **Revenge trading after a loss,** which is the fastest route to the daily limit.
- **Ignoring trailing mechanics,** letting a large open profit reverse into a breach.

> **Risk warning:** Prop challenges involve non-refundable fees and strict rules, and many participants do not pass or receive payouts. Trading CFDs is leveraged and risky; only pay for a challenge with money you can afford to lose, and read every rule first.
