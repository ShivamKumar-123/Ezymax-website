/**
 * /platform copy. Components never import this directly — the view passes it
 * down as props (component-conventions.md → "Data rules").
 */

export const platformHero = {
  eyebrow: "Platform",
  heading: "One account. Three ways to run it.",
  intro:
    "Trade in the browser, connect MT5, or mirror a verified trader — every route executes against the same contract, with the same settlement rules and the same withdrawable free balance.",
  backLabel: "Back to home",
} as const;

export const platformWeb = {
  id: "web",
  eyebrow: "Web platform",
  heading: "Trade from the browser. Nothing to install.",
  body: [
    "The FX Artha web platform puts your wallet, your trading account and the contract on one screen. Charting, order tickets, insurance toggles — and your locked-versus-free balance, visible at all times.",
    "Every cost on every ticket — spread, swap, commission, margin — is itemised before you confirm. What you see is what settles.",
  ],
  points: [
    "Live locked vs free balance",
    "Full cost preview on every ticket",
    "Insurance toggle on eligible trades",
  ],
} as const;

export const platformMt5 = {
  id: "mt5",
  eyebrow: "MetaTrader 5",
  heading: "Keep your MT5 setup. Keep your custody.",
  body: [
    "If MT5 is home, connect it as your execution front end. Orders route from MT5, but margin locking and settlement still happen in the trading contract — your balance never moves onto a broker's book.",
    "Your indicators, EAs and templates work unchanged.",
  ],
  points: [
    "Familiar charts, EAs and templates",
    "Contract-side margin and settlement",
    "Same withdrawable free balance",
  ],
} as const;

export const platformCopy = {
  id: "copy-trading",
  eyebrow: "Copy trading",
  heading: "Follow a track record you can actually verify.",
  intro:
    "Every published result is generated on-platform and auditable — not a screenshot, not a self-reported number. Pick a trader, copy at your own size, set your own risk cap, pause any time.",
  cards: [
    {
      title: "Verifiable history",
      body: "Every trade in a trader's record was executed here. Profiles lead with months of history and max drawdown — the numbers good traders look for first — alongside average hold time and win rate.",
    },
    {
      title: "Your size, your risk",
      body: "Set your allocation and a maximum drawdown per copied trader. If the cap is hit, copying stops automatically.",
    },
    {
      title: "Pause instantly",
      body: "Stop copying at any moment without closing your account or touching the rest of your balance.",
    },
  ],
  note: "Copying another trader does not reduce risk. Past performance does not predict future results.",
} as const;

export const platformProp = {
  id: "prop",
  eyebrow: "Prop trading",
  heading: "Trade platform capital. Keep the discipline.",
  body: [
    "Pass a rules-based evaluation and trade a funded account with defined drawdown limits and a published profit split. The same automatic settlement applies — including to the platform's share.",
    "Evaluation rules, limits and splits are published before you start. No moving goalposts.",
  ],
  points: [
    "Rules-based evaluation",
    "Published profit split",
    "Defined drawdown limits",
  ],
  cta: "Open account",
} as const;
