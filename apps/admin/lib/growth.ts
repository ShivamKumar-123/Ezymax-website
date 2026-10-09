// Server-only client for the growth service (services/growth, 127.0.0.1:8101): bonuses, promo codes, banners,
// contests, loyalty, cashback and the promotions cost report. GROWTH_INTERNAL_TOKEN never leaves the server.
// The staff identity headers are built here from the staff session the gateway verified (lib/bff.ts requireStaff),
// never from anything the browser sends.

import type { GatewayStaff } from "@/lib/gateway";
import { MARKETING_PERMS, marketingAllow } from "@/lib/marketing-perms";

const GROWTH_URL = (process.env.GROWTH_URL ?? "http://127.0.0.1:8101").replace(/\/+$/, "");
const GROWTH_TOKEN = process.env.GROWTH_INTERNAL_TOKEN ?? "";

export const growthConfigured = () => GROWTH_TOKEN.length > 0 || process.env.NODE_ENV !== "production";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function growth<T = unknown>(
  path: string,
  init: { method?: Method; body?: unknown; raw?: ArrayBuffer; binary?: boolean; staff: GatewayStaff; timeoutMs?: number },
): Promise<{ status: number; data: T; headers?: Headers; bytes?: ArrayBuffer }> {
  const headers: Record<string, string> = {
    "x-ezymex-internal": GROWTH_TOKEN,
    "x-ezymex-tenant": init.staff.tenant?.slug || "ezymex",
    "x-ezymex-staff-id": String(init.staff.id),
    "x-ezymex-staff-name": encodeURIComponent(init.staff.name || init.staff.email),
    "x-ezymex-staff-role": init.staff.role,
    // the marketing permissions the BFF resolved (gateway RBAC, custom roles included); the service honours them
    "x-ezymex-staff-perms": MARKETING_PERMS.filter((p) => marketingAllow(init.staff, p)).join(",") || "none",
  };
  let body: BodyInit | undefined;
  if (init.raw !== undefined) {
    // an image upload: the service sniffs the type from the bytes
    headers["content-type"] = "application/octet-stream";
    body = init.raw;
  } else if (init.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  try {
    const res = await fetch(`${GROWTH_URL}${path}`, {
      method: init.method ?? (body !== undefined ? "POST" : "GET"),
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    });
    if (init.binary && res.ok) return { status: res.status, data: {} as T, headers: res.headers, bytes: await res.arrayBuffer() };
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
