import type { SolutionPage } from "./schema";
import { placeholders } from "./placeholders";

export const solutions: SolutionPage[] = [
  {
    slug: "cfd-white-label",
    nav: {
      label: "CFD White Label",
      blurb: "A branded multi-asset brokerage, ready on day one.",
      icon: "layers",
    },
    summary:
      "Launch a branded multi-asset CFD brokerage with platform, CRM and back office ready on day one.",
    hero: {
      eyebrow: "CFD White Label",
      headline: "Launch Your Own Branded CFD Brokerage",
      highlight: "Branded CFD Brokerage",
      sub: "A complete, ready-to-trade brokerage under your brand: trading platform, CRM, client portal and back office included.",
      ctas: [
        { label: "Get a White Label Quote", action: "demo" },
        { label: "See Pricing", href: "/pricing", variant: "outline" },
      ],
      badges: ["Forex", "Indices", "Commodities", "Metals", "Stocks", "Crypto CFDs"],
    },
    featuresHeading: "What you get",
    features: [
      {
        title: "Branded trading terminals",
        body: "Branded web, desktop and mobile trading terminals.",
        icon: "monitor",
      },
      {
        title: "Multi-asset coverage",
        body: "Forex, indices, commodities, metals, stocks and crypto CFDs.",
        icon: "layers",
      },
      {
        title: "Forex CRM and Trader's Room",
        body: "With KYC, deposits and withdrawals built in.",
        icon: "users",
      },
      {
        title: "Back office",
        body: "Account groups, symbols, spreads, swaps and leverage.",
        icon: "settings",
      },
      {
        title: "Liquidity and risk tools",
        body: "Liquidity connectivity and risk management tools.",
        icon: "shield",
      },
      {
        title: "IB and affiliate module",
        body: "Multi-level partner structures from the first day.",
        icon: "network",
      },
      {
        title: "Hosting, maintenance and 24/7 support",
        body: "We keep the servers running so you can focus on clients.",
        icon: "headphones",
      },
    ],
    whoItsFor: {
      heading: "Who it's for",
      paragraphs: [
        "New brokers, introducing brokers ready to become full brokers, and existing brokers who want to cut costs or switch providers.",
      ],
    },
    whyItMatters: {
      heading: "Launch timeline",
      paragraphs: [
        `As little as ${placeholders.launchTimelineWeeks} weeks from signed agreement to go-live.`,
      ],
    },
    cta: {
      heading: "Ready to launch your CFD brokerage?",
      sub: "Tell us your markets and budget. We reply with a tailored setup plan and quote within 24 hours.",
      ctas: [
        { label: "Get a White Label Quote", action: "demo" },
        { label: "Talk to Sales", href: "/contact", variant: "outline" },
      ],
    },
    seo: {
      title: "CFD White Label Brokerage Solution",
      description:
        "Launch a branded multi-asset CFD brokerage with trading platform, Forex CRM, Trader's Room, back office, liquidity connectivity and 24/7 support from SetupZero.",
    },
  },
  {
    slug: "prop-firm-solution",
    nav: {
      label: "Prop Firm Solution",
      blurb: "Challenges, rule checks, payouts and dashboards in one system.",
      icon: "trophy",
    },
    summary:
      "Run evaluation challenges, automated rule checks, payouts and trader dashboards from one system.",
    hero: {
      eyebrow: "Prop Firm Solution",
      headline: "Start and Scale Your Prop Trading Firm",
      highlight: "Prop Trading Firm",
      sub: "Everything you need to sell challenges, evaluate traders and manage funded accounts, fully automated.",
      ctas: [
        { label: "Launch Your Prop Firm", action: "demo" },
        { label: "See Pricing", href: "/pricing", variant: "outline" },
      ],
      badges: ["One-step", "Two-step", "Instant funding", "Automated payouts"],
    },
    featuresHeading: "Key features",
    features: [
      {
        title: "Challenge builder",
        body: "One-step, two-step and instant funding models.",
        icon: "clipboard",
      },
      {
        title: "Automatic rule checks",
        body: "Daily loss, max drawdown, profit targets and trading days.",
        icon: "shield",
      },
      {
        title: "Instant account creation",
        body: "Accounts are created the moment payment clears.",
        icon: "zap",
      },
      {
        title: "Trader dashboard",
        body: "Live stats, objectives and progress for every trader.",
        icon: "gauge",
      },
      {
        title: "Automated payouts",
        body: "Profit splits and scaling plans run on schedule.",
        icon: "wallet",
      },
      {
        title: "Certificates, leaderboards and referrals",
        body: "Built-in programs that keep traders engaged.",
        icon: "award",
      },
      {
        title: "Risk team tools",
        body: "Flag toxic or copy-pasted strategies before payout.",
        icon: "eye",
      },
      {
        title: "Website, checkout and payment gateway",
        body: "Integrated end to end, from landing page to funded account.",
        icon: "creditcard",
      },
    ],
    whyItMatters: {
      heading: "Why it matters",
      paragraphs: [
        "Manual monitoring breaks when you grow. SetupZero automates evaluation and risk, so your team focuses on marketing and payouts.",
      ],
    },
    cta: {
      heading: "Ready to launch your prop firm?",
      sub: "Get a tailored setup plan covering challenges, rules, payouts and payments.",
      ctas: [
        { label: "Launch Your Prop Firm", action: "demo" },
        { label: "Talk to Sales", href: "/contact", variant: "outline" },
      ],
    },
    seo: {
      title: "Prop Firm Technology Solution",
      description:
        "Sell challenges, evaluate traders and manage funded accounts with SetupZero's automated prop firm technology: challenge builder, rule checks, payouts and dashboards.",
    },
  },
  {
    slug: "forex-options-platform",
    nav: {
      label: "Forex & Options Platform",
      blurb: "Spot forex and options with real-time pricing and risk controls.",
      icon: "chartLine",
    },
    summary:
      "Offer spot forex alongside options trading with real-time pricing and risk controls.",
    hero: {
      eyebrow: "Forex & Options Platform",
      headline: "Offer Forex and Options From One Platform",
      highlight: "Forex and Options",
      sub: "Give clients spot forex and options trading with real-time pricing, flexible contracts and built-in risk controls.",
      ctas: [
        { label: "Request a Platform Demo", action: "demo" },
        { label: "Explore Products", href: "/products", variant: "outline" },
      ],
      badges: ["Spot forex", "Options", "Real-time Greeks", "Margin management"],
    },
    featuresHeading: "Key features",
    features: [
      {
        title: "Spot forex trading",
        body: "Market and pending orders with one-click execution.",
        icon: "chartLine",
      },
      {
        title: "Options trading",
        body: "Configurable expiries and strike prices.",
        icon: "calendar",
      },
      {
        title: "Real-time pricing and Greeks",
        body: "Live pricing with Greeks display for every contract.",
        icon: "gauge",
      },
      {
        title: "Position and margin management",
        body: "Managed consistently across all instruments.",
        icon: "scale",
      },
      {
        title: "Exposure dashboards",
        body: "Built for the dealing desk, updated in real time.",
        icon: "eye",
      },
      {
        title: "Full CRM and Trader's Room integration",
        body: "One client record from onboarding to trade history.",
        icon: "users",
      },
    ],
    cta: {
      heading: "See the forex and options platform in action",
      sub: "Book a guided demo with our platform team.",
      ctas: [
        { label: "Request a Platform Demo", action: "demo" },
        { label: "Talk to Sales", href: "/contact", variant: "outline" },
      ],
    },
    seo: {
      title: "Forex & Options Trading Platform",
      description:
        "Offer spot forex and options trading from one platform with real-time pricing, Greeks display, margin management and dealing desk exposure dashboards.",
    },
  },
  {
    slug: "crypto-brokerage",
    nav: {
      label: "Crypto Brokerage",
      blurb: "Crypto CFDs or spot crypto with wallets and payments.",
      icon: "bitcoin",
    },
    summary: "Add crypto CFDs or spot crypto with wallet and payment integrations.",
    hero: {
      eyebrow: "Crypto Brokerage",
      headline: "Add Crypto to Your Offering",
      highlight: "Crypto",
      sub: "Launch crypto CFDs or spot crypto trading with wallet, payment and liquidity integrations.",
      ctas: [
        { label: "Talk to a Crypto Specialist", action: "demo" },
        { label: "Liquidity Connectivity", href: "/liquidity", variant: "outline" },
      ],
      badges: ["Crypto CFDs", "Spot crypto", "Crypto gateways", "24/7 pricing"],
    },
    featuresHeading: "Key features",
    features: [
      {
        title: "Crypto CFDs",
        body: "Alongside your existing instruments.",
        icon: "bitcoin",
      },
      {
        title: "Spot crypto trading module",
        body: "Spot trading with wallet integration.",
        icon: "repeat",
      },
      {
        title: "Crypto deposit and withdrawal gateways",
        body: "Fund and pay out in crypto.",
        icon: "wallet",
      },
      {
        title: "24/7 pricing feeds and weekend trading",
        body: "Markets that never close, supported.",
        icon: "globe",
      },
      {
        title: "Risk and exposure tools",
        body: "Built for volatile markets.",
        icon: "shield",
      },
    ],
    note: "Crypto services may need specific licences depending on your jurisdiction. Our team can point you to the right legal partners.",
    cta: {
      heading: "Ready to add crypto?",
      sub: "Talk to a specialist about CFDs, spot trading and the integrations you need.",
      ctas: [
        { label: "Talk to a Crypto Specialist", action: "demo" },
        { label: "Talk to Sales", href: "/contact", variant: "outline" },
      ],
    },
    seo: {
      title: "Crypto Brokerage Technology",
      description:
        "Launch crypto CFDs or spot crypto trading with wallet, payment and liquidity integrations, 24/7 pricing feeds and risk tools from SetupZero.",
    },
  },
  {
    slug: "custom-platform-development",
    nav: {
      label: "Custom Platform Development",
      blurb: "Trading technology built to your exact specifications.",
      icon: "code",
    },
    summary:
      "Need something unique? Our engineers build trading technology to your exact specifications.",
    hero: {
      eyebrow: "Custom Platform Development",
      headline: "Trading Technology Built Around Your Business",
      highlight: "Built Around Your Business",
      sub: "When off-the-shelf isn't enough, our engineers design and build custom trading platforms, modules and integrations.",
      ctas: [
        { label: "Discuss Your Project", action: "demo" },
        { label: "Support & Services", href: "/services", variant: "outline" },
      ],
      badges: ["Web", "Desktop", "Mobile", "APIs", "Dashboards"],
    },
    featuresHeading: "What we build",
    features: [
      {
        title: "Proprietary trading platforms",
        body: "Web, desktop and mobile.",
        icon: "monitor",
      },
      {
        title: "Custom CRM workflows and reporting",
        body: "Shaped around how your teams work.",
        icon: "users",
      },
      {
        title: "API integrations",
        body: "Platforms, liquidity providers, KYC and payment providers.",
        icon: "plug",
      },
      {
        title: "Plugins, trading tools and automation scripts",
        body: "Extend your platform without replacing it.",
        icon: "code",
      },
      {
        title: "Data dashboards and business intelligence",
        body: "See what is happening across the brokerage.",
        icon: "chart",
      },
    ],
    timelineHeading: "Our process",
    timeline: [
      { step: "01", title: "Discovery", body: "We map your goals, users and constraints." },
      { step: "02", title: "Design", body: "Architecture, data flows and interface design." },
      { step: "03", title: "Development", body: "Iterative builds with regular reviews." },
      { step: "04", title: "Testing", body: "Functional, load and security testing end to end." },
      { step: "05", title: "Launch", body: "Controlled rollout with monitoring in place." },
      { step: "06", title: "Ongoing support", body: "Maintenance, updates and 24/7 technical support." },
    ],
    cta: {
      heading: "Have a project in mind?",
      sub: "Share your requirements and we will scope the build with you.",
      ctas: [
        { label: "Discuss Your Project", action: "demo" },
        { label: "Talk to Sales", href: "/contact", variant: "outline" },
      ],
    },
    seo: {
      title: "Custom Trading Platform Development",
      description:
        "SetupZero engineers design and build custom trading platforms, CRM workflows, API integrations, plugins and data dashboards for brokers and fintechs.",
    },
  },
];

export function getSolution(slug: string) {
  return solutions.find((s) => s.slug === slug);
}
