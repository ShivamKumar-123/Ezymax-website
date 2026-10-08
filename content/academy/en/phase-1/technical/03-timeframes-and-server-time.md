---
slug: "p1-t-timeframes-server-time"
title: "Timeframes, server time and the New York close"
summary: "How timeframes group price data, why Ezymex server time is aligned with the New York close, and how to convert it to your own clock."
order: 3
version: 1
takeaways:
  - "A timeframe sets how much time each candle covers, from one minute (M1) to one month (MN), and every higher timeframe is built from the lower ones."
  - "Ezymex server time is GMT+2 in winter and GMT+3 during US daylight saving, so 00:00 server time is always 17:00 in New York."
  - "Because each trading day closes at the New York close, forex charts show five clean daily candles per week with no small Sunday candle."
  - "Higher timeframes show the bigger picture and filter noise; lower timeframes show detail and are used for timing."
  - "Always convert economic-calendar times and your trading hours to server time so your chart and your plans line up."
practice:
  label: "Open EURUSD on D1, H4 and H1 in three chart tabs on your demo account and find the same trading day on each one."
  symbol: "EURUSD"
quiz:
  - question: "Four consecutive H1 candles have opens of 1.0850, 1.0855, 1.0860, 1.0871, highs of 1.0858, 1.0862, 1.0877, 1.0874, lows of 1.0846, 1.0851, 1.0858, 1.0863 and closes of 1.0855, 1.0860, 1.0871, 1.0866. What is the H4 candle's OHLC?"
    options:
      - "O 1.0850, H 1.0877, L 1.0846, C 1.0866"
      - "O 1.0850, H 1.0874, L 1.0846, C 1.0871"
      - "O 1.0855, H 1.0877, L 1.0851, C 1.0866"
      - "O 1.0866, H 1.0877, L 1.0846, C 1.0850"
    answer: 0
    explanation: "The H4 open is the first H1 open, the close is the last H1 close, the high is the highest high and the low is the lowest low."
  - question: "What time is it in New York when a new daily candle begins on Ezymex Trader?"
    options:
      - "00:00 midnight"
      - "09:30 at the stock market open"
      - "12:00 noon"
      - "17:00, the New York close"
    answer: 3
    explanation: "Server time is set so that 00:00 server time equals 17:00 New York time all year round. That is the conventional end of the FX trading day."
  - question: "Why does an FX chart on Ezymex show five daily candles per week rather than six?"
    options:
      - "Because Friday is skipped"
      - "Because the market opens on Monday 00:00 server time, so the Sunday evening hours belong to Monday's candle"
      - "Because Ezymex merges Monday and Tuesday"
      - "Because daily candles are only drawn on weekdays by coincidence"
    answer: 1
    explanation: "FX reopens on Sunday at 17:00 New York time, which is Monday 00:00 server time. Those hours are part of Monday's daily candle, so no separate short Sunday candle appears."
  - question: "A US data release is at 08:30 New York time. When is it in Ezymex server time?"
    options:
      - "08:30"
      - "13:30"
      - "15:30"
      - "01:30"
    answer: 2
    explanation: "Server time runs 7 hours ahead of New York all year, so 08:30 in New York is 15:30 server time."
---

When you open a chart, one of the first choices you make is the timeframe. The same market can look like a strong uptrend on one timeframe and a messy sideways drift on another. And every candle on every timeframe starts and ends according to the chart's clock, which on Ezymex is server time. This chapter explains both.

## What a timeframe is

A timeframe is the amount of time each candle or bar represents. Ezymex Trader offers:

| Code | One candle equals | Typical use |
|---|---|---|
| M1, M5 | 1 or 5 minutes | Very short-term timing, scalping |
| M15, M30 | 15 or 30 minutes | Intraday entries |
| H1 | 1 hour | Intraday structure, session behaviour |
| H4 | 4 hours | Swing trading, the shape of the week |
| D1 | 1 trading day | Main trend and key levels |
| W1 | 1 week | Long-term context |
| MN | 1 month | Very long-term context |

