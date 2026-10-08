---
slug: "p4-f-reading-the-economic-calendar"
title: "Reading the economic calendar"
summary: "What every column of an economic calendar means and how to turn it into a weekly plan of risk events."
order: 1
version: 1
takeaways:
  - "Each calendar entry combines a release time, an impact rating and three numbers: actual, consensus and previous."
  - "Markets react to the gap between actual and consensus, not to whether the number is high or low in absolute terms."
  - "Revisions to the previous figure can change the meaning of a release as much as the headline itself."
  - "Release times must be converted to server time so you know which candle, and which open positions, will be affected."
  - "A weekly calendar review turns surprise volatility into planned volatility."
practice:
  label: "Open the Economic calendar in the Client Area, filter for high-impact USD and EUR events this week, and note each release time in server time."
  symbol: "EURUSD"
quiz:
  - question: "A calendar shows US retail sales: previous 0.3%, consensus 0.4%, actual 0.4%. What is the most likely immediate reaction?"
    options:
      - "A strong USD rally because sales grew"
      - "Markets always move at least 50 pips on retail sales"
      - "A strong USD fall because growth slowed from the consensus"
      - "Limited reaction, because the result matched what was already priced in"
    answer: 3
    explanation: "When actual equals consensus, the information was already reflected in prices. The absolute growth figure matters far less than the surprise versus expectations."
  - question: "What does the consensus figure on an economic calendar represent?"
    options:
      - "The official forecast of the statistics agency"
      - "The previous month's result"
      - "The median or average forecast of surveyed economists"
      - "The central bank's target for that indicator"
    answer: 2
    explanation: "Consensus is the median or average of forecasts gathered from economists and analysts before the release. It is the market's working estimate, not an official target."
  - question: "A US release is scheduled for 08:30 New York time. What is that in Ezymex server time?"
    options:
      - "13:30"
      - "14:30"
      - "15:30"
      - "16:30"
    answer: 2
    explanation: "Server time is set so that 17:00 New York equals 00:00 server time, a seven-hour difference all year. 08:30 New York is therefore 15:30 server time."
  - question: "The previous NFP figure was 200K and is revised down to 120K in the new release. Why does this matter?"
    options:
      - "It changes the trend picture and can offset a strong headline"
      - "It does not matter; only the new actual figure is used"
      - "Revisions are only published once a year"
      - "Revisions affect only equity markets, not currencies"
    answer: 0
    explanation: "A large downward revision means the labour market was weaker than believed. Traders weigh the revision alongside the headline, so a good headline plus a poor revision can produce a muted or even opposite reaction."
---

In Phase 3 you learned what inflation, growth and employment data say about an economy. The economic calendar is where those numbers arrive, on a fixed schedule, often within a fraction of a second. Knowing how to read it is the first step to trading around news deliberately rather than being surprised by it.

## What a calendar entry contains

Every line in a calendar, including the one in the Ezymex Client Area under **Economic calendar**, follows the same structure:

| Column | What it tells you |
|---|---|
| Time | When the figure is published (convert to server time) |
| Currency / country | Which currency is most directly affected |
| Event | The indicator, for example CPI y/y or Non-Farm Payrolls |
| Impact | Usually low, medium or high, based on typical market reaction |
| Actual | The published number, blank until release |
| Consensus (forecast) | The median forecast of surveyed economists |
| Previous | The last reading, sometimes with a revision |

The impact rating is a guide to how much the market has historically cared, not a promise of movement. A high-impact event can pass quietly when it matches expectations, while a medium-impact release can move a currency sharply when it surprises in a period when that data is the market's main focus.

## Actual versus consensus: where the move comes from

Prices already reflect the consensus before a release. Traders, banks and funds position themselves ahead of time, so the number itself is only new information to the extent it differs from what was expected. This is why a strong figure can lead to a falling currency: if the market expected something even stronger, the result is a disappointment.

> **Example:** US CPI m/m. Previous 0.1%, consensus 0.2%, actual 0.4%. Inflation came in 0.2 percentage points above forecast, a large surprise for a monthly figure. The market reasons that the Federal Reserve may keep rates higher for longer, so the USD tends to rise, EURUSD falls, and gold (priced in dollars and sensitive to real yields) often drops.

The next chapter covers how to measure the size of a surprise. For now, the rule is: read the actual against the consensus first, then look at the previous figure.

## Revisions and the previous column

Many statistics are revised as more complete data arrives. Employment, GDP and retail sales are revised regularly. The calendar often shows the revised previous figure next to the original one.

A revision changes the trend. If payrolls beat consensus by 40K but the prior two months are revised down by a combined 90K, the labour market actually delivered 50K fewer jobs than previously believed. Experienced traders read the whole release, not just the headline line.

## Time zones and the server clock

Calendars can display times in your local zone, in GMT, or in the release country's zone. Ezymex Trader charts run on server time, which is GMT+2 in winter and GMT+3 during US daylight saving, arranged so that 17:00 New York is always 00:00 server time. That gives a fixed seven-hour offset from New York.

```text
US release at 08:30 New York   -> 08:30 + 7h = 15:30 server time
FOMC statement at 14:00 NY      -> 14:00 + 7h = 21:00 server time
UK release at 07:00 London      -> depends on the DST calendar;
                                   usually 09:00 server time
```

The UK and Europe change clocks on different dates from the US, so for a few weeks each year the gap to London or Frankfurt shifts by one hour. Always check the calendar setting rather than relying on memory.

> **In Ezymex Trader:** set the calendar display to the same zone you use for charts. When you mark an event on the chart, you then know exactly which candle it will appear in.

## Building a weekly event plan

Professional traders review the calendar before the week starts. A simple routine:

1. Filter for high-impact events in the currencies you trade and in the USD, which affects almost every instrument on the platform.
2. Note the day and server time of each, plus any central-bank decisions and speeches.
3. For every open or planned position, ask which event could move it and by how much.
4. Decide in advance: hold through, reduce size, tighten risk, or stay flat.

Remember that a single event affects many symbols at once. US CPI moves EURUSD, USDJPY, XAUUSD, US30, NAS100 and often BTCUSD. If you hold three positions that all depend on the dollar, one release is effectively one large bet.

## Common mistakes

- Reading only the actual number and judging it as good or bad in isolation.
- Ignoring revisions to previous data.
- Forgetting time-zone conversion and being caught by a release that was "later today".
- Treating the impact rating as a forecast of pip movement.
- Checking the calendar only after a sudden move, rather than before opening positions.

> **Risk warning:** CFDs are leveraged products. Around high-impact releases prices can move many times their normal range within seconds, spreads widen and stop orders can be filled at worse prices than set, so losses can exceed what you planned.
