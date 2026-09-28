---
slug: "p3-t-multi-timeframe-basics"
title: "Multi-timeframe analysis basics"
summary: "Combine a higher timeframe for direction, a middle timeframe for setups and a lower timeframe for timing, so your trades line up with the bigger picture."
order: 7
version: 1
takeaways:
  - "Use three timeframes with a factor of roughly four to six between them: one for direction, one for the setup and one for the entry trigger."
  - "The higher timeframe decides the bias and the key levels; the lower timeframe only refines timing and stop placement."
  - "When timeframes disagree, either wait or reduce expectations; do not let a lower-timeframe signal override the higher-timeframe picture."
  - "Daily candles close at 00:00 server time (the New York close), so the daily chart reflects a full trading day."
practice:
  label: "Pick EURUSD. Write one line each for the daily trend, the H4 setup area and what H1 signal would trigger an entry. Check it again after the next daily close."
  symbol: "EURUSD"
quiz:
  - question: "Which set of timeframes has a sensible spacing for a swing trader?"
    options:
      - "M1, M2 and M3"
      - "Daily, H4 and H1"
      - "Weekly, M5 and M1"
      - "H1, H1 and H1"
    answer: 1
    explanation: "Daily to H4 is a factor of about 5 to 6 and H4 to H1 a factor of 4, which keeps each view distinct without losing the connection between them."
  - question: "The daily chart is in a clear downtrend, but H1 prints a bullish engulfing candle. What is the most disciplined response?"
    options:
      - "Buy immediately with a large position"
      - "Ignore the daily chart"
      - "Treat it as a likely pullback and look for short setups at H4 resistance instead"
      - "Close the platform for the week"
    answer: 2
    explanation: "The higher timeframe sets the bias. A bullish H1 candle within a daily downtrend is more likely a pullback, which can offer a better short entry."
  - question: "What is the main job of the lowest timeframe in a three-timeframe approach?"
    options:
      - "Timing the entry and refining the stop"
      - "Deciding the overall trend direction"
      - "Setting profit targets far beyond daily levels"
      - "Replacing the higher timeframes when they disagree"
    answer: 0
    explanation: "The lower timeframe helps you enter with a tighter, logical stop at a location already chosen on the higher timeframes."
  - question: "Why does the Kalks server time of GMT+2/GMT+3 matter for daily candles?"
    options:
      - "It makes daily candles last 12 hours"
      - "It creates a sixth daily candle on Sundays"
      - "It means daily candles close at London midday"
      - "It aligns the daily close with the New York close, giving five daily FX candles per week"
    answer: 3
    explanation: "Midnight server time equals 17:00 New York. Daily candles therefore close at the NY close, and there is no small Sunday candle to distort patterns."
---

Every chapter in this section has quietly pointed at the same problem: the chart looks different depending on the timeframe. A clean uptrend on H4 can look like a messy downtrend on M15. **Multi-timeframe analysis** solves this by giving each timeframe a specific job, so that you trade in the direction of the bigger picture while still entering with precision.

## Why one timeframe is not enough

A trader who only watches M15 sees every small swing as important and has no idea whether a support level is also a major daily level or just noise. A trader who only watches the daily chart understands the trend but has to use very wide stops. Combining timeframes gives you the best of both: the context of the higher timeframe and the precision of the lower one.

## The three-timeframe framework

Pick three timeframes with a factor of roughly **four to six** between them. Too close (M5 and M15) and they say the same thing; too far apart (weekly and M5) and the connection between them is lost.

| Style | Direction | Setup | Trigger |
|---|---|---|---|
| Position | Weekly | Daily | H4 |
| Swing | Daily | H4 | H1 |
| Intraday | H4 | H1 | M15 |
| Short-term intraday | H1 | M15 | M5 |

Each timeframe has one job:

- **Direction (higher timeframe):** what is the trend, according to market structure? Where are the major support and resistance levels or zones? This decides whether you are looking for buys, sells or neither.
- **Setup (middle timeframe):** where is price likely to offer a trade in that direction? A pullback into support, a retest of a broken level, a fresh demand zone, or the lower line of a channel.
- **Trigger (lower timeframe):** when price reaches the setup area, what confirms that the other side is stepping in? A candlestick pattern, a small break of structure, or a false break of a minor low.

## Top-down, in order

Always work from the top down. Start with the higher timeframe and write down the bias before you look at lower charts. If you start with M15, a strong-looking pattern there will colour how you read everything else.

A short routine:

1. **Higher timeframe:** label the last few swing points (HH/HL or LH/LL) and mark two or three key levels.
2. **Middle timeframe:** mark where a pullback would reach a level that matters; decide the invalidation point.
3. **Lower timeframe:** only once price reaches the area, look for the trigger and set the stop just beyond the lower-timeframe swing.

## A worked example

> **Example:** On the EURUSD daily chart, price is making higher highs and higher lows; the last higher low is 1.0820 and the last high is 1.0950. The bias is long. On H4, the pullback is approaching a former resistance zone at 1.0830-1.0840 that broke last week (role reversal). On H1, when price reaches 1.0838, it forms a bullish engulfing candle and then breaks a small H1 lower high at 1.0848. You buy at 1.0850 with a stop at 1.0826, below the H1 swing low and the H4 zone, and target 1.0945, just below the daily high.

```text
Risk:    1.0850 - 1.0826 = 24 pips
Reward:  1.0945 - 1.0850 = 95 pips
Reward : risk ≈ 3.96 : 1

Using only the daily chart, a stop below the daily HL at 1.0815 would be:
1.0850 - 1.0815 = 35 pips  → reward : risk ≈ 2.7 : 1
```

The higher timeframe provided the direction and the target, the middle timeframe the location, and the lower timeframe a tighter stop and a better ratio. Note the trade-off: a tighter stop is more likely to be hit by normal noise, so a higher win rate should not be assumed.

> **Risk warning:** Better reward to risk does not mean guaranteed profit. CFDs are leveraged and losses can exceed expectations; always size the position from the stop distance and your chosen risk per trade, a topic covered in Phase 5.

## When timeframes disagree

Disagreement is normal. The higher timeframe may be in an uptrend while the middle timeframe is falling. That is simply a pullback; your job is to wait for it to reach a level and show signs of ending. The mistake is to let a lower-timeframe signal override the bigger picture, for example shorting an H1 bearish pattern directly into daily support in a daily uptrend. When the picture is unclear on the higher timeframe, the best decision is often no trade.

## Server time and candle closes

Timeframes only work if the candles are built consistently. Kalks Trader uses server time of GMT+2 in winter and GMT+3 during US daylight saving, so 00:00 server time is 17:00 New York. Daily candles close at the New York close, which gives five daily candles per week for FX without a short Sunday candle, and H4 candles line up neatly inside each day. When you compare levels with other traders, remember that charts on a different time zone can show different daily highs and lows.

## Common mistakes

- **Starting at the bottom.** Looking at M5 first biases the rest of your analysis.
- **Too many timeframes.** Five or six charts give conflicting signals; three is plenty.
- **Changing the bias intraday.** A lower-timeframe move against you does not change the daily trend unless daily structure changes.
- **Taking lower-timeframe targets for higher-timeframe trades.** If the direction comes from the daily chart, targets should come from daily levels too.

> **In Kalks Trader:** Switch timeframe on the same chart, from daily to H4 to H1, to follow the top-down routine, keeping your key levels drawn on the higher timeframe.
