"use client";

import * as React from "react";
import { toast } from "sonner";
import { ACCOUNTS, HISTORY, INSTRUMENTS, POSITIONS, getInstrument, isMarketOpen, priceFeed, rebaseTrades, type Quote, type TradingAccount } from "@kalks/mock";
import { useQuotes } from "@kalks/ui";
import {
  DEFAULT_SYMBOLS,
  PENDING_LABEL,
  SEED_PENDING,
  SEED_POSITIONS_EXTRA,
  accCcy,
  accMoney,
  fmtPrice,
  fmtVol,
  marginRequired,
  nextTicket,
  pointSize,
  profitAt,
  profitUsd,
  roundPrice,
  serverTime,
  type ChartType,
  type Expiry,
  type OrderType,
  type PendingOrder,
  type TClosed,
  type TPosition,
  type Timeframe,
} from "./trading";
import { beep } from "./sound";
import { aiTrader } from "./ai-trader/runtime";
import { migrateIndicators, type IndicatorInstance } from "./indicators";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Session {
  login: string;
  investor: boolean;
  server: string;
  via: "sso" | "login";
  at: number;
}

export interface Anchor {
  l: number; // logical bar index
  p: number; // price
}
export type Drawing =
  | { id: string; kind: "hline"; price: number }
  | { id: string; kind: "trend" | "rect" | "fib"; a: Anchor; b: Anchor };
export type DrawTool = "cursor" | "crosshair" | "hline" | "trend" | "fib" | "rect" | "text" | "ruler";

export interface ChartTab {
  id: string;
  symbol: string;
  tf: Timeframe;
  type: ChartType;
  /** Indicator instances (type + params + style). Old `IndicatorId[]` workspaces are migrated on load. */
  indicators: IndicatorInstance[];
  drawings: Drawing[];
}

export type Layout = "1" | "2h" | "2v" | "4";
export const LAYOUT_COUNT: Record<Layout, number> = { "1": 1, "2h": 2, "2v": 2, "4": 4 };

export type ToolboxTab = "trade" | "history" | "exposure" | "news" | "calendar" | "alerts" | "journal" | "ai";
export type RightTab = "order" | "depth" | "info";
export type MwTab = "symbols" | "details" | "favourites";
/** Which chart engine renders chart tiles. "kalks" = the original lightweight-charts engine. */

export interface Workspace {
  layout: Layout;
  tabs: ChartTab[];
  slots: string[];
  activeId: string;
  panels: { watch: boolean; right: boolean; toolbox: boolean; navigator: boolean };
  rightTab: RightTab;
  toolboxTab: ToolboxTab;
  mwTab: MwTab;
  favourites: string[];
  hidden: string[];
  oneClick: boolean;
  sound: boolean;
  deviation: number; // points
  lot: number; // default one-click lot
  profile: string;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  cond: "above" | "below";
  price: number;
  note?: string;
  active: boolean;
  created: string;
  triggeredAt?: string;
}

export interface JournalLine {
  id: number;
  ts: number;
  src: "Trade" | "Terminal" | "Network" | "Alerts" | "Account" | "Experts";
  text: string;
  level?: "info" | "warn" | "error";
}

export interface OrderRequest {
  symbol: string;
  side: "buy" | "sell";
  type: OrderType;
  volume: number;
  price?: number;
  stopLimit?: number;
  sl?: number;
  tp?: number;
  trailing?: number; // price distance
  expiry?: Expiry;
  expiryDate?: string;
  comment?: string;
  ocoPrice?: number; // place an opposite-side twin at this price, linked OCO
  source?: TPosition["source"];
}

export interface NewOrderPrefill {
  symbol: string;
  side?: "buy" | "sell";
  type?: OrderType;
  price?: number;
}

interface Core {
  positions: TPosition[];
  pendings: PendingOrder[];
  history: TClosed[];
  balances: Record<string, number>; // USD
  refills: Record<string, number>;
  alerts: PriceAlert[];
  journal: JournalLine[];
}

/* ------------------------------------------------------------------ */
/* Defaults & persistence                                              */
/* ------------------------------------------------------------------ */

const WS_KEY = "kalks.terminal.workspace";
export const SESSION_KEY = "kalks.terminal.session";
export const SAVED_KEY = "kalks.terminal.saved";

const uid = () => Math.random().toString(36).slice(2, 9);

export function makeTab(symbol: string, tf: Timeframe = "H1", indicators: IndicatorInstance[] = []): ChartTab {
  return { id: uid(), symbol, tf, type: "candles", indicators, drawings: [] };
}

export function defaultWorkspace(): Workspace {
  const tabs = [
    makeTab("XAUUSD", "M15", migrateIndicators(["ema50", "sma20"])),
    makeTab("EURUSD", "H1", migrateIndicators(["bb"])),
    makeTab("NAS100", "M5", migrateIndicators(["rsi"])),
    makeTab("BTCUSD", "H4", migrateIndicators(["macd"])),
  ];
  return {
    layout: "1",
    tabs,
    slots: [tabs[0]!.id],
    activeId: tabs[0]!.id,
    panels: { watch: true, right: true, toolbox: true, navigator: true },
    rightTab: "order",
    toolboxTab: "trade",
    mwTab: "symbols",
    favourites: ["XAUUSD", "EURUSD", "NAS100", "BTCUSD", "GBPUSD"],
    hidden: [],
    oneClick: true,
    sound: true,
    deviation: 10,
    lot: 0.5,
    profile: "Default",
  };
}

function loadWorkspace(): Workspace {
  const d = defaultWorkspace();
  try {
    const raw = localStorage.getItem(WS_KEY);
    if (!raw) return d;
    const w = { ...d, ...(JSON.parse(raw) as Partial<Workspace>) };
    w.panels = { ...d.panels, ...w.panels };
    if (!Array.isArray(w.tabs) || w.tabs.length === 0) return d;
    w.tabs = w.tabs.filter((t) => INSTRUMENTS.some((i) => i.symbol === t.symbol)).map((t) => ({ ...t, drawings: t.drawings ?? [], indicators: migrateIndicators(t.indicators) }));
    if (!w.tabs.length) return d;
    w.slots = (w.slots ?? []).filter((s) => w.tabs.some((t) => t.id === s));
    if (!w.slots.length) w.slots = [w.tabs[0]!.id];
    if (!w.tabs.some((t) => t.id === w.activeId)) w.activeId = w.slots[0]!;
    return fitSlots(w);
  } catch {
    return d;
  }
}

