import type { NextConfig } from "next";

const TERMINAL_URL = process.env.NEXT_PUBLIC_TERMINAL_URL ?? "http://localhost:3002";

const config: NextConfig = {
  transpilePackages: ["@ezymex/ui", "@ezymex/mock", "@ezymex/i18n"],
  devIndicators: false,
  // development only: broker domains resolved from the Host (tenant_domains) can be tried locally on
  // *.test / *.localhost hosts (plus EZYMEX_DEV_ORIGINS, comma-separated) without Next blocking its dev assets
  allowedDevOrigins: ["*.localhost", "*.*.localhost", "*.test", "*.*.test", ...(process.env.EZYMEX_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [])],
  agentRules: false,
  images: { unoptimized: true },
  // Client router cache: pages here are client components whose server payload carries no user data, so a page
  // visited in the last minute opens without a server round trip (data still refetches on mount).
  experimental: { staleTimes: { dynamic: 60 } },
  // Trading lives in the separate Ezymex Trader app (trade.ezymex.com); query params are forwarded.
  async redirects() {
    return [{ source: "/trade", destination: `${TERMINAL_URL}/`, permanent: false }];
  },
  // Illustrations (public/illustrations, made by scripts/process-illustrations.mjs): every URL carries a content hash
  // (?v=, see Illustration in @ezymex/ui), so browsers and the CDN may keep a file for a year.
  async headers() {
    return [
      { source: "/illustrations/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // static images (public/assets) have no content hash: a day fresh, then served from cache while revalidating
      { source: "/assets/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
};

export default config;
