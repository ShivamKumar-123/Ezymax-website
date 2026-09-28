/**
 * Back Office → Config mock data: account groups, symbol contract specs,
 * spread markups, commissions & fees, swaps, dynamic margin, sessions,
 * holidays and demo rules.
 */
import { seeded, hashString } from "./rng";
import { INSTRUMENTS, type AssetClass, type Instrument } from "./symbols";

/* ------------------------------------------------------------------ */
/* Account groups                                                      */
/* ------------------------------------------------------------------ */

export type Route = "A" | "B" | "auto";
export type ChargeOn = "open" | "close" | "round";
export type MarkupType = "fixed" | "pct";

export interface AdminGroup {
  id: string;
  name: string;
  tagline: string;
  mode: "hedging" | "netting";
  cent: boolean;
  currency: "USD" | "USC";
  server: string;
  leverage: number[];
  defaultLeverage: number;
  marginCall: number;
  stopOut: number;
  hedgedMargin: number; // %
  minDeposit: number;
  swapFree: boolean;
  islamicFee: { enabled: boolean; perLot: number; graceDays: number; basis: "per-lot-night" | "flat-night" };
  route: Route;
  autoRule: { aBookAboveLots: number; toxicityScore: number; profitableDays: number };
  commission: { perLot: number; chargeOn: ChargeOn };
  markup: { type: MarkupType; value: number; floor: number };
  maxPositions: number;
  maxLot: number;
  clients: number;
  accounts: number;
  equity: number;
  aBookShare: number; // % of volume routed to LP
  volume30d: number; // lots
  status: "active" | "draft";
  tone: "ember" | "gold" | "info" | "up" | "neutral" | "warn";
  updatedBy: string;
  updatedAt: string;
}

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    id: "standard", name: "Standard", tagline: "Zero commission, all-in spreads", mode: "hedging", cent: false, currency: "USD", server: "Kalks-Live01",
    leverage: [50, 100, 200, 500, 1000], defaultLeverage: 500, marginCall: 100, stopOut: 50, hedgedMargin: 50, minDeposit: 10,
    swapFree: false, islamicFee: { enabled: false, perLot: 0, graceDays: 0, basis: "per-lot-night" }, route: "B",
    autoRule: { aBookAboveLots: 20, toxicityScore: 70, profitableDays: 10 }, commission: { perLot: 0, chargeOn: "round" },
    markup: { type: "fixed", value: 1.0, floor: 0.6 }, maxPositions: 500, maxLot: 50, clients: 21480, accounts: 27912, equity: 18_420_550, aBookShare: 8,
    volume30d: 412_880, status: "active", tone: "neutral", updatedBy: "Priya Nair", updatedAt: "2026-09-21T09:14:00Z",
  },
  {
    id: "pro", name: "Pro", tagline: "Tight raw-feel spreads for active traders", mode: "hedging", cent: false, currency: "USD", server: "Kalks-Live01",
    leverage: [50, 100, 200, 500], defaultLeverage: 200, marginCall: 100, stopOut: 50, hedgedMargin: 50, minDeposit: 200,
    swapFree: false, islamicFee: { enabled: false, perLot: 0, graceDays: 0, basis: "per-lot-night" }, route: "auto",
    autoRule: { aBookAboveLots: 10, toxicityScore: 60, profitableDays: 7 }, commission: { perLot: 0, chargeOn: "round" },
    markup: { type: "fixed", value: 0.3, floor: 0.2 }, maxPositions: 500, maxLot: 100, clients: 9864, accounts: 12408, equity: 31_104_900, aBookShare: 34,
    volume30d: 604_210, status: "active", tone: "ember", updatedBy: "James Carter", updatedAt: "2026-09-23T15:40:00Z",
  },
  {
    id: "ecn", name: "ECN", tagline: "Raw spreads from 0.0 + $3.5/lot/side", mode: "netting", cent: false, currency: "USD", server: "Kalks-Live02",
    leverage: [50, 100, 200, 500], defaultLeverage: 100, marginCall: 120, stopOut: 60, hedgedMargin: 0, minDeposit: 500,
    swapFree: false, islamicFee: { enabled: false, perLot: 0, graceDays: 0, basis: "per-lot-night" }, route: "A",
    autoRule: { aBookAboveLots: 0, toxicityScore: 0, profitableDays: 0 }, commission: { perLot: 7, chargeOn: "round" },
    markup: { type: "fixed", value: 0, floor: 0 }, maxPositions: 1000, maxLot: 200, clients: 3120, accounts: 3981, equity: 24_880_120, aBookShare: 100,
    volume30d: 382_450, status: "active", tone: "info", updatedBy: "Priya Nair", updatedAt: "2026-09-12T11:02:00Z",
  },
  {
    id: "cent", name: "Cent", tagline: "Trade in cents — test strategies live", mode: "hedging", cent: true, currency: "USC", server: "Kalks-Live02",
    leverage: [100, 500, 1000, 2000], defaultLeverage: 1000, marginCall: 60, stopOut: 20, hedgedMargin: 50, minDeposit: 10,
    swapFree: false, islamicFee: { enabled: false, perLot: 0, graceDays: 0, basis: "per-lot-night" }, route: "B",
    autoRule: { aBookAboveLots: 50, toxicityScore: 80, profitableDays: 14 }, commission: { perLot: 0, chargeOn: "round" },
    markup: { type: "fixed", value: 1.2, floor: 0.8 }, maxPositions: 200, maxLot: 1000, clients: 8740, accounts: 10220, equity: 1_204_880, aBookShare: 0,
    volume30d: 96_140, status: "active", tone: "gold", updatedBy: "Omar Haddad", updatedAt: "2026-09-02T08:30:00Z",
  },
  {
    id: "vip", name: "VIP", tagline: "Invite-only · priority execution & desk", mode: "netting", cent: false, currency: "USD", server: "Kalks-Live01",
    leverage: [50, 100, 200], defaultLeverage: 100, marginCall: 130, stopOut: 80, hedgedMargin: 25, minDeposit: 50000,
    swapFree: false, islamicFee: { enabled: false, perLot: 0, graceDays: 0, basis: "per-lot-night" }, route: "A",
    autoRule: { aBookAboveLots: 0, toxicityScore: 0, profitableDays: 0 }, commission: { perLot: 4, chargeOn: "round" },
    markup: { type: "pct", value: 15, floor: 0.1 }, maxPositions: 2000, maxLot: 500, clients: 214, accounts: 402, equity: 42_880_400, aBookShare: 100,
    volume30d: 288_900, status: "active", tone: "gold", updatedBy: "James Carter", updatedAt: "2026-09-19T13:22:00Z",
  },
  {
    id: "islamic", name: "Islamic", tagline: "Swap-free with transparent admin fee", mode: "hedging", cent: false, currency: "USD", server: "Kalks-Live01",
    leverage: [50, 100, 200, 500], defaultLeverage: 200, marginCall: 100, stopOut: 50, hedgedMargin: 50, minDeposit: 50,
    swapFree: true, islamicFee: { enabled: true, perLot: 5, graceDays: 3, basis: "per-lot-night" }, route: "auto",
    autoRule: { aBookAboveLots: 15, toxicityScore: 65, profitableDays: 10 }, commission: { perLot: 0, chargeOn: "round" },
    markup: { type: "fixed", value: 1.1, floor: 0.7 }, maxPositions: 500, maxLot: 50, clients: 4602, accounts: 5388, equity: 9_880_210, aBookShare: 22,
    volume30d: 121_600, status: "active", tone: "up", updatedBy: "Fatima Al-Sayed", updatedAt: "2026-09-18T10:05:00Z",
  },
];

