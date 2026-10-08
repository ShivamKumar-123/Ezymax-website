import { facts } from "./facts";
import type { PlatformPage } from "./schema";

/**
 * What the platform does, one page each: /platform/[slug].
 *
 * Drawn from the previous site's /platform, /earn and /protection pages,
 * minus the claims the backend does not support. Specifically removed:
 *
 *  - "your balance never moves onto a broker's book" and "contract-side
 *    margin and settlement". Deposits credit a database balance from an
 *    admin-held address; there is no live vault contract.
 *  - "the pool sits on-chain and its balance is publicly visible". Nothing
 *    on-chain is configured, so there is no balance anyone can inspect.
 *  - leverage written as 1:200. It is `facts.defaultLeverage`.
 */
export const platformProducts: PlatformPage[] = [
  {
    slug: "web-platform",
    nav: {
      label: "Web platform",
      blurb: "Trade from the browser. Nothing to install.",
      icon: "monitor",
    },
    summary:
      "Charting, order tickets and your balance on one screen, with every cost itemised before you confirm.",
    hero: {
      eyebrow: "Web platform",
      headline: "Trade From the Browser, With Nothing to Install",
      highlight: "Nothing to Install",
      sub: "Charting, order tickets and your account balance on a single screen. Spread, swap, commission and margin are itemised on every ticket before you confirm — what you read is what settles.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        { label: "See the markets", href: "/markets", variant: "outline" },
      ],
      badges: ["Browser", "No install", "Full cost preview"],
    },
    bullets: [
      "Used and free margin visible at all times",
      "Spread, swap, commission and margin itemised on every ticket",
      "Stop loss and take profit attachable to any order",
      `Margin call at ${facts.marginCallLevel}, stop-out at ${facts.stopOutLevel}`,
      `Up to ${facts.maxOpenPositions} open positions per account`,
    ],
    cta: {
      heading: "Start on the web platform",
      sub: "Access is by invitation. Join the waitlist and we will email you when a place opens.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        {
          label: "Read the risk disclosure",
          href: "/legal/risk-disclosure",
          variant: "outline",
        },
      ],
    },
    seo: {
      title: "Web Trading Platform",
      description:
        "Trade CFDs from the browser on Ezymex, with spread, swap, commission and margin itemised on every order ticket before you confirm.",
    },
  },

  {
    slug: "mt5",
    nav: {
      label: "MetaTrader 5",
      blurb: "Keep your charts, indicators and EAs.",
      icon: "chart",
    },
    summary:
      "Connect MT5 as your front end and keep the indicators, templates and EAs you already use.",
    hero: {
      eyebrow: "MetaTrader 5",
      headline: "Keep the MT5 Setup You Already Have",
      highlight: "MT5 Setup",
      sub: "If MT5 is where you work, connect it as your execution front end. Your indicators, templates and expert advisors run unchanged, against the same account and the same published margin rules.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        {
          label: "See the web platform",
          href: "/platform/web-platform",
          variant: "outline",
        },
      ],
      badges: ["Indicators", "Templates", "Expert advisors"],
    },
    bullets: [
      "Familiar charts, indicators and templates",
      "Expert advisors run without modification",
      "One account shared with the web platform",
      "The same margin call and stop-out levels apply",
    ],
    cta: {
      heading: "Connect MT5 to Ezymex",
      sub: "Access is by invitation. Join the waitlist and we will email you when a place opens.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        {
          label: "Read the risk disclosure",
          href: "/legal/risk-disclosure",
          variant: "outline",
        },
      ],
    },
    seo: {
      title: "MetaTrader 5 Access",
      description:
        "Connect MetaTrader 5 to your Ezymex account and keep your existing indicators, templates and expert advisors.",
    },
  },

  {
    slug: "copy-trading",
    nav: {
      label: "Copy trading",
      blurb: "Follow a record built on this platform.",
      icon: "users",
    },
    summary:
      "Copy a trader at your own size, with a drawdown cap you set and can stop at any time.",
    hero: {
      eyebrow: "Copy trading",
      headline: "Follow a Record Built Here, Not a Screenshot",
      highlight: "Not a Screenshot",
      sub: "Every published result was generated on this platform, so a profile leads with months of history and maximum drawdown rather than a selected highlight. You choose the allocation and the risk cap.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        { label: "See risk tools", href: "/protection", variant: "outline" },
      ],
      badges: ["Drawdown caps", "Your size", "Pause any time"],
    },
    bullets: [
      "Profiles lead with history length and maximum drawdown",
      "Set your own allocation per trader",
      "Set a maximum drawdown; copying stops automatically when it is hit",
      "Pause without closing your account or touching other positions",
      "Copying does not reduce risk, and past performance does not predict future results",
    ],
    cta: {
      heading: "Copy a trader on Ezymex",
      sub: "Access is by invitation. Join the waitlist and we will email you when a place opens.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        {
          label: "Read the risk disclosure",
          href: "/legal/risk-disclosure",
          variant: "outline",
        },
      ],
    },
    seo: {
      title: "Copy Trading",
      description:
        "Copy traders on Ezymex at your own size, with a maximum drawdown cap that stops copying automatically when it is reached.",
    },
  },

  {
    slug: "funded-accounts",
    nav: {
      label: "Funded accounts",
      blurb: "Pass an evaluation, trade platform capital.",
      icon: "trophy",
    },
    summary:
      "A rules-based evaluation, then a funded account with published limits and a published profit split.",
    hero: {
      eyebrow: "Funded accounts",
      headline: "Trade Platform Capital on Published Rules",
      highlight: "Published Rules",
      sub: "Pass a rules-based evaluation and trade a funded account with defined drawdown limits and a stated profit split. The rules, the limits and the split are published before you start.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        { label: "See the markets", href: "/markets", variant: "outline" },
      ],
      badges: ["Evaluation", "Defined limits", "Published split"],
    },
    bullets: [
      "Evaluation rules stated upfront, not adjusted mid-run",
      "Defined maximum drawdown",
      "Profit split published before you begin",
      "The same execution and settlement as a personal account",
    ],
    cta: {
      heading: "Apply for a funded account",
      sub: "Access is by invitation. Join the waitlist and we will email you when a place opens.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        {
          label: "Read the risk disclosure",
          href: "/legal/risk-disclosure",
          variant: "outline",
        },
      ],
    },
    seo: {
      title: "Funded Accounts",
      description:
        "Pass a rules-based evaluation and trade an Ezymex funded account with defined drawdown limits and a published profit split.",
    },
  },

  {
    slug: "shield-cover",
    nav: {
      label: "Shield cover",
      blurb: "Buy cover for a day, a week or a month.",
      icon: "shield",
    },
    summary:
      "An optional plan that covers a share of what you lose across its window, up to a stated cap.",
    hero: {
      eyebrow: "Shield cover",
      headline: "Cover a Window of Trading, Not One Position",
      highlight: "a Window of Trading",
      sub: "Shield is bought for a day, a week or a month. It covers a share of everything you lose across that window, up to the plan's maximum payout. No per-trade toggle and no claim form.",
      ctas: [
        { label: "See the plans", href: "/protection" },
        { label: "Join Waitlist", action: "waitlist", variant: "outline" },
      ],
      badges: ["Daily", "Weekly", "Monthly"],
    },
    bullets: [
      "Twelve plans, from 20% of losses covered up to 50%",
      "Maximum payouts from $200 to $15,000 depending on plan and window",
      "A single premium, charged up front and shown before you confirm",
      "Cover applies to cumulative loss over the window and is credited automatically",
      "Qualifying trades must open after the plan starts, be held at least five minutes, and not be hedged by an opposite open position",
    ],
    cta: {
      heading: "See the Shield plan table",
      sub: "Every plan, what it covers and what it costs.",
      ctas: [
        { label: "View plans", href: "/protection" },
        { label: "Join Waitlist", action: "waitlist", variant: "outline" },
      ],
    },
    seo: {
      title: "Shield Cover",
      description:
        "Ezymex Shield covers a share of your losses across a day, a week or a month, up to a stated maximum payout, for a single premium shown before you confirm.",
    },
  },

  {
    slug: "risk-tools",
    nav: {
      label: "Risk tools",
      blurb: "See the downside before you take it.",
      icon: "gauge",
    },
    summary:
      "Cost previews, attachable exits, margin alerts and copy drawdown caps.",
    hero: {
      eyebrow: "Risk tools",
      headline: "See the Downside Before You Take It",
      highlight: "Before You Take It",
      sub: "Every cost on the ticket before you confirm, exits you can attach to any order, alerts as free margin tightens, and a drawdown cap on anyone you copy.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        { label: "See Shield plans", href: "/protection", variant: "outline" },
      ],
      badges: ["Cost preview", "Stop loss", "Margin alerts"],
    },
    bullets: [
      "Spread, swap, commission and margin itemised on every ticket",
      "Stop loss and take profit attachable to any order",
      "Alerts as free margin tightens, before the stop-out level is reached",
      "A maximum drawdown per copied trader, enforced automatically",
      `Margin call at ${facts.marginCallLevel} and stop-out at ${facts.stopOutLevel}, published and identical for every account`,
    ],
    cta: {
      heading: "Trade with the numbers in front of you",
      sub: "Access is by invitation. Join the waitlist and we will email you when a place opens.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        {
          label: "Read the risk disclosure",
          href: "/legal/risk-disclosure",
          variant: "outline",
        },
      ],
    },
    seo: {
      title: "Risk Tools",
      description:
        "Ezymex risk tools: full cost previews on every ticket, attachable stop loss and take profit, margin alerts and copy drawdown caps.",
    },
  },

  {
    slug: "staking",
    nav: {
      label: "Staking",
      blurb: "Put an unallocated balance to work between setups.",
      icon: "database",
    },
    summary:
      "Stake an idle balance for a flexible or fixed term, at a rate shown before you commit.",
    hero: {
      eyebrow: "Staking",
      headline: "Idle Balance Does Not Have to Sit Idle",
      highlight: "Sit Idle",
      sub: "Between setups, unallocated balance earns nothing on most platforms. Stake it here for a flexible or fixed term, at a reward rate shown before you commit.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        { label: "See rewards", href: "/earn", variant: "outline" },
      ],
      badges: ["Flexible", "Fixed term", "Rate shown upfront"],
    },
    bullets: [
      "Flexible and fixed lock durations",
      "The reward rate is shown before you stake",
      "Rewards convert into trading utility rather than a separate pot",
      "Staking is not a guaranteed return and carries its own risk",
    ],
    cta: {
      heading: "Stake on Ezymex",
      sub: "Access is by invitation. Join the waitlist and we will email you when a place opens.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        {
          label: "Read the risk disclosure",
          href: "/legal/risk-disclosure",
          variant: "outline",
        },
      ],
    },
    seo: {
      title: "Staking",
      description:
        "Stake an unallocated Ezymex balance for a flexible or fixed term, at a reward rate shown before you commit.",
    },
  },

  {
    slug: "rewards",
    nav: {
      label: "XP and rewards",
      blurb: "Better terms earned by how you trade.",
      icon: "award",
    },
    summary:
      "XP and a performance score that improve your terms — account size is not an input.",
    hero: {
      eyebrow: "XP and rewards",
      headline: "Better Terms Earned by How You Trade",
      highlight: "How You Trade",
      sub: "Most platforms give their best terms to their biggest deposits. Here XP rises with consistency, risk control and education, and your spreads, swaps and commission follow it. Deposit size is not an input.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        { label: "See the ladder", href: "/earn", variant: "outline" },
      ],
      badges: ["XP", "Performance score", "Platform credits"],
    },
    bullets: [
      "XP rises with consistent trading, completed education and controlled risk",
      "A performance score built from risk management, consistency and discipline",
      "Tighter spreads, reduced swaps and lower commission as XP rises",
      "Higher Shield tiers and better staking rates unlock with level",
      "Credits are earned through activity, never bought with a deposit",
    ],
    cta: {
      heading: "Earn your terms",
      sub: "Access is by invitation. Join the waitlist and we will email you when a place opens.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        { label: "See the ladder", href: "/earn", variant: "outline" },
      ],
    },
    seo: {
      title: "XP and Rewards",
      description:
        "Ezymex improves your spreads, swaps and commission as your XP rises. XP comes from how you trade, not how much you deposit.",
    },
  },

  {
    slug: "partners",
    nav: {
      label: "Partners",
      blurb: "Earn from real trading activity, not recruitment.",
      icon: "handshake",
    },
    summary:
      "An IB programme paid on the trading activity of traders you introduce.",
    hero: {
      eyebrow: "Partners",
      headline: "Earn From Traders You Actually Bring In",
      highlight: "Actually Bring In",
      sub: "Rewards are tied to the real trading activity of the people you introduce — not to recruitment depth. No tiers below tiers and no volume quotas inherited from someone else's downline.",
      ctas: [
        { label: "Become a partner", href: "/partners" },
        { label: "Join Waitlist", action: "waitlist", variant: "outline" },
      ],
      badges: ["Activity-based", "Reporting", "IB dashboard"],
    },
    bullets: [
      "Rebates paid on closed lots, per introduced trader",
      "Partner-level tools and reporting",
      "An IB management dashboard",
      "No multi-level structure and no downline quotas",
    ],
    cta: {
      heading: "Partner with Ezymex",
      sub: "See the rebate tiers and what the programme pays on.",
      ctas: [
        { label: "See the programme", href: "/partners" },
        { label: "Join Waitlist", action: "waitlist", variant: "outline" },
      ],
    },
    seo: {
      title: "Partner Programme",
      description:
        "The Ezymex IB programme pays rebates on the real trading activity of traders you introduce, with partner reporting and a management dashboard.",
    },
  },
];

export function getPlatformProduct(slug: string) {
  return platformProducts.find((p) => p.slug === slug);
}
