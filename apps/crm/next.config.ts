import type { NextConfig } from "next";

const TERMINAL_URL = process.env.NEXT_PUBLIC_TERMINAL_URL ?? "http://localhost:3002";

const config: NextConfig = {
  transpilePackages: ["@kalks/ui", "@kalks/mock", "@kalks/i18n"],
  devIndicators: false,
  // development only: broker domains resolved from the Host (tenant_domains) can be tried locally on
  // *.test / *.localhost hosts (plus KALKS_DEV_ORIGINS, comma-separated) without Next blocking its dev assets
  allowedDevOrigins: ["*.localhost", "*.*.localhost", "*.test", "*.*.test", ...(process.env.KALKS_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [])],
  agentRules: false,
  images: { unoptimized: true },
  // Trading lives in the separate Kalks Trader app (trade.kalks.com); query params are forwarded.
  async redirects() {
    return [{ source: "/trade", destination: `${TERMINAL_URL}/`, permanent: false }];
  },
};

export default config;
