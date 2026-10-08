// Request validation of the mobile trading BFF (app/api/mobile/trade/*), ported from Ezymex Trader's BFF
// (apps/terminal/app/api/engine/[...path]/route.ts and app/api/options/[...path]/route.ts) so the app and the web
// terminal send the engine exactly the same shapes. The engine and the options service re-check everything; this
// keeps junk out. Each function returns the clean body / query, or a string: the message of a 422 (bodies) or a
// 400 (queries).

export type Obj = Record<string, unknown>;

export const TICKET_RE = /^\d{1,12}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const SYMBOL_RE = /^[A-Z0-9._]{2,20}$/;
/** Option series code, e.g. EURUSD-20261009-1.1650-C (barrier series may carry a suffix). */
export const SERIES_RE = /^[A-Z0-9]{3,12}-\d{8}-[0-9.]{1,16}-[CP](-[A-Z0-9._]{1,24})?$/;
export const COMBO_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const MAX_LEGS = 8;
/** order book order id (= engine ticket) and RFQ id */
export const ORDER_ID_RE = /^\d{1,18}$/;
export const RFQ_ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
export const UNDERLYING_RE = /^[A-Z0-9]{3,12}$/;
const U_RE = /^[A-Z]{3,8}$/;
const CLIENT_ORDER_RE = /^[A-Za-z0-9_-]{8,64}$/;
const BOOK_TYPES = ["limit", "market", "stop_market", "stop_limit"];
const BOOK_TIFS = ["gtc", "ioc", "fok", "gtd"];
const MAX_QTY = 100_000;
const CANDLE_TFS = new Set(["1", "5", "15", "30", "60", "240", "1440"]);
const NUM_RE = /^\d{1,12}(\.\d{1,10})?$/;

export const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
/** number, or null (explicit clear), or undefined (not sent) */
export const numOrNull = (v: unknown) => (v === null ? null : num(v));

/** The listed fields of `src`, each checked; a string = the name of the first invalid field. */
export function pick(src: Obj, spec: Record<string, "num" | "numOrNull" | "str" | "int">): Obj | string {
  const out: Obj = {};
  for (const [k, kind] of Object.entries(spec)) {
    if (!(k in src) || src[k] === undefined) continue;
    const v = src[k];
    if (kind === "str") {
      if (typeof v !== "string" || v.length > 64) return k;
      out[k] = v;
    } else if (kind === "numOrNull") {
      const n = numOrNull(v);
      if (n === undefined) return k;
      out[k] = n;
    } else {
      const n = num(v);
      if (n === undefined || (kind === "int" && !Number.isInteger(n))) return k;
      out[k] = n;
    }
  }
  return out;
}

/** A CFD order (market / pending). The app's orders are manual or AI Trader, recorded with the phone's platform. */
export function orderBody(b: Obj, platform: string): Obj | string {
  const o = pick(b, { symbol: "str", side: "str", type: "str", volume: "num", price: "num", stopLimit: "num", sl: "num", tp: "num", trailingPoints: "int", expiry: "str", expiryAt: "str", requestedPrice: "num", deviationPoints: "int", ocoWith: "int", comment: "str", clientOrderId: "str", source: "str" });
  if (typeof o === "string") return `Invalid ${o}.`;
  if (!SYMBOL_RE.test(String(o.symbol ?? ""))) return "Invalid symbol.";
  if (o.side !== "buy" && o.side !== "sell") return "Invalid side.";
  if (!["market", "limit", "stop", "stop_limit"].includes(String(o.type))) return "Invalid order type.";
  // the app may tag its own orders as manual or AI Trader only (never api / copy / dealer …)
  o.source = o.source === "ai" ? "ai" : "manual";
  o.platform = platform;
  if (typeof o.comment === "string") o.comment = o.comment.slice(0, 31);
  return o;
}

/** PATCH orders/{ticket}. */
export const orderPatch = (b: Obj) => pick(b, { price: "num", stopLimit: "num", volume: "num", sl: "numOrNull", tp: "numOrNull", trailingPoints: "numOrNull", expiry: "str", expiryAt: "str" });
/** POST positions/{ticket}/close. */
export const closeBody = (b: Obj) => pick(b, { volume: "num", deviationPoints: "int", requestedPrice: "num" });
/** PATCH positions/{ticket}. */
export const positionPatch = (b: Obj) => pick(b, { sl: "numOrNull", tp: "numOrNull", trailingPoints: "numOrNull" });

