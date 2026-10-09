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

/** Identity headers of a wallet call for the signed-in client (the user id itself goes into the path / query). */
function clientHeaders(user: GatewayUser, req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "x-ezymex-internal": WALLET_TOKEN,
    "x-ezymex-tenant": user.tenant?.slug || "ezymex",
    "x-ezymex-service": "crm",
    "x-forwarded-for": clientIp(req.headers),
  };
  const ua = req.headers.get("user-agent");
  if (ua) headers["user-agent"] = ua;
  return headers;
}

/** Uploads raw image bytes (manual-payment screenshots). The wallet sniffs the real type and enforces 5 MB. */
export async function walletUpload<T = Record<string, unknown>>(path: string, bytes: ArrayBuffer, init: { user: GatewayUser; req: NextRequest }): Promise<WalletResult<T>> {
  try {
    const res = await fetch(`${WALLET_URL}${path}`, {
      method: "POST",
      headers: { ...clientHeaders(init.user, init.req), "content-type": "application/octet-stream" },
      body: Buffer.from(bytes),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The wallet is unavailable. Please try again shortly." } } as T };
  }
}

/** Reads an image (QR codes, the client's own payment screenshots) as bytes, with the service's cache headers. */
export async function walletImage(path: string, init: { user: GatewayUser; req: NextRequest }): Promise<{ status: number; bytes?: ArrayBuffer; type: string; cache: string | null; etag: string | null }> {
  const headers = clientHeaders(init.user, init.req);
  const inm = init.req.headers.get("if-none-match");
  if (inm && inm.length <= 100) headers["if-none-match"] = inm;
  try {
    const res = await fetch(`${WALLET_URL}${path}`, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const type = res.headers.get("content-type") ?? "";
    const cache = res.headers.get("cache-control");
    const etag = res.headers.get("etag");
    if (res.status === 304) return { status: 304, type, cache, etag };
    if (res.status !== 200 || !/^image\/(png|jpeg|webp)$/.test(type)) return { status: res.status === 404 ? 404 : 503, type, cache: null, etag: null };
    return { status: 200, bytes: await res.arrayBuffer(), type, cache, etag };
  } catch {
    return { status: 503, type: "", cache: null, etag: null };
  }
}
