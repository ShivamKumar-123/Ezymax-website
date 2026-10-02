"use client";

// Demo builds (NEXT_PUBLIC_KALKS_MODE=demo): the options service and the engine's options API answered in the
// browser. Chains come from the GK / BS / Black-76 pricer in @kalks/mock/options on the live (or simulated) quotes;
// fills, closes, working orders and expiry settlements are kept per demo login in localStorage and shown through the
// same option book as engine positions.
//
// The order book (docs/OPTIONS-EXCHANGE.md) is simulated too, for the showcase only: `BookSim` (price-time matching)
// with a market-maker ladder quoted from the same model under the same rules, a few resting orders of other clients
// and a trickle of outside trades, so the chain shows book prices with sizes, the depth / tape move, resting orders
// fill, and stop, reduce-only, IOC / FOK, post-only, amend, RFQ and partial closes behave like the engine. Live builds
// never load it. `localStorage["kalks.options.demo.book"] = "off"` shows the house-priced flow instead.
import { INSTRUMENT_MAP, fetchCandles, hashString, isMarketOpen, priceFeed, seeded } from "@kalks/mock";
import { BOOK_DEFAULTS, BookSim, OPTION_SPEC, clampMark, defaultPremiumTick, mockChain, mockExpiries, mockPremiumCandles, mockUnderlyings, parseSeriesCode, pricingContext, quoteSeries, scenarioMargin, tradeState, usdPerQuoteCcy, cutInstant, seriesCode, type OptionExpiry, type SimTrade } from "@kalks/mock/options";
import { buildHistory, fromChartTime } from "@/components/chart/engine";
import type { Timeframe } from "@/lib/trading";
import type { Result } from "@/lib/engine/client";
import type { OptionsApi } from "./api";
import type { BookApi } from "./book-api";
import { optionBook } from "./book";
import type { BookFill, BookOrder, BookOrderRequest, BookOrderResult, BookPreview, CloseResult, OptionCandles, OptionChain, OptionInfo, OptionQuote, OptOrder, OptPosition, OrderRequest, Rfq, RfqQuote, SeriesDepth, Settlement, Side, TapeTrade } from "./types";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (code: string, message: string, status = 422): Result<never> => ({ ok: false, err: { status, code, message } });

const mid = (s: string) => {
  const q = priceFeed().snapshot(s);
  return q && q.bid > 0 ? (q.bid + q.ask) / 2 : undefined;
};

export function demoExpiries(u: string): OptionExpiry[] {
  return mockExpiries(u, Date.now());
}

export function demoChain(u: string, expiry?: string | null): OptionChain | null {
  const spec = OPTION_SPEC[u];
  if (!spec) return null;
  const list = demoExpiries(u);
  const e = list.find((x) => x.date === expiry) ?? list[0];
  const q = priceFeed().snapshot(u);
  if (!e || !q || !(q.bid > 0)) return null;
  const chain = mockChain({ symbol: u, expiry: e, spot: { bid: q.bid, ask: q.ask }, nowMs: Date.now(), usdPerQuote: usdPerQuoteCcy(spec.quoteCcy, mid) });
  if (!demoBookOn()) return chain;
  const now = Date.now();
  const rows = chain.rows.map((r) => ({ ...r, call: r.call ? bookQuote(r.call, now) : null, put: r.put ? bookQuote(r.put, now) : null }));
  const oi = (side: "call" | "put") => rows.reduce((n, r) => n + (r[side]?.oi ?? 0), 0);
  const tick = defaultPremiumTick(spec);
  return {
    ...chain,
    rows,
    pcr: oi("call") > 0 ? +(oi("put") / oi("call")).toFixed(2) : null,
    book: { active: true, premiumTick: tick, marketBandPct: BOOK_DEFAULTS.marketBandPct, limitBandPct: BOOK_DEFAULTS.limitBandPct, bandMinTicks: BOOK_DEFAULTS.bandMinTicks, makerFeePerContract: BOOK_DEFAULTS.makerFeePerContract, takerFeePerContract: BOOK_DEFAULTS.takerFeePerContract, feeCapPct: BOOK_DEFAULTS.feeCapPct },
  };
}

/** One series priced by the model now (house prices; the theo of the book). */
function modelQuote(code: string): OptionQuote | null {
  const p = parseSeriesCode(code);
  const spec = p && OPTION_SPEC[p.underlying];
  const q = p && priceFeed().snapshot(p.underlying);
  if (!p || !spec || !q || !(q.bid > 0)) return null;
  const cut = cutInstant(p.date);
  const now = Date.now();
  const ctx = pricingContext(spec, (q.bid + q.ask) / 2, cut, now, usdPerQuoteCcy(spec.quoteCcy, mid));
  return quoteSeries(ctx, p.right, p.strike, code, tradeState(cut, now));
}

/** One series priced now (positions and legs outside the chain on screen): the book's quote when the book is on. */
export function demoQuote(code: string): OptionQuote | null {
  const q = modelQuote(code);
  return q && demoBookOn() ? bookQuote(q, Date.now()) : q;
}

const TF_OF_MINUTES: Record<number, Timeframe> = { 1: "M1", 5: "M5", 15: "M15", 30: "M30", 60: "H1", 240: "H4", 1440: "D1" };

/**
 * The simulator's chart history is scaled for looks and swings far more than the options' implied vol, which would
 * bury the time decay under moneyness: its moves around the current price are scaled down to the 1-week ATM vol
 * (same shape, same last price). Market-data candles are used as they are.
 */
function toImpliedVol(bars: { t: number; o: number; h: number; l: number; c: number }[], tfMinutes: number, atmVol: number) {
  if (bars.length < 3) return bars;
  const rets: number[] = [];
  for (let i = 1; i < bars.length; i++) if (bars[i - 1]!.c > 0 && bars[i]!.c > 0) rets.push(Math.log(bars[i]!.c / bars[i - 1]!.c));
  const mean = rets.reduce((a, b) => a + b, 0) / Math.max(1, rets.length);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1));
  const realized = sd * Math.sqrt((260 * 1440) / tfMinutes);
  const k = realized > 0 ? Math.min(1, Math.max(0.05, atmVol / realized)) : 1;
  if (k >= 0.999) return bars;
  const last = bars[bars.length - 1]!.c;
  const f = (x: number) => last * Math.exp(k * Math.log(x / last));
  return bars.map((b) => ({ t: b.t, o: f(b.o), h: f(b.h), l: f(b.l), c: f(b.c) }));
}

/**
 * Premium candles of one series, priced bar by bar from the underlying's own history (market-data candles when the
 * feed is live, else the simulator's history the chart shows, at the option's vol) with the demo pricer.
 */
async function demoCandles(code: string, tf: number, opts: { limit?: number; to?: number } = {}): Promise<Result<OptionCandles>> {
  const p = parseSeriesCode(code);
  const spec = p && OPTION_SPEC[p.underlying];
  const tfName = TF_OF_MINUTES[tf];
  if (!p || !spec || !tfName) return fail("bad_request", "Unknown series or timeframe.", 400);
  if (!INSTRUMENT_MAP[p.underlying]) return fail("not_found", "No history for this underlying.", 404);
  let bars: { t: number; o: number; h: number; l: number; c: number }[] | null = null;
  if (priceFeed().mode === "live") {
    const live = await fetchCandles(p.underlying, tfName, Math.min(1500, opts.limit ?? 600), opts.to);
    if (live?.length) bars = live.map((b) => ({ t: b.time, o: b.open, h: b.high, l: b.low, c: b.close }));
  }
  if (!bars) {
    // the simulator's history is one page: nothing older than it
    if (opts.to) return ok({ ...mockPremiumCandles({ code, tfMinutes: tf, bars: [], usdPerQuote: 1 })!, candles: [] });
    bars = toImpliedVol(
      buildHistory(p.underlying, tfName).map((b) => ({ t: fromChartTime(b.time), o: b.open, h: b.high, l: b.low, c: b.close })),
      tf,
      spec.atm[1],
    );
  }
  if (opts.to) bars = bars.filter((b) => b.t <= opts.to!);
  const r = mockPremiumCandles({ code, tfMinutes: tf, bars, usdPerQuote: usdPerQuoteCcy(spec.quoteCcy, mid) });
  if (!r) return fail("not_found", "Series not found.", 404);
  return ok(opts.limit ? { ...r, candles: r.candles.slice(-opts.limit) } : r);
}

