import type { Feature } from "./schema";

export const partnersPage = {
  eyebrow: "Partners",
  headline: "Partner With SetupZero",
  highlight: "Partner",
  sub: "Earn by referring brokers and prop firms, or integrate your service with our platform.",
  typesHeading: "Partner programs",
  types: [
    {
      title: "Referral partners",
      body: "Earn commission for every client you introduce.",
      icon: "handshake",
    },
    {
      title: "Technology partners",
      body: "Liquidity, payment, KYC and data providers integrating with SetupZero.",
      icon: "plug",
    },
    {
      title: "Reseller partners",
      body: "Offer SetupZero solutions under your own business in your region.",
      icon: "globe",
    },
  ] as Feature[],
  formHeading: "Become a Partner",
  formSub: "Tell us about your business and which program fits.",
};