export const ALL_LEVERAGES = [10, 25, 30, 50, 100, 200, 300, 400, 500, 1000, 2000, 3000];

/* ------------------------------------------------------------------ */
/* Symbols / contract specs                                            */
/* ------------------------------------------------------------------ */

export type TradeMode = "full" | "close-only" | "long-only" | "disabled";

export interface SymbolSpec {
  symbol: string;
  enabled: boolean;
  tradeMode: TradeMode;
  digits: number;
  contractSize: number;
  lotMin: number;
  lotMax: number;
  lotStep: number;
  marginPct: number; // % of notional
  stopsLevel: number; // points
  exchange: string;
  session: SessionKey;
  profitCcy: string;
  swapLong: number;
  swapShort: number;
  swapType: "points" | "pct";
  tripleDay: Weekday;
  execution: "market" | "instant";
  liquidity: "Tier-1 bank pool" | "Prime of Prime" | "Crypto venue" | "DMA equities";
}

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MARGIN_BY_CLASS: Record<AssetClass, number> = { forex: 0.5, metals: 1, indices: 1, energies: 2, crypto: 10, stocks: 20 };
const LOTS_BY_CLASS: Record<AssetClass, [number, number, number]> = {
  forex: [0.01, 100, 0.01], metals: [0.01, 50, 0.01], indices: [0.1, 500, 0.1], energies: [0.01, 100, 0.01], crypto: [0.01, 20, 0.01], stocks: [1, 5000, 1],
};