/** Make sure `slots` holds exactly as many charts as the layout shows. */
function fitSlots(w: Workspace): Workspace {
  const n = LAYOUT_COUNT[w.layout];
  let slots = w.slots.filter((s) => w.tabs.some((t) => t.id === s));
  let tabs = w.tabs;
  if (slots.length > n) {
    const keep = slots.includes(w.activeId) ? [w.activeId, ...slots.filter((s) => s !== w.activeId)] : slots;
    slots = keep.slice(0, n).sort((a, b) => w.slots.indexOf(a) - w.slots.indexOf(b));
  }
  while (slots.length < n) {
    const free = tabs.find((t) => !slots.includes(t.id));
    if (free) slots = [...slots, free.id];
    else {
      const used = new Set(tabs.map((t) => t.symbol));
      const sym = DEFAULT_SYMBOLS.find((s) => !used.has(s)) ?? "GBPUSD";
      const t = makeTab(sym, "H1");
      tabs = [...tabs, t];
      slots = [...slots, t.id];
    }
  }
  const activeId = slots.includes(w.activeId) ? w.activeId : slots[0]!;
  return { ...w, tabs, slots, activeId };
}

function initialCore(): Core {
  const balances: Record<string, number> = {};
  const refills: Record<string, number> = {};
  for (const a of ACCOUNTS) {
    balances[a.login] = a.cent ? a.balance / 100 : a.balance;
    refills[a.login] = a.refillsLeft ?? 0;
  }
  const now = Date.now();
  return {
    positions: [...POSITIONS, ...rebaseTrades(SEED_POSITIONS_EXTRA)].map((p) => ({ ...p })),
    pendings: rebaseTrades(SEED_PENDING).map((p) => ({ ...p })),
    history: HISTORY.map((h) => ({ ...h })) as TClosed[],
    balances,
    refills,
    alerts: rebaseTrades([
      { id: uid(), symbol: "XAUUSD", cond: "above", price: 2670, note: "Retest of ATH", active: true, created: new Date(now - 3600e3 * 5).toISOString() },
      { id: uid(), symbol: "EURUSD", cond: "below", price: 1.08, note: "ECB week support", active: true, created: new Date(now - 3600e3 * 26).toISOString() },
      { id: uid(), symbol: "BTCUSD", cond: "above", price: 65000, active: false, created: new Date(now - 3600e3 * 50).toISOString(), triggeredAt: new Date(now - 3600e3 * 30).toISOString() },
    ] as PriceAlert[]),
    journal: [],
  };
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked */
  }
}

/* ------------------------------------------------------------------ */
/* Account metrics                                                     */
/* ------------------------------------------------------------------ */

export interface Metrics {
  balance: number;
  credit: number;
  equity: number;
  margin: number;
  free: number;
  level: number;
  floating: number;
}

export function computeMetrics(acc: TradingAccount, balance: number, positions: TPosition[], quotes: Record<string, Quote>): Metrics {
  let floating = 0;
  let margin = 0;
  for (const p of positions) {
    const q = quotes[p.symbol] ?? priceFeed().snapshot(p.symbol)!;
    floating += profitUsd(p, q.bid, q.ask);
    margin += marginRequired(p.symbol, p.volume, p.openPrice, acc.leverage);
  }
  const credit = acc.cent ? acc.credit / 100 : acc.credit;
  const equity = balance + credit + floating;
  return { balance, credit, equity, margin, free: equity - margin, level: margin > 0 ? (equity / margin) * 100 : Infinity, floating };
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

interface UiState {
  newOrder: NewOrderPrefill | null;
  positionDialog: string | null;
  pendingDialog: string | null;
  search: boolean;
  shortcuts: boolean;
  spec: string | null;
  about: boolean;
  alertDialog: { symbol: string; price?: number } | null;
}

interface Ctx {
  session: Session;
  account: TradingAccount;
  accounts: TradingAccount[];
  readOnly: boolean;
  positions: TPosition[]; // current account
  pendings: PendingOrder[];
  history: TClosed[];
  allPositions: TPosition[];
  balances: Record<string, number>;
  refillsLeft: number;
  alerts: PriceAlert[];
  journal: JournalLine[];
  ws: Workspace;
  ui: UiState;
  drawTool: DrawTool;
  selectedDrawing: string | null;
  activeTab: ChartTab;
  activeSymbol: string;
  // workspace
  setWs: (patch: Partial<Workspace> | ((w: Workspace) => Partial<Workspace>)) => void;
  setLayout: (l: Layout) => void;
  addTab: (symbol?: string, tf?: Timeframe) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<ChartTab> | ((t: ChartTab) => Partial<ChartTab>)) => void;
  openSymbol: (symbol: string, newTab?: boolean) => void;
  togglePanel: (k: keyof Workspace["panels"], v?: boolean) => void;
  setDrawTool: (t: DrawTool) => void;
  selectDrawing: (id: string | null) => void;
  deleteSelectedDrawing: () => void;
  resetWorkspace: () => void;
  // ui
  setUi: (patch: Partial<UiState>) => void;
  openNewOrder: (p?: Partial<NewOrderPrefill>) => void;
  // trading
  placeOrder: (o: OrderRequest) => boolean;
  quickTrade: (symbol: string, side: "buy" | "sell", volume?: number) => void;
  closePosition: (ticket: string, volume?: number, reason?: string) => void;
  modifyPosition: (ticket: string, patch: { sl?: number | null; tp?: number | null; trailing?: number | null }) => boolean;
  closeBy: (a: string, b: string) => void;
  cancelPending: (ticket: string) => void;
  modifyPending: (ticket: string, patch: { price?: number; sl?: number | null; tp?: number | null }) => boolean;
  bulkClose: (kind: "all" | "profit" | "loss" | "symbol" | "buys" | "sells", symbol?: string) => void;
  cancelAllPendings: () => void;
  // alerts & journal
  addAlert: (a: Omit<PriceAlert, "id" | "created" | "active">) => void;
  updateAlert: (id: string, patch: Partial<PriceAlert>) => void;
  removeAlert: (id: string) => void;
  log: (src: JournalLine["src"], text: string, level?: JournalLine["level"]) => void;
  clearJournal: () => void;
  // account
  switchAccount: (login: string) => void;
  refillDemo: () => void;
  logout: () => void;
}

const TerminalCtx = React.createContext<Ctx | null>(null);

export function useTerminal() {
  const c = React.useContext(TerminalCtx);
  if (!c) throw new Error("useTerminal outside TerminalProvider");
  return c;
}