/* ------------------------------------------------------------------ */
/* Demo book (per login, localStorage)                                 */
/* ------------------------------------------------------------------ */

interface DemoBook {
  positions: OptPosition[];
  orders: (OptOrder & { req: { sl?: number; tp?: number; trigger?: OrderRequest["trigger"] } })[];
  settlements: Settlement[];
  /** order book: every order of the login (working first, then history) and its fills */
  bookOrders: BookOrder[];
  fills: BookFill[];
  /** exit deals of closed option trades (History › Options, the Closed tab), newest first */
  deals: Record<string, unknown>[];
}

const KEY = (login: string) => `kalks.options.demo.v1.${login}`;
const books = new Map<string, DemoBook>();
let seq = 71_200_000;
const ticket = () => String((seq += 1 + Math.floor(Math.random() * 5)));

function load(login: string): DemoBook {
  let b = books.get(login);
  if (b) return b;
  b = { positions: [], orders: [], settlements: seedSettlements(login), bookOrders: [], fills: [], deals: [] };
  try {
    const raw = localStorage.getItem(KEY(login));
    if (raw) {
      const v = JSON.parse(raw) as Partial<DemoBook>;
      b = {
        positions: Array.isArray(v.positions) ? v.positions : [],
        orders: Array.isArray(v.orders) ? v.orders : [],
        settlements: Array.isArray(v.settlements) ? v.settlements : b.settlements,
        bookOrders: Array.isArray(v.bookOrders) ? v.bookOrders : [],
        fills: Array.isArray(v.fills) ? v.fills : [],
        deals: Array.isArray(v.deals) ? v.deals : [],
      };
    }
  } catch {
    /* storage blocked */
  }
  books.set(login, b);
  // tickets and deal ids continue after the ones the stored book already uses (the counters restart with the page:
  // a new position must never reuse the ticket of one kept from an earlier visit)
  const nums = (xs: unknown[]) => xs.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  const maxTicket = Math.max(0, ...nums([...b.positions.map((p) => p.ticket), ...b.orders.map((o) => o.ticket), ...b.settlements.map((x) => x.ticket), ...b.deals.map((d) => d.positionTicket)]));
  if (maxTicket >= seq) seq = maxTicket;
  const maxDeal = Math.max(0, ...nums(b.deals.map((d) => d.id)));
  if (maxDeal >= dealSeq) dealSeq = maxDeal;
  optionBook.setDeals(login, b.deals, false);
  settleExpired(login, b);
  restoreBookOrders(login, b);
  optionBook.set(login, b.positions, b.orders);
  return b;
}

function save(login: string, b: DemoBook) {
  books.set(login, b);
  optionBook.set(login, b.positions, b.orders);
  bookListeners.forEach((l) => l(login));
  try {
    if (b.bookOrders.length > 300) b.bookOrders = [...b.bookOrders.filter((o) => o.left > 0), ...b.bookOrders.filter((o) => o.left <= 0).slice(0, 200)];
    if (b.fills.length > 300) b.fills = b.fills.slice(0, 300);
    if (b.deals.length > 300) b.deals = b.deals.slice(0, 300);
    localStorage.setItem(KEY(login), JSON.stringify(b));
  } catch {
    /* storage blocked: the book lasts for this page */
  }
}

let dealSeq = 61_000_000;

/**
 * A closed (part of a) position as the engine reports it: an exit deal with the option, the premiums per unit, the
 * gross P&L in USD, the commission and the reason (client, expiry, stop_out …). Kept with the demo book and shown in
 * History › Options and the Closed tab.
 */
function recordClose(login: string, b: DemoBook, p: OptPosition, qty: number, closePx: number, gross: number, commission: number, reason: string, fixing?: number) {
  // the closed part carries its share of the opening commission (the engine's entry deal)
  const entryShare = p.contracts > 0 ? p.commission * Math.min(1, qty / p.contracts) : 0;
  p.commission = +(p.commission - entryShare).toFixed(2);
  commission += entryShare;
  const deal = {
    id: (dealSeq += 1 + Math.floor(Math.random() * 3)),
    login: Number(login) || login,
    positionTicket: Number(p.ticket) || p.ticket,
    orderTicket: null,
    symbol: p.option.series,
    option: fixing !== undefined ? { ...p.option, fixing } : { ...p.option },
    side: p.side === "buy" ? "sell" : "buy",
    positionSide: p.side,
    entry: "out",
    volume: qty,
    price: closePx,
    profit: +gross.toFixed(2),
    swap: 0,
    commission: +commission.toFixed(2),
    reason,
    time: new Date().toISOString(),
    openPrice: p.openPrice,
    openTime: p.openTime,
    source: "manual",
    comboId: p.comboId,
  };
  b.deals.unshift(deal);
  optionBook.addDeal(login, deal, false);
}

/** A short settlement history so the tab isn't empty on a fresh demo account. */
function seedSettlements(login: string): Settlement[] {
  const now = Date.now();
  const rows: [string, number, "buy" | "sell", number, number, number][] = [
    ["EURUSD", 1.1625, "buy", 2, 9, 1],
    ["XAUUSD", 2625, "buy", 1, 6, 1],
    ["USDJPY", 149.5, "sell", 3, 4, 1],
    ["GBPUSD", 1.345, "buy", 1, 2, 1],
  ];
  return rows.map(([u, k, side, n, daysAgo, run], i) => {
    const spec = OPTION_SPEC[u]!;
    const date = new Date(now - daysAgo * 86_400_000);
    while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
    const d = date.toISOString().slice(0, 10);
    const right: "call" | "put" = i % 2 ? "put" : "call";
    const fixing = +(k * (1 + (i % 2 ? -0.004 : 0.003))).toFixed(spec.digits);
    const intrinsic = Math.max(0, right === "call" ? fixing - k : k - fixing);
    const usd = spec.contractSize * (spec.quoteCcy === "USD" ? 1 : 1 / (mid(`USD${spec.quoteCcy}`) ?? 150));
    const payout = (side === "buy" ? 1 : -1) * intrinsic * usd * n;
    return { ticket: String(71_100_000 + (Number(login.slice(-3)) || 0) * 10 + i), series: seriesCode(u, d, k, right, spec.strikeStep), side, contracts: n, fixing, payout: +payout.toFixed(2), at: new Date(cutInstant(d)).toISOString(), run };
  });
}

/** Positions whose cut has passed settle at the current mid (the service uses a 30-minute TWAP). */
function settleExpired(login: string, b: DemoBook) {
  const now = Date.now();
  const due = b.positions.filter((p) => Date.parse(p.option.expiryAt) <= now);
  if (!due.length) return;
  for (const p of due) {
    const spec = OPTION_SPEC[p.option.underlying];
    const fixing = mid(p.option.underlying) ?? p.option.strike;
    const usd = spec ? spec.contractSize * usdPerQuoteCcy(spec.quoteCcy, mid) : 0;
    const intrinsic = Math.max(0, p.option.right === "call" ? fixing - p.option.strike : p.option.strike - fixing);
    recordClose(login, b, p, p.contracts, intrinsic, (p.side === "buy" ? 1 : -1) * (intrinsic - p.openPrice) * usd * p.contracts, 0, "expiry", spec ? +fixing.toFixed(spec.digits) : fixing);
    b.settlements.unshift({ ticket: p.ticket, series: p.option.series, side: p.side, contracts: p.contracts, fixing: spec ? +fixing.toFixed(spec.digits) : fixing, payout: +((p.side === "buy" ? 1 : -1) * intrinsic * usd * p.contracts).toFixed(2), profit: +((p.side === "buy" ? 1 : -1) * (intrinsic - p.openPrice) * usd * p.contracts).toFixed(2), at: p.option.expiryAt, run: 1 });
  }
  b.positions = b.positions.filter((p) => !due.includes(p));
  save(login, b);
}

