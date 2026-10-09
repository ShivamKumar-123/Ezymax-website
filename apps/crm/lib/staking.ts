// Server-only client for the staking service (services/staking, 127.0.0.1:8105): plans, the client's positions,
// returns and history, and subscriptions. The browser never sees the service or its internal token: /api/staking/*
// resolves the signed-in client from the gateway session cookie and forwards the gateway user id and display name.
// Contract: services/staking/README.md.

import type { GatewayUser } from "@/lib/gateway";

const STAKING_URL = (process.env.STAKING_URL ?? "http://127.0.0.1:8105").replace(/\/+$/, "");
const STAKING_TOKEN = process.env.STAKING_INTERNAL_TOKEN ?? "";

export type StakingResult<T = Record<string, unknown>> = { status: number; data: T };

const UNAVAILABLE = { error: { code: "unavailable", message: "Staking is unavailable right now. Please try again shortly." } };

export async function staking<T = Record<string, unknown>>(path: string, init: { method?: "GET" | "POST"; body?: unknown; user: GatewayUser; timeoutMs?: number }): Promise<StakingResult<T>> {
  const headers: Record<string, string> = {
    "x-ezymex-internal": STAKING_TOKEN,
    "x-ezymex-tenant": init.user.tenant?.slug || "ezymex",
    "x-ezymex-user-id": String(init.user.id),
  };
  const name = `${init.user.first_name ?? ""} ${init.user.last_name ?? ""}`.trim();
  if (name) headers["x-ezymex-name"] = encodeURIComponent(name);
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${STAKING_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: UNAVAILABLE as T };
  }
}
