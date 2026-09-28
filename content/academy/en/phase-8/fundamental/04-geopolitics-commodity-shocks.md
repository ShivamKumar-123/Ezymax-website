---
slug: "p8-f-geopolitics-commodity-shocks"
title: "Geopolitics and commodity shocks"
summary: "Analyse how wars, sanctions, supply disruptions and elections transmit into oil, gold, currencies and indices, and how to manage the gap risk they create."
order: 4
version: 1
takeaways:
  - "Geopolitical events matter to markets mainly through a few channels: energy and commodity supply, risk appetite, trade flows and policy responses."
  - "The first reaction to a geopolitical headline often fades unless physical supply or economic activity is actually lost."
  - "A supply shock raises prices and lowers growth at the same time, which pushes economies towards a stagflationary regime."
  - "Weekend and overnight gap risk is the largest practical danger for leveraged positions during geopolitical crises."
practice:
  label: "Open a daily USOIL chart on your demo account and mark the largest opening gaps of the past year. Check what news caused each one."
  symbol: "USOIL"
quiz:
  - question: "Why does an oil supply shock tend to be worse for an economy than an oil price rise caused by strong demand?"
    options:
      - "Because it raises inflation while simultaneously reducing real incomes and growth"
      - "Because it always lowers inflation"
      - "Because demand-driven rises never affect inflation"
      - "Because central banks always cut rates after supply shocks"
    answer: 0
    explanation: "A supply shock raises costs without the offsetting strength in demand, squeezing real incomes and growth while pushing inflation up. A demand-driven rise happens alongside a strong economy."
  - question: "USOIL moves from 78.00 to 90.00 after a supply disruption. What is the percentage change?"
    options:
      - "12.0%"
      - "13.3%"
      - "15.4%"
      - "18.0%"
    answer: 2
    explanation: "The change is 12.00 on a base of 78.00: 12 / 78 = 0.1538, or about 15.4%."
  - question: "Which set of assets has most often acted as a safe haven in the initial phase of a geopolitical shock?"
    options:
      - "AUD, NZD and emerging market currencies"
      - "USD, CHF, JPY, gold and major government bonds"
      - "Small-cap equity indices"
      - "High-beta crypto assets"
    answer: 1
    explanation: "Investors typically move towards deep, liquid and politically stable assets. Commodity and emerging currencies usually weaken as risk appetite falls, although each episode differs."
  - question: "A trader holds a short USOIL CFD with a stop at 80.00 over a weekend. Sunday news causes the market to open at 84.00. What is the most likely outcome?"
    options:
      - "The stop fills at exactly 80.00"
      - "The stop is cancelled automatically"
      - "The position is unaffected until the market reaches 80.00 again"
      - "The stop is triggered at the first available price near 84.00, producing a larger loss than planned"
    answer: 3
    explanation: "A stop becomes a market order once triggered. If the market opens beyond the stop, it fills at the first available price, which can be far worse than the stop level."
---

Geopolitics is the part of macro that feels most dramatic and is hardest to trade. Headlines arrive without a calendar, reactions can be violent, and many apparent crises have no lasting effect on prices. The professional approach is not to forecast wars or elections, but to understand the **transmission channels** through which events reach markets, and to control the gap risk they create.

## Four transmission channels

Most geopolitical events affect prices through one or more of these channels:

- **Commodity supply.** Conflicts involving major producers or shipping routes threaten oil, gas, grains and metals. This is the most direct and measurable channel.
- **Risk appetite.** Uncertainty makes investors reduce leverage and exposure, pushing money towards safe havens and away from high-beta assets.
- **Trade and capital flows.** Sanctions, tariffs and export controls change who can sell to whom, shifting currency flows and corporate earnings.
- **Policy response.** Governments and central banks react with spending, rate changes, reserve releases or capital controls, and those reactions often matter more than the event itself.

When a headline breaks, ask which channel it operates through. A diplomatic dispute with no supply or trade consequences usually fades within days. A disruption that removes barrels of oil from the market can reshape the macro regime for a year.

## Commodity shocks: supply versus demand

Not every oil rally is a shock. When oil rises because global demand is strong, the same strength supports earnings and employment. When oil rises because supply is lost, households and companies pay more without any offsetting gain, so growth weakens while inflation rises. That is a stagflationary impulse, the most difficult regime for central banks.

History offers clear cases: the 1973 embargo, the 1979 Iranian revolution, the 1990 invasion of Kuwait, and the 2022 Russia-Ukraine war, when European natural gas prices rose several-fold and Brent briefly traded above 120 dollars. In each case the shock fed into inflation, squeezed real incomes and shifted currency relationships between energy importers and exporters.

> **Example:** USOIL rises from 78.00 to 90.00 after a supply disruption, a 15.4% increase (12.00 / 78.00). For energy importers such as the eurozone and Japan, this worsens the trade balance and weighs on EUR and JPY. For exporters, CAD and NOK often benefit. Headline inflation rises within a month or two through fuel prices, while the growth hit arrives more slowly through consumer spending. If the price holds at 90 for several months, economists will revise inflation forecasts up and growth forecasts down, and bond markets will have to decide whether the central bank looks through the shock or reacts to it.

Gold responds to geopolitics through the risk channel and, increasingly, through official demand. Central banks in several countries have bought gold heavily since 2022, partly to reduce exposure to assets that can be frozen by sanctions. That is a structural consequence of geopolitics, not a one-day reaction.

## The shape of a typical reaction

Geopolitical price moves often follow a recognisable sequence:

1. **Shock:** a sharp move in oil, gold, safe-haven currencies and index futures, often with wide spreads.
2. **Assessment:** within days the market asks whether supply or activity is really affected.
3. **Fade or trend:** if the physical impact is limited, prices retrace most of the move. If supply is lost or sanctions bite, a new trend forms.

The old saying that markets "buy the invasion" reflects the fade case, but it is dangerous as a rule. In 2022 the energy trend lasted months.

## Gap risk and position management

The largest practical risk is the gap. Crises often escalate over weekends, when FX, metals, indices and energies are closed on Kalks Trader while news keeps flowing.

```text
Short USOIL, example contract of 100 barrels per lot, 1.00 lot
Entry            78.00
Stop loss        80.00   planned risk = 2.00 x 100 = 200 USD
Friday close     78.00
Monday open      84.00   (weekend escalation)
Stop filled near 84.00   actual loss  = 6.00 x 100 = 600 USD
Actual loss is three times the planned risk.
```

Check the contract specification in Kalks Trader for the real contract size of each energy symbol. Ways to manage this risk include reducing position size before weekends during active crises, avoiding holding positions that are directly exposed to the conflict, and accepting that stops do not guarantee a fill price. Crypto trades through the weekend, so BTCUSD can give an early read on risk appetite, although its signal is noisy.

## Common mistakes

- **Trading every headline.** Most geopolitical news has no lasting market impact.
- **Assuming safe havens always work.** JPY sometimes weakens when oil rises because Japan imports energy.
- **Ignoring policy responses.** Strategic reserve releases, OPEC+ decisions and ceasefires can reverse moves quickly.
- **Holding full size through weekends in a crisis.** Gaps can exceed any stop distance.

> **Risk warning:** Geopolitical events can cause extreme volatility, wide spreads, slippage and price gaps. Leveraged CFD positions can lose significantly more than the planned stop distance, and stop orders do not guarantee the execution price.
