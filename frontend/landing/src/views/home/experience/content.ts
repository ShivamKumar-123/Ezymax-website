/**
 * Copy for the New Era intro experience, written for FX Artha. Mirrors the
 * shape the ported experience components expect (from the source
 * `data/mocks/home.ts`), but every string is FX Artha's own.
 */

export interface ExperienceButton {
  label: string;
  /** Primary buttons render the circular arrow glyph; secondary do not. */
  withArrow: boolean;
}

export interface ExperienceCopy {
  eyebrow: string;
  /** Heading split into lines — each entry was a `<br>`-separated row. */
  titleLines: string[];
  subtitle: string;
  buttons: ExperienceButton[];
}

export interface StatCardContent {
  id: string;
  title: string;
  stat: string;
  description: string;
}

export interface HomeContent {
  hero: ExperienceCopy;
  cards: StatCardContent[];
  wave: ExperienceCopy;
  galaxy: ExperienceCopy;
}

export const homeContent: HomeContent = {
  hero: {
    eyebrow: "Non-custodial CFD trading",
    titleLines: ["Trade CFDs without handing", "your money to a broker"],
    subtitle:
      "Your money never leaves your control. Margin locks only while a trade is open, and your free balance is always yours to withdraw — no approvals, no waiting.",
    buttons: [
      { label: "Get started", withArrow: true },
      { label: "See how it works", withArrow: false },
    ],
  },
  cards: [
    {
      id: "control",
      title: "Balance you control",
      stat: "100%",
      description:
        "Your funds sit in a contract you own — never in the broker's bank account.",
    },
    {
      id: "approvals",
      title: "Withdrawal approvals",
      stat: "0",
      description:
        "Free balance releases on demand. No review queue, no business hours, no waiting.",
    },
    {
      id: "markets",
      title: "Global markets",
      stat: "24/5",
      description:
        "Forex, metals, indices and crypto CFDs with deep liquidity and tight spreads.",
    },
  ],
  wave: {
    eyebrow: "Everything revolves around you",
    titleLines: ["Your growth is the only", "thing that matters"],
    subtitle:
      "Keep your capital, keep the upside. FX Artha only locks the margin a position needs and settles your P&L the moment you close — the rest stays yours.",
    buttons: [
      { label: "Open an account", withArrow: true },
      { label: "View markets", withArrow: false },
    ],
  },
  galaxy: {
    eyebrow: "One account, a whole ecosystem",
    titleLines: ["Trade, earn and grow —", "all in one place"],
    subtitle:
      "Trading, copy trading, staking, rewards and trade insurance — a living ecosystem with your account at its core, not the broker's.",
    buttons: [
      { label: "Explore the platform", withArrow: true },
      { label: "See the rewards", withArrow: false },
    ],
  },
};
