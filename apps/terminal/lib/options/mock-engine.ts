"use client";

// Demo builds (NEXT_PUBLIC_KALKS_MODE=demo): the options service and the engine's options API answered in the
// browser. Chains come from the GK / BS / Black-76 pricer in @kalks/mock/options on the live (or simulated) quotes;
// fills, closes, working orders and expiry settlements are kept per demo login in localStorage and shown through the
// same option book as engine positions.
import { INSTRUMENT_MAP, fetchCandles, isMarketOpen, priceFeed } from "@kalks/mock";
import { OPTION_SPEC, mockChain, mockExpiries, mockPremiumCandles, mockUnderlyings, parseSeriesCode, pricingContext, quoteSeries, tradeState, usdPerQuoteCcy, cutInstant, seriesCode, type OptionExpiry } from "@kalks/mock/options";
import { buildHistory, fromChartTime } from "@/components/chart/engine";
import type { Timeframe } from "@/lib/trading";
import type { Result } from "@/lib/engine/client";
import type { OptionsApi } from "./api";
import { optionBook } from "./book";
import type { OptionCandles, OptionChain, OptionInfo, OptionQuote, OptOrder, OptPosition, OrderRequest, Settlement } from "./types";

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
  return mockChain({ symbol: u, expiry: e, spot: { bid: q.bid, ask: q.ask }, nowMs: Date.now(), usdPerQuote: usdPerQuoteCcy(spec.quoteCcy, mid) });
}

/** One series priced now (positions and legs outside the chain on screen). */
export function demoQuote(code: string): OptionQuote | null {
  const p = parseSeriesCode(code);
  const spec = p && OPTION_SPEC[p.underlying];
  const q = p && priceFeed().snapshot(p.underlying);
  if (!p || !spec || !q || !(q.bid > 0)) return null;
  const cut = cutInstant(p.date);
  const now = Date.now();
  const ctx = pricingContext(spec, (q.bid + q.ask) / 2, cut, now, usdPerQuoteCcy(spec.quoteCcy, mid));
  return quoteSeries(ctx, p.right, p.strike, code, tradeState(cut, now));
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
}

const KEY = (login: string) => `kalks.options.demo.v1.${login}`;
const books = new Map<string, DemoBook>();
let seq = 71_200_000;
const ticket = () => String((seq += 1 + Math.floor(Math.random() * 5)));

function load(login: string): DemoBook {
  let b = books.get(login);
  if (b) return b;
  b = { positions: [], orders: [], settlements: seedSettlements(login) };
  try {
    const raw = localStorage.getItem(KEY(login));
    if (raw) {
      const v = JSON.parse(raw) as Partial<DemoBook>;
      b = { positions: Array.isArray(v.positions) ? v.positions : [], orders: Array.isArray(v.orders) ? v.orders : [], settlements: Array.isArray(v.settlements) ? v.settlements : b.settlements };
    }
  } catch {
    /* storage blocked */
  }
  books.set(login, b);
  settleExpired(login, b);
  optionBook.set(login, b.positions, b.orders);
  return b;
}

function save(login: string, b: DemoBook) {
  books.set(login, b);
  optionBook.set(login, b.positions, b.orders);
  try {
    localStorage.setItem(KEY(login), JSON.stringify(b));
  } catch {
    /* storage blocked: the book lasts for this page */
  }
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
    b.settlements.unshift({ ticket: p.ticket, series: p.option.series, side: p.side, contracts: p.contracts, fixing: spec ? +fixing.toFixed(spec.digits) : fixing, payout: +((p.side === "buy" ? 1 : -1) * intrinsic * usd * p.contracts).toFixed(2), at: p.option.expiryAt, run: 1 });
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
        const q = demoQuote(o.option.series);
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
      const q = demoQuote(l.series);
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
    const q = demoQuote(p.option.series);
    if (!q) return fail("no_price", "No price for this series.", 503);
    if (q.state === "closed") return fail("cutoff", "Trading has stopped for this expiry.");
    const n = Math.min(p.contracts, contracts ?? p.contracts);
    const px = p.side === "buy" ? q.bid : q.ask;
    const usdPerUnit = q.ask > 0 ? q.askUsd / q.ask : 0;
    const profit = (p.side === "buy" ? 1 : -1) * (px - p.openPrice) * usdPerUnit * n;
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
      const q = demoQuote(p.option.series);
      if (!q || !isMarketOpen(p.option.underlying)) return fail("market_closed", "Market closed.");
      const px = p.side === "buy" ? q.bid : q.ask;
      profit += (p.side === "buy" ? 1 : -1) * (px - p.openPrice) * (q.ask > 0 ? q.askUsd / q.ask : 0) * p.contracts;
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
