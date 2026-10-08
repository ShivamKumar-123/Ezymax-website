---
slug: "p6-f-options-market-signals"
title: "Reading signals from the options market"
summary: "How implied volatility, expected moves, risk reversals, put/call ratios and large option expiries reveal what professional traders are paying for, even if you only trade CFDs."
order: 7
version: 1
takeaways:
  - "Option prices reveal the size of move the market expects: implied volatility can be converted into an expected range, and a straddle price approximates the expected move around an event."
  - "Risk reversals and skew show which direction traders are paying more to protect against, which is a direct measure of directional fear."
  - "Put/call ratios are a sentiment gauge that is mainly useful at extremes, in the same contrarian way as retail sentiment."
  - "Large open interest near expiry and dealer hedging can pin prices near big strikes or amplify moves, depending on how dealers are positioned."
quiz:
  - question: "EURUSD is at 1.0850 and one-week at-the-money implied volatility is 7%. What is the approximate one-standard-deviation expected move over the week?"
    options:
      - "About 15 pips"
      - "About 760 pips"
      - "About 105 pips"
      - "About 7 pips"
    answer: 2
    explanation: "Weekly volatility = 7% / sqrt(52) = 7% / 7.21 = about 0.97%. 0.97% of 1.0850 is about 0.0105, or roughly 105 pips."
  - question: "The one-month USDJPY 25-delta risk reversal moves from -0.5 to -2.0. What does this tell you?"
    options:
      - "Traders expect USDJPY to rise sharply"
      - "Traders are paying more for options that profit if USDJPY falls, meaning demand for protection against yen strength has risen"
      - "Implied volatility has fallen to zero"
      - "The Bank of Japan has cut rates"
    answer: 1
    explanation: "A negative risk reversal means puts on USDJPY (yen calls) are priced at higher volatility than calls. A move further negative shows rising demand for protection against a USDJPY decline."
  - question: "A stock trading at 120 has an at-the-money straddle expiring just after earnings priced at 9. What move is the market roughly pricing?"
    options:
      - "About 1.3%"
      - "About 75%"
      - "About 13%"
      - "About 7.5%"
    answer: 3
    explanation: "The straddle cost divided by the price, 9 / 120 = 7.5%, is a rough guide to the size of move the options market expects through the event, in either direction."
  - question: "When dealers are net short gamma, how do their hedging flows typically affect price?"
    options:
      - "They must sell as price falls and buy as price rises, amplifying moves"
      - "They buy dips and sell rallies, dampening moves"
      - "They have no effect because options are separate from the underlying"
      - "They always push price to the nearest round number"
    answer: 0
    explanation: "Short-gamma hedging is pro-cyclical: to stay hedged, dealers sell into declines and buy into rallies, which can accelerate moves. Long-gamma hedging does the opposite and tends to calm markets."
---

Options give their buyers the right, but not the obligation, to buy or sell an asset at a set price before a certain date. Because an option's value depends heavily on how much the underlying is expected to move, option prices contain information that you cannot see on a price chart: how nervous traders are, which direction they fear more, and where large positions sit. You do not need to trade options to use that information when trading CFDs on EURUSD, USDJPY, XAUUSD, SPX500 or US stocks.

## Implied volatility and the expected move

The previous chapter on the VIX introduced implied volatility for the S&P 500. The same concept exists for every liquid options market: currency pairs, gold, oil, individual stocks. Implied volatility is quoted as an annualised percentage, and you can scale it to any horizon using the square root of time.

```text
EURUSD spot 1.0850, one-week at-the-money implied volatility 7.0%

Weekly volatility = 7.0% / sqrt(52) = 7.0% / 7.21 = 0.97%
Expected 1 s.d. move = 1.0850 x 0.97% = 0.0105 = about 105 pips
Rough one-week range: 1.0745 to 1.0955 (about two weeks in three)
```

For single events such as an earnings release or a central-bank decision, there is an even simpler guide. An **at-the-money straddle** (buying both a call and a put at the current price) profits from a move in either direction, so its price approximates the move the market is paying for.

