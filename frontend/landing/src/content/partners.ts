import type { Feature, PlanTable } from "./schema";

/**
 * /partners — the IB programme.
 *
 * The template had three B2B programme types (referral, technology,
 * reseller) for a company selling software. Ezymex has one programme: you
 * introduce traders and earn on the lots they close.
 */
export const partnersPage = {
  eyebrow: "Partners",
  headline: "Earn From Traders You Actually Bring In",
  highlight: "Actually Bring In",
  sub: "Rebates are paid on the real trading activity of the people you introduce — on closed lots, not on recruitment depth.",

  howHeading: "How the programme works",
  how: [
    {
      title: "Introduce a trader",
      body: "They apply through your link and go through the same review as everyone else.",
      icon: "link",
    },
    {
      title: "They trade",
      body: "You earn a rebate per lot they close. Nothing accrues from sign-ups alone.",
      icon: "chart",
    },
    {
      title: "You can see it",
      body: "Partner-level reporting and an IB management dashboard, with the figures behind each payment.",
      icon: "gauge",
    },
    {
      title: "No downline",
      body: "One level. No tiers below tiers and no quotas inherited from someone else's network.",
      icon: "users",
    },
  ] as Feature[],

  rebateHeading: "What the programme pays",
  rebates: {
    columns: ["Tier", "Rebate per closed lot"],
    rows: [
      ["Introducing Broker", "$3"],
      ["Senior IB", "$5"],
      ["Master IB", "$7"],
    ],
  } as PlanTable,
  rebateFootnote:
    "Tier is set by the trading volume of the traders you have introduced. Rebates accrue per closed lot and are paid to your account balance.",

  formHeading: "Apply to the programme",
  formSub: "Tell us about your audience and how you plan to introduce traders.",
};
