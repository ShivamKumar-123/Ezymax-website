// Server-only helpers for the ALGO service (services/algo, 127.0.0.1:8099): strategies, backtests, the 24/7
// runtime, webhooks, API keys and the marketplace. The browser never sees the service or its internal token:
// /api/algo/* resolves the signed-in client from the gateway session cookie and forwards the gateway user id.
// Contract: services/algo/README.md ("Internal API").

import type { NextRequest } from "next/server";
import { clientIp, type GatewayUser } from "@/lib/gateway";

const ALGO_URL = (process.env.ALGO_URL ?? "http://127.0.0.1:8099").replace(/\/+$/, "");
const ALGO_TOKEN = process.env.ALGO_INTERNAL_TOKEN ?? "";

export type AlgoMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export async function algo(path: string, init: { method: AlgoMethod; body?: unknown; user: GatewayUser; req: NextRequest; timeoutMs?: number }): Promise<{ status: number; data: unknown }> {
  const name = init.user.name || [init.user.first_name, init.user.last_name].filter(Boolean).join(" ") || `Trader ${init.user.id}`;
  const headers: Record<string, string> = {
    "x-kalks-internal": ALGO_TOKEN,
    "x-kalks-tenant": init.user.tenant?.slug || "kalks",
    "x-kalks-user-id": String(init.user.id),
    "x-kalks-user-name": encodeURIComponent(name),
    "x-forwarded-for": clientIp(init.req.headers),
  };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${ALGO_URL}${path}`, {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The strategy service is unavailable. Please try again shortly." } } };
  }
}
