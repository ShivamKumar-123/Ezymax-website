"use client";

// Order book trading from the browser (docs/OPTIONS-EXCHANGE.md §12 "Terminal"). Live builds: /api/engine/options/
// {book/*, rfq/*} (the terminal BFF validates and forwards to the engine's /v1/terminal/options/*) and the public
// market data of the options service (/api/options/public/{book,trades}/…) as the polling fallback of the stream.
// Demo builds: the same calls answered by the in-browser matching simulator (./mock-engine). Errors come back as
// values, never thrown. An engine without the book (404 / 405 / 501) is reported with `bookMissing`, and the
// workspace falls back to today's house-priced flow.
import { IS_LIVE } from "@ezymex/mock";
import type { EngineErr } from "@/lib/engine/map";
import type { Result } from "@/lib/engine/client";
import { mockBookApi } from "./mock-engine";
import { normDepth, normFill, normOrder, normOrderResult, normPreview, normRfq, normRfqAccept, normRfqQuote, normTrade } from "./normalize";
import type { BookFill, BookOrder, BookOrderRequest, BookOrderResult, BookPreview, CloseResult, Rfq, RfqAcceptResult, RfqLeg, RfqQuote, SeriesDepth, Side, TapeTrade } from "./types";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function call<T>(method: Method, path: string, opts: { login?: string; body?: unknown; timeoutMs?: number } = {}): Promise<Result<T>> {
  const headers: Record<string, string> = { "x-ezymex-errors": "body" };
  if (opts.login) headers["x-ezymex-login"] = opts.login;
  const hasBody = method === "POST" || method === "PATCH";
  if (hasBody) headers["content-type"] = "application/json";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(path, { method, headers, body: hasBody ? JSON.stringify(opts.body ?? {}) : undefined, cache: "no-store", credentials: "same-origin", signal: ctrl.signal });
    const data = (await res.json().catch(() => ({}))) as T & { error?: Partial<EngineErr> };
    if (res.ok && !data.error) return { ok: true, data };
    const e = data.error ?? {};
    const status = typeof e.status === "number" ? e.status : res.status;
    return { ok: false, err: { ...e, status, code: e.code ?? (status >= 500 ? "unavailable" : "engine_error"), message: e.message ?? `HTTP ${status}` } as EngineErr };
  } catch (e) {
    const aborted = (e as Error)?.name === "AbortError";
    return { ok: false, err: { status: 0, code: "unavailable", message: aborted ? "The server did not answer in time." : "No connection." } };
  } finally {
    clearTimeout(timer);
  }
}

const map = <A, B>(r: Result<A>, f: (a: A) => B): Result<B> => (r.ok ? { ok: true, data: f(r.data) } : r);

/** The engine doesn't serve the book (yet): keep the house-priced flow. */
export function bookMissing(e: EngineErr): boolean {
  if (e.code === "book_disabled" || e.code === "book_not_active") return true;
  return (e.status === 404 && (e.code === "not_found" || e.code === "engine_error")) || e.status === 405 || e.status === 501;
}

export interface OrdersQuery {
  status: "open" | "history";
  series?: string;
}

export interface BookApi {
  preview: (login: string, req: BookOrderRequest) => Promise<Result<BookPreview>>;
  place: (login: string, req: BookOrderRequest) => Promise<Result<BookOrderResult>>;
  amend: (login: string, id: string, patch: { price?: number; qty?: number }) => Promise<Result<BookOrderResult>>;
  cancel: (login: string, id: string) => Promise<Result<{ status: string; order: BookOrder | null }>>;
  /** every working order of a series, or of an underlying */
  cancelAll: (login: string, scope: { series?: string; underlying?: string }) => Promise<Result<{ cancelled: number }>>;
  orders: (login: string, q: OrdersQuery) => Promise<Result<BookOrder[]>>;
  fills: (login: string, range: { from?: string; to?: string }) => Promise<Result<BookFill[]>>;
  /** reduce-only market close of a book-venue position (house venue: closes at the house price) */
  closePosition: (login: string, ticket: string, contracts?: number) => Promise<Result<CloseResult>>;
  rfq: (login: string, req: { legs: RfqLeg[]; qty: number; reduceOnly?: boolean }) => Promise<Result<Rfq>>;
  rfqGet: (login: string, id: string) => Promise<Result<{ rfq: Rfq | null; quotes: RfqQuote[] }>>;
  rfqAccept: (login: string, id: string, body: { quoteId: string; side: Side; limitNet: number }) => Promise<Result<RfqAcceptResult>>;
  rfqCancel: (login: string, id: string) => Promise<Result<{ status: string }>>;
  /** public market data (the stream's polling fallback, guests) */
  depth: (series: string) => Promise<Result<SeriesDepth>>;
  trades: (series: string, limit?: number) => Promise<Result<TapeTrade[]>>;
}

