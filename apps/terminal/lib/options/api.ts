"use client";

// Browser side of Kalks FX Options. Live builds: chain data from /api/options/* (options service) and trading from
// /api/engine/options/* (trading engine), every call naming the acting login. Demo builds (NEXT_PUBLIC_KALKS_MODE=
// demo): the same calls answered in the browser by ./mock-engine (the GK / BS / Black-76 pricer in
// @kalks/mock/options), so the workspace works without any service. Errors come back as values, never thrown.
import { IS_LIVE } from "@kalks/mock";
import type { EngineErr } from "@/lib/engine/map";
import type { Result } from "@/lib/engine/client";
import type { ComboCloseResult, OptionCandles, OptionChain, OptionExpiry, OptionUnderlying, OrderRequest, OrderResult, Preview, PreviewRequest, Settlement } from "./types";
import { mockApi } from "./mock-engine";

async function call<T>(method: "GET" | "POST", path: string, opts: { login?: string; body?: unknown; timeoutMs?: number } = {}): Promise<Result<T>> {
  const headers: Record<string, string> = { "x-kalks-errors": "body" };
  if (opts.login) headers["x-kalks-login"] = opts.login;
  if (method === "POST") headers["content-type"] = "application/json";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(path, { method, headers, body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined, cache: "no-store", credentials: "same-origin", signal: ctrl.signal });
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

/**
 * The module isn't available here yet: the options service has it switched off for this broker / account kind
 * (404 options_disabled), or the trading engine doesn't serve its options routes yet (404 / 405 / 501).
 */
export function isLaunchingSoon(e: EngineErr): boolean {
  if (e.code === "options_disabled") return true;
  if (e.code === "not_eligible") return false;
  return e.status === 404 || e.status === 405 || e.status === 501;
}

export interface OptionsApi {
  underlyings: (login: string) => Promise<Result<{ underlyings: OptionUnderlying[]; version?: number }>>;
  expiries: (login: string, u: string) => Promise<Result<{ underlying: string; expiries: OptionExpiry[] }>>;
  chain: (login: string, u: string, expiry?: string | null) => Promise<Result<OptionChain>>;
  publicChain: (u: string, expiry?: string | null) => Promise<Result<OptionChain>>;
  /** premium candles of one series (`tf` in minutes: 1, 5, 15, 30, 60, 240, 1440; `to` unix seconds, inclusive) */
  candles: (login: string, series: string, tf: number, opts?: { limit?: number; to?: number }) => Promise<Result<OptionCandles>>;
  streamTicket: (login: string) => Promise<Result<{ ticket: string; expiresIn: number; url: string }>>;
  publicStreamUrl: () => Promise<Result<{ url: string }>>;
  /** `local` computes the client-side estimate (demo builds; live while the engine doesn't answer) */
  preview: (login: string, req: PreviewRequest, local: () => Preview) => Promise<Result<Preview>>;
  order: (login: string, req: OrderRequest) => Promise<Result<OrderResult>>;
  closePosition: (login: string, ticket: string, contracts?: number) => Promise<Result<{ status: string; profit?: number }>>;
  closeCombo: (login: string, comboId: string) => Promise<Result<ComboCloseResult>>;
  cancelOrder: (login: string, ticket: string) => Promise<Result<{ status: string }>>;
  settlements: (login: string) => Promise<Result<{ items: Settlement[] }>>;
}

const liveApi: OptionsApi = {
  underlyings: (login) => call("GET", "/api/options/underlyings", { login }),
  expiries: (login, u) => call("GET", `/api/options/expiries?u=${encodeURIComponent(u)}`, { login }),
  chain: (login, u, expiry) => call("GET", `/api/options/chain?u=${encodeURIComponent(u)}${expiry ? `&expiry=${expiry}` : ""}`, { login }),
  publicChain: (u, expiry) => call("GET", `/api/options/public/chain/${encodeURIComponent(u)}${expiry ? `?expiry=${expiry}` : ""}`),
  candles: (login, series, tf, opts = {}) =>
    call("GET", `/api/options/candles?series=${encodeURIComponent(series)}&tf=${tf}${opts.limit ? `&limit=${opts.limit}` : ""}${opts.to ? `&to=${opts.to}` : ""}`, { login, timeoutMs: 10_000 }),
  streamTicket: (login) => call("POST", "/api/options/stream-ticket", { login }),
  publicStreamUrl: () => call("GET", "/api/options/public/stream-url"),
  preview: async (login, req, local) => {
    const r = await call<Preview & { currency?: string }>("POST", "/api/engine/options/preview", { login, body: req, timeoutMs: 8_000 });
    if (r.ok) return { ok: true, data: previewInUsd({ ...r.data, reasons: r.data.reasons ?? [], breakevens: r.data.breakevens ?? [], greeks: r.data.greeks ?? {} }) };
    // the engine doesn't serve options yet: show the estimate (orders stay blocked until it does)
    if (isLaunchingSoon(r.err)) return { ok: true, data: { ...local(), estimate: true } };
    return r;
  },
  order: (login, req) => call("POST", "/api/engine/options/orders", { login, body: req, timeoutMs: 20_000 }),
  closePosition: (login, ticket, contracts) => call("POST", `/api/engine/positions/${ticket}/close`, { login, body: contracts ? { volume: contracts } : {}, timeoutMs: 20_000 }),
  closeCombo: (login, comboId) => call("POST", `/api/engine/options/combos/${encodeURIComponent(comboId)}/close`, { login, timeoutMs: 20_000 }),
  cancelOrder: async (login, ticket) => {
    const headers: Record<string, string> = { "x-kalks-errors": "body", "x-kalks-login": login };
    try {
      const res = await fetch(`/api/engine/orders/${ticket}`, { method: "DELETE", headers, credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: Partial<EngineErr> };
      if (res.ok && !data.error) return { ok: true, data: { status: data.status ?? "cancelled" } };
      const e = data.error ?? {};
      return { ok: false, err: { status: e.status ?? res.status, code: e.code ?? "engine_error", message: e.message ?? `HTTP ${res.status}` } };
    } catch {
      return { ok: false, err: { status: 0, code: "unavailable", message: "No connection." } };
    }
  },
  settlements: (login) => call("GET", "/api/engine/options/settlements?limit=200", { login }),
};

/**
 * The engine answers a preview in the account's currency (`currency`: USD, or USC on cent accounts, 100 × USD). The
 * workspace keeps every amount in USD (like the client estimate and the positions) and shows account amounts with
 * accMoney, so a cent account's preview is scaled back to USD here. Premiums per unit (legs' `price`) are untouched.
 */
export function previewInUsd(p: Preview & { currency?: string }): Preview {
  if (p.currency !== "USC") return p;
  const k = 100;
  const m = (v: number) => (Number.isFinite(v) ? v / k : v);
  const mOpt = (v: number | null) => (v === null || v === undefined ? v : v / k);
  return {
    ...p,
    netPremium: m(p.netPremium),
    commission: m(p.commission),
    marginBefore: m(p.marginBefore),
    marginAfter: m(p.marginAfter),
    freeMarginAfter: m(p.freeMarginAfter),
    cashAfter: m(p.cashAfter),
    maxProfit: mOpt(p.maxProfit),
    maxLoss: mOpt(p.maxLoss),
    legs: p.legs.map((l) => ({ ...l, premium: l.premium === undefined ? undefined : l.premium / k })),
    greeks: { ...p.greeks },
    currency: "USD",
  } as Preview;
}

/** Money of the engine in the account's currency → USD (cent accounts keep 100 × USD). */
export const engineUsd = (v: number | null | undefined, cent: boolean | undefined): number | undefined => (v === null || v === undefined || !Number.isFinite(v) ? undefined : cent ? v / 100 : v);

export const optionsApi: OptionsApi = IS_LIVE ? liveApi : mockApi;