export type SessionKey = "fx" | "metals" | "us-index" | "eu-index" | "jp-index" | "energy" | "crypto" | "us-stocks";

function sessionFor(i: Instrument): SessionKey {
  if (i.assetClass === "forex") return "fx";
  if (i.assetClass === "metals") return "metals";
  if (i.assetClass === "energies") return "energy";
  if (i.assetClass === "crypto") return "crypto";
  if (i.assetClass === "stocks") return "us-stocks";
  if (i.symbol === "GER40" || i.symbol === "UK100") return "eu-index";
  if (i.symbol === "JP225") return "jp-index";
  return "us-index";
}
const EXCHANGE: Record<SessionKey, string> = {
  fx: "OTC · FX", metals: "OTC · Metals", "us-index": "CME Globex", "eu-index": "Eurex / ICE", "jp-index": "OSE Osaka", energy: "NYMEX / ICE", crypto: "Crypto 24/7", "us-stocks": "NASDAQ / NYSE",
};

export const SYMBOL_SPECS: SymbolSpec[] = INSTRUMENTS.map((i) => {
  const r = seeded(hashString(i.symbol));
  const [lotMin, lotMax, lotStep] = LOTS_BY_CLASS[i.assetClass];
  const swapType: "points" | "pct" = i.assetClass === "crypto" || i.assetClass === "stocks" ? "pct" : "points";
  const swapLong = swapType === "pct" ? -+(r.range(6, 22)).toFixed(2) : -+(r.range(0.5, 14)).toFixed(2);
  const swapShort = swapType === "pct" ? -+(r.range(2, 10)).toFixed(2) : +(r.range(-6, 5)).toFixed(2);
  return {
    symbol: i.symbol,
    enabled: !["USDINR"].includes(i.symbol),
    tradeMode: i.symbol === "XRPUSD" ? "close-only" : i.symbol === "USDINR" ? "disabled" : "full",
    digits: i.digits,
    contractSize: i.contractSize,
    lotMin, lotMax, lotStep,
    marginPct: MARGIN_BY_CLASS[i.assetClass],
    stopsLevel: i.assetClass === "forex" ? 0 : r.int(0, 20),
    exchange: EXCHANGE[sessionFor(i)],
    session: sessionFor(i),
    profitCcy: i.symbol.endsWith("JPY") ? "JPY" : i.symbol.endsWith("CHF") ? "CHF" : i.symbol.endsWith("CAD") ? "CAD" : i.symbol.endsWith("INR") ? "INR" : "USD",
    swapLong, swapShort, swapType,
    tripleDay: i.assetClass === "crypto" ? "Fri" : "Wed",
    execution: "market",
    liquidity: i.assetClass === "crypto" ? "Crypto venue" : i.assetClass === "stocks" ? "DMA equities" : i.assetClass === "forex" ? "Tier-1 bank pool" : "Prime of Prime",
  };
});

/** Pip size in price units (fractional pips for 5/3 digit symbols). */
export function pipSize(digits: number) {
  return digits === 5 || digits === 3 ? Math.pow(10, -(digits - 1)) : Math.pow(10, -digits);
}

/* ------------------------------------------------------------------ */
/* Spread markups — symbol × group matrix                              */
/* ------------------------------------------------------------------ */

export interface MarkupCell {
  type: MarkupType;
  value: number;
}

