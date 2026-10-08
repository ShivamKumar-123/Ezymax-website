// Server-only: the browser host of the current request. The gateway resolves the broker (tenant) from it
// (tenant_domains; X-Ezymex-Host wins over X-Ezymex-Tenant, unknown hosts such as localhost fall back to Ezymex).
// Behind Caddy the Host header is the domain the visitor opened; Caddy only routes configured domains here.

import { headers } from "next/headers";

/** `App.Broker.com:443` → `app.broker.com:443`; undefined for anything that isn't a plain host[:port]. */
export function hostOf(h: Headers): string | undefined {
  const v = (h.get("host") ?? h.get("x-forwarded-host") ?? "").split(",")[0]!.trim().toLowerCase();
  return /^[a-z0-9.-]{1,253}(:\d{1,5})?$/.test(v) ? v : undefined;
}

/** Host of the request being handled (route handlers, server components); undefined outside a request. */
export async function requestHost(): Promise<string | undefined> {
  try {
    return hostOf(await headers());
  } catch {
    return undefined; // outside a request scope (build, proxy): the caller passes the host explicitly
  }
}
