"use client";

// State of the Options workspace in Kalks Trader (kept out of lib/store.tsx, which holds the CFD terminal). One
// external store shared by every lazily-loaded options module (workspace panels, toolbox tabs, mobile view): the
// selected underlying and expiry (Daily / Weekly / Monthly = the nearest expiry of that kind, rolled to the next date
// after its cut, or a date picked from the list), the live chain (REST snapshot, then the WebSocket's changed rows;
// REST polling while the socket is down), quotes of series outside the chain on screen (open positions, ticket legs,
// the selected option), view preferences, the selected option (a strike's call or put picked in the chain: the
// chart shows its premium, the ticket trades it), the order ticket's legs and the strategy builder. Positions
// themselves live in lib/options/book.ts.
//
// Order book (docs/OPTIONS-EXCHANGE.md): when the chain says the broker's book is live (`chain.book.active`) and the
// engine serves the book routes, `bookLive` turns on: chain quotes carry the best bid / offer with sizes, the
// selected series' depth and trade tape stream in (`depth`, `tape`), and the ticket sends book orders. Otherwise
// (no book, or the engine answers 404) everything stays on today's house-priced flow.
import * as React from "react";
import { IS_LIVE } from "@kalks/mock";
import { mockUnderlyings, parseSeriesCode } from "@kalks/mock/options";
import type { Timeframe } from "@/lib/trading";
import { optionsApi, isLaunchingSoon } from "@/lib/options/api";
import { optionBook } from "@/lib/options/book";
import { bookApi } from "@/lib/options/book-api";
import { bookFlag } from "@/lib/options/book-flag";
import { bookOrders } from "@/lib/options/book-orders";
import { demoBoot } from "@/lib/options/mock-engine";
import { LINK_UNDERLYING_KEY } from "@/lib/options/mode";
import { normChain, normQuote, normRow } from "@/lib/options/normalize";
import { createOptionsStream, type OptFrame, type OptStream, type OptStreamStatus } from "@/lib/options/stream";
import type { BarrierSpec, BookTif, ExpiryKind, OptionChain, OptionChainRow, OptionExpiry, OptionQuote, OptionRight, OptionUnderlying, SeriesDepth, Side, TapeTrade } from "@/lib/options/types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface OptCtx {
  login: string;
  guest: boolean;
  engine: boolean;
  readOnly: boolean;
  /** the public option chain page (read-only guest view, any build) */
  publicPage?: boolean;
}

/** loading → ready; soon = the module is off here (options_disabled) / public chain off; error = service down. */
export type Avail = "loading" | "ready" | "soon" | "error";

export interface TicketLeg {
  id: string;
  series: string;
  u: string;
  expiry: string;
  right: OptionRight;
  strike: number;
  strikeLabel: string;
  side: Side;
  contracts: number;
  /** a barrier leg (Kalks-quoted): the strategy is placed on the house ticket, never as an RFQ */
  barrier?: BarrierSpec;
}

export interface Ticket {
  legs: TicketLeg[];
  /** single option: the trader chose Buy or Sell (a strike picked in the chain starts without a side) */
  armed: boolean;
  /** "Add leg": the next strike picked in the chain is added instead of replacing the ticket */
  adding: boolean;
  type: "market" | "limit";
  limit: string;
  sl: string;
  tp: string;
  trigger: boolean;
  triggerOp: "above" | "below";
  triggerPrice: string;
  tif: "gtc" | "day";
  /* order book ticket (single option): limit / market / stop; the limit price is `limit` (USD per contract) */
  bookType: "limit" | "market" | "stop";
  stopKind: "market" | "limit";
  bookTif: BookTif;
  /** good-till-date: a datetime-local value (the trader's time zone) */
  gtd: string;
  postOnly: boolean;
  reduceOnly: boolean;
  /** stop trigger: the series' mark (USD per contract) or the underlying's price */
  trigSource: "mark" | "underlying";
  trigOp: "above" | "below";
  trigPrice: string;
}

export type ChainView = "both" | "calls" | "puts";
/** The right panel: the guided "Quick trade" (Up or Down → date → amount → outcome) or the full order ticket. */
export type SidePanel = "ticket" | "simple";
/** A column of the option chain (per side). */
export type ChainCol = "bid" | "ask" | "last" | "mark" | "iv" | "delta" | "gamma" | "theta" | "vega" | "prob" | "be" | "oi" | "vol";
/** Column sets of the chain: Simple (the price only), Standard (+ sell price, chance, breakeven), Pro (everything). */
export type ColPreset = "simple" | "standard" | "pro" | "custom";
export const COL_PRESETS: Record<Exclude<ColPreset, "custom">, ChainCol[]> = {
  simple: ["ask"],
  standard: ["bid", "ask", "prob", "be"],
  pro: ["bid", "ask", "last", "mark", "iv", "delta", "gamma", "theta", "vega", "prob", "be", "oi", "vol"],
};
export const ALL_COLS: ChainCol[] = COL_PRESETS.pro;
/**
 * The tabs of the centre panel (where the CFD chart sits); "book" (depth + trades) while the order book is live;
 * "analytics" (smile, term structure, open interest, put / call, what-if P&L).
 */
