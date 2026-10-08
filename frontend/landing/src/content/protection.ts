import { facts } from "./facts";
import type { CtaBlock, Feature, FaqItem, PlanTable } from "./schema";

/**
 * /protection — Shield cover and the risk tools.
 *
 * This slot used to be /liquidity, a page explaining how a vendor connects
 * brokers to liquidity providers. It closed with "SetupZero does not act as a
 * counterparty to trades", which is the exact inverse of how Ezymax works:
 * the backend is a b-book engine and Ezymax takes the other side. The page is
 * now the one subject that had no slot and genuinely needed one.
 *
 * One claim from the previous Ezymax copy is deliberately not here: that the
 * insurance pool "sits on-chain and its balance is publicly visible". No
 * on-chain component is deployed or configured, so there is no balance anyone
 * can go and inspect.
 */

export const protectionPage = {
  eyebrow: "Protection",
  headline: "Cap a Loss Before You Take It",
  highlight: "Before You Take It",
  sub: "Shield covers a share of what you lose over a day, a week or a month, up to a stated cap. The risk tools show the full downside on the ticket before you confirm. Both are mechanics, not promises about how a trade will go.",
  badges: ["Daily", "Weekly", "Monthly", "12 plans"],

  planHeading: "Every Shield plan",
  planIntro:
    "Bought for a fixed window and applied automatically. One premium, charged up front from your balance, shown before you confirm.",
  plans: facts.shield as PlanTable,
  planFootnote:
    "Cover applies to your cumulative loss across the plan's window and is credited as each qualifying trade closes, until the plan's maximum payout is reached. There is no claim form.",

  toolsHeading: "See the downside before you take it",
  tools: [
    {
      title: "Full cost preview",
      body: "Spread, swap, commission and margin, itemised on every ticket before you confirm.",
      icon: "percent",
    },
    {
      title: "Stop loss and take profit",
      body: "Attach exits to any order when you place it, not after.",
      icon: "target",
    },
    {
      title: "Margin alerts",
      body: `A warning as free margin tightens, before the ${facts.stopOutLevel} stop-out is reached.`,
      icon: "bell",
    },
    {
      title: "Copy drawdown caps",
      body: "A maximum drawdown per copied trader, enforced automatically.",
      icon: "users",
    },
  ] as Feature[],

  faqHeading: "The questions worth asking",
  faq: [
    {
      q: "Who pays for the cover?",
      a: "An insurance pool funded by a share of platform trading fees. Cover is paid from that pool rather than from a marketing budget.",
    },
    {
      q: "What does it cost me?",
      a: "A single premium per plan, charged from your balance when you buy it — from $19 for a day at Basic to $999 for a month at Elite. The exact figure is shown before you confirm.",
    },
    {
      q: "Which trades qualify?",
      a: "Any trade you open and close at a loss while the plan is running, on any instrument. Three conditions keep it honest: the trade must open after the plan starts, be held at least five minutes, and not be hedged by an open opposite position on the same instrument. Nothing to tick — it applies at close.",
    },
    {
      q: "When does it pay out?",
      a: "As you go. Each qualifying loss is added to your running total for the window and the cover on it is credited in the same transaction as the close, until the plan's maximum payout is reached.",
    },
    {
      q: "Does cover mean I cannot lose money?",
      a: `No. Shield covers a share of your losses up to a cap — 20% to 50% depending on the plan, with a maximum payout between $200 and $15,000. Everything above that is yours. The stop-out at ${facts.stopOutLevel} is a backstop, not a floor on what you can lose.`,
    },
  ] as FaqItem[],

  disclaimerTitle: "Cover is partial, and it is not a guarantee",
  disclaimer:
    "A Shield plan reduces part of a loss; it does not remove the risk of trading on leverage. CFDs can lose money faster than the cover replaces it, and losses can exceed your initial deposit.",

  cta: {
    heading: "Trade with the cushion on",
    sub: "Access is by invitation. Join the waitlist and we will email you when a place opens.",
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
