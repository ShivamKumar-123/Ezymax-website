// Server-only client for the support + notifications service (services/support, 127.0.0.1:8100).
// SUPPORT_INTERNAL_TOKEN never leaves the server. Staff identity headers (and the support permissions the BFF
// resolved) are built from the staff session the gateway verified (lib/bff.ts requireStaff).

import type { GatewayStaff } from "@/lib/gateway";
import { supportPerms } from "@/lib/support-perms";

const SUPPORT_URL = (process.env.SUPPORT_URL ?? "http://127.0.0.1:8100").replace(/\/+$/, "");
const SUPPORT_TOKEN = process.env.SUPPORT_INTERNAL_TOKEN ?? "";

/** Browser URL of the realtime stream. Unset: `wss://<admin host>/support/stream` in production, the service in development. */
export const SUPPORT_STREAM_URL = process.env.SUPPORT_STREAM_URL ?? (process.env.NODE_ENV === "production" ? "" : `${SUPPORT_URL.replace(/^http/, "ws")}/v1/stream`);

export const supportConfigured = () => SUPPORT_TOKEN.length > 0 || process.env.NODE_ENV !== "production";

type Init = { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; raw?: { bytes: ArrayBuffer; name: string; type: string }; staff: GatewayStaff; binary?: boolean; timeoutMs?: number };

export async function support<T = unknown>(path: string, init: Init): Promise<{ status: number; data: T; headers?: Headers; bytes?: ArrayBuffer }> {
  const headers: Record<string, string> = {
    "x-ezymex-internal": SUPPORT_TOKEN,
    "x-ezymex-tenant": init.staff.tenant?.slug || "ezymex",
    "x-ezymex-staff-id": String(init.staff.id),
    "x-ezymex-staff-name": encodeURIComponent(init.staff.name || init.staff.email),
    "x-ezymex-staff-role": init.staff.role,
    "x-ezymex-staff-perms": supportPerms(init.staff).join(","),
  };
  let body: BodyInit | undefined;
  if (init.raw) {
    headers["content-type"] = init.raw.type || "application/octet-stream";
    headers["x-file-name"] = encodeURIComponent(init.raw.name);
    body = init.raw.bytes;
  } else if (init.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  try {
    const res = await fetch(`${SUPPORT_URL}${path}`, { method: init.method ?? (body !== undefined ? "POST" : "GET"), headers, body, cache: "no-store", signal: AbortSignal.timeout(init.timeoutMs ?? 30_000) });
    if (init.binary && res.ok) return { status: res.status, data: {} as T, headers: res.headers, bytes: await res.arrayBuffer() };
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: { code: "bad_gateway", message: "The support service returned an unexpected response." } };
    }
    return { status: res.status, data: data as T };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The support service is unavailable. Please try again shortly." } } as T };
  }
}