/** markup[symbol][groupId] */
export const SPREAD_MARKUPS: Record<string, Record<string, MarkupCell>> = Object.fromEntries(
  INSTRUMENTS.map((i) => {
    const r = seeded(hashString("mk" + i.symbol));
    const base = i.assetClass === "forex" ? 1 : i.assetClass === "metals" ? 1.8 : i.assetClass === "indices" ? 1.2 : i.assetClass === "energies" ? 1.5 : i.assetClass === "crypto" ? 0 : 0;
    const cells: Record<string, MarkupCell> = {};
    for (const g of ADMIN_GROUPS) {
      const mult = g.id === "standard" ? 1 : g.id === "pro" ? 0.3 : g.id === "ecn" ? 0 : g.id === "cent" ? 1.2 : g.id === "vip" ? 0.1 : 1.1;
      if (i.assetClass === "crypto" || i.assetClass === "stocks") cells[g.id] = { type: "pct", value: g.id === "ecn" ? 0 : Math.round(r.range(35, 90) * (g.id === "vip" ? 0.3 : g.id === "pro" ? 0.5 : 1)) };
      else cells[g.id] = { type: "fixed", value: +(base * mult * r.range(0.9, 1.15)).toFixed(1) };
    }
    return [i.symbol, cells];
  }),
);

export const SPREAD_FLOORS: Record<string, number> = Object.fromEntries(
  INSTRUMENTS.map((i) => [
    i.symbol,
    i.assetClass === "forex" ? 0.2 : i.assetClass === "metals" ? 0.8 : i.assetClass === "indices" ? 0.6 : i.assetClass === "energies" ? 0.5 : +(i.spread * 0.5).toFixed(i.digits),
  ]),
);

/* ------------------------------------------------------------------ */
/* Commissions & fees                                                  */
/* ------------------------------------------------------------------ */

export const COMMISSION_CLASSES: AssetClass[] = ["forex", "metals", "indices", "energies", "crypto", "stocks"];

export interface CommissionCell {
  perLot: number; // USD per lot per side basis unless round
  chargeOn: ChargeOn;
  unit: "per-lot" | "pct-notional";
}

export const COMMISSIONS: Record<string, Record<AssetClass, CommissionCell>> = Object.fromEntries(
  ADMIN_GROUPS.map((g) => {
    const row = {} as Record<AssetClass, CommissionCell>;
    for (const c of COMMISSION_CLASSES) {
      const pct = c === "stocks";
      let v = g.commission.perLot;
      if (g.id === "ecn") v = c === "forex" ? 7 : c === "metals" ? 8 : c === "indices" ? 2 : c === "energies" ? 6 : c === "crypto" ? 0.05 : 0.1;
      else if (g.id === "vip") v = c === "forex" ? 4 : c === "metals" ? 5 : c === "indices" ? 1 : c === "energies" ? 4 : c === "crypto" ? 0.03 : 0.06;
      else if (c === "crypto") v = 0.08;
      else if (c === "stocks") v = 0.1;
      row[c] = { perLot: v, chargeOn: g.id === "ecn" || g.id === "vip" ? "round" : "open", unit: pct || c === "crypto" ? "pct-notional" : "per-lot" };
    }
    return [g.id, row];
  }),
);

export interface FeeRule {
  id: string;
  label: string;
  kind: "deposit" | "withdrawal" | "conversion" | "islamic" | "inactivity" | "internal";
  method: string;
  type: "flat" | "pct";
  value: number;
  min?: number;
  max?: number;
  absorbedByBroker: boolean;
  enabled: boolean;
  note: string;
}

