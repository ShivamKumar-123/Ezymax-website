import type { FaqItem } from "./schema";
import { placeholders } from "./placeholders";

export const faqPage = {
  eyebrow: "FAQ",
  headline: "Frequently Asked Questions",
  highlight: "Questions",
  sub: "Straight answers about what SetupZero does, how long launches take and what you get after go-live.",
};

export const faqs: FaqItem[] = [
  {
    q: "What does SetupZero do?",
    a: "We provide the technology to launch and run a brokerage or prop firm: trading platform, CRM, client portal, liquidity connectivity, risk tools, payments and 24/7 support.",
  },
  {
    q: "How long does it take to launch?",
    a: `A standard white-label setup can go live in about ${placeholders.launchTimelineWeeks} weeks. Custom projects depend on scope.`,
  },
  {
    q: "Do I need a licence to start a brokerage?",
    a: "In most jurisdictions, yes. Licensing rules differ by country. We are a technology provider, not a licensing firm, but we can introduce you to trusted legal partners.",
  },
  {
    q: "Can I use my own brand?",
    a: "Yes. Platform, client portal, mobile apps and emails all carry your brand, logo and colours.",
  },
  {
    q: "Can I switch from my current provider?",
    a: "Yes. Our migration team moves your clients, accounts and history with minimal downtime.",
  },
  {
    q: "Do you provide liquidity?",
    a: "We connect you to third-party liquidity providers through our bridge technology. Liquidity is supplied by those licensed providers.",
  },
  {
    q: "Can I buy only one product, like the CRM or prop firm module?",
    a: "Yes. Every module is available standalone and can integrate with your existing systems.",
  },
  {
    q: "What payment methods can I offer clients?",
    a: "Cards, bank wires, local payment methods, e-wallets and crypto, depending on your jurisdiction and payment partners.",
  },
  {
    q: "Is my data secure?",
    a: "We use encrypted connections, role-based access, regular backups and monitored servers.",
  },
  {
    q: "What support do you offer after launch?",
    a: "24/7 technical support, with a dedicated account manager on higher packages.",
  },
  {
    q: "How much does it cost?",
    a: "See our Pricing page or contact us for a custom quote.",
  },
];
