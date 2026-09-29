// Server-only helper for clients' price alerts, kept by market-data (services/market-data, src/alerts).
// The app never sees the service or MARKET_DATA_INTERNAL_TOKEN: /api/mobile/alerts/* resolves the signed-in client
// from the bearer session and forwards only the tenant and the gateway user id.

import { NextResponse, type NextRequest } from "next/server";
import { fetchMe, type GatewayUser } from "@/lib/gateway";
import { bearerOf } from "@/lib/mobile";

const MARKET_DATA_URL = (process.env.MARKET_DATA_URL ?? "http://127.0.0.1:8081").replace(/\/+$/, "");
const TOKEN = process.env.MARKET_DATA_INTERNAL_TOKEN ?? "";

export type AlertsResult = { status: number; data: Record<string, unknown> };

const UNAVAILABLE = { error: { code: "unavailable", message: "Price alerts are unavailable right now. Please try again shortly." } };

export async function alertsService(path: string, user: GatewayUser, init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<AlertsResult> {
  // not configured on this server: fail closed, never call the service without its token
  if (!TOKEN) return { status: 503, data: UNAVAILABLE };
  const headers: Record<string, string> = { "x-kalks-internal": TOKEN, "x-kalks-tenant": user.tenant?.slug || "kalks", "x-kalks-user-id": String(user.id) };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${MARKET_DATA_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    // the service's own 401 means our token is wrong: that is our fault, not the client's session
    if (res.status === 401) return { status: 503, data: UNAVAILABLE };
    return { status: res.status, data };
  } catch {
    return { status: 503, data: UNAVAILABLE };
  }
}

/* ---- input checks (the service validates again, against the market) ---- */

export const ALERT_CONDITIONS = ["above", "below", "change_up", "change_down"] as const;
const SYMBOL_RE = /^[A-Z0-9._]{2,20}$/;
const GROUP_RE = /^[a-z0-9_-]{1,32}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

type Obj = Record<string, unknown>;
export type AlertInput = { ok: true; body: Obj } | { ok: false; field: string; message: string };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

/**
 * The fields of a new alert (`create`) or a change (`!create`), copied one by one: anything else in the request
 * (a user id, a tenant, a status, a target) never reaches the service.
 */
export function alertInput(src: Obj, create: boolean): AlertInput {
  const out: Obj = {};
  const bad = (field: string, message: string): AlertInput => ({ ok: false, field, message });
  if (create || "symbol" in src) {
    if (!create) return bad("symbol", "The symbol of an alert can't be changed.");
    const s = typeof src.symbol === "string" ? src.symbol.trim().toUpperCase() : "";
    if (!SYMBOL_RE.test(s)) return bad("symbol", "Choose a symbol.");
    out.symbol = s;
  }
  if (create || src.condition !== undefined) {
    if (!ALERT_CONDITIONS.includes(src.condition as (typeof ALERT_CONDITIONS)[number])) return bad("condition", "Choose above, below, up by % or down by %.");
    out.condition = src.condition;
  }
  if (create || src.value !== undefined) {
    const v = num(src.value);
    if (v === undefined || v <= 0) return bad("value", "Enter a number above zero.");
    out.value = v;
  }
  if (src.basis !== undefined) {
    if (src.basis !== "bid" && src.basis !== "ask") return bad("basis", "Choose the bid or the ask.");
    out.basis = src.basis;
  }
  if (src.group !== undefined) {
    const g = typeof src.group === "string" ? src.group.trim().toLowerCase() : "";
    if (!GROUP_RE.test(g)) return bad("group", "Unknown account group.");
    out.group = g;
  }
  for (const k of ["repeat", "active"] as const) {
    if (src[k] === undefined) continue;
    if (typeof src[k] !== "boolean" || (k === "active" && create)) return bad(k, `Invalid ${k}.`);
    out[k] = src[k];
  }
  if (src.expiresAt !== undefined) {
    if (src.expiresAt !== null && (typeof src.expiresAt !== "string" || !ISO_RE.test(src.expiresAt))) return bad("expiresAt", "Choose when the alert expires.");
    out.expiresAt = src.expiresAt;
  }
  if (src.note !== undefined) {
    if (typeof src.note !== "string" || src.note.length > 500) return bad("note", "The note is too long.");
    out.note = src.note;
  }
  if (!create && !Object.keys(out).length) return bad("body", "Nothing to change.");
  return { ok: true, body: out };
}

/* ---- the signed-in client of a mobile alerts request ---- */

const NO_STORE = { "cache-control": "no-store" };

export function reply(status: number, data: unknown) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function alertsError(status: number, code: string, message: string, field?: string) {
  return reply(status, { error: field ? { code, message, field } : { code, message } });
}

/**
 * The client a request acts for (bearer session, resolved with the gateway like every mobile route). Price alerts
 * are personal: a view-only login never sees or changes the owner's alerts, and a read-only staff session only
 * reads them (the proxy refuses both before this runs; checked again here).
 */
export async function alertsClient(req: NextRequest, write: boolean): Promise<GatewayUser | NextResponse> {
  const token = bearerOf(req.headers);
  if (!token) return alertsError(401, "unauthorized", "Please sign in.");
  const me = await fetchMe(token, req.headers);
  if (me === "unavailable") return alertsError(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!me) return alertsError(401, "unauthorized", "Please sign in.");
  if (me.viewer) return write ? alertsError(403, "viewer_read_only", "This is a view-only login. Viewers can't make changes.") : alertsError(403, "viewer_scope", "This isn't shared with your view-only login.");
  if (write && token.startsWith("i.")) return alertsError(403, "staff_read_only", "This is a read-only staff session. Changes are not allowed.");
  return me;
}

/** The JSON object body of a write (415 / 400 otherwise). */
export async function alertsBody(req: NextRequest): Promise<Obj | NextResponse> {
  if (!req.headers.get("content-type")?.includes("application/json")) return alertsError(415, "bad_request", "Expected JSON.");
  const parsed = await req.json().catch(() => null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return alertsError(400, "bad_request", "Invalid request body.");
  return parsed as Obj;
}
