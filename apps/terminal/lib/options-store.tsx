"use client";

// State of the Options workspace in Kalks Trader (kept out of lib/store.tsx, which holds the CFD terminal). One
// external store shared by every lazily-loaded options module (workspace, toolbox tabs, mobile view): the selected
// underlying and expiry, the live chain (REST snapshot, then the WebSocket's changed rows; REST polling while the
// socket is down), quotes of series outside the chain on screen (open positions, ticket legs), view preferences,
// the order ticket's legs and the strategy builder. Positions themselves live in lib/options/book.ts.
import * as React from "react";
import { IS_LIVE } from "@kalks/mock";
import { mockUnderlyings } from "@kalks/mock/options";
import type { Timeframe } from "@/lib/trading";
import { optionsApi, isLaunchingSoon } from "@/lib/options/api";
import { optionBook } from "@/lib/options/book";
import { demoBoot } from "@/lib/options/mock-engine";
import { LINK_UNDERLYING_KEY } from "@/lib/options/mode";
import { createOptionsStream, type OptFrame, type OptStream, type OptStreamStatus } from "@/lib/options/stream";
import type { OptionChain, OptionChainRow, OptionExpiry, OptionQuote, OptionRight, OptionUnderlying, Side } from "@/lib/options/types";

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
}

export interface Ticket {
  legs: TicketLeg[];
  type: "market" | "limit";
  limit: string;
  sl: string;
  tp: string;
  trigger: boolean;
  triggerOp: "above" | "below";
  triggerPrice: string;
  tif: "gtc" | "day";
}

export type ChainView = "both" | "calls" | "puts";
export type SidePanel = "ticket" | "simple";

