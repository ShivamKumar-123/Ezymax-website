// Server-only client for the staking service (services/staking, 127.0.0.1:8105): plans, monthly rates, settlements,
// positions and the staking audit log. STAKING_INTERNAL_TOKEN never leaves the server.
// The staff identity headers are built here from the staff session the gateway verified (lib/bff.ts requireStaff),
// never from anything the browser sends.

import type { GatewayStaff } from "@/lib/gateway";
import { STAKING_PERMS, stakingAllow } from "@/lib/staking-perms";

const STAKING_URL = (process.env.STAKING_URL ?? "http://127.0.0.1:8105").replace(/\/+$/, "");
const STAKING_TOKEN = process.env.STAKING_INTERNAL_TOKEN ?? "";

export const stakingConfigured = () => STAKING_TOKEN.length > 0 || process.env.NODE_ENV !== "production";

type Method = "GET" | "POST" | "PATCH";

export async function staking<T = unknown>(path: string, init: { method?: Method; body?: unknown; staff: GatewayStaff; timeoutMs?: number }): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    "x-ezymex-internal": STAKING_TOKEN,
    "x-ezymex-tenant": init.staff.tenant?.slug || "ezymex",
    "x-ezymex-staff-id": String(init.staff.id),
    "x-ezymex-staff-name": encodeURIComponent(init.staff.name || init.staff.email),
    "x-ezymex-staff-role": init.staff.role,
    // the staking permissions the BFF resolved (gateway RBAC, custom roles included); the service honours them
    "x-ezymex-staff-perms": STAKING_PERMS.filter((p) => stakingAllow(init.staff, p)).join(",") || "none",
  };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${STAKING_URL}${path}`, {
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
      data = { error: { code: "bad_gateway", message: "The staking service returned an unexpected response." } };
    }
    return { status: res.status, data: data as T };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The staking service is unavailable. Please try again shortly." } } as T };
  }
}
