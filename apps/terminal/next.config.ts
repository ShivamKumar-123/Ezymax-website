import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";

// TradingView Advanced Charts: licensed, copied into public/ by scripts/sync-assets.mjs when the package is present
// (never committed). The build records whether it is there; without it the terminal keeps its own chart.
const tvLibrary = existsSync(join(process.cwd(), "public", "charting_library", "charting_library.standalone.js"));

const config: NextConfig = {
  transpilePackages: ["@ezymex/ui", "@ezymex/mock", "@ezymex/i18n"],
  devIndicators: false,
  // development only: broker domains resolved from the Host (tenant_domains) can be tried locally on
  // *.test / *.localhost hosts (plus EZYMEX_DEV_ORIGINS, comma-separated) without Next blocking its dev assets
  allowedDevOrigins: ["*.localhost", "*.*.localhost", "*.test", "*.*.test", ...(process.env.EZYMEX_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [])],
  agentRules: false,
  images: { unoptimized: true },
  env: { EZYMEX_TV_LIBRARY: tvLibrary ? "1" : "" },
  // Static images (public/assets: logos, coins, flags, photos) have no content hash: a day fresh, then served from
  // cache while revalidating for a week, instead of a revalidation round trip on every page load (max-age=0).
  // The TradingView bundles carry a content hash in their names: cached for a year.
  // Chrome is switching the `unload` event off by default (a Permissions-Policy, rolled out gradually); the
  // TradingView library still listens to it, and every chart open then logs a "unload is not allowed in this
  // document" violation. The policy is turned back on for this origin, which is where the library's frame runs.
  async headers() {
    return [
      { source: "/:path*", headers: [{ key: "Permissions-Policy", value: "unload=(self)" }] },
      { source: "/assets/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
      { source: "/charting_library/bundles/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default config;
