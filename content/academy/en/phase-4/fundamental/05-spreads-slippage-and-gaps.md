---
slug: "p4-f-spreads-slippage-and-gaps"
title: "Spreads, slippage and gaps around news"
summary: "Why execution costs rise sharply at release time and how to calculate their real effect on a trade."
order: 5
version: 1
takeaways:
  - "Liquidity providers pull or widen quotes just before major releases, so spreads can be several times their normal size."
  - "Stop and market orders fill at the next available price, which after news can be far from the level you set."
  - "Limit orders protect the price but not the fill; they may be skipped entirely in a fast move."
  - "Weekend and overnight gaps are the extreme case: no trading happens between the two prices."
  - "Budget for spread and slippage in your risk calculation instead of assuming the stop distance is the maximum loss."
practice:
  label: "On your demo account, watch the EURUSD spread in the Market Watch panel for two minutes either side of a high-impact release and note the widest value."
  symbol: "EURUSD"
quiz:
  - question: "A sell stop is placed at 1.0820. Weak data drops EURUSD straight from 1.0835 to 1.0808 with no quotes in between. Where is the order most likely to fill?"
    options:
      - "Around 1.0808, the next available price"
      - "Exactly at 1.0820"
      - "At 1.0835"
      - "It is cancelled automatically"
    answer: 0
    explanation: "A stop becomes a market order once triggered and fills at the next available price. With no quotes between 1.0835 and 1.0808, the fill comes near 1.0808, 12 pips of slippage."
  - question: "Your normal EURUSD spread is 0.8 pips and it widens to 4.0 pips at a release. On a 2-lot position, how much extra cost does the wider spread represent?"
    options:
      - "6.40 USD"
      - "32 USD"
      - "64 USD"
      - "80 USD"
    answer: 2
    explanation: "Extra spread = 4.0 - 0.8 = 3.2 pips. At 10 USD per pip per lot, 2 lots is 20 USD per pip, so 3.2 x 20 = 64 USD."
  - question: "Why can a long position's stop loss be triggered even though the chart's bid price never reached the stop?"
    options:
      - "Stops are triggered by the ask price for long positions"
      - "Stops trigger randomly during news"
      - "Charts never show real prices"
      - "A long position closes by selling at the bid, but a widening spread can push the bid down sharply"
    answer: 3
    explanation: "Long positions close at the bid. Most charts plot the bid, but a sudden spread widening can drop the bid briefly. For short positions, closed at the ask, the stop can trigger on a spike in the ask that the bid chart does not show."
  - question: "Which order type guarantees you will not be filled at a worse price than specified?"
    options:
      - "Market order"
      - "Stop order"
      - "Limit order"
      - "Trailing stop"
    answer: 2
    explanation: "A limit order only fills at its price or better. The trade-off is that it may not fill at all if price moves through it too quickly."
---

When a major number is released, the market you see on the screen changes character. Spreads widen, quotes jump rather than tick, and orders fill at prices you did not choose. These execution effects are not a malfunction; they are how liquidity behaves when uncertainty spikes. Understanding them lets you calculate the true cost of trading the news.

## Why spreads widen

A broker's prices come from liquidity providers such as banks and market makers. Each one quotes a bid and an ask and stands ready to trade. Seconds before a major release, no one knows which way the price will jump, so providers protect themselves by widening their quotes or reducing the size they will trade. Some briefly stop quoting altogether. The best available spread across all providers therefore widens.

