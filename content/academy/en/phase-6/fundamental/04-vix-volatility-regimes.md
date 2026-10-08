---
slug: "p6-f-vix-volatility-regimes"
title: "The VIX and volatility regimes"
summary: "What the VIX measures, how to convert it into an expected price range, and how to adapt position size and strategy to calm, normal and stressed markets."
order: 4
version: 1
takeaways:
  - "The VIX is the market's 30-day implied volatility for the S&P 500, derived from option prices and quoted as an annualised percentage."
  - "Dividing the VIX by about 16 gives a rough one-standard-deviation daily move for the index; dividing by about 3.5 gives a monthly move."
  - "Volatility clusters: calm periods tend to stay calm and stressed periods stay stressed, so the current regime is useful information for sizing and strategy choice."
  - "When volatility doubles, the same position size carries roughly double the risk, so stops and sizes must adapt."
practice:
  label: "Open SPX500 on the daily chart, add ATR(14), and compare the current ATR in points with the ATR during the most recent sharp sell-off."
  symbol: "SPX500"
quiz:
  - question: "The VIX is at 24 and SPX500 is at 5,000. What is the approximate one-standard-deviation daily move implied?"
    options:
      - "About 24 points"
      - "About 75 points"
      - "About 240 points"
      - "About 1,200 points"
    answer: 1
    explanation: "Daily move is roughly VIX / 16 = 24 / 16 = 1.5%. 1.5% of 5,000 = 75 points. 1,200 points would be the annualised figure (24%)."
  - question: "What does it mean that volatility clusters?"
    options:
      - "High-volatility days are followed randomly by any kind of day"
      - "Volatility is always highest on Mondays"
      - "Volatile periods tend to be followed by more volatility, and calm periods by more calm"
      - "The VIX can never rise above 30"
    answer: 2
    explanation: "Volatility is persistent. Large moves tend to be followed by large moves and small by small, which is why the current regime is useful for planning stops and position sizes."
  - question: "In normal markets, VIX futures further out are usually priced higher than the spot VIX. What does it signal when this reverses and near-term volatility is priced above longer-term?"
    options:
      - "Acute near-term stress, typical of a sell-off"
      - "Markets are calm and complacent"
      - "That the options market is closed"
      - "That interest rates have fallen to zero"
    answer: 0
    explanation: "An inverted volatility term structure (backwardation) means traders pay more for near-term protection than longer-term, which happens during acute stress."
  - question: "Your normal NAS100 stop is 1.5 x ATR. ATR doubles from 120 to 240 points. To keep the same account risk per trade you should:"
    options:
      - "Keep the same lot size and the same stop distance in points"
      - "Keep the same lot size and double the stop distance"
      - "Double the position size to take advantage of bigger moves"
      - "Double the stop distance in points and roughly halve the position size"
    answer: 3
    explanation: "The stop widens from 180 to 360 points to respect the higher noise. With the stop twice as wide, the size must be about half to keep the money at risk unchanged."
---

Volatility is the size of price moves, regardless of direction. It is also one of the best-behaved variables in markets: it is persistent, it mean-reverts over long periods, and it tells you a lot about how other traders feel. The most famous volatility measure is the **VIX**, often called the market's fear gauge. This chapter explains what it is, how to turn it into numbers you can trade with, and how to adapt to different volatility regimes.

## What the VIX measures

The VIX is calculated by Cboe from the prices of S&P 500 index options with roughly 30 days to expiry. Option prices depend on how much movement buyers expect, so by working backwards from those prices you get an **implied volatility**: the market's estimate of how much the S&P 500 will move over the next month, expressed as an annualised percentage.

A VIX of 16 means options are priced for the S&P 500 to move with an annualised standard deviation of about 16%. It is *implied* volatility, a forward-looking price that includes a risk premium, not a forecast guaranteed to be right. Historically, implied volatility has on average been a little higher than the volatility that actually followed, because investors pay up for protection.

Related gauges exist for other markets: the VXN for the Nasdaq 100, the MOVE index for US Treasury bonds, currency volatility indices for major FX pairs and a gold volatility index. The VIX remains the reference point because the S&P 500 sits at the centre of global risk appetite.

## Turning the VIX into a price range

Because volatility scales with the square root of time, you can convert an annual figure into daily or monthly terms. There are about 252 trading days a year, and the square root of 252 is about 15.9, so traders use 16 as a shortcut. The square root of 12 is about 3.46.

```text
SPX500 at 5,200, VIX at 16

Daily 1 s.d.   = 16% / 15.9 = about 1.0%   -> 5,200 x 1.0% = about 52 points
Monthly 1 s.d. = 16% / 3.46 = about 4.6%   -> 5,200 x 4.6% = about 240 points

Same index, VIX at 32
Daily 1 s.d.   = 32% / 15.9 = about 2.0%   -> about 105 points
```

About two days in three should see a move smaller than one standard deviation, if the options market is right. When the VIX doubles, the expected daily range doubles too. That has a direct effect on stop placement and position size, which you studied in the risk-management phase.

