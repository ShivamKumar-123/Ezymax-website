/**
 * /protection copy. Components never import this directly — the view passes it
 * down as props (component-conventions.md → "Data rules").
 */

export const protectionHero = {
  eyebrow: "Protection",
  heading: "Cap a loss before you take it.",
  intro:
    "A Shield plan covers part of what you lose over its window automatically, and the risk tools show the full downside before you confirm. Protection here is a mechanic, not a promise.",
  backLabel: "Back to home",
} as const;

export const protectionInsurance = {
  id: "insurance",
  eyebrow: "Trade insurance",
  heading: "Cover a whole window, not one position.",
  intro:
    "FXArtha Shield is bought for a day, a week or a month. It covers a share of everything you lose across that window, up to the plan's cap. No per-trade toggle, no hedging, no claim form.",
  columns: ["Plan", "Loss covered", "Max payout", "Premium"],
  // Mirrors the live plan table (insurance_shield_plans).
  rows: [
    ["Daily · Basic", "20%", "$200", "$19"],
    ["Daily · Plus", "30%", "$500", "$45"],
    ["Daily · Pro", "40%", "$2,000", "$149"],
    ["Daily · Elite", "50%", "$5,000", "$399"],
    ["Weekly · Basic", "20%", "$500", "$39"],
    ["Weekly · Plus", "30%", "$1,000", "$79"],
    ["Weekly · Pro", "40%", "$5,000", "$299"],
    ["Weekly · Elite", "50%", "$10,000", "$699"],
    ["Monthly · Basic", "20%", "$1,000", "$89"],
    ["Monthly · Plus", "30%", "$2,500", "$199"],
    ["Monthly · Pro", "40%", "$7,500", "$549"],
    ["Monthly · Elite", "50%", "$15,000", "$999"],
  ],
  footnote:
    "The premium is charged once, up front, from your main wallet. Cover applies to your cumulative loss over the plan's window and is paid out automatically when it closes.",
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
        "A single premium for the plan, charged from your main wallet when you buy it — from $19 for a day at Basic to $999 for a month at Elite. The exact figure is shown before you confirm.",
    },
    {
      question: "Which trades qualify?",
      answer:
        "Every trade you open and close in loss while the plan is running, on any instrument. Three rules keep it honest: the trade must be opened after the plan starts, held at least five minutes, and not hedged by an open opposite position on the same instrument. Nothing to tick — it is applied automatically at close.",
    },
    {
      question: "When does it pay out?",
      answer:
        "As you go. Each qualifying loss is added to your running total for the window and the cover on it is credited to your main wallet in the same transaction as the close — until the plan's maximum payout is reached. There is no claim form and nothing to file.",
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
