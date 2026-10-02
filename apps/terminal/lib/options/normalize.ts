// Wire → terminal shapes for the order book (docs/OPTIONS-EXCHANGE.md §10, §12). The options service merges the
// engine's top of book into each chain row: `bid` / `ask` become the book's best bid / offer and are null when that
// side is empty. The workspace keeps one quote shape for house prices and the book: an empty side is stored as 0
// (premiums are at least one tick, so 0 never is a price) with `bidQty` / `askQty` null, the USD fields are filled
// from the mark's own USD rate when the service leaves them out, and `book` marks a quote that came from the book.
// Engine answers (orders, fills, previews) are parsed defensively: the engine is new and fields may be added.
import { defaultPremiumTick, OPTION_SPEC, parseSeriesCode } from "@kalks/mock/options";
import type { BookFill, BookOrder, BookOrderResult, BookPreview, ChainBook, OptionChain, OptionChainRow, OptionQuote, OptionUnderlying, Rfq, RfqQuote, SeriesDepth, StopTrigger, TapeTrade } from "./types";

type Obj = Record<string, unknown>;

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
const numOrNull = (v: unknown): number | null => num(v) ?? null;
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : undefined);
const iso = (v: unknown): string | null => {
  if (typeof v === "string" && v) return v;
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v > 1e12 ? v : v * 1000).toISOString();
  return null;
};

/** USD per contract for one unit of premium of a quote (contract size × USD per quote currency), 0 when unknown. */
export function usdPerUnitOfQuote(q: Pick<OptionQuote, "mark" | "markUsd" | "ask" | "askUsd" | "bid" | "bidUsd"> | null | undefined): number {
  if (!q) return 0;
  if (q.mark > 0 && q.markUsd > 0) return q.markUsd / q.mark;
  if (q.ask > 0 && q.askUsd > 0) return q.askUsd / q.ask;
  if (q.bid > 0 && q.bidUsd > 0) return q.bidUsd / q.bid;
  return 0;
}

/** True when the chain row / quote carries order-book fields. */
const hasBookFields = (x: Obj) => "bidQty" in x || "askQty" in x || "theo" in x;

/** A chain / series quote in the terminal's shape (house quotes pass through untouched). */
export function normQuote(raw: OptionQuote | Obj | null | undefined): OptionQuote | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Obj;
  if (!hasBookFields(x) && x.bid !== null && x.ask !== null) return raw as OptionQuote;
  const mark = num(x.mark) ?? 0;
  const markUsd = num(x.markUsd) ?? 0;
  const k = mark > 0 && markUsd > 0 ? markUsd / mark : (() => {
    const a = num(x.ask);
    const au = num(x.askUsd);
    return a && au ? au / a : 0;
  })();
  const usdOf = (unit: number | undefined, usd: unknown) => num(usd) ?? (unit !== undefined && k > 0 ? Math.round(unit * k * 100) / 100 : undefined);
  const bid = num(x.bid);
  const ask = num(x.ask);
  const last = num(x.last) ?? num(x.ltp);
  const theo = num(x.theo);
  const q: OptionQuote = {
    ...(raw as OptionQuote),
    book: true,
    bid: bid ?? 0,
    ask: ask ?? 0,
    bidUsd: bid === undefined ? 0 : (usdOf(bid, x.bidUsd) ?? 0),
    askUsd: ask === undefined ? 0 : (usdOf(ask, x.askUsd) ?? 0),
    bidQty: bid === undefined ? null : (num(x.bidQty) ?? null),
    askQty: ask === undefined ? null : (num(x.askQty) ?? null),
    mark,
    markUsd,
    last: last ?? null,
    lastUsd: last === undefined ? null : (usdOf(last, x.lastUsd) ?? null),
    lastQty: numOrNull(x.lastQty),
    ltp: last ?? null,
    theo: theo ?? null,
    theoUsd: theo === undefined ? null : (usdOf(theo, x.theoUsd) ?? null),
    theoIv: numOrNull(x.theoIv),
    markIv: numOrNull(x.markIv),
    bidIv: numOrNull(x.bidIv),
    askIv: numOrNull(x.askIv),
    oi: numOrNull(x.oi),
    volume: numOrNull(x.volume),
    change: numOrNull(x.change),
    iv: num(x.iv) ?? num(x.markIv) ?? num(x.theoIv) ?? 0,
    ivBid: num(x.ivBid) ?? num(x.bidIv) ?? num(x.iv) ?? 0,
    ivAsk: num(x.ivAsk) ?? num(x.askIv) ?? num(x.iv) ?? 0,
  };
  return q;
}

