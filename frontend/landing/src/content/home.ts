import { tradeConfig } from "./site";
import { facts } from "./facts";
import type { CtaBlock, Feature, HeroBlock, Stat, Step } from "./schema";

/**
 * Home page copy.
 *
 * Two sections changed meaning rather than wording, and both for the same
 * reason — the originals were placeholders that could not be honestly filled:
 *
 *  - `trustBar` held four invented counts (brokerages launched, active
 *    traders, uptime, countries). It now carries the platform's published
 *    rules, every one of them read from server config. See facts.ts.
 *  - `testimonials` is gone. All three entries were marked `placeholder: true`
 *    and rendered a visible "pending" badge; Ezymex is pre-launch and
 *    pre-launch, so there is no client to quote.
 */

export const homeHero: HeroBlock = {
  eyebrow: "CFD trading with published rules",
  /** `Hero.tsx` renders these two lines around the typewriter. */
  headline: "Trade CFDs on",
  highlight: "",
  sub: "Forex, indices, commodities and crypto, with every cost itemised on the ticket before you confirm and the same published margin rules for every account.",
  ctas: [
    { label: "Open account", href: tradeConfig.register },
    { label: "How it works", href: "#how-it-works", variant: "outline" },
  ],
  badges: [...facts.markets],
};

/**
 * The hero typewriter cycles the markets, in English.
 *
 * It used to cycle "From Zero." through Arabic, Hindi, Chinese, Spanish,
 * Russian, Portuguese and Turkish. On an unlicensed, un-geoblocked CFD site
 * that reads as active solicitation into jurisdictions this platform's own
 * terms exclude from onboarding, which is a different thing from a nice
 * animation.
 */
export const heroTypewriter = ["Forex.", "Indices.", "Commodities.", "Crypto."];

/** The closing line of the hero headline, after the typewriter. */
export const heroHeadlineTail = "On published rules.";

/**
 * The two glass cards floating over the hero scene. They used to read "25+
 * brokerages launched" and "99.9% uptime target", neither of which anything
 * measured. Published platform rules are the only honest thing to put here.
 */
export const heroFloatingStats: Stat[] = [
  { value: facts.defaultLeverage, label: "Default leverage" },
  { value: facts.stopOutLevel, label: "Stop-out level" },
];

export const trustBar = {
  line: "Margin call, stop-out and position limits are published and identical for every account — not negotiated per client.",
  stats: [
    { value: facts.defaultLeverage, label: "Default leverage" },
    { value: facts.marginCallLevel, label: "Margin call level" },
    { value: facts.stopOutLevel, label: "Stop-out level" },
    { value: facts.maxOpenPositions, label: "Max open positions" },
  ] as Stat[],
};

export const marketsOverview = {
  eyebrow: "Markets",
  heading: "Trade the Markets You Already Watch",
  highlight: "You Already Watch",
  intro:
    "Forex, indices, commodities and crypto, all as CFDs from one account balance. Every instrument settles the same way and shows its costs the same way.",
};

export const platformSection = {
  eyebrow: "Platform",
  heading: "Everything the Account Does",
  highlight: "the Account Does",
  intro:
    "One account, whether you trade in the browser or through MetaTrader 5 — plus the things built around it: copy trading, funded accounts, optional loss cover, staking and the partner programme.",
  button: { label: "View the platform", href: "/platform" },
  items: [
    {
      title: "Web platform",
      body: "Charting, order tickets and your balance on one screen, nothing to install.",
      href: "/platform/web-platform",
      icon: "monitor",
    },
    {
      title: "MetaTrader 5",
      body: "Connect MT5 and keep your indicators, templates and expert advisors.",
      href: "/platform/mt5",
      icon: "chart",
    },
    {
      title: "Copy trading",
      body: "Copy at your own size, with a drawdown cap that stops it automatically.",
      href: "/platform/copy-trading",
      icon: "users",
    },
    {
      title: "Funded accounts",
      body: "A rules-based evaluation, then published limits and a published split.",
      href: "/platform/funded-accounts",
      icon: "trophy",
    },
    {
      title: "Shield cover",
      body: "Optional cover for a share of your losses across a day, week or month.",
      href: "/platform/shield-cover",
      icon: "shield",
    },
    {
      title: "Risk tools",
      body: "Cost previews, attachable exits, margin alerts and copy drawdown caps.",
      href: "/platform/risk-tools",
      icon: "gauge",
    },
    {
      title: "Staking",
      body: "Put an unallocated balance to work at a rate shown before you commit.",
      href: "/platform/staking",
      icon: "database",
    },
    {
      title: "XP and rewards",
      body: "Terms that improve with how you trade, not with how much you deposit.",
      href: "/platform/rewards",
      icon: "award",
    },
  ] as Feature[],
};

export const howItWorks = {
  eyebrow: "How it works",
  heading: "From Request to First Trade in 5 Steps",
  highlight: "5 Steps",
  sub: "Five steps from signing up to withdrawing, with what happens at each one.",
  steps: [
    {
      step: "01",
      title: "Open an account",
      body: "Register with your name, email and phone. It takes a couple of minutes.",
    },
    {
      step: "02",
      title: "Verify your identity",
      body: "Standard KYC. Identity and address documents, reviewed before the account is funded.",
    },
    {
      step: "03",
      title: "Fund the account",
      body: "Deposit to your account balance. The amount available to trade is shown immediately.",
    },
    {
      step: "04",
      title: "Trade",
      body: `Open positions with the full cost on the ticket. Margin call at ${facts.marginCallLevel}, stop-out at ${facts.stopOutLevel}.`,
    },
    {
      step: "05",
      title: "Withdraw",
      body: "Request a withdrawal of your free balance. Withdrawals are reviewed before they are released.",
    },
  ] as Step[],
};

export const whyEzymex = {
  eyebrow: "Why Ezymex",
  heading: "Why Traders Choose Ezymex",
  highlight: "Choose Ezymex",
  items: [
    {
      title: "Verified before you fund",
      body: "Identity checks happen before the account can be funded, not after a problem.",
      icon: "lock",
    },
    {
      title: "Costs before you confirm",
      body: "Spread, swap, commission and margin are itemised on the ticket, not published in a document you have to go and find.",
      icon: "percent",
    },
    {
      title: "Risk levels are published",
      body: `Margin call at ${facts.marginCallLevel} and stop-out at ${facts.stopOutLevel}, the same for every account. No per-client arrangements.`,
      icon: "gauge",
    },
    {
      title: "Loss cover you can buy",
      body: "Shield covers a share of what you lose over a day, a week or a month, up to a stated cap, for a premium shown upfront.",
      icon: "shield",
    },
    {
      title: "Terms you earn",
      body: "Spreads, swaps and commission improve with XP, which comes from consistency and risk control. Deposit size is not an input.",
      icon: "award",
    },
    {
      title: "Copy with a hard cap",
      body: "Set a maximum drawdown per trader you copy; copying stops by itself when it is reached.",
      icon: "users",
    },
  ] as Feature[],
};

export const finalCta: CtaBlock = {
  heading: "Trade CFDs with the costs in front of you",
  sub: "Open an account, verify your identity, and fund it when you are ready.",
  ctas: [
    { label: "Open account", href: tradeConfig.register },
    {
      label: "Read the risk disclosure",
      href: "/legal/risk-disclosure",
      variant: "outline",
    },
  ],
};
