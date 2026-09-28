---
slug: "p2-t-execution-slippage-gaps"
title: "Execution, slippage, gaps and weekend risk"
summary: "Why orders are sometimes filled away from the price you expected, how gaps jump over stop losses, and how to manage positions through closed markets."
order: 6
version: 1
takeaways:
  - "Slippage is the difference between the expected price and the fill price; it can be negative or positive and is largest in fast, thin markets."
  - "A gap occurs when a market opens away from its previous close, and stop orders in the gap are filled at the first available price."
  - "FX, metals, indices and energies close at the weekend while crypto keeps trading, and US stock CFDs gap regularly around earnings outside 09:30 to 16:00 New York time."
  - "Reducing size or closing before weekends and major events is the main defence, because a stop loss cannot prevent a gap."
practice:
  label: "On a EURUSD H1 chart, scroll back through several Monday opens and measure the gap in pips between Friday's last close and Monday's first open."
  symbol: "EURUSD"
quiz:
  - question: "You place a market buy with EURUSD showing 1.0851 and are filled at 1.0848. What happened?"
    options:
      - "Negative slippage of 3 pips"
      - "A requote"
      - "Positive slippage of 3 pips"
      - "A gap"
    answer: 2
    explanation: "For a buy, a lower fill price is better. Being filled 3 pips below the displayed ask is positive slippage."
  - question: "You are long 0.50 lot EURUSD at 1.0850 with a stop at 1.0820. Monday opens at 1.0780. What loss should you expect?"
    options:
      - "150 USD, because the stop is at 1.0820"
      - "350 USD, because the stop fills near the 1.0780 open"
      - "0 USD, stops are cancelled over the weekend"
      - "35 USD"
    answer: 1
    explanation: "The market never traded at 1.0820. The stop is triggered at the open and filled around 1.0780: 70 pips x 5 USD = 350 USD, more than double the planned 150 USD."
  - question: "Which of these markets keeps trading when FX is closed on Saturday?"
    options:
      - "XAUUSD"
      - "US30"
      - "USOIL"
      - "BTCUSD"
    answer: 3
    explanation: "Crypto trades 24/7. FX, metals, indices and energies are closed on Saturday and Sunday server time."
  - question: "A buy limit is set at 1.0800 and the market gaps down to open at 1.0780. How is it usually filled?"
    options:
      - "At 1.0780 or better, since it is below the limit"
      - "At 1.0800 exactly"
      - "It is cancelled"
      - "At Friday's close"
    answer: 0
    explanation: "A buy limit fills at the limit price or better. An open below the limit is a better price, so it typically fills at the opening price."
---

Until now we have treated prices as if you could always trade exactly the number on the screen. Most of the time on liquid symbols you can. But markets are made of real orders from real participants, and when those orders are scarce or one-sided, fills happen at other prices. This chapter covers **slippage**, **gaps** and the specific risk of holding positions when markets are closed.

## How execution works

When you send a market order, or a stop order triggers, the platform executes it at the best price available at that moment. On EURUSD during the London session, liquidity is deep and the price moves in tiny steps, so the fill is almost always the price you saw. The situation changes when:

- a high-impact release such as US jobs or inflation data hits the market,
- a central bank surprises,
- liquidity is thin, for example around 00:00 server time when the trading day rolls over,
- a market reopens after being closed.

In those moments prices can jump several pips between one quote and the next, and spreads widen.

## Slippage

Slippage is the difference between the price you expected and the price you received. It works both ways:

- **Negative slippage:** a buy fills higher or a sell fills lower than expected.
- **Positive slippage:** a buy fills lower or a sell fills higher than expected.

```text
News release, market buy 0.50 lot EURUSD
Displayed ask 1.0851, filled at 1.0856
Slippage: 5 pips x 5.00 USD = 25.00 USD worse than expected
```

Limit orders do not suffer negative slippage, because they only fill at your price or better; the risk instead is not being filled at all. Stop orders, and stop losses, can slip because they turn into market orders once triggered.

## Gaps

A **gap** is a jump between one price and the next with no trading in between. On a chart it appears as empty space between two candles. Gaps are most common at the weekly open after weekend news, on stock CFDs when earnings are released outside trading hours, and occasionally after major unscheduled events.

