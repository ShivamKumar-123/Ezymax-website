// Server-only helpers for talking to the Kalks gateway (services/gateway), staff side.
// Staff sessions use their own cookie names, separate from Client Area sessions.

import { requestHost } from "@/lib/tenant-host";

export const STAFF_COOKIE = "kalks_staff";
export const STAFF_DEVICE_COOKIE = "kalks_staff_did";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://127.0.0.1:8080";
const INTERNAL_TOKEN = process.env.GATEWAY_INTERNAL_TOKEN ?? "";

export type GatewayStaff = {
  id: number;
  email: string;
  name: string;
  /** Built-in role name the downstream services check (`x-kalks-staff-role`); for custom roles the smallest
   *  built-in role that covers their service permissions (services/gateway/src/rbac.rs `service_role`). */
  role: string;
  /** The staff member's actual role: a built-in key (`dealer`) or a custom role key (`c-kyc-desk-x1`). */
  role_key?: string;
  role_id?: number | null;
  role_label: string;
  /** Every Back Office permission of the role, e.g. "clients.read", "dealing.write" (services/gateway/src/rbac.rs). */
  permissions?: string[];
  /** True when `permissions` is the gateway's authoritative list: local role maps (lib/*-perms.ts) are ignored. */
  rbac?: boolean;
  /** Platform Owner (holds owner.* permissions). */
  is_owner?: boolean;
  tenant: { id?: number; slug: string; name: string };
};

/** Whether a staff member holds a permission. The gateway's list is authoritative when `rbac` is set; `fallback`
 *  (a local role map) is consulted only for older gateways that returned no keys for the module. */
export function staffCan(staff: { role: string; permissions?: string[]; rbac?: boolean }, perm: string, fallback?: () => boolean): boolean {
  if (staff.rbac || !fallback) return staff.permissions?.includes(perm) ?? false;
  return fallback();
}

/** Demo builds (NEXT_PUBLIC_KALKS_MODE=demo) skip staff sign-in and browse the mock showcase as this staff member. */
export const DEMO_STAFF: GatewayStaff = {
  id: 0,
  email: "demo@kalkstrade.com",
  name: "Demo Admin",
  role: "platform_owner",
  role_label: "Platform Owner",
  permissions: [],
  tenant: { slug: "kalks", name: "Kalks Markets" },
};

type Forward = { ip?: string | null; userAgent?: string | null; device?: string | null; token?: string | null; host?: string | null };

export async function gateway<T = Record<string, unknown>>(path: string, init: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } & Forward = {}): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { "x-kalks-internal": INTERNAL_TOKEN, "x-kalks-tenant": "kalks" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.ip) headers["x-forwarded-for"] = init.ip;
  if (init.userAgent) headers["user-agent"] = init.userAgent;
  if (init.device) headers["x-kalks-device"] = init.device;
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  // the broker (tenant) is resolved by the gateway from the visitor's host (tenant_domains)
  const host = init.host ?? (await requestHost());
  if (host) headers["x-kalks-host"] = host;
  try {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    return { status: res.status, data: (await res.json().catch(() => ({}))) as T };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "Sign-in service is unavailable. Please try again shortly." } } as T };
  }
}

export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
}

export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/api/")) return fallback;
  return next;
}

export async function fetchStaff(token: string, h: Headers): Promise<GatewayStaff | null | "unavailable"> {
  const r = await gateway<{ staff?: GatewayStaff }>("/v1/admin/auth/me", { token, ip: clientIp(h), userAgent: h.get("user-agent") });
  if (r.status === 200 && r.data.staff) return r.data.staff;
  // 401: no live session; 403: the session is blocked (IP allow-list, suspended tenant) and must sign in again
  if (r.status === 401 || r.status === 403) return null;
  return "unavailable";
}