## Volatility regimes

Rather than reacting to every tick in the VIX, it helps to think in regimes. The bands below are rules of thumb, not official thresholds.

| VIX level | Regime | Typical behaviour |
|---|---|---|
| Below 15 | Calm | Grinding trends, small ranges, breakouts often fail |
| 15 to 20 | Normal | Mixed conditions, standard sizing |
| 20 to 30 | Elevated | Wider ranges, faster reversals, stronger cross-asset correlation |
| Above 30 | Stress | Gaps, wide spreads, forced selling, very large intraday swings |

```svg
<svg viewBox="0 0 640 280" xmlns="http://www.w3.org/2000/svg" font-family="Inter, Arial, sans-serif">
  <rect width="100%" height="100%" fill="#121216"/>
  <text x="20" y="24" fill="#c9c9d1" font-size="14">Illustrative VIX path through regimes</text>
  <line x1="60" y1="40" x2="60" y2="240" stroke="#3a3a44"/>
  <line x1="60" y1="240" x2="620" y2="240" stroke="#3a3a44"/>
  <line x1="60" y1="190" x2="620" y2="190" stroke="#3a3a44" stroke-dasharray="4 4"/>
  <line x1="60" y1="160" x2="620" y2="160" stroke="#3a3a44" stroke-dasharray="4 4"/>
  <line x1="60" y1="100" x2="620" y2="100" stroke="#3a3a44" stroke-dasharray="4 4"/>
  <text x="30" y="194" fill="#c9c9d1" font-size="12">15</text>
  <text x="30" y="164" fill="#c9c9d1" font-size="12">20</text>
  <text x="30" y="104" fill="#c9c9d1" font-size="12">30</text>
  <text x="30" y="44" fill="#c9c9d1" font-size="12">40</text>
  <text x="560" y="215" fill="#c9c9d1" font-size="12">Calm</text>
  <text x="560" y="180" fill="#c9c9d1" font-size="12">Normal</text>
  <text x="560" y="134" fill="#c9c9d1" font-size="12">Elevated</text>
  <text x="560" y="80" fill="#c9c9d1" font-size="12">Stress</text>
  <polyline fill="none" stroke="#ff5a1f" stroke-width="2" points="60,205 100,208 140,200 180,206 220,202 240,170 255,95 270,70 290,110 320,130 360,150 400,165 440,178 480,188 520,195 550,198"/>
  <text x="275" y="62" fill="#ef4444" font-size="12">Spike: fast rise</text>
  <text x="380" y="140" fill="#22c55e" font-size="12">Slow decay</text>
  <text x="250" y="262" fill="#c9c9d1" font-size="12">Time (weeks)</text>
</svg>
```

The shape above is typical: volatility rises fast and decays slowly. Spikes happen in days; the return to calm takes weeks or months. That asymmetry mirrors the risk-off pattern from the first chapter: markets fall faster than they rise.

## The term structure

VIX futures exist for several months ahead. In normal markets, later months are priced *above* the spot VIX, because uncertainty grows with time and sellers of protection demand a premium. This upward slope is called **contango**. In a sharp sell-off the curve flips: near-term volatility becomes more expensive than longer-term, called **backwardation**. An inverted VIX curve is one of the clearest signs of acute stress, and its return to contango is often an early sign that the panic is fading.

## Adapting to the regime

The practical use of volatility is to keep your *risk* constant while the *market* changes.

> **Example:** A trader risks 1% of a 20,000 USD account, 200 USD, on NAS100 trades, placing stops at 1.5 x ATR(14). In a calm regime ATR is 120 points, so the stop is 180 points. On a contract worth 1 USD per point per lot, the size is 200 / 180 = 1.11, rounded down to 1.1 lots. After a volatility spike ATR rises to 240 points, so the stop is 360 points and the size becomes 200 / 360 = 0.55 lots. The money at risk is the same; the exposure halves. Check the contract specification in Ezymex Trader, as point values vary by symbol.

Strategy choice can also depend on the regime. Mean-reversion ideas often work better in calm, range-bound conditions, while breakout and trend-following ideas tend to do better when volatility is expanding from a low base. In the stress regime, many experienced traders simply trade smaller or not at all.

> **Risk warning:** High-volatility regimes bring wider spreads, slippage and gaps. A leveraged CFD position sized for normal conditions can lose several times the planned amount in a stressed market, so reduce size before volatility, not after a loss.

## Common mistakes

- **Treating a low VIX as safety.** Very low volatility often encourages leverage, which makes the eventual spike more violent.
- **Shorting volatility spikes early.** Spikes can extend much further than expected before decaying.
- **Keeping fixed lot sizes.** A fixed size in a changing volatility regime means a changing, uncontrolled risk.
- **Using the VIX for every market.** It reflects US equities. For EURUSD or XAUUSD, look at the ATR on your own chart or the relevant currency or gold volatility gauge.
