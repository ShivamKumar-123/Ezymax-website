---
slug: "p2-f-margin-level-and-stop-out"
title: "Margin level, margin call and stop-out"
summary: "Balance, equity, free margin and margin level explained, and exactly what happens as losses push an account towards stop-out."
order: 4
version: 1
takeaways:
  - "Equity is balance plus floating profit or loss, and it is equity, not balance, that protects your open positions."
  - "Margin level equals equity divided by used margin x 100%, and it falls as losses grow."
  - "A margin call, typically at 100%, is a warning; stop-out, typically at 50%, is forced closure starting with the largest losing position."
  - "You can calculate in advance the price at which your account would reach margin call or stop-out, and you should never let a trade get there."
quiz:
  - question: "Balance is 3,000 USD, floating loss is 400 USD and used margin is 1,300 USD. What is the margin level?"
    options:
      - "230.8%"
      - "300%"
      - "200%"
      - "43.3%"
    answer: 2
    explanation: "Equity is 3,000 - 400 = 2,600 USD. Margin level is 2,600 / 1,300 x 100% = 200%. Using the balance instead of equity would give the wrong 230.8%."
  - question: "What is free margin?"
    options:
      - "Equity minus used margin"
      - "Balance minus used margin"
      - "Margin that the broker lends you at no cost"
      - "The profit on your open positions"
    answer: 0
    explanation: "Free margin is equity minus used margin: the amount still available to absorb losses or to open new positions."
  - question: "An account with several losing positions reaches the stop-out level. What typically happens first?"
    options:
      - "All positions are closed at once"
      - "The newest position is closed"
      - "The largest losing position is closed, then the check repeats"
      - "The account is only sent a warning"
    answer: 2
    explanation: "At stop-out the largest losing position is closed first, and positions keep being closed one by one until the margin level recovers above the stop-out threshold. A warning is what a margin call is."
  - question: "Balance is 1,000 USD and used margin is 542.50 USD with stop-out at 50%. At what equity is the stop-out reached?"
    options:
      - "500.00 USD"
      - "542.50 USD"
      - "457.50 USD"
      - "271.25 USD"
    answer: 3
    explanation: "Stop-out happens when equity / margin = 50%, so equity = 0.5 x 542.50 = 271.25 USD. 542.50 USD is the equity at a 100% margin call."
---

The previous chapter showed how much margin a trade needs. This one follows what happens after you open it. As prices move, the numbers at the bottom of your Kalks Trader terminal change every second: equity, free margin and margin level. Knowing what each means, and where the danger lines are, is basic account survival.

## Five numbers on your account

- **Balance:** your deposits plus realised (closed) profit and loss, minus withdrawals. It does not change while trades are open.
- **Floating P&L:** the profit or loss on open positions if they were closed now, including accrued swaps and commissions.
- **Equity:** balance plus floating P&L. This is what your account is actually worth right now.
- **Used margin:** the total margin locked by open positions.
- **Free margin:** equity minus used margin. This is the room left to absorb losses or open new trades.

From these comes the single most important safety indicator:

```text
margin level = equity / used margin x 100%
```

With no open positions there is no used margin and no margin level. The moment you open a trade, margin level appears, and every loss pushes it lower.

## Margin call and stop-out

Kalks uses two thresholds, set per account group. The typical values are:

- **Margin call at 100%.** Equity has fallen to the size of your used margin. You are warned, and you will usually not be able to open new positions. Nothing is closed yet.
- **Stop-out at 50%.** Equity has fallen to half your used margin. The system begins closing positions automatically, starting with the **largest losing position**. After each closure margin level is recalculated, and closing continues one position at a time until margin level is back above the stop-out threshold.

Stop-out exists to prevent your equity from being wiped out entirely, but it is a blunt tool. It closes at the market price, which in a fast market or a gap may be worse than the level where stop-out was triggered.

```svg
<svg viewBox="0 0 640 190" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <text x="320" y="26" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="14" text-anchor="middle">Margin level scale (equity / used margin)</text>
  <rect x="40" y="70" width="140" height="28" fill="#ef4444"/>
  <rect x="180" y="70" width="140" height="28" fill="#ff5a1f"/>
  <rect x="320" y="70" width="280" height="28" fill="#22c55e"/>
  <line x1="40" y1="110" x2="600" y2="110" stroke="#3a3a44" stroke-width="1"/>
  <text x="40" y="128" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">0%</text>
  <text x="180" y="128" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">50%</text>
  <text x="320" y="128" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">100%</text>
  <text x="600" y="128" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">200%</text>
  <text x="110" y="150" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Positions closed</text>
  <text x="250" y="150" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Warning, no new trades</text>
  <text x="460" y="150" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Normal operation</text>
  <line x1="180" y1="58" x2="180" y2="104" stroke="#c9c9d1" stroke-width="2"/>
  <text x="180" y="52" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Stop-out</text>
  <line x1="320" y1="58" x2="320" y2="104" stroke="#c9c9d1" stroke-width="2"/>
  <text x="320" y="52" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Margin call</text>
  <line x1="556" y1="58" x2="556" y2="104" stroke="#c9c9d1" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="556" y="52" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Example start 184%</text>
  <text x="320" y="176" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Typical thresholds; exact levels depend on the account group</text>
</svg>
```

## A worked path to stop-out

Take a USD account with a 1,000 USD balance and 1:100 leverage. You buy 0.50 lot of EURUSD at 1.0850. For simplicity we ignore spread and commission, and the small change in required margin as the rate moves.

```text
Used margin = 50,000 x 1.0850 / 100 = 542.50 USD
Pip value   = 50,000 x 0.0001       =   5.00 USD per pip
Start: equity 1,000.00, margin level 1,000 / 542.50 = 184.3%
```

| EURUSD | Floating P&L | Equity | Free margin | Margin level |
|---|---|---|---|---|
| 1.0850 | 0.00 | 1,000.00 | 457.50 | 184.3% |
| 1.0800 | -250.00 | 750.00 | 207.50 | 138.2% |
| about 1.0759 | -457.50 | 542.50 | 0.00 | 100% (margin call) |
| 1.0750 | -500.00 | 500.00 | -42.50 | 92.2% |
| about 1.0704 | -728.75 | 271.25 | -271.25 | 50% (stop-out) |

The margin call arrives after a fall of 457.50 / 5 = 91.5 pips, and stop-out after 728.75 / 5 = 145.75 pips. EURUSD can move that far in a few days, and occasionally in a few hours around major news. Notice also that stop-out does not leave you with most of your money: at 50% this account has already lost almost three quarters of its balance.

> **Example:** You can find your stop-out distance directly. Equity at stop-out = 50% x used margin. Allowed loss = current equity - that figure. Divide by the pip value of all your positions to get the distance in pips.

## Several positions at once

Margin level is calculated across the whole account, so all open positions share one pool of equity. A losing trade on gold can bring your EURUSD trade into stop-out, even if EURUSD itself is profitable. When stop-out triggers, the largest losing position goes first. That might be exactly the trade you most wanted to keep.

> **Risk warning:** CFDs are leveraged. Gaps and fast markets can push equity well below the stop-out level before positions are closed, so the realised loss can be larger than your calculation suggests. Use a stop loss on every trade rather than relying on stop-out.

## In practice

- Treat 100% as an emergency, not a normal operating level. Most disciplined traders keep margin level in the high hundreds or thousands of percent.
- Watch equity, not balance, when trades are open.
- Adding a new position to rescue a losing one uses more margin and lowers margin level further.
- Depositing funds raises equity and margin level, but it does not fix a trade that was sized too large in the first place.
