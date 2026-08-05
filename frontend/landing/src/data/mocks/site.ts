/**
 * Site-wide chrome copy — navigation, footer, and the account modal. Section
 * copy for each page lives in its own `src/data/mocks/<route>.ts`. Components
 * never import this directly — layouts/views pass it down as props
 * (component-conventions.md → "Data rules").
 */

/**
 * Drawer accordion: a group with `items` expands in place; each item carries a
 * one-line `blurb` of that page section, so the whole offering is browsable
 * from the menu. `href`s deep-link to the section on its page.
 */
export const navGroups = [
  { label: "Home", href: "/", items: [] },
  {
    label: "Trade",
    href: "/trade",
    intro: "Four markets, one set of rules — only margin locks.",
    items: [
      {
        label: "Forex",
        href: "/trade#forex",
        blurb: "50+ pairs with the live spread on the ticket.",
      },
      {
        label: "Indices",
        href: "/trade#indices",
        blurb: "The big benchmarks, long or short.",
      },
      {
        label: "Commodities",
        href: "/trade#commodities",
        blurb: "Gold, silver and oil — macro hedges, CFD-sized.",
      },
      {
        label: "Crypto",
        href: "/trade#crypto",
        blurb: "BTC, ETH and majors on markets that never close.",
      },
      {
        label: "Trading modes",
        href: "/trade#modes",
        blurb: "Fully funded, or leveraged up to 1:200 per position.",
      },
    ],
  },
  {
    label: "Platform",
    href: "/platform",
    intro: "One account, three ways to run it — same settlement.",
    items: [
      {
        label: "Web platform",
        href: "/platform#web",
        blurb: "Trade from the browser. Nothing to install.",
      },
      {
        label: "MT5",
        href: "/platform#mt5",
        blurb: "Keep your MT5 setup; the contract still settles.",
      },
      {
        label: "Copy trading",
        href: "/platform#copy-trading",
        blurb: "Verifiable records, your size, your drawdown cap.",
      },
      {
        label: "Prop trading",
        href: "/platform#prop",
        blurb: "Funded accounts with published rules and splits.",
      },
    ],
  },
  {
    label: "Earn",
    href: "/earn",
    intro: "Better terms are earned, not bought.",
    items: [
      {
        label: "Staking",
        href: "/earn#staking",
        blurb: "Idle balance earns while staying ready to trade.",
      },
      {
        label: "Rewards & XP",
        href: "/earn#rewards",
        blurb: "Discipline tightens your spread. Deposits don't.",
      },
      {
        label: "Referral & partnership",
        href: "/earn#partners",
        blurb: "Earn from real trading activity, not recruitment.",
      },
    ],
  },
  {
    label: "Protection",
    href: "/protection",
    intro: "Cap a loss before you take it.",
    items: [
      {
        label: "Trade insurance",
        href: "/protection#insurance",
        blurb: "Cover up to 75% of a loss, paid automatically at close.",
      },
      {
        label: "Risk tools",
        href: "/protection#risk-tools",
        blurb: "The full downside on the ticket before you confirm.",
      },
    ],
  },
  {
    label: "Company",
    href: "/company",
    intro: "Built so you don't have to trust us.",
    items: [
      {
        label: "About",
        href: "/company#about",
        blurb: "Five things a traditional broker can't say.",
      },
      {
        label: "Protocol",
        href: "/company#protocol",
        blurb: "Where your money actually sits, step by step.",
      },
      {
        label: "Legal structure",
        href: "/company#legal",
        blurb: "Entities, jurisdictions and custody, in plain terms.",
      },
      {
        label: "Contact",
        href: "/company#contact",
        blurb: "A human replies within one business day.",
      },
    ],
  },
] as const;

export const navLabels = {
  openPage: "Open full page",
  backToMenu: "Menu",
  close: "Close",
} as const;

export const headerCta = {
  login: "Log in",
  openAccount: "Open account",
} as const;

export const footerContent = {
  brand: "FX Artha",
  tagline:
    "A protocol-driven trading ecosystem with automated settlement. Funds stay under your control; execution and settlement run on system-defined logic.",
  email: "support@fxartha.com",
  columns: [
    {
      title: "Trade",
      links: [
        { label: "Forex", href: "/trade#forex" },
        { label: "Indices", href: "/trade#indices" },
        { label: "Commodities", href: "/trade#commodities" },
        { label: "Crypto", href: "/trade#crypto" },
        { label: "Trading modes", href: "/trade#modes" },
      ],
    },
    {
      title: "Platform",
      links: [
        { label: "Web platform", href: "/platform#web" },
        { label: "MT5", href: "/platform#mt5" },
        { label: "Copy trading", href: "/platform#copy-trading" },
        { label: "Prop trading", href: "/platform#prop" },
      ],
    },
    {
      title: "Earn",
      links: [
        { label: "Staking", href: "/earn#staking" },
        { label: "Rewards & XP", href: "/earn#rewards" },
        { label: "Partnership", href: "/earn#partners" },
      ],
    },
    {
      title: "Protection",
      links: [
        { label: "Trade insurance", href: "/protection#insurance" },
        { label: "Risk tools", href: "/protection#risk-tools" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "/company#about" },
        { label: "Protocol", href: "/company#protocol" },
        { label: "Legal structure", href: "/company#legal" },
        { label: "Contact", href: "/company#contact" },
      ],
    },
  ],
  riskTitle: "Risk Warning",
  riskBody:
    "Trading forex and contracts for difference (CFDs) carries a high level of risk and may not be suitable for all investors. You could lose more than your initial investment. Past performance is not indicative of future results. Please ensure you fully understand the risks involved and seek independent advice if necessary. FX Artha does not provide investment advice.",
  riskNote:
    "Withdrawal of free balance is executed by the trading contract under published platform rules and applicable legal and compliance requirements.",
  legal: "© 2026 FX Artha Ltd. All rights reserved.",
  legalLinks: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Risk Disclosure", href: "/risk" },
  ],
} as const;

export const modalContent = {
  eyebrow: "Open Account",
  heading: "Start trading with full control.",
  fields: {
    name: { label: "Name", placeholder: "Your name" },
    email: { label: "Email", placeholder: "you@company.com" },
    project: {
      label: "Message",
      placeholder: "Tell us about your trading experience and what you need.",
    },
  },
  note: "We reply within one business day.",
  submit: "Send request",
  submitting: "Sending…",
  successHeading: "Request received",
  successBody:
    "Thanks for reaching out — we'll get back to you within one business day.",
  successCta: "Close",
} as const;