function infoOf(code: string): OptionInfo | null {
  const p = parseSeriesCode(code);
  const spec = p && OPTION_SPEC[p.underlying];
  if (!p || !spec) return null;
  return { series: code, underlying: p.underlying, right: p.right, strike: p.strike, expiry: p.date, expiryAt: new Date(cutInstant(p.date)).toISOString(), style: "european", barrier: null, contractSize: spec.contractSize };
}

/* ------------------------------------------------------------------ */
/* Working orders: limit premium / underlying trigger (checked every 1.5 s) */
/* ------------------------------------------------------------------ */

let worker: ReturnType<typeof setInterval> | null = null;
const workerListeners = new Set<(login: string, o: OptOrder, filled: boolean) => void>();

/** The demo fills a working order (the workspace toasts it like an engine notification). */
export function onDemoOrderEvent(l: (login: string, o: OptOrder, filled: boolean) => void) {
  workerListeners.add(l);
  return () => void workerListeners.delete(l);
}

function ensureWorker() {
  if (worker || typeof window === "undefined") return;
  worker = setInterval(() => {
    let busy = false;
    for (const [login, b] of books) {
      if (!b.orders.length) continue;
      busy = true;
      const keep: DemoBook["orders"] = [];
      let changed = false;
      for (const o of b.orders) {
        const q = modelQuote(o.option.series);
        const spot = mid(o.option.underlying);
        if (!q || spot === undefined || !isMarketOpen(o.option.underlying)) {
          keep.push(o);
          continue;
        }
        if (q.state === "closed") {
          changed = true;
          workerListeners.forEach((l) => l(login, o, false));
          continue;
        }
        const trig = o.trigger;
        const armed = !trig || (trig.op === "above" ? spot >= trig.price : spot <= trig.price);
        const px = o.side === "buy" ? q.ask : q.bid;
        const marketable = o.price === undefined || (o.side === "buy" ? px <= o.price : px >= o.price);
        if (armed && marketable && q.state === "open") {
          changed = true;
          b.positions.push({ ticket: o.ticket, login, side: o.side, contracts: o.contracts, openPrice: px, openTime: new Date().toISOString(), commission: commissionOf(q, o.contracts, px), option: o.option, comboId: o.comboId, sl: o.req.sl, tp: o.req.tp });
          workerListeners.forEach((l) => l(login, o, true));
        } else keep.push(o);
      }
      if (changed) {
        b.orders = keep;
        save(login, b);
      }
    }
    if (!busy && worker) {
      clearInterval(worker);
      worker = null;
    }
  }, 1500);
}

function commissionOf(q: OptionQuote, contracts: number, px: number) {
  const usdPerUnit = q.ask > 0 ? q.askUsd / q.ask : 0;
  return +Math.min(0.25 * contracts, 0.1 * px * usdPerUnit * contracts).toFixed(2);
}

/* ------------------------------------------------------------------ */
/* The API                                                             */
/* ------------------------------------------------------------------ */

export const mockApi: OptionsApi = {
  underlyings: async () => ok({ underlyings: mockUnderlyings(Date.now()), version: 1 }),
  expiries: async (_login, u) => (OPTION_SPEC[u] ? ok({ underlying: u, expiries: demoExpiries(u) }) : fail("not_found", "Underlying not found.", 404)),
  chain: async (_login, u, expiry) => {
    const c = demoChain(u, expiry);
    return c ? ok(c) : fail("no_price", "No price for this underlying yet.", 503);
  },
  publicChain: async (u, expiry) => {
    const c = demoChain(u, expiry);
    return c ? ok({ ...c, expiries: demoExpiries(u).map((e) => ({ date: e.date, kinds: e.kinds, cutAt: e.cutAt })) }) : fail("no_price", "No price for this underlying yet.", 503);
  },
  candles: (_login, code, tf, opts) => demoCandles(code, tf, opts),
  streamTicket: async () => fail("unavailable", "Demo builds price in the browser.", 503),
  publicStreamUrl: async () => fail("unavailable", "Demo builds price in the browser.", 503),
  preview: async (_login, _req, local) => ok({ ...local(), estimate: false }),
  order: async (login, req) => {
    if (login === "guest") return fail("unauthorized", "Log in to a trading account.", 401);
    const b = load(login);
    const comboId = req.legs.length > 1 ? `c${Date.now().toString(36)}` : undefined;
    const fills: OptPosition[] = [];
    const working: DemoBook["orders"] = [];
    for (const l of req.legs) {
      const info = infoOf(l.series);
      const q = modelQuote(l.series);
      if (!info || !q) return fail("no_price", "No price for this series.", 503);
      if (!isMarketOpen(info.underlying)) return fail("market_closed", "Market closed.");
      if (q.state === "closed") return fail("cutoff", "Trading has stopped for this expiry.");
      if (q.state === "close_only") return fail("close_only", "Only closing is allowed before the cut.");
      const px = l.side === "buy" ? q.ask : q.bid;
      const limit = req.type === "limit" && req.legs.length === 1 ? req.limitPremium : undefined;
      const marketable = limit === undefined || (l.side === "buy" ? px <= limit : px >= limit);
      if (req.trigger || !marketable) {
        working.push({ ticket: ticket(), login, side: l.side, contracts: l.contracts, type: req.trigger ? "trigger" : "limit", price: limit, trigger: req.trigger ?? null, comboId, placedAt: new Date().toISOString(), option: info, req: { sl: req.sl, tp: req.tp, trigger: req.trigger } });
      } else {
        fills.push({ ticket: ticket(), login, side: l.side, contracts: l.contracts, openPrice: limit !== undefined ? limit : px, openTime: new Date().toISOString(), commission: commissionOf(q, l.contracts, px), option: info, comboId, sl: req.sl, tp: req.tp });
      }
    }
    b.positions = [...b.positions, ...fills];
    b.orders = [...b.orders, ...working];
    save(login, b);
    if (working.length) ensureWorker();
    return ok(working.length ? { status: "placed", order: working[0] } : { status: "filled", positions: fills });
  },
  closePosition: async (login, t, contracts) => {
    const b = load(login);
    const p = b.positions.find((x) => x.ticket === t);
    if (!p) return fail("not_found", "Position not found.", 404);
    if (!isMarketOpen(p.option.underlying)) return fail("market_closed", "Market closed.");
    const q = modelQuote(p.option.series);
    if (!q) return fail("no_price", "No price for this series.", 503);
    if (q.state === "closed") return fail("cutoff", "Trading has stopped for this expiry.");
    const n = Math.min(p.contracts, contracts ?? p.contracts);
    const px = p.side === "buy" ? q.bid : q.ask;
    const usdPerUnit = q.ask > 0 ? q.askUsd / q.ask : 0;
    const profit = (p.side === "buy" ? 1 : -1) * (px - p.openPrice) * usdPerUnit * n;
    recordClose(login, b, p, n, px, profit, commissionOf(q, n, px), "client");
    b.positions = n >= p.contracts ? b.positions.filter((x) => x.ticket !== t) : b.positions.map((x) => (x.ticket === t ? { ...x, contracts: x.contracts - n } : x));
    save(login, b);
    return ok({ status: "closed", profit: +profit.toFixed(2) });
  },
  closeCombo: async (login, comboId) => {
    const b = load(login);
    const legs = b.positions.filter((p) => p.comboId === comboId);
    if (!legs.length) return fail("not_found", "Strategy not found.", 404);
    let profit = 0;
    for (const p of legs) {
      const q = modelQuote(p.option.series);
      if (!q || !isMarketOpen(p.option.underlying)) return fail("market_closed", "Market closed.");
      const px = p.side === "buy" ? q.bid : q.ask;
      const legProfit = (p.side === "buy" ? 1 : -1) * (px - p.openPrice) * (q.ask > 0 ? q.askUsd / q.ask : 0) * p.contracts;
      profit += legProfit;
      recordClose(login, b, p, p.contracts, px, legProfit, commissionOf(q, p.contracts, px), "client");
    }
    b.positions = b.positions.filter((p) => p.comboId !== comboId);
    save(login, b);
    return ok({ status: "closed", profit: +profit.toFixed(2), closed: legs.map((p) => Number(p.ticket)) });
  },
  cancelOrder: async (login, t) => {
    const b = load(login);
    if (!b.orders.some((o) => o.ticket === t)) return fail("not_found", "Order not found.", 404);
    b.orders = b.orders.filter((o) => o.ticket !== t);
    save(login, b);
    return ok({ status: "cancelled" });
  },
  settlements: async (login) => {
    const b = load(login);
    settleExpired(login, b);
    return ok({ items: b.settlements });
  },
};

