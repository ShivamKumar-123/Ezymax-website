---
slug: "p6-t-what-is-a-trading-system"
title: "What a trading system is"
summary: "The difference between a trading idea and a trading system, the components every system needs, and why writing rules down makes your trading testable."
order: 1
version: 1
takeaways:
  - "A trading system is a complete, written set of rules for what to trade, when to enter, how much to risk and when to exit, precise enough that two people would take the same trades."
  - "Every system needs the same building blocks: market and timeframe, filter, setup, entry trigger, position sizing and exits."
  - "The value of a system is that it can be measured; a vague idea cannot be tested, improved or trusted."
  - "An edge is a small statistical advantage over many trades, not a prediction about the next trade, and no system removes the risk of loss."
practice:
  label: "Write down, in one page, the rules you currently use for EURUSD trades, then check whether a stranger could follow them without asking you a question."
  symbol: "EURUSD"
quiz:
  - question: "Which statement is precise enough to be part of a trading system?"
    options:
      - "Buy when the trend looks strong"
      - "Buy when the H1 close is above the 50-period EMA and RSI(14) crosses above 50"
      - "Buy on good news for the euro"
      - "Buy when the chart feels oversold"
    answer: 1
    explanation: "Only the rule based on the EMA and an RSI cross can be applied the same way by anyone, and by software. The others depend on judgement, so they cannot be backtested or measured consistently."
  - question: "What is the main purpose of a filter in a system?"
    options:
      - "To decide the exact entry price"
      - "To calculate lot size"
      - "To switch the system off in conditions where its setups tend to fail"
      - "To set the take-profit level"
    answer: 2
    explanation: "A filter decides whether conditions are suitable at all, for example trading only when a trend is present or only during certain sessions. The trigger then decides the exact moment of entry."
  - question: "A system wins 40% of trades, with average wins of 2R and average losses of 1R. What is its expectancy per trade, before costs?"
    options:
      - "+0.2R"
      - "-0.2R"
      - "+0.4R"
      - "+0.8R"
    answer: 0
    explanation: "Expectancy = 0.40 x 2R - 0.60 x 1R = 0.8R - 0.6R = +0.2R per trade. Costs such as spread and commission reduce this figure."
  - question: "Why is a fully discretionary approach hard to improve over time?"
    options:
      - "Because discretionary traders never use stop-losses"
      - "Because discretionary traders cannot use indicators"
      - "Because discretionary trading is not allowed on CFDs"
      - "Because without fixed rules you cannot tell whether results come from the method or from inconsistent decisions"
    answer: 3
    explanation: "If the rules change from trade to trade, the results mix the quality of the idea with the quality of each decision. A system separates the two so you can measure and improve the method."
---

Most traders begin with ideas: "gold tends to bounce off round numbers", "breakouts in the London session work", "buy dips in an uptrend". Ideas are where every strategy starts, but an idea is not something you can test, measure or trust with money. A **trading system** is what you get when you turn an idea into rules so precise that anyone, including a computer, would take exactly the same trades.

This track takes you from that first definition through building a strategy in the Ezymex strategy builder, backtesting it honestly, avoiding overfitting, reading the performance metrics and finally forward-testing on a demo account.

## Discretionary and systematic trading

A **discretionary** trader looks at each situation and decides. A **systematic** trader follows predefined rules. In practice, most traders sit somewhere in between: they have rules, but they allow judgement in some areas, such as skipping trades before major news.

The problem with pure discretion is measurement. If you take 50 trades and lose money, was the idea bad, or did you apply it inconsistently? You cannot know. With written rules, the results belong to the rules, and you can change one element at a time and see what happens. Systems also protect you from yourself: the psychological biases covered in the next phase are much less damaging when the decision has already been made in advance.

## The building blocks

Every complete system answers the same questions. If any answer is missing, you do not yet have a system.