/** POST positions/close-by {ticket, by}: two different tickets (the engine checks hedging, sides and symbol). */
export function closeByBody(b: Obj): Obj | string {
  const o = pick(b, { ticket: "int", by: "int" });
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0 && TICKET_RE.test(String(n));
  if (typeof o === "string" || !ok(o.ticket) || !ok(o.by) || o.ticket === o.by) return "Choose two positions.";
  return { ticket: o.ticket, by: o.by };
}

/** POST bulk-close {filter, symbol?}. */
export function bulkCloseBody(b: Obj): Obj | string {
  const filter = String(b.filter ?? "");
  if (!["all", "profitable", "losing", "pending", "buys", "sells"].includes(filter)) return "Invalid filter.";
  const symbol = b.symbol === undefined || b.symbol === null ? undefined : String(b.symbol);
  if (symbol !== undefined && !SYMBOL_RE.test(symbol)) return "Invalid symbol.";
  return { filter, ...(symbol ? { symbol } : {}) };
}

/** Option legs + order type of a preview / order (Ezymex FX Options, house venue). */
export function optionBody(b: Obj, order: boolean, platform?: string): Obj | string {
  if (!Array.isArray(b.legs) || b.legs.length < 1 || b.legs.length > MAX_LEGS) return `Give 1 to ${MAX_LEGS} legs.`;
  const legs: Obj[] = [];
  for (const raw of b.legs as unknown[]) {
    const l = (raw ?? {}) as Obj;
    const contracts = num(l.contracts);
    if (typeof l.series !== "string" || !SERIES_RE.test(l.series)) return "Invalid series.";
    if (l.side !== "buy" && l.side !== "sell") return "Invalid side.";
    if (contracts === undefined || contracts <= 0 || contracts > 100_000) return "Invalid contracts.";
    const leg: Obj = { series: l.series, side: l.side, contracts };
    // a barrier leg (Ezymex-quoted, house ticket): {kind: UO|DO|UI|DI, level, rebate?}
    if (l.barrier !== undefined && l.barrier !== null) {
      const x = l.barrier as Obj;
      const level = num(x.level);
      const rebate = x.rebate === undefined || x.rebate === null ? undefined : num(x.rebate);
      if (!["UO", "DO", "UI", "DI"].includes(String(x.kind)) || level === undefined || level <= 0 || level > 1e9 || (x.rebate !== undefined && x.rebate !== null && (rebate === undefined || rebate < 0))) return "Invalid barrier.";
      leg.barrier = { kind: x.kind, level, ...(rebate !== undefined ? { rebate } : {}) };
    }
    legs.push(leg);
  }
  if (new Set(legs.map((l) => l.series)).size !== legs.length) return "Each series may appear once.";
  const type = b.type === "limit" ? "limit" : b.type === "market" || b.type === undefined ? "market" : null;
  if (!type) return "Invalid order type.";
  const out: Obj = { legs, type };
  if (type === "limit") {
    const lp = num(b.limitPremium);
    if (lp === undefined || lp < 0) return "Invalid limit premium.";
    out.limitPremium = lp;
  }
  if (!order) return out;
  for (const k of ["sl", "tp"] as const) {
    if (b[k] === undefined || b[k] === null) continue;
    const v = num(b[k]);
    if (v === undefined || v < 0) return `Invalid ${k}.`;
    out[k] = v;
  }
  if (b.trigger !== undefined && b.trigger !== null) {
    const t = b.trigger as Obj;
    const price = num(t.price);
    if (typeof t.symbol !== "string" || !SYMBOL_RE.test(t.symbol) || (t.op !== "above" && t.op !== "below") || price === undefined || price <= 0) return "Invalid trigger.";
    out.trigger = { symbol: t.symbol, op: t.op, price };
  }
  if (b.tif !== undefined) {
    if (b.tif !== "gtc" && b.tif !== "day") return "Invalid time in force.";
    out.tif = b.tif;
  }
  if (typeof b.clientOrderId !== "string" || !CLIENT_ORDER_RE.test(b.clientOrderId)) return "Invalid clientOrderId.";
  out.clientOrderId = b.clientOrderId;
  if (platform) out.platform = platform;
  return out;
}

