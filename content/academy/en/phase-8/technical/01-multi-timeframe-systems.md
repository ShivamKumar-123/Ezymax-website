---
slug: "p8-t-multi-timeframe-systems"
title: "Designing multi-timeframe trading systems"
summary: "Build a rule-based system in which a higher timeframe sets the regime, a middle timeframe defines the setup and a lower timeframe triggers the entry."
order: 1
version: 1
takeaways:
  - "A multi-timeframe system assigns each timeframe a single job: regime, setup or trigger."
  - "A ratio of roughly four to six between adjacent timeframes keeps them related without duplicating information."
  - "Every rule must be objective enough to code or backtest; discretionary wording such as looks strong is not a rule."
  - "Higher-timeframe levels usually make the best targets and invalidation points, while the lower timeframe refines entry and stop."
practice:
  label: "On your demo account, open EURUSD on D1, H4 and H1 in three chart windows and write down the regime, setup and trigger state for each."
  symbol: "EURUSD"
quiz:
  - question: "In a three-timeframe system using D1, H4 and H1, what is the usual job of the D1 chart?"
    options:
      - "Timing the exact entry"
      - "Defining the regime or directional bias"
      - "Setting the lot size"
      - "Measuring the spread"
    answer: 1
    explanation: "The highest timeframe sets the regime (trend direction or range). The middle timeframe finds the setup and the lowest triggers the entry."
  - question: "A trader risks 1% of a 25,000 USD account on EURUSD with a 34-pip stop. Pip value is 10 USD per standard lot. What position size is closest without exceeding the risk?"
    options:
      - "0.34 lots"
      - "0.85 lots"
      - "0.73 lots"
      - "2.50 lots"
    answer: 2
    explanation: "Risk is 250 USD. 250 / (34 x 10) = 0.735 lots, rounded down to 0.73 lots, which risks 248.20 USD."
  - question: "Why is a timeframe ratio of about 4 to 6 commonly recommended?"
    options:
      - "Because adjacent timeframes that are too close repeat the same information, while ones too far apart lose their connection"
      - "Because brokers only offer those timeframes"
      - "Because it guarantees a higher win rate"
      - "Because it removes the need for a stop loss"
    answer: 0
    explanation: "M15 and M30 show nearly the same picture; D1 and M1 have almost no link. A ratio of about 4 to 6 keeps each chart informative and related."
  - question: "Which of these is an objective system rule?"
    options:
      - "Buy when the trend looks strong"
      - "Enter when momentum feels right"
      - "Only trade good-looking pullbacks"
      - "Long bias only when the D1 close is above the 50-period moving average and the last swing low is higher than the previous one"
    answer: 3
    explanation: "The last option can be checked without interpretation and can be coded in the strategy builder. The others depend on feelings and cannot be tested consistently."
---

In Phase 3 you met multi-timeframe analysis as a way to read context. In Phase 6 you learned to turn ideas into testable rules. This chapter combines the two: a **multi-timeframe system** in which each timeframe has one clearly defined job and every rule is objective enough to backtest.

## One job per timeframe

The most common design uses three timeframes:

- **Regime timeframe** (for example D1): decides whether you look for longs, shorts or nothing.
- **Setup timeframe** (for example H4): identifies a specific opportunity inside that regime, such as a pullback to a level.
- **Trigger timeframe** (for example H1): times the entry and defines a precise stop.

```svg
<svg viewBox="0 0 560 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <rect x="40" y="20" width="480" height="56" rx="6" fill="none" stroke="#ff5a1f" stroke-width="2"/>
  <text x="60" y="44" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="14">D1  Regime</text>
  <text x="60" y="64" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Trend up, range or trend down? Allowed direction only.</text>
  <rect x="100" y="100" width="360" height="56" rx="6" fill="none" stroke="#3a3a44" stroke-width="2"/>
  <text x="120" y="124" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="14">H4  Setup</text>
  <text x="120" y="144" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Pullback into a defined zone or level</text>
  <rect x="160" y="180" width="240" height="56" rx="6" fill="none" stroke="#22c55e" stroke-width="2"/>
  <text x="180" y="204" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="14">H1  Trigger</text>
  <text x="180" y="224" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Structure break, entry and stop</text>
  <line x1="280" y1="76" x2="280" y2="100" stroke="#3a3a44" stroke-width="2"/>
  <line x1="280" y1="156" x2="280" y2="180" stroke="#3a3a44" stroke-width="2"/>
</svg>
```

