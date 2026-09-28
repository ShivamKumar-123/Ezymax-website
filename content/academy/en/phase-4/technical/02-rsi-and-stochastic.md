---
slug: "p4-t-rsi-and-stochastic"
title: "RSI and the stochastic oscillator"
summary: "How the two most popular momentum oscillators are calculated and why overbought does not mean sell."
order: 2
version: 1
takeaways:
  - "RSI = 100 - 100 / (1 + RS), where RS is Wilder's smoothed average gain divided by average loss, usually over 14 periods."
  - "The stochastic %K places the close within the recent high-low range; %D is a 3-period average of %K."
  - "In strong trends oscillators can stay overbought or oversold for long periods, so extreme readings are not reversal signals on their own."
  - "Oscillators are most useful for timing entries in the direction of an established trend and for spotting fading momentum."
practice:
  label: "Add RSI(14) and a slow stochastic (14, 3, 3) to an H1 XAUUSD chart and find two occasions where RSI stayed above 70 while price kept rising."
  symbol: "XAUUSD"
quiz:
  - question: "The 14-period average gain is 3.00 and the average loss is 1.00. What is the RSI?"
    options:
      - "25"
      - "66.7"
      - "75"
      - "300"
    answer: 2
    explanation: "RS = 3.00 / 1.00 = 3. RSI = 100 - 100 / (1 + 3) = 100 - 25 = 75."
  - question: "Over 14 bars, GBPUSD's high is 1.2800 and its low is 1.2700. The latest close is 1.2725. What is the stochastic %K?"
    options:
      - "25"
      - "50"
      - "75"
      - "72.5"
    answer: 0
    explanation: "%K = (1.2725 - 1.2700) / (1.2800 - 1.2700) x 100 = 0.0025 / 0.0100 x 100 = 25. The close is in the lower quarter of the range."
  - question: "In a strong uptrend, RSI has been above 70 for ten bars. What is the most reasonable interpretation?"
    options:
      - "Momentum is strong; the reading alone is not a sell signal"
      - "A reversal is certain; sell immediately"
      - "The indicator is broken"
      - "RSI above 70 means the trend has ended"
    answer: 0
    explanation: "Overbought describes strong recent gains, which is normal in a trend. Selling solely because RSI is above 70 means trading against the trend."
  - question: "Which setting describes the common slow stochastic?"
    options:
      - "%K 14, smoothed by 3, with %D a 3-period average of that line"
      - "%K 3, %D 14"
      - "%K 9, %D 26"
      - "%K 20 with 2 standard deviations"
    answer: 0
    explanation: "The slow stochastic (14, 3, 3) smooths the raw 14-period %K with a 3-period average, then takes another 3-period average as %D."
---

Moving averages show direction. Oscillators show momentum: how strongly price is moving relative to its recent past. The Relative Strength Index (RSI) and the stochastic oscillator both move between 0 and 100, which makes them easy to read and easy to misuse. This chapter covers the correct formulas and the most common misunderstanding.

## RSI: the formula

RSI was developed by J. Welles Wilder and is usually calculated over 14 periods. For each bar, the change in close is recorded as a gain (if positive) or a loss (if negative, recorded as a positive number). Then:

```text
Average gain = Wilder-smoothed average of gains over 14 periods
Average loss = Wilder-smoothed average of losses over 14 periods
RS  = Average gain / Average loss
RSI = 100 - 100 / (1 + RS)

Wilder smoothing (after the first 14-bar simple average):
New average = (Previous average x 13 + Current value) / 14
```

A market that only rose would have zero average loss and an RSI of 100. Equal gains and losses give RS = 1 and RSI = 50.

## RSI worked example

> **Example:** On XAUUSD H1, the current average gain is 4.20 USD and the average loss is 2.80 USD. RS = 1.5 and RSI = 100 - 100 / 2.5 = 60. The next candle closes 7.00 USD higher, a gain of 7.00 and a loss of 0.

```text
New average gain = (4.20 x 13 + 7.00) / 14 = 61.60 / 14 = 4.40
New average loss = (2.80 x 13 + 0.00) / 14 = 36.40 / 14 = 2.60
RS  = 4.40 / 2.60 = 1.692
RSI = 100 - 100 / 2.692 = 100 - 37.14 = 62.86
```

A single strong candle lifted RSI by less than three points because of the smoothing. This is why RSI behaves more steadily than raw price changes.

## The stochastic oscillator

The stochastic compares the close to the high-low range of the last n bars, typically 14:

```text
%K = (Close - Lowest low of n) / (Highest high of n - Lowest low of n) x 100
%D = 3-period simple average of %K

XAUUSD: 14-bar high 2,368.00, low 2,332.00, close 2,359.00
%K = (2,359.00 - 2,332.00) / (2,368.00 - 2,332.00) x 100
   = 27.00 / 36.00 x 100 = 75
```

A reading of 75 means the close sits three-quarters of the way up the recent range. The raw version above is called the fast stochastic and is very jumpy. Most platforms default to the slow stochastic (14, 3, 3): the raw %K is smoothed with a 3-period average, and %D is a 3-period average of that smoothed line.

## Overbought is not a sell signal

The conventional thresholds are 70 and 30 for RSI and 80 and 20 for the stochastic. Readings above the upper level are called overbought and below the lower level oversold. The labels mislead many traders.

An RSI of 75 simply says gains have outweighed losses by a wide margin recently. In a strong uptrend that is expected, and RSI can stay above 70 for days while price keeps rising. Selling every overbought reading means repeatedly fading a trend.

More reliable uses:

| Use | How it works |
|---|---|
| Trend pullback timing | In an uptrend, wait for RSI to dip towards 40 to 50, or the stochastic to drop below 20 and turn up, then look for a long entry |
| Regime reading | In uptrends RSI tends to hold above about 40; in downtrends it tends to stay below about 60 |
| Momentum fading | Price makes a new high but RSI makes a lower high, a divergence covered later in this section |
| Range trading | In a confirmed sideways market, extremes near range edges can support fade trades |

## RSI versus stochastic

RSI measures the balance of gains and losses; the stochastic measures where price closes within its range. The stochastic is faster and gives more signals, many of them noise. RSI is steadier and is more commonly used for divergence. Using both rarely adds much, because they are built from the same price data and usually agree. Pick one, learn how it behaves on the symbols you trade, and read it on the same timeframe as your entries. An RSI reading on M5 describes a few hours of movement, while the daily RSI describes several weeks.

## Common mistakes

- Selling overbought and buying oversold readings in trending markets.
- Treating the 70 and 30 lines as precise triggers rather than broad zones.
- Changing periods to make past signals look better.
- Reading an oscillator without first identifying the trend on the chart.

> **Risk warning:** Oscillator signals are frequently wrong, especially against a trend. Always use a stop loss and size positions conservatively, since leveraged CFD losses can exceed your expectations.
