/**
 * Aggregates the five sub-pages' copy for the drawer's slide-down page panel
 * (`chrome/nav-page.tsx`) — the menu shows the SAME content the routed pages
 * render, so there is one source of truth per page. Components never import
 * this directly — the layout passes it down as props.
 */

import {
  companyAbout,
  companyContact,
  companyHero,
  companyLegal,
  companyProtocol,
} from "@/data/mocks/company";
import {
  earnActivity,
  earnHero,
  earnLadder,
  earnPartners,
  earnRewards,
  earnStaking,
} from "@/data/mocks/earn";
import {
  platformCopy,
  platformHero,
  platformMt5,
  platformProp,
  platformWeb,
} from "@/data/mocks/platform";
import {
  protectionCta,
  protectionFaq,
  protectionHero,
  protectionInsurance,
  protectionTools,
} from "@/data/mocks/protection";
import {
  tradeHero,
  tradeMargin,
  tradeMarkets,
  tradeModes,
  tradeSettlement,
} from "@/data/mocks/trade";

export const navPages = {
  Trade: {
    href: "/trade",
    hero: tradeHero,
    markets: tradeMarkets,
    modes: tradeModes,
    settlement: tradeSettlement,
    margin: tradeMargin,
  },
  Platform: {
    href: "/platform",
    hero: platformHero,
    web: platformWeb,
    mt5: platformMt5,
    copy: platformCopy,
    prop: platformProp,
  },
  Earn: {
    href: "/earn",
    hero: earnHero,
    staking: earnStaking,
    rewards: earnRewards,
    ladder: earnLadder,
    activity: earnActivity,
    partners: earnPartners,
  },
  Protection: {
    href: "/protection",
    hero: protectionHero,
    insurance: protectionInsurance,
    faq: protectionFaq,
    tools: protectionTools,
    cta: protectionCta,
  },
  Company: {
    href: "/company",
    hero: companyHero,
    about: companyAbout,
    protocol: companyProtocol,
    legal: companyLegal,
    contact: companyContact,
  },
} as const;
