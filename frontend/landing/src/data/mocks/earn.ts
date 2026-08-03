/**
 * /earn copy. Components never import this directly — the view passes it down
 * as props (component-conventions.md → "Data rules").
 */

export const earnHero = {
  eyebrow: "Earn",
  heading: "Better terms are earned, not bought.",
  intro:
    "Staking puts idle balance to work, XP turns discipline into tighter spreads, and partners earn from real trading activity. Deposit size buys nothing here.",
  backLabel: "Back to home",
} as const;

export const earnStaking = {
  id: "staking",
  eyebrow: "Staking",
  heading: "Idle capital shouldn't sit idle.",
  body: [
    "Between setups, your unallocated balance does nothing on a normal broker. Stake it here and it earns while staying inside the ecosystem — and staking rewards convert into trading utility, so you're not choosing between earning and being ready to trade.",
    "Stake → Earn → Trade with utility.",
  ],
  points: [
    "Flexible and fixed lock durations",
    "Reward rate shown before you stake",
    "Rewards convert into trading utility",
  ],
  note: "Rates and lock terms vary by duration and are always shown before you commit. Staking carries its own risks and is not a guaranteed return. See full terms.",
} as const;

export const earnRewards = {
  id: "rewards",
  eyebrow: "XP · Performance Score · Platform Credits",
  heading: "We reward how you trade, not how much you deposit.",
  intro:
    "Every broker gives its best spreads to its biggest deposits. We give them to traders who show discipline. Your terms improve by doing the things a good trader already does.",
  cards: [
    {
      kicker: "Earn it",
      title: "XP",
      body: "Goes up when you trade consistently, complete education, keep risk under control, refer traders and join challenges.",
    },
    {
      kicker: "Prove it",
      title: "Performance Score",
      body: "Built from risk management, win rate, consistency, education completed, trading discipline and community activity. Account size is not an input.",
    },
    {
      kicker: "Spend it",
      title: "Platform Credits",
      body: "Pay for insurance premiums, competition entries, premium tools, AI analysis, education and the marketplace.",
    },
  ],
} as const;

export const earnLadder = {
  id: "ladder",
  eyebrow: "The ladder",
  heading: "What rises as your XP does.",
  columns: ["As XP rises", "What changes"],
  rows: [
    ["Spread", "Tighter spreads at every level"],
    ["Swap", "Reduced overnight financing"],
    ["Commission", "Lower per-lot commission"],
    ["Insurance", "Higher coverage tiers unlocked"],
    ["Staking", "Better reward rate"],
    ["Support", "Priority desk access"],
  ],
  footnote:
    "Levels — Bronze from 0 XP · Silver from 1,000 · Gold from 5,000 · Platinum from 15,000 · Black from 40,000. Thresholds are published in-app and levels never reset.",
} as const;

export const earnActivity = {
  id: "activity",
  eyebrow: "Activity rewards",
  heading: "Trade, earn credits, redeem a spin.",
  body: [
    "Prizes are trading-related: spread rebates, insurance vouchers, TradingView subscriptions, hardware, event tickets.",
  ],
  note: "Credits are earned through activity — never bought with a deposit.",
} as const;

export const earnPartners = {
  id: "partners",
  eyebrow: "Partners",
  heading: "Earn from traders you actually bring in.",
  body: [
    "Rewards are tied to real trading activity, not recruitment depth. No tiers below tiers, no volume quotas from someone else's downline.",
  ],
  points: [
    "Activity-based rewards",
    "Partner-level tools and reporting",
    "IB management dashboard",
  ],
  cta: "Become a partner",
  quote: "Growth driven by participation, not promises.",
} as const;
