// Server-only: the broker's runtime config from the gateway (/v1/public/tenant-config): maintenance mode,
// modules (D112) and feature flags (D146). Cached for a few seconds per server process so the proxy can
// check it on every request; the Platform Owner's switches take effect within that window.

import { gateway } from "@/lib/gateway";

export type TenantConfig = {
  tenant: { slug: string; name: string; status: string; brand: Record<string, string> };
  maintenance: { enabled: boolean; active: boolean; message: string; until: string | null; since: string | null };
  modules: Record<string, boolean>;
  flags: Record<string, boolean>;
};

const TTL_MS = 5_000;
let cache: { at: number; cfg: TenantConfig | null } | null = null;

/** Null when the gateway is unreachable (the Client Area then behaves as if everything is on). */
export async function tenantConfig(): Promise<TenantConfig | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.cfg;
  const r = await gateway<TenantConfig>("/v1/public/tenant-config");
  const cfg = r.status === 200 && r.data?.maintenance ? r.data : null;
  cache = { at: Date.now(), cfg: cfg ?? cache?.cfg ?? null };
  return cache.cfg;
}

/** Which module a Client Area page or BFF path belongs to (longest prefix wins). */
const MODULE_PATHS: [string, string][] = [
  ["/social/pamm", "pamm"],
  ["/api/social/funds", "pamm"],
  ["/social", "copy_trading"],
  ["/api/social", "copy_trading"],
  ["/prop", "prop"],
  ["/api/prop", "prop"],
  ["/partner", "ib"],
  ["/api/partner", "ib"],
  ["/developer/strategies", "algo"],
  ["/developer/deployments", "algo"],
  ["/developer/backtests", "algo"],
  ["/developer/marketplace", "algo"],
  ["/api/algo/strategies", "algo"],
  ["/api/algo/deployments", "algo"],
  ["/api/algo/backtests", "algo"],
  ["/api/algo/market", "algo"],
  ["/api/algo/ai", "algo"],
  ["/api/algo/validate", "algo"],
  ["/developer", "api"],
  ["/api/algo", "api"],
  ["/academy", "academy"],
  ["/api/academy", "academy"],
  ["/wallet", "wallet"],
  ["/api/wallet", "wallet"],
  ["/rewards", "rewards"],
  // growth BFF: rewards features follow the module; banners and share cards stay on
  ...["rewards", "points", "redeem", "redemptions", "vouchers", "cashback", "promotions", "bonuses", "promo", "contests"].map((p): [string, string] => [`/api/growth/${p}`, "rewards"]),
];

export function moduleFor(pathname: string): string | null {
  const hit = MODULE_PATHS.filter(([p]) => pathname === p || pathname.startsWith(p + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : null;
}