Each layer filters the one below. A perfect H1 trigger is ignored if the D1 regime does not allow that direction. This hierarchy prevents the most common multi-timeframe error: finding a reason on some timeframe to justify any trade you already wanted to take.

## Choosing timeframes

Keep a ratio of roughly four to six between adjacent timeframes. Common stacks:

| Style | Regime | Setup | Trigger |
|---|---|---|---|
| Position | W1 | D1 | H4 |
| Swing | D1 | H4 | H1 |
| Intraday | H4 | H1 | M15 |
| Short-term intraday | H1 | M15 | M5 (or M3) |

Remember that daily candles in Ezymex Trader close at 00:00 server time, the New York close, so D1 levels are consistent with how most of the FX market measures the day. The lower the trigger timeframe, the larger the share of spread and slippage in each trade's risk, which is why very short stacks need tighter cost control.

## Writing objective rules

Each layer needs rules you could code in the strategy builder (Client Area, Developer, Strategies). A sample swing system:

1. **Regime (D1):** long bias if the close is above the 50-period moving average and the last confirmed swing low is higher than the previous swing low. Short bias for the mirror image. Otherwise no trades.
2. **Setup (H4):** price pulls back to within 0.5 x ATR(14, H4) of the 20-period EMA or of the most recent broken D1 resistance.
3. **Trigger (H1):** an H1 candle closes above the high of the last H1 lower high, ending the pullback structure.
4. **Stop:** below the H1 pullback low, plus a buffer of 0.2 x ATR(14, H1).
5. **Target:** the next D1 swing high or resistance, taken only if reward is at least 2R.
6. **Management:** move the stop to breakeven at +1R; close at the target or if the D1 regime condition fails on a daily close.

## Worked example

```text
Account balance         25,000 USD, risk 1% = 250 USD
D1 regime               EURUSD above 50 MA, higher swing low -> long bias
H4 setup                Pullback to broken resistance at 1.0850
H1 trigger              Close above lower-high at 1.0870; entry 1.0872
Stop                    Below pullback low: 1.0838  -> 34 pips
Target                  Next D1 resistance: 1.0960  -> 88 pips
Reward / risk           88 / 34 = 2.59R  (passes the 2R filter)
Position size           250 / (34 x 10 USD) = 0.735 -> 0.73 lots
Actual risk             34 x 7.30 USD = 248.20 USD
```

The higher timeframe supplied both the direction and the target, while the lower timeframe allowed a stop of 34 pips instead of the 90 or more pips a pure D1 entry might need. That tighter stop is where multi-timeframe systems gain their efficiency. The cost is a lower win rate: more triggers fail before the move develops.

## Testing and conflicts

Backtest the system on the trigger timeframe, because that is where entries and stops are evaluated, while computing regime and setup conditions from the higher timeframes. Watch for look-ahead bias: a D1 condition must only use candles that had already closed at the time of the H1 trigger, not the D1 candle still forming.

When timeframes conflict, the rules must say what happens. The common answer is simple: no trade. A system that sits out conflicting periods often has fewer trades but better expectancy.

## Common mistakes

- **Timeframe shopping:** switching to whichever chart supports the trade you want.
- **Too many layers:** four or five timeframes rarely add information and create endless conflicts.
- **Mixing indicator settings:** using different parameters on each chart without testing them.
- **Ignoring costs on low triggers:** an M5 trigger with a 6-pip stop can lose a quarter of its risk to spread and slippage.

> **Risk warning:** A system that performed well in a backtest may perform differently in live markets. CFDs are leveraged and losses can exceed what you expect; test any system on a free demo account in Ezymex Trader before using real funds.
