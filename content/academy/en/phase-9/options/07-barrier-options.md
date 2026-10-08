---
slug: "p9-o-barrier-options"
title: "Barrier options"
summary: "Knock-in and knock-out options, why they cost less than standard options, how Ezymex monitors the barrier, and what happens when the market gaps through it."
order: 7
version: 1
takeaways:
  - "A barrier option is a call or put with an extra price level, the barrier. A knock-out stops existing if the barrier is touched; a knock-in only starts existing if it is touched."
  - "Barrier options are cheaper because they pay in fewer scenarios. A knock-in and a knock-out with the same strike, barrier and expiry together cost the same as the standard option."
  - "Ezymex watches the barrier continuously on the underlying's mid price until the cut. A knocked-out option is worthless immediately, even if the price comes back."
  - "If the market opens beyond the barrier after a weekend or jumps through it on news, the barrier counts as touched; there is no chance to close at the barrier level."
  - "Ezymex does not offer binary or digital options. Every option, including barriers, pays the difference between the settlement price and the strike."
practice:
  label: "On a XAUUSD H1 chart on your demo account, find the last four Monday opens and measure each gap from Friday's close. Would a barrier 30 USD away from Friday's close have survived each one?"
  symbol: "XAUUSD"
quiz:
  - question: "You hold an up-and-out EURUSD 1.1700 call with a barrier at 1.2000. EURUSD touches 1.2001 on Tuesday and settles at 1.1850 on Friday. What do you receive?"
    options:
      - "150 USD"
      - "Nothing: the option was knocked out on Tuesday"
      - "300 USD"
      - "The premium back"
    answer: 1
    explanation: "A single touch of the barrier at any time before the cut cancels a knock-out option, and it stays worthless even though EURUSD later settled below the barrier and above the strike."
  - question: "Why is a knock-out call cheaper than a standard call with the same strike and expiry?"
    options:
      - "Ezymex charges no spread on it"
      - "It is cash-settled"
      - "It pays nothing in the scenarios where the barrier is touched, so it covers fewer outcomes"
      - "It has no time value"
    answer: 2
    explanation: "The knock-out gives up every path that touches the barrier. Fewer winning outcomes means a lower price. Both types are cash-settled and quoted with a spread."
  - question: "A standard call costs 77 USD and the matching up-and-out call costs 31 USD. What should the matching up-and-in call cost, ignoring spreads?"
    options:
      - "46 USD"
      - "31 USD"
      - "108 USD"
      - "77 USD"
    answer: 0
    explanation: "Exactly one of the knock-in and the knock-out is alive at expiry, so together they equal the standard option: 77 - 31 = 46 USD."
  - question: "Gold closes on Friday at 3,830. You hold a down-and-out call with a barrier at 3,800. Gold opens on Monday at 3,785. What happens?"
    options:
      - "The option survives because no trade happened at exactly 3,800"
      - "The option is knocked out at the open and is worthless"
      - "The option turns into a standard call"
      - "The barrier moves to 3,785"
    answer: 1
    explanation: "Opening beyond the barrier counts as a touch. The option is knocked out at the Monday open, and there was no opportunity to sell it at the barrier level."
---

A **barrier option** is a standard call or put with one extra condition: a price level, the **barrier**, that switches the option off or on if the underlying touches it. Giving up some outcomes makes the option cheaper. The trade-off is that a barrier option can become worthless suddenly, even when your view on the final price turns out to be right.

## Knock-out and knock-in

- A **knock-out** option starts like a normal option but **ceases to exist** if the barrier is touched at any time before the cut. It is then worthless immediately, there is no refund of the premium, and it stays dead even if the price returns.
- A **knock-in** option is worthless unless the barrier is touched. Once it is touched, it becomes a standard option for the rest of its life. If the barrier is never touched, it expires worthless, even if it would have been in the money.

Barriers sit either **up**, above the current price, or **down**, below it, which gives four types:

