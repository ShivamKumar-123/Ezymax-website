import type { ProductPage } from "./schema";

const demoCta = (label: string) => ({
  heading: "Ready to build your brokerage?",
  sub: "Talk to our team and get a tailored setup plan and quote within 24 hours.",
  ctas: [
    { label, action: "demo" as const },
    { label: "Talk to Sales", href: "/contact", variant: "outline" as const },
  ],
});

export const products: ProductPage[] = [
  {
    slug: "trading-platform",
    nav: {
      label: "Trading Platform",
      blurb: "Web, desktop and mobile trading with one-click execution.",
      icon: "monitor",
    },
    summary: "Web, desktop and mobile trading with advanced charts and one-click execution.",
    hero: {
      eyebrow: "Trading Platform",
      headline: "A Trading Platform Your Clients Will Love",
      highlight: "Your Clients Will Love",
      sub: "Fast, stable and fully branded trading across web, desktop and mobile.",
      ctas: [
        { label: "See the Platform in Action", action: "demo" },
        { label: "View Pricing", href: "/pricing", variant: "outline" },
      ],
      badges: ["Web", "Desktop", "Mobile", "Multi-asset"],
    },
    bullets: [
      "Advanced charting with indicators, drawing tools and multiple timeframes",
      "Market, limit, stop and trailing orders with one-click trading",
      "Multi-asset support: forex, CFDs, metals, energies, indices, stocks and crypto",
      "Real-time news, economic calendar and price alerts",
      "Multi-language interface",
      "Admin back office for symbols, groups, spreads, commissions and leverage",
    ],
    cta: demoCta("See the Platform in Action"),
    seo: {
      title: "White-Label Trading Platform",
      description:
        "Fast, stable and fully branded trading across web, desktop and mobile with advanced charting, one-click orders, multi-asset support and an admin back office.",
    },
  },
  {
    slug: "forex-crm",
    nav: {
      label: "Forex CRM",
      blurb: "Leads, clients, KYC, deposits and sales teams in one dashboard.",
      icon: "users",
    },
    summary: "Manage leads, clients, KYC, deposits and sales teams in one dashboard.",
    hero: {
      eyebrow: "Forex CRM",
      headline: "The CRM Built for Brokers",
      highlight: "Built for Brokers",
      sub: "Manage every lead, client and transaction from one powerful dashboard.",
      ctas: [
        { label: "Book a CRM Demo", action: "demo" },
        { label: "Trader's Room", href: "/products/traders-room", variant: "outline" },
      ],
      badges: ["Leads", "KYC", "Approvals", "Reports", "Audit trail"],
    },
    bullets: [
      "Lead management with assignment rules and sales pipelines",
      "KYC and document verification workflows",
      "Deposit, withdrawal and internal transfer approvals",
      "Sales and retention team performance reports",
      "Role-based access for admins, managers, sales and compliance",
      "Email, SMS and in-app notifications",
      "Full audit trail for compliance",
    ],
    cta: demoCta("Book a CRM Demo"),
    seo: {
      title: "Forex CRM for Brokers",
      description:
        "Manage leads, KYC, deposits, withdrawals, sales teams and compliance from one Forex CRM dashboard with role-based access and a full audit trail.",
    },
  },
  {
    slug: "traders-room",
    nav: {
      label: "Trader's Room",
      blurb: "A branded client portal for onboarding, funding and accounts.",
      icon: "door",
    },
    summary:
      "A branded client portal for onboarding, funding, withdrawals and account management.",
    hero: {
      eyebrow: "Trader's Room",
      headline: "A Branded Client Portal That Converts",
      highlight: "That Converts",
      sub: "Give clients a smooth journey from sign-up to first trade.",
      ctas: [
        { label: "Book a Free Demo", action: "demo" },
        { label: "Forex CRM", href: "/products/forex-crm", variant: "outline" },
      ],
      badges: ["Onboarding", "Funding", "KYC", "Statements", "IB area"],
    },
    bullets: [
      "Fast registration and digital onboarding",
      "Live and demo account opening",
      "Deposits and withdrawals with multiple payment methods",
      "Document upload and KYC status tracking",
      "Account history, statements and transaction reports",
      "Partner (IB) area inside the same portal",
      "Mobile-friendly design in multiple languages",
    ],
    cta: demoCta("Book a Free Demo"),
    seo: {
      title: "Trader's Room Client Portal",
      description:
        "A branded client portal with digital onboarding, live and demo accounts, deposits and withdrawals, KYC tracking, statements and a partner area.",
    },
  },
  {
    slug: "liquidity-bridge",
    nav: {
      label: "Liquidity Bridge",
      blurb: "Multi-LP connectivity with smart order routing.",
      icon: "network",
    },
    summary:
      "Connect your platform to multiple liquidity providers with smart order routing.",
    hero: {
      eyebrow: "Liquidity Bridge",
      headline: "Smart Connectivity to Deep Liquidity",
      highlight: "Deep Liquidity",
      sub: "Connect your trading platform to multiple liquidity providers with low latency and smart routing.",
      ctas: [
        { label: "Get Liquidity Pricing", action: "demo" },
        { label: "Liquidity Connectivity", href: "/liquidity", variant: "outline" },
      ],
      badges: ["Multi-LP", "Smart routing", "A/B/Hybrid", "FIX API"],
    },
    bullets: [
      "Multi-LP aggregation for better pricing",
      "Smart order routing rules by symbol, group or volume",
      "A-book, B-book and hybrid execution models",
      "Markup and spread control",
      "Execution reports and slippage analytics",
      "FIX API connectivity",
    ],
    cta: demoCta("Get Liquidity Pricing"),
    seo: {
      title: "Liquidity Bridge",
      description:
        "Connect your trading platform to multiple liquidity providers with multi-LP aggregation, smart order routing, A/B/hybrid execution and FIX API connectivity.",
    },
  },
  {
    slug: "risk-management",
    nav: {
      label: "Risk Management",
      blurb: "Real-time exposure, A/B book tools and automated alerts.",
      icon: "shield",
    },
    summary: "Real-time exposure monitoring, A/B book tools and automated alerts.",
    hero: {
      eyebrow: "Risk Management",
      headline: "See and Control Your Risk in Real Time",
      highlight: "in Real Time",
      sub: "Real-time exposure monitoring, A/B book tools and automated alerts for the dealing desk.",
      ctas: [
        { label: "Book a Free Demo", action: "demo" },
        { label: "Liquidity Bridge", href: "/products/liquidity-bridge", variant: "outline" },
      ],
      badges: ["Exposure", "Toxic flow", "Alerts", "A/B book", "P&L"],
    },
    bullets: [
      "Live exposure by symbol, group and client",
      "Toxic flow and arbitrage detection",
      "Automated alerts for large positions and abnormal behaviour",
      "Client classification for A/B book decisions",
      "Profit and loss reporting for the dealing desk",
    ],
    cta: demoCta("Book a Free Demo"),
    seo: {
      title: "Risk Management Tools for Brokers",
      description:
        "Live exposure by symbol, group and client, toxic flow detection, automated alerts, A/B book classification and dealing desk P&L reporting.",
    },
  },
  {
    slug: "copy-trading-pamm-mam",
    nav: {
      label: "Copy Trading / PAMM / MAM",
      blurb: "Let clients follow strategies and managers trade at scale.",
      icon: "repeat",
    },
    summary:
      "Let clients follow strategies and let money managers trade at scale.",
    hero: {
      eyebrow: "Copy Trading, PAMM & MAM",
      headline: "Turn Top Traders Into a Growth Engine",
      highlight: "Growth Engine",
      sub: "Let clients follow strategies and let money managers trade at scale, with transparent reporting for investors.",
      ctas: [
        { label: "Book a Free Demo", action: "demo" },
        { label: "View Pricing", href: "/pricing", variant: "outline" },
      ],
      badges: ["Copy trading", "PAMM", "MAM", "Performance fees"],
    },
    bullets: [
      "Copy trading with strategy pages, rankings and follower controls",
      "PAMM accounts with automated profit allocation",
      "MAM for money managers handling multiple accounts",
      "Performance fees, management fees and high-water marks",
      "Transparent investor reporting",
    ],
    cta: demoCta("Book a Free Demo"),
    seo: {
      title: "Copy Trading, PAMM & MAM",
      description:
        "Copy trading with strategy rankings, PAMM accounts with automated profit allocation, MAM for money managers, fee models and transparent investor reporting.",
    },
  },
  {
    slug: "ib-affiliate-module",
    nav: {
      label: "IB & Affiliate Module",
      blurb: "Multi-level commissions, rebates and partner reporting.",
      icon: "handshake",
    },
    summary: "Multi-level commissions, rebates and partner reporting.",
    hero: {
      eyebrow: "IB & Affiliate Module",
      headline: "Grow Faster With Your Partners",
      highlight: "With Your Partners",
      sub: "Multi-level IB structures, flexible commission plans and real-time partner dashboards.",
      ctas: [
        { label: "Book a Free Demo", action: "demo" },
        { label: "Partner Program", href: "/partners", variant: "outline" },
      ],
      badges: ["Multi-level", "Rebates", "Dashboards", "Tracking"],
    },
    bullets: [
      "Multi-level IB structures",
      "Flexible commission and rebate plans per instrument or group",
      "Real-time partner dashboards and payout reports",
      "Affiliate links, banners and tracking",
      "Automated commission calculation and payouts",
    ],
    cta: demoCta("Book a Free Demo"),
    seo: {
      title: "IB & Affiliate Module",
      description:
        "Multi-level IB structures, flexible commission and rebate plans, real-time partner dashboards, affiliate tracking and automated payouts.",
    },
  },
  {
    slug: "payment-integrations",
    nav: {
      label: "Payment Integrations",
      blurb: "Cards, bank transfers, local methods and crypto payments.",
      icon: "creditcard",
    },
    summary: "Cards, bank transfers, local methods and crypto payments.",
    hero: {
      eyebrow: "Payment Integrations",
      headline: "Let Clients Pay the Way They Prefer",
      highlight: "the Way They Prefer",
      sub: "Cards, bank wires, local payment methods, e-wallets and crypto gateways with automated crediting.",
      ctas: [
        { label: "Book a Free Demo", action: "demo" },
        { label: "Trader's Room", href: "/products/traders-room", variant: "outline" },
      ],
      badges: ["Cards", "Bank wires", "Local methods", "E-wallets", "Crypto"],
    },
    bullets: [
      "Cards, bank wires and local payment methods",
      "E-wallets and crypto payment gateways",
      "Automated deposit crediting",
      "Withdrawal approval workflows",
      "Multi-currency support",
    ],
    cta: demoCta("Book a Free Demo"),
    seo: {
      title: "Payment Integrations for Brokers",
      description:
        "Cards, bank wires, local payment methods, e-wallets and crypto gateways with automated deposit crediting, withdrawal workflows and multi-currency support.",
    },
  },
  {
    slug: "mobile-apps",
    nav: {
      label: "Mobile Apps",
      blurb: "Branded iOS and Android apps for trading and funding.",
      icon: "smartphone",
    },
    summary: "Branded iOS and Android apps with trading, funding and account management on the go.",
    hero: {
      eyebrow: "Mobile Apps",
      headline: "Your Brokerage in Every Pocket",
      highlight: "in Every Pocket",
      sub: "Branded iOS and Android apps with trading, charts, deposits and account management on mobile.",
      ctas: [
        { label: "Book a Free Demo", action: "demo" },
        { label: "Trading Platform", href: "/products/trading-platform", variant: "outline" },
      ],
      badges: ["iOS", "Android", "Push alerts", "App store publishing"],
    },
    bullets: [
      "Branded iOS and Android apps",
      "Trading, charts, deposits and account management on mobile",
      "Push notifications for price alerts and account activity",
      "App store publishing support",
    ],
    cta: demoCta("Book a Free Demo"),
    seo: {
      title: "Branded Mobile Trading Apps",
      description:
        "Branded iOS and Android apps with trading, charts, deposits, account management, push notifications and app store publishing support.",
    },
  },
];

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}