const E = "/api/engine/options";

const liveBookApi: BookApi = {
  preview: async (login, req) => map(await call<unknown>("POST", `${E}/book/preview`, { login, body: req, timeoutMs: 8_000 }), (d) => normPreview(d, req)),
  place: async (login, req) => map(await call<unknown>("POST", `${E}/book/orders`, { login, body: req, timeoutMs: 20_000 }), normOrderResult),
  amend: async (login, id, patch) => map(await call<unknown>("PATCH", `${E}/book/orders/${encodeURIComponent(id)}`, { login, body: patch, timeoutMs: 15_000 }), normOrderResult),
  cancel: async (login, id) =>
    map(await call<{ status?: string; order?: unknown }>("DELETE", `${E}/book/orders/${encodeURIComponent(id)}`, { login }), (d) => ({ status: d.status ?? "cancelled", order: normOrder(d.order) })),
  cancelAll: async (login, scope) => {
    const q = new URLSearchParams();
    if (scope.series) q.set("series", scope.series);
    if (scope.underlying) q.set("underlying", scope.underlying);
    // the engine lists the cancelled order ids
    return map(await call<{ cancelled?: number | unknown[]; orders?: unknown[] }>("DELETE", `${E}/book/orders?${q}`, { login }), (d) => ({ cancelled: Array.isArray(d.cancelled) ? d.cancelled.length : (d.cancelled ?? d.orders?.length ?? 0) }));
  },
  orders: async (login, q) => {
    const p = new URLSearchParams({ status: q.status });
    if (q.series) p.set("series", q.series);
    return map(await call<{ orders?: unknown[]; items?: unknown[] } | unknown[]>("GET", `${E}/book/orders?${p}`, { login }), (d) => {
      const list = Array.isArray(d) ? d : (d.orders ?? d.items ?? []);
      return list.map(normOrder).filter((o): o is BookOrder => !!o);
    });
  },
  fills: async (login, range) => {
    const p = new URLSearchParams();
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
    return map(await call<{ fills?: unknown[]; items?: unknown[] } | unknown[]>("GET", `${E}/book/fills${p.toString() ? `?${p}` : ""}`, { login }), (d) => {
      const list = Array.isArray(d) ? d : (d.fills ?? d.items ?? []);
      return list.map((f) => normFill(f)).filter((f): f is BookFill => !!f);
    });
  },
  closePosition: (login, ticket, contracts) => call<CloseResult>("POST", `/api/engine/positions/${ticket}/close`, { login, body: contracts ? { volume: contracts } : {}, timeoutMs: 20_000 }),
  rfq: async (login, req) =>
    map(await call<unknown>("POST", `${E}/rfq`, { login, body: req, timeoutMs: 10_000 }), (d) => normRfq(d) ?? { id: "", expiresAt: new Date().toISOString(), legs: req.legs, qty: req.qty }),
  rfqGet: async (login, id) =>
    map(await call<{ rfq?: unknown; quotes?: unknown[] }>("GET", `${E}/rfq/${encodeURIComponent(id)}`, { login, timeoutMs: 6_000 }), (d) => ({
      rfq: normRfq(d.rfq),
      quotes: (d.quotes ?? []).map(normRfqQuote).filter((q): q is RfqQuote => !!q),
    })),
  rfqAccept: async (login, id, body) => map(await call<unknown>("POST", `${E}/rfq/${encodeURIComponent(id)}/accept`, { login, body, timeoutMs: 20_000 }), normRfqAccept),
  rfqCancel: async (login, id) => map(await call<{ status?: string }>("DELETE", `${E}/rfq/${encodeURIComponent(id)}`, { login }), (d) => ({ status: d.status ?? "cancelled" })),
  depth: async (series) => {
    const r = await call<unknown>("GET", `/api/options/public/book/${encodeURIComponent(series)}`, { timeoutMs: 6_000 });
    if (!r.ok) return r;
    const d = normDepth({ series, ...(r.data as object) });
    return d ? { ok: true, data: d } : { ok: false, err: { status: 502, code: "bad_gateway", message: "Unexpected depth." } };
  },
  trades: async (series, limit = 50) =>
    map(await call<{ trades?: unknown[] } | unknown[]>("GET", `/api/options/public/trades/${encodeURIComponent(series)}?limit=${limit}`, { timeoutMs: 6_000 }), (d) =>
      (Array.isArray(d) ? d : (d.trades ?? [])).map((t) => normTrade(t, series)).filter((t): t is TapeTrade => !!t),
    ),
};

export const bookApi: BookApi = IS_LIVE ? liveBookApi : mockBookApi;

/** A fresh client order id (idempotency key of the engine). */
export const clientOrderId = (prefix = "bk") => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
