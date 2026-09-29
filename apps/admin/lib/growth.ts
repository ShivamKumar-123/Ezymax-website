// Server-only client for the growth service (services/growth, 127.0.0.1:8101): bonuses, promo codes, banners,
// contests, loyalty, cashback and the promotions cost report. GROWTH_INTERNAL_TOKEN never leaves the server.
// The staff identity headers are built here from the staff session the gateway verified (lib/bff.ts requireStaff),
// never from anything the browser sends.

import type { GatewayStaff } from "@/lib/gateway";
import { MARKETING_PERMS, marketingAllow } from "@/lib/marketing-perms";

const GROWTH_URL = (process.env.GROWTH_URL ?? "http://127.0.0.1:8101").replace(/\/+$/, "");
const GROWTH_TOKEN = process.env.GROWTH_INTERNAL_TOKEN ?? "";

export const growthConfigured = () => GROWTH_TOKEN.length > 0 || process.env.NODE_ENV !== "production";

type Method = "GET" | "POST" | "PUT" | "PATCH";

export async function growth<T = unknown>(path: string, init: { method?: Method; body?: unknown; staff: GatewayStaff; timeoutMs?: number }): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    "x-kalks-internal": GROWTH_TOKEN,
    "x-kalks-tenant": init.staff.tenant?.slug || "kalks",
    "x-kalks-staff-id": String(init.staff.id),
    "x-kalks-staff-name": encodeURIComponent(init.staff.name || init.staff.email),
    "x-kalks-staff-role": init.staff.role,
    // the marketing permissions the BFF resolved (gateway RBAC, custom roles included); the service honours them
    "x-kalks-staff-perms": MARKETING_PERMS.filter((p) => marketingAllow(init.staff, p)).join(",") || "none",
  };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${GROWTH_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: { code: "bad_gateway", message: "The marketing service returned an unexpected response." } };
    }
    return { status: res.status, data: data as T };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The marketing service is unavailable. Please try again shortly." } } as T };
  }
}
