// Server-only client for the wallet service (services/wallet, 127.0.0.1:8095).
// WALLET_INTERNAL_TOKEN never leaves the server. The staff identity headers are built here from the staff
// session the gateway verified (lib/bff.ts requireStaff), never from anything the browser sends.

import type { GatewayStaff } from "@/lib/gateway";

const WALLET_URL = (process.env.WALLET_URL ?? "http://127.0.0.1:8095").replace(/\/$/, "");
const INTERNAL_TOKEN = process.env.WALLET_INTERNAL_TOKEN ?? "";

export const walletConfigured = () => INTERNAL_TOKEN.length > 0;

type Method = "GET" | "POST" | "PUT";

export async function walletService<T = unknown>(
  path: string,
  init: { method?: Method; body?: unknown; staff: GatewayStaff; ip?: string | null; userAgent?: string | null; timeoutMs?: number },
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    "x-kalks-internal": INTERNAL_TOKEN,
    "x-kalks-tenant": init.staff.tenant.slug || "kalks",
    "x-kalks-service": "admin",
    "x-kalks-staff-id": String(init.staff.id),
    "x-kalks-staff-name": encodeURIComponent(init.staff.name || init.staff.email),
    "x-kalks-staff-role": init.staff.role,
  };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.ip) headers["x-forwarded-for"] = init.ip;
  if (init.userAgent) headers["user-agent"] = init.userAgent;
  try {
    const res = await fetch(`${WALLET_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: { code: "bad_gateway", message: "The wallet service returned an unexpected response." } };
    }
    return { status: res.status, data: data as T };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The wallet service is unavailable. Please try again shortly." } } as T };
  }
}
