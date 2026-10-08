import { facts } from "./facts";
import type { MarketPage } from "./schema";

/**
 * The four asset classes Ezymax quotes, one page each: /markets/[slug].
 *
 * This replaced five "solutions" that a technology vendor sold to brokers.
 * The shape is the same; nothing else is.
 *
 * Two rules the copy here follows, because earlier revisions of this site
 * broke both:
 *
 *  - Leverage is `facts.defaultLeverage`, never a number typed inline. The
 *    site used to say 1:200 while the risk disclosure said 1:500 and the
 *    server was configured for 1:100.
 *  - Nothing claims funds sit in a contract, or that withdrawals skip review.
 *    The deposit path credits a database balance from an admin-held address
 *    and withdrawals are written `pending`. Saying otherwise contradicts both
 *    the code and this site's own terms.
 */
export const markets: MarketPage[] = [
  {
    slug: "forex",
    nav: {
      label: "Forex",
      blurb: "Majors, minors and exotics, with the spread on the ticket.",
      icon: "globe",
    },
    summary:
      "Majors, minors and exotics, with the live spread shown next to the price before you confirm.",
    hero: {
      eyebrow: "Forex",
      headline: "Trade Currency Pairs With the Cost in Front of You",
      highlight: "Cost in Front of You",
      sub: "Majors, minors and exotics as CFDs. The live spread sits next to the price on the ticket — the number traders actually shop on — and every other cost is itemised before you confirm.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        { label: "How margin works", href: "/protection", variant: "outline" },
      ],
      badges: ["Majors", "Minors", "Exotics", `Up to ${facts.defaultLeverage}`],
    },
    featuresHeading: "How it works",
    features: [
      {
        title: "Spreads on the ticket",
        body: "Shown beside the price before you confirm, not published in a PDF you have to go and find.",
        icon: "percent",
      },
      {
        title: "Leverage you choose",
        body: `Set per position, up to ${facts.defaultLeverage}. Costs apply only when you use it.`,
        icon: "gauge",
      },
      {
        title: "Published risk levels",
        body: `Margin call at ${facts.marginCallLevel}, stop-out at ${facts.stopOutLevel}. The same numbers for every account.`,
        icon: "shield",
      },
      {
        title: "Long or short",
        body: "Take either side of a pair without borrowing the currency.",
        icon: "repeat",
      },
    ],
    whyItMatters: {
      heading: "Why the spread placement matters",
      paragraphs: [
        "Spread is the cost you pay on every forex trade, and on most platforms it is a figure in a separate document that may or may not match what you are charged.",
        "Here it is rendered on the order ticket from the same feed that fills you, so the number you read and the number you pay are one number.",
      ],
    },
    note: "CFDs are leveraged products. Losses can exceed your initial deposit.",
    cta: {
      heading: "Trade forex on Ezymax",
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
      title: "Forex CFDs",
      description:
        "Trade forex CFDs on Ezymax — majors, minors and exotics, with live spreads shown on the order ticket and published margin call and stop-out levels.",
    },
  },

  {
    slug: "indices",
    nav: {
      label: "Indices",
      blurb: "The big benchmarks, long or short, without the basket.",
      icon: "trending",
    },
    summary:
      "Go long or short the US, European and Asian benchmarks without owning the underlying basket.",
    hero: {
      eyebrow: "Indices",
      headline: "Take a View on a Whole Market at Once",
      highlight: "Whole Market at Once",
      sub: "US, European and Asian benchmarks as CFDs. Fixed contract sizes mean predictable margin, and the overnight swap is shown before you confirm rather than appearing on a statement later.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        { label: "See all markets", href: "/markets", variant: "outline" },
      ],
      badges: ["US", "Europe", "Asia", "Long or short"],
    },
    featuresHeading: "How it works",
    features: [
      {
        title: "Fixed contract sizes",
        body: "Margin per lot is predictable, so position sizing is arithmetic rather than guesswork.",
        icon: "layers",
      },
      {
        title: "Swap shown upfront",
        body: "The overnight financing cost appears on the ticket before you confirm.",
        icon: "calendar",
      },
      {
        title: "No basket to own",
        body: "Exposure to the benchmark without buying or borrowing its constituents.",
        icon: "layers",
      },
      {
        title: "Either direction",
        body: "Short an index as easily as going long.",
        icon: "repeat",
      },
    ],
    whyItMatters: {
      heading: "Why swap is on the ticket",
      paragraphs: [
        "Index positions held overnight accrue a financing charge. It is small per night and easy to overlook, which is how a position that looked profitable closes flat.",
        "Showing it before you confirm means the carrying cost is part of the decision rather than a discovery.",
      ],
    },
    note: "CFDs are leveraged products. Losses can exceed your initial deposit.",
    cta: {
      heading: "Trade indices on Ezymax",
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
      title: "Index CFDs",
      description:
        "Trade index CFDs on Ezymax — US, European and Asian benchmarks with fixed contract sizes and the overnight swap shown before you confirm.",
    },
  },

  {
    slug: "commodities",
    nav: {
      label: "Commodities",
      blurb: "Gold, silver and oil — the classic macro hedges.",
      icon: "zap",
    },
    summary:
      "Gold, silver and oil — the classic macro hedges, at CFD position sizes.",
    hero: {
      eyebrow: "Commodities",
      headline: "Metals and Energy, at a Size That Fits",
      highlight: "a Size That Fits",
      sub: "Gold, silver and oil as CFDs. Hedge an existing exposure or take a view outright, long or short, with every cost itemised before you confirm.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        { label: "See all markets", href: "/markets", variant: "outline" },
      ],
      badges: ["Gold", "Silver", "Oil", "Long or short"],
    },
    featuresHeading: "How it works",
    features: [
      {
        title: "Metals and energies",
        body: "The instruments most used to express a macro view or offset one.",
        icon: "zap",
      },
      {
        title: "Hedge or speculate",
        body: "Take either side; a short is the same mechanic as a long.",
        icon: "repeat",
      },
      {
        title: "Costs itemised",
        body: "Spread, swap and commission are listed separately before you confirm.",
        icon: "percent",
      },
      {
        title: "CFD position sizes",
        body: "Exposure scaled to your account rather than to a full contract.",
        icon: "gauge",
      },
    ],
    whyItMatters: {
      heading: "Why size matters here",
      paragraphs: [
        "A standard futures contract in gold or crude is far larger than most individual accounts can carry, which forces the position size rather than letting you choose it.",
        "A CFD lets you pick the exposure, which means the stop you wanted is the stop you can actually afford to place.",
      ],
    },
    note: "CFDs are leveraged products. Losses can exceed your initial deposit.",
    cta: {
      heading: "Trade commodities on Ezymax",
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
      title: "Commodity CFDs",
      description:
        "Trade commodity CFDs on Ezymax — gold, silver and oil, long or short, with spread, swap and commission itemised before you confirm.",
    },
  },

  {
    slug: "crypto",
    nav: {
      label: "Crypto",
      blurb: "Major pairs, on markets that never close.",
      icon: "bitcoin",
    },
    summary:
      "BTC, ETH and major pairs, traded from the same balance as the rest of your positions.",
    hero: {
      eyebrow: "Crypto",
      headline: "Markets That Never Close",
      highlight: "Never Close",
      sub: "BTC, ETH and the major pairs as CFDs, settled from the same account balance as your forex and index positions. No separate wallet, no separate funding step.",
      ctas: [
        { label: "Join Waitlist", action: "waitlist" },
        { label: "See all markets", href: "/markets", variant: "outline" },
      ],
      badges: ["BTC", "ETH", "Major pairs", "24/7"],
    },
    featuresHeading: "How it works",
    features: [
      {
        title: "One balance",
        body: "Crypto positions draw on the same account as everything else.",
        icon: "wallet",
      },
      {
        title: "Open at any hour",
        body: "The market does not close for a weekend, and neither does the ticket.",
        icon: "calendar",
      },
      {
        title: "No custody of coins",
        body: "A CFD tracks the price. You are not holding, sending or storing the asset.",
        icon: "shield",
      },
      {
        title: "Same rules as every market",
        body: `Margin call at ${facts.marginCallLevel}, stop-out at ${facts.stopOutLevel}, same as forex.`,
        icon: "layers",
      },
    ],
    whyItMatters: {
      heading: "A word on weekend risk",
      paragraphs: [
        "Crypto trading around the clock is usually sold as a convenience, and it is one. It is also the reason a position can move a long way while you are not watching it.",
        "The stop-out level is the backstop, not a plan. Size the position for the gap you could wake up to, not the one you expect.",
      ],
    },
    note: "CFDs are leveraged products. Losses can exceed your initial deposit.",
    cta: {
      heading: "Trade crypto on Ezymax",
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
      title: "Crypto CFDs",
      description:
        "Trade crypto CFDs on Ezymax — BTC, ETH and major pairs around the clock, settled from the same account balance as your other positions.",
    },
  },
];

export function getMarket(slug: string) {
  return markets.find((m) => m.slug === slug);
}
