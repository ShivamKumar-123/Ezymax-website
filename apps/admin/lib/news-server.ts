// Server-only client for services/news (127.0.0.1:8103). The browser never sees the service or its token.
// Permissions: content.read / content.write (lib/academy.ts `contentAllows`, the same map as the Academy CMS).

import type { GatewayStaff } from "@/lib/gateway";

const NEWS_URL = (process.env.NEWS_URL ?? "http://127.0.0.1:8103").replace(/\/+$/, "");
const NEWS_TOKEN = process.env.NEWS_INTERNAL_TOKEN ?? "";

export async function newsAdmin(path: string, init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; staff: GatewayStaff; timeoutMs?: number }): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    "x-ezymex-internal": NEWS_TOKEN,
    "x-ezymex-tenant": init.staff.tenant?.slug || "ezymex",
    "x-ezymex-staff": init.staff.email,
  };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${NEWS_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The news service is unavailable. Please try again shortly." } } };
  }
}
