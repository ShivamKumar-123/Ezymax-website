// Server-only client for the Ezymex FX Options service (services/options, 127.0.0.1:8104).
// OPTIONS_INTERNAL_TOKEN never leaves the server. The staff identity (`X-Ezymex-Staff`, recorded as the actor in the
// options audit log) is built here from the staff session the gateway verified (lib/bff.ts requireStaff), never from
// anything the browser sends.

import type { GatewayStaff } from "@/lib/gateway";

const OPTIONS_URL = (process.env.OPTIONS_URL ?? "http://127.0.0.1:8104").replace(/\/+$/, "");
const INTERNAL_TOKEN = process.env.OPTIONS_INTERNAL_TOKEN ?? "";

/** The service requires the token in production (OPTIONS_ENV=production); development runs without one. */
export const optionsConfigured = () => INTERNAL_TOKEN.length > 0 || process.env.NODE_ENV !== "production";

/** `X-Ezymex-Staff`: a printable-ASCII actor label (header values must be ASCII; the service keeps 120 chars). */
export function staffActor(staff: GatewayStaff): string {
  const who = (staff.email || staff.name || "staff").replace(/[^\x20-\x7e]/g, "?");
  return `${who} #${staff.id}`.slice(0, 120);
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

export async function optionsService<T = unknown>(
  path: string,
  init: { method?: Method; body?: unknown; staff: GatewayStaff; ip?: string | null; userAgent?: string | null; timeoutMs?: number },
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    "x-ezymex-tenant": init.staff.tenant?.slug || "ezymex",
    "x-ezymex-staff": staffActor(init.staff),
    "x-ezymex-staff-id": String(init.staff.id),
    "x-ezymex-staff-name": encodeURIComponent(init.staff.name || init.staff.email),
    "x-ezymex-staff-role": init.staff.role,
  };
  if (INTERNAL_TOKEN) headers["x-ezymex-internal"] = INTERNAL_TOKEN;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.ip) headers["x-forwarded-for"] = init.ip;
  if (init.userAgent) headers["user-agent"] = init.userAgent;
  try {
    const res = await fetch(`${OPTIONS_URL}${path}`, {
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
      data = { error: { code: "bad_gateway", message: "The options service returned an unexpected response." } };
    }
    if (!res.ok && (data === null || typeof data !== "object")) data = { error: { code: res.status === 404 ? "not_found" : "unavailable", message: res.status === 404 ? "Not found." : "The options service is unavailable." } };
    return { status: res.status, data: data as T };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The options service is unavailable. Please try again shortly." } } as T };
  }
}
