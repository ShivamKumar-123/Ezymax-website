// Server-only client for the Ezymex wallet service (services/wallet, 127.0.0.1:8095).
// The browser never sees the service or WALLET_INTERNAL_TOKEN: route handlers under /api/wallet resolve the
// signed-in client from the gateway session cookie and pass that user id. Contract: services/wallet/README.md.

import type { NextRequest } from "next/server";
import { clientIp, type GatewayUser } from "@/lib/gateway";

const WALLET_URL = (process.env.WALLET_URL ?? "http://127.0.0.1:8095").replace(/\/+$/, "");
const WALLET_TOKEN = process.env.WALLET_INTERNAL_TOKEN ?? "";

export type WalletResult<T = Record<string, unknown>> = { status: number; data: T };

export async function wallet<T = Record<string, unknown>>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; user: GatewayUser; req: NextRequest },
): Promise<WalletResult<T>> {
  const headers: Record<string, string> = {
    "x-ezymex-internal": WALLET_TOKEN,
    "x-ezymex-tenant": init.user.tenant?.slug || "ezymex",
    "x-ezymex-service": "crm",
    "x-forwarded-for": clientIp(init.req.headers),
  };
  const ua = init.req.headers.get("user-agent");
  if (ua) headers["user-agent"] = ua;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${WALLET_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The wallet is unavailable. Please try again shortly." } } as T };
  }
}
