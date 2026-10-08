import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@ezymex/ui", "@ezymex/mock", "@ezymex/i18n"],
  devIndicators: false,
  // development only: broker domains resolved from the Host (tenant_domains) can be tried locally on
  // *.test / *.localhost hosts (plus EZYMEX_DEV_ORIGINS, comma-separated) without Next blocking its dev assets
  allowedDevOrigins: ["*.localhost", "*.*.localhost", "*.test", "*.*.test", ...(process.env.EZYMEX_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [])],
  agentRules: false,
  images: { unoptimized: true },
  // Static images (public/assets: logos, coins, flags, photos) have no content hash: a day fresh, then served from
  // cache while revalidating for a week, instead of a revalidation round trip on every page load (max-age=0).
  async headers() {
    return [{ source: "/assets/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] }];
  },
};

export default config;
