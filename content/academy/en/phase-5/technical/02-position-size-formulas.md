---
slug: "p5-t-position-size-formulas"
title: "Position size formulas for every asset class"
summary: "One universal formula and worked calculations for USD-quoted pairs, USD-base pairs, yen crosses, gold, indices, crypto and stocks."
order: 2
version: 1
takeaways:
  - "Position size = risk amount / (stop distance x value of a one-unit move for one lot); every asset class uses this same formula."
  - "For pairs quoted in USD, one pip on one standard lot is worth $10; for other pairs the pip value must be converted into your account currency at the current rate."
  - "For XAUUSD with a 100 oz contract, a $1.00 move is worth $100 per lot, so a $8.00 stop on a $100 risk allows 0.12 lots."
  - "Always round the result down to the nearest lot step, and skip the trade if the correct size is below the minimum lot."
practice:
  label: "On your demo account, calculate the lot size for a 1% risk XAUUSD trade with a $10.00 stop, then check the contract specification in Ezymex Trader to confirm the contract size you used."
  symbol: "XAUUSD"
quiz:
  - question: "Account equity $10,000, risk 1%, EURUSD stop 25 pips. What is the correct position size?"
    options:
      - "0.25 lots"
      - "4.00 lots"
      - "1.00 lot"
      - "0.40 lots"
    answer: 3
    explanation: "Risk $100. One pip on one lot of EURUSD is $10, so 25 pips cost $250 per lot. $100 / $250 = 0.40 lots."
  - question: "You want to risk $100 on USDJPY with a 30-pip stop while USDJPY trades at 150.00. What size is correct?"
    options:
      - "0.33 lots"
      - "0.50 lots"
      - "0.67 lots"
      - "1.50 lots"
    answer: 1
    explanation: "One pip on one lot is 1,000 JPY, which is 1,000 / 150 = $6.67. 30 pips cost 30 x 6.67 = $200 per lot, and $100 / $200 = 0.50 lots."
  - question: "Your calculation gives 0.127 lots for an XAUUSD trade and the lot step is 0.01. What should you trade?"
    options:
      - "0.12 lots, rounding down"
      - "0.13 lots, rounding to the nearest step"
      - "0.20 lots, to make the trade worthwhile"
      - "0.10 lots, always use round numbers"
    answer: 0
    explanation: "Rounding down keeps the actual risk at or below your limit. Rounding up, even slightly, means risking more than you planned."
  - question: "GER40 is priced in euros and the example contract is 1 euro per point per lot. EURUSD is 1.0850. How much is a 50-point stop worth per lot in USD?"
    options:
      - "$46.08"
      - "$50.00"
      - "$54.25"
      - "$108.50"
    answer: 2
    explanation: "50 points x EUR 1 = EUR 50 per lot. Converted to dollars: 50 x 1.0850 = $54.25. Instruments priced in another currency must be converted into your account currency."
---

The previous chapter fixed how much you are willing to lose. This chapter turns that amount into a lot size. The method is the same for every instrument on Ezymex; only the value of a price move changes. Master one formula and a handful of conversions and you can size any trade correctly in under a minute.

## The universal formula

```text
Position size (lots) = Risk amount / (Stop distance x Value per unit move per lot)
```

- **Risk amount**: your risk per trade in account currency, for example 1% of $10,000 = $100.
- **Stop distance**: the distance from entry to stop loss, in pips or points or price units.
- **Value per unit move per lot**: what one pip or point, or one full unit of price, is worth on one lot, converted into your account currency.

All the examples below assume a USD account, equity of $10,000 and 1% risk ($100) unless stated. Always round **down** to the lot step, which is 0.01 on Ezymex, so that the actual risk never exceeds the plan.

## Forex pairs

A standard FX lot is 100,000 units of the base currency. One pip is 0.0001 for most pairs and 0.01 for yen pairs. The pip value is always generated in the **quote** currency first, then converted.

**Pairs quoted in USD (EURUSD, GBPUSD, AUDUSD).** One pip on one lot is 100,000 x 0.0001 = $10.

```text
EURUSD long 1.0850, stop 1.0825 (25 pips)
Risk per lot = 25 x $10 = $250
Size = $100 / $250 = 0.40 lots
Check: 0.40 x 25 x $10 = $100.00
```

