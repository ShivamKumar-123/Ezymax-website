---
slug: "p4-f-central-bank-decision-days"
title: "Central-bank decision days"
summary: "How rate decisions, statements, projections and press conferences unfold, and why the reaction often comes in waves."
order: 3
version: 1
takeaways:
  - "The rate decision itself is usually priced in; the statement, projections and press conference carry most of the surprise."
  - "Interest-rate futures show the probability the market assigns to each outcome before the meeting."
  - "Decision days often produce two or three separate waves of volatility, one per information release."
  - "A decision affects every instrument linked to that currency, including gold, indices and crypto for the Fed."
  - "Planning which waves you will avoid, and at what size you will hold, is part of the trade plan."
practice:
  label: "Find the next FOMC or ECB meeting in the Economic calendar, convert the statement and press-conference times to server time, and mark both as vertical lines on a 5-minute EURUSD chart."
  symbol: "EURUSD"
quiz:
  - question: "The market prices a 95% probability of a 25 bp cut. The central bank cuts by 25 bp but signals no further cuts this year. What is the most likely reaction in that currency?"
    options:
      - "It weakens because rates were cut"
      - "It strengthens because the guidance is more hawkish than expected"
      - "No reaction because the cut was priced in"
      - "It weakens by exactly the size of the cut"
    answer: 1
    explanation: "The cut itself was almost fully priced. The new information is the guidance, which points to fewer cuts than expected, so the currency tends to rise."
  - question: "An FOMC statement is released at 14:00 New York time. When is that on a Kalks Trader chart?"
    options:
      - "19:00 server time"
      - "20:00 server time"
      - "21:00 server time"
      - "22:00 server time"
    answer: 2
    explanation: "Server time is New York time plus seven hours, so 14:00 New York is 21:00 server time. The press conference usually follows 30 minutes later."
  - question: "Which description of the term hawkish is correct?"
    options:
      - "Favouring lower rates or looser policy"
      - "Intervening directly in equity markets"
      - "Refusing to publish forecasts"
      - "Favouring higher rates or tighter policy to control inflation"
    answer: 3
    explanation: "Hawkish means leaning towards tighter policy, higher rates or fewer cuts. Dovish is the opposite."
  - question: "Why do many traders avoid holding a tight stop through the press conference?"
    options:
      - "Answers to questions can swing the price both ways in quick succession"
      - "Press conferences are not published"
      - "Stops are disabled during press conferences"
      - "Spreads narrow to zero during press conferences"
    answer: 0
    explanation: "Unscripted answers can move price sharply in both directions within minutes, so a tight stop is likely to be hit even if the eventual direction favours the position."
---

Central banks set the price of money, and Phase 3 explained why that matters for currencies. On decision days the market receives several pieces of policy information in a sequence. Each piece can move prices, and they do not always point in the same direction. This chapter shows how to prepare for these days.

## The sequence of a decision day

The largest central banks follow a similar pattern, with details varying by bank:

| Stage | What is released | Why it matters |
|---|---|---|
| Rate decision | The policy rate | Usually expected; a surprise here is rare but powerful |
| Statement | Text explaining the decision | Wording changes signal future direction |
| Projections | Growth, inflation, rate paths (for the Fed, the dot plot at some meetings) | Shows where officials expect rates to go |
| Press conference | Chair or governor answers questions | Unscripted tone, often the biggest mover |
| Minutes | Detailed record, weeks later | Shows how divided the committee was |

The US Federal Reserve and the European Central Bank each hold eight scheduled policy meetings a year, as does the Bank of England. The Fed's statement is published at 14:00 New York time, which is 21:00 server time, with the press conference 30 minutes later. The ECB decision and press conference arrive in the European afternoon.

## What is already priced in

Interest-rate futures and overnight index swaps let traders bet on future central-bank rates. Their prices can be converted into probabilities. If the market prices a 90% chance of a 25 basis point cut, the cut itself will barely move prices. The reaction then depends on the forward guidance: are more cuts coming, and how fast?

> **Example:** Before a meeting, futures imply a 90% chance of a 25 bp cut and two more cuts by year-end. The central bank cuts by 25 bp, but its projections show only one more. The currency rises, even though rates were lowered, because the path of future rates is now higher than expected. This is called a hawkish cut.

The words hawkish and dovish describe the tone: hawkish leans towards higher rates or fewer cuts; dovish leans towards lower rates or more stimulus.

## Waves of volatility

Because information arrives in stages, a decision day often produces separate spikes.

```svg
<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" fill="#121216"/>
<g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
<line x1="50" y1="220" x2="620" y2="220" stroke="#3a3a44"/>
<line x1="50" y1="30" x2="50" y2="220" stroke="#3a3a44"/>
<text x="10" y="40">Price</text>
<text x="560" y="240">Time</text>
<line x1="230" y1="30" x2="230" y2="220" stroke="#ff5a1f" stroke-dasharray="4 4"/>
<line x1="380" y1="30" x2="380" y2="220" stroke="#ff5a1f" stroke-dasharray="4 4"/>
<text x="178" y="24">21:00 statement</text>
<text x="330" y="24">21:30 press conf.</text>
<polyline fill="none" stroke="#c9c9d1" stroke-width="2" points="60,130 100,128 140,132 180,127 225,130 235,80 245,95 260,90 290,100 330,98 375,100 385,150 395,110 405,170 420,140 450,165 500,175 560,180 610,178"/>
<text x="240" y="70" fill="#22c55e">wave 1: headline</text>
<text x="410" y="200" fill="#ef4444">wave 2: reversal on tone</text>
<text x="60" y="110">quiet pre-event drift</text>
</g>
</svg>
```

In the sketch above, the statement lifts the price, then the press conference reverses it and more. This is not unusual. The first wave reacts to the text; the second reacts to what the chair says when pressed. The final direction is often only clear an hour or more after the statement, and sometimes not until the next day.

## Which instruments move

A Fed decision affects almost everything quoted in dollars: EURUSD, GBPUSD, USDJPY, XAUUSD, US30, NAS100, SPX500 and usually BTCUSD. An ECB decision mainly moves EUR pairs and GER40, while a Bank of Japan surprise can shake USDJPY, EURJPY and GBPJPY by several hundred pips. Check your whole portfolio, not just the pair you think of first.

The relative effect matters as well. EURUSD reflects both the Fed and the ECB, so a hawkish Fed in the same week as a hawkish ECB may leave the pair little changed, while a hawkish Fed and a dovish ECB can push it sharply lower. When two central banks meet in the same week, read the expectations for both before deciding which currency is likely to be repriced more. Speeches by committee members in the days between meetings can also shift pricing, and they appear on the calendar as lower-impact events that occasionally move markets as much as a decision.

## Preparing for the day

1. Read one or two previews to learn what is expected for the rate, the guidance and the projections.
2. Note the pricing from futures, which many news services quote as percentage probabilities.
3. Decide what you will do with open positions before the statement: close, reduce, or hold with a wider stop and smaller size.
4. If you want to trade the reaction, wait until after the press conference begins, when the tone is clearer.
5. Remember swaps: a position held through a decision on a Wednesday also carries triple swap for FX and metals.

## Common mistakes

- Trading the rate decision alone and ignoring the guidance.
- Holding a tight stop through the press conference, where price can swing both ways.
- Assuming the first move is the final direction.
- Forgetting that a US decision at 21:00 server time arrives when liquidity is thinner than during the European morning.

> **Risk warning:** Central-bank days are among the most volatile events for leveraged CFDs. Spreads can widen sharply and prices can gap between quotes, so losses can be larger than your stop distance suggests. Consider reducing size or staying flat.