/** Live metrics for the current (or given) account. */
export function useMetrics(login?: string): Metrics & { account: TradingAccount } {
  const t = useTerminal();
  const l = login ?? t.account.login;
  const acc = ACCOUNTS.find((a) => a.login === l)!;
  const pos = t.allPositions.filter((p) => p.login === l);
  const qs = useQuotes(pos.length ? [...new Set(pos.map((p) => p.symbol))] : ["EURUSD"]);
  return { ...computeMetrics(acc, t.balances[l] ?? 0, pos, qs), account: acc };
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function TerminalProvider({ initialSession, children, onLogout }: { initialSession: Session; children: React.ReactNode; onLogout: () => void }) {
  const [session, setSession] = React.useState(initialSession);
  const [core, setCore] = React.useState<Core>(initialCore);
  const coreRef = React.useRef(core);
  const [ws, setWsState] = React.useState<Workspace>(loadWorkspace);
  const wsRef = React.useRef(ws);
  wsRef.current = ws;
  const sessionRef = React.useRef(session);
  sessionRef.current = session;
  const [ui, setUiState] = React.useState<UiState>({ newOrder: null, positionDialog: null, pendingDialog: null, search: false, shortcuts: false, spec: null, about: false, alertDialog: null });
  const [drawTool, setDrawTool] = React.useState<DrawTool>("cursor");
  const [selectedDrawing, selectDrawing] = React.useState<string | null>(null);
  const jid = React.useRef(0);

  const commit = React.useCallback((fn: (c: Core) => Core) => {
    const next = fn(coreRef.current);
    coreRef.current = next;
    setCore(next);
  }, []);

  const log = React.useCallback(
    (src: JournalLine["src"], text: string, level?: JournalLine["level"]) => {
      const line: JournalLine = { id: ++jid.current, ts: Date.now(), src, text, level };
      commit((c) => ({ ...c, journal: [...c.journal.slice(-499), line] }));
    },
    [commit],
  );

  const accountOf = (login: string) => ACCOUNTS.find((a) => a.login === login)!;
  const account = accountOf(session.login);
  const readOnly = session.investor;

  const notify = React.useCallback((kind: "fill" | "close" | "alert" | "error") => {
    if (wsRef.current.sound) beep(kind);
  }, []);

  // persist workspace
  React.useEffect(() => {
    try {
      localStorage.setItem(WS_KEY, JSON.stringify(ws));
    } catch {
      /* ignore */
    }
  }, [ws]);

  // boot journal
  React.useEffect(() => {
    const a = accountOf(initialSession.login);
    const n = coreRef.current.positions.filter((p) => p.login === a.login).length;
    const o = coreRef.current.pendings.filter((p) => p.login === a.login).length;
    log("Terminal", "Kalks Trader x64 build 5120 started for Kalks Global Markets Ltd");
    log("Terminal", `${navigator.platform || "Web"}, ${navigator.hardwareConcurrency ?? 8} cores, ${INSTRUMENTS.length} symbols, GMT+3 server time`);
    log("Network", `'${a.login}': authorized on ${a.server} through Access Point EU Frankfurt (ping 38.2 ms)${initialSession.investor ? ", investor mode (read-only)" : ""}`);
    log("Network", `'${a.login}': terminal synchronized with Kalks Global: ${n} positions, ${o} orders, ${INSTRUMENTS.length} symbols, 0 spreads`);
    log("Trade", `'${a.login}': ${a.mode} account, leverage 1:${a.leverage}, ${accCcy(a)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ fills ------------------------------ */

  const addHistory = (c: Core, p: TPosition, volume: number, price: number, reason: string): Core => {
    const share = volume / p.volume;
    const profit = profitAt({ ...p, volume }, price) + p.swap * share - p.commission * share;
    const closed: TClosed = {
      ...p,
      volume,
      swap: +(p.swap * share).toFixed(2),
      commission: +(p.commission * share).toFixed(2),
      closePrice: price,
      closeTime: new Date().toISOString(),
      profit: +profit.toFixed(2),
      reason,
    };
    return { ...c, history: [closed, ...c.history], balances: { ...c.balances, [p.login]: (c.balances[p.login] ?? 0) + profit } };
  };

  /** Execute a fill for `login`, honouring hedging/netting. Returns a journal-friendly description. */
  const fill = (c: Core, login: string, r: { symbol: string; side: "buy" | "sell"; volume: number; price: number; sl?: number; tp?: number; trailing?: number; comment?: string; source: TPosition["source"] }): { core: Core; ticket: string } => {
    const acc = accountOf(login);
    const commission = acc.group === "ECN" ? +(3.5 * r.volume).toFixed(2) : 0;
    const make = (volume: number): TPosition => ({
      ticket: nextTicket(),
      login,
      symbol: r.symbol,
      side: r.side,
      volume: +volume.toFixed(2),
      openPrice: r.price,
      sl: r.sl,
      tp: r.tp,
      trailing: r.trailing,
      swap: 0,
      commission,
      openTime: new Date().toISOString(),
      source: r.source,
      comment: r.comment,
    });
    if (acc.mode === "hedging") {
      const p = make(r.volume);
      return { core: { ...c, positions: [...c.positions, p] }, ticket: p.ticket };
    }
    // netting: one position per symbol
    const ex = c.positions.find((p) => p.login === login && p.symbol === r.symbol);
    if (!ex) {
      const p = make(r.volume);
      return { core: { ...c, positions: [...c.positions, p] }, ticket: p.ticket };
    }
    if (ex.side === r.side) {
      const vol = ex.volume + r.volume;
      const merged: TPosition = { ...ex, volume: +vol.toFixed(2), openPrice: roundPrice(r.symbol, (ex.openPrice * ex.volume + r.price * r.volume) / vol), sl: r.sl ?? ex.sl, tp: r.tp ?? ex.tp, commission: ex.commission + commission };
      return { core: { ...c, positions: c.positions.map((p) => (p.ticket === ex.ticket ? merged : p)) }, ticket: ex.ticket };
    }
    const closeVol = Math.min(ex.volume, r.volume);
    let next = addHistory(c, ex, closeVol, r.price, "netting");
    const remaining = +(ex.volume - r.volume).toFixed(2);
    if (remaining > 0) {
      const share = remaining / ex.volume;
      next = { ...next, positions: next.positions.map((p) => (p.ticket === ex.ticket ? { ...ex, volume: remaining, swap: ex.swap * share, commission: ex.commission * share } : p)) };
      return { core: next, ticket: ex.ticket };
    }
    next = { ...next, positions: next.positions.filter((p) => p.ticket !== ex.ticket) };
    if (remaining < 0) {
      const p = make(-remaining);
      next = { ...next, positions: [...next.positions, p] };
      return { core: next, ticket: p.ticket };
    }
    return { core: next, ticket: ex.ticket };
  };

  const validStops = (side: "buy" | "sell", ref: number, sl?: number, tp?: number) => {
    if (side === "buy") return (sl === undefined || sl < ref) && (tp === undefined || tp > ref);
    return (sl === undefined || sl > ref) && (tp === undefined || tp < ref);
  };

  const fail = (text: string, reason: string) => {
    log("Trade", `${text} failed [${reason}]`, "error");
    toast.error(reason, { description: text });
    notify("error");
    return false;
  };

  /** MT5 behaviour: no new orders, modifications or closes while the symbol's session is closed. */
  const marketClosed = (text: string, quiet = false) => {
    log("Trade", `${text} failed [Market closed]`, "error");
    if (!quiet) {
      toast.error("Market is closed", { description: text });
      notify("error");
    }
    return false;
  };

  const placeOrder = React.useCallback(
    (o: OrderRequest): boolean => {
      const s = sessionRef.current;
      if (s.investor) {
        toast.error("Trading is disabled", { description: "You are connected with the investor (read-only) password." });
        return false;
      }
      const acc = accountOf(s.login);
      const q = priceFeed().snapshot(o.symbol)!;
      const inst = getInstrument(o.symbol);
      const vol = +o.volume.toFixed(2);
      const desc = o.type === "market" ? `market ${o.side} ${fmtVol(vol)} ${o.symbol}` : `${PENDING_LABEL({ side: o.side, type: o.type as PendingOrder["type"] })} ${fmtVol(vol)} ${o.symbol} at ${fmtPrice(o.symbol, o.price ?? 0)}`;
      if (!(vol >= 0.01)) return fail(desc, "Invalid volume");
      if (!isMarketOpen(o.symbol)) return marketClosed(`'${acc.login}': ${desc}`);

      // margin check
      const c0 = coreRef.current;
      const m = computeMetrics(acc, c0.balances[acc.login] ?? 0, c0.positions.filter((p) => p.login === acc.login), {});
      const need = marginRequired(o.symbol, vol, o.side === "buy" ? q.ask : q.bid, acc.leverage);
      if (o.type === "market" && need > m.free) return fail(desc, "Not enough money");

      if (o.type === "market") {
        const dev = wsRef.current.deviation;
        const slipPts = Math.floor(Math.random() * Math.min(dev, 3));
        const px = roundPrice(o.symbol, (o.side === "buy" ? q.ask : q.bid) + (o.side === "buy" ? 1 : -1) * slipPts * pointSize(o.symbol) * (Math.random() < 0.5 ? 1 : -1));
        if (!validStops(o.side, px, o.sl, o.tp)) return fail(desc, "Invalid stops");
        const { core, ticket } = fill(c0, acc.login, { symbol: o.symbol, side: o.side, volume: vol, price: px, sl: o.sl, tp: o.tp, trailing: o.trailing, comment: o.comment, source: o.source ?? "manual" });
        commit(() => core);
        log("Trade", `'${acc.login}': market ${o.side} ${fmtVol(vol)} ${o.symbol}${o.sl ? ` sl: ${fmtPrice(o.symbol, o.sl)}` : ""}${o.tp ? ` tp: ${fmtPrice(o.symbol, o.tp)}` : ""} (deviation ${dev})`);
        log("Trade", `'${acc.login}': deal #${ticket} ${o.side} ${fmtVol(vol)} ${o.symbol} at ${fmtPrice(o.symbol, px)} done (based on order #${ticket})`);
        toast.success(`${o.side === "buy" ? "Buy" : "Sell"} ${fmtVol(vol)} ${o.symbol} filled`, { description: `#${ticket} at ${fmtPrice(o.symbol, px)} · ${acc.mode}${slipPts ? ` · slippage ${slipPts} pt` : ""}` });
        notify("fill");
        return true;
      }

      const price = roundPrice(o.symbol, o.price ?? (o.side === "buy" ? q.ask : q.bid));
      const ref = o.side === "buy" ? q.ask : q.bid;
      const typeOk =
        o.type === "limit" ? (o.side === "buy" ? price < ref : price > ref) : o.side === "buy" ? price > ref : price < ref;
      if (!typeOk) return fail(desc, "Invalid price");
      if (o.type === "stop-limit" && o.stopLimit !== undefined && (o.side === "buy" ? o.stopLimit > price : o.stopLimit < price)) return fail(desc, "Invalid stop-limit price");
      if (!validStops(o.side, o.type === "stop-limit" ? (o.stopLimit ?? price) : price, o.sl, o.tp)) return fail(desc, "Invalid stops");
      const oco = o.ocoPrice !== undefined ? uid() : undefined;
      const base: PendingOrder = {
        ticket: nextTicket(),
        login: acc.login,
        symbol: o.symbol,
        side: o.side,
        type: o.type as PendingOrder["type"],
        volume: vol,
        price,
        stopLimit: o.type === "stop-limit" ? roundPrice(o.symbol, o.stopLimit ?? price) : undefined,
        sl: o.sl,
        tp: o.tp,
        trailing: o.trailing,
        expiry: o.expiry ?? "GTC",
        expiryDate: o.expiryDate,
        placed: new Date().toISOString(),
        source: o.source ?? "manual",
        comment: o.comment,
        oco,
      };
      const list = [base];
      if (o.ocoPrice !== undefined) {
        const twinSide = o.side === "buy" ? "sell" : "buy";
        const twinPrice = roundPrice(o.symbol, o.ocoPrice);
        const tref = twinSide === "buy" ? q.ask : q.bid;
        const ok = base.type === "limit" ? (twinSide === "buy" ? twinPrice < tref : twinPrice > tref) : twinSide === "buy" ? twinPrice > tref : twinPrice < tref;
        if (!ok) return fail(`OCO ${twinSide} ${base.type} at ${fmtPrice(o.symbol, twinPrice)}`, "Invalid OCO price");
        list.push({ ...base, ticket: nextTicket(), side: twinSide, price: twinPrice, sl: undefined, tp: undefined, stopLimit: undefined });
      }
      commit((c) => ({ ...c, pendings: [...c.pendings, ...list] }));
      for (const p of list) log("Trade", `'${acc.login}': accepted ${PENDING_LABEL(p)} ${fmtVol(p.volume)} ${p.symbol} at ${fmtPrice(p.symbol, p.price)}${p.oco ? " [OCO]" : ""} #${p.ticket}`);
      toast.success(`${PENDING_LABEL(base).replace(/^\w/, (x) => x.toUpperCase())} placed`, { description: `${fmtVol(vol)} ${o.symbol} at ${fmtPrice(o.symbol, price)}${list.length > 1 ? ` + OCO ${list[1]!.side} at ${fmtPrice(o.symbol, list[1]!.price)}` : ""} · ${base.expiry === "Date" ? base.expiryDate : base.expiry}` });
      notify("fill");
      void inst;
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, log, notify],
  );

  const quickTrade = React.useCallback(
    (symbol: string, side: "buy" | "sell", volume?: number) => {
      placeOrder({ symbol, side, type: "market", volume: volume ?? wsRef.current.lot });
    },
    [placeOrder],
  );

  const closeInternal = (ticket: string, volume: number | undefined, reason: string, at?: number, silent = false) => {
    const c = coreRef.current;
    const p = c.positions.find((x) => x.ticket === ticket);
    if (!p) return;
    const q = priceFeed().snapshot(p.symbol)!;
    const price = at ?? (p.side === "buy" ? q.bid : q.ask);
    const vol = Math.min(p.volume, +(volume ?? p.volume).toFixed(2));
    let next = addHistory(c, p, vol, price, reason);
    const remaining = +(p.volume - vol).toFixed(2);
    if (remaining > 0) {
      const share = remaining / p.volume;
      next = { ...next, positions: next.positions.map((x) => (x.ticket === ticket ? { ...p, volume: remaining, swap: p.swap * share, commission: p.commission * share } : x)) };
    } else next = { ...next, positions: next.positions.filter((x) => x.ticket !== ticket) };
    commit(() => next);
    const profit = next.history[0]!.profit;
    const acc = accountOf(p.login);
    log("Trade", `'${p.login}': ${reason === "manual" ? "" : `${reason} triggered, `}deal #${nextTicket()} ${p.side === "buy" ? "sell" : "buy"} ${fmtVol(vol)} ${p.symbol} at ${fmtPrice(p.symbol, price)} done (close #${ticket}${remaining > 0 ? `, partial ${fmtVol(vol)} of ${fmtVol(p.volume)}` : ""}), profit ${accMoney(acc, profit, { signed: true })}`);
    if (!silent && p.login === sessionRef.current.login) {
      const title = reason === "sl" ? `Stop loss hit · ${p.symbol}` : reason === "tp" ? `Take profit hit · ${p.symbol}` : `Closed #${ticket}${remaining > 0 ? ` (partial ${fmtVol(vol)})` : ""}`;
      (profit >= 0 ? toast.success : toast.error)(title, { description: `${p.side.toUpperCase()} ${fmtVol(vol)} ${p.symbol} at ${fmtPrice(p.symbol, price)} · ${accMoney(acc, profit, { signed: true })} ${accCcy(acc)}` });
      notify("close");
    }
  };

  const closePosition = React.useCallback(
    (ticket: string, volume?: number, reason = "manual") => {
      if (sessionRef.current.investor) return void toast.error("Read-only session");
      const p = coreRef.current.positions.find((x) => x.ticket === ticket);
      if (p && !isMarketOpen(p.symbol)) return void marketClosed(`'${p.login}': close #${ticket} ${p.side} ${fmtVol(volume ?? p.volume)} ${p.symbol}`);
      closeInternal(ticket, volume, reason);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const modifyPosition = React.useCallback(
    (ticket: string, patch: { sl?: number | null; tp?: number | null; trailing?: number | null }) => {
      if (sessionRef.current.investor) return false;
      const p = coreRef.current.positions.find((x) => x.ticket === ticket);
      if (!p) return false;
      const q = priceFeed().snapshot(p.symbol)!;
      const sl = patch.sl === undefined ? p.sl : patch.sl === null ? undefined : roundPrice(p.symbol, patch.sl);
      const tp = patch.tp === undefined ? p.tp : patch.tp === null ? undefined : roundPrice(p.symbol, patch.tp);
      const trailing = patch.trailing === undefined ? p.trailing : patch.trailing === null ? undefined : patch.trailing;
      const text = `modify #${ticket} ${p.side} ${fmtVol(p.volume)} ${p.symbol} sl: ${sl ? fmtPrice(p.symbol, sl) : "0"}, tp: ${tp ? fmtPrice(p.symbol, tp) : "0"}`;
      if (!isMarketOpen(p.symbol)) return marketClosed(`'${p.login}': ${text}`);
      if (!validStops(p.side, p.side === "buy" ? q.bid : q.ask, sl, tp)) return fail(text, "Invalid stops");
      commit((c) => ({ ...c, positions: c.positions.map((x) => (x.ticket === ticket ? { ...x, sl, tp, trailing } : x)) }));
      log("Trade", `'${p.login}': ${text}${trailing ? `, trailing ${Math.round(trailing / pointSize(p.symbol))} pts` : ""} done`);
      toast.success(`Position #${ticket} modified`, { description: `S/L ${sl ? fmtPrice(p.symbol, sl) : "—"} · T/P ${tp ? fmtPrice(p.symbol, tp) : "—"}${trailing ? ` · trailing ${Math.round(trailing / pointSize(p.symbol))} pts` : ""}` });
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, log],
  );

  const closeBy = React.useCallback(
    (a: string, b: string) => {
      const c = coreRef.current;
      const pa = c.positions.find((x) => x.ticket === a);
      const pb = c.positions.find((x) => x.ticket === b);
      if (!pa || !pb || pa.symbol !== pb.symbol || pa.side === pb.side) return void toast.error("Close By needs an opposite position on the same symbol");
      if (!isMarketOpen(pa.symbol)) return void marketClosed(`'${pa.login}': close position #${a} by position #${b} ${pa.symbol}`);
      const vol = Math.min(pa.volume, pb.volume);
      // pa closes at pb's open price, pb closes at its own open price (zero gross), saving one spread
      closeInternal(a, vol, "close by", pb.openPrice, true);
      closeInternal(b, vol, "close by", pb.openPrice, true);
      const acc = accountOf(pa.login);
      const gross = profitAt({ ...pa, volume: vol }, pb.openPrice);
      log("Trade", `'${pa.login}': close position #${a} ${pa.side} ${fmtVol(vol)} ${pa.symbol} by position #${b} ${pb.side} ${fmtVol(vol)} ${pb.symbol} done`);
      toast.success(`Closed #${a} by #${b}`, { description: `${fmtVol(vol)} ${pa.symbol} · ${accMoney(acc, gross, { signed: true })} ${accCcy(acc)} · spread saved` });
      notify("close");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [log, notify],
  );

  const cancelPending = React.useCallback(
    (ticket: string) => {
      if (sessionRef.current.investor) return;
      const o = coreRef.current.pendings.find((x) => x.ticket === ticket);
      if (!o) return;
      commit((c) => ({ ...c, pendings: c.pendings.filter((x) => x.ticket !== ticket) }));
      log("Trade", `'${o.login}': cancel order #${ticket} ${PENDING_LABEL(o)} ${fmtVol(o.volume)} ${o.symbol} at ${fmtPrice(o.symbol, o.price)} done`);
      toast(`Order #${ticket} cancelled`, { description: `${PENDING_LABEL(o)} ${fmtVol(o.volume)} ${o.symbol}` });
    },
    [commit, log],
  );

  const modifyPending = React.useCallback(
    (ticket: string, patch: { price?: number; sl?: number | null; tp?: number | null }) => {
      if (sessionRef.current.investor) return false;
      const o = coreRef.current.pendings.find((x) => x.ticket === ticket);
      if (!o) return false;
      const q = priceFeed().snapshot(o.symbol)!;
      const price = patch.price !== undefined ? roundPrice(o.symbol, patch.price) : o.price;
      const sl = patch.sl === undefined ? o.sl : patch.sl === null ? undefined : roundPrice(o.symbol, patch.sl);
      const tp = patch.tp === undefined ? o.tp : patch.tp === null ? undefined : roundPrice(o.symbol, patch.tp);
      const ref = o.side === "buy" ? q.ask : q.bid;
      const text = `modify order #${ticket} ${PENDING_LABEL(o)} ${fmtVol(o.volume)} ${o.symbol} at ${fmtPrice(o.symbol, price)}`;
      if (!isMarketOpen(o.symbol)) return marketClosed(`'${o.login}': ${text}`);
      const typeOk = o.type === "limit" ? (o.side === "buy" ? price < ref : price > ref) : o.side === "buy" ? price > ref : price < ref;
      if (!typeOk) return fail(text, "Invalid price");
      if (!validStops(o.side, price, sl, tp)) return fail(text, "Invalid stops");
      commit((c) => ({ ...c, pendings: c.pendings.map((x) => (x.ticket === ticket ? { ...x, price, sl, tp } : x)) }));
      log("Trade", `'${o.login}': ${text} done`);
      toast.success(`Order #${ticket} modified`, { description: `${PENDING_LABEL(o)} at ${fmtPrice(o.symbol, price)}` });
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, log],
  );

  const bulkClose = React.useCallback(
    (kind: "all" | "profit" | "loss" | "symbol" | "buys" | "sells", symbol?: string) => {
      if (sessionRef.current.investor) return;
      const login = sessionRef.current.login;
      const list = coreRef.current.positions.filter((p) => {
        if (p.login !== login) return false;
        const q = priceFeed().snapshot(p.symbol)!;
        const pr = profitUsd(p, q.bid, q.ask);
        if (kind === "profit") return pr > 0;
        if (kind === "loss") return pr < 0;
        if (kind === "symbol") return p.symbol === symbol;
        if (kind === "buys") return p.side === "buy";
        if (kind === "sells") return p.side === "sell";
        return true;
      });
      if (!list.length) return void toast("Nothing to close", { description: "No positions match that filter." });
      // positions on closed markets stay open (MT5 rejects them with "Market closed")
      const open = list.filter((p) => isMarketOpen(p.symbol));
      const blocked = list.filter((p) => !isMarketOpen(p.symbol));
      for (const p of blocked) marketClosed(`'${login}': close #${p.ticket} ${p.side} ${fmtVol(p.volume)} ${p.symbol}`, true);
      const blockedSyms = [...new Set(blocked.map((p) => p.symbol))].join(", ");
      if (!open.length) {
        toast.error("Market is closed", { description: `${blocked.length} position${blocked.length > 1 ? "s" : ""} on ${blockedSyms} can't be closed until the market opens.` });
        return void notify("error");
      }
      const before = coreRef.current.balances[login] ?? 0;
      for (const p of open) closeInternal(p.ticket, undefined, "manual", undefined, true);
      const realised = (coreRef.current.balances[login] ?? 0) - before;
      const acc = accountOf(login);
      log("Trade", `'${login}': bulk close (${kind}${symbol ? ` ${symbol}` : ""}): ${open.length} positions, profit ${accMoney(acc, realised, { signed: true })}${blocked.length ? `, ${blocked.length} skipped (market closed)` : ""}`);
      (realised >= 0 ? toast.success : toast.error)(`Closed ${open.length} position${open.length > 1 ? "s" : ""}`, {
        description: `Realised ${accMoney(acc, realised, { signed: true })} ${accCcy(acc)}${blocked.length ? ` · ${blocked.length} left open, market closed (${blockedSyms})` : ""}`,
      });
      notify("close");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [log, notify],
  );

  const cancelAllPendings = React.useCallback(() => {
    if (sessionRef.current.investor) return;
    const login = sessionRef.current.login;
    const n = coreRef.current.pendings.filter((p) => p.login === login).length;
    if (!n) return void toast("No pending orders");
    commit((c) => ({ ...c, pendings: c.pendings.filter((p) => p.login !== login) }));
    log("Trade", `'${login}': ${n} pending orders cancelled`);
    toast(`Cancelled ${n} pending order${n > 1 ? "s" : ""}`);
  }, [commit, log]);

  /* ------------------------------ tick engine ------------------------------ */

  React.useEffect(() => {
    const feed = priceFeed();
    return feed.subscribe(
      INSTRUMENTS.map((i) => i.symbol),
      (q) => {
        const c = coreRef.current;
        // SL / TP / trailing
        for (const p of c.positions) {
          if (p.symbol !== q.symbol) continue;
          const px = p.side === "buy" ? q.bid : q.ask;
          if (p.sl !== undefined && (p.side === "buy" ? px <= p.sl : px >= p.sl)) {
            closeInternal(p.ticket, undefined, "sl", p.sl);
            continue;
          }
          if (p.tp !== undefined && (p.side === "buy" ? px >= p.tp : px <= p.tp)) {
            closeInternal(p.ticket, undefined, "tp", p.tp);
            continue;
          }
          if (p.trailing) {
            const cand = roundPrice(p.symbol, p.side === "buy" ? px - p.trailing : px + p.trailing);
            const inProfit = p.side === "buy" ? px - p.openPrice >= p.trailing : p.openPrice - px >= p.trailing;
            const better = p.sl === undefined || (p.side === "buy" ? cand > p.sl : cand < p.sl);
            if (inProfit && better) {
              commit((cc) => ({ ...cc, positions: cc.positions.map((x) => (x.ticket === p.ticket ? { ...x, sl: cand } : x)) }));
              log("Trade", `'${p.login}': trailing stop #${p.ticket} ${p.symbol} moved to ${fmtPrice(p.symbol, cand)}`);
            }
          }
        }
        // pending orders
        for (const o of coreRef.current.pendings) {
          if (o.symbol !== q.symbol) continue;
          const ref = o.side === "buy" ? q.ask : q.bid;
          const hit = o.type === "limit" ? (o.side === "buy" ? ref <= o.price : ref >= o.price) : o.side === "buy" ? ref >= o.price : ref <= o.price;
          if (!hit) continue;
          if (o.type === "stop-limit") {
            const lim: PendingOrder = { ...o, type: "limit", price: o.stopLimit ?? o.price, stopLimit: undefined };
            commit((cc) => ({ ...cc, pendings: cc.pendings.map((x) => (x.ticket === o.ticket ? lim : x)) }));
            log("Trade", `'${o.login}': order #${o.ticket} ${o.side} stop limit ${o.symbol} activated, ${o.side} limit at ${fmtPrice(o.symbol, lim.price)} placed`);
            continue;
          }
          const px = o.type === "limit" ? o.price : ref;
          let cc = coreRef.current;
          cc = { ...cc, pendings: cc.pendings.filter((x) => x.ticket !== o.ticket && (!o.oco || x.oco !== o.oco)) };
          const { core, ticket } = fill(cc, o.login, { symbol: o.symbol, side: o.side, volume: o.volume, price: px, sl: o.sl, tp: o.tp, trailing: o.trailing, comment: o.comment, source: o.source });
          commit(() => core);
          log("Trade", `'${o.login}': order #${o.ticket} ${PENDING_LABEL(o)} ${fmtVol(o.volume)} ${o.symbol} at ${fmtPrice(o.symbol, o.price)} triggered, deal #${ticket} at ${fmtPrice(o.symbol, px)} done`);
          if (o.oco) log("Trade", `'${o.login}': OCO sibling of #${o.ticket} cancelled`);
          if (o.login === sessionRef.current.login) {
            toast.success(`Order #${o.ticket} filled`, { description: `${PENDING_LABEL(o)} ${fmtVol(o.volume)} ${o.symbol} at ${fmtPrice(o.symbol, px)}${o.oco ? " · OCO sibling cancelled" : ""}` });
            notify("fill");
          }
        }
        // alerts
        for (const a of coreRef.current.alerts) {
          if (!a.active || a.symbol !== q.symbol) continue;
          if (a.cond === "above" ? q.bid >= a.price : q.bid <= a.price) {
            commit((cc) => ({ ...cc, alerts: cc.alerts.map((x) => (x.id === a.id ? { ...x, active: false, triggeredAt: new Date().toISOString() } : x)) }));
            log("Alerts", `${a.symbol} bid ${a.cond === "above" ? ">=" : "<="} ${fmtPrice(a.symbol, a.price)} (bid ${fmtPrice(a.symbol, q.bid)})${a.note ? ` · ${a.note}` : ""}`, "warn");
            toast.warning(`Alert · ${a.symbol} ${a.cond} ${fmtPrice(a.symbol, a.price)}`, { description: `Bid ${fmtPrice(a.symbol, q.bid)}${a.note ? ` · ${a.note}` : ""}` });
            notify("alert");
          }
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ AI Trader ------------------------------ */

  // Runs this account's AI strategies; orders take the same path as manual ones (placeOrder, source "ai").
  React.useEffect(() => {
    const a = accountOf(session.login);
    return aiTrader.attach({
      login: a.login,
      accountType: a.type,
      accountMode: a.mode,
      investor: session.investor,
      positions: () => coreRef.current.positions.filter((p) => p.login === a.login),
      history: () => coreRef.current.history.filter((p) => p.login === a.login),
      balance: () => coreRef.current.balances[a.login] ?? 0,
      placeOrder,
      modifyPosition,
      closePosition: (ticket, reason) => {
        const p = coreRef.current.positions.find((x) => x.ticket === ticket);
        if (!p) return false;
        if (!isMarketOpen(p.symbol)) return marketClosed(`'${p.login}': ${reason}: close #${ticket} ${p.side} ${fmtVol(p.volume)} ${p.symbol}`, true);
        closeInternal(ticket, undefined, reason);
        return true;
      },
      log,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.login, session.investor]);

  /* ------------------------------ workspace ------------------------------ */

  const setWs = React.useCallback((patch: Partial<Workspace> | ((w: Workspace) => Partial<Workspace>)) => {
    setWsState((w) => ({ ...w, ...(typeof patch === "function" ? patch(w) : patch) }));
  }, []);

  const setLayout = React.useCallback((l: Layout) => setWsState((w) => fitSlots({ ...w, layout: l })), []);

  const addTab = React.useCallback((symbol?: string, tf: Timeframe = "H1") => {
    setWsState((w) => {
      const t = makeTab(symbol ?? w.tabs.find((x) => x.id === w.activeId)?.symbol ?? "EURUSD", tf);
      const slots = w.slots.map((s) => (s === w.activeId ? t.id : s));
      return { ...w, tabs: [...w.tabs, t], slots, activeId: t.id };
    });
  }, []);

  const closeTab = React.useCallback((id: string) => {
    setWsState((w) => {
      if (w.tabs.length <= 1) {
        toast("At least one chart must stay open");
        return w;
      }
      const tabs = w.tabs.filter((t) => t.id !== id);
      let slots = w.slots.filter((s) => s !== id);
      let layout = w.layout;
      const free = tabs.find((t) => !slots.includes(t.id));
      if (slots.length < LAYOUT_COUNT[layout]) {
        if (free) slots = [...w.slots.map((s) => (s === id ? free.id : s))];
        else layout = slots.length >= 2 ? (layout === "4" ? "2v" : layout) : "1";
      }
      if (LAYOUT_COUNT[layout] === 2 && slots.length > 2) slots = slots.slice(0, 2);
      const activeId = w.activeId === id ? slots[0]! : w.activeId;
      return fitSlots({ ...w, tabs, slots, layout, activeId });
    });
  }, []);

  const activateTab = React.useCallback((id: string) => {
    setWsState((w) => {
      if (w.slots.includes(id)) return { ...w, activeId: id };
      return { ...w, slots: w.slots.map((s) => (s === w.activeId ? id : s)), activeId: id };
    });
  }, []);

  const updateTab = React.useCallback((id: string, patch: Partial<ChartTab> | ((t: ChartTab) => Partial<ChartTab>)) => {
    setWsState((w) => ({ ...w, tabs: w.tabs.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)) }));
  }, []);

  const openSymbol = React.useCallback((symbol: string, newTab = false) => {
    if (newTab) return addTab(symbol);
    setWsState((w) => ({ ...w, tabs: w.tabs.map((t) => (t.id === w.activeId ? { ...t, symbol, drawings: t.symbol === symbol ? t.drawings : [] } : t)) }));
  }, [addTab]);

  const togglePanel = React.useCallback((k: keyof Workspace["panels"], v?: boolean) => {
    setWsState((w) => ({ ...w, panels: { ...w.panels, [k]: v ?? !w.panels[k] } }));
  }, []);

  const deleteSelectedDrawing = React.useCallback(() => {
    if (!selectedDrawing) return;
    setWsState((w) => ({ ...w, tabs: w.tabs.map((t) => ({ ...t, drawings: t.drawings.filter((d) => d.id !== selectedDrawing) })) }));
    selectDrawing(null);
    toast("Object deleted");
  }, [selectedDrawing]);

  const resetWorkspace = React.useCallback(() => {
    setWsState(() => defaultWorkspace());
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith("react-resizable-panels:kalks")) localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
    toast.success("Workspace reset to Default");
  }, []);

  const setUi = React.useCallback((patch: Partial<UiState>) => setUiState((u) => ({ ...u, ...patch })), []);
  const openNewOrder = React.useCallback(
    (p?: Partial<NewOrderPrefill>) => {
      if (sessionRef.current.investor) return void toast.error("Read-only session", { description: "Log in with the master password to trade." });
      const w = wsRef.current;
      const sym = p?.symbol ?? w.tabs.find((t) => t.id === w.activeId)?.symbol ?? "EURUSD";
      setUiState((u) => ({ ...u, newOrder: { symbol: sym, side: p?.side, type: p?.type, price: p?.price } }));
    },
    [],
  );

  /* ------------------------------ alerts ------------------------------ */

  const addAlert = React.useCallback(
    (a: Omit<PriceAlert, "id" | "created" | "active">) => {
      commit((c) => ({ ...c, alerts: [{ ...a, id: uid(), active: true, created: new Date().toISOString() }, ...c.alerts] }));
      log("Alerts", `alert created: ${a.symbol} bid ${a.cond === "above" ? ">=" : "<="} ${fmtPrice(a.symbol, a.price)}`);
      toast.success("Alert created", { description: `${a.symbol} ${a.cond} ${fmtPrice(a.symbol, a.price)}` });
    },
    [commit, log],
  );
  const updateAlert = React.useCallback((id: string, patch: Partial<PriceAlert>) => commit((c) => ({ ...c, alerts: c.alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })), [commit]);
  const removeAlert = React.useCallback(
    (id: string) => {
      commit((c) => ({ ...c, alerts: c.alerts.filter((a) => a.id !== id) }));
      toast("Alert deleted");
    },
    [commit],
  );
  const clearJournal = React.useCallback(() => commit((c) => ({ ...c, journal: [] })), [commit]);

  /* ------------------------------ account ------------------------------ */

  const switchAccount = React.useCallback(
    (login: string) => {
      const a = accountOf(login);
      if (!a || login === sessionRef.current.login) return;
      const s: Session = { login, investor: false, server: a.server, via: sessionRef.current.via, at: Date.now() };
      priceFeed().setGroup(a.group); // quotes carry this account group's spread
      setSession(s);
      writeSession(s);
      log("Network", `'${login}': authorized on ${a.server} through Access Point EU Frankfurt (ping ${(30 + Math.random() * 14).toFixed(1)} ms)`);
      log("Network", `'${login}': terminal synchronized with Kalks Global`);
      toast.success(`Switched to ${a.type === "demo" ? "demo" : "live"} account ${login}`, { description: `${a.group} · ${a.mode} · ${a.server}` });
    },
    [log],
  );

  const refillDemo = React.useCallback(() => {
    const a = accountOf(sessionRef.current.login);
    if (a.type !== "demo") return void toast.error("Refill is available on demo accounts only");
    const left = coreRef.current.refills[a.login] ?? 0;
    if (left <= 0) return void toast.error("No refills left", { description: "Open a new demo account from the Client Area." });
    const target = a.balance;
    commit((c) => ({ ...c, balances: { ...c.balances, [a.login]: target }, refills: { ...c.refills, [a.login]: left - 1 } }));
    log("Account", `'${a.login}': demo balance refilled to ${accMoney(a, target)} ${accCcy(a)} (${left - 1} refills left)`);
    toast.success("Demo balance refilled", { description: `${accMoney(a, target)} ${accCcy(a)} · ${left - 1} refills left` });
  }, [commit, log]);

  const logout = React.useCallback(() => {
    writeSession(null);
    onLogout();
  }, [onLogout]);

  /* ------------------------------ derived ------------------------------ */

  const activeTab = ws.tabs.find((t) => t.id === ws.activeId) ?? ws.tabs[0]!;
  const value: Ctx = {
    session,
    account,
    accounts: ACCOUNTS,
    readOnly,
    positions: core.positions.filter((p) => p.login === session.login),
    pendings: core.pendings.filter((p) => p.login === session.login),
    history: core.history.filter((p) => p.login === session.login),
    allPositions: core.positions,
    balances: core.balances,
    refillsLeft: core.refills[session.login] ?? 0,
    alerts: core.alerts,
    journal: core.journal,
    ws,
    ui,
    drawTool,
    selectedDrawing,
    activeTab,
    activeSymbol: activeTab.symbol,
    setWs,
    setLayout,
    addTab,
    closeTab,
    activateTab,
    updateTab,
    openSymbol,
    togglePanel,
    setDrawTool,
    selectDrawing,
    deleteSelectedDrawing,
    resetWorkspace,
    setUi,
    openNewOrder,
    placeOrder,
    quickTrade,
    closePosition,
    modifyPosition,
    closeBy,
    cancelPending,
    modifyPending,
    bulkClose,
    cancelAllPendings,
    addAlert,
    updateAlert,
    removeAlert,
    log,
    clearJournal,
    switchAccount,
    refillDemo,
    logout,
  };
  return <TerminalCtx.Provider value={value}>{children}</TerminalCtx.Provider>;
}

/** Journal timestamp "2026.09.24 14:32:11.482" in server time. */
export function journalTime(ts: number) {
  const s = serverTime(new Date(ts));
  return `${s.date} ${s.time}.${s.ms}`;
}