/** Demo builds: load the login's option book (positions survive a reload). */
export function demoBoot(login: string) {
  if (login && login !== "guest") {
    const b = load(login);
    if (b.orders.length) ensureWorker();
  }
}

/* ------------------------------------------------------------------ */
/* Order book (demo showcase): simulator, account side, stops, RFQ     */
/* ------------------------------------------------------------------ */

const BOOK_KEY = "kalks.options.demo.book";

/** The demo build shows the order book unless `localStorage["kalks.options.demo.book"] = "off"` (house prices). */
export function demoBookOn(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(BOOK_KEY) !== "off";
  } catch {
    return true;
  }
}

const sim = new BookSim("9");
const lastSync = new Map<string, number>();
const bookListeners = new Set<(login: string) => void>();

/** A demo login's book orders or fills changed (the Orders tab and the depth highlight refresh). */
export function onDemoBookChange(l: (login: string) => void) {
  bookListeners.add(l);
  return () => void bookListeners.delete(l);
}

export interface DemoBookEvent {
  login: string;
  kind: "fill" | "stop_triggered" | "stop_rejected" | "expired";
  order: BookOrder | null;
  fill?: BookFill;
}
const eventListeners = new Set<(e: DemoBookEvent) => void>();

/** Book events the trader didn't cause from the ticket (a resting order filled, a stop fired, a GTD order expired). */
export function onDemoBookEvent(l: (e: DemoBookEvent) => void) {
  eventListeners.add(l);
  return () => void eventListeners.delete(l);
}
const emit = (e: DemoBookEvent) => eventListeners.forEach((l) => l(e));

const r2 = (v: number) => Math.round(v * 100) / 100;
const specOfCode = (code: string) => {
  const p = parseSeriesCode(code);
  const spec = p ? OPTION_SPEC[p.underlying] : undefined;
  return p && spec ? { p, spec } : null;
};
const tickOf = (code: string) => {
  const s = specOfCode(code);
  return s ? defaultPremiumTick(s.spec) : 0.00001;
};
const usdUnitOf = (q: Pick<OptionQuote, "mark" | "markUsd" | "ask" | "askUsd">) => (q.mark > 0 && q.markUsd > 0 ? q.markUsd / q.mark : q.ask > 0 ? q.askUsd / q.ask : 0);
const roundPx = (code: string, v: number) => {
  const s = specOfCode(code);
  return +v.toFixed(s ? s.spec.digits + 3 : 8);
};

function isMarketOpenSafe(u: string) {
  try {
    return isMarketOpen(u);
  } catch {
    return true;
  }
}

/** Keeps a series' market-maker ladder in step with the model (at most twice a second per series, or now). */
function syncSeries(q: OptionQuote, now: number, force = false) {
  const code = q.code;
  if (!force && now - (lastSync.get(code) ?? 0) < 450 && sim.has(code)) return;
  lastSync.set(code, now);
  const sp = specOfCode(code);
  if (!sp) return;
  const tick = defaultPremiumTick(sp.spec);
  const rnd = seeded(hashString(code)).next;
  const d = Math.abs(q.delta);
  sim.seed(code, Math.max(1, Math.round(q.mark / tick)), d < 0.02 ? 0 : 600 * Math.exp(-(((d - 0.5) / 0.22) ** 2)) * (0.4 + rnd()), rnd, now);
  // cancel-all: after cut − 1 min (the LP exemption ends), halted, or the market is closed
  if (q.state === "closed" || q.state === "halted" || !isMarketOpenSafe(sp.p.underlying)) return sim.pullMm(code);
  const bidT = Math.floor(q.bid / tick + 1e-9);
  let askT = Math.ceil(q.ask / tick - 1e-9);
  if (askT - bidT < 2) askT = bidT + 2;
  sim.quoteMm(code, bidT, askT, Math.max(1, Math.round(8 * (0.4 + Math.min(1, d * 2)))), now);
}

/** A model quote with the simulated book on top: best bid / offer with sizes, last, OI, volume, mark clamped (§6). */
function bookQuote(q: OptionQuote, now: number): OptionQuote {
  syncSeries(q, now);
  const tick = tickOf(q.code);
  const k = usdUnitOf(q);
  const top = sim.top(q.code);
  const st = sim.stats(q.code);
  const bid = top.bid === null ? null : top.bid * tick;
  const ask = top.ask === null ? null : top.ask * tick;
  const mark = clampMark(q.mark, bid, ask);
  const last = st.last === null ? null : st.last * tick;
  const pip = specOfCode(q.code)?.spec.pipSize;
  return {
    ...q,
    book: true,
    bid: bid === null ? 0 : roundPx(q.code, bid),
    ask: ask === null ? 0 : roundPx(q.code, ask),
    bidUsd: bid === null ? 0 : r2(bid * k),
    askUsd: ask === null ? 0 : r2(ask * k),
    bidQty: top.bidQty,
    askQty: top.askQty,
    mark: roundPx(q.code, mark),
    markUsd: r2(mark * k),
    markPips: pip ? +(mark / pip).toFixed(1) : q.markPips,
    theo: q.mark,
    theoUsd: q.markUsd,
    theoIv: q.iv,
    markIv: q.iv,
    bidIv: bid === null ? null : q.ivBid,
    askIv: ask === null ? null : q.ivAsk,
    last: last === null ? null : roundPx(q.code, last),
    lastUsd: last === null ? null : r2(last * k),
    lastQty: st.lastQty,
    ltp: last === null ? null : roundPx(q.code, last),
    oi: st.oi,
    volume: st.volume,
    change: st.change === null ? null : +st.change.toFixed(4),
  };
}

/** Depth of a series for the demo stream / public fallback (10 levels, prices per unit). */
export function demoDepth(code: string): SeriesDepth | null {
  const q = modelQuote(code);
  if (!q) return null;
  syncSeries(q, Date.now());
  const tick = tickOf(code);
  const d = sim.depth(code, 10);
  const lv = (l: { px: number; qty: number; orders: number }) => ({ price: roundPx(code, l.px * tick), qty: l.qty, orders: l.orders });
  return { series: code, bids: d.bids.map(lv), asks: d.asks.map(lv), t: Date.now() };
}

/** The latest prints of a series, newest first. */
export function demoTrades(code: string, limit = 60): TapeTrade[] {
  const tick = tickOf(code);
  return sim.trades(code, limit).map((t) => ({ id: t.id, series: t.series, price: roundPx(code, t.px * tick), qty: t.qty, side: t.takerSide, t: t.at, kind: t.kind }));
}

/* ---- the account side: fills net FIFO, then one netted book position per series ---- */

let placing = false;
let comboCtx: { comboId: string } | null = null;
let realized = 0;

function positionQty(b: DemoBook, series: string, side: Side) {
  return b.positions.filter((p) => p.option.series === series && p.side === side).reduce((n, p) => n + p.contracts, 0);
}