export const FEE_RULES: FeeRule[] = [
  { id: "f1", label: "USDT deposit", kind: "deposit", method: "USDT · TRC20", type: "flat", value: 0, absorbedByBroker: true, enabled: true, note: "Network fee paid by sender" },
  { id: "f2", label: "USDT deposit", kind: "deposit", method: "USDT · ERC20", type: "flat", value: 0, absorbedByBroker: true, enabled: false, note: "Chain disabled in tenant" },
  { id: "f3", label: "USDT withdrawal", kind: "withdrawal", method: "USDT · TRC20", type: "flat", value: 1, min: 20, absorbedByBroker: false, enabled: true, note: "Covers TRX energy + bandwidth" },
  { id: "f4", label: "Express withdrawal", kind: "withdrawal", method: "USDT · TRC20", type: "pct", value: 0.5, min: 2, max: 50, absorbedByBroker: false, enabled: false, note: "Skips batch window (manual approval still required)" },
  { id: "f5", label: "Crypto → USD", kind: "conversion", method: "BTC / ETH / TRX", type: "pct", value: 0.5, absorbedByBroker: false, enabled: true, note: "Markup over live rate; USDT converts 1:1" },
  { id: "f6", label: "Islamic admin fee", kind: "islamic", method: "Swap-free groups", type: "flat", value: 5, absorbedByBroker: false, enabled: true, note: "Per lot per night after 3 grace nights" },
  { id: "f7", label: "Inactivity fee", kind: "inactivity", method: "Live accounts", type: "flat", value: 5, absorbedByBroker: false, enabled: false, note: "Monthly after 180 days without trades" },
  { id: "f8", label: "Internal transfer", kind: "internal", method: "Wallet ↔ account", type: "flat", value: 0, absorbedByBroker: true, enabled: true, note: "Always free" },
];

/* ------------------------------------------------------------------ */
/* Swaps                                                               */
/* ------------------------------------------------------------------ */

export const SWAP_SETTINGS = {
  rolloverTime: "00:00",
  timezone: "GMT+3",
  tripleDayFx: "Wed" as Weekday,
  tripleDayCrypto: "Fri" as Weekday,
  cryptoWeekendSwap: true,
  source: "LP benchmark + 0.25% markup",
  lastImport: "2026-09-24T05:00:00Z",
};

/* ------------------------------------------------------------------ */
/* Dynamic margin & news blackout                                      */
/* ------------------------------------------------------------------ */

export interface MarginSchedule {
  id: string;
  name: string;
  kind: "weekend" | "holiday" | "news";
  multiplier: number;
  start: string; // human
  end: string;
  rampMin: number; // minutes before
  appliesTo: string[];
  nextRun: string; // ISO
  active: boolean;
  affectedAccounts: number;
  note: string;
  /** timeline segments in hours from window start */
  timeline: { from: number; to: number; mult: number }[];
  span: number; // hours shown
  axis: string[];
}

export const MARGIN_SCHEDULES: MarginSchedule[] = [
  {
    id: "wk", name: "Weekend gap protection", kind: "weekend", multiplier: 2, start: "Fri 21:00", end: "Mon 01:00", rampMin: 60,
    appliesTo: ["Forex", "Metals", "Indices", "Energies"], nextRun: "2026-09-25T18:00:00Z", active: true, affectedAccounts: 18420,
    note: "New positions opened after Fri 20:00 use 2× margin; existing positions re-margined at 21:00.",
    timeline: [{ from: 0, to: 1, mult: 1.5 }, { from: 1, to: 53, mult: 2 }], span: 54, axis: ["Fri 20:00", "Sat", "Sun", "Mon 02:00"],
  },
  {
    id: "nfp", name: "US Non-Farm Payrolls", kind: "news", multiplier: 3, start: "Fri 2 Oct 15:15", end: "15:45", rampMin: 15,
    appliesTo: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "US30", "NAS100", "SPX500"], nextRun: "2026-10-02T12:15:00Z", active: true, affectedAccounts: 6240,
    note: "NFP ±15 min at 3×. Pending orders inside the window are not re-margined.",
    timeline: [{ from: 0.25, to: 0.75, mult: 3 }], span: 1, axis: ["15:00", "15:15", "15:30", "15:45", "16:00"],
  },
  {
    id: "fomc", name: "FOMC rate decision", kind: "news", multiplier: 2.5, start: "Wed 28 Oct 20:45", end: "21:30", rampMin: 15,
    appliesTo: ["USD pairs", "XAUUSD", "US indices"], nextRun: "2026-10-28T17:45:00Z", active: true, affectedAccounts: 7110,
    note: "Statement at 21:00 and press conference at 21:30.",
    timeline: [{ from: 0.25, to: 1, mult: 2.5 }], span: 1.5, axis: ["20:30", "21:00", "21:30", "22:00"],
  },
  {
    id: "thx", name: "US Thanksgiving", kind: "holiday", multiplier: 1.5, start: "Thu 26 Nov 00:00", end: "Fri 27 Nov 20:00", rampMin: 0,
    appliesTo: ["US indices", "US stocks", "USOIL"], nextRun: "2026-11-25T21:00:00Z", active: true, affectedAccounts: 3120,
    note: "Thin liquidity. Stocks closed Thursday, early close Friday 20:00.",
    timeline: [{ from: 0, to: 24, mult: 1.5 }, { from: 24, to: 44, mult: 1.25 }], span: 48, axis: ["Thu 00:00", "Thu 12:00", "Fri 00:00", "Fri 12:00", "Sat"],
  },
  {
    id: "xmas", name: "Christmas & Boxing Day", kind: "holiday", multiplier: 2, start: "Thu 24 Dec 18:00", end: "Tue 29 Dec 01:00", rampMin: 60,
    appliesTo: ["All CFDs except crypto"], nextRun: "2026-12-24T15:00:00Z", active: false, affectedAccounts: 18420,
    note: "Draft — awaiting dealing desk sign-off.",
    timeline: [{ from: 0, to: 6, mult: 1.5 }, { from: 6, to: 103, mult: 2 }], span: 106, axis: ["Thu 24", "Fri 25", "Sat", "Sun", "Mon 28", "Tue 29"],
  },
];

