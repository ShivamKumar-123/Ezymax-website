/**
 * Site-wide configuration — the single source of truth for SEO.
 *
 * Consumed by the metadata generator, `robots.ts`, `sitemap.ts`, and the
 * JSON-LD structured-data helper. Update the placeholder values per project.
 */
import { publicEnv } from "@/env";

export const siteConfig = {
  name: "FX Artha",
  description:
    "A protocol-driven trading ecosystem with automated settlement. Trade CFDs while your funds stay in a smart contract you control — only open-trade margin is locked, the rest stays withdrawable.",
  /**
   * Public origin, no trailing slash. Drives canonical URLs, OG tags, the
   * sitemap, and JSON-LD. Set `NEXT_PUBLIC_SITE_URL` in production.
   */
  url: publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Default Open Graph / Twitter share image (path under `public/`). */
  ogImage: "/open-graph.png",
  twitterHandle: "@fxartha",
  author: "FXArtha Ltd.",
  /** Browser theme-color (address bar / PWA). */
  themeColor: "#0a0a0a",
} as const;

const tradeUrl = publicEnv.NEXT_PUBLIC_TRADE_URL ?? "http://localhost:3001";

/**
 * The trader platform this landing site funnels into (the fxartha monorepo's
 * `frontend/trader` app). Set `NEXT_PUBLIC_TRADE_URL` in production.
 */
export const tradeConfig = {
  url: tradeUrl,
  login: `${tradeUrl}/auth/login`,
  register: `${tradeUrl}/auth/register`,
} as const;