```svg
<svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" fill="#121216"/>
<g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
<line x1="60" y1="200" x2="620" y2="200" stroke="#3a3a44"/>
<line x1="60" y1="30" x2="60" y2="200" stroke="#3a3a44"/>
<text x="10" y="45">pips</text>
<text x="30" y="184">0.8</text>
<text x="30" y="84">4.0</text>
<line x1="60" y1="80" x2="620" y2="80" stroke="#3a3a44" stroke-dasharray="3 5"/>
<line x1="60" y1="180" x2="620" y2="180" stroke="#3a3a44" stroke-dasharray="3 5"/>
<line x1="330" y1="30" x2="330" y2="200" stroke="#ff5a1f" stroke-dasharray="4 4"/>
<text x="290" y="24">release 15:30</text>
<polyline fill="none" stroke="#ef4444" stroke-width="2" points="70,180 150,180 230,178 280,165 310,120 330,70 345,80 360,110 390,150 430,170 480,178 560,180 610,180"/>
<text x="80" y="220">15:25</text>
<text x="310" y="220">15:30</text>
<text x="560" y="220">15:40</text>
<text x="380" y="110">spread peak, then normalises</text>
</g>
</svg>
```

The sketch shows a typical pattern for EURUSD: a normal spread of about 0.8 pips, widening from a minute or two before the release, peaking in the first seconds and returning to normal within a few minutes. Exact values vary by symbol, account group and event.

## Slippage: the fill is not the order price

Slippage is the difference between the price you requested and the price you received. Market orders and stop orders fill at the next available price once triggered. In a calm market that is usually your price or within a fraction of a pip. After news, the price can jump several pips between two quotes.

> **Example:** You hold 1 lot of EURUSD long from 1.0850 with a stop at 1.0830, a planned risk of 20 pips or 200 USD. Payrolls disappoint, and the bid moves from 1.0838 to 1.0819 in one tick. Your stop is triggered and filled at 1.0819. The real loss is 31 pips, or 310 USD, which is 55% more than planned.

Slippage can also be positive: a limit order or a fast move in your favour can occasionally fill better. But in news spikes the asymmetry usually works against stop orders, which are, by design, triggered in the direction of the move.

## Order types and news

| Order type | Price guaranteed? | Fill guaranteed? | News behaviour |
|---|---|---|---|
| Market | No | Usually | Fills at whatever is available, including a wide spread |
| Stop / stop loss | No | Usually | Triggers, then fills at the next price; can slip |
| Limit / take profit | Yes, or better | No | Protects price, but may be skipped |
| Stop-limit | Yes, within the limit | No | Avoids deep slippage but may leave you unfilled |

A stop-limit order sounds like the perfect answer, but if it does not fill, you remain in a position that is moving against you. There is no order type that guarantees both price and fill.

## Spread cost in numbers

Wider spreads are a direct cost even if price does not move. Opening and closing a trade during the release window means paying the wide spread at least once.

```text
EURUSD normal spread 0.8 pips, release spread 4.0 pips
Extra cost = 4.0 - 0.8 = 3.2 pips
On 1 lot (10 USD per pip):   3.2 x 10  = 32 USD
On 3 lots (30 USD per pip):  3.2 x 30  = 96 USD
```

That cost is incurred before the trade has any chance to profit. For a scalper aiming for 10 pips, a 3.2 pip extra cost removes almost a third of the target.

## Gaps

A gap is the extreme form of slippage: the market reopens at a price far from where it closed, with no trading in between. Gaps occur over the weekend in FX, metals and indices, at the daily open for US stocks after earnings, and occasionally intraday when a surprise hits. A stop that lies inside the gap fills at the first available price after the reopen.

```text
Short 0.10 lots XAUUSD at 2,350.40, stop at 2,362.40 (12 USD, risk 120 USD)
Weekend geopolitical news. Monday open: 2,374.40
Stop fills at about 2,374.40
Loss: (2,374.40 - 2,350.40) x 10 oz = 240 USD, double the plan
```

## In practice

- Compare spreads in the Market Watch panel of Ezymex Trader before and after a few releases on demo so you know what to expect.
- Add an allowance for spread and slippage to your risk calculation, for example one and a half times the normal stop distance for news trades.
- Avoid placing tight stops that sit where a spread spike alone could trigger them.
- Consider closing or reducing positions before the weekend if a major event is scheduled.

> **Risk warning:** Around news and over weekends, leveraged CFD positions can be closed at prices far beyond the stop loss you set. Slippage and gaps mean your actual loss can exceed your planned risk.
