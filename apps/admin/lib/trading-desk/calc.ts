import { getInstrument, priceFeed, type AssetClass } from "@kalks/mock";
import { ADMIN_ACCOUNTS, ADMIN_POSITIONS, type AdminAccountRow, type RoutingRule } from "@kalks/mock/admin-trading";
import { getClient } from "@kalks/mock/admin-clients";
import type { Book, DeskPosition, DeskState, Side } from "./types";

/* ------------------------------------------------------------------ */
/* Reason codes (D117)                                                 */
/* ------------------------------------------------------------------ */

export const DESK_REASONS = [
  "DLR-01 · Client request",
  "DLR-02 · Error correction",
  "DLR-03 · Risk management",
  "DLR-04 · Stop-out",
  "DLR-05 · Compliance",
  "DLR-06 · Technical issue",
  "DLR-99 · Other",
] as const;
export const REASON_ERROR_CORRECTION = DESK_REASONS[1];
export const REASON_STOP_OUT = DESK_REASONS[3];
/** Reasons that need a free-text note. */
export const noteRequired = (code: string) => code.startsWith("DLR-99");

/* ------------------------------------------------------------------ */
/* Symbol specification (lots)                                         */
/* ------------------------------------------------------------------ */

export interface SymbolSpec {
  min: number;
  max: number;
  step: number;
  /** max leverage for the class; the account leverage is capped at this */
  levCap: number;
}

const SPEC: Record<AssetClass, SymbolSpec> = {
  forex: { min: 0.01, max: 100, step: 0.01, levCap: 1000 },
  metals: { min: 0.01, max: 50, step: 0.01, levCap: 500 },
  indices: { min: 0.1, max: 500, step: 0.1, levCap: 200 },
  energies: { min: 0.01, max: 100, step: 0.01, levCap: 200 },
  crypto: { min: 0.01, max: 50, step: 0.01, levCap: 20 },
  stocks: { min: 1, max: 10_000, step: 1, levCap: 10 },
} as Record<AssetClass, SymbolSpec>;

export function symbolSpec(symbol: string): SymbolSpec {
  return SPEC[getInstrument(symbol).assetClass] ?? SPEC.forex;
}

export function volumeError(symbol: string, v: number, maxLot?: number): string | null {
  const s = symbolSpec(symbol);
  if (!Number.isFinite(v) || v <= 0) return "Enter a volume";
  if (v < s.min - 1e-9) return `Minimum ${s.min} lots`;
  if (v > s.max + 1e-9) return `Maximum ${s.max} lots for ${symbol}`;
  if (maxLot && v > maxLot + 1e-9) return `Account max lot is ${maxLot}`;
  const k = v / s.step;
  if (Math.abs(k - Math.round(k)) > 1e-6) return `Volume step is ${s.step}`;
  return null;
}

export const roundVol = (symbol: string, v: number) => {
  const s = symbolSpec(symbol).step;
  return +(Math.round(v / s) * s).toFixed(s >= 1 ? 0 : s >= 0.1 ? 1 : 2);
};

export const roundPrice = (symbol: string, v: number) => +v.toFixed(getInstrument(symbol).digits);

/* ------------------------------------------------------------------ */
/* P&L, notional, margin                                               */
/* ------------------------------------------------------------------ */

export type QuoteFn = (symbol: string) => { bid: number; ask: number };

/** Price at which a position closes now (buy closes at bid, sell at ask). */
export const closePriceOf = (side: Side, q: { bid: number; ask: number }) => (side === "buy" ? q.bid : q.ask);
/** Price at which a new position opens now. */
export const openPriceOf = (side: Side, q: { bid: number; ask: number }) => (side === "buy" ? q.ask : q.bid);

/** Price-only client P&L in USD for `volume` lots between two prices. */
export function pricePnl(symbol: string, side: Side, volume: number, from: number, to: number) {
  const inst = getInstrument(symbol);
  const diff = side === "buy" ? to - from : from - to;
  let v = diff * volume * inst.contractSize;
  if (symbol.endsWith("JPY") && to > 0) v /= to;
  return v;
}

/** Full client P&L of a position (price + swap − commission). */
export function positionPnl(p: DeskPosition, q: { bid: number; ask: number }) {
  const px = closePriceOf(p.side, q);
  if (!px) return p.swap - p.commission;
  return pricePnl(p.symbol, p.side, p.volume, p.openPrice, px) + p.swap - p.commission;
}

/** Client price P&L attributed to each book (earlier segments + current segment since the last transfer). */
export function bookAttribution(p: DeskPosition, q: { bid: number; ask: number }) {
  const px = closePriceOf(p.side, q);
  const since = px ? pricePnl(p.symbol, p.side, p.volume, p.bookPrice, px) : 0;
  return { A: p.bookCarry.A + (p.route === "A" ? since : 0), B: p.bookCarry.B + (p.route === "B" ? since : 0), since };
}

let usdJpy = 149.382;
export function notionalUsd(symbol: string, lots: number, price: number, quote?: QuoteFn) {
  const inst = getInstrument(symbol);
  if (inst.assetClass === "forex" && symbol.startsWith("USD")) return lots * inst.contractSize;
  if (symbol.endsWith("JPY")) {
    const j = quote?.("USDJPY");
    if (j && j.bid) usdJpy = (j.bid + j.ask) / 2;
    return (lots * inst.contractSize * price) / usdJpy;
  }
  return lots * inst.contractSize * price;
}

