import type { PricingRow, PricingTier } from "./schema";

export const pricingPage = {
  eyebrow: "Pricing",
  headline: "Simple Packages. Serious Technology.",
  highlight: "Serious Technology.",
  sub: "Choose a package that fits your stage, or ask us for a custom quote.",
  note: "All packages include hosting, updates and onboarding. Need only one module, like CRM or the prop firm system? Contact us for standalone pricing.",
};

export const pricingTiers: PricingTier[] = [
  {
    name: "Starter",
    bestFor: "New brokers and IBs",
    setupFee: "Request a quote",
    monthlyFee: "Request a quote",
    cta: { label: "Get Started", action: "demo" },
  },
  {
    name: "Growth",
    bestFor: "Growing brokers and prop firms",
    setupFee: "Request a quote",
    monthlyFee: "Request a quote",
    cta: { label: "Get Started", action: "demo" },
    highlighted: true,
  },
  {
    name: "Enterprise",
    bestFor: "Established brokers and fintechs",
    setupFee: "Custom",
    monthlyFee: "Custom",
    cta: { label: "Talk to Sales", action: "demo" },
  },
];

export const pricingRows: PricingRow[] = [
  { label: "Trading platform (web + mobile)", values: [true, true, true] },
  { label: "Forex CRM + Trader's Room", values: [true, true, true] },
  { label: "IB & affiliate module", values: ["Basic", "Advanced", "Advanced"] },
  { label: "Liquidity bridge", values: ["Single LP", "Multi-LP", "Multi-LP + custom routing"] },
  { label: "Risk management tools", values: ["Basic", "Full", "Full + custom reports"] },
  { label: "Copy trading / PAMM / MAM", values: ["Add-on", "Included", "Included"] },
  { label: "Prop firm module", values: ["Add-on", "Add-on", "Included"] },
  { label: "Branded mobile apps", values: ["Add-on", "Included", "Included"] },
  { label: "Support", values: ["24/5 email & chat", "24/7 + account manager", "24/7 dedicated team"] },
];
