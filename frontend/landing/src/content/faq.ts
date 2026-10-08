import { facts } from "./facts";
import type { FaqItem } from "./schema";

export const faqPage = {
  eyebrow: "FAQ",
  headline: "Frequently Asked Questions",
  highlight: "Questions",
  sub: "Access, costs, margin, cover and withdrawals — including the parts most platforms leave out.",
};

/**
 * Every answer here is checkable against the platform or says plainly that
 * something is not the case. The set this replaced answered questions about
 * launch timelines and support SLAs for a software vendor, with timings drawn
 * from a placeholders file.
 */
export const faqs: FaqItem[] = [
  {
    q: "What is Ezymex?",
    a: "A CFD trading platform covering forex, indices, commodities and crypto. You can trade in the browser or through MetaTrader 5, copy other traders, buy optional loss cover, stake an unallocated balance, and earn rebates by introducing traders.",
  },
  {
    q: "Why can't I just sign up?",
    a: "Access is by invitation. Join the waitlist with your name and email and we will contact you when a place opens. There is no deposit or payment involved in applying.",
  },
  {
    q: "Is Ezymex regulated?",
    a: "No. Ezymex does not hold a licence from any financial regulator. That means the protections that come with a regulated broker — statutory compensation schemes, an ombudsman, regulated client-money rules — do not apply here. Read the risk disclosure before you deposit anything.",
  },
  {
    q: "Who is on the other side of my trade?",
    a: "Ezymex is. Orders are executed against the platform rather than passed to an external market, so your profit is the platform's loss and the reverse. That is a conflict of interest and you should factor it into how much you trade and with whom.",
  },
  {
    q: "What leverage is available?",
    a: `The default is ${facts.defaultLeverage}, set per position. Leverage multiplies losses exactly as it multiplies gains — at ${facts.defaultLeverage}, a 1% move against you costs 100% of the margin behind that position.`,
  },
  {
    q: "What happens if a position moves against me?",
    a: `You get a margin call at ${facts.marginCallLevel} margin level, and positions begin closing automatically at ${facts.stopOutLevel}. These levels are published and identical for every account. They are a backstop, not a guarantee — a fast market can gap through them.`,
  },
  {
    q: "How many positions can I hold?",
    a: `Up to ${facts.maxOpenPositions} open positions per account.`,
  },
  {
    q: "What does it cost to trade?",
    a: "Spread, swap and commission, all itemised on the order ticket before you confirm, along with the margin the position will use. There is no separate schedule to reconcile against.",
  },
  {
    q: "What is Shield and does it mean I can't lose?",
    a: "Shield is optional cover you buy for a day, a week or a month. It refunds a share of your losses over that window — 20% to 50% depending on the plan — up to a maximum payout between $200 and $15,000. It reduces part of a loss. It does not remove risk, and losses above the cap are entirely yours.",
  },
  {
    q: "How do deposits and withdrawals work?",
    a: "Deposits credit your account balance. Withdrawals are requested from your free balance and are reviewed before release, which can include additional identity verification. Timings depend on the method and the review.",
  },
  {
    q: "Does copying a trader make it safer?",
    a: "No. Copying moves the decision, not the risk. Set an allocation and a maximum drawdown per trader you copy — copying stops automatically when the cap is hit — and treat a published track record as history, not a forecast.",
  },
  {
    q: "How do I improve my terms?",
    a: "XP, which rises with consistent trading, controlled risk and completed education. Tighter spreads, lower commission, reduced swaps, higher Shield tiers and better staking rates follow it. Deposit size is not an input.",
  },
];