export function normRow(r: OptionChainRow): OptionChainRow {
  const call = normQuote(r.call);
  const put = normQuote(r.put);
  return call === r.call && put === r.put ? r : { ...r, call, put };
}

/** The chain header's book: `book: {active, …}`, `book: true`, `venue: "book"` or `bookActive`; null = house prices. */
export function bookOfChain(raw: Obj): ChainBook | null {
  const b = raw.book;
  if (b && typeof b === "object") {
    const o = b as Obj;
    return {
      active: o.active !== false,
      premiumTick: num(o.premiumTick),
      marketBandPct: num(o.marketBandPct),
      limitBandPct: num(o.limitBandPct),
      bandMinTicks: num(o.bandMinTicks),
      makerFeePerContract: num(o.makerFeePerContract) ?? num((raw.fees as Obj | undefined)?.makerFeePerContract),
      takerFeePerContract: num(o.takerFeePerContract) ?? num((raw.fees as Obj | undefined)?.takerFeePerContract),
      feeCapPct: num(o.feeCapPct),
    };
  }
  if (b === true || raw.venue === "book" || raw.bookActive === true) {
    const f = (raw.fees ?? {}) as Obj;
    return { active: true, makerFeePerContract: num(f.makerFeePerContract), takerFeePerContract: num(f.takerFeePerContract), feeCapPct: num(f.feeCapPct) };
  }
  // rows with book fields but no header flag: the book is live
  const rows = Array.isArray(raw.rows) ? (raw.rows as Obj[]) : [];
  const probe = rows.find((r) => r && (r.call || r.put));
  const q = (probe?.call ?? probe?.put) as Obj | undefined;
  if (q && hasBookFields(q)) return { active: true };
  return null;
}

/** A chain from the service (REST or the stream's `chain` frame) with book quotes normalised. */
export function normChain<T extends OptionChain>(raw: T): T {
  const book = bookOfChain(raw as unknown as Obj);
  return { ...raw, book, pcr: num((raw as unknown as Obj).pcr) ?? null, rows: raw.rows.map(normRow) };
}

/** Premium tick of an underlying (quote currency per unit): the service's, else the §2 default. */
export function premiumTickOf(u: string, under?: Pick<OptionUnderlying, "premiumTick"> | null, chainBook?: ChainBook | null): number {
  const t = chainBook?.premiumTick ?? under?.premiumTick;
  if (t && t > 0) return t;
  const spec = OPTION_SPEC[u] ?? (parseSeriesCode(u) ? OPTION_SPEC[parseSeriesCode(u)!.underlying] : undefined);
  return spec ? defaultPremiumTick(spec) : 0.00001;
}

/** Snap a per-unit price to the tick (nearest; `dir` 1 = up, -1 = down). */
export function toTick(price: number, tick: number, dir: 0 | 1 | -1 = 0): number {
  if (!(tick > 0) || !Number.isFinite(price)) return price;
  const n = price / tick;
  const r = dir > 0 ? Math.ceil(n - 1e-9) : dir < 0 ? Math.floor(n + 1e-9) : Math.round(n);
  const d = Math.max(0, Math.min(10, Math.ceil(-Math.log10(tick) - 1e-9)));
  return +(r * tick).toFixed(d);
}

/* ------------------------------------------------------------------ */
/* Engine answers                                                      */
/* ------------------------------------------------------------------ */

function trigOf(v: unknown): StopTrigger | null {
  if (!v || typeof v !== "object") return null;
  const t = v as Obj;
  const price = num(t.price);
  if (price === undefined) return null;
  return { source: t.source === "underlying" ? "underlying" : "mark", op: t.op === "below" ? "below" : "above", price };
}

