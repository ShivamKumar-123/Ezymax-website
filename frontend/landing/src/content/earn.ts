import type { CtaBlock, Feature, PlanTable } from "./schema";

/**
 * /earn — staking, the XP ladder and activity rewards.
 *
 * This slot used to be /services: 24/7 support contracts, dedicated account
 * managers and a "first response within 15 minutes" SLA that nobody had
 * agreed to. None of it maps to a retail platform, so the page is now the
 * other subject Ezymex has and the template had no room for.
 */

export const earnPage = {
  eyebrow: "Earn",
  headline: "Better Terms Are Earned, Not Bought",
  highlight: "Earned, Not Bought",
  sub: "Staking puts an unallocated balance to work between setups, and XP turns consistency into tighter spreads. Deposit size buys nothing here.",
  badges: ["Staking", "XP", "Platform credits"],

  stakingHeading: "Idle balance does not have to sit idle",
  staking: [
    {
      title: "Flexible or fixed",
      body: "Choose a term. Flexible stays available; fixed locks for a defined period.",
      icon: "calendar",
    },
    {
      title: "Rate shown upfront",
      body: "The reward rate is displayed before you commit, not after.",
      icon: "percent",
    },
    {
      title: "Converts to trading utility",
      body: "Rewards come back as something you can use on the platform rather than a separate pot.",
      icon: "repeat",
    },
  ] as Feature[],
  stakingNote:
    "Rates and lock terms vary by duration and are shown before you commit. Staking is not a guaranteed return and carries its own risk.",

  rewardsHeading: "We reward how you trade, not how much you deposit",
  rewards: [
    {
      title: "XP",
      body: "Rises with consistent trading, completed education, controlled risk and community activity.",
      icon: "zap",
    },
    {
      title: "Performance score",
      body: "Built from risk management, win rate, consistency and discipline. Account size is not an input.",
      icon: "gauge",
    },
    {
      title: "Platform credits",
      body: "Spend on Shield premiums, competition entries, tools and education. Earned through activity, never bought with a deposit.",
      icon: "award",
    },
  ] as Feature[],

  ladderHeading: "What improves as your XP rises",
  ladder: {
    columns: ["As XP rises", "What changes"],
    rows: [
      ["Spread", "Tighter spreads at every level"],
      ["Swap", "Reduced overnight financing"],
      ["Commission", "Lower per-lot commission"],
      ["Shield", "Higher cover tiers unlocked"],
      ["Staking", "Better reward rate"],
      ["Support", "Priority desk access"],
    ],
  } as PlanTable,
  ladderFootnote:
    "Levels — Bronze from 0 XP, Silver from 1,000, Gold from 5,000, Platinum from 15,000, Black from 40,000. Thresholds are published in-app and levels do not reset.",

  cta: {
    heading: "Start earning on Ezymex",
    sub: "Access is by invitation. Join the waitlist and we will email you when a place opens.",
    ctas: [
      { label: "Join Waitlist", action: "waitlist" },
      { label: "See the partner programme", href: "/partners", variant: "outline" },
    ],
  } as CtaBlock,
};
