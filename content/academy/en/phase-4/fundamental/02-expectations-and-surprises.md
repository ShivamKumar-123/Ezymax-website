---
slug: "p4-f-expectations-and-surprises"
title: "Expectations, surprises and priced-in news"
summary: "Why markets move on the difference between data and expectations, and how to size a surprise."
order: 2
version: 1
takeaways:
  - "Prices move on new information, so what matters is the surprise relative to expectations, not the raw number."
  - "Dividing a surprise by the typical forecast error shows whether it is genuinely large or just noise."
  - "Multi-part releases must be read as a whole; wages, revisions and core measures can outweigh the headline."
  - "When positioning is one-sided, even a small surprise against the crowd can cause an outsized move."
  - "The first price reaction is often revised within minutes as the details are digested."
quiz:
  - question: "EURUSD rises for two weeks ahead of an ECB meeting on expectations of a hawkish tone. The ECB is exactly as hawkish as expected. What often happens?"
    options:
      - "EURUSD rises sharply again"
      - "Spreads permanently widen"
      - "EURUSD cannot move because nothing changed"
      - "EURUSD may fall as traders take profit on a fully priced outcome"
    answer: 3
    explanation: "When an outcome is fully priced in, those who bought in anticipation often close positions once it is confirmed, the classic buy the rumour, sell the fact reaction."
  - question: "Consensus for a release is 180K, actual is 210K, and the standard deviation of past surprises is 60K. What is the standardised surprise?"
    options:
      - "0.5"
      - "1.5"
      - "3.0"
      - "30"
    answer: 0
    explanation: "(210K - 180K) / 60K = 0.5. Half a typical forecast error is a modest surprise and may not produce a lasting move."
  - question: "Which statement about a whisper number is correct?"
    options:
      - "It is the official figure leaked in advance"
      - "It is always identical to the consensus"
      - "It is the unofficial expectation traders actually hold, which can differ from the published consensus"
      - "It is the previous month's revised figure"
    answer: 2
    explanation: "A whisper number is the informal market expectation. If it sits above consensus, a result that merely matches consensus can disappoint."
  - question: "US payrolls beat consensus, but average hourly earnings miss and unemployment rises. What is the most realistic description of the likely reaction?"
    options:
      - "An automatic, lasting USD rally"
      - "No reaction, since only the headline matters"
      - "A mixed or reversing reaction as the components pull in different directions"
      - "A guaranteed USD fall"
    answer: 2
    explanation: "Multi-part releases are read in full. A strong headline with weak wages and higher unemployment sends mixed signals, and the initial move frequently reverses as details are absorbed."
---

A common beginner puzzle: the data was strong, so why did the currency fall? The answer is that markets trade expectations. By the time a number is published, the likely outcome is already in the price. Only the part that was not expected can move it. This chapter explains how expectations form, how to measure a surprise and why reactions are often messy.

## Prices discount what is expected

Markets are forward-looking. Economists publish forecasts, banks publish previews, and interest-rate futures show what the market expects central banks to do. Traders position accordingly. If everyone expects inflation to rise to 3.2%, the currency has usually already strengthened in anticipation.

This leads to three typical outcomes:

| Result versus expectation | Typical reaction |
|---|---|
| In line | Small move, sometimes profit-taking against the pre-release trend |
| Better than expected | Move in the direction the data implies, sized by the surprise |
| Worse than expected | Move against the data's implied direction |

The phrase "buy the rumour, sell the fact" describes the first row. A currency that rallied for weeks ahead of an expected rate hike can drop on the day the hike is confirmed, because the reason to hold the position has been used up.

## Measuring the size of a surprise

A 0.1 percentage point miss on CPI is significant; a 10K miss on payrolls is barely noise. To compare, divide the surprise by the typical forecast error, measured as the standard deviation of past surprises for that indicator.

```text
Standardised surprise = (Actual - Consensus) / Std. dev. of past surprises

US NFP: consensus 180K, actual 250K, typical error 60K
(250 - 180) / 60 = 1.17  -> a meaningful but not extreme surprise

US CPI m/m: consensus 0.2%, actual 0.4%, typical error 0.1%
(0.4 - 0.2) / 0.1 = 2.0  -> a large surprise
```

As a rough guide, readings within about half a standard deviation are often absorbed quickly, while surprises beyond one to two standard deviations are more likely to produce a sustained move. You can estimate the typical error yourself by recording the last 12 to 24 releases from the calendar in a spreadsheet.

## Whisper numbers and positioning

The published consensus is not the only expectation. After several strong releases, traders may quietly expect another beat, a so-called whisper number. If the actual merely matches consensus, it disappoints the whisper and the market reacts as if the data were weak.

Positioning matters too. When most participants are already long a currency, there are few buyers left to push it higher on good news, but many holders who will sell on bad news. A small negative surprise can then trigger a large drop as positions are closed. Phase 6 covers positioning data such as the COT report in more detail.

## Reading the whole release

Most major reports contain several numbers. The US employment report includes payrolls, the unemployment rate, average hourly earnings and revisions. CPI has headline and core measures, month on month and year on year. Central banks often focus on the component that matters most for policy at the time, and markets follow that focus.

> **Example:** Consensus NFP 180K, actual 250K, a clear beat. But the previous month is revised from 210K to 150K, unemployment rises from 3.9% to 4.1%, and hourly earnings grow 0.2% against 0.3% expected. EURUSD might drop 25 pips in the first second on the headline, then recover 40 pips over the next ten minutes as traders read the details. Anyone who chased the first move would be sitting on a loss.

## The first move and the real move

Algorithms read the headline in milliseconds, so the first move reflects that single number. Over the following minutes, human traders and slower models weigh the full picture, and the price can extend, stall or reverse. This is why many traders prefer to wait for the first 5 to 15 minutes to settle before acting, accepting a worse entry in exchange for a clearer picture.

## In practice

- Before a release, write down the consensus, your estimate of the typical surprise, and what outcome would count as big.
- Note the recent trend into the event: a strong run-up raises the risk of a sell-the-fact reaction.
- After the release, read every component before deciding what the number means.
- Treat the first spike as noise until the details confirm it.

> **Risk warning:** Even a correctly interpreted surprise can move against you in the short term. News-driven moves on leveraged CFDs can be fast and large, and stops may be filled at worse prices than set.