export function effectiveLeverage(symbol: string, accountLeverage: number) {
  return Math.min(accountLeverage || 100, symbolSpec(symbol).levCap);
}

export function marginFor(symbol: string, lots: number, price: number, leverage: number, quote?: QuoteFn) {
  return notionalUsd(symbol, lots, price, quote) / effectiveLeverage(symbol, leverage);
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

const ACC = new Map<string, AdminAccountRow>(ADMIN_ACCOUNTS.map((a) => [a.login, a]));
export const getAccount = (login: string) => ACC.get(login);
const toUsd = (a: AdminAccountRow, v: number) => (a.currency === "USC" ? v / 100 : v);

export interface AccountMetrics {
  login: string;
  balance: number;
  credit: number;
  floating: number;
  equity: number;
  margin: number;
  freeMargin: number;
  /** % — Infinity without margin in use */
  level: number;
  positions: DeskPosition[];
}

/**
 * Demo calibration: the mock positions are not sized to the mock balances, so each seeded account gets a
 * balance that reproduces its reported margin level (ADMIN_ACCOUNTS equity / margin) on its seed positions.
 * From there everything is live: floating P&L, realised P&L on closes, new trades. (Real balances come from
 * the trading engine.)
 */
const calib = new Map<string, number>();
function baseBalance(a: AdminAccountRow): number {
  const hit = calib.get(a.login);
  if (hit !== undefined) return hit;
  const bal = toUsd(a, a.balance);
  const seeds = ADMIN_POSITIONS.filter((p) => p.login === a.login);
  if (!seeds.length) return bal;
  let m = 0;
  let charges = 0;
  for (const p of seeds) {
    m += marginFor(p.symbol, p.volume, getInstrument(p.symbol).price, a.leverage);
    charges += p.swap - p.commission;
  }
  const reported = a.margin > 0 ? (a.equity / a.margin) * 100 : 1500;
  const target = Math.min(3000, Math.max(55, reported));
  const v = +Math.max(bal, (target / 100) * m - charges - toUsd(a, a.credit)).toFixed(2);
  if (priceFeed().mode === "live") calib.set(a.login, v); // reference prices are final once live
  return v;
}

export function accountMetrics(state: DeskState, login: string, quote: QuoteFn, extra?: { margin?: number }): AccountMetrics | null {
  const a = ACC.get(login);
  if (!a) return null;
  const positions = state.positions.filter((p) => p.login === login);
  let floating = 0;
  let margin = extra?.margin ?? 0;
  for (const p of positions) {
    const q = quote(p.symbol);
    floating += positionPnl(p, q);
    margin += marginFor(p.symbol, p.volume, (q.bid + q.ask) / 2 || p.openPrice, a.leverage, quote);
  }
  const balance = baseBalance(a) + (state.balanceAdj[login] ?? 0);
  const credit = toUsd(a, a.credit);
  const equity = balance + credit + floating;
  return { login, balance, credit, floating, equity, margin, freeMargin: equity - margin, level: margin > 0 ? (equity / margin) * 100 : Infinity, positions };
}

/* ------------------------------------------------------------------ */
/* Routing (D2/D25/D140): first enabled matching rule wins             */
/* ------------------------------------------------------------------ */

export interface RouteDecision {
  book: Book;
  pct: number;
  rule: RoutingRule | null;
}

function condMatch(c: RoutingRule["conditions"][number], ctx: { login: string; group: string; symbol: string; volume: number; risk: number }) {
  const num = (s: string) => Number(s.replace(/[^0-9.\-]/g, ""));
  const cmp = (v: number, t: number) => (c.op === "≥" ? v >= t : c.op === "≤" ? v <= t : c.op === ">" ? v > t : c.op === "<" ? v < t : v === t);
  const list = c.value.split(",").map((x) => x.trim().toLowerCase());
  switch (c.field) {
    case "Login":
      return list.includes(ctx.login.toLowerCase());
    case "Group":
      return list.includes(ctx.group.toLowerCase());
    case "Symbol":
      return list.includes(ctx.symbol.toLowerCase());
    case "Lot size":
      return cmp(ctx.volume, num(c.value));
    case "Risk score":
      return cmp(ctx.risk, num(c.value));
    default:
      return false; // behavioural conditions (hold time, win rate, news…) are evaluated by the engine, not here
  }
}

export function resolveRoute(rules: RoutingRule[], ctx: { login: string; group: string; symbol: string; volume: number; clientId?: string }): RouteDecision {
  const risk = ctx.clientId ? getClient(ctx.clientId).risk : 0;
  const c = { ...ctx, risk };
  for (const r of rules) {
    if (!r.enabled || !r.conditions.length) continue;
    const ok = r.join === "AND" ? r.conditions.every((x) => condMatch(x, c)) : r.conditions.some((x) => condMatch(x, c));
    if (ok) return { book: r.action.pct >= 50 ? r.action.book : r.action.book === "A" ? "B" : "A", pct: r.action.pct, rule: r };
  }
  return { book: "B", pct: 100, rule: null };
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

export function ago(iso: string, now = Date.now()) {
  const d = Math.max(0, now - Date.parse(iso));
  if (d < 60_000) return `${Math.max(1, Math.round(d / 1000))}s ago`;
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)}h ago`;
  return `${Math.round(d / 86_400_000)}d ago`;
}

/** Server time (GMT+3), e.g. "28 Sep 14:02:11". */
export function serverStamp(iso: string) {
  const d = new Date(Date.parse(iso) + 3 * 3_600_000);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())} ${mon} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