export interface BlackoutWindow {
  id: string;
  event: string;
  currency: string;
  country: string;
  time: string; // ISO
  before: number;
  after: number;
  symbols: string[];
  action: "block-new" | "close-only" | "widen" | "no-pending";
  impact: 1 | 2 | 3;
  enabled: boolean;
}

export const BLACKOUTS: BlackoutWindow[] = [
  { id: "b1", event: "Non-Farm Payrolls (NFP)", currency: "USD", country: "us", time: "2026-10-02T12:30:00Z", before: 2, after: 2, symbols: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "US30", "NAS100"], action: "block-new", impact: 3, enabled: true },
  { id: "b2", event: "US CPI y/y", currency: "USD", country: "us", time: "2026-10-14T12:30:00Z", before: 2, after: 2, symbols: ["EURUSD", "XAUUSD", "NAS100", "SPX500"], action: "no-pending", impact: 3, enabled: true },
  { id: "b3", event: "ECB Rate Decision", currency: "EUR", country: "eu", time: "2026-10-22T12:15:00Z", before: 5, after: 5, symbols: ["EURUSD", "EURJPY", "GER40"], action: "widen", impact: 3, enabled: true },
  { id: "b4", event: "BoJ Policy Rate", currency: "JPY", country: "jp", time: "2026-10-29T03:00:00Z", before: 5, after: 10, symbols: ["USDJPY", "GBPJPY", "EURJPY", "JP225"], action: "block-new", impact: 3, enabled: true },
  { id: "b5", event: "FOMC Statement", currency: "USD", country: "us", time: "2026-10-28T18:00:00Z", before: 5, after: 5, symbols: ["EURUSD", "XAUUSD", "US30", "NAS100", "SPX500"], action: "close-only", impact: 3, enabled: true },
  { id: "b6", event: "Crude Oil Inventories", currency: "USD", country: "us", time: "2026-09-30T14:30:00Z", before: 1, after: 1, symbols: ["USOIL", "UKOIL"], action: "widen", impact: 2, enabled: false },
  { id: "b7", event: "UK GDP m/m", currency: "GBP", country: "gb", time: "2026-10-12T06:00:00Z", before: 1, after: 2, symbols: ["GBPUSD", "GBPJPY", "UK100"], action: "no-pending", impact: 2, enabled: true },
];

export interface SymbolRestriction {
  id: string;
  symbol: string;
  mode: "close-only" | "suspended" | "long-only";
  reason: string;
  since: string;
  until?: string;
  by: string;
  openPositions: number;
}

