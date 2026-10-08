import { facts } from "./facts";
import type { CtaBlock, Feature } from "./schema";

/**
 * /about.
 *
 * Three things the template had here are gone rather than rewritten, because
 * there was nothing true to put in them:
 *
 *  - A founding story and "numbers" (projects delivered, years in business,
 *    team size). Every figure came from a placeholders file marked "TODO:
 *    confirm before launch".
 *  - A team section whose own note read "Photos, names and roles ... will be
 *    added here", above four anonymous entries.
 *  - A Dubai headquarters.
 *
 * What is left describes how the platform works, which is the part that can
 * be checked against the code.
 */
export const aboutPage = {
  eyebrow: "About Ezymex",
  headline: "A Trading Platform That Publishes Its Rules",
  highlight: "Publishes Its Rules",
  sub: "Ezymex is an invite-only CFD platform covering forex, indices, commodities and crypto. The margin rules, the costs and the conflicts are stated upfront rather than discovered later.",

  storyHeading: "What Ezymex is",
  story: [
    "Ezymex is a CFD trading platform. You deposit, you trade forex, indices, commodities and crypto on leverage, and you withdraw. There is a copy-trading system, an optional loss-cover product, staking for an unallocated balance, and a partner programme that pays on introduced traders' activity.",
    "Access is by application rather than instant sign-up. That is a deliberate constraint, not a growth tactic: a smaller book of traders who were actually screened is easier to run honestly than a large one that was not.",
  ],

  mission: {
    heading: "What we publish",
    body: `Margin call at ${facts.marginCallLevel}, stop-out at ${facts.stopOutLevel}, default leverage ${facts.defaultLeverage}, up to ${facts.maxOpenPositions} open positions. The same numbers for every account, with no per-client arrangements.`,
  },
  vision: {
    heading: "What we are not",
    body: "Ezymex is not licensed or regulated by any financial authority, and holds no investment licence. It is the counterparty to your trades, which is a conflict of interest. Both facts are in the risk disclosure, and neither is buried.",
  },

  valuesHeading: "How we work",
  values: [
    {
      title: "Costs before the trade",
      body: "Spread, swap, commission and margin on the ticket, before you confirm — not in a schedule you have to go and find.",
      icon: "percent",
    },
    {
      title: "One set of rules",
      body: "Published margin and stop-out levels, identical for every account.",
      icon: "scale",
    },
    {
      title: "Terms you earn",
      body: "Better spreads come from consistency and risk control, not from deposit size.",
      icon: "award",
    },
    {
      title: "Conflicts stated",
      body: "We are the counterparty. That is written down rather than implied away.",
      icon: "eye",
    },
  ] as Feature[],

  cta: {
    heading: "Request access to Ezymex",
    sub: "Access is reviewed. Join the waitlist and we will email you when a place opens.",
    ctas: [
      { label: "Join Waitlist", action: "waitlist" },
      {
        label: "Read the risk disclosure",
        href: "/legal/risk-disclosure",
        variant: "outline",
      },
    ],
  } as CtaBlock,
};
