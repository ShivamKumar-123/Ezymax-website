/**
 * /trade copy. Components never import this directly — the view passes it down
 * as props (component-conventions.md → "Data rules").
 */

export const tradeHero = {
  eyebrow: "Trade",
  heading: "Four markets. One set of rules.",
  intro:
    "Forex, indices, commodities and crypto as CFDs — executed against a trading contract that locks only your margin and settles P&L automatically. Your free balance stays withdrawable the whole time.",
  backLabel: "Back to home",
} as const;

export const tradeMarkets = {
  id: "markets",
  eyebrow: "Markets",
  heading: "Trade the markets you already watch.",
  intro:
    "Every instrument settles the same way: margin locks when you open, P&L credits when you close, free balance stays yours throughout.",
  cards: [
    {
      id: "forex",
      kicker: "FX",
      title: "Forex",
      body: "Majors, minors and exotics, with the live spread shown next to the price before you confirm — the number traders actually shop on.",
      points: [
        "50+ currency pairs",
        "Live spreads on the ticket, not in a PDF",
        "Leverage chosen per position, up to 1:200",
      ],
    },
    {
      id: "indices",
      kicker: "Benchmarks",
      title: "Indices",
      body: "Go long or short the big benchmarks without owning the basket.",
      points: [
        "US, European and Asian benchmarks",
        "Fixed contract sizes, predictable margin",
        "Swap shown upfront — no overnight surprises",
      ],
    },
    {
      id: "commodities",
      kicker: "Metals & energy",
      title: "Commodities",
      body: "Gold, silver and oil — the classic macro hedges, CFD-sized.",
      points: [
        "Metals and energies",
        "Hedge or speculate, long or short",
        "Every cost itemised before you confirm",
      ],
    },
    {
      id: "crypto",
      kicker: "Digital assets",
      title: "Crypto",
      body: "Major pairs, traded from the same balance your other positions use.",
      points: [
        "BTC, ETH and major pairs",
        "Markets that never close",
        "Same contract settlement as every other market",
      ],
    },
  ],
} as const;

export const tradeModes = {
  id: "modes",
  eyebrow: "Trading modes",
  heading: "Two ways to trade. Same rules either way.",
  cards: [
    {
      kicker: "01",
      title: "Fully funded",
      body: "Trade your own capital, no borrowing. Margin equals position value, so nothing is amplified — in either direction.",
      points: [
        "No overnight financing",
        "Risk is exactly what you see",
        "Best for building consistency",
      ],
    },
    {
      kicker: "02",
      title: "Leveraged",
      body: "Choose leverage per position. More exposure from less locked margin — and bigger losses when it goes against you.",
      points: [
        "Adjustable up to 1:200",
        "Costs apply only when leverage is used",
        "Full cost shown before you confirm",
      ],
    },
  ],
  note: "CFDs are leveraged products. You can lose more than you allocate.",
} as const;

export const tradeSettlement = {
  id: "settlement",
  eyebrow: "Automatic settlement",
  heading: "Nobody touches your P&L.",
  intro:
    "When a position closes, the contract reads four values and updates your balance in the same transaction.",
  cards: [
    {
      title: "Opening price",
      body: "Recorded when the position opened.",
    },
    {
      title: "Closing price",
      body: "From the price feed at the moment of close.",
    },
    {
      title: "Position size",
      body: "Your lots and the leverage you chose.",
    },
    {
      title: "Costs",
      body: "Spread, swap and commission — shown before you confirm.",
    },
  ],
  note: "Margin releases. Balance updates. Free balance becomes withdrawable. No dealer intervention, no manual adjustment, no “we're reviewing your trade.”",
} as const;

export const tradeMargin = {
  id: "margin",
  eyebrow: "Only margin locks",
  heading: "$10,000 in. $540 locked. $9,460 still yours.",
  body: [
    "Open 0.5 lots of EUR/USD at 1:100 and the contract locks $540 of margin. On every other platform, the other $9,460 is stuck too — sitting in the broker's account until they release it.",
    "Here it isn't. Free balance is free. Withdraw it mid-trade, at 2am, on a Sunday, while your position is still open. The contract releases it because the margin requirement is already satisfied.",
  ],
  points: [
    "No withdrawal request",
    "No approval queue",
    "No waiting",
  ],
  note: "Move the sliders on the home page calculator to see the split for your own size and leverage.",
  cta: "Open account",
} as const;