export const RESTRICTIONS: SymbolRestriction[] = [
  { id: "r1", symbol: "XRPUSD", mode: "close-only", reason: "LP liquidity withdrawn after SEC headline", since: "2026-09-23T14:05:00Z", until: "2026-09-26T21:00:00Z", by: "James Carter", openPositions: 412 },
  { id: "r2", symbol: "USDINR", mode: "suspended", reason: "Regulatory review — onshore NDF feed", since: "2026-09-01T06:00:00Z", by: "Priya Nair", openPositions: 0 },
  { id: "r3", symbol: "TSLA", mode: "long-only", reason: "Short borrow unavailable at prime broker", since: "2026-09-24T13:30:00Z", until: "2026-09-25T20:00:00Z", by: "Omar Haddad", openPositions: 1288 },
];

/* ------------------------------------------------------------------ */
/* Sessions & holidays                                                 */
/* ------------------------------------------------------------------ */

/** Per weekday (Mon..Sun) list of [startHour, endHour] trade windows in server time GMT+3. */
export interface SessionTemplate {
  key: SessionKey;
  name: string;
  exchange: string;
  trade: [number, number][][];
  quoteOnly?: [number, number][][];
}

const wk = (days: [number, number][][]) => days;
export const SESSIONS: SessionTemplate[] = [
  { key: "fx", name: "Forex", exchange: "OTC · FX", trade: wk([[[0.08, 24]], [[0, 24]], [[0, 24]], [[0, 24]], [[0, 23.92]], [], []]) },
  { key: "metals", name: "Metals", exchange: "OTC · Metals", trade: wk([[[1, 24]], [[1, 24]], [[1, 24]], [[1, 24]], [[1, 23.92]], [], []]), quoteOnly: wk([[[0, 1]], [[0, 1]], [[0, 1]], [[0, 1]], [[0, 1]], [], []]) },
  { key: "us-index", name: "US indices", exchange: "CME Globex", trade: wk([[[1, 24]], [[0, 0.25], [1, 24]], [[0, 0.25], [1, 24]], [[0, 0.25], [1, 24]], [[0, 0.25], [1, 23.92]], [], []]), quoteOnly: wk([[[0, 1]], [[0.25, 1]], [[0.25, 1]], [[0.25, 1]], [[0.25, 1]], [], []]) },
  { key: "eu-index", name: "EU indices", exchange: "Eurex / ICE", trade: wk([[[3, 23]], [[3, 23]], [[3, 23]], [[3, 23]], [[3, 23]], [], []]) },
  { key: "jp-index", name: "JP225", exchange: "OSE Osaka", trade: wk([[[2, 8.5], [9.5, 24]], [[0, 0.5], [2, 8.5], [9.5, 24]], [[0, 0.5], [2, 8.5], [9.5, 24]], [[0, 0.5], [2, 8.5], [9.5, 24]], [[0, 0.5], [2, 8.5], [9.5, 23.5]], [], []]) },
  { key: "energy", name: "Energies", exchange: "NYMEX / ICE", trade: wk([[[1, 24]], [[0, 0.25], [1, 24]], [[0, 0.25], [1, 24]], [[0, 0.25], [1, 24]], [[0, 0.25], [1, 23.92]], [], []]) },
  { key: "crypto", name: "Crypto", exchange: "Crypto 24/7", trade: wk([[[0, 24]], [[0, 24]], [[0, 24]], [[0, 24]], [[0, 24]], [[0, 24]], [[0, 24]]]) },
  { key: "us-stocks", name: "US stocks", exchange: "NASDAQ / NYSE", trade: wk([[[16.5, 23]], [[16.5, 23]], [[16.5, 23]], [[16.5, 23]], [[16.5, 23]], [], []]), quoteOnly: wk([[[11, 16.5], [23, 24]], [[11, 16.5], [23, 24]], [[11, 16.5], [23, 24]], [[11, 16.5], [23, 24]], [[11, 16.5], [23, 24]], [], []]) },
];

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  exchange: string;
  country: string;
  effect: "closed" | "early-close" | "late-open";
  time?: string;
  symbols: string;
}