function applyFill(login: string, b: DemoBook, t: SimTrade, role: "maker" | "taker") {
  const side: Side = role === "taker" ? t.takerSide : t.takerSide === "buy" ? "sell" : "buy";
  const orderId = role === "taker" ? t.takerOrder : t.makerOrder;
  const px = roundPx(t.series, t.px * tickOf(t.series));
  const mq = modelQuote(t.series);
  const k = mq ? usdUnitOf(mq) : (specOfCode(t.series)?.spec.contractSize ?? 0);
  const cap = (BOOK_DEFAULTS.feeCapPct / 100) * px * k * t.qty;
  const fee = role === "taker" ? r2(Math.min(BOOK_DEFAULTS.takerFeePerContract * t.qty, cap)) : 0;
  const rebate = role === "maker" ? r2(Math.min(-BOOK_DEFAULTS.makerFeePerContract * t.qty, cap)) : 0;
  let left = t.qty;
  let ticketNo: string | undefined;
  const now = new Date(t.at).toISOString();
  if (!comboCtx) {
    // nets FIFO against the open positions of the opposite side (legacy and book)
    const opp = b.positions.filter((p) => p.option.series === t.series && p.side !== side).sort((a, c) => Date.parse(a.openTime) - Date.parse(c.openTime));
    for (const p of opp) {
      if (left <= 0) break;
      const n = Math.min(left, p.contracts);
      const legGross = (p.side === "buy" ? 1 : -1) * (px - p.openPrice) * k * n;
      realized += legGross;
      recordClose(login, b, p, n, px, legGross, (fee - rebate) * (n / t.qty), t.kind === "liquidation" ? "stop_out" : "client");
      p.contracts -= n;
      left -= n;
      ticketNo ??= p.ticket;
    }
    b.positions = b.positions.filter((p) => p.contracts > 0);
  }
  if (left > 0) {
    // the opening part carries its share of the fee (the closing part's share went to the closed trades)
    const openFee = (fee - rebate) * (left / t.qty);
    const same = comboCtx ? undefined : b.positions.find((p) => p.option.series === t.series && p.side === side && p.venue === "book" && !p.comboId);
    if (same) {
      same.openPrice = roundPx(t.series, (same.openPrice * same.contracts + px * left) / (same.contracts + left));
      same.contracts += left;
      same.commission = r2(same.commission + openFee);
      ticketNo = same.ticket;
    } else {
      const info = infoOf(t.series);
      if (info) {
        ticketNo = ticket();
        b.positions.push({ ticket: ticketNo, login, side, contracts: left, openPrice: px, openTime: now, commission: r2(openFee), option: info, venue: "book", comboId: comboCtx?.comboId });
      }
    }
  }
  const fill: BookFill = { fillId: t.id, orderId, series: t.series, side, price: px, qty: t.qty, role, fee, rebate, positionTicket: ticketNo, kind: t.kind === "combo" ? "rfq" : t.kind, comboId: comboCtx?.comboId, at: now };
  b.fills.unshift(fill);
  const o = b.bookOrders.find((x) => x.id === orderId);
  if (o) {
    o.avgPrice = roundPx(t.series, ((o.avgPrice ?? 0) * o.filled + px * t.qty) / (o.filled + t.qty));
    o.filled += t.qty;
    o.left = Math.max(0, o.left - t.qty);
    o.status = o.left > 0 ? "partially_filled" : "filled";
    o.updatedAt = now;
    o.reserved = reserveFor(b, o.series, o.side, o.left, o.price);
  }
  save(login, b);
  if (!(placing && role === "taker") && !comboCtx) emit({ login, kind: "fill", order: o ?? null, fill });
}

sim.onTrade = (t) => {
  for (const [owner, role] of [
    [t.maker, "maker"],
    [t.taker, "taker"],
  ] as const) {
    const b = books.get(owner);
    if (b) applyFill(owner, b, t, role);
  }
};

/** USD of one short contract's standalone scenario margin (no offsets), the opening part of a sell (§3). */
function shortMargin(series: string, q: OptionQuote): number {
  const sp = specOfCode(series);
  const spot = sp ? mid(sp.p.underlying) : undefined;
  if (!sp || spot === undefined) return 0;
  const ctx = pricingContext(sp.spec, spot, cutInstant(sp.p.date), Date.now(), usdPerQuoteCcy(sp.spec.quoteCcy, mid));
  return scenarioMargin(ctx, [{ right: sp.p.right, strike: sp.p.strike, qty: -1, iv: q.iv }]);
}

/** Order margin (§3): a buy holds its premium and the worst-case fee; a sell's opening part its scenario margin. */
function reserveFor(b: DemoBook, series: string, side: Side, left: number, price: number | null): number {
  if (left <= 0) return 0;
  const q = modelQuote(series);
  if (!q) return 0;
  const k = usdUnitOf(q);
  const px = price ?? (side === "buy" ? q.ask : q.bid);
  const fee = Math.min(BOOK_DEFAULTS.takerFeePerContract * left, (BOOK_DEFAULTS.feeCapPct / 100) * px * k * left);
  if (side === "buy") return r2(left * px * k + fee);
  const opening = Math.max(0, left - positionQty(b, series, "buy"));
  return r2(opening * shortMargin(series, q) + fee);
}

type Checked =
  | { ok: true; tick: number; k: number; q: OptionQuote; markT: number; px: number; tif: "gtc" | "ioc" | "fok" | "gtd"; maxFill?: number; expireAt?: number }
  | { ok: false; code: string; message: string };

const MESSAGES: Record<string, string> = {
  no_price: "No price for this series.",
  market_closed: "Market closed.",
  cutoff: "Trading has stopped for this expiry.",
  series_halted: "This series is halted.",
  close_only: "Only closing is allowed before the cut.",
  limit_contracts: "Outside the contract limits.",
  price_out_of_band: "The price is too far from the mark.",
  invalid_price: "Enter a price.",
  reduce_only: "Reduce-only: there is no position to reduce.",
  post_only_gtc: "Post-only orders must be Good till cancelled.",
  bad_expiry: "Choose an expiry time before the cut.",
  not_found: "Order not found.",
};

function check(b: DemoBook, req: BookOrderRequest, now: number): Checked {
  const fail = (code: string): Checked => ({ ok: false, code, message: MESSAGES[code] ?? code });
  const sp = specOfCode(req.series);
  // the market maker re-quotes on every underlying tick: bring its ladder to the price of this instant first
  const mq = modelQuote(req.series);
  if (mq && demoBookOn()) syncSeries(mq, now, true);
  const q = mq && demoBookOn() ? bookQuote(mq, now) : mq;
  if (!sp || !q) return fail("no_price");
  if (!isMarketOpenSafe(sp.p.underlying)) return fail("market_closed");
  if (q.state === "closed") return fail("cutoff");
  if (q.state === "halted") return fail("series_halted");
  if (!Number.isInteger(req.qty) || req.qty < 1 || req.qty > 100) return fail("limit_contracts");
  const closing = positionQty(b, req.series, req.side === "buy" ? "sell" : "buy");
  const opening = Math.max(0, req.qty - closing);
  if (q.state === "close_only" && opening > 0 && !req.reduceOnly) return fail("close_only");
  const maxFill = req.reduceOnly ? closing : undefined;
  if (req.reduceOnly && !closing) return fail("reduce_only");
  const tick = defaultPremiumTick(sp.spec);
  const markT = Math.max(1, Math.round(q.mark / tick));
  const k = usdUnitOf(q);
  let tif = req.tif;
  let px: number;
  if (req.type === "market" || req.type === "stop_market") {
    const mb = BOOK_DEFAULTS.marketBandPct / 100;
    px = req.side === "buy" ? Math.max(Math.ceil(markT * (1 + mb)), markT + BOOK_DEFAULTS.bandMinTicks) : Math.max(1, Math.min(Math.floor(markT * (1 - mb)), markT - BOOK_DEFAULTS.bandMinTicks));
    tif = "ioc";
  } else {
    if (!(req.price !== undefined && req.price > 0)) return fail("invalid_price");
    px = Math.round(req.price / tick);
    if (px < 1) return fail("invalid_price");
    const lb = BOOK_DEFAULTS.limitBandPct / 100;
    if (req.side === "buy" && px > Math.floor(markT * (1 + lb)) + BOOK_DEFAULTS.bandMinTicks) return fail("price_out_of_band");
    if (req.side === "sell" && px < Math.max(1, Math.ceil(markT * (1 - lb)) - BOOK_DEFAULTS.bandMinTicks)) return fail("price_out_of_band");
  }
  if (req.postOnly && tif !== "gtc") return fail("post_only_gtc");
  let expireAt: number | undefined;
  if (tif === "gtd") {
    expireAt = req.expireAt ? Date.parse(req.expireAt) : NaN;
    if (!(expireAt > now) || expireAt > cutInstant(sp.p.date)) return fail("bad_expiry");
  }
  return { ok: true, tick, k, q, markT, px, tif, maxFill, expireAt };
}