> **Example:** NVDA trades at 120 the day before earnings and the straddle expiring just after the report costs 9. The options market is pricing a move of about 9 / 120 = 7.5% in either direction. If you plan to hold a CFD position through the report, that tells you a stop-loss 3% away is well inside the expected range and has a high chance of being hit, possibly with a gap through it.

Comparing implied with realised volatility is also useful. When implied volatility is far above recent realised volatility, the market is paying for protection against something it expects. When it is far below, complacency may be building.

## Skew and risk reversals: which way is the fear?

Implied volatility is not the same at every strike. The shape of volatility across strikes is called **skew**, and it tells you which direction traders are more worried about.

In FX, skew is quoted through the **25-delta risk reversal**: the implied volatility of a 25-delta call minus that of a 25-delta put, for the same expiry.

| Risk reversal | Meaning |
|---|---|
| Positive | Calls priced above puts: more demand for upside protection |
| Near zero | Balanced fear |
| Negative | Puts priced above calls: more demand for downside protection |

For USDJPY, a strongly negative risk reversal means traders are paying up for protection against USDJPY falling, which is typically a sign of rising risk-off or carry-unwind concern. When risk reversals move sharply while spot has hardly moved, it often means large players are hedging before the move shows up in price.

In equity indices, puts are almost always more expensive than equivalent calls, because investors constantly buy downside protection. What matters is the *change*: skew steepening while the index is still rising suggests nervousness under the surface.

## Put/call ratios

The put/call ratio divides the volume (or open interest) of put options by that of call options. In equities it behaves much like retail sentiment. Very high put buying tends to occur near panic lows, when protection is most expensive and most people are already hedged. Very low put buying tends to occur during euphoric rallies. As with other sentiment gauges, only the extremes carry much information, and a ratio should be compared with its own recent history rather than with a fixed number.

## Open interest, expiries and dealer hedging

Options create positioning that affects the underlying market through hedging.

- **Large expiries.** In FX, options commonly expire at 10:00 New York time. Market commentary often lists large amounts expiring at particular strikes, for example 2 billion euros at EURUSD 1.0850. When spot is near such a strike on expiry day, price sometimes gravitates towards it and stalls there, a behaviour called **pinning**.
- **Dealer gamma.** Banks that sell options hedge by trading the underlying. When dealers are **long gamma**, they sell as price rises and buy as it falls, which dampens moves and can keep a market in a tight range. When they are **short gamma**, they must buy as price rises and sell as it falls, which amplifies moves. Equity-index commentary often estimates whether dealers are long or short gamma; treat such estimates as rough.
- **After expiry.** Once a large option expires, the hedging that was holding price in place disappears, and ranges can widen.

> **In Ezymex Trader:** Options data is not shown on your CFD chart, but you can use what you learn from market commentary on the News page in the Client Area. Mark reported large expiry strikes as horizontal lines on the chart for that day, and be alert to stalling near them before 10:00 New York time, which is 17:00 server time.

## Putting it together

A short checklist before holding a position through a major event:

1. What move is implied? Convert implied volatility or the straddle price into points or pips.
2. Is your stop inside or outside that range? If inside, accept a high chance of being stopped, or reduce size.
3. Which way is the skew leaning? Heavy demand for protection in one direction tells you where the market is most vulnerable.
4. Are there large expiries near the current price? They may pin price until the cut and release it afterwards.

> **Risk warning:** Implied moves are estimates, not limits. Around events such as earnings and central-bank decisions, prices can gap well beyond the implied range, and leveraged CFD positions can lose more than the planned stop-loss amount.

## Common mistakes

- **Treating the expected move as a target.** It describes likely size, not direction, and actual moves are frequently larger.
- **Reading skew as a forecast.** Expensive puts show demand for protection, not certainty of a fall.
- **Over-trusting gamma estimates.** Nobody sees the full dealer book; estimates are models built on assumptions.
- **Ignoring time.** Expiry effects are strongest in the final hours and fade quickly afterwards.