Higher timeframes are built from lower ones. An H4 candle contains exactly four H1 candles; a D1 candle on FX contains six H4 candles.

## How a higher-timeframe candle is built

The rule is simple: the **open** is the first open, the **close** is the last close, the **high** is the highest high and the **low** is the lowest low.

```text
EURUSD H1 candles (server time)
08:00  O 1.0850  H 1.0858  L 1.0846  C 1.0855
09:00  O 1.0855  H 1.0862  L 1.0851  C 1.0860
10:00  O 1.0860  H 1.0877  L 1.0858  C 1.0871
11:00  O 1.0871  H 1.0874  L 1.0863  C 1.0866

H4 candle 08:00
Open  = first open          = 1.0850
High  = highest of the highs = 1.0877
Low   = lowest of the lows   = 1.0846
Close = last close           = 1.0866
Range = 1.0877 - 1.0846      = 31 pips
```

Notice what the H4 candle hides: that the rally happened mostly in the 10:00 hour, and that price slipped back in the last hour. Every step up in timeframe trades detail for clarity.

## Server time and the New York close

Ezymex Trader displays all chart times in **server time**: GMT+2 in winter and GMT+3 while the US is on daylight saving time. This is not arbitrary. With that offset, **00:00 server time always equals 17:00 in New York**, the traditional end of the global FX trading day, known as the New York close.

Three practical consequences follow:

1. **Five daily candles per week for FX.** The FX market reopens on Sunday at 17:00 New York time, which is Monday 00:00 server time. The Sunday evening hours therefore belong to Monday's candle. Charts that use midnight GMT instead produce a small, misleading sixth candle for Sunday.
2. **H4 candles align with the day.** Server-time H4 candles open at 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00, so six of them make exactly one daily candle.
3. **Swaps and the daily rollover happen at 00:00 server time.** Spreads can widen for a few minutes around that time, which you will often see as a spike in the wicks of the first M1 or M5 candles of the day.

Other instruments follow their own sessions within the same clock. Crypto trades every day, so BTCUSD shows seven daily candles per week. US shares trade 09:30 to 16:00 New York time, which is 16:30 to 23:00 server time, so a daily candle on AAPL covers only that window.

## Converting server time to your clock

Because server time moves with New York daylight saving, the easiest fixed reference is: **server time is New York time plus 7 hours**, all year round. For your own location, work out the difference once per season.

> **Example:** A trader in India (IST, GMT+5:30, no daylight saving). In summer the server is GMT+3, so IST = server time + 2:30. In winter the server is GMT+2, so IST = server time + 3:30. A US data release at 08:30 New York time is 15:30 server time, which is 18:00 IST in summer and 19:00 IST in winter.

When you read the economic calendar in the Client Area, confirm which time zone it is displaying and convert it to server time before marking the event on your chart.

## Choosing timeframes

No timeframe is "correct". The right choice depends on how long you intend to hold a trade.

- **Context comes from higher timeframes.** D1 and H4 show the main trend and the most important levels, and they filter out much of the random noise of lower timeframes.
- **Timing comes from lower timeframes.** H1 and M15 help you choose entries within that context.
- **Costs weigh more on low timeframes.** A 1-pip spread is small against a 70-pip daily range but significant against a 5-pip M1 move.

A common starting combination is D1 for direction, H4 for structure and H1 for timing. Phase 3 develops multi-timeframe analysis properly.

## Common mistakes

- **Changing timeframe until the chart agrees with you.** Decide which timeframes you use before you analyse.
- **Mixing time zones.** Marking an event at the wrong hour because the calendar showed local time and the chart shows server time.
- **Trading very low timeframes first.** M1 charts are noisy and costs are proportionally high, which makes them a hard place to learn.

Open the same symbol on several timeframes in Ezymex Trader on a free demo account and trace one day's move from D1 down to H1.