export type CenterTab = "chart" | "chain" | "book" | "analytics";
const CENTER_TABS: CenterTab[] = ["chart", "chain", "book", "analytics"];
/** The chart tab: the selected option's premium, or the underlying with option levels. */
export type ChartMode = "premium" | "underlying";
export const EXPIRY_KINDS: ExpiryKind[] = ["daily", "weekly", "monthly"];

export interface Prefs {
  u: string;
  view: ChainView;
  /** legacy (before column presets): Greeks on → the Pro columns */
  greeks: boolean;
  /** legacy: probability ITM + breakeven columns */
  extra: boolean;
  /** the chain's column set and its columns (custom = picked one by one) */
  colPreset: ColPreset;
  cols: ChainCol[];
  /** strikes each side of ATM (0 = all) */
  range: number;
  tf: Timeframe;
  chart: boolean;
  panel: SidePanel;
  /** Daily / Weekly / Monthly tab (the nearest expiry of that kind); null = a date picked from the list */
  expKind: ExpiryKind | null;
  center: CenterTab;
  chartMode: ChartMode;
}

export interface OptState {
  ctx: OptCtx | null;
  avail: Avail;
  availMsg?: string;
  /** the guest (public chain) view */
  publicView: boolean;
  underlyings: OptionUnderlying[];
  expiries: OptionExpiry[];
  u: string;
  expiry: string | null;
  chain: OptionChain | null;
  chainLoading: boolean;
  /** series code → quote, for the chain on screen */
  index: Record<string, OptionQuote>;
  /** series code → quote, outside the chain on screen (positions, legs of other expiries) */
  quotes: Record<string, OptionQuote>;
  stream: OptStreamStatus | "polling";
  /** live builds: the engine doesn't take option orders yet (preview fell back to the estimate) */
  tradingSoon: boolean;
  prefs: Prefs;
  ticket: Ticket;
  builder: boolean;
  /** position ticket whose lines the chart highlights */
  focus: string | null;
  /** the selected option (series code): highlighted in the chain, charted, traded by the ticket */
  sel: string | null;
  /** the broker's order book is live here (chain header) and the engine takes book orders */
  bookLive: boolean;
  /** the engine answered a book route with 404 / 405 / 501: keep the house-priced flow */
  bookOff: boolean;
  /** series → depth (10 levels each side), the selected series while the book is live */
  depth: Record<string, SeriesDepth>;
  /** series → latest trades, newest first */
  tape: Record<string, TapeTrade[]>;
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const PREFS_KEY = "kalks.options.prefs";
const DEFAULT_PREFS: Prefs = { u: "EURUSD", view: "both", greeks: false, extra: false, colPreset: "simple", cols: COL_PRESETS.simple, range: 10, tf: "M15", chart: true, panel: "simple", expKind: "daily", center: "chain", chartMode: "premium" };
/** timeframes of the options charts (the premium candles service serves these) */
export const OPTION_TFS: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];

function readPrefs(): Prefs {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(PREFS_KEY) : null;
    const p = raw ? ({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } as Prefs) : DEFAULT_PREFS;
    if (!OPTION_TFS.includes(p.tf)) p.tf = DEFAULT_PREFS.tf;
    if (p.expKind !== null && !EXPIRY_KINDS.includes(p.expKind)) p.expKind = "daily";
    if (!CENTER_TABS.includes(p.center)) p.center = DEFAULT_PREFS.center;
    // before column presets: Greeks on → Pro, the ITM % / breakeven switch → Standard, else Simple
    const stored = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
    if (!stored.colPreset) p.colPreset = stored.greeks ? "pro" : stored.extra ? "standard" : "simple";
    if (p.colPreset !== "custom") p.cols = COL_PRESETS[p.colPreset] ?? COL_PRESETS.simple;
    else p.cols = (Array.isArray(p.cols) ? p.cols : []).filter((c) => ALL_COLS.includes(c));
    if (!p.cols.length) p.cols = COL_PRESETS.simple;
    return p;
  } catch {
    return DEFAULT_PREFS;
  }
}

const emptyTicket = (): Ticket => ({
  legs: [],
  armed: false,
  adding: false,
  type: "market",
  limit: "",
  sl: "",
  tp: "",
  trigger: false,
  triggerOp: "above",
  triggerPrice: "",
  tif: "gtc",
  bookType: "limit",
  stopKind: "market",
  bookTif: "gtc",
  gtd: "",
  postOnly: false,
  reduceOnly: false,
  trigSource: "mark",
  trigOp: "below",
  trigPrice: "",
});

/** What a fresh ticket keeps of the previous one: the order type and time in force the trader works with. */
const keepOf = (t: Ticket): Partial<Ticket> => ({ type: t.type, tif: t.tif, bookType: t.bookType, stopKind: t.stopKind, bookTif: t.bookTif === "gtd" ? "gtc" : t.bookTif, trigSource: t.trigSource });

const prefs0 = readPrefs();
let state: OptState = {
  ctx: null,
  avail: "loading",
  publicView: false,
  underlyings: [],
  expiries: [],
  u: prefs0.u,
  expiry: null,
  chain: null,
  chainLoading: false,
  index: {},
  quotes: {},
  stream: "connecting",
  tradingSoon: false,
  prefs: prefs0,
  ticket: emptyTicket(),
  builder: false,
  focus: null,
  sel: null,
  bookLive: false,
  bookOff: false,
  depth: {},
  tape: {},
};

