// Server-only: the broker's runtime config from the gateway (/v1/public/tenant-config): maintenance mode,
// modules (D112), feature flags (D146) and branding (D1). The broker is the one of the visitor's host
// (tenant_domains, resolved by the gateway). Cached for a few seconds per host per server process so the
// proxy can check it on every request; the Platform Owner's switches take effect within that window.

import type { TenantBrand } from "@ezymex/ui";
import { gateway } from "@/lib/gateway";
import { requestHost } from "@/lib/tenant-host";

export type TenantConfig = {
  tenant: { slug: string; name: string; status: string; brand: Record<string, string> };
  maintenance: { enabled: boolean; active: boolean; message: string; until: string | null; since: string | null };
  modules: Record<string, boolean>;
  flags: Record<string, boolean>;
  branding?: TenantBrand;
  resolved_by?: "host" | "header" | "default";
};

const TTL_MS = 5_000;
const MAX_HOSTS = 500;
const cache = new Map<string, { at: number; cfg: TenantConfig | null }>();
/** Refreshes in flight per host: the proxy, metadata and layouts of one page load share one gateway call. */
const inflight = new Map<string, Promise<TenantConfig | null>>();

/** Null when the gateway is unreachable (the Client Area then behaves as if everything is on).
 *  `host`: the visitor's host (the proxy passes it; elsewhere it's read from the request). */
export async function tenantConfig(host?: string): Promise<TenantConfig | null> {
  const key = host ?? (await requestHost()) ?? "";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.cfg;
  const pending = inflight.get(key);
  if (pending) return pending;
  const load = (async () => {
    const r = await gateway<TenantConfig>("/v1/public/tenant-config", { host: key || null });
    const cfg = r.status === 200 && r.data?.maintenance ? r.data : null;
    if (cache.size >= MAX_HOSTS) cache.clear();
    cache.set(key, { at: Date.now(), cfg: cfg ?? hit?.cfg ?? null });
    return cache.get(key)!.cfg;
  })().finally(() => inflight.delete(key));
  inflight.set(key, load);
  return load;
}

/** The broker brand of the current request (null: gateway unreachable → the stock Ezymex look). */
export async function tenantBrand(host?: string): Promise<TenantBrand | null> {
  return (await tenantConfig(host))?.branding ?? null;
}

/**
 * Which module a Client Area page or BFF path belongs to (longest prefix wins). A path shared by two modules
 * ("algo|api") stays open while either of them is on.
 */
const MODULE_PATHS: [string, string][] = [
  ["/social/pamm", "pamm"],
  ["/social/investments", "pamm"],
  ["/api/social/funds", "pamm"],
  // PAMM investments and their invest / redeem requests (cancel) belong to PAMM, not copy trading
  ["/api/social/investments", "pamm"],
  ["/api/social/requests", "pamm"],
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
  // the kill switch stops running strategies: it follows Algo, where its page lives
  ["/api/algo/controls", "algo"],
  // the strategy catalogue and the account picker serve the strategy builder and AI Trader (Algo) as well as API keys
  // and webhooks (API)
  ["/api/algo/meta", "algo|api"],
  ["/api/algo/accounts", "algo|api"],
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

/** True when the broker switched off the module(s) a page or BFF path belongs to (every one of them, when shared). */
export function moduleOff(modules: Record<string, boolean>, pathname: string): boolean {
  const mod = moduleFor(pathname);
  return !!mod && mod.split("|").every((m) => modules[m] === false);
}
