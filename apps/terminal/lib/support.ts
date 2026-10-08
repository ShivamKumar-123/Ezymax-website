// Server-only helpers for the notifications service (services/support, 127.0.0.1:8100). The browser never
// sees the service or SUPPORT_INTERNAL_TOKEN: /api/notifications/* resolves the client from the terminal's
// own engine session (HttpOnly cookie) and forwards the account owner's gateway user id.
import type { NextRequest } from "next/server";
import { engine, readSessions, sessionFor, type EngineSession } from "@/lib/engine/server";

const SUPPORT_URL = (process.env.SUPPORT_URL ?? "http://127.0.0.1:8100").replace(/\/+$/, "");
const SUPPORT_TOKEN = process.env.SUPPORT_INTERNAL_TOKEN ?? "";

export type SupportResult<T = Record<string, unknown>> = { status: number; data: T };

export async function support<T = Record<string, unknown>>(path: string, init: { method?: "GET" | "POST"; body?: unknown; userId: number }): Promise<SupportResult<T>> {
  const headers: Record<string, string> = { "x-ezymex-internal": SUPPORT_TOKEN, "x-ezymex-tenant": "ezymex", "x-ezymex-user-id": String(init.userId) };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${SUPPORT_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "Notifications are unavailable right now." } } as T };
  }
}

/* ------------------------------------------------------------------ */
/* Who is asking: the owner of the account the terminal is acting on   */
/* ------------------------------------------------------------------ */

// engine session token -> account owner's gateway user id (a session never changes owner)
const owners = new Map<string, { uid: number; at: number }>();
const OWNER_TTL_MS = 10 * 60_000;

export type Owner = { ok: true; userId: number } | { ok: false; status: number; code: string; message: string };

/**
 * The gateway user id behind the acting login (`x-ezymex-login`, else the newest full-access session).
 * Investor (read-only) sessions get nothing: an investor password can be shared with third parties, and the
 * inbox holds the owner's personal wallet and account events.
 */
export async function ownerOf(req: NextRequest): Promise<Owner> {
  const list = readSessions(req);
  const acting: EngineSession | null = sessionFor(req, list) ?? (req.headers.get("x-ezymex-login") ? null : (list.find((s) => !s.r) ?? null));
  if (!acting) return { ok: false, status: 401, code: "no_session", message: "Log in to a trading account to see account notifications." };
  if (acting.r) return { ok: false, status: 403, code: "investor", message: "Account notifications are not available with the investor password." };
  const hit = owners.get(acting.t);
  if (hit && Date.now() - hit.at < OWNER_TTL_MS) return { ok: true, userId: hit.uid };
  const r = await engine<{ account?: { userId?: number }; readOnly?: boolean }>("/v1/terminal/state?historyLimit=0", { bearer: acting.t, req });
  if (r.status === 401 || r.status === 403 || r.status === 404) return { ok: false, status: 401, code: "session_expired", message: "Your trading session has expired. Log in again." };
  if (r.status !== 200) return { ok: false, status: 503, code: "unavailable", message: "The trade server is unavailable. Try again shortly." };
  if (r.data.readOnly) return { ok: false, status: 403, code: "investor", message: "Account notifications are not available with the investor password." };
  const uid = Number(r.data.account?.userId);
  if (!Number.isSafeInteger(uid) || uid <= 0) return { ok: false, status: 404, code: "no_owner", message: "This account has no client profile." };
  if (owners.size > 5000) owners.clear();
  owners.set(acting.t, { uid, at: Date.now() });
  return { ok: true, userId: uid };
}