const listeners = new Set<() => void>();
function set(patch: Partial<OptState> | ((s: OptState) => Partial<OptState>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  if ("bookLive" in p || "bookOff" in p) bookFlag.setLive(state.bookLive && !state.bookOff);
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function getOpt() {
  return state;
}

/** Raw change feed of the options state (charts that update outside React). */
export function onOptChange(l: () => void) {
  return subscribe(l);
}

/** Subscribe to a slice of the options state (the selector must return a stored value, not a new object). */
export function useOpt<T>(sel: (s: OptState) => T): T {
  return React.useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

/** The quote of a series wherever it is (chain on screen, or the series subscription). */
export function useSeriesQuote(code: string | null | undefined): OptionQuote | null {
  return useOpt((s) => (code ? (s.index[code] ?? s.quotes[code] ?? null) : null));
}

/** The order book is live for this account: book prices, depth, book orders (else house prices). */
export const isBookLive = (s: OptState) => s.bookLive && !s.bookOff;
export function useBookLive(): boolean {
  return useOpt(isBookLive);
}

export const quoteOf = (code: string) => state.index[code] ?? state.quotes[code] ?? null;

/* ------------------------------------------------------------------ */
/* Expiries: Daily / Weekly / Monthly = the nearest open one of a kind */
/* ------------------------------------------------------------------ */

/** Still tradable: before its cut, listed, not stopped. */
export function expiryOpen(e: Pick<OptionExpiry, "cutAt" | "status" | "state">, now = Date.now()): boolean {
  return Date.parse(e.cutAt) > now && (!e.status || e.status === "listed") && e.state !== "closed";
}

/** The nearest open expiry of a kind. */
export function nearestExpiry(list: OptionExpiry[], kind: ExpiryKind, now = Date.now()): OptionExpiry | undefined {
  let best: OptionExpiry | undefined;
  for (const e of list) if (e.kinds.includes(kind) && expiryOpen(e, now) && (!best || Date.parse(e.cutAt) < Date.parse(best.cutAt))) best = e;
  return best;
}

/** The tab a date shows under: the kind whose nearest expiry it is (the preferred kind first), else null (picked). */
export function kindOfExpiry(list: OptionExpiry[], date: string, prefer: ExpiryKind | null, now = Date.now()): ExpiryKind | null {
  for (const k of prefer ? [prefer, ...EXPIRY_KINDS.filter((x) => x !== prefer)] : EXPIRY_KINDS) if (nearestExpiry(list, k, now)?.date === date) return k;
  return null;
}

/** an expiry asked for before its list arrived ("Show on the chart" of a position on another underlying) */
let wantExpiry: string | null = null;

/** The expiry to show from a fresh list: the one on screen while it trades, else the nearest of the tab's kind. */
function pickExpiry(list: OptionExpiry[], keep: string | null, prev: string | null): { date: string | null; kind: ExpiryKind | null } {
  const now = Date.now();
  const kind = state.prefs.expKind;
  if (wantExpiry) {
    const w = list.find((e) => e.date === wantExpiry && expiryOpen(e, now));
    wantExpiry = null;
    if (w) return { date: w.date, kind: kindOfExpiry(list, w.date, kind, now) };
  }
  const kept = keep ? list.find((e) => e.date === keep) : undefined;
  if (kept && expiryOpen(kept, now)) return { date: kept.date, kind };
  // a picked date on another underlying: the same date when it is listed there
  if (!kind && prev) {
    const same = list.find((e) => e.date === prev && expiryOpen(e, now));
    if (same) return { date: same.date, kind: null };
  }
  // the tab's kind; a picked date that expired rolls to the nearest of its own kind
  const first = kind ?? kept?.kinds[0] ?? "daily";
  for (const k of [first, ...EXPIRY_KINDS.filter((x) => x !== first)]) {
    const e = nearestExpiry(list, k, now);
    if (e) return { date: e.date, kind: k };
  }
  return { date: list.find((e) => expiryOpen(e, now))?.date ?? list[0]?.date ?? null, kind };
}

function applyKind(kind: ExpiryKind | null) {
  if (kind === state.prefs.expKind) return;
  const prefs = { ...state.prefs, expKind: kind };
  savePrefs(prefs);
  set({ prefs });
}

function indexOf(rows: OptionChainRow[]): Record<string, OptionQuote> {
  const out: Record<string, OptionQuote> = {};
  for (const r of rows) {
    if (r.call) out[r.call.code] = r.call;
    if (r.put) out[r.put.code] = r.put;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Loading, streaming, polling                                         */
/* ------------------------------------------------------------------ */

let stream: OptStream | null = null;
let streamLogin: string | null | undefined;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let expiryTimer: ReturnType<typeof setInterval> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let downSince = 0;
let refs = 0;
let rollTimer: ReturnType<typeof setInterval> | null = null;
let seq = 0;
let unbook: (() => void) | null = null;
/** the selected option to carry over to the next expiry's chain (same strike and right), once it loads */
let remap: { strike: number; right: OptionRight; prevCode: string } | null = null;

const loginOf = () => (state.ctx && !state.ctx.guest && !state.ctx.publicPage ? state.ctx.login : null);

function chainKey() {
  return state.expiry ? `${state.u}|${state.expiry}` : null;
}

/** Series to stream outside the chain on screen: open positions and ticket legs of other expiries. */
function syncSeries() {
  if (!stream) return;
  const login = loginOf();
  const codes = new Set<string>();
  if (login) for (const p of optionBook.get(login).positions) codes.add(p.option.series);
  if (login && isBookLive(state)) for (const o of bookOrders.get(login).open) codes.add(o.series);
  for (const l of state.ticket.legs) codes.add(l.series);
  if (state.sel) codes.add(state.sel);
  stream.setSeries([...codes].filter((c) => !state.index[c]));
}

function syncStream() {
  if (state.avail !== "ready" || !state.ctx) return;
  const login = loginOf();
  if (!stream || streamLogin !== login) {
    stream?.stop();
    streamLogin = login;
    stream = createOptionsStream(login, {
      onFrame,
      onStatus: (st) => {
        if (st === "open") downSince = 0;
        else if (!downSince) downSince = Date.now();
        set({ stream: st === "open" ? "open" : pollTimer ? "polling" : st });
      },
    });
  }
  stream.setChains(state.expiry ? [{ u: state.u, expiry: state.expiry }] : []);
  syncSeries();
  syncBookFeed();
}

/** Depth and trades of the selected series while the book is live. */
function syncBookFeed() {
  if (!stream) return;
  const codes = isBookLive(state) && state.sel ? [state.sel] : [];
  stream.setDepth(codes);
  stream.setTape(codes);
}

/** A chain arrived: whether it trades on the book (sticky until the next chain says otherwise). */
function bookOfChain(c: OptionChain): Partial<OptState> {
  const live = !!c.book?.active;
  return live === state.bookLive ? {} : { bookLive: live };
}

function onFrame(f: OptFrame) {
  switch (f.type) {
    case "chain": {
      if (f.underlying !== state.u || f.expiry !== state.expiry) return;
      const { type: _t, ...raw } = f;
      const chain = normChain(raw as OptionChain);
      set({ chain, index: indexOf(chain.rows), chainLoading: false, ...bookOfChain(chain) });
      applyRemap();
      syncSeries();
      return syncBookFeed();
    }
    case "rows": {
      const c = state.chain;
      if (!c || f.u !== state.u || f.expiry !== state.expiry) return;
      const byLabel = new Map(f.rows.map((r) => [r.strikeLabel, normRow(r)]));
      let missing = byLabel.size;
      const rows = c.rows.map((r) => {
        const n = byLabel.get(r.strikeLabel);
        if (!n) return r;
        missing--;
        return n;
      });
      if (missing > 0) return void loadChain(); // a strike was added: take the full chain
      set({ chain: { ...c, rows, spot: f.spot ?? c.spot, state: f.state ?? c.state }, index: indexOf(rows) });
      return;
    }
    case "series": {
      const quotes = { ...state.quotes };
      for (const raw of f.quotes) {
        const q = normQuote(raw);
        if (q) quotes[q.code] = q;
      }
      return set({ quotes });
    }
    case "depth": {
      const { type: _t, ...d } = f;
      return set((s) => ({ depth: { ...s.depth, [d.series]: d } }));
    }
    case "tape": {
      if (!f.trades.length) return;
      return set((s) => {
        const tape = { ...s.tape };
        for (const t of f.trades) {
          const list = tape[t.series] ?? [];
          if (list.some((x) => x.id === t.id)) continue;
          tape[t.series] = [t, ...list].sort((a, b) => b.t - a.t).slice(0, 120);
        }
        return { tape };
      });
    }
    default:
      return;
  }
}

/** The stream is down: poll the selected series' depth and trades (public market data, 1 s cache). */
async function pollBookFeed() {
  const code = state.sel;
  if (!code || !isBookLive(state)) return;
  const [d, tr] = await Promise.all([bookApi.depth(code), bookApi.trades(code, 60)]);
  if (state.sel !== code) return;
  set((s) => ({
    depth: d.ok ? { ...s.depth, [code]: d.data } : s.depth,
    tape: tr.ok ? { ...s.tape, [code]: [...tr.data].sort((a, b) => b.t - a.t).slice(0, 120) } : s.tape,
  }));
}

async function loadChain() {
  const u = state.u;
  const expiry = state.expiry;
  const my = ++seq;
  const login = loginOf();
  const r = state.publicView ? await optionsApi.publicChain(u, expiry) : await optionsApi.chain(login ?? "", u, expiry);
  if (my !== seq || u !== state.u || expiry !== state.expiry) return;
  if (!r.ok) {
    if (isLaunchingSoon(r.err) && r.err.code !== "not_found") set({ avail: "soon", availMsg: r.err.message, chainLoading: false });
    else set({ chainLoading: false });
    return;
  }
  const { expiries: pubExp, ...raw } = r.data;
  const chain = normChain(raw as OptionChain);
  const patch: Partial<OptState> = { chain, index: indexOf(chain.rows), chainLoading: false, ...bookOfChain(chain) };
  if (state.publicView && pubExp) patch.expiries = pubExp.map((e, i) => ({ id: i, date: e.date, kinds: e.kinds, cutAt: e.cutAt, twapStart: e.cutAt, status: "listed", state: "open", series: 0, secondsToCut: Math.round((Date.parse(e.cutAt) - Date.now()) / 1000) }));
  if (!expiry && chain.expiry) patch.expiry = chain.expiry;
  set(patch);
  applyRemap();
  syncSeries();
}

/** Load the expiry list and pick the expiry to show (the one on screen rolls when it stopped trading). */
async function loadExpiries(keepExpiry = true, prevDate: string | null = null) {
  const u = state.u;
  if (state.publicView) {
    // the public chain carries the expiry list
    if (!keepExpiry) set({ expiry: null });
    return;
  }
  const r = await optionsApi.expiries(loginOf() ?? "", u);
  if (u !== state.u) return;
  if (!r.ok) {
    if (isLaunchingSoon(r.err) && r.err.code === "options_disabled") set({ avail: "soon", availMsg: r.err.message });
    return;
  }
  const list = r.data.expiries;
  const pick = pickExpiry(list, keepExpiry ? state.expiry : null, keepExpiry ? null : prevDate);
  applyKind(pick.kind);
  const cur = state.expiry;
  if (keepExpiry && cur && pick.date && pick.date !== cur) {
    // the expiry on screen stopped trading (or was delisted): roll like checkRoll, carrying the selection over
    set({ expiries: list });
    return changeExpiry(pick.date);
  }
  set({ expiries: list, expiry: pick.date });
}

/** Show another expiry: its chain replaces the one on screen; the selected option moves to the same strike there. */
function changeExpiry(date: string) {
  if (date === state.expiry) return;
  const p = state.sel ? parseSeriesCode(state.sel) : null;
  remap = p && state.expiry && p.date === state.expiry && p.underlying === state.u ? { strike: p.strike, right: p.right, prevCode: state.sel! } : null;
  set({ expiry: date, chain: null, index: {}, chainLoading: true });
  void loadChain();
  syncStream();
}

/** The new expiry's chain arrived: select the same strike and right there (a single-option ticket follows). */
function applyRemap() {
  const m = remap;
  const c = state.chain;
  if (!m || !c || c.expiry !== state.expiry || c.underlying !== state.u) return;
  remap = null;
  const row = c.rows.find((r) => Math.abs(r.strike - m.strike) < 1e-9);
  const q = row ? (m.right === "call" ? row.call : row.put) : null;
  if (!row || !q) {
    if (state.sel === m.prevCode) set({ sel: null });
    return;
  }
  set((s) => {
    const one = s.ticket.legs.length === 1 && s.ticket.legs[0]!.series === m.prevCode ? s.ticket.legs[0]! : null;
    return {
      sel: s.sel === m.prevCode ? q.code : s.sel,
      // another expiry is another price: the trader chooses Buy or Sell again
      ticket: one ? { ...s.ticket, armed: false, limit: "", sl: "", tp: "", legs: [{ ...one, series: q.code, expiry: c.expiry, strike: row.strike, strikeLabel: row.strikeLabel }] } : s.ticket,
    };
  });
  syncSeries();
}

/** Once a second: the expiry on screen passed its cut (or stopped trading) → roll to the next one of its kind. */
function checkRoll() {
  if (state.avail !== "ready" || !state.expiry || !state.expiries.length) return;
  const cur = state.expiries.find((e) => e.date === state.expiry);
  if (!cur || expiryOpen(cur)) return;
  const pick = pickExpiry(state.expiries, state.expiry, null);
  if (!pick.date || pick.date === state.expiry) return;
  applyKind(pick.kind);
  changeExpiry(pick.date);
  // a new expiry is listed after the cut: refresh the list shortly
  setTimeout(() => void loadExpiries(true), 5_000);
}

async function boot() {
  const ctx = state.ctx;
  if (!ctx) return;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  const login = loginOf();
  if (!IS_LIVE && login) demoBoot(login);
  // guests (live builds) and the public chain page see the public chain; signed-in accounts their broker's chain
  // with their group's spreads
  if (ctx.publicPage || (IS_LIVE && !login)) {
    const list = mockUnderlyings(Date.now()).map((u) => ({ ...u, atmVol: null, realizedVol: null, nextExpiry: null }));
    const u = list.some((x) => x.symbol === state.u) ? state.u : "EURUSD";
    const seeded = state.chain && state.chain.underlying === u;
    set({ publicView: true, underlyings: list, u, chainLoading: !seeded });
    const r = await optionsApi.publicChain(u, state.expiry);
    if (!r.ok) {
      set({ avail: isLaunchingSoon(r.err) ? "soon" : "error", availMsg: r.err.message, chainLoading: false });
      if (!isLaunchingSoon(r.err)) retryTimer = setTimeout(() => void boot(), 15_000);
      return;
    }
    const { expiries: ex, ...raw } = r.data;
    const chain = normChain(raw as OptionChain);
    set({
      avail: "ready",
      ...bookOfChain(chain),
      chain,
      index: indexOf(chain.rows),
      expiry: chain.expiry,
      chainLoading: false,
      expiries: (ex ?? []).map((e, i) => ({ id: i, date: e.date, kinds: e.kinds, cutAt: e.cutAt, twapStart: e.cutAt, status: "listed", state: "open" as const, series: 0, secondsToCut: Math.round((Date.parse(e.cutAt) - Date.now()) / 1000) })),
    });
    // the Daily / Weekly / Monthly tab the trader uses
    const want = state.prefs.expKind ? nearestExpiry(state.expiries, state.prefs.expKind) : undefined;
    if (want && want.date !== state.expiry) changeExpiry(want.date);
    syncStream();
    startTimers();
    return;
  }
  set({ publicView: false });
  const r = await optionsApi.underlyings(login ?? "");
  if (state.ctx !== ctx) return;
  if (!r.ok) {
    const soon = isLaunchingSoon(r.err);
    set({ avail: soon ? "soon" : "error", availMsg: r.err.message });
    retryTimer = setTimeout(() => void boot(), soon ? 120_000 : 15_000);
    return;
  }
  const list = r.data.underlyings ?? [];
  if (!list.length) {
    set({ avail: "soon", underlyings: [] });
    return;
  }
  const u = list.some((x) => x.symbol === state.u) ? state.u : list[0]!.symbol;
  set({ underlyings: list, u, avail: "ready", chainLoading: true });
  await loadExpiries(true);
  await loadChain();
  syncStream();
  startTimers();
}

function startTimers() {
  if (!expiryTimer) expiryTimer = setInterval(() => void loadExpiries(true), 60_000);
  if (!rollTimer) rollTimer = setInterval(checkRoll, 1_000);
  if (!pollTimer)
    pollTimer = setInterval(() => {
      // the socket is down for a while (dev without the service, blocked WebSockets): poll the chain instead
      if (state.avail !== "ready" || state.stream === "open" || !downSince || Date.now() - downSince < 3_000) return;
      if (document.visibilityState === "hidden") return;
      if (state.stream !== "polling" && state.stream !== "unavailable") set({ stream: "polling" });
      void loadChain();
      void pollBookFeed();
    }, 2_000);
}

function teardown() {
  stream?.stop();
  stream = null;
  streamLogin = undefined;
  if (pollTimer) clearInterval(pollTimer);
  if (expiryTimer) clearInterval(expiryTimer);
  if (rollTimer) clearInterval(rollTimer);
  if (retryTimer) clearTimeout(retryTimer);
  pollTimer = expiryTimer = rollTimer = null;
  retryTimer = null;
  unbook?.();
  unbook = null;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

const uid = () => Math.random().toString(36).slice(2, 9);

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage blocked */
  }
}

export const opt = {
  /** The workspace (or a toolbox tab) is on screen: keep the data live while anything is mounted. */
  attach(ctx: OptCtx) {
    refs++;
    // an underlying asked for by a link (`?mode=options&u=XAUUSD`)
    let link: string | null = null;
    try {
      link = sessionStorage.getItem(LINK_UNDERLYING_KEY);
      if (link) sessionStorage.removeItem(LINK_UNDERLYING_KEY);
    } catch {
      /* storage blocked */
    }
    const prev = state.ctx;
    const changed = !prev || prev.login !== ctx.login || prev.guest !== ctx.guest || !!prev.publicPage !== !!ctx.publicPage;
    if (link && link !== state.u && (changed || state.avail !== "ready")) set({ u: link, prefs: { ...state.prefs, u: link } });
    else if (link && link !== state.u) opt.selectUnderlying(link);
    if (changed) {
      teardown();
      // the public page arrives with its server-rendered chain: keep it while the live data connects
      const keep = ctx.publicPage && state.publicView && state.chain;
      remap = null;
      set(
        keep
          ? { ctx, quotes: {}, ticket: emptyTicket(), sel: null, depth: {}, tape: {} }
          : { ctx, avail: "loading", chain: null, index: {}, quotes: {}, expiries: [], expiry: null, ticket: emptyTicket(), tradingSoon: false, sel: null, bookOff: false, depth: {}, tape: {} },
      );
      const offPositions = optionBook.subscribe(() => syncSeries());
      const offOrders = bookOrders.subscribe(() => syncSeries());
      unbook = () => {
        offPositions();
        offOrders();
      };
      void boot();
    } else if (prev.readOnly !== ctx.readOnly || prev.engine !== ctx.engine) set({ ctx });
    else if (!stream && state.avail === "ready") syncStream();
    return () => {
      refs--;
      // keep the stream a moment: switching tabs or modes back and forth shouldn't reconnect
      setTimeout(() => {
        if (refs > 0) return;
        teardown();
        set({ ctx: null, stream: "closed" });
      }, 15_000);
    };
  },
  /** The public chain page: start from the chain the server rendered. */
  seed(chain: OptionChain & { expiries?: { date: string; kinds: OptionExpiry["kinds"]; cutAt: string }[] }) {
    const { expiries, ...raw } = chain;
    const c = normChain(raw as OptionChain);
    set({
      publicView: true,
      avail: "ready",
      ...bookOfChain(c),
      u: c.underlying,
      expiry: c.expiry,
      chain: c,
      index: indexOf(c.rows),
      chainLoading: false,
      expiries: (expiries ?? []).map((e, i) => ({ id: i, date: e.date, kinds: e.kinds, cutAt: e.cutAt, twapStart: e.cutAt, status: "listed", state: "open" as const, series: 0, secondsToCut: Math.round((Date.parse(e.cutAt) - Date.now()) / 1000) })),
    });
    // another underlying's page (client-side navigation): move the live subscription to it
    if (stream) syncStream();
  },
  retry() {
    set({ avail: "loading" });
    void boot();
  },
  selectUnderlying(u: string) {
    if (u === state.u && state.chain) return;
    const prefs = { ...state.prefs, u };
    savePrefs(prefs);
    const prev = state.expiry;
    remap = null;
    // like the CFD order panel following the symbol: a single option of the old underlying leaves the ticket
    const single = state.ticket.legs.length === 1 && state.ticket.legs[0]!.u !== u;
    set((s) => ({ u, prefs, expiry: null, chain: null, index: {}, chainLoading: true, expiries: s.publicView ? [] : s.expiries, sel: null, ticket: single ? { ...emptyTicket(), ...keepOf(s.ticket) } : s.ticket }));
    syncBookFeed();
    void (async () => {
      await loadExpiries(false, prev);
      await loadChain();
      syncStream();
    })();
  },
  /** A date from the list (the expiry picker, the strategy builder): its tab lights up when it is a kind's nearest. */
  selectExpiry(date: string) {
    if (date === state.expiry) return;
    applyKind(kindOfExpiry(state.expiries, date, state.prefs.expKind));
    changeExpiry(date);
  },
  /** Daily / Weekly / Monthly: the nearest expiry of that kind (rolled to the next one after its cut). */
  selectKind(kind: ExpiryKind) {
    applyKind(kind);
    const e = nearestExpiry(state.expiries, kind);
    if (e) changeExpiry(e.date);
  },
  /** "Show on the chart" of a position: its underlying, expiry and premium chart. */
  showSeries(code: string): boolean {
    const p = parseSeriesCode(code);
    if (!p) return false;
    if (p.underlying !== state.u) {
      wantExpiry = p.date;
      opt.selectUnderlying(p.underlying);
    } else if (p.date !== state.expiry) {
      set({ sel: null });
      opt.selectExpiry(p.date);
    }
    const prefs = { ...state.prefs, center: "chart" as const };
    savePrefs(prefs);
    set({ sel: code, prefs });
    syncSeries();
    syncBookFeed();
    return true;
  },
  setPrefs(patch: Partial<Prefs>) {
    const prefs = { ...state.prefs, ...patch };
    savePrefs(prefs);
    set({ prefs });
  },
  setTradingSoon(v: boolean) {
    if (state.tradingSoon !== v) set({ tradingSoon: v });
  },
  /** The engine doesn't serve the book routes: fall back to the house-priced flow for this session. */
  setBookOff(v = true) {
    if (state.bookOff === v) return;
    set({ bookOff: v });
    syncBookFeed();
  },
  focus(ticket: string | null) {
    set({ focus: ticket });
  },
  openBuilder(open = true) {
    set({ builder: open });
  },

  /* ---- selection + ticket ---- */
  /**
   * A strike's call or put picked in the chain: it becomes the selected option (chart, highlight) and the ticket's
   * option, without a side until the trader chooses Buy or Sell. `add` (Shift+click, "Add leg", or a strategy
   * already in the ticket) adds it as a leg instead.
   */
  select(row: OptionChainRow, right: OptionRight, opts: { add?: boolean } = {}) {
    const q = right === "call" ? row.call : row.put;
    if (!q || !state.expiry) return;
    const t0 = state.ticket;
    const add = t0.legs.length > 0 && (opts.add || t0.adding || t0.legs.length > 1);
    const leg: TicketLeg = { id: uid(), series: q.code, u: state.u, expiry: state.expiry, right, strike: row.strike, strikeLabel: row.strikeLabel, side: "buy", contracts: t0.legs[0]?.contracts ?? 1 };
    set((s) => {
      const t = s.ticket;
      let ticket: Ticket;
      if (add) {
        if (t.legs.some((l) => l.series === q.code)) ticket = { ...t, adding: false };
        else {
          let legs = [...t.legs, leg].slice(-8);
          // another underlying in the ticket: start over (one strategy = one underlying)
          if (legs.some((l) => l.u !== leg.u)) legs = [leg];
          ticket = { ...t, legs, adding: false, armed: legs.length > 1 || t.armed, type: legs.length > 1 ? "market" : t.type };
        }
      } else if (t.legs.length === 1 && t.legs[0]!.series === q.code) ticket = { ...t, adding: false };
      else ticket = { ...emptyTicket(), ...keepOf(t), legs: [leg] };
      return { sel: q.code, ticket, prefs: s.prefs.panel === "simple" ? { ...s.prefs, panel: "ticket" } : s.prefs };
    });
    syncSeries();
    syncBookFeed();
  },
  /**
   * A price level clicked in the depth: a limit order at that price on the selected option, the side that trades
   * with it (an offer → Buy, a bid → Sell). `priceUsd` is USD per contract.
   */
  prefillLimit(series: string, side: Side, priceUsd: number) {
    const row = state.chain?.rows.find((r) => r.call?.code === series || r.put?.code === series);
    const one = state.ticket.legs.length === 1 && state.ticket.legs[0]!.series === series;
    if (!one) {
      if (!row) return;
      opt.select(row, row.call?.code === series ? "call" : "put");
    }
    set((s) => ({
      ticket: { ...s.ticket, armed: true, bookType: "limit", bookTif: s.ticket.bookTif === "ioc" || s.ticket.bookTif === "fok" ? s.ticket.bookTif : "gtc", limit: priceUsd.toFixed(2), legs: s.ticket.legs.map((l) => ({ ...l, side })) },
      prefs: s.prefs.panel === "simple" ? { ...s.prefs, panel: "ticket" } : s.prefs,
    }));
  },
  /** Buy or Sell on the ticket of a single option. */
  arm(side: Side) {
    set((s) => (s.ticket.legs.length === 1 ? { ticket: { ...s.ticket, armed: true, legs: [{ ...s.ticket.legs[0]!, side }] } } : {}));
  },
  /** Call ↔ put at the same strike (the ticket's Call / Put switch). */
  flipRight(right: OptionRight) {
    const base = state.ticket.legs.length === 1 ? state.ticket.legs[0]! : null;
    const p = parseSeriesCode(base?.series ?? state.sel ?? "");
    const c = state.chain;
    if (!p || !c || p.date !== c.expiry || p.underlying !== c.underlying || p.right === right) return;
    const row = c.rows.find((r) => Math.abs(r.strike - p.strike) < 1e-9);
    const q = row ? (right === "call" ? row.call : row.put) : null;
    if (!row || !q) return;
    set((s) => ({ sel: q.code, ticket: base ? { ...s.ticket, armed: false, limit: "", sl: "", tp: "", trigPrice: "", legs: [{ ...base, id: uid(), series: q.code, right, strike: row.strike, strikeLabel: row.strikeLabel }] } : s.ticket }));
    syncSeries();
    syncBookFeed();
  },
  /** "Add leg": the next strike picked in the chain is added to the ticket. */
  setAdding(v: boolean) {
    if (state.ticket.adding !== v) set((s) => ({ ticket: { ...s.ticket, adding: v } }));
  },
  setCenter(tab: CenterTab) {
    opt.setPrefs({ center: tab });
  },
  /** After a fill: a single option stays selected (no side, protection cleared); a strategy leaves the ticket. */
  afterFill() {
    set((s) => (s.ticket.legs.length === 1 ? { ticket: { ...emptyTicket(), ...keepOf(s.ticket), legs: s.ticket.legs } } : { ticket: { ...emptyTicket(), tif: s.ticket.tif, bookTif: keepOf(s.ticket).bookTif ?? "gtc" } }));
    syncSeries();
  },
  /** Legs from the strategy builder or simple mode (their sides are chosen). */
  setLegs(legs: Omit<TicketLeg, "id">[]) {
    set((s) => ({ sel: legs[0]?.series ?? s.sel, ticket: { ...emptyTicket(), ...keepOf(s.ticket), armed: true, legs: legs.slice(0, 8).map((l) => ({ ...l, id: uid() })) } }));
    syncSeries();
    syncBookFeed();
  },
  updateLeg(id: string, patch: Partial<Pick<TicketLeg, "side" | "contracts">>) {
    set((s) => ({ ticket: { ...s.ticket, legs: s.ticket.legs.map((l) => (l.id === id ? { ...l, ...patch } : l)) } }));
  },
  removeLeg(id: string) {
    // the leg left of a strategy keeps the side it had
    set((s) => ({ ticket: { ...s.ticket, armed: s.ticket.legs.length > 1 || s.ticket.armed, legs: s.ticket.legs.filter((l) => l.id !== id) } }));
    syncSeries();
  },
  setTicket(patch: Partial<Omit<Ticket, "legs">>) {
    set((s) => ({ ticket: { ...s.ticket, ...patch } }));
  },
  clearTicket() {
    set((s) => ({ ticket: { ...emptyTicket(), ...keepOf(s.ticket) } }));
    syncSeries();
  },
  /** Book orders changed (placed, filled, cancelled): their series stay streamed. */
  syncOrderSeries() {
    syncSeries();
  },
};

// an engine without the book routes: house prices for the rest of the session
bookOrders.onMissing(() => opt.setBookOff(true));

/** Keeps the options data live while the calling component is mounted. */
export function useOptionsAttach(ctx: OptCtx) {
  const { login, guest, engine, readOnly, publicPage } = ctx;
  React.useEffect(() => opt.attach({ login, guest, engine, readOnly, publicPage }), [login, guest, engine, readOnly, publicPage]);
}

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export function underlyingOf(s: OptState, u = s.u): OptionUnderlying | undefined {
  return s.underlyings.find((x) => x.symbol === u);
}

/** Rows around ATM (prefs.range strikes each side; 0 = all). */
export function visibleRows(chain: OptionChain, range: number, atm: number): OptionChainRow[] {
  if (!range || chain.rows.length <= range * 2 + 1) return chain.rows;
  const from = Math.max(0, Math.min(chain.rows.length - (range * 2 + 1), atm - range));
  return chain.rows.slice(from, from + range * 2 + 1);
}
