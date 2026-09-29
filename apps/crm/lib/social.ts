// Server-only helper for the engine's social API (copy trading and PAMM, services/trading README "Copy trading and PAMM").
// Same transport as lib/trading.ts `engine()`, plus PATCH and the X-Kalks-Kyc header the engine needs for the master
// requirements (D68). The KYC status comes from the gateway profile resolved from the session cookie, never from the browser.

import type { NextRequest } from "next/server";
import { clientIp, type GatewayUser } from "@/lib/gateway";
import type { EngineResult } from "@/lib/trading";

const TRADING_URL = process.env.TRADING_URL ?? "http://127.0.0.1:8090";
const TRADING_TOKEN = process.env.TRADING_INTERNAL_TOKEN ?? "";

export async function socialEngine<T = Record<string, unknown>>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown; user: GatewayUser; req: NextRequest },
): Promise<EngineResult<T>> {
  const headers: Record<string, string> = {
    "x-kalks-internal": TRADING_TOKEN,
    "x-kalks-tenant": init.user.tenant?.slug || "kalks",
    "x-kalks-user-id": String(init.user.id),
    "x-kalks-kyc": init.user.kyc_status || "unverified",
    "x-forwarded-for": clientIp(init.req.headers),
  };
  const ua = init.req.headers.get("user-agent");
  if (ua) headers["user-agent"] = ua;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${TRADING_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "Copy trading is unavailable right now. Please try again shortly." } } as T };
  }
}
