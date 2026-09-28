---
slug: "p7-t-cognitive-biases"
title: "Cognitive biases in trading"
summary: "The mental shortcuts that quietly damage trading decisions, how to recognise them in your own behaviour, and rules that counter them."
order: 1
version: 1
takeaways:
  - "Biases are normal features of human judgement, so the goal is to design rules that limit their effect rather than to eliminate them."
  - "Loss aversion and the disposition effect push traders to cut winners early and hold losers too long, which damages expectancy."
  - "Confirmation bias and anchoring make traders defend an idea after the market has proved it wrong."
  - "Recency bias and overconfidence lead to changing strategies or increasing size after a short run of results."
  - "Pre-defined rules, written before the trade, are the most reliable defence because they are set when emotions are calm."
practice:
  label: "Review your last 20 demo trades and mark every case where you moved a stop further away or closed a winner before its target."
  symbol: "EURUSD"
quiz:
  - question: "A trader closes winning trades quickly at small profits but lets losing trades run hoping they recover. Which bias is this?"
    options:
      - "Recency bias"
      - "The disposition effect"
      - "Hindsight bias"
      - "Anchoring on the daily open"
    answer: 1
    explanation: "The disposition effect is the tendency to realise gains early and hold losses, driven by loss aversion. Recency bias is about overweighting the latest results."
  - question: "A trader is long 0.10 lot XAUUSD at 2,350.40 with a stop at 2,340.40, then moves the stop to 2,330.40. How has the risk changed on a 100 oz contract?"
    options:
      - "From 100 USD to 200 USD"
      - "From 10 USD to 20 USD"
      - "It is unchanged"
      - "From 1,000 USD to 2,000 USD"
    answer: 0
    explanation: "Original risk: 10.00 x 100 x 0.10 = 100 USD. New risk: 20.00 x 100 x 0.10 = 200 USD. The planned risk has doubled."
  - question: "After five winning trades in a row, a trader doubles position size because they feel they have found the market's rhythm. Which biases are most involved?"
    options:
      - "Loss aversion and sunk cost"
      - "Anchoring and the endowment effect"
      - "Overconfidence and recency bias"
      - "Status quo bias only"
    answer: 2
    explanation: "A short winning run inflates confidence and is treated as more meaningful than it is. Five trades is far too small a sample to justify a change in risk."
  - question: "Which practice is the most effective defence against biases during a trade?"
    options:
      - "Watching more news while the trade is open"
      - "Asking other traders on social media"
      - "Trading larger size to take the result more seriously"
      - "Writing entry, stop, target and invalidation before entering, and not widening the stop afterwards"
    answer: 3
    explanation: "Decisions made before the trade, with no money at stake, are less affected by emotion. Seeking opinions mid-trade often feeds confirmation bias."
---

Most trading losses that feel like bad luck are, on review, the result of predictable decisions. Traders move stops, close good trades too early, chase moves they missed and double their size after a lucky streak. These are not random failures of discipline. They follow patterns that psychologists have studied for decades, known as cognitive biases. Understanding them will not make you immune, but it will help you build rules that work even when your judgement does not.

## Why the brain misleads traders

The mind uses shortcuts to make fast decisions with incomplete information. In everyday life these shortcuts are usually helpful. Markets are different: feedback is noisy, outcomes are probabilistic, and a good decision can lose money while a bad one can win. That combination rewards the wrong lessons, and biases thrive in it.

## Loss aversion and the disposition effect

Research in behavioural finance suggests that a loss feels roughly twice as painful as a gain of the same size feels good. In trading this produces the **disposition effect**: realising gains quickly to lock in the pleasant feeling, while holding losers in the hope of avoiding the pain of taking the loss.

The outcome is a strategy with small wins and large losses, the opposite of what most profitable approaches need. It often shows up as moving a stop loss.

> **Example:** A trader buys 0.10 lot XAUUSD at 2,350.40 with a stop at 2,340.40, risking 10.00 x 100 x 0.10 = 100 USD. Price drops to 2,342.00 and the trader moves the stop to 2,330.40 "to give it room". The risk is now 20.00 x 100 x 0.10 = 200 USD. If the stop is hit, the loss is double the plan, and a strategy whose statistics assumed 1R losses now suffers 2R losses.

> **Risk warning:** Leveraged CFD positions magnify the damage of biased decisions. A habit of widening stops can turn a strategy with positive expectancy into one that loses money, and losses can exceed what you planned to risk.

## Confirmation bias and anchoring

**Confirmation bias** is the tendency to seek information that supports what you already believe. Once long, a trader notices every bullish headline and dismisses bearish ones. The fix is to write down, before entering, what would prove the idea wrong: the invalidation level or event.

**Anchoring** means giving too much weight to a reference number. Traders anchor to their entry price ("I will close when it gets back to breakeven"), to a previous high ("it was 2,400 last month, so it is cheap"), or to a target they read somewhere. The market does not know your entry price. The only relevant question is whether the trade still meets your criteria from here.

## Recency bias and overconfidence

**Recency bias** gives too much weight to recent events. After three losing trades, a sound strategy feels broken; after four winners, a marginal one feels brilliant. **Overconfidence** follows a run of success and leads to larger size, more trades and fewer checks.

The statistics of any real strategy include streaks. With a 45% win rate, the probability that any given run of five trades are all losses is 0.55 to the power of 5, about 5%. Across hundreds of trades, such runs are almost certain to occur. Changing strategy or size based on a handful of results is reacting to noise.

## Other biases worth knowing

| Bias | How it appears in trading | Counter-rule |
|---|---|---|
| Sunk cost | Adding to a loser because "I have already lost so much" | No adding to losing positions unless the plan explicitly allows it |
| Fear of missing out | Chasing a breakout after it has already run | Only enter at planned levels; missed trades are not losses |
| Hindsight bias | "It was obvious" after the move | Judge decisions using only information available at the time |
| Gambler's fallacy | "Five losses in a row, the next must win" | Each trade is independent under your edge |
| Outcome bias | Judging a trade good because it won | Grade trades on process, not result |

## In practice: building bias-resistant rules

Biases are strongest when money is at risk and a decision must be made quickly. The most effective counter is to decide before that moment.

1. Write entry, stop, target and invalidation in your journal before placing the order.
2. Place the stop loss and take profit with the order in Kalks Trader, so the plan is live on the server rather than in your head.
3. Allow the stop to move only in the direction of reducing risk, for example to breakeven or with a trailing stop.
4. Evaluate strategy changes only after a meaningful sample, such as 50 to 100 trades.
5. Review trades weekly and tag any decision that broke a rule, so you can see which biases cost you most.

The later chapters on the trading plan, journaling and performance review turn these ideas into a working process.