```svg
<svg viewBox="0 0 640 250" xmlns="http://www.w3.org/2000/svg" font-family="Inter, Arial, sans-serif">
  <rect width="100%" height="100%" fill="#121216"/>
  <text x="20" y="26" fill="#c9c9d1" font-size="14">The components of a trading system</text>
  <rect x="20" y="50" width="130" height="50" rx="6" fill="none" stroke="#3a3a44"/>
  <text x="32" y="72" fill="#c9c9d1" font-size="13">1 Market and</text>
  <text x="32" y="90" fill="#c9c9d1" font-size="13">timeframe</text>
  <rect x="175" y="50" width="130" height="50" rx="6" fill="none" stroke="#3a3a44"/>
  <text x="187" y="72" fill="#c9c9d1" font-size="13">2 Filter</text>
  <text x="187" y="90" fill="#c9c9d1" font-size="12">trade or not?</text>
  <rect x="330" y="50" width="130" height="50" rx="6" fill="none" stroke="#3a3a44"/>
  <text x="342" y="72" fill="#c9c9d1" font-size="13">3 Setup</text>
  <text x="342" y="90" fill="#c9c9d1" font-size="12">conditions align</text>
  <rect x="485" y="50" width="135" height="50" rx="6" fill="none" stroke="#ff5a1f"/>
  <text x="497" y="72" fill="#c9c9d1" font-size="13">4 Entry trigger</text>
  <text x="497" y="90" fill="#c9c9d1" font-size="12">exact moment</text>
  <line x1="150" y1="75" x2="175" y2="75" stroke="#3a3a44"/>
  <line x1="305" y1="75" x2="330" y2="75" stroke="#3a3a44"/>
  <line x1="460" y1="75" x2="485" y2="75" stroke="#3a3a44"/>
  <line x1="552" y1="100" x2="552" y2="140" stroke="#3a3a44"/>
  <rect x="485" y="140" width="135" height="50" rx="6" fill="none" stroke="#3a3a44"/>
  <text x="497" y="162" fill="#c9c9d1" font-size="13">5 Position size</text>
  <text x="497" y="180" fill="#c9c9d1" font-size="12">risk per trade</text>
  <line x1="485" y1="165" x2="460" y2="165" stroke="#3a3a44"/>
  <rect x="330" y="140" width="130" height="50" rx="6" fill="none" stroke="#3a3a44"/>
  <text x="342" y="162" fill="#ef4444" font-size="13">6a Stop-loss</text>
  <text x="342" y="180" fill="#c9c9d1" font-size="12">wrong: get out</text>
  <line x1="330" y1="165" x2="305" y2="165" stroke="#3a3a44"/>
  <rect x="175" y="140" width="130" height="50" rx="6" fill="none" stroke="#3a3a44"/>
  <text x="187" y="162" fill="#22c55e" font-size="13">6b Profit exit</text>
  <text x="187" y="180" fill="#c9c9d1" font-size="12">target, trail, time</text>
  <line x1="175" y1="165" x2="150" y2="165" stroke="#3a3a44"/>
  <rect x="20" y="140" width="130" height="50" rx="6" fill="none" stroke="#3a3a44"/>
  <text x="32" y="162" fill="#c9c9d1" font-size="13">7 Review</text>
  <text x="32" y="180" fill="#c9c9d1" font-size="12">log and measure</text>
  <text x="20" y="226" fill="#c9c9d1" font-size="12">Missing any box = not yet a system</text>
</svg>
```

1. **Market and timeframe.** Which symbols, which chart timeframe, which hours? "EURUSD and GBPUSD, H1 chart, 07:00 to 20:00 server time" is an answer.
2. **Filter.** Conditions under which the system is allowed to trade at all, such as a trend condition, a volatility range, or no trading during the 30 minutes around high-impact news.
3. **Setup.** The pattern or conditions that make a trade possible, for example a pullback to a moving average in an uptrend.
4. **Entry trigger.** The exact event that opens the trade, such as a candle closing above the previous candle's high, or an indicator crossing a level.
5. **Position sizing.** How much to risk, usually a fixed percentage of the account converted into a lot size using the stop distance, as covered in the risk-management phase.
6. **Exits.** A stop-loss for when the trade is wrong, and a rule for taking profit: a fixed target, a trailing stop, an opposite signal or a time limit.
7. **Review.** How results are recorded and measured, so the system can be evaluated.

## What an edge really is

A system is worth trading only if it has an **edge**: a positive expectancy after costs over a large number of trades. Expectancy is the average result per trade, usually expressed in R, where 1R is the amount risked.

> **Example:** A trend-pullback system on XAUUSD wins 42% of its trades. Average winners are 1.9R and average losers are 1.0R. Expectancy = 0.42 x 1.9 - 0.58 x 1.0 = 0.798 - 0.580 = +0.218R per trade before costs. If spread and commission average 0.08R per trade, net expectancy is about +0.14R. Risking 100 USD per trade, that is an average of about 14 USD per trade over many trades, with long losing streaks along the way.

Notice what the edge is not: it says nothing about the next trade. With a 42% win rate, runs of eight or ten losses are entirely normal. A system is a way of repeating a small advantage many times, not a way of being right more often.

## A system written out in full

Here is a simple example of a complete rule set, written the way you should write your own.

| Component | Rule |
|---|---|
| Market and timeframe | EURUSD, H1 chart, entries between 08:00 and 19:00 server time |
| Filter | 50-period EMA above 200-period EMA; no entries 30 minutes before or after high-impact USD or EUR news |
| Setup | Price pulls back to touch the 50 EMA |
| Entry trigger | RSI(14) crosses back above 50; buy at the open of the next candle |
| Stop-loss | 1.5 x ATR(14) below entry |
| Take profit | 2 x the stop distance (2R) |
| Position size | Risk 1% of account balance |
| Time exit | Close any open trade after 48 H1 candles |

Every line can be checked, coded and tested. That is the standard to aim for.

> **Risk warning:** A written system does not guarantee profits. Past results of any rule set can fail in future market conditions, and CFDs are leveraged, so a run of losses can reduce your account faster than you expect.

## Common mistakes

- **Rules with hidden judgement.** Words like "strong", "clear" or "good" are signs of a rule that is not finished.
- **No exit plan.** Most beginners define entries carefully and exits vaguely, yet exits usually decide profitability.
- **Too many rules.** Every extra condition fits the past a little better and the future a little worse, a problem covered in the overfitting chapter.
- **Judging a system on a handful of trades.** Twenty trades say almost nothing about an edge of a fraction of R per trade.
