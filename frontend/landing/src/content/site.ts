import { publicEnv } from "@/env";

/**
 * Brand identity and the one-line statements the whole site reads from.
 *
 * A note on the name, because it looks like a typo and is not: the brand is
 * **Ezymax**, the registered domain is **ezymex.com**. Only the domain exists
 * as a purchased asset, so every URL and every mailbox uses `ezymex.com` while
 * everything a reader sees says Ezymax. `alternateName` below tells search
 * engines the two refer to one thing. Do not "correct" an address to
 * `@ezymax.com` — that domain is not owned and the mail would bounce.
 */

const url = publicEnv.NEXT_PUBLIC_SITE_URL ?? "https://ezymex.com";

const tradeUrl = publicEnv.NEXT_PUBLIC_TRADE_URL ?? "http://localhost:3001";

export const site = {
  name: "Ezymax",
  /** For JSON-LD: the two spellings refer to one entity. */
  alternateName: "Ezymex",
  domain: "ezymex.com",
  url,

  tagline: "Invite-only CFD trading.",

  positioning:
    "Ezymax is a CFD trading platform for forex, indices, commodities and crypto. Access is by invitation: join the waitlist and we will email you when a place opens.",

  description:
    "Ezymax is an invite-only CFD trading platform covering forex, indices, commodities and crypto, with published margin rules, optional loss cover and a partner rebate programme.",

  email: "support@ezymex.com",

  /**
   * Empty on purpose. The template shipped five entries pointing at bare
   * domains (`https://x.com/`, `https://t.me/`), which the layout fed into
   * JSON-LD `sameAs` — i.e. telling Google that ezymex.com owns x.com.
   * Add an entry only when the account exists.
   */
  socials: [] as ReadonlyArray<{
    name: string;
    href: string;
    icon: string;
  }>,

  /**
   * The real risk warning. Replaces a technology-vendor disclaimer that said
   * the opposite of what this company does ("is not a broker, does not hold
   * client funds").
   */
  disclaimer:
    "CFDs are complex instruments and carry a high risk of losing money rapidly due to leverage. You should consider whether you understand how CFDs work and whether you can afford to take the high risk of losing your money. Past performance is not a guide to future results. Ezymax is not available in every jurisdiction and does not provide investment advice.",

  /**
   * Baked at build time, so a redeploy keeps it current. Every deploy refreshes
   * it; a site left unbuilt across New Year shows the old year, same as a
   * hardcoded value would.
   */
  copyrightYear: new Date().getFullYear(),
} as const;

/**
 * Not yet confirmed by the business, so nothing here is rendered or published.
 *
 * The legal documents currently carry a Glasgow serviced-office address beside
 * a US phone number, which is not a combination that survives scrutiny on an
 * unlicensed CFD broker. Until the real entity and address are supplied, the
 * site states neither: JSON-LD omits `legalName` and `address` entirely rather
 * than guessing, because a wrong one is worse than a missing one.
 */
export const unconfirmedEntity = {
  legalName: "Ezymex Ltd.",
} as const;

/**
 * The trader platform this site funnels into (the monorepo's `frontend/trader`
 * app). Moved here from `lib/site.ts` so the content layer is the single
 * source for everything the pages read.
 */
export const tradeConfig = {
  url: tradeUrl,
  login: `${tradeUrl}/auth/login`,
  register: `${tradeUrl}/auth/register`,
} as const;

export type SocialIconName = string;
