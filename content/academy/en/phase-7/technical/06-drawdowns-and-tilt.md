---
slug: "p7-t-drawdowns-and-tilt"
title: "Drawdowns and tilt"
summary: "Why every strategy has drawdowns, how to tell normal losing streaks from a broken edge, and how to stop tilt from turning a bad day into a bad month."
order: 6
version: 1
takeaways:
  - "Drawdowns and losing streaks are a normal, statistically expected part of any strategy, including profitable ones."
  - "The gain needed to recover grows faster than the loss, which is why keeping risk per trade small protects the account."
  - "Tilt is an emotional state in which decisions stop following the plan; it usually shows up as larger size, more trades or abandoned stops."
  - "Pre-set circuit breakers, such as daily loss limits and cooling-off periods, work better than trying to calm down in the moment."
  - "Compare a drawdown with the strategy's tested statistics before deciding whether the edge has changed."
practice:
  label: "Using your demo statistics, calculate how large your account drawdown would be after eight consecutive losses at your current risk per trade."
  symbol: "XAUUSD"
quiz:
  - question: "An account falls 20% from its peak. What gain is needed to return to the peak?"
    options:
      - "20%"
      - "22%"
      - "40%"
      - "25%"
    answer: 3
    explanation: "After a 20% loss, 80 remains. To get back to 100 requires 20 / 80 = 25%. Recovery always needs a larger percentage than the loss."
  - question: "With a 10,000 USD account and 1% risk per trade on the current balance, what is the balance after eight consecutive losses?"
    options:
      - "About 9,227 USD"
      - "9,200 USD"
      - "About 7,837 USD"
      - "9,920 USD"
    answer: 0
    explanation: "10,000 x 0.99^8 = 9,227.45 USD, a drawdown of about 7.7%. 7,837 USD is the result at 3% risk per trade."
  - question: "Which behaviour is a typical sign of tilt?"
    options:
      - "Taking a planned setup at planned size after a loss"
      - "Doubling position size immediately after a loss to win it back"
      - "Stopping for the day after hitting the daily loss limit"
      - "Recording the loss in the journal"
    answer: 1
    explanation: "Increasing size to recover a loss quickly is revenge trading, a classic tilt behaviour. The other options are disciplined responses."
  - question: "A strategy's backtest showed a maximum losing streak of 9 trades. In live trading it has just lost 6 in a row. What is the best response?"
    options:
      - "Abandon the strategy immediately"
      - "Increase risk so the next win recovers everything"
      - "Continue at planned risk, check execution for errors, and review against the tested statistics"
      - "Switch to a different timeframe for the next trade"
    answer: 2
    explanation: "Six losses is within the tested range, so it is not evidence of a broken edge. Check for execution mistakes and keep risk unchanged."
---

Every trader experiences drawdowns. What separates those who last from those who do not is less the size of the drawdown than what they do during it. A drawdown handled calmly is a cost of doing business. A drawdown that triggers tilt, the emotional spiral of revenge trades and abandoned rules, can destroy months of progress in a few sessions.

## Losing streaks are normal

Even a strategy with a genuine edge loses often. With a 40% win rate, the chance that any particular sequence of eight trades is all losses is 0.6 to the power of 8, about 1.7%. That sounds small, but across several hundred trades there are hundreds of such sequences, so a run of eight or more losses becomes likely at some point. Rough estimates for a 40% win rate suggest the longest losing run over a few hundred trades will often be around eight to ten.

If you do not expect these streaks, you will interpret them as proof that something is wrong, and act on that belief at the worst time.

## The mathematics of recovery

A percentage loss requires a larger percentage gain to recover, because the gain is earned on a smaller balance.

| Drawdown | Gain needed to recover |
|---|---|
| 10% | 11.1% |
| 20% | 25.0% |
| 30% | 42.9% |
| 50% | 100.0% |

This is the strongest argument for modest risk per trade. The same eight-loss streak has very different consequences at different risk levels:

