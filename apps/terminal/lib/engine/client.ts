// Browser side of the terminal BFF (/api/engine/*). Every call names the acting login; the BFF picks that
// login's session from the HttpOnly cookie. Errors come back as EngineErr, never thrown.
import type { EngineErr } from "./map";
import type { EngDeal, EngOrder, EngState, SessionInfo } from "./types";

export type Result<T> = { ok: true; data: T } | { ok: false; err: EngineErr };

async function call<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, opts: { login?: string; body?: unknown; timeoutMs?: number } = {}): Promise<Result<T>> {
  // rejections come back in the body (HTTP 200 + error.status): expected answers, not console errors
  const headers: Record<string, string> = { "x-kalks-errors": "body" };
  if (opts.login) headers["x-kalks-login"] = opts.login;
  if (method === "POST" || method === "PATCH") headers["content-type"] = "application/json";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(path, { method, headers, body: method === "POST" || method === "PATCH" ? JSON.stringify(opts.body ?? {}) : undefined, cache: "no-store", credentials: "same-origin", signal: ctrl.signal });
    const data = (await res.json().catch(() => ({}))) as T & { error?: Partial<EngineErr> };
    if (res.ok && !data.error) return { ok: true, data };
    const e = data.error ?? {};
    const status = typeof e.status === "number" ? e.status : res.status;
    return { ok: false, err: { ...e, status, code: e.code ?? (status >= 500 ? "unavailable" : "engine_error"), message: e.message ?? `HTTP ${status}` } as EngineErr };
  } catch (e) {
    const aborted = (e as Error)?.name === "AbortError";
    return { ok: false, err: { status: 0, code: "unavailable", message: aborted ? "The trade server did not answer in time." : "No connection with the trade server." } };
  } finally {
    clearTimeout(timer);
  }
}

export interface OrderBody {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  volume: number;
  price?: number;
  stopLimit?: number;
  sl?: number;
  tp?: number;
  trailingPoints?: number;
  expiry?: string;
  expiryAt?: string;
  requestedPrice?: number;
  deviationPoints?: number;
  ocoWith?: number;
  comment?: string;
  clientOrderId?: string;
  source?: "manual" | "ai";
}

export interface Notification {
  kind: string;
  message: string;
  data?: Record<string, unknown>;
}

export type OrderResult =
  | { status: "filled"; orderTicket: number; positionTicket: number; price: number; deals: number[]; delayMs?: number; notifications?: Notification[] }
  | { status: "placed"; ticket: number; price: number }
  | { status: "duplicate"; ticket: number };

export interface AuthResult {
  login: string;
  readOnly: boolean;
  expiresAt: string;
  account: EngState["account"];
}

export const engineApi = {
  sessions: () => call<{ sessions: SessionInfo[]; unavailable?: boolean }>("GET", "/api/engine/sessions"),
  login: (login: string, password: string, server?: string) => call<AuthResult>("POST", "/api/engine/login", { body: { login, password, server } }),
  sso: (token: string) => call<AuthResult>("POST", "/api/engine/sso", { body: { token } }),
  logout: (login?: string) => call<{ status: string; sessions: string[] }>("POST", "/api/engine/logout", { body: login ? { login } : {} }),

  state: (login: string, historyLimit = 200) => call<EngState>("GET", `/api/engine/state?historyLimit=${historyLimit}`, { login }),
  history: (login: string, q: { from?: string; to?: string; page?: number; limit?: number } = {}) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) sp.set(k, String(v));
    return call<{ deals: EngDeal[]; orders: EngOrder[]; page: number; limit: number; total: number }>("GET", `/api/engine/history${sp.size ? `?${sp}` : ""}`, { login });
  },
  placeOrder: (login: string, body: OrderBody) => call<OrderResult>("POST", "/api/engine/orders", { login, body }),
  modifyOrder: (login: string, ticket: string, patch: Record<string, unknown>) => call<{ order: EngOrder }>("PATCH", `/api/engine/orders/${ticket}`, { login, body: patch }),
  cancelOrder: (login: string, ticket: string) => call<{ status: string; ticket: number }>("DELETE", `/api/engine/orders/${ticket}`, { login }),
  closePosition: (login: string, ticket: string, body: { volume?: number; deviationPoints?: number; requestedPrice?: number } = {}) =>
    call<{ status: string; dealId: number; profit: number; notifications?: Notification[] }>("POST", `/api/engine/positions/${ticket}/close`, { login, body }),
  modifyPosition: (login: string, ticket: string, patch: { sl?: number | null; tp?: number | null; trailingPoints?: number | null }) => call<{ position: unknown }>("PATCH", `/api/engine/positions/${ticket}`, { login, body: patch }),
  closeBy: (login: string, ticket: string, by: string) => call<{ status: string; deals: number[] }>("POST", "/api/engine/positions/close-by", { login, body: { ticket: Number(ticket), by: Number(by) } }),
  bulkClose: (login: string, filter: "all" | "profitable" | "losing" | "pending" | "buys" | "sells", symbol?: string) =>
    call<{ done: number[]; failed: { ticket: number; error: { code: string; message: string } | string }[]; profit: number }>("POST", "/api/engine/bulk-close", { login, body: { filter, symbol }, timeoutMs: 30_000 }),
  streamTicket: (login: string) => call<{ ticket: string; expiresIn: number; url: string }>("POST", "/api/engine/stream-ticket", { login }),
  demoRefill: (login: string) => call<{ status: string; amount: number; balance: number }>("POST", "/api/engine/demo-refill", { login }),
  /** MAM role of the account (manager's master account / linked client account) and the allocation summary. */
  mam: (login: string, symbol?: string, volume?: number) => call<MamInfo>("GET", `/api/engine/mam${symbol ? `?symbol=${encodeURIComponent(symbol)}&volume=${volume ?? 1}` : ""}`, { login }),
};

export interface MamPreviewRow {
  linkId: number;
  account: string;
  equity: number;
  balance: number;
  value: number;
  maxLot: number | null;
  basis: number;
  raw: number;
  volume: number | null;
  reason: string | null;
}

export interface MamInfo {
  role: "manager" | "client" | null;
  manager?: { name: string; nickname?: string | null; method: "equity" | "balance" | "multiplier" | "percent"; status: string; perfFeePct?: number; mgmtFeePct?: number; accounts?: number };
  accounts?: number;
  equity?: number;
  preview?: { symbol: string; block: number; allocated: number; unallocated: number; lotStep: number; lotMin: number; rows: MamPreviewRow[] } | null;
  recent?: { id: number; masterTicket: number | null; action: string; symbol: string; side: "buy" | "sell"; block: number; allocated: number; accounts: number; at: string; details: unknown[] }[];
  link?: { id: number; since: string; maxLot: number | null; equityStop: number | null };
}