/** A book order / preview (docs/OPTIONS-EXCHANGE.md §2): only the documented fields, each checked. */
export function bookOrderBody(b: Obj, order: boolean): Obj | string {
  if (typeof b.series !== "string" || !SERIES_RE.test(b.series)) return "Invalid series.";
  if (b.side !== "buy" && b.side !== "sell") return "Invalid side.";
  const type = String(b.type ?? "");
  if (!BOOK_TYPES.includes(type)) return "Invalid order type.";
  const qty = num(b.qty);
  if (qty === undefined || qty <= 0 || qty > MAX_QTY) return "Invalid quantity.";
  const out: Obj = { series: b.series, side: b.side, type, qty };
  const priced = type === "limit" || type === "stop_limit";
  if (priced) {
    const price = num(b.price);
    if (price === undefined || price <= 0 || price > 1e9) return "Invalid price.";
    out.price = price;
  }
  // market orders are IOC at the band (the engine stamps the band); a stop-market fires as one
  let tif = String(b.tif ?? (priced ? "gtc" : "ioc"));
  if (!BOOK_TIFS.includes(tif)) return "Invalid time in force.";
  if (type === "market" || type === "stop_market") tif = "ioc";
  out.tif = tif;
  if (tif === "gtd") {
    if (typeof b.expireAt !== "string" || !DATE_RE.test(b.expireAt) || !(Date.parse(b.expireAt) > Date.now())) return "Invalid expiry time.";
    out.expireAt = b.expireAt;
  }
  if (b.postOnly !== undefined && b.postOnly !== null) {
    if (typeof b.postOnly !== "boolean") return "Invalid postOnly.";
    if (b.postOnly && (type !== "limit" || tif !== "gtc")) return "Post-only needs a GTC limit order.";
    if (b.postOnly) out.postOnly = true;
  }
  if (b.reduceOnly !== undefined && b.reduceOnly !== null) {
    if (typeof b.reduceOnly !== "boolean") return "Invalid reduceOnly.";
    if (b.reduceOnly) out.reduceOnly = true;
  }
  if (type === "stop_market" || type === "stop_limit") {
    const t = (b.trigger ?? {}) as Obj;
    const price = num(t.price);
    if ((t.source !== "mark" && t.source !== "underlying") || (t.op !== "above" && t.op !== "below") || price === undefined || price <= 0 || price > 1e9) return "Invalid trigger.";
    out.trigger = { source: t.source, op: t.op, price };
  }
  if (order || b.clientOrderId !== undefined) {
    if (typeof b.clientOrderId !== "string" || !CLIENT_ORDER_RE.test(b.clientOrderId)) return "Invalid clientOrderId.";
    out.clientOrderId = b.clientOrderId;
  }
  return out;
}

/** PATCH options/book/orders/{id} {price?, qty?}. */
export function bookAmendBody(b: Obj): Obj | string {
  const price = b.price === undefined ? undefined : num(b.price);
  const qty = b.qty === undefined ? undefined : num(b.qty);
  if ((b.price !== undefined && (price === undefined || price <= 0)) || (b.qty !== undefined && (qty === undefined || qty <= 0 || qty > MAX_QTY))) return "Invalid price or quantity.";
  if (price === undefined && qty === undefined) return "Change the price or the quantity.";
  return { ...(price !== undefined ? { price } : {}), ...(qty !== undefined ? { qty } : {}) };
}

