// Server-only helpers for the Kalks gateway (services/gateway). The browser never talks to the gateway:
// route handlers under /api/shares and the public share page call it with the internal token.
import { NextResponse, type NextRequest } from "next/server";
import { requestHost } from "@/lib/tenant-host";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://127.0.0.1:8080";
const INTERNAL_TOKEN = process.env.GATEWAY_INTERNAL_TOKEN ?? "";

export type GatewayResult<T = Record<string, unknown>> = { status: number; data: T };

export async function gateway<T = Record<string, unknown>>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown; ip?: string | null; userAgent?: string | null; shareKey?: string | null; host?: string | null } = {},
): Promise<GatewayResult<T>> {
  const headers: Record<string, string> = { "x-kalks-internal": INTERNAL_TOKEN, "x-kalks-tenant": "kalks" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.ip) headers["x-forwarded-for"] = init.ip;
  if (init.userAgent) headers["user-agent"] = init.userAgent.slice(0, 400);
  if (init.shareKey) headers["x-share-key"] = init.shareKey;
  // the broker (tenant) is resolved by the gateway from the visitor's host (tenant_domains)
  const host = init.host ?? (await requestHost());
  if (host) headers["x-kalks-host"] = host;
  try {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "Sharing is unavailable right now. Try again shortly." } } as T };
  }
}

/** Client IP as seen by this app (first X-Forwarded-For hop, else loopback in dev). */
export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
}

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

/** CSRF guard for state-changing calls: same-origin JSON only. */
export function guard(req: NextRequest, needsBody = true): NextResponse | null {
  const origin = req.headers.get("origin");
  let same = false;
  if (!origin) same = req.headers.get("sec-fetch-site") === "same-origin";
  else {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    try {
      same = new URL(origin).host === host;
    } catch {
      same = false;
    }
  }
  if (!same) return jsonError(403, "forbidden", "Cross-site request blocked.");
  if (needsBody && !req.headers.get("content-type")?.includes("application/json")) return jsonError(415, "bad_request", "Expected JSON.");
  return null;
}

export function relay(r: GatewayResult) {
  return NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
}

export const CODE_RE = /^[0-9A-Za-z]{12}$/;

/** Public share payload, as returned by GET /v1/public/shares/:code. */
export async function fetchPublicShare(code: string, opts: { view?: boolean; ip?: string | null; userAgent?: string | null } = {}) {
  if (!CODE_RE.test(code)) return { status: 404, data: null };
  const r = await gateway<Record<string, unknown>>(`/v1/public/shares/${code}${opts.view ? "?view=1" : ""}`, { ip: opts.ip, userAgent: opts.userAgent });
  return { status: r.status, data: r.status === 200 ? r.data : null };
}
