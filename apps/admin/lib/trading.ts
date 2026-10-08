// Server-only client for the trading engine (services/trading, 127.0.0.1:8090).
// TRADING_INTERNAL_TOKEN never leaves the server. The staff identity headers are built here from the staff
// session the gateway verified (lib/bff.ts requireStaff) — never from anything the browser sends.

import type { GatewayStaff } from "@/lib/gateway";

const TRADING_URL = (process.env.TRADING_URL ?? "http://127.0.0.1:8090").replace(/\/$/, "");
const INTERNAL_TOKEN = process.env.TRADING_INTERNAL_TOKEN ?? "";

/** Browser URL of the dealing stream. Unset: `wss://<admin host>/engine/stream` (Caddy → engine). */
export const TRADING_STREAM_URL = process.env.TRADING_STREAM_URL ?? "";

export const tradingConfigured = () => INTERNAL_TOKEN.length > 0;

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function engine<T = unknown>(
  path: string,
  init: { method?: Method; body?: unknown; staff?: GatewayStaff; userId?: string | number; ip?: string | null; userAgent?: string | null; timeoutMs?: number } = {},
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { "x-ezymex-internal": INTERNAL_TOKEN, "x-ezymex-tenant": init.staff?.tenant.slug || "ezymex" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.staff) {
    headers["x-ezymex-staff-id"] = String(init.staff.id);
    headers["x-ezymex-staff-name"] = encodeURIComponent(init.staff.name || init.staff.email);
    headers["x-ezymex-staff-role"] = init.staff.role;
  }
  if (init.userId !== undefined) headers["x-ezymex-user-id"] = String(init.userId);
  if (init.ip) headers["x-forwarded-for"] = init.ip;
  if (init.userAgent) headers["user-agent"] = init.userAgent;
  try {
    const res = await fetch(`${TRADING_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: { code: "bad_gateway", message: "The trading engine returned an unexpected response." } };
    }
    return { status: res.status, data: data as T };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The trading engine is unavailable. Please try again shortly." } } as T };
  }
}