/** A combo RFQ (§5): 1–8 legs, one per series, whole ratios, a positive size. */
export function rfqBody(b: Obj): Obj | string {
  if (!Array.isArray(b.legs) || b.legs.length < 1 || b.legs.length > MAX_LEGS) return `Give 1 to ${MAX_LEGS} legs.`;
  const legs: Obj[] = [];
  for (const raw of b.legs as unknown[]) {
    const l = (raw ?? {}) as Obj;
    const ratio = num(l.ratio);
    if (typeof l.series !== "string" || !SERIES_RE.test(l.series)) return "Invalid series.";
    if (l.side !== "buy" && l.side !== "sell") return "Invalid side.";
    if (ratio === undefined || !Number.isInteger(ratio) || ratio < 1 || ratio > 100) return "Invalid ratio.";
    legs.push({ series: l.series, side: l.side, ratio });
  }
  if (new Set(legs.map((l) => l.series)).size !== legs.length) return "Each series may appear once.";
  const qty = num(b.qty);
  if (qty === undefined || qty <= 0 || qty > MAX_QTY) return "Invalid quantity.";
  return { legs, qty, ...(b.reduceOnly === true ? { reduceOnly: true } : {}) };
}

/** POST options/rfq/{id}/accept {quoteId, side, limitNet}. */
export function rfqAcceptBody(b: Obj): Obj | string {
  const limitNet = num(b.limitNet);
  if (typeof b.quoteId !== "string" || !RFQ_ID_RE.test(b.quoteId) || (b.side !== "buy" && b.side !== "sell") || limitNet === undefined || Math.abs(limitNet) > 1e9) return "Invalid quote, side or limit.";
  return { quoteId: b.quoteId, side: b.side, limitNet };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** from / to / page / limit, validated: "" or "?…", else the error message. */
export function pageQuery(sp: URLSearchParams, maxLimit = 500): { q: string } | string {
  const out = new URLSearchParams();
  for (const k of ["from", "to"] as const) {
    const v = sp.get(k);
    if (!v) continue;
    if (!DATE_RE.test(v)) return `Invalid ${k} date.`;
    out.set(k, v);
  }
  for (const [k, max] of [["page", 100000], ["limit", maxLimit]] as const) {
    const v = sp.get(k);
    if (!v) continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > max) return `Invalid ${k}.`;
    out.set(k, String(n));
  }
  const s = out.toString();
  return { q: s ? `?${s}` : "" };
}

/** `u` (underlying) and `expiry` of the options reads; null when invalid. */
export function underlyingQuery(sp: URLSearchParams, needU: boolean): { u?: string; expiry?: string } | null {
  const u = sp.get("u")?.toUpperCase() ?? undefined;
  const expiry = sp.get("expiry") ?? undefined;
  if ((needU && !u) || (u && !U_RE.test(u)) || (expiry && !DAY_RE.test(expiry))) return null;
  return { u, expiry };
}

export const isUnderlying = (v: string) => U_RE.test(v);

/**
 * `candles?series=&tf=&limit=&to=` (+ `barrier=UO|DO|UI|DI&level=&rebate=&knockedAt=` for a barrier position) → the
 * options service's query (validated), or null.
 */
export function candlesQuery(sp: URLSearchParams): string | null {
  const series = sp.get("series") ?? "";
  const tf = sp.get("tf") ?? "";
  const limit = sp.get("limit");
  const to = sp.get("to");
  if (!SERIES_RE.test(series) || !CANDLE_TFS.has(tf)) return null;
  if (limit !== null && !/^\d{1,4}$/.test(limit)) return null;
  if (to !== null && !/^\d{9,11}$/.test(to)) return null;
  const n = limit === null ? null : Math.min(1500, Math.max(1, Number(limit)));
  let q = `series=${encodeURIComponent(series)}&tf=${tf}${n ? `&limit=${n}` : ""}${to ? `&to=${to}` : ""}`;
  const barrier = sp.get("barrier");
  if (barrier !== null) {
    const level = sp.get("level") ?? "";
    const rebate = sp.get("rebate");
    const knockedAt = sp.get("knockedAt");
    if (!/^(UO|DO|UI|DI)$/.test(barrier) || !NUM_RE.test(level) || (rebate !== null && !NUM_RE.test(rebate)) || (knockedAt !== null && !/^\d{9,11}$/.test(knockedAt))) return null;
    q += `&barrier=${barrier}&level=${level}${rebate !== null ? `&rebate=${rebate}` : ""}${knockedAt !== null ? `&knockedAt=${knockedAt}` : ""}`;
  }
  return q;
}
