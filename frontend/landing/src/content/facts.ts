/**
 * Every number the site is allowed to state about itself.
 *
 * This replaces a `placeholders.ts` that was headed "TODO: confirm before
 * launch" and fed invented counts — brokerages launched, active traders, an
 * uptime target, countries served — into six content files. Ezymax takes
 * deposits and is not licensed anywhere, so a made-up figure here is not a
 * placeholder, it is a false statement to a prospective client.
 *
 * The rule for this file: every value carries a `source:` comment pointing at
 * the code or config it was read from. If a number cannot be sourced, it does
 * not belong on the site, and the section that wanted it gets rewritten rather
 * than filled.
 */

export const facts = {
  // source: .env.example — the risk-engine block the b-book engine reads.
  // These four are the platform's published rules, not marketing.
  defaultLeverage: "1:100", // DEFAULT_LEVERAGE=100
  marginCallLevel: "80%", // MARGIN_CALL_LEVEL=80.0
  stopOutLevel: "50%", // STOP_OUT_LEVEL=50.0
  maxOpenPositions: "200", // MAX_OPEN_TRADES=200

  // source: backend table `insurance_shield_plans`, mirrored in the deleted
  // data/mocks/protection.ts. Loss covered / max payout / premium per plan.
  shield: {
    columns: ["Plan", "Loss covered", "Max payout", "Premium"],
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
  },

  // The four tradable classes the market-data service quotes.
  // source: backend/services/market-data symbol groups.
  markets: ["Forex", "Indices", "Commodities", "Crypto"] as const,
} as const;

/**
 * Deliberately absent, and why — so the next person does not "fix" it by
 * inventing one:
 *
 * - client / trader counts .... the platform is invite-only and pre-launch
 * - uptime percentage ......... nothing measures or publishes it
 * - years in business ......... the company has no verifiable founding date
 * - countries served .......... onboarding is per-application, not per-market
 * - spreads and commissions ... not published anywhere in the backend; an
 *                               honest fees page needs real figures first
 * - testimonials .............. there are no clients to quote yet
 * - regulatory licences ....... Ezymax holds none. Earlier revisions of this
 *                               site carried a fabricated FCA number, a
 *                               fabricated CySEC number and a street address
 *                               to match. They were removed. Do not add
 *                               anything of that shape back.
 */
