// Server-only: the broker brand of the visitor's host (gateway /v1/public/tenant-config → `branding`; the
// gateway resolves the tenant from tenant_domains). Cached briefly per host per server process.

import type { TenantBrand } from "@kalks/ui";
import { gateway } from "@/lib/gateway";
import { requestHost } from "@/lib/tenant-host";

const TTL_MS = 30_000;
const MAX_HOSTS = 500;
const cache = new Map<string, { at: number; brand: TenantBrand | null }>();

/** Null when the gateway is unreachable: the app then shows the stock Kalks look. */
export async function tenantBrand(host?: string): Promise<TenantBrand | null> {
  const key = host ?? (await requestHost()) ?? "";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.brand;
  const r = await gateway<{ branding?: TenantBrand }>("/v1/public/tenant-config", { host: key || null });
  const brand = r.status === 200 && r.data?.branding?.slug ? r.data.branding : (hit?.brand ?? null);
  if (cache.size >= MAX_HOSTS) cache.clear();
  cache.set(key, { at: Date.now(), brand });
  return brand;
}
