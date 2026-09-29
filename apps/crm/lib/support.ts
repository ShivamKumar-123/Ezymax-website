// Server-only helpers for the support + notifications service (services/support, 127.0.0.1:8100).
// The browser never sees the service or SUPPORT_INTERNAL_TOKEN: /api/support/* and /api/notifications/*
// resolve the signed-in client from the gateway session cookie and forward the gateway user id, name and
// email as X-Kalks-User-* headers. The realtime stream uses a one-time ticket (POST /api/support/stream-ticket).

import type { GatewayUser } from "@/lib/gateway";

const SUPPORT_URL = (process.env.SUPPORT_URL ?? "http://127.0.0.1:8100").replace(/\/+$/, "");
const SUPPORT_TOKEN = process.env.SUPPORT_INTERNAL_TOKEN ?? "";

/**
 * Browser URL of the realtime stream. Unset: `wss://<this host>/support/stream` in production (Caddy -> :8100)
 * and the service directly in development.
 */
export const SUPPORT_STREAM_URL = process.env.SUPPORT_STREAM_URL ?? (process.env.NODE_ENV === "production" ? "" : `${SUPPORT_URL.replace(/^http/, "ws")}/v1/stream`);

export type SupportResult<T = Record<string, unknown>> = { status: number; data: T; headers?: Headers; bytes?: ArrayBuffer };

type Init = { method?: "GET" | "POST" | "PUT"; body?: unknown; raw?: { bytes: ArrayBuffer; name: string; type: string }; user?: GatewayUser; binary?: boolean; timeoutMs?: number };

export async function support<T = Record<string, unknown>>(path: string, init: Init = {}): Promise<SupportResult<T>> {
  const headers: Record<string, string> = { "x-kalks-internal": SUPPORT_TOKEN, "x-kalks-tenant": init.user?.tenant?.slug || "kalks" };
  if (init.user) {
    headers["x-kalks-user-id"] = String(init.user.id);
    headers["x-kalks-user-name"] = encodeURIComponent(init.user.name || `${init.user.first_name} ${init.user.last_name}`.trim());
    headers["x-kalks-user-email"] = encodeURIComponent(init.user.email);
  }
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
    const res = await fetch(`${SUPPORT_URL}${path}`, {
      method: init.method ?? (body !== undefined ? "POST" : "GET"),
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    });
    if (init.binary && res.ok) return { status: res.status, data: {} as T, headers: res.headers, bytes: await res.arrayBuffer() };
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "Support is unavailable right now. Please try again shortly." } } as T };
  }
}
