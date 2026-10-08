---
slug: "p2-f-lots-and-contract-size"
title: "Lots and contract size"
summary: "What a lot really represents on each symbol, how to calculate the notional value of a position, and why that number is your true exposure."
order: 2
version: 1
takeaways:
  - "A lot is a standardised quantity: 100,000 units of base currency on FX and 100 oz on XAUUSD, with a minimum size of 0.01 lot."
  - "Notional value equals contract size x lots x price and is the real market exposure you carry, regardless of how little margin you post."
  - "One lot means a very different amount of money on different symbols, so never copy a lot size from one market to another."
  - "Lot size is the main dial that sets how much a pip or point is worth, and therefore how much you can gain or lose."
practice:
  label: "Open the contract specification for XAUUSD and US30 in Ezymex Trader and write down the contract size, digits and minimum lot for each."
  symbol: "XAUUSD"
quiz:
  - question: "How many units of the base currency are in a 0.25 lot EURUSD position?"
    options:
      - "2,500"
      - "250,000"
      - "25,000"
      - "250"
    answer: 2
    explanation: "One standard lot is 100,000 units, so 0.25 x 100,000 = 25,000 EUR."
  - question: "What is the notional value in USD of 0.10 lot XAUUSD at 2,350.40?"
    options:
      - "23,504 USD"
      - "2,350.40 USD"
      - "235,040 USD"
      - "235.04 USD"
    answer: 0
    explanation: "0.10 lot of a 100 oz contract is 10 oz. 10 x 2,350.40 = 23,504 USD. 235,040 USD would be a full lot."
  - question: "A trader who normally trades 1.00 lot of EURUSD enters 1.00 lot of XAUUSD. What is the most important consequence?"
    options:
      - "Nothing changes, because a lot is the same size on every symbol"
      - "The exposure and the value of each price step are very different, so the risk is not comparable"
      - "The trade will be rejected because gold cannot be traded in whole lots"
      - "The spread cost will be identical"
    answer: 1
    explanation: "A gold lot is 100 oz, about 235,000 USD at 2,350.40, and each 1.00 move is worth 100 USD. That is not the same risk as a EURUSD lot, which is worth 10 USD per pip."
  - question: "What is the smallest position size you can normally open on Ezymex?"
    options:
      - "1.00 lot"
      - "0.10 lot"
      - "0.001 lot"
      - "0.01 lot"
    answer: 3
    explanation: "The minimum lot is 0.01, a micro lot, which on EURUSD equals 1,000 units and about 0.10 USD per pip."
---

When you open a position you do not type "I want to risk 50 dollars". You type a quantity, measured in **lots**. The lot is a standard unit that tells the platform how much of the underlying you are buying or selling. Understanding it properly is the difference between a trade that moves your account by a few cents and one that moves it by hundreds of dollars.

## The standard lot and its fractions

On currency pairs, one standard lot is **100,000 units of the base currency**, the first currency in the pair. Buying 1.00 lot of EURUSD means buying 100,000 euros and paying for them in dollars; selling 1.00 lot of USDJPY means selling 100,000 dollars for yen.

Smaller sizes are expressed as decimals of a lot. The minimum on Ezymex is 0.01 lot, and sizes move in steps of 0.01.

| Lots | Common name | Units of base currency | EURUSD pip value |
|---|---|---|---|
| 1.00 | Standard | 100,000 | 10.00 USD |
| 0.10 | Mini | 10,000 | 1.00 USD |
| 0.01 | Micro | 1,000 | 0.10 USD |
| 0.35 | (any size) | 35,000 | 3.50 USD |

Because pip value is proportional to size, doubling your lots doubles both the potential profit and the potential loss of every pip.

## Contract size on other instruments

For non-FX symbols the lot is defined by the **contract size** in the symbol specification.

- **Gold (XAUUSD):** 1 lot = 100 troy ounces. So 0.01 lot is 1 oz and 0.10 lot is 10 oz.
- **Silver (XAGUSD), indices, energies and crypto:** contract sizes vary between brokers and symbols. As an illustration, on a 1-unit-per-point index contract, 1 lot of US30 is worth 1 USD per index point; on a 1-coin-per-lot crypto contract, 0.10 lot of BTCUSD is 0.1 BTC.
- **Stock CFDs (AAPL, TSLA, NVDA and others):** often defined per share, but check the specification rather than assuming.

The rule is simple: check the contract specification in Ezymex Trader for each symbol before trading it the first time. It shows contract size, digits, minimum and maximum volume and the volume step.

## Notional value: your real exposure

The **notional value** of a position is its full market value:

```text
notional = contract size x lots x price
```

If the price is in a currency other than your account currency, convert the result. For a USD account:

```text
EURUSD 1.00 lot at 1.0850   100,000 EUR x 1.0850      = 108,500 USD
USDJPY 1.00 lot              base is USD               = 100,000 USD
XAUUSD 0.10 lot at 2,350.40  100 x 0.10 x 2,350.40     =  23,504 USD
BTCUSD 0.10 lot at 64,000    1 x 0.10 x 64,000         =   6,400 USD  (1 BTC per lot example)
```

Notional matters because the market moves as a percentage of the full value, not of the margin you post. A 1% move in gold from 2,350.40 is 23.50 dollars per ounce. On 0.10 lot (10 oz) that is 235.04 USD, whether your account holds 500 USD or 50,000 USD. Leverage, covered in the next chapter, lets you control that notional with a small deposit, but it does not shrink the exposure.

> **Example:** You hold 0.35 lot of EURUSD bought at 1.0850. Notional is 35,000 x 1.0850 = 37,975 USD. Pip value is 35,000 x 0.0001 = 3.50 USD. If EURUSD rises 20 pips to 1.0870 you gain 20 x 3.50 = 70 USD; check: 35,000 x 0.0020 = 70 USD.

## Why lots behave so differently across markets

A beginner who trades 0.50 lot of EURUSD comfortably might assume 0.50 lot is also a sensible size on gold. It is not. On EURUSD, 0.50 lot is about 54,250 USD notional and 5 USD per pip. On XAUUSD, 0.50 lot is 50 oz, about 117,520 USD notional, and every 1.00 move in gold is worth 50 USD. Gold routinely moves 20 or 30 dollars in a day, which would be 1,000 to 1,500 USD on that position.

The same caution applies to indices and crypto, whose contract sizes and typical daily ranges are different again. Always translate a lot size into money per point and notional value before comparing markets. Choosing a size from the amount you are willing to lose is covered in detail in the risk management part of the Academy.

## Common mistakes

- Typing 1 instead of 0.1. The order ticket accepts both, and the second trade is ten times smaller. Read the volume field back before you confirm.
- Copying one lot size across every symbol, as described above.
- Looking only at the margin used and ignoring notional value. A position that uses 100 USD of margin can still carry more than 20,000 USD of exposure.
- Forgetting the volume step. You cannot close exactly one third of 0.10 lot; the nearest steps are 0.03 or 0.04.