export function normOrder(raw: unknown): BookOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Obj;
  const id = str(x.id) ?? str(x.ticket);
  const series = str(x.series) ?? str(x.symbol) ?? str((x.option as Obj | undefined)?.series);
  if (!id || !series) return null;
  const qty = num(x.qty) ?? num(x.contracts) ?? 0;
  const filled = num(x.filled) ?? 0;
  const flags = Array.isArray(x.flags) ? (x.flags as unknown[]).map((f) => String(f).toLowerCase()) : [];
  if (x.postOnly === true && !flags.includes("post_only")) flags.push("post_only");
  if (x.reduceOnly === true && !flags.includes("reduce_only")) flags.push("reduce_only");
  const type = (["limit", "market", "stop_market", "stop_limit"] as const).find((t) => t === x.type) ?? "limit";
  const tif = (["gtc", "ioc", "fok", "gtd"] as const).find((t) => t === x.tif) ?? "gtc";
  return {
    id,
    series,
    side: x.side === "sell" ? "sell" : "buy",
    type,
    qty,
    filled,
    left: num(x.left) ?? Math.max(0, qty - filled),
    avgPrice: numOrNull(x.avgPrice),
    price: numOrNull(x.price),
    tif,
    expireAt: iso(x.expireAt),
    flags: flags.map((f) => f.replace(/-/g, "_").replace(/^postonly$/, "post_only").replace(/^reduceonly$/, "reduce_only")),
    reserved: num(x.reserved) ?? 0,
    createdAt: iso(x.createdAt) ?? iso(x.placedAt) ?? new Date().toISOString(),
    updatedAt: iso(x.updatedAt),
    status: str(x.status) ?? "working",
    reason: str(x.reason),
    trigger: trigOf(x.trigger),
  };
}

export function normFill(raw: unknown, fallback?: { series?: string; side?: "buy" | "sell" }): BookFill | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Obj;
  const price = num(x.price);
  const qty = num(x.qty);
  if (price === undefined || qty === undefined) return null;
  const fee = num(x.fee) ?? 0;
  return {
    fillId: str(x.fillId) ?? str(x.id) ?? "",
    orderId: str(x.orderId),
    series: str(x.series) ?? fallback?.series ?? "",
    side: x.side === "sell" ? "sell" : x.side === "buy" ? "buy" : (fallback?.side ?? "buy"),
    price,
    qty,
    role: str(x.role) ?? "taker",
    // a negative fee is a rebate
    fee: Math.max(0, fee),
    rebate: num(x.rebate) ?? (fee < 0 ? -fee : 0),
    positionTicket: str(x.positionTicket),
    kind: str(x.kind),
    comboId: str(x.comboId) ?? str(x.combo),
    at: iso(x.at) ?? iso(x.time) ?? new Date().toISOString(),
  };
}

export function normOrderResult(raw: unknown): BookOrderResult {
  const x = (raw && typeof raw === "object" ? raw : {}) as Obj;
  const order = normOrder(x.order);
  return {
    status: str(x.status) ?? order?.status ?? "working",
    order,
    fills: (Array.isArray(x.fills) ? x.fills : []).map((f) => normFill(f, { series: order?.series, side: order?.side })).filter((f): f is BookFill => !!f),
    reason: str(x.reason),
  };
}

/**
 * The engine's preview (`reserve`, `estFilled`, `estAvgPrice`, `fee`, `feeMaker`, `feeCapPct`, `price`, `contractSize`
 * …). What it leaves to the client is derived from the order: the part that rests (GTC / GTD limit orders), the maker
 * rebate on it when the maker fee is negative, and a market order's band (its `price` is the band's limit).
 */
export function normPreview(raw: unknown, req?: { type: string; side: string; qty: number; tif: string; price?: number }): BookPreview {
  const x = (raw && typeof raw === "object" ? raw : {}) as Obj;
  const band = x.band && typeof x.band === "object" ? (x.band as Obj) : null;
  const fee = num(x.fee) ?? num(x.takerFee) ?? 0;
  const estFilled = num(x.estFilled) ?? num(x.fillQty) ?? 0;
  const rests = !!req && req.type === "limit" && (req.tif === "gtc" || req.tif === "gtd");
  const estResting = num(x.estResting) ?? num(x.restQty) ?? (rests ? Math.max(0, req!.qty - estFilled) : 0);
  const makerRate = num(x.feeMaker);
  // USD per contract for one unit of premium, when the engine says it (else the rate alone bounds the rebate)
  const unitUsd = num(x.usdPerUnit);
  const capPct = num(x.feeCapPct);
  const restPx = req?.price ?? num(x.price);
  let rebate = num(x.rebate) ?? (fee < 0 ? -fee : 0);
  if (num(x.rebate) === undefined && makerRate !== undefined && makerRate < 0 && estResting > 0) {
    const byRate = -makerRate * estResting;
    const byCap = capPct !== undefined && restPx !== undefined && unitUsd !== undefined ? (capPct / 100) * restPx * unitUsd * estResting : Infinity;
    rebate = Math.round(Math.min(byRate, byCap) * 100) / 100;
  }
  const bandPx = num(x.price);
  const derivedBand = !band && req && (req.type === "market" || req.type === "stop_market") && bandPx !== undefined ? (req.side === "buy" ? { min: null, max: bandPx } : { min: bandPx, max: null }) : null;
  return {
    ok: x.ok !== false,
    reasons: Array.isArray(x.reasons) ? (x.reasons as BookPreview["reasons"]) : [],
    reserve: num(x.reserve) ?? num(x.reserved) ?? 0,
    estAvgPrice: numOrNull(x.estAvgPrice ?? x.avgPrice),
    estFilled,
    estResting,
    fee: Math.max(0, fee),
    rebate,
    band: band ? { min: numOrNull(band.min), max: numOrNull(band.max) } : derivedBand,
    marginBefore: num(x.marginBefore),
    marginAfter: num(x.marginAfter),
    freeMarginAfter: num(x.freeMarginAfter),
    estimate: x.estimate === true,
  };
}

