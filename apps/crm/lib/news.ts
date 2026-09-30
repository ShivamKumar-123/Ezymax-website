// Server-only helper for the news + economic calendar service (services/news, 127.0.0.1:8103).
// The browser never sees the service or NEWS_INTERNAL_TOKEN: /api/news/* forwards the tenant (and, for the
// client's own reminders, the gateway user id resolved from the session cookie).

import type { GatewayUser } from "@/lib/gateway";
import { Memo } from "@/lib/memo";

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

// Headlines, the map, the calendar and the brief depend on the broker only (the service reads the user id for
// reminders alone), so every client of a broker shares them for a short while instead of one call per poll.
const PUBLIC_TTL_MS = 30_000;
const publicReads = new Memo<NewsResult>(PUBLIC_TTL_MS, 2_000);

/** A public (non-personal) read, shared per broker for PUBLIC_TTL_MS; failures are never cached. */
export function publicNews(path: string, user?: GatewayUser | null): Promise<NewsResult> {
  const tenant = user?.tenant?.slug || "kalks";
  return publicReads.get(`${tenant}|${path}`, () => newsService(path, { user }), (r) => r.status === 200);
}
