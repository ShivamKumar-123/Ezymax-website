/** Shared content types. All page content is data-driven from src/content/*.ts. */

/** Icon names are resolved through src/lib/icons.ts so content stays serializable. */
export type IconName = string;

export type ButtonVariant = "primary" | "outline" | "ghost" | "cream";

export type Cta = {
  label: string;
  /** Link target. Omit when `action` is set. */
  href?: string;
  /** "demo" opens the Book a Free Demo modal. */
  action?: "demo";
  variant?: ButtonVariant;
};

export type Feature = {
  title: string;
  body?: string;
  icon?: IconName;
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

export type SolutionPage = {
  slug: string;
  nav: NavItem;
  /** Short card copy used on the home page and the solutions index. */
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

export type ProductPage = {
  slug: string;
  nav: NavItem;
  summary: string;
  hero: HeroBlock;
  bullets: string[];
  cta: CtaBlock;
  seo: Seo;
};

export type PricingTierName = "Starter" | "Growth" | "Enterprise";

export type PricingTier = {
  name: PricingTierName;
  bestFor: string;
  setupFee: string;
  monthlyFee: string;
  cta: Cta;
  highlighted?: boolean;
};

export type PricingRow = {
  label: string;
  values: [string | boolean, string | boolean, string | boolean];
};

export type FaqItem = {
  q: string;
  a: string;
};

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
  placeholder?: boolean;
};

export type ArticleMeta = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  date: string;
  readingTime: string;
};

export type LegalDoc = {
  slug: string;
  title: string;
  updated: string;
  intro: string;
  sections: TextSection[];
};