**Pairs with USD as base (USDJPY, USDCAD, USDCHF).** The pip value is in the quote currency, so divide by the current price.

```text
USDJPY at 150.00: 1 pip per lot = 100,000 x 0.01 = 1,000 JPY
In USD: 1,000 / 150.00 = $6.67
Stop 30 pips -> 30 x $6.67 = $200 per lot
Size = $100 / $200 = 0.50 lots

USDCAD at 1.3500: 1 pip per lot = 10 CAD = 10 / 1.3500 = $7.41
Risk $150, stop 40 pips -> 40 x $7.41 = $296.30 per lot
Size = $150 / $296.30 = 0.506 -> round down to 0.50 lots
Actual risk: 0.50 x 40 x $7.41 = $148.15
```

**Crosses (GBPJPY, EURJPY).** Neither currency is USD, so convert the quote-currency pip value using the relevant USD rate. For yen crosses the pip value is 1,000 JPY per lot, converted at USDJPY.

```text
GBPJPY stop 60 pips, USDJPY at 150.00
1 pip per lot = 1,000 JPY = $6.67
Risk per lot = 60 x $6.67 = $400
Size = $100 / $400 = 0.25 lots
```

## Metals

XAUUSD has a contract size of 100 oz, so a $1.00 move in the price is worth $100 per lot and $1 per 0.01 lot.

```text
XAUUSD long 2,350.40, stop 2,342.40 ($8.00)
Risk per lot = 8.00 x 100 = $800
Size = $100 / $800 = 0.125 -> round down to 0.12 lots
Actual risk: 0.12 x 100 x 8.00 = $96.00
```

Silver has a different contract size. Check the contract specification in Ezymex Trader for XAGUSD before sizing.

## Indices, energies, crypto and stocks

Contract sizes for these vary by broker and symbol, so always check the specification. The examples use simple illustrative contracts.

| Instrument (example contract) | Stop | Value per lot of the stop | Size for $100 | Actual risk |
|---|---|---|---|---|
| US30, 1 USD per point | 120 points | $120 | 0.83 lots | $99.60 |
| GER40, 1 EUR per point, EURUSD 1.0850 | 50 points | EUR 50 = $54.25 | 1.84 lots | $99.82 |
| USOIL, 1,000 barrels | $0.50 | $500 | 0.20 lots | $100.00 |
| BTCUSD, 1 BTC | $1,600 (64,000 to 62,400) | $1,600 | 0.06 lots | $96.00 |
| AAPL, 1 share | $4.00 (190.00 to 186.00) | $4.00 | 25 lots | $100.00 |

The GER40 line shows the currency step that is easy to forget: an index priced in euros generates euro profits and losses, which must be converted into dollars for a USD account.

> **In Ezymex Trader:** The contract specification for each symbol shows the contract size, lot step, minimum lot and the currency in which profit is calculated. Open it before trading any symbol for the first time.

## When the size is too small

Sometimes the correct size is below the minimum lot. A $500 account risking 1% ($5) on XAUUSD with a $10.00 stop needs 5 / (10 x 100) = 0.005 lots, half the 0.01 minimum. Trading 0.01 lots would double the risk to $10, which is 2%.

The choices are to skip the trade, look for a setup with a tighter logical stop, or use a cent account, where balances are shown in USC (1 USD = 100 USC) and a given lot size typically carries one hundredth of the dollar value it has on a standard account (confirm this in the specification for your account). What you should not do is round up and quietly accept higher risk.

## Common mistakes

- **Using $10 per pip for every pair.** It is only true when USD is the quote currency.
- **Forgetting currency conversion** on JPY pairs, crosses and non-USD indices.
- **Rounding up.** 0.127 becomes 0.12, never 0.13.
- **Moving the stop after sizing.** Widening the stop without reducing the size raises the risk above plan.
- **Ignoring costs.** On tight stops, add the spread and commission to the stop distance or reduce the size slightly.

> **Risk warning:** Position sizing limits your planned loss but cannot prevent gaps and slippage. CFDs are leveraged, and in fast markets a stop may be filled at a worse price than its level.