export interface Prefs {
  u: string;
  view: ChainView;
  greeks: boolean;
  /** probability ITM + breakeven columns */
  extra: boolean;
  /** strikes each side of ATM (0 = all) */
  range: number;
  tf: Timeframe;
  chart: boolean;
  panel: SidePanel;
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
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const PREFS_KEY = "kalks.options.prefs";
const DEFAULT_PREFS: Prefs = { u: "EURUSD", view: "both", greeks: false, extra: false, range: 10, tf: "M15", chart: true, panel: "ticket" };

function readPrefs(): Prefs {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(PREFS_KEY) : null;
    return raw ? ({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } as Prefs) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

const emptyTicket = (): Ticket => ({ legs: [], type: "market", limit: "", sl: "", tp: "", trigger: false, triggerOp: "above", triggerPrice: "", tif: "gtc" });

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
};

const listeners = new Set<() => void>();
function set(patch: Partial<OptState> | ((s: OptState) => Partial<OptState>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function getOpt() {
  return state;
}

/** Subscribe to a slice of the options state (the selector must return a stored value, not a new object). */
export function useOpt<T>(sel: (s: OptState) => T): T {
  return React.useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

/** The quote of a series wherever it is (chain on screen, or the series subscription). */
export function useSeriesQuote(code: string | null | undefined): OptionQuote | null {
  return useOpt((s) => (code ? (s.index[code] ?? s.quotes[code] ?? null) : null));
}

export const quoteOf = (code: string) => state.index[code] ?? state.quotes[code] ?? null;

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
let seq = 0;
let unbook: (() => void) | null = null;

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
  for (const l of state.ticket.legs) codes.add(l.series);
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
}

function onFrame(f: OptFrame) {
  switch (f.type) {
    case "chain": {
      if (f.underlying !== state.u || f.expiry !== state.expiry) return;
      const { type: _t, ...chain } = f;
      set({ chain: chain as OptionChain, index: indexOf(chain.rows), chainLoading: false });
      return syncSeries();
    }
    case "rows": {
      const c = state.chain;
      if (!c || f.u !== state.u || f.expiry !== state.expiry) return;
      const byLabel = new Map(f.rows.map((r) => [r.strikeLabel, r]));
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
      for (const q of f.quotes) quotes[q.code] = q;
      return set({ quotes });
    }
    default:
      return;
  }
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
  const { expiries: pubExp, ...chain } = r.data;
  const patch: Partial<OptState> = { chain: chain as OptionChain, index: indexOf(chain.rows), chainLoading: false };
  if (state.publicView && pubExp) patch.expiries = pubExp.map((e, i) => ({ id: i, date: e.date, kinds: e.kinds, cutAt: e.cutAt, twapStart: e.cutAt, status: "listed", state: "open", series: 0, secondsToCut: Math.round((Date.parse(e.cutAt) - Date.now()) / 1000) }));
  if (!expiry && chain.expiry) patch.expiry = chain.expiry;
  set(patch);
  syncSeries();
}

async function loadExpiries(keepExpiry = true) {
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
  const cur = keepExpiry && state.expiry && list.some((e) => e.date === state.expiry) ? state.expiry : (list.find((e) => e.state === "open")?.date ?? list[0]?.date ?? null);
  set({ expiries: list, expiry: cur });
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
    const { expiries: ex, ...chain } = r.data;
    set({
      avail: "ready",
      chain: chain as OptionChain,
      index: indexOf(chain.rows),
      expiry: chain.expiry,
      chainLoading: false,
      expiries: (ex ?? []).map((e, i) => ({ id: i, date: e.date, kinds: e.kinds, cutAt: e.cutAt, twapStart: e.cutAt, status: "listed", state: "open" as const, series: 0, secondsToCut: Math.round((Date.parse(e.cutAt) - Date.now()) / 1000) })),
    });
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
  if (!pollTimer)
    pollTimer = setInterval(() => {
      // the socket is down for a while (dev without the service, blocked WebSockets): poll the chain instead
      if (state.avail !== "ready" || state.stream === "open" || !downSince || Date.now() - downSince < 3_000) return;
      if (document.visibilityState === "hidden") return;
      if (state.stream !== "polling" && state.stream !== "unavailable") set({ stream: "polling" });
      void loadChain();
    }, 2_000);
}

function teardown() {
  stream?.stop();
  stream = null;
  streamLogin = undefined;
  if (pollTimer) clearInterval(pollTimer);
  if (expiryTimer) clearInterval(expiryTimer);
  if (retryTimer) clearTimeout(retryTimer);
  pollTimer = expiryTimer = null;
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
      set(keep ? { ctx, quotes: {}, ticket: emptyTicket() } : { ctx, avail: "loading", chain: null, index: {}, quotes: {}, expiries: [], expiry: null, ticket: emptyTicket(), tradingSoon: false });
      unbook = optionBook.subscribe(() => syncSeries());
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
    const { expiries, ...c } = chain;
    set({
      publicView: true,
      avail: "ready",
      u: c.underlying,
      expiry: c.expiry,
      chain: c as OptionChain,
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
    set({ u, prefs, expiry: null, chain: null, index: {}, chainLoading: true, expiries: state.publicView ? [] : state.expiries });
    void (async () => {
      await loadExpiries(false);
      await loadChain();
      syncStream();
    })();
  },
  selectExpiry(date: string) {
    if (date === state.expiry) return;
    set({ expiry: date, chain: null, index: {}, chainLoading: true });
    void loadChain();
    syncStream();
  },
  setPrefs(patch: Partial<Prefs>) {
    const prefs = { ...state.prefs, ...patch };
    savePrefs(prefs);
    set({ prefs });
  },
  setTradingSoon(v: boolean) {
    if (state.tradingSoon !== v) set({ tradingSoon: v });
  },
  focus(ticket: string | null) {
    set({ focus: ticket });
  },
  openBuilder(open = true) {
    set({ builder: open });
  },

  /* ---- ticket ---- */
  /** Click on a price in the chain: add the series to the ticket (or flip its side when it is already there). */
  addLeg(row: OptionChainRow, right: OptionRight, side: Side, opts: { replace?: boolean } = {}) {
    const q = right === "call" ? row.call : row.put;
    if (!q || !state.expiry) return;
    const leg: TicketLeg = { id: uid(), series: q.code, u: state.u, expiry: state.expiry, right, strike: row.strike, strikeLabel: row.strikeLabel, side, contracts: state.ticket.legs[0]?.contracts ?? 1 };
    set((s) => {
      const existing = s.ticket.legs.find((l) => l.series === q.code);
      let legs: TicketLeg[];
      if (opts.replace) legs = [{ ...leg, contracts: existing?.contracts ?? 1 }];
      else if (existing) legs = s.ticket.legs.map((l) => (l.series === q.code ? { ...l, side } : l));
      else legs = [...s.ticket.legs, leg].slice(-8);
      // another underlying in the ticket: start over (one strategy = one underlying)
      if (legs.some((l) => l.u !== leg.u)) legs = [leg];
      return { ticket: { ...s.ticket, legs, type: legs.length > 1 ? "market" : s.ticket.type }, prefs: s.prefs.panel === "simple" ? { ...s.prefs, panel: "ticket" } : s.prefs };
    });
    syncSeries();
  },
  setLegs(legs: Omit<TicketLeg, "id">[]) {
    set((s) => ({ ticket: { ...emptyTicket(), tif: s.ticket.tif, legs: legs.slice(0, 8).map((l) => ({ ...l, id: uid() })) } }));
    syncSeries();
  },
  updateLeg(id: string, patch: Partial<Pick<TicketLeg, "side" | "contracts">>) {
    set((s) => ({ ticket: { ...s.ticket, legs: s.ticket.legs.map((l) => (l.id === id ? { ...l, ...patch } : l)) } }));
  },
  removeLeg(id: string) {
    set((s) => ({ ticket: { ...s.ticket, legs: s.ticket.legs.filter((l) => l.id !== id) } }));
    syncSeries();
  },
  setTicket(patch: Partial<Omit<Ticket, "legs">>) {
    set((s) => ({ ticket: { ...s.ticket, ...patch } }));
  },
  clearTicket() {
    set((s) => ({ ticket: { ...emptyTicket(), tif: s.ticket.tif } }));
    syncSeries();
  },
};

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