const flagsOf = (req: Pick<BookOrderRequest, "postOnly" | "reduceOnly">) => [...(req.postOnly ? ["post_only"] : []), ...(req.reduceOnly ? ["reduce_only"] : [])];

/** Sends an order to the simulator for a login (ticket, a fired stop, a close) and records it. */
function execute(login: string, b: DemoBook, req: BookOrderRequest, c: Extract<Checked, { ok: true }>, now: number, record?: BookOrder): BookOrderResult {
  placing = true;
  const r = sim.submit({ series: req.series, owner: login, side: req.side, px: c.px, qty: req.qty, tif: c.tif, postOnly: req.postOnly, maxFill: c.maxFill, expireAt: c.expireAt }, now);
  placing = false;
  const fills = b.fills.filter((f) => f.orderId === r.order.id);
  const filled = fills.reduce((n, f) => n + f.qty, 0);
  const avg = filled ? roundPx(req.series, fills.reduce((s, f) => s + f.price * f.qty, 0) / filled) : null;
  const order: BookOrder = {
    ...(record ?? {}),
    id: record?.id ?? r.order.id,
    series: req.series,
    side: req.side,
    type: req.type,
    qty: req.qty,
    filled,
    left: r.order.left,
    avgPrice: avg,
    price: req.type === "market" || req.type === "stop_market" ? null : roundPx(req.series, c.px * c.tick),
    tif: c.tif,
    expireAt: c.expireAt ? new Date(c.expireAt).toISOString() : null,
    flags: flagsOf(req),
    reserved: reserveFor(b, req.series, req.side, r.order.left, c.px * c.tick),
    createdAt: record?.createdAt ?? new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    status: r.status,
    reason: r.reason,
    trigger: record?.trigger ?? null,
  };
  // a fired stop keeps its id: re-key the resting order
  if (record && r.order.left > 0) {
    sim.cancel(r.order.id);
    sim.restore({ ...r.order, id: record.id }, now);
  }
  for (const f of fills) f.orderId = order.id;
  const i = b.bookOrders.findIndex((o) => o.id === order.id);
  if (i >= 0) b.bookOrders[i] = order;
  else b.bookOrders.unshift(order);
  save(login, b);
  return { status: r.status, order, fills, reason: r.reason };
}

function restoreBookOrders(login: string, b: DemoBook) {
  const now = Date.now();
  let changed = false;
  // the simulator's order ids restart with the page: move them past the ids the stored orders already use
  const maxId = Math.max(0, ...b.bookOrders.map((o) => Number(String(o.id).slice(1))).filter((n) => Number.isFinite(n)));
  for (let guard = 0; guard < 5000 && maxId > 0 && Number(sim.nextId().slice(1)) <= maxId; guard++);
  for (const o of b.bookOrders) {
    if (o.left <= 0 || o.trigger || o.price === null || o.type === "market") continue;
    const tick = tickOf(o.series);
    const ok = sim.restore({ id: o.id, series: o.series, owner: login, side: o.side, px: Math.round(o.price / tick), qty: o.qty, left: o.left, tif: o.tif === "gtd" ? "gtd" : "gtc", postOnly: o.flags.includes("post_only"), at: Date.parse(o.createdAt), expireAt: o.expireAt ? Date.parse(o.expireAt) : undefined }, now);
    if (!ok) {
      o.status = "cancelled";
      o.reason = "session_reset";
      o.left = 0;
      o.reserved = 0;
      changed = true;
    }
  }
  if (changed) {
    books.set(login, b);
    try {
      localStorage.setItem(KEY(login), JSON.stringify(b));
    } catch {
      /* storage blocked */
    }
  }
}

/* ---- the demo tick: GTD expiries, stops, cut-offs and a trickle of outside trades ---- */

let flowAt = 0;

/** Called by the demo stream twice a second with near-the-money series of the chains on screen. */
export function demoBookTick(codes: string[], now = Date.now()) {
  if (!demoBookOn()) return;
  for (const o of sim.expire(now)) {
    const b = books.get(o.owner);
    const rec = b?.bookOrders.find((x) => x.id === o.id);
    if (b && rec) {
      rec.status = "expired";
      rec.left = 0;
      rec.reserved = 0;
      rec.updatedAt = new Date(now).toISOString();
      save(o.owner, b);
      emit({ login: o.owner, kind: "expired", order: rec });
    }
  }
  for (const [login, b] of books) {
    for (const o of b.bookOrders) {
      if (o.left <= 0) continue;
      const q = modelQuote(o.series);
      // the cut − closeOnly cancel (§9: Expire cancels every order of the expiry)
      if (q && q.state === "closed") {
        if (!o.trigger) sim.cancel(o.id);
        o.status = "cancelled";
        o.reason = "expiry";
        o.left = 0;
        o.reserved = 0;
        save(login, b);
        continue;
      }
      if (!o.trigger || o.status === "triggered") continue;
      const sp = specOfCode(o.series);
      const value = o.trigger.source === "mark" ? demoQuote(o.series)?.mark : sp ? mid(sp.p.underlying) : undefined;
      if (value === undefined) continue;
      const hit = o.trigger.op === "above" ? value >= o.trigger.price : value <= o.trigger.price;
      if (!hit) continue;
      const req: BookOrderRequest = { series: o.series, side: o.side, type: o.type === "stop_limit" ? "stop_limit" : "stop_market", qty: o.left, price: o.price ?? undefined, tif: o.type === "stop_limit" ? (o.tif === "gtd" ? "gtd" : "gtc") : "ioc", expireAt: o.expireAt ?? undefined, reduceOnly: o.flags.includes("reduce_only"), clientOrderId: o.id };
      const c = check(b, req, now);
      if (!c.ok) {
        o.status = "rejected";
        o.reason = c.code;
        o.left = 0;
        save(login, b);
        emit({ login, kind: "stop_rejected", order: o });
        continue;
      }
      const res = execute(login, b, req, c, now, { ...o, trigger: o.trigger });
      emit({ login, kind: "stop_triggered", order: res.order, fill: res.fills[0] });
    }
  }
  // outside participants: a taker every couple of seconds on a near-the-money series
  if (codes.length && now - flowAt > 1200 && Math.random() < 0.45) {
    flowAt = now;
    const code = codes[Math.floor(Math.random() * codes.length)]!;
    const q = demoQuote(code);
    if (q && q.state === "open") {
      const tick = tickOf(code);
      const side: Side = Math.random() < 0.5 ? "buy" : "sell";
      const markT = Math.max(1, Math.round(q.mark / tick));
      sim.submit({ series: code, owner: "flow", side, px: side === "buy" ? markT * 2 + 10 : 1, qty: 1 + Math.floor(Math.random() * 4), tif: "ioc" }, now);
      // and now and then a new resting order of another client inside the spread
      if (Math.random() < 0.25 && q.bid > 0 && q.ask > 0) {
        const bt = Math.round(q.bid / tick);
        const at = Math.round(q.ask / tick);
        if (at - bt > 2) {
          const s2: Side = Math.random() < 0.5 ? "buy" : "sell";
          sim.submit({ series: code, owner: `client-${100 + Math.floor(Math.random() * 900)}`, side: s2, px: s2 === "buy" ? bt + 1 : at - 1, qty: 1 + Math.floor(Math.random() * 6), tif: "gtc", postOnly: true }, now);
        }
      }
    }
  }
}

