import type { CtaBlock, Feature, HeroBlock, Stat, Step, Testimonial } from "./schema";
import { placeholders } from "./placeholders";

export const homeHero: HeroBlock = {
  eyebrow: "Brokerage technology partner",
  headline: "Launch Your Brokerage From Zero. Fully Set Up.",
  highlight: "From Zero.",
  sub: "White-label trading platforms, Forex CRM, prop firm technology and liquidity connectivity, all from one technology partner. Go live in weeks, not months.",
  ctas: [
    { label: "Book a Free Demo", action: "demo" },
    { label: "Explore Solutions", href: "/solutions", variant: "outline" },
  ],
  badges: ["CFD White Label", "Prop Firm Tech", "Forex & Options", "Crypto", "24/7 Support"],
};

/** "From Zero." typed in the languages of the markets SetupZero serves. */
export const heroTypewriter = [
  "From Zero.",
  "من الصفر.",
  "शून्य से.",
  "从零开始。",
  "Desde Cero.",
  "С Нуля.",
  "Do Zero.",
  "Sıfırdan.",
];

export const heroFloatingStats: Stat[] = [
  { value: placeholders.brokeragesLaunched, label: "Brokerages launched" },
  { value: placeholders.uptimeTarget, label: "Platform uptime target" },
];

export const trustBar = {
  line: `Trusted by brokers, prop firms and fintechs across ${placeholders.countries} countries.`,
  stats: [
    { value: placeholders.brokeragesLaunched, label: "Brokerages launched" },
    { value: placeholders.activeTraders, label: "Active traders on our technology" },
    { value: placeholders.uptimeTarget, label: "Platform uptime target" },
    { value: "24/7", label: "Multilingual technical support" },
  ] as Stat[],
};

export const solutionsOverview = {
  eyebrow: "Solutions",
  heading: "One Partner. Every Brokerage Model.",
  highlight: "Every Brokerage Model.",
  intro:
    "Whether you are starting a new brokerage or upgrading an existing one, SetupZero gives you the technology to launch and scale on your own terms.",
};

export const productsSection = {
  eyebrow: "Products",
  heading: "Everything You Need to Run a Brokerage",
  highlight: "Run a Brokerage",
  button: { label: "View All Products", href: "/products" },
  items: [
    {
      title: "Trading Platform",
      body: "Web, desktop and mobile trading with advanced charts and one-click execution.",
      icon: "monitor",
      href: "/products/trading-platform",
    },
    {
      title: "Forex CRM",
      body: "Manage leads, clients, KYC, deposits and sales teams in one dashboard.",
      icon: "users",
      href: "/products/forex-crm",
    },
    {
      title: "Trader's Room",
      body: "A branded client portal for onboarding, funding, withdrawals and account management.",
      icon: "door",
      href: "/products/traders-room",
    },
    {
      title: "Liquidity Bridge",
      body: "Connect your platform to multiple liquidity providers with smart order routing.",
      icon: "network",
      href: "/products/liquidity-bridge",
    },
    {
      title: "Risk Management",
      body: "Real-time exposure monitoring, A/B book tools and automated alerts.",
      icon: "shield",
      href: "/products/risk-management",
    },
    {
      title: "Copy Trading, PAMM & MAM",
      body: "Let clients follow strategies and let money managers trade at scale.",
      icon: "repeat",
      href: "/products/copy-trading-pamm-mam",
    },
    {
      title: "IB & Affiliate Module",
      body: "Multi-level commissions, rebates and partner reporting.",
      icon: "handshake",
      href: "/products/ib-affiliate-module",
    },
    {
      title: "Payment Integrations",
      body: "Cards, bank transfers, local methods and crypto payments.",
      icon: "creditcard",
      href: "/products/payment-integrations",
    },
  ] as (Feature & { href: string })[],
};

export const howItWorks = {
  eyebrow: "How it works",
  heading: "From Idea to Live Brokerage in 4 Steps",
  highlight: "4 Steps",
  steps: [
    {
      step: "01",
      title: "Consultation",
      body: "We understand your business model, target markets and budget.",
    },
    {
      step: "02",
      title: "Setup & Branding",
      body: "We configure the platform, CRM and client portal with your brand.",
    },
    {
      step: "03",
      title: "Integration & Testing",
      body: "We connect liquidity, payments and KYC, then test everything end to end.",
    },
    {
      step: "04",
      title: "Go Live & Grow",
      body: "You launch, and our team supports you 24/7 as you scale.",
    },
  ] as Step[],
};

export const whySetupZero = {
  eyebrow: "Why SetupZero",
  heading: "Why Brokers Choose SetupZero",
  highlight: "Choose SetupZero",
  items: [
    {
      title: "Faster launch",
      body: "Ready-made modules cut setup time from months to weeks.",
      icon: "rocket",
    },
    {
      title: "One vendor, full stack",
      body: "Platform, CRM, risk, liquidity connectivity and payments under one contract.",
      icon: "layers",
    },
    {
      title: "Fully customisable",
      body: "Your brand, your rules, your workflows.",
      icon: "paintbrush",
    },
    {
      title: "Transparent pricing",
      body: "Clear packages with no hidden fees.",
      icon: "percent",
    },
    {
      title: "Scalable infrastructure",
      body: "Built to handle growth from your first hundred clients to hundreds of thousands.",
      icon: "server",
    },
    {
      title: "Real human support",
      body: "A dedicated account manager and 24/7 technical team.",
      icon: "headphones",
    },
  ] as Feature[],
};

export const testimonials = {
  eyebrow: "Testimonials",
  heading: "What Our Clients Say",
  highlight: "Our Clients",
  items: [
    {
      quote:
        "Client quote pending approval. This slot is reserved for a real testimonial once the client has signed off.",
      name: "Client name",
      role: "Role",
      company: "Company",
      placeholder: true,
    },
    {
      quote:
        "Client quote pending approval. This slot is reserved for a real testimonial once the client has signed off.",
      name: "Client name",
      role: "Role",
      company: "Company",
      placeholder: true,
    },
    {
      quote:
        "Client quote pending approval. This slot is reserved for a real testimonial once the client has signed off.",
      name: "Client name",
      role: "Role",
      company: "Company",
      placeholder: true,
    },
  ] as Testimonial[],
};

export const finalCta: CtaBlock = {
  heading: "Ready to Build Your Brokerage?",
  sub: "Talk to our team and get a tailored setup plan and quote within 24 hours.",
  ctas: [
    { label: "Book a Free Demo", action: "demo" },
    { label: "Talk to Sales", href: "/contact", variant: "outline" },
  ],
};