```text
Starting balance 10,000 USD, eight consecutive losses,
risk calculated on the current balance each time

At 1% risk: 10,000 x 0.99^8 = 9,227.45 USD  (drawdown 7.7%)
At 3% risk: 10,000 x 0.97^8 = 7,837.43 USD  (drawdown 21.6%)

Recovery needed from 9,227.45: 772.55 / 9,227.45 = 8.4%
Recovery needed from 7,837.43: 2,162.57 / 7,837.43 = 27.6%
```

```svg
<svg viewBox="0 0 520 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <line x1="60" y1="30" x2="60" y2="220" stroke="#3a3a44"/>
    <line x1="60" y1="220" x2="490" y2="220" stroke="#3a3a44"/>
    <text x="275" y="248" text-anchor="middle">Trades</text>
    <text x="22" y="125" transform="rotate(-90 22 125)" text-anchor="middle">Equity</text>
    <polyline points="70,190 110,170 150,175 190,140 230,120 260,70 290,95 320,115 350,150 380,140 410,120 440,90 480,50" fill="none" stroke="#22c55e" stroke-width="2"/>
    <line x1="260" y1="70" x2="490" y2="70" stroke="#3a3a44" stroke-dasharray="4 4"/>
    <text x="264" y="62">Equity peak</text>
    <line x1="350" y1="70" x2="350" y2="150" stroke="#ef4444" stroke-width="2"/>
    <text x="356" y="170" fill="#ef4444">Maximum drawdown</text>
    <text x="356" y="185" fill="#ef4444">(peak to trough)</text>
    <text x="440" y="110" text-anchor="middle">Recovery</text>
  </g>
</svg>
```

> **Risk warning:** CFDs are leveraged, and gaps or slippage can make individual losses larger than 1R. Real drawdowns can therefore exceed the figures calculated from planned risk alone.

## What tilt looks like

Tilt is a state in which emotion, usually frustration, fear or a need to get even, takes over decision-making. It rarely feels like a decision. Common signs:

- Increasing size after a loss to "win it back".
- Taking trades that are not in the plan, often in markets you do not usually trade.
- Removing or widening stops.
- Trading faster: shorter time between trades, less analysis, more market orders.
- Continuing after the daily loss limit because "one more trade will fix it".

Tilt can also follow wins. Euphoria after a large gain leads to the same oversized, unplanned trades.

> **Example:** A trader with a 5,000 USD account and a 50 USD risk per trade takes two planned losses before 11:00 server time. Frustrated, they open 0.50 lot XAUUSD with a 6 USD stop, risking 6 x 100 x 0.50 = 300 USD, six times the normal risk. The stop is hit. In three trades the account has lost 400 USD, 8% of the balance, and only 100 USD of that came from the plan.

## Circuit breakers

Tilt is hard to reason your way out of while it is happening, so the defence must be decided in advance.

1. **Daily loss limit.** For example, 2% or 2R. When hit, close the platform. Kalks Trader will not stop you, so this rule is yours to enforce.
2. **Consecutive-loss pause.** After three losses in a row, take a break of at least 30 minutes before the next trade.
3. **Fixed size.** Position size comes from the formula in your plan, never from how you feel about the last trade.
4. **Drawdown tiers.** For example, halve risk per trade when the account is 10% below its peak, and return to normal only after recovering half of the drawdown.
5. **Physical interruption.** Stand up, leave the desk and write the journal entry before doing anything else.

## Normal drawdown or broken edge?

Compare the current drawdown with the strategy's tested statistics from Developer, Backtests and your forward-test results. If the losing streak and drawdown are within the historical range and trades are being executed as planned, the most likely explanation is variance. If the drawdown is well beyond anything seen in testing, or the market regime has clearly changed, reduce risk or pause the strategy and investigate. Either way, decide at a scheduled review, not mid-session.

## Common mistakes

- Setting risk per trade so high that a normal losing streak creates an emotionally unbearable drawdown.
- Treating the daily loss limit as a guideline rather than a hard stop.
- Changing strategy in the middle of a drawdown, which resets the evidence and often means abandoning a strategy just before its recovery.
