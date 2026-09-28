---
slug: "p2-t-pending-orders"
title: "Pending orders: limit, stop, stop-limit and expiry"
summary: "The four basic pending orders and the stop-limit, where each one sits relative to the current price, how it is triggered and when it expires."
order: 2
version: 1
takeaways:
  - "Limit orders buy below or sell above the current price and fill at the limit price or better."
  - "Stop orders buy above or sell below the current price and become market orders when triggered, so they can slip."
  - "A stop-limit places a limit order once the stop price is reached, which controls price but may leave you unfilled."
  - "Buy orders trigger on the ask and sell orders on the bid, and every pending order needs an expiry choice: GTC, Today or a specific date."
practice:
  label: "With EURUSD on your demo account, place one buy limit 30 pips below and one buy stop 30 pips above the current price, both expiring Today, and watch them in the orders list."
  symbol: "EURUSD"
quiz:
  - question: "EURUSD is at 1.0850 / 1.0851. You want to buy only if price dips to 1.0820. Which order do you use?"
    options:
      - "Buy stop at 1.0820"
      - "Sell limit at 1.0820"
      - "Buy limit at 1.0820"
      - "Sell stop at 1.0820"
    answer: 2
    explanation: "A buy below the current price is a buy limit. A buy stop must be placed above the current price."
  - question: "Which order type is used to enter a breakout above resistance at 1.0880 when the price is 1.0851?"
    options:
      - "Buy stop at 1.0880"
      - "Buy limit at 1.0880"
      - "Sell limit at 1.0880"
      - "Sell stop at 1.0880"
    answer: 0
    explanation: "A buy stop is placed above the market and triggers when the ask reaches it, which suits a breakout entry."
  - question: "A buy stop at 1.0880 is triggered during a fast move. What can happen to the fill price?"
    options:
      - "It is always exactly 1.0880"
      - "It can only be better than 1.0880"
      - "The order is cancelled automatically"
      - "It can be worse than 1.0880, because a triggered stop becomes a market order"
    answer: 3
    explanation: "Once triggered, a stop order is executed at the next available price. In fast markets that may be above 1.0880 for a buy."
  - question: "You set a pending order's expiry to Today. What happens if it has not been filled by the end of the trading day?"
    options:
      - "It becomes a market order"
      - "It is cancelled automatically"
      - "It stays active until you delete it"
      - "It is moved to the next day's open price"
    answer: 1
    explanation: "An order with Today expiry is removed at the end of the trading day if unfilled. GTC orders stay active until filled or cancelled."
---

A market order acts on the price in front of you. A **pending order** is an instruction to act at a price that has not been reached yet. It lets you define an entry in advance, walk away from the screen and still have the trade opened, or not, according to your plan. Kalks Trader supports limit, stop and stop-limit orders, each with an expiry.

## The four basic pending orders

Pending orders are defined by direction and by where the price sits relative to the market.

| Order | Placed | Idea | Fills |
|---|---|---|---|
| Buy limit | Below the ask | Buy cheaper, expect a bounce | At limit price or better |
| Sell limit | Above the bid | Sell higher, expect a turn down | At limit price or better |
| Buy stop | Above the ask | Buy strength, a breakout up | As a market order once triggered |
| Sell stop | Below the bid | Sell weakness, a breakdown | As a market order once triggered |

An easy way to remember: **limit** orders ask for a *better* price than now; **stop** orders accept a *worse* price than now in exchange for confirmation that the market is moving your way.

```svg
<svg viewBox="0 0 620 340" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <line x1="80" y1="30" x2="80" y2="310" stroke="#3a3a44" stroke-width="1"/>
  <text x="20" y="24" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Price</text>
  <line x1="80" y1="50" x2="330" y2="50" stroke="#ef4444" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="14" y="54" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0890</text>
  <text x="340" y="54" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="13">Sell limit: sell higher</text>
  <line x1="80" y1="80" x2="330" y2="80" stroke="#22c55e" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="14" y="84" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0880</text>
  <text x="340" y="84" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="13">Buy stop: buy a breakout</text>
  <line x1="80" y1="170" x2="330" y2="170" stroke="#ff5a1f" stroke-width="2"/>
  <text x="14" y="174" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0850</text>
  <text x="340" y="174" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="13">Current price 1.0850 / 1.0851</text>
  <line x1="80" y1="260" x2="330" y2="260" stroke="#22c55e" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="14" y="264" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0820</text>
  <text x="340" y="264" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="13">Buy limit: buy cheaper</text>
  <line x1="80" y1="290" x2="330" y2="290" stroke="#ef4444" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="14" y="294" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">1.0810</text>
  <text x="340" y="294" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="13">Sell stop: sell a breakdown</text>
  <text x="310" y="330" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Green = buy orders (trigger on ask), red = sell orders (trigger on bid)</text>
</svg>
```

## How triggering works

Buy orders are triggered by the **ask**, and sell orders by the **bid**, because those are the prices at which each would be executed. With EURUSD at 1.0850 / 1.0851:

- A buy limit at 1.0820 triggers when the ask falls to 1.0820 or lower. The bid will then be around 1.0819, so the bid-based chart may show a low slightly below your level.
- A sell limit at 1.0890 triggers when the bid rises to 1.0890.
- A buy stop at 1.0880 triggers when the ask rises to 1.0880.
- A sell stop at 1.0810 triggers when the bid falls to 1.0810.

Limit orders fill at your price or better. Stop orders, once triggered, are executed at the next available market price. In calm markets that is your level; in a fast move or a gap it can be several pips beyond it.

## Stop-limit orders

A **stop-limit** combines both ideas. You set a stop price and a limit price. When the stop price is reached, the platform places a limit order at the limit price instead of a market order.

> **Example:** EURUSD is at 1.0851. You place a buy stop-limit with stop 1.0880 and limit 1.0885. If the ask reaches 1.0880, a buy limit at 1.0885 is placed, so you can be filled anywhere up to 1.0885 but never above it. If news makes the price jump straight to 1.0895, you are not filled; the limit order waits until the price comes back to 1.0885 or better, or until it expires.

The trade-off is clear: a plain stop guarantees entry but not price; a stop-limit protects price but not entry. Before relying on stop-limits, check in the Kalks Trader order ticket which combinations of stop and limit price it accepts for each direction.

## Expiry

Every pending order carries an expiry:

- **GTC (good till cancelled):** active until filled or you delete it.
- **Today:** cancelled automatically at the end of the current trading day if not filled.
- **Specific date:** cancelled at the date and time you set.

Old orders are dangerous. An order placed on Monday for a reason that no longer applies on Thursday can still fill. Choose Today or a date unless you genuinely want the order to stay working indefinitely.

## Margin and pending orders

Pending orders do not usually lock margin while they wait. Margin is required when the order fills, and if your free margin is insufficient at that moment, the order may be rejected. Several pending orders filling at once can therefore produce much larger total exposure than you expected.

> **Risk warning:** Stop orders placed ahead of high-impact news can trigger and fill well away from their level. CFDs are leveraged, and a pending order that fills into a spike can lose money quickly. Attach a stop loss to every pending order when you place it.

## Common mistakes

- Placing a buy stop below the market or a buy limit above it; the platform will reject it, or you will have chosen the wrong type.
- Forgetting that sell orders trigger on the bid and buy orders on the ask, then wondering why an order did or did not fill when the chart touched the level.
- Leaving GTC orders active for weeks after the idea has expired.
- Setting a stop-limit with the limit too close to the stop, so it rarely fills in the moves it was designed for.