| Type | Barrier | When touched |
|---|---|---|
| Up-and-out | Above the price | The option is cancelled |
| Down-and-out | Below the price | The option is cancelled |
| Up-and-in | Above the price | The option comes alive |
| Down-and-in | Below the price | The option comes alive |

Each type can be a call or a put, and if it is alive at the cut it pays exactly like a standard option.

## Why barriers are cheaper

A knock-out pays in fewer scenarios than the standard option, and a knock-in pays only after a specific path. If you held both a knock-in and a knock-out with the same strike, barrier and expiry, exactly one of them would be alive at expiry, so together they behave like the standard option:

```text
Knock-in price + knock-out price = standard option price
```

> **Example:** EURUSD is at 1.1650. A one-month 1.1700 call costs about 77 USD. The up-and-out version with a barrier at 1.2000 costs about 31 USD, and the up-and-in version with the same barrier about 46 USD: 31 + 46 = 77.

The up-and-out call is cheap because it is cancelled exactly when a call would be most valuable. Its payout is capped just below (1.2000 - 1.1700) x 10,000 = 300 USD, for a settlement just under 1.2000 without any touch.

| Path of EURUSD over the month | Standard call at 77 USD | Up-and-out at 31 USD |
|---|---|---|
| Never above 1.1700, settles at 1.1680 | -77 USD | -31 USD |
| Rises steadily, settles at 1.1850 without touching 1.2000 | +73 USD | +119 USD |
| Spikes to 1.2003 on Tuesday, settles at 1.1850 | +73 USD | -31 USD, knocked out |
| Settles at 1.2100 | +323 USD | -31 USD, knocked out |

A **down-and-out call** works the other way round. With a barrier at 1.1600, the same 1.1700 call costs about 37 USD, roughly half the price, because it is cancelled if EURUSD dips 50 pips before rising. It suits a trader who expects the rise to start without a meaningful dip first.

## How Ezymex watches the barrier

- The barrier is monitored **continuously**, not only at the close or at the cut. One touch at any moment is enough.
- It is checked against the underlying's **mid price**, halfway between bid and ask. Ezymex Trader charts normally plot the bid, so the mid can touch an up-barrier while the bid line on your chart is still half a spread below it.
- Monitoring runs from the moment you open the trade until the cut.
- A knock-out is final. The position is closed at zero value immediately and cannot be revived.

## Gaps through the barrier

Markets do not always trade through every price. When a market reopens after the weekend, or jumps on news, the first price can be well beyond the barrier. That counts as a touch.

> **Example:** You hold a XAUUSD 3,900 down-and-out call with a barrier at 3,800. Gold closes on Friday at 3,830. Weekend news pushes the Monday open to 3,785. Gold never traded at exactly 3,800, but the option is knocked out at the open and is worthless. You had no chance to sell it while it still had value.

Weekend gaps are most common in gold, silver and oil, and in FX around major news. A barrier close to the current price is cheap precisely because the chance of a touch is high.

## No binary or digital options

Ezymex does not offer binary or digital options, which pay a fixed amount if a condition is met. Every Ezymex option, including barrier options, pays the difference between the settlement price and the strike, multiplied by the contract size.

## Selling barrier options

Selling a knock-in option can look attractive because it often expires without ever coming alive. But once the barrier is touched, the seller suddenly holds a full short option, usually at a moment when the market is moving fast, and the margin requirement rises with it.

> **Risk warning:** Knock-out options can lose 100% of their value in an instant, on a brief spike or a gap, even when your forecast for the final price is correct. Size barrier trades on the assumption that losing the whole premium is likely.

## Common mistakes

- **Placing the barrier too close to get a cheaper price.** The discount reflects a high chance of being knocked out.
- **Watching the bid line instead of the mid.** The barrier uses the mid price.
- **Assuming a gap protects you.** Opening beyond the barrier counts as a touch.