export function normRfq(raw: unknown): Rfq | null {
  const x = (raw && typeof raw === "object" ? ((raw as Obj).rfq ?? raw) : null) as Obj | null;
  if (!x) return null;
  const id = str(x.id);
  if (!id) return null;
  return {
    id,
    expiresAt: iso(x.expiresAt) ?? new Date(Date.now() + 30_000).toISOString(),
    legs: (Array.isArray(x.legs) ? x.legs : []).map((l) => {
      const o = (l ?? {}) as Obj;
      return { series: str(o.series) ?? "", side: o.side === "sell" ? ("sell" as const) : ("buy" as const), ratio: num(o.ratio) ?? 1 };
    }),
    qty: num(x.qty) ?? 1,
    status: str(x.status),
  };
}

export function normRfqQuote(raw: unknown): RfqQuote | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Obj;
  const quoteId = str(x.quoteId) ?? str(x.id);
  if (!quoteId) return null;
  return { quoteId, responder: str(x.responder) ?? "kalks", bid: numOrNull(x.bid), ask: numOrNull(x.ask), qty: num(x.qty) ?? 0, validUntil: iso(x.validUntil) ?? new Date(Date.now() + 5_000).toISOString() };
}

/* ------------------------------------------------------------------ */
/* Market data frames (options-service WS `depth` / `tape`)            */
/* ------------------------------------------------------------------ */

function levels(v: unknown): { price: number; qty: number; orders?: number }[] {
  if (!Array.isArray(v)) return [];
  const out: { price: number; qty: number; orders?: number }[] = [];
  for (const l of v) {
    if (Array.isArray(l)) {
      const price = num(l[0]);
      const qty = num(l[1]);
      if (price !== undefined && qty !== undefined) out.push({ price, qty, orders: num(l[2]) });
    } else if (l && typeof l === "object") {
      const o = l as Obj;
      const price = num(o.price) ?? num(o.px) ?? num(o.p);
      const qty = num(o.qty) ?? num(o.size) ?? num(o.q);
      if (price !== undefined && qty !== undefined) out.push({ price, qty, orders: num(o.orders) ?? num(o.n) });
    }
  }
  return out.slice(0, 10);
}

export function normDepth(raw: unknown): SeriesDepth | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Obj;
  const series = str(x.series) ?? str(x.code);
  if (!series) return null;
  return { series, bids: levels(x.bids), asks: levels(x.asks), seq: num(x.seq), t: num(x.t) };
}

export function normTrade(raw: unknown, series?: string): TapeTrade | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Obj;
  const price = num(x.price) ?? num(x.px);
  const qty = num(x.qty) ?? num(x.size);
  const s = str(x.series) ?? series;
  if (price === undefined || qty === undefined || !s) return null;
  const side = x.side ?? x.takerSide ?? x.taker;
  const t = num(x.t) ?? (typeof x.at === "string" ? Date.parse(x.at) : undefined) ?? Date.now();
  return { id: str(x.id) ?? str(x.fillId) ?? `${s}-${t}-${price}-${qty}`, series: s, price, qty, side: side === "sell" ? "sell" : "buy", t: t < 1e12 ? t * 1000 : t, kind: str(x.kind) };
}