export const HOLIDAYS: Holiday[] = [
  { date: "2026-09-07", name: "Labor Day", exchange: "NYSE / CME", country: "us", effect: "closed", symbols: "US stocks · early close US indices 20:00" },
  { date: "2026-09-21", name: "Respect for the Aged Day", exchange: "OSE", country: "jp", effect: "closed", symbols: "JP225" },
  { date: "2026-09-22", name: "Citizens' Holiday", exchange: "OSE", country: "jp", effect: "closed", symbols: "JP225" },
  { date: "2026-09-23", name: "Autumnal Equinox", exchange: "OSE", country: "jp", effect: "closed", symbols: "JP225" },
  { date: "2026-10-12", name: "Sports Day", exchange: "OSE", country: "jp", effect: "closed", symbols: "JP225" },
  { date: "2026-10-12", name: "Columbus Day (bonds)", exchange: "SIFMA", country: "us", effect: "late-open", time: "Bond desk only", symbols: "No CFD impact" },
  { date: "2026-11-03", name: "Culture Day", exchange: "OSE", country: "jp", effect: "closed", symbols: "JP225" },
  { date: "2026-11-23", name: "Labour Thanksgiving Day", exchange: "OSE", country: "jp", effect: "closed", symbols: "JP225" },
  { date: "2026-11-26", name: "Thanksgiving Day", exchange: "NYSE / CME", country: "us", effect: "closed", symbols: "US stocks, US indices, USOIL" },
  { date: "2026-11-27", name: "Day after Thanksgiving", exchange: "NYSE / CME", country: "us", effect: "early-close", time: "21:00", symbols: "US stocks, US indices" },
  { date: "2026-12-24", name: "Christmas Eve", exchange: "Eurex / ICE", country: "de", effect: "closed", symbols: "GER40" },
  { date: "2026-12-24", name: "Christmas Eve", exchange: "NYSE / CME", country: "us", effect: "early-close", time: "21:00", symbols: "US stocks, US indices" },
  { date: "2026-12-25", name: "Christmas Day", exchange: "All venues", country: "gb", effect: "closed", symbols: "All CFDs except crypto" },
  { date: "2026-12-28", name: "Boxing Day (substitute)", exchange: "LSE / ICE", country: "gb", effect: "closed", symbols: "UK100, UKOIL" },
  { date: "2026-12-31", name: "New Year's Eve", exchange: "Eurex / LSE / OSE", country: "eu", effect: "early-close", time: "15:30", symbols: "GER40, UK100, JP225" },
];

/* ------------------------------------------------------------------ */
/* Demo rules                                                          */
/* ------------------------------------------------------------------ */

export const DEMO_RULES = {
  balances: [1000, 5000, 10000, 25000, 50000, 100000],
  defaultBalance: 10000,
  refillsPerDay: 3,
  refillMode: "reset" as "reset" | "top-up",
  expiryDays: 10,
  extendOnActivity: true,
  autoArchive: true,
  archiveAfterDays: 30,
  deleteAfterDays: 90,
  maxPerClient: 5,
  leverages: [100, 200, 500, 1000],
  groups: ["standard", "pro", "ecn", "cent"],
  nudgeToLive: true,
  server: "Kalks-Demo",
};

export const DEMO_STATS = {
  active: 38_214,
  createdToday: 1_184,
  expiring24h: 2_906,
  archived30d: 21_450,
  conversionPct: 7.8,
  refillsToday: 3_412,
  avgLifetimeDays: 6.4,
  byGroup: [
    { label: "Pro", value: 15_220 },
    { label: "Standard", value: 12_840 },
    { label: "ECN", value: 6_112 },
    { label: "Cent", value: 4_042 },
  ],
  byBalance: [
    { label: "$1K", value: 2_140 },
    { label: "$5K", value: 4_880 },
    { label: "$10K", value: 17_412 },
    { label: "$25K", value: 5_202 },
    { label: "$50K", value: 3_108 },
    { label: "$100K", value: 5_472 },
  ],
};

export const DEMO_DAILY: { label: string; created: number; converted: number; expired: number }[] = (() => {
  const r = seeded(9011);
  const out = [];
  const start = Date.parse("2026-08-26T00:00:00Z");
  for (let i = 0; i < 30; i++) {
    const d = new Date(start + i * 86400000);
    const dow = d.getUTCDay();
    const base = dow === 0 || dow === 6 ? 620 : 1050;
    const created = Math.round(base + r.normal() * 110 + i * 4);
    out.push({ label: `${d.getUTCDate()}`, created, converted: Math.round(created * r.range(0.06, 0.1)), expired: Math.round(created * r.range(0.7, 0.95)) });
  }
  return out;
})();
