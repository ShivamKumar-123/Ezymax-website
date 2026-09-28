---
slug: "p1-t-volatility-volume-basics"
title: "Volatility and volume basics"
summary: "How much a market typically moves, how active it is, and why both numbers should shape your expectations and your position size."
order: 5
version: 1
takeaways:
  - "Volatility is how much price moves over a period; the simplest practical measure is the average range of recent candles."
  - "Comparing volatility in percentage terms shows that the same position value carries very different risk on EURUSD, XAUUSD, NAS100 or BTCUSD."
  - "Volatility clusters: quiet periods tend to follow quiet periods and busy periods follow busy ones, and it rises around sessions and news."
  - "In OTC markets like spot FX there is no central volume figure, so charts show tick volume, the number of price updates, as a proxy for activity."
  - "Volume helps judge whether a move has broad participation, but it is a supporting clue, not a signal on its own."
practice:
  label: "Add the Average True Range and Volumes indicators to a demo XAUUSD D1 chart and compare today's range with the recent average."
  symbol: "XAUUSD"
quiz:
  - question: "EURUSD's last five daily ranges were 72, 58, 91, 64 and 70 pips. What is the average daily range?"
    options:
      - "64 pips"
      - "71 pips"
      - "70 pips"
      - "91 pips"
    answer: 1
    explanation: "72 + 58 + 91 + 64 + 70 = 355, and 355 / 5 = 71 pips. 70 is the median, not the average."
  - question: "What does tick volume measure on an FX chart?"
    options:
      - "The number of lots traded worldwide"
      - "The value of all open positions at the broker"
      - "The number of price changes during each period"
      - "The spread in pips"
    answer: 2
    explanation: "Spot FX has no central exchange, so there is no official traded volume. Tick volume counts price updates, which tends to rise and fall with real activity."
  - question: "Gold averages a 31.50 USD daily range at 2,350.40, and EURUSD averages 71 pips at 1.0850. Which is more volatile in percentage terms?"
    options:
      - "Gold, at about 1.3% versus about 0.65% for EURUSD"
      - "EURUSD, because 71 is larger than 31.50"
      - "They are equally volatile"
      - "It cannot be compared across instruments"
    answer: 0
    explanation: "31.50 / 2,350.40 is about 1.34%, and 0.0071 / 1.0850 is about 0.65%. Percentage terms make different instruments comparable."
  - question: "A trader uses a 10-pip stop loss on EURUSD when the average H1 range is 18 pips. What is the likely problem?"
    options:
      - "The stop is too far away"
      - "Stop losses cannot be used on EURUSD"
      - "There is no problem; smaller stops are always safer"
      - "The stop sits well inside normal hourly movement and may be hit by ordinary noise"
    answer: 3
    explanation: "If a normal hour covers 18 pips, a 10-pip stop can be hit without the idea being wrong. Stops should reflect how much the market normally moves, with size adjusted to keep the money at risk acceptable."
---

Two traders open 0.10 lot on the same day, one on EURUSD and one on BTCUSD. Both used the same lot size, but they took on very different risk. The difference is **volatility**, how much a market moves. Alongside it sits **volume**, how active a market is. Neither tells you direction, but both tell you what to expect, and that shapes how far away you place stops and how large a position you can afford.

## What volatility means

Volatility is the size of price movement over a given period. A market that routinely moves 2% a day is more volatile than one that moves 0.5%. Higher volatility means bigger potential gains and bigger potential losses for the same position.

The most practical measure for a beginner is the **range**: high minus low of each candle. Average the ranges of recent candles and you have a realistic picture of a normal period.

```text
EURUSD, last five daily candles
Ranges (pips):   72   58   91   64   70
Sum:             72 + 58 + 91 + 64 + 70 = 355
Average range:   355 / 5 = 71 pips
```

A more refined version of this idea, the Average True Range (ATR), also accounts for gaps between candles. It is available in the Volatility category of the indicators menu in Kalks Trader and is covered in Phase 4.

## Comparing volatility across instruments

Ranges in pips or dollars cannot be compared directly between instruments. Converting them into a percentage of the price can.

> **Example:** EURUSD at 1.0850 averages a 71-pip daily range: 0.0071 / 1.0850 = about 0.65% of the price. XAUUSD at 2,350.40 averages 31.50 USD a day: 31.50 / 2,350.40 = about 1.34%. In this example gold moves roughly twice as much as EURUSD in percentage terms, so a position of the same notional value carries roughly twice the day-to-day risk.

Across the instruments on Kalks, a rough ordering from typically calmer to typically more volatile is: major FX pairs, then gold and major indices, then oil and single shares, then crypto. Individual periods can break this pattern, which is exactly why you measure rather than assume.

## How volatility behaves

Volatility is not constant, but it is not random either.

**It clusters.** Calm days tend to follow calm days, and volatile days tend to follow volatile days. After a big news shock, elevated ranges often persist for a while.

**It follows the clock.** For FX, ranges are usually smallest in late Asian hours and largest during London and the London–New York overlap. US indices and shares are most active in the first hour after the 09:30 New York open (16:30 server time).

**It jumps around events.** Scheduled releases such as US inflation or employment data, central-bank decisions and company earnings can produce a candle several times the normal size.

**It changes the value of a stop.** A stop loss that is small relative to normal movement is likely to be hit by noise. A trader who places a 10-pip stop on EURUSD when the average H1 range is 18 pips is placing it inside an ordinary hour's movement.

> **Risk warning:** Wider stops on volatile instruments mean more money at risk per position unless you reduce your size. On leveraged CFDs, trading volatile markets with the same size you use on calmer ones can cause losses well beyond what you planned. Phase 5 covers position sizing in detail.

## What volume tells you

On an exchange, **volume** is the number of shares or contracts traded in each period. It shows how much participation stands behind a move. A breakout on heavy volume involves many participants; the same breakout on thin volume is easier to reverse.

Spot FX and most CFDs are OTC, so there is no central volume figure. Charts instead show **tick volume**, the number of price updates in each period. More participants and more orders produce more price changes, so tick volume tends to track real activity reasonably well, even though it does not measure lots traded.

You can display it in Kalks Trader with the **Volumes** indicator in the Volume category. Useful first observations:

- Tick volume rises sharply around session opens and news, and falls around the daily rollover and holidays.
- A strong move with rising volume suggests broad participation.
- A move on shrinking volume, especially late in a trend, suggests fewer participants are joining.

Treat these as supporting clues only. Volume does not tell you which way price will go next.

## In practice

Before you trade any symbol, answer three questions:

1. What is its average range on the timeframe you are using?
2. Is today unusual, for example because of scheduled news or a holiday?
3. Is your intended stop sensibly outside normal noise, and is your size small enough that hitting that stop is an acceptable loss?

## Common mistakes

- **Using the same stop distance on every symbol.** 20 pips on EURUSD and 20 cents on gold are not comparable.
- **Ignoring the clock.** Judging a market as "dead" during Asian hours and then being surprised by the London open.
- **Treating tick volume as exchange volume.** It is an activity proxy, not a count of lots.

Measure the average range of three symbols on a free demo account in Kalks Trader and rank them by percentage volatility.