/* ---- RFQ: the market maker quotes every request (net per combo unit, firm for 5 s) ---- */

interface DemoRfq extends Rfq {
  login: string;
  quote: (RfqQuote & { legPx: number[] }) | null;
}
const rfqs = new Map<string, DemoRfq>();
let rfqSeq = 0;

function mmRfqQuote(r: DemoRfq, now: number): (RfqQuote & { legPx: number[] }) | null {
  if (r.quote && Date.parse(r.quote.validUntil) > now) return r.quote;
  const qs = r.legs.map((l) => demoQuote(l.series));
  if (qs.some((q) => !q || q.state === "closed" || q.state === "halted")) return null;
  const tick = tickOf(r.legs[0]!.series);
  const theo = r.legs.map((l, i) => qs[i]!.theo ?? qs[i]!.mark);
  const net = r.legs.reduce((s, l, i) => s + (l.side === "buy" ? 1 : -1) * l.ratio * theo[i]!, 0);
  // a combo spread tighter than legging (60 % of the summed half-spreads), at least one tick
  const half = Math.max(tick, 0.6 * r.legs.reduce((s, l, i) => s + l.ratio * Math.max(tick, ((qs[i]!.ask || qs[i]!.mark) - (qs[i]!.bid || qs[i]!.mark)) / 2), 0));
  const bid = Math.floor((net - half) / tick + 1e-9) * tick;
  const ask = Math.ceil((net + half) / tick - 1e-9) * tick;
  r.quote = { quoteId: `q${++rfqSeq}${now.toString(36)}`, responder: "kalks-mm", bid: roundPx(r.legs[0]!.series, bid), ask: roundPx(r.legs[0]!.series, ask), qty: r.qty, validUntil: new Date(now + BOOK_DEFAULTS.rfqQuoteTtlSecs * 1000).toISOString(), legPx: theo };
  return r.quote;
}

/** Leg prices of a combo fill (§5): the theos shifted to sum to the net, on the tick, the remainder on the largest leg, none below 0. */
function legPrices(legs: { sign: number; ratio: number; theo: number }[], net: number, tick: number): number[] {
  const w = legs.map((l) => l.ratio * l.theo);
  const tw = w.reduce((a, b) => a + b, 0) || 1;
  const theoNet = legs.reduce((s, l) => s + l.sign * l.ratio * l.theo, 0);
  const diff = net - theoNet;
  const px = legs.map((l, i) => Math.max(0, Math.round((l.theo + (l.sign * diff * (w[i]! / tw)) / l.ratio) / tick) * tick));
  const got = legs.reduce((s, l, i) => s + l.sign * l.ratio * px[i]!, 0);
  const big = w.indexOf(Math.max(...w));
  const L = legs[big]!;
  px[big] = Math.max(0, Math.round((px[big]! + (L.sign * (net - got)) / L.ratio) / tick) * tick);
  return px;
}

/* ------------------------------------------------------------------ */
/* The book API (demo)                                                 */
/* ------------------------------------------------------------------ */

const okB = <T>(data: T): Result<T> => ({ ok: true, data });

