import type { Feature, Step } from "./schema";

export const liquidityPage = {
  eyebrow: "Liquidity Connectivity",
  headline: "Access Deep, Multi-Asset Liquidity",
  highlight: "Multi-Asset Liquidity",
  sub: "We connect your brokerage to regulated liquidity providers through our bridge and FIX technology, with full control over routing and markups.",
  assetClasses: ["Forex", "Metals", "Energies", "Indices", "Stocks", "Crypto"],
  howHeading: "How it works",
  steps: [
    { step: "01", title: "Assessment", body: "We assess your volumes, asset mix and execution model." },
    { step: "02", title: "Introduction", body: "We recommend suitable liquidity partners and introduce you." },
    { step: "03", title: "Connection", body: "We connect them to your platform through our bridge." },
    { step: "04", title: "Control", body: "You control routing, markups and A/B book rules from one panel." },
  ] as Step[],
  benefitsHeading: "Benefits",
  benefits: [
    { title: "Tight spreads", body: "Through multi-LP aggregation.", icon: "chartLine" },
    { title: "Low-latency execution", body: "From co-located servers.", icon: "zap" },
    { title: "Flexible execution", body: "A-book, B-book or hybrid.", icon: "route" },
    { title: "Transparent reporting", body: "Execution and slippage reports.", icon: "filetext" },
  ] as Feature[],
  disclaimerTitle: "Important",
  disclaimer:
    "SetupZero is a technology provider. Liquidity is supplied by third-party liquidity providers who hold their own licences. SetupZero does not act as a counterparty to trades.",
  cta: {
    heading: "Get liquidity pricing for your brokerage",
    sub: "Share your volumes and asset mix and we will come back with suitable partners and bridge pricing.",
    ctas: [
      { label: "Get Liquidity Pricing", action: "demo" as const },
      { label: "Liquidity Bridge Product", href: "/products/liquidity-bridge", variant: "outline" as const },
    ],
  },
};
