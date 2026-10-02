// Server-only helpers for the Kalks FX Options service (services/options, 127.0.0.1:8104). The browser never sees
// OPTIONS_INTERNAL_TOKEN: app/api/options/* calls the service with it, plus the broker (`X-Kalks-Tenant`, from the
// visitor's host like the brand) and the acting account's kind (`X-Kalks-Account-Kind: live|demo`, from the
// terminal's own engine session) so the service applies the right module switch and the account group's pricing.
// Contract: services/options/README.md ("Client (BFFs)", "Public").
import type { NextRequest } from "next/server";
import { engine, readSessions, sessionFor, type EngineSession } from "@/lib/engine/server";
import { Memo, secretKey } from "@/lib/memo";
import { tenantBrand } from "@/lib/tenant-brand";
import { hostOf } from "@/lib/tenant-host";

export const OPTIONS_URL = (process.env.OPTIONS_URL ?? "http://127.0.0.1:8104").replace(/\/+$/, "");
const OPTIONS_TOKEN = process.env.OPTIONS_INTERNAL_TOKEN ?? "";

export type OptResult<T = Record<string, unknown>> = { status: number; data: T };

/** The broker of the visitor's host (gateway tenant_domains, as for the brand); Kalks when unknown. */
export async function tenantOf(req: NextRequest): Promise<string> {
  const b = await tenantBrand(hostOf(req.headers)).catch(() => null);
  const slug = b?.slug?.toLowerCase();
  return slug && /^[a-z0-9_-]{1,64}$/.test(slug) ? slug : "kalks";
}

export async function options<T = Record<string, unknown>>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; tenant: string; kind?: "live" | "demo" | null; internal?: boolean; timeoutMs?: number },
): Promise<OptResult<T>> {
  const headers: Record<string, string> = { "x-kalks-tenant": init.tenant };
  if (init.internal !== false) headers["x-kalks-internal"] = OPTIONS_TOKEN;
  if (init.kind) headers["x-kalks-account-kind"] = init.kind;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${OPTIONS_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 8_000),
    });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: { code: res.status === 404 ? "not_found" : "options_error", message: text.slice(0, 200) || `Options service error ${res.status}` } };
    }
    if (res.status === 404 && !(data as { error?: unknown }).error) data = { error: { code: "not_found", message: "Not found." } };
    return { status: res.status, data: data as T };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "Options prices are unavailable right now. Please try again shortly." } } as T };
  }
}

/* ------------------------------------------------------------------ */
/* The acting account: kind (live/demo) + group, from the engine       */
/* ------------------------------------------------------------------ */

export interface ActingAccount {
  session: EngineSession;
  kind: "live" | "demo";
  group: string;
}

// a session never changes account kind; the group rarely changes (re-read every few minutes)
const accounts = new Memo<{ status: number; kind?: "live" | "demo"; group?: string }>(3 * 60_000, 5000);

export type Acting = { ok: true; account: ActingAccount } | { ok: false; status: number; code: string; message: string };

/** The account named in `x-kalks-login` (this browser's engine session cookie). */
export async function actingAccount(req: NextRequest): Promise<Acting> {
  const s = sessionFor(req, readSessions(req));
  if (!s) return { ok: false, status: 401, code: "unauthorized", message: "Log in to your trading account." };
  const key = await secretKey(s.t);
  const r = await accounts.get(
    key,
    async () => {
      const st = await engine<{ account?: { type?: string; group?: string } }>("/v1/terminal/state?historyLimit=0", { bearer: s.t, req });
      if (st.status !== 200) return { status: st.status };
      return { status: 200, kind: st.data.account?.type === "demo" ? "demo" : "live", group: String(st.data.account?.group ?? "") };
    },
    (v) => v.status === 200,
  );
  if (r.status === 401 || r.status === 403 || r.status === 404) return { ok: false, status: 401, code: "session_expired", message: "Your trading session has expired. Log in again." };
  if (r.status !== 200) return { ok: false, status: 503, code: "unavailable", message: "The trade server is unavailable. Try again shortly." };
  return { ok: true, account: { session: s, kind: r.kind!, group: r.group! } };
}

/** Public WebSocket URL of the options chain stream for this request's host. */
export function optionsStreamUrl(req: NextRequest): string {
  const env = process.env.OPTIONS_STREAM_URL;
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const hostname = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  // local dev: straight to the service (it checks only the one-time ticket; no ticket = guest view)
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return `${OPTIONS_URL.replace(/^http/, "ws")}/v1/options/stream`;
  // production: Caddy maps trade.<domain>/options/stream → options /v1/options/stream
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") !== "http";
  return `${secure ? "wss" : "ws"}://${host}/options/stream`;
}

/* ------------------------------------------------------------------ */
/* Public chain (guest view, SEO page)                                 */
/* ------------------------------------------------------------------ */

const publicReads = new Memo<OptResult>(1_000, 500);

/**
 * Public order-book market data (docs/OPTIONS-EXCHANGE.md §10, no login): `book/{series}` (depth, 10 levels),
 * `trades/{series}` (tape) and `stats/{u}` (OI / volume per strike), shared by every visitor for a second.
 */
export function publicBook(path: string): Promise<OptResult> {
  return publicReads.get(`book|${path}`, () => options(`/v1/public/options/${path}`, { tenant: "kalks", internal: false, timeoutMs: 5_000 }), (v) => v.status === 200 || v.status === 404);
}

/** `GET /v1/public/options/chain/{u}?expiry=` shared by every visitor for a second (the service caches 1 s too). */
export function publicChain(u: string, expiry?: string | null): Promise<OptResult> {
  const q = expiry ? `?expiry=${expiry}` : "";
  return publicReads.get(`${u}|${expiry ?? ""}`, () => options(`/v1/public/options/chain/${u}${q}`, { tenant: "kalks", internal: false, timeoutMs: 5_000 }), (v) => v.status === 200 || v.status === 404);
}
