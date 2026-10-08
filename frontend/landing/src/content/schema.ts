/** Shared content types. All page content is data-driven from src/content/*.ts. */

/** Icon names are resolved through src/lib/icons.ts so content stays serializable. */
export type IconName = string;

export type ButtonVariant = "primary" | "outline" | "ghost" | "cream";

export type Cta = {
  label: string;
  /** Link target. Omit when `action` is set. */
  href?: string;
  /**
   * Opens the access form. Kept for the few places that still collect an
   * email rather than linking straight into the trader app — registration
   * itself is open, so the main CTAs are plain links to `tradeConfig`.
   */
  action?: "waitlist";
  variant?: ButtonVariant;
};

export type Feature = {
  title: string;
  body?: string;
  icon?: IconName;
  /** Set when the feature tile should link somewhere. */
  href?: string;
};

export type Stat = {
  value: string;
  label: string;
};

export type Step = {
  step: string;
  title: string;
  body: string;
};

export type TextSection = {
  heading: string;
  paragraphs: string[];
};

export type HeroBlock = {
  eyebrow?: string;
  headline: string;
  /** A phrase inside `headline` to render in orange. */
  highlight?: string;
  sub: string;
  ctas?: Cta[];
  badges?: string[];
};

export type CtaBlock = {
  heading: string;
  sub?: string;
  ctas: Cta[];
};

export type Seo = {
  title: string;
  description: string;
};

export type NavItem = {
  label: string;
  blurb: string;
  icon: IconName;
};

/** One tradable asset class: /markets/[slug]. */
export type MarketPage = {
  slug: string;
  nav: NavItem;
  /** Short card copy used on the home page and the markets index. */
  summary: string;
  hero: HeroBlock;
  featuresHeading: string;
  features: Feature[];
  whoItsFor?: TextSection;
  whyItMatters?: TextSection;
  timeline?: Step[];
  timelineHeading?: string;
  note?: string;
  cta: CtaBlock;
  seo: Seo;
};

/** One platform capability: /platform/[slug]. */
export type PlatformPage = {
  slug: string;
  nav: NavItem;
  summary: string;
  hero: HeroBlock;
  bullets: string[];
  cta: CtaBlock;
  seo: Seo;
};

/**
 * A plain data table — used for the Shield plan grid, which is a real price
 * list read from the backend's plan table.
 *
 * This replaces a Starter/Growth/Enterprise pricing model that belonged to a
 * B2B vendor. Ezymex does not publish retail spreads or commissions anywhere
 * in the backend, so there is nothing honest to put in a tiered pricing page;
 * the one real price list it has is this one.
 */
export type PlanTable = {
  columns: readonly string[];
  rows: readonly (readonly string[])[];
};

export type FaqItem = {
  q: string;
  a: string;
};

/**
 * Legal documents are a block union rather than flat paragraphs.
 *
 * A `callout` — "You may lose your invested capital" — has to stay visually
 * separated from the prose around it. Flattening these into `paragraphs[]`
 * buries the warnings in body text, which is the one thing a risk disclosure
 * must not do.
 */
export type LegalBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "callout"; title: string; text: string }
  | {
      kind: "contact";
      team: string;
      email: string;
      phone: string;
      address: string;
    };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDoc = {
  slug: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};