A stop loss inside a gap cannot be filled at its level, because nobody traded there. It is triggered by the first price after the gap and filled at or near that price.

```svg
<svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <line x1="60" y1="30" x2="60" y2="260" stroke="#3a3a44" stroke-width="1"/>
  <line x1="60" y1="260" x2="560" y2="260" stroke="#3a3a44" stroke-width="1"/>
  <text x="8" y="84" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0850</text>
  <text x="8" y="144" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0820</text>
  <text x="8" y="224" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0780</text>
  <line x1="60" y1="80" x2="440" y2="80" stroke="#3a3a44" stroke-width="1" stroke-dasharray="3 3"/>
  <text x="450" y="84" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Entry 1.0850</text>
  <line x1="60" y1="140" x2="440" y2="140" stroke="#ff5a1f" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="450" y="144" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Stop loss 1.0820</text>
  <line x1="90" y1="56" x2="90" y2="88" stroke="#22c55e" stroke-width="1"/>
  <rect x="80" y="64" width="20" height="16" fill="#22c55e"/>
  <line x1="130" y1="60" x2="130" y2="96" stroke="#ef4444" stroke-width="1"/>
  <rect x="120" y="64" width="20" height="26" fill="#ef4444"/>
  <line x1="170" y1="82" x2="170" y2="116" stroke="#ef4444" stroke-width="1"/>
  <rect x="160" y="90" width="20" height="14" fill="#ef4444"/>
  <line x1="210" y1="96" x2="210" y2="120" stroke="#ef4444" stroke-width="1"/>
  <rect x="200" y="104" width="20" height="6" fill="#ef4444"/>
  <text x="150" y="250" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Friday</text>
  <text x="300" y="185" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Weekend: no trading</text>
  <line x1="370" y1="184" x2="370" y2="236" stroke="#22c55e" stroke-width="1"/>
  <rect x="360" y="196" width="20" height="24" fill="#22c55e"/>
  <text x="370" y="250" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Monday</text>
  <line x1="400" y1="220" x2="440" y2="220" stroke="#c9c9d1" stroke-width="1"/>
  <text x="450" y="224" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Stop filled near 1.0780</text>
  <text x="300" y="286" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Friday close 1.0835, Monday open 1.0780: no prices traded in between</text>
</svg>
```

> **Example:** You are long 0.50 lot EURUSD at 1.0850 with a stop at 1.0820, a planned risk of 30 pips x 5.00 USD = 150 USD. Friday closes at 1.0835. Over the weekend there is unexpected political news, and Monday opens at 1.0780. Your stop triggers at the open and fills around 1.0780: 70 pips x 5.00 USD = 350 USD, more than twice the planned loss.

Gaps can also help. A buy limit at 1.0800 in the same scenario would typically fill at the 1.0780 open, a better price than requested.

## Weekend and session risk on Kalks

Sessions on Kalks, in server time, create predictable closed periods:

- **FX, metals, indices and energies** are closed on Saturday and Sunday. Anything that happens in between is priced in at the open.
- **Crypto** trades 24/7, so BTCUSD or ETHUSD can move sharply while your FX positions are frozen. Because margin level is calculated across the whole account, a weekend crypto loss can affect the margin available to your other positions.
- **US stock CFDs** such as AAPL, NVDA or TSLA trade 09:30 to 16:00 New York time. Earnings are usually released outside those hours, so the next open can be far from the previous close.

> **Example:** A stock CFD closes at 120.00 and the company reports weak results after the close. You hold 10 shares long with a stop at 115.00, a planned risk of 50 USD. The next day it opens at 108.00. The stop fills near 108.00 and the loss is 12.00 x 10 = 120 USD.

> **Risk warning:** CFDs are leveraged. News, gaps and thin liquidity can cause fills far from your stop, and losses can exceed what you planned. A stop loss limits loss in normal conditions; it cannot protect you from a gap.

## In practice

- Check the economic calendar in the Client Area before trading and before the weekend.
- Reduce size, or close, ahead of high-impact news and weekends if a gap would hurt more than you can accept.
- Avoid entering in the minutes around 00:00 server time, when spreads widen.
- Measure your risk against a realistic gap, not only the distance to your stop.
