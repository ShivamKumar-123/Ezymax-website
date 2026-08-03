/**
 * /protection copy. Components never import this directly — the view passes it
 * down as props (component-conventions.md → "Data rules").
 */

export const protectionHero = {
  eyebrow: "Protection",
  heading: "Cap a loss before you take it.",
  intro:
    "Insurance tiers cover part of a losing trade automatically, and the risk tools show the full downside before you confirm. Protection here is a mechanic, not a promise.",
  backLabel: "Back to home",
} as const;

export const protectionInsurance = {
  id: "insurance",
  eyebrow: "Trade insurance",
  heading: "Switch on a cushion before you enter.",
  intro:
    "Choose a tier before placing an eligible trade. If it goes against you, the contract covers part of the loss up to the cap. No hedging, no separate account, no claim form.",
  columns: ["Tier", "Loss covered", "Cap"],
  rows: [
    ["Minimal", "15%", "$250"],
    ["Standard", "30%", "$750"],
    ["Advanced", "50%", "$2,000"],
    ["Max", "75%", "$5,000"],
  ],
  footnote:
    "Higher coverage tiers unlock as your XP level rises — see Rewards & XP.",
} as const;

export const protectionFaq = {
  id: "faq",
  eyebrow: "Insurance FAQ",
  heading: "The questions traders should ask.",
  intro:
    "Free-looking protection is usually a trap, so here is exactly how this one is funded and paid.",
  items: [
    {
      question: "Who pays for the cover?",
      answer:
        "An insurance pool funded by a share of platform trading fees. The pool sits on-chain and its balance is publicly visible — cover is paid from a funded pool, not from a marketing budget.",
    },
    {
      question: "What does it cost me?",
      answer:
        "A per-trade premium in Platform Credits, priced by tier and position size. The exact premium is shown on the ticket before you confirm. If you don't toggle cover on, you pay nothing.",
    },
    {
      question: "Which trades qualify?",
      answer:
        "Eligible instruments carry an insurable badge on the ticket. The eligibility rules — instrument list, minimum hold time, maximum position size and insured trades per day — are published in-app and applied automatically.",
    },
    {
      question: "When does it pay out?",
      answer:
        "Automatically, at the moment the trade closes, in the same settlement transaction as your P&L. There is no claim form and nothing to file.",
    },
  ],
} as const;

export const protectionTools = {
  id: "risk-tools",
  eyebrow: "Risk tools",
  heading: "See the downside before you take it.",
  cards: [
    {
      title: "Full cost preview",
      body: "Spread, swap, commission and margin — itemised on every ticket before you confirm.",
    },
    {
      title: "Stop loss & take profit",
      body: "Attach exits to any order; the contract executes them without a dealer in between.",
    },
    {
      title: "Margin alerts",
      body: "Get warned as free margin tightens — before the contract has to act.",
    },
    {
      title: "Copy drawdown caps",
      body: "A maximum drawdown per copied trader, enforced automatically.",
    },
  ],
  quote: "Trade with awareness. Not uncertainty.",
} as const;

export const protectionCta = {
  id: "get-started",
  eyebrow: "Next step",
  heading: "Trade with the cushion on.",
  body: [
    "Open an account, earn credits through activity, and toggle cover on your first eligible trade.",
  ],
  cta: "Open account",
} as const;
