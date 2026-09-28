---
slug: "p8-t-execution-quality"
title: "Execution quality and trading costs"
summary: "Measure the full cost of every trade, including spread, commission, slippage and swap, and improve execution through order choice, timing and records."
order: 3
version: 1
takeaways:
  - "Total trading cost includes spread, commission, slippage and swap, and for short-term strategies it can consume a large share of the gross edge."
  - "Slippage should be measured by recording the intended price and comparing it with the actual fill on every trade."
  - "Order type and timing are the main levers a trader controls: limit orders avoid paying the spread on entry but risk missing the trade."
  - "Costs must be included in backtests at realistic levels; a strategy that only works with zero costs does not work."
practice:
  label: "Place ten small market orders on EURUSD on your demo account at different times of day, record the quoted price before each click and the fill price, and calculate the average slippage."
  symbol: "EURUSD"
quiz:
  - question: "A EURUSD strategy pays a 0.8-pip spread, 7 USD commission per lot round turn and averages 0.3 pips of negative slippage. What is the total cost per round trip in pips, with a pip value of 10 USD per lot?"
    options:
      - "1.1 pips"
      - "1.5 pips"
      - "0.8 pips"
      - "1.8 pips"
    answer: 3
    explanation: "Commission of 7 USD equals 0.7 pips at 10 USD per pip. Total = 0.8 + 0.7 + 0.3 = 1.8 pips."
  - question: "What is the main trade-off of using limit orders instead of market orders for entries?"
    options:
      - "Limit orders always have higher commission"
      - "Limit orders avoid crossing the spread and slippage on entry but may not be filled if price does not reach the level"
      - "Limit orders cannot have stop losses"
      - "Limit orders are always filled at a worse price"
    answer: 1
    explanation: "A limit order waits for the market to come to you. You get the price you asked for or better, but some of the best trades run away without filling."
  - question: "Why are spreads often wider around 00:00 server time?"
    options:
      - "Because daily rollover coincides with low liquidity as many liquidity providers reset positions and books"
      - "Because swaps are cancelled at that time"
      - "Because the market is closed"
      - "Because all news is released then"
    answer: 0
    explanation: "The New York close and daily rollover are low-liquidity periods. Spreads commonly widen for a short time, which affects stops and entries placed then."
  - question: "A strategy has a gross expectancy of 4 pips per trade and total costs of 1.8 pips per trade. Over 400 trades at 1 lot (10 USD per pip), what is the net result?"
    options:
      - "16,000 USD"
      - "7,200 USD"
      - "8,800 USD"
      - "5,200 USD"
    answer: 2
    explanation: "Net expectancy is 4 - 1.8 = 2.2 pips. 2.2 x 10 USD x 400 = 8,800 USD. Costs of 7,200 USD consumed 45% of the gross result."
---

Two traders can run the same strategy on the same symbol and get very different results. The difference is often execution: which orders they use, when they trade, and how carefully they track costs. At the professional level, execution is not an afterthought. It is a measurable part of performance that can be improved.

## The full cost of a trade

Every round trip carries four potential costs:

- **Spread:** the difference between bid and ask, paid when you enter with a market order and again implicitly when you exit.
- **Commission:** charged per lot on some account types, usually quoted per round turn.
- **Slippage:** the difference between the price you expected and the price you received. It can be negative or positive.
- **Swap:** overnight financing for positions held past 00:00 server time, tripled on Wednesday night for FX and metals and on Friday for indices, energies and stocks.

To compare them, convert everything into the same unit, such as pips or points per lot.

```text
EURUSD, pip value 10 USD per standard lot
Spread                            0.8 pips
Commission 7 USD per lot RT       7 / 10 = 0.7 pips
Average slippage (measured)       0.3 pips
Total cost per round trip         1.8 pips  = 18 USD per lot

Strategy gross expectancy         4.0 pips per trade
Net expectancy                    4.0 - 1.8 = 2.2 pips

400 trades per year at 1 lot
Gross result                      4.0 x 10 x 400 = 16,000 USD
Total costs                       1.8 x 10 x 400 =  7,200 USD
Net result                        2.2 x 10 x 400 =  8,800 USD
```

Costs take 45% of the gross edge here. Cutting slippage from 0.3 to 0.1 pips would add 0.2 x 10 x 400 = 800 USD a year with no change to the strategy. For a D1 swing system averaging 80 pips per trade, the same costs would be a small fraction, which is why cost sensitivity depends so heavily on trade frequency and target size.

## Measuring slippage properly

You cannot improve what you do not measure. For every trade, record:

1. The **decision price**: the bid or ask shown when you decided to trade, or the level of the pending order.
2. The **fill price** from the trade history in Kalks Trader or the Portfolio section of the Client Area.
3. The time, symbol, order type and whether news was due.

Slippage = fill price minus decision price, signed so that negative means worse for you. Averaging over at least 30 trades per symbol and order type gives a useful picture. You will usually find that slippage is concentrated in a few situations: news releases, market opens, the daily rollover and fast breakouts.

## Choosing the right order type

Order choice is the main execution lever you control.

| Order | Advantage | Drawback |
|---|---|---|
| Market | Certain to fill in normal conditions | Pays the spread; exposed to slippage in fast markets |
| Limit | Price you set or better; no spread crossing on entry | May not fill; can fill only on the trades that reverse against you |
| Stop | Enters with momentum at a defined level | Fills as a market order once triggered; slippage in fast moves |
| Stop-limit | Caps the worst fill price | May not fill at all if price gaps through the limit |

A useful test is to compare a strategy's backtest using market entries with a version using limit entries a fraction of ATR better. If the limit version keeps most of the trades, it may reduce costs meaningfully. If it misses the strongest moves, the market version is better despite the higher cost. The phenomenon where limit orders fill mostly on trades that then go against you is called adverse selection, and it must be tested rather than assumed away.

## Timing and liquidity

Liquidity varies across the day. For FX majors it is deepest during the London session and the London-New York overlap. Spreads are usually widest in the minutes around the daily rollover at 00:00 server time and in the Asian session for European pairs. Index CFDs have their tightest pricing while the underlying cash market is open, and US stock CFDs only trade 09:30 to 16:00 New York time.

> **Tip:** If your strategy generates signals at the daily close, consider executing a few minutes after rollover, once spreads have normalised, and test whether that delay changes results. Many D1 systems lose little by waiting and save noticeably on costs.

## In practice

- Include realistic spread, commission and slippage in every backtest in Developer, Backtests; run a stress test with double the costs.
- Review execution statistics monthly alongside performance.
- Avoid placing stops exactly at round numbers or obvious levels where many orders cluster.
- Use the contract specification in Kalks Trader to check the commission and swap for each symbol and account type.

> **Risk warning:** In fast markets, especially around news, orders can fill far from the requested price and stop losses do not guarantee execution at the stop level. CFDs are leveraged and costs and slippage can turn a small edge into a loss.
