import { placeholders } from "./placeholders";

export const site = {
  name: "SetupZero",
  legalName: "SetupZero Technologies L.L.C.",
  domain: "setupzero.com",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://setupzero.com",
  tagline: "The Technology Behind Tomorrow's Brokers.",
  positioning:
    "SetupZero delivers white-label trading platforms, CRM, prop firm technology, liquidity connectivity and 24/7 technical support so brokers can launch faster, run leaner and grow without limits.",
  description:
    "SetupZero is a technology provider for brokers, prop firms and fintech companies. We deliver white-label trading platforms, CRM, liquidity connectivity, risk management and 24/7 technical support from Dubai to the world.",
  headquarters: "Dubai, United Arab Emirates",
  regions: "the Middle East, Asia, Africa, Europe and Latin America",
  socials: [
    { name: "LinkedIn", href: "https://www.linkedin.com/", icon: "linkedin" },
    { name: "X", href: "https://x.com/", icon: "x" },
    { name: "Instagram", href: "https://www.instagram.com/", icon: "instagram" },
    { name: "YouTube", href: "https://www.youtube.com/", icon: "youtube" },
    { name: "Telegram", href: "https://t.me/", icon: "telegram" },
  ],
  disclaimer:
    "SetupZero provides technology solutions only. SetupZero is not a broker, does not provide investment advice and does not hold client funds. Liquidity and financial services are provided by independent, licensed third parties. Clients are responsible for obtaining any licences required in their jurisdiction.",
  copyrightYear: 2026,
  placeholders,
} as const;

export type SocialIconName = (typeof site.socials)[number]["icon"];
