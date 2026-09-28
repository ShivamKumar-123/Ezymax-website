---
slug: "p4-f-nfp-and-cpi-playbook"
title: "The NFP and CPI playbook"
summary: "A structured approach to the two US releases that move the most markets: the employment report and consumer inflation."
order: 4
version: 1
takeaways:
  - "NFP and US CPI are released at 08:30 New York time, which is 15:30 on the Kalks server clock."
  - "For NFP, read payrolls, revisions, unemployment and average hourly earnings together; for CPI, focus on core month on month."
  - "Both releases move the dollar, gold, US indices and often crypto at the same moment, so correlated positions add up."
  - "A written plan with three scenarios, set before the release, prevents impulsive decisions in the first seconds."
  - "Waiting for the first minutes to pass costs some move but avoids the worst spreads and whipsaws."
practice:
  label: "On a 1-minute XAUUSD demo chart, scroll back to the last US CPI release and measure the high-low range of the 15:30 candle and the next 15 candles."
  symbol: "XAUUSD"
quiz:
  - question: "Which part of the US CPI release do markets and the Federal Reserve usually watch most closely for the underlying trend?"
    options:
      - "Headline year on year"
      - "Energy prices only"
      - "Core CPI month on month"
      - "Food prices only"
    answer: 2
    explanation: "Core CPI excludes volatile food and energy, and the month-on-month change shows the latest pace. Year-on-year figures are affected by base effects from a year earlier."
  - question: "You hold 0.50 lots of XAUUSD long when a hot CPI print pushes gold down 18 dollars. What is the loss, ignoring spread?"
    options:
      - "90 USD"
      - "180 USD"
      - "900 USD"
      - "1,800 USD"
    answer: 2
    explanation: "One lot is 100 oz, so 0.50 lots is 50 oz. 50 oz x 18 USD = 900 USD."
  - question: "Which scenario is typically dollar-positive?"
    options:
      - "Payrolls miss, unemployment rises, wages soft"
      - "Core CPI m/m 0.1% against 0.3% consensus"
      - "Payrolls beat and average hourly earnings beat"
      - "Large downward revisions to prior payrolls"
    answer: 2
    explanation: "Strong hiring and faster wage growth suggest persistent inflation pressure and fewer rate cuts, which tends to support the USD. The other options point to a softer economy."
  - question: "Why can a trader with long EURUSD, long XAUUSD and short USDJPY positions be over-exposed into NFP?"
    options:
      - "The three positions are unrelated"
      - "USDJPY is closed during NFP"
      - "NFP never affects gold"
      - "All three are effectively short the US dollar and will react together"
    answer: 3
    explanation: "Each position gains if the dollar weakens and loses if it strengthens, so one NFP surprise hits all three at once. It is one large dollar bet split across symbols."
---

Two US releases dominate the monthly calendar: the employment report, known by its headline Non-Farm Payrolls (NFP), and the Consumer Price Index (CPI). Because the dollar sits on one side of most traded instruments, these numbers move FX, gold, indices and crypto at the same moment. This chapter gives you a repeatable way to prepare for both.

## The employment report

The US Bureau of Labor Statistics usually publishes the report on the first Friday of the month at 08:30 New York time, which is 15:30 server time. It contains several numbers, and markets weigh them together:

| Component | What it shows | Why it matters |
|---|---|---|
| Non-farm payrolls | Jobs added in the month | Headline pace of hiring |
| Revisions | Changes to the previous two months | Can confirm or undermine the trend |
| Unemployment rate | Share of the labour force without work | Slack in the labour market |
| Average hourly earnings | Wage growth, month on month | Direct link to inflation and Fed policy |

A strong report, with solid payrolls and firm wage growth, suggests the Federal Reserve can keep rates higher for longer. That tends to lift the USD and weigh on gold and US index futures. A weak report does the reverse. When the parts disagree, the reaction is often choppy, as covered in the previous chapter.

## The CPI report

CPI is released around the middle of the month, also at 08:30 New York time. The main figures are headline and core (excluding food and energy), each shown month on month and year on year. Core month on month usually carries the most weight, because it shows the latest underlying pace without base effects from a year ago.

A hot core print, above consensus, points to persistent inflation and tighter policy. A cool print points to easier policy. Because CPI feeds directly into rate expectations, its surprises frequently produce larger and more sustained moves than NFP in inflation-focused periods.

## A three-scenario plan

Before either release, write a short plan. It takes five minutes and prevents decisions made in the heat of the first second.

```text
Event: US CPI, 15:30 server.  Consensus core m/m 0.3%
Typical surprise: 0.1 pp

Scenario A  core >= 0.5%  (hot)   : USD up, XAUUSD and NAS100 down
Scenario B  core 0.2% - 0.4% (in line): expect chop, no trade
Scenario C  core <= 0.1%  (cool)  : USD down, XAUUSD and NAS100 up

Open positions: long XAUUSD 0.20 lots -> close before release
New trades: only after 15:45, only in scenario A or C,
            max risk 0.5% of equity, stop beyond the 15:30 candle range
```

The plan has clear thresholds, a decision about existing positions and a rule for new trades. It also accepts that the in-line case, often the most likely one, means doing nothing.

## Worked example: exposure on a hot print

Suppose you are long 0.30 lots of XAUUSD at 2,350.40 and long 0.50 lots of EURUSD at 1.0850 going into CPI. Core CPI comes in at 0.5% against 0.3% expected. Gold drops to 2,332.40 and EURUSD falls to 1.0810 within ten minutes.

```text
XAUUSD: 0.30 lots = 30 oz
        2,350.40 - 2,332.40 = 18.00 USD per oz
        30 x 18.00 = 540 USD loss

EURUSD: 0.50 lots = 50,000 EUR, pip value 5 USD
        1.0850 - 1.0810 = 40 pips
        40 x 5 = 200 USD loss

Combined loss: 740 USD, before spread widening and slippage
```

Both positions were bets against the dollar. The trader thought of them as two trades but carried one directional risk.

## Timing your entry

The first seconds after 15:30 bring the widest spreads and the sharpest reversals. Common approaches:

- Stay flat through the release and review afterwards.
- Wait 10 to 15 minutes, then look for the price to hold beyond the high or low of the release candle.
- Use a retracement into the release candle's range as an entry, with the stop beyond its opposite end.

None of these guarantees a result, but each replaces reaction with a rule you can test on historical releases.

## Common mistakes

- Placing pending orders just above and below price seconds before the release; both can fill in a whipsaw, with slippage.
- Ignoring wages and revisions in the jobs report.
- Watching headline CPI year on year instead of core month on month.
- Forgetting that gold, US indices and crypto move on the same numbers as the dollar.

> **Risk warning:** NFP and CPI regularly move XAUUSD by 20 to 40 dollars and major pairs by 50 pips or more within minutes. With leverage, spreads widen and stops can slip, so a single release can cause losses well beyond the planned amount.