export const mockBookApi: BookApi = {
  preview: async (login, req) => {
    const b = load(login);
    const now = Date.now();
    const c = check(b, req, now);
    const empty: BookPreview = { ok: false, reasons: [], reserve: 0, estAvgPrice: null, estFilled: 0, estResting: 0, fee: 0, rebate: 0, band: null };
    if (!c.ok) return okB({ ...empty, reasons: [{ code: c.code, message: c.message }] });
    const stop = req.type === "stop_market" || req.type === "stop_limit";
    const depth = sim.depth(req.series, 50);
    const mine = new Set(sim.ordersOf(login).map((o) => o.px));
    let want = c.maxFill !== undefined ? Math.min(req.qty, c.maxFill) : req.qty;
    let filled = 0;
    let cost = 0;
    if (!stop)
      for (const l of req.side === "buy" ? depth.asks : depth.bids) {
        if (want <= 0 || (req.side === "buy" ? l.px > c.px : l.px < c.px)) break;
        if (mine.has(l.px) && l.mine > 0) break;
        const n = Math.min(want, l.qty);
        filled += n;
        cost += n * l.px * c.tick;
        want -= n;
      }
    const reasons: BookPreview["reasons"] = [];
    if (req.postOnly && filled > 0) reasons.push({ code: "would_take", message: "Post-only: this price would trade at once." });
    if (c.tif === "fok" && want > 0) {
      filled = 0;
      cost = 0;
      reasons.push({ code: "fok_not_filled", message: "Not enough contracts at this price to fill the whole order." });
    }
    // a stop holds nothing and doesn't rest: when it fires it is a new order (a stop market takes: the taker fee)
    const resting = stop ? 0 : c.tif === "gtc" || c.tif === "gtd" ? want : 0;
    const prem = (n: number, px: number) => n * px * c.k;
    const fee = stop
      ? r2(Math.min(BOOK_DEFAULTS.takerFeePerContract * req.qty, (BOOK_DEFAULTS.feeCapPct / 100) * prem(req.qty, c.markT * c.tick)))
      : r2(Math.min(BOOK_DEFAULTS.takerFeePerContract * filled, (BOOK_DEFAULTS.feeCapPct / 100) * prem(1, cost)));
    const rebate = r2(Math.min(-BOOK_DEFAULTS.makerFeePerContract * resting, (BOOK_DEFAULTS.feeCapPct / 100) * prem(resting, c.px * c.tick)));
    const band = req.type === "market" || req.type === "stop_market" ? (req.side === "buy" ? { min: null, max: roundPx(req.series, c.px * c.tick) } : { min: roundPx(req.series, c.px * c.tick), max: null }) : null;
    return okB({
      ok: !reasons.length,
      reasons,
      reserve: stop ? 0 : reserveFor(b, req.series, req.side, req.qty, req.type === "market" ? null : c.px * c.tick),
      estAvgPrice: filled ? roundPx(req.series, cost / filled) : null,
      estFilled: filled,
      estResting: resting,
      fee,
      rebate,
      band,
    });
  },
  place: async (login, req) => {
    if (login === "guest") return fail("unauthorized", "Log in to a trading account.", 401);
    const b = load(login);
    const now = Date.now();
    const c = check(b, req, now);
    if (!c.ok) return fail(c.code, c.message);
    if (b.bookOrders.filter((o) => o.left > 0 && o.series === req.series).length >= 50) return fail("limit_orders", "At most 50 working orders per series.");
    if (req.type === "stop_market" || req.type === "stop_limit") {
      if (!req.trigger || !(req.trigger.price > 0)) return fail("invalid_trigger", "Enter a trigger price.");
      // a stop is stored on the account; nothing is reserved until it fires
      const order: BookOrder = { id: sim.nextId(), series: req.series, side: req.side, type: req.type, qty: req.qty, filled: 0, left: req.qty, avgPrice: null, price: req.type === "stop_limit" ? roundPx(req.series, c.px * c.tick) : null, tif: req.type === "stop_limit" ? c.tif : "ioc", expireAt: c.expireAt ? new Date(c.expireAt).toISOString() : null, flags: flagsOf(req), reserved: 0, createdAt: new Date(now).toISOString(), updatedAt: null, status: "working", trigger: req.trigger };
      b.bookOrders.unshift(order);
      save(login, b);
      return okB({ status: "working", order, fills: [] });
    }
    return okB(execute(login, b, req, c, now));
  },
  amend: async (login, id, patch) => {
    const b = load(login);
    const o = b.bookOrders.find((x) => x.id === id && x.left > 0);
    if (!o) return fail("not_found", MESSAGES.not_found!, 404);
    const now = Date.now();
    const qty = patch.qty ?? o.qty;
    if (!Number.isInteger(qty) || qty <= o.filled || qty > 100) return fail("limit_contracts", "The new quantity must be more than what has filled.");
    const price = patch.price ?? o.price ?? undefined;
    const c = check(b, { series: o.series, side: o.side, type: o.type, qty: qty - o.filled, price, tif: o.tif, reduceOnly: o.flags.includes("reduce_only"), clientOrderId: id }, now);
    if (!c.ok) return fail(c.code, c.message);
    if (o.trigger) {
      Object.assign(o, { qty, left: qty - o.filled, price: o.type === "stop_limit" && price !== undefined ? roundPx(o.series, c.px * c.tick) : o.price, updatedAt: new Date(now).toISOString() });
      save(login, b);
      return okB({ status: "working", order: o, fills: [] });
    }
    placing = true;
    const r = sim.amend(id, { px: patch.price !== undefined ? c.px : undefined, qty }, now);
    placing = false;
    if (!r) return fail("not_found", MESSAGES.not_found!, 404);
    const fills = b.fills.filter((f) => f.orderId === id && Date.parse(f.at) >= now - 5);
    Object.assign(o, { qty, left: r.order.left, price: roundPx(o.series, r.order.px * c.tick), status: r.order.left > 0 ? (o.filled > 0 ? "partially_filled" : "working") : r.status, updatedAt: new Date(now).toISOString() });
    o.reserved = reserveFor(b, o.series, o.side, o.left, o.price);
    save(login, b);
    return okB({ status: o.status, order: o, fills, reason: r.reason });
  },
  cancel: async (login, id) => {
    const b = load(login);
    const o = b.bookOrders.find((x) => x.id === id && x.left > 0);
    if (!o) return fail("not_found", MESSAGES.not_found!, 404);
    if (!o.trigger) sim.cancel(id);
    Object.assign(o, { status: "cancelled", left: 0, reserved: 0, updatedAt: new Date().toISOString() });
    save(login, b);
    return okB({ status: "cancelled", order: o });
  },
  cancelAll: async (login, scope) => {
    const b = load(login);
    let n = 0;
    for (const o of b.bookOrders) {
      if (o.left <= 0) continue;
      if (scope.series && o.series !== scope.series) continue;
      if (scope.underlying && parseSeriesCode(o.series)?.underlying !== scope.underlying) continue;
      if (!o.trigger) sim.cancel(o.id);
      Object.assign(o, { status: "cancelled", left: 0, reserved: 0, updatedAt: new Date().toISOString() });
      n++;
    }
    save(login, b);
    return okB({ cancelled: n });
  },
  orders: async (login, q) => {
    const b = load(login);
    const list = b.bookOrders.filter((o) => (!q.series || o.series === q.series) && (q.status === "open" ? o.left > 0 : o.left <= 0));
    return okB(list.map((o) => ({ ...o })));
  },
  fills: async (login, range) => {
    const b = load(login);
    const from = range.from ? Date.parse(range.from) : 0;
    const to = range.to ? Date.parse(range.to) : Infinity;
    return okB(b.fills.filter((f) => Date.parse(f.at) >= from && Date.parse(f.at) <= to).map((f) => ({ ...f })));
  },
  closePosition: async (login, t, contracts) => {
    if (!demoBookOn()) return mockApi.closePosition(login, t, contracts) as Promise<Result<CloseResult>>;
    const b = load(login);
    const p = b.positions.find((x) => x.ticket === t);
    if (!p) return fail("not_found", "Position not found.", 404);
    const qty = Math.min(p.contracts, contracts ?? p.contracts);
    const side: Side = p.side === "buy" ? "sell" : "buy";
    const now = Date.now();
    const req: BookOrderRequest = { series: p.option.series, side, type: "market", qty, tif: "ioc", reduceOnly: true, clientOrderId: `close${t}` };
    const c = check(b, req, now);
    if (!c.ok) return fail(c.code, c.message);
    realized = 0;
    const r = execute(login, b, req, c, now);
    const filled = r.fills.reduce((n, f) => n + f.qty, 0);
    if (!filled) return fail("no_liquidity", "No bids or offers inside the price band right now. Try again shortly or place a limit order.");
    return okB({ status: filled >= qty ? "filled" : "partial", filled, avgPrice: r.order?.avgPrice ?? undefined, left: qty - filled, profit: r2(realized - r.fills.reduce((s, f) => s + f.fee, 0)) });
  },
  rfq: async (login, req) => {
    if (login === "guest") return fail("unauthorized", "Log in to a trading account.", 401);
    if (!req.legs.length || req.legs.length > 8 || req.legs.some((l) => !specOfCode(l.series))) return fail("bad_request", "Give 1 to 8 legs.", 422);
    const id = `rfq${Date.now().toString(36)}${++rfqSeq}`;
    const r: DemoRfq = { id, login, expiresAt: new Date(Date.now() + 30_000).toISOString(), legs: req.legs, qty: req.qty, status: "open", quote: null };
    rfqs.set(id, r);
    return okB({ id, expiresAt: r.expiresAt, legs: r.legs, qty: r.qty, status: "open" });
  },
  rfqGet: async (login, id) => {
    const r = rfqs.get(id);
    if (!r || r.login !== login) return fail("not_found", "Request not found.", 404);
    const now = Date.now();
    if (Date.parse(r.expiresAt) <= now && r.status === "open") r.status = "expired";
    const q = r.status === "open" ? mmRfqQuote(r, now) : null;
    const { legPx: _l, ...quote } = q ?? ({} as RfqQuote & { legPx: number[] });
    return okB({ rfq: { id: r.id, expiresAt: r.expiresAt, legs: r.legs, qty: r.qty, status: r.status }, quotes: q ? [quote as RfqQuote] : [] });
  },
  rfqAccept: async (login, id, body) => {
    const r = rfqs.get(id);
    if (!r || r.login !== login) return fail("not_found", "Request not found.", 404);
    const now = Date.now();
    if (r.status !== "open" || Date.parse(r.expiresAt) <= now) return fail("rfq_expired", "This request has expired. Ask for a new quote.");
    const q = r.quote;
    if (!q || q.quoteId !== body.quoteId || Date.parse(q.validUntil) <= now) return fail("quote_expired", "The quote has expired. Accept the new one.");
    const net = body.side === "buy" ? q.ask : q.bid;
    if (net === null) return fail("no_price", "No price on that side.");
    if ((body.side === "buy" && net > body.limitNet + 1e-12) || (body.side === "sell" && net < body.limitNet - 1e-12)) return fail("price_moved", "The price moved past your limit.");
    const b = load(login);
    const tick = tickOf(r.legs[0]!.series);
    const sign = body.side === "buy" ? 1 : -1;
    const legs = r.legs.map((l, i) => ({ sign: (l.side === "buy" ? 1 : -1) * sign, ratio: l.ratio, theo: q.legPx[i]! }));
    const px = legPrices(legs, sign * net, tick);
    const comboId = `c${now.toString(36)}`;
    comboCtx = { comboId };
    try {
      r.legs.forEach((l, i) => {
        const side: Side = legs[i]!.sign > 0 ? "buy" : "sell";
        sim.printCombo({ series: l.series, px: Math.round(px[i]! / tick), qty: l.ratio * r.qty, takerSide: side, maker: "mm", taker: login, makerOrder: "rfq", takerOrder: id, makerMm: true, at: now, kind: "combo" });
      });
    } finally {
      comboCtx = null;
    }
    r.status = "filled";
    const fills = b.fills.filter((f) => f.comboId === comboId);
    save(login, b);
    return okB({ status: "filled", comboId, fills });
  },
  rfqCancel: async (login, id) => {
    const r = rfqs.get(id);
    if (r && r.login === login) r.status = "cancelled";
    return okB({ status: "cancelled" });
  },
  depth: async (series) => {
    const d = demoDepth(series);
    return d ? okB(d) : fail("not_found", "Series not found.", 404);
  },
  trades: async (series, limit) => okB(demoTrades(series, limit)),
};
