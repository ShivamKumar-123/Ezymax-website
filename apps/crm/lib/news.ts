// Server-only helper for the news + economic calendar service (services/news, 127.0.0.1:8103).
// The browser never sees the service or NEWS_INTERNAL_TOKEN: /api/news/* forwards the tenant (and, for the
// client's own reminders, the gateway user id resolved from the session cookie).

import type { GatewayUser } from "@/lib/gateway";

const NEWS_URL = (process.env.NEWS_URL ?? "http://127.0.0.1:8103").replace(/\/+$/, "");
const NEWS_TOKEN = process.env.NEWS_INTERNAL_TOKEN ?? "";

export type NewsResult = { status: number; data: unknown };

export async function newsService(path: string, init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; user?: GatewayUser | null; tenant?: string } = {}): Promise<NewsResult> {
  const headers: Record<string, string> = { "x-kalks-internal": NEWS_TOKEN, "x-kalks-tenant": init.user?.tenant?.slug || init.tenant || "kalks" };
  if (init.user) headers["x-kalks-user-id"] = String(init.user.id);
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${NEWS_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "News is unavailable right now. Please try again shortly." } } };
  }
}
