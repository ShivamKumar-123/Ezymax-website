// Server-only: the broker config of the visitor's host (gateway /v1/public/tenant-config; the gateway resolves the
// tenant from tenant_domains): its brand (`branding`) and the product modules and feature flags it switched (`modules`,
// `flags`; lib/modules.ts). One gateway call per host serves both, cached briefly per server process.

import { IS_DEMO } from "@ezymex/mock/mode";
import type { TenantBrand } from "@ezymex/ui";
import { gateway } from "@/lib/gateway";
import { modulesOn, type Features } from "@/lib/modules";
import { hostOf, requestHost } from "@/lib/tenant-host";

type TenantConfig = { brand: TenantBrand | null; features: Features | null };

const TTL_MS = 30_000;
const MAX_HOSTS = 500;
const cache = new Map<string, { at: number; cfg: TenantConfig }>();
/** Refreshes in flight per host: metadata and the layout of one render share one gateway call. */
const inflight = new Map<string, Promise<TenantConfig>>();

async function tenantConfig(host?: string): Promise<TenantConfig> {
  const key = host ?? (await requestHost()) ?? "";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.cfg;
  const pending = inflight.get(key);
  if (pending) return pending;
  const load = (async () => {
    const r = await gateway<{ branding?: TenantBrand; modules?: Features["modules"]; flags?: Features["flags"] }>("/v1/public/tenant-config", { host: key || null });
    const ok = r.status === 200;
    // a failed refresh keeps the last good answer
    const cfg: TenantConfig = {
      brand: ok && r.data?.branding?.slug ? r.data.branding : (hit?.cfg.brand ?? null),
      features: ok && r.data?.modules && typeof r.data.modules === "object" ? { modules: r.data.modules, flags: r.data.flags ?? {} } : (hit?.cfg.features ?? null),
    };
    if (cache.size >= MAX_HOSTS) cache.clear();
    cache.set(key, { at: Date.now(), cfg });
    return cfg;
  })().finally(() => inflight.delete(key));
  inflight.set(key, load);
  return load;
}

/** Null when the gateway is unreachable: the app then shows the stock Ezymex look. */
export async function tenantBrand(host?: string): Promise<TenantBrand | null> {
  return (await tenantConfig(host)).brand;
}

/** The broker's module switches and flags. Null (everything on) when the gateway is unreachable, and in demo builds,
 *  which have no gateway of their own. */
export async function tenantFeatures(host?: string): Promise<Features | null> {
  return IS_DEMO ? null : (await tenantConfig(host)).features;
}

/** Route handlers: whether the broker of the request's host has what `expr` needs switched on. */
export async function moduleOn(req: { headers: Headers }, expr: string): Promise<boolean> {
  return modulesOn((await tenantFeatures(hostOf(req.headers)))?.modules, expr);
}

/** Route handlers: a feature flag of the broker of the request's host (false only when switched off). */
export async function flagOn(req: { headers: Headers }, key: string): Promise<boolean> {
  return (await tenantFeatures(hostOf(req.headers)))?.flags[key] !== false;
}
