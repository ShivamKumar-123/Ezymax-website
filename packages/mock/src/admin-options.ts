/**
 * Back Office › Options — demo build (NEXT_PUBLIC_KALKS_MODE=demo).
 *
 * An in-memory stand-in for the two APIs the Options pages call, so every page renders and every action works in
 * the demo build without services:
 *   - the options service through the admin BFF: `/api/options/*` (services/options/README.md "Back Office"), plus
 *     the client previews `/api/options/smile` and `/api/options/chain`;
 *   - the trading engine's option routes through the trading BFF: `/api/trading/admin/options/{book, settlements/
 *     {expiry}/rerun, trades/{ticket}/void}`;
 *   - `/api/owner/tenants` (the broker list on Brokers access).
 * Responses use the same shapes (camelCase, decimals for vols and rates) and the same validation messages, so the
 * UI exercises the real paths. State lives for the browser tab and is seeded relative to the current time, so
 * TWAP windows and the 1-hour re-fix window are live.
 */
import { seeded, hashString } from "./rng";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();
const dayStr = (t: number) => iso(t).slice(0, 10);
const r4 = (v: number, d = 6) => +v.toFixed(d);

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

type U = {
  symbol: string;
  name: string;
  assetClass: "forex" | "metals" | "energies";
  model: "gk" | "bs" | "black76";
  baseCcy: string;
  quoteCcy: string;
  calendars: string[];
  contractSize: number;
  contractUnit: string;
  digits: number;
  pipSize: number;
  strikeStep: number;
  spot: number;
  atm: number;
  enabled?: boolean;
};

const UNDERLYINGS: U[] = [
  { symbol: "EURUSD", name: "Euro / US Dollar", assetClass: "forex", model: "gk", baseCcy: "EUR", quoteCcy: "USD", calendars: ["EUR", "USD"], contractSize: 10_000, contractUnit: "EUR", digits: 5, pipSize: 0.0001, strikeStep: 0.0025, spot: 1.08456, atm: 0.072 },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", assetClass: "forex", model: "gk", baseCcy: "GBP", quoteCcy: "USD", calendars: ["GBP", "USD"], contractSize: 10_000, contractUnit: "GBP", digits: 5, pipSize: 0.0001, strikeStep: 0.0025, spot: 1.27881, atm: 0.081 },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", assetClass: "forex", model: "gk", baseCcy: "USD", quoteCcy: "JPY", calendars: ["USD", "JPY"], contractSize: 10_000, contractUnit: "USD", digits: 3, pipSize: 0.01, strikeStep: 0.25, spot: 149.382, atm: 0.098 },
  { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", assetClass: "forex", model: "gk", baseCcy: "AUD", quoteCcy: "USD", calendars: ["AUD", "USD"], contractSize: 10_000, contractUnit: "AUD", digits: 5, pipSize: 0.0001, strikeStep: 0.0025, spot: 0.66214, atm: 0.096 },
  { symbol: "USDCAD", name: "US Dollar / Canadian Dollar", assetClass: "forex", model: "gk", baseCcy: "USD", quoteCcy: "CAD", calendars: ["USD", "CAD"], contractSize: 10_000, contractUnit: "USD", digits: 5, pipSize: 0.0001, strikeStep: 0.0025, spot: 1.35722, atm: 0.064 },
  { symbol: "USDCHF", name: "US Dollar / Swiss Franc", assetClass: "forex", model: "gk", baseCcy: "USD", quoteCcy: "CHF", calendars: ["USD", "CHF"], contractSize: 10_000, contractUnit: "USD", digits: 5, pipSize: 0.0001, strikeStep: 0.0025, spot: 0.84917, atm: 0.076 },
  { symbol: "NZDUSD", name: "New Zealand Dollar / US Dollar", assetClass: "forex", model: "gk", baseCcy: "NZD", quoteCcy: "USD", calendars: ["NZD", "USD"], contractSize: 10_000, contractUnit: "NZD", digits: 5, pipSize: 0.0001, strikeStep: 0.0025, spot: 0.60124, atm: 0.101, enabled: false },
  { symbol: "EURJPY", name: "Euro / Japanese Yen", assetClass: "forex", model: "gk", baseCcy: "EUR", quoteCcy: "JPY", calendars: ["EUR", "JPY"], contractSize: 10_000, contractUnit: "EUR", digits: 3, pipSize: 0.01, strikeStep: 0.25, spot: 162.011, atm: 0.094 },
  { symbol: "GBPJPY", name: "British Pound / Japanese Yen", assetClass: "forex", model: "gk", baseCcy: "GBP", quoteCcy: "JPY", calendars: ["GBP", "JPY"], contractSize: 10_000, contractUnit: "GBP", digits: 3, pipSize: 0.01, strikeStep: 0.25, spot: 191.03, atm: 0.105 },
  { symbol: "XAUUSD", name: "Gold / US Dollar", assetClass: "metals", model: "bs", baseCcy: "XAU", quoteCcy: "USD", calendars: ["XAU"], contractSize: 1, contractUnit: "oz", digits: 2, pipSize: 0.01, strikeStep: 10, spot: 2654.3, atm: 0.165 },
  { symbol: "XAGUSD", name: "Silver / US Dollar", assetClass: "metals", model: "bs", baseCcy: "XAG", quoteCcy: "USD", calendars: ["XAG"], contractSize: 50, contractUnit: "oz", digits: 3, pipSize: 0.001, strikeStep: 0.5, spot: 31.184, atm: 0.27 },
  { symbol: "USOIL", name: "WTI Crude Oil", assetClass: "energies", model: "black76", baseCcy: "OIL", quoteCcy: "USD", calendars: ["OIL"], contractSize: 10, contractUnit: "bbl", digits: 2, pipSize: 0.01, strikeStep: 0.5, spot: 71.84, atm: 0.32 },
  { symbol: "UKOIL", name: "Brent Crude Oil", assetClass: "energies", model: "black76", baseCcy: "OIL", quoteCcy: "USD", calendars: ["OIL"], contractSize: 10, contractUnit: "bbl", digits: 2, pipSize: 0.01, strikeStep: 0.5, spot: 75.12, atm: 0.3 },
];

const RATES: [string, number, string, string][] = [
  ["USD", 0.03625, "policy", "Federal Reserve (fed funds mid)"],
  ["EUR", 0.02, "policy", "ECB deposit facility"],
  ["GBP", 0.0375, "policy", "Bank of England Bank Rate"],
  ["JPY", 0.0075, "policy", "Bank of Japan policy rate"],
  ["CHF", 0.0, "policy", "Swiss National Bank policy rate"],
  ["AUD", 0.035, "policy", "RBA cash rate"],
  ["CAD", 0.0225, "policy", "Bank of Canada overnight rate"],
  ["NZD", 0.0275, "policy", "RBNZ official cash rate"],
  ["XAU", 0.004, "lease", "LBMA gold lease (1M, indicative)"],
  ["XAG", 0.006, "lease", "LBMA silver lease (1M, indicative)"],
];

/** Bank holidays 2026–2027 per calendar (the seed in config/holidays covers 2026–2028). */
const HOLIDAYS: Record<string, [string, string][]> = {
  USD: [
    ["2026-01-01", "New Year's Day"], ["2026-01-19", "Martin Luther King Jr. Day"], ["2026-02-16", "Presidents' Day"], ["2026-05-25", "Memorial Day"],
    ["2026-06-19", "Juneteenth"], ["2026-07-03", "Independence Day (observed)"], ["2026-09-07", "Labor Day"], ["2026-10-12", "Columbus Day"],
    ["2026-11-11", "Veterans Day"], ["2026-11-26", "Thanksgiving Day"], ["2026-12-25", "Christmas Day"],
    ["2027-01-01", "New Year's Day"], ["2027-01-18", "Martin Luther King Jr. Day"], ["2027-02-15", "Presidents' Day"], ["2027-05-31", "Memorial Day"],
    ["2027-06-18", "Juneteenth (observed)"], ["2027-07-05", "Independence Day (observed)"], ["2027-09-06", "Labor Day"], ["2027-11-25", "Thanksgiving Day"], ["2027-12-24", "Christmas Day (observed)"],
  ],
  EUR: [
    ["2026-01-01", "New Year's Day"], ["2026-04-03", "Good Friday"], ["2026-04-06", "Easter Monday"], ["2026-05-01", "Labour Day"], ["2026-12-25", "Christmas Day"], ["2026-12-26", "St Stephen's Day"],
    ["2027-01-01", "New Year's Day"], ["2027-03-26", "Good Friday"], ["2027-03-29", "Easter Monday"], ["2027-05-01", "Labour Day"], ["2027-12-25", "Christmas Day"], ["2027-12-26", "St Stephen's Day"],
  ],
  GBP: [
    ["2026-01-01", "New Year's Day"], ["2026-04-03", "Good Friday"], ["2026-04-06", "Easter Monday"], ["2026-05-04", "Early May bank holiday"], ["2026-05-25", "Spring bank holiday"],
    ["2026-08-31", "Summer bank holiday"], ["2026-12-25", "Christmas Day"], ["2026-12-28", "Boxing Day (substitute)"],
    ["2027-01-01", "New Year's Day"], ["2027-03-26", "Good Friday"], ["2027-03-29", "Easter Monday"], ["2027-05-03", "Early May bank holiday"], ["2027-05-31", "Spring bank holiday"],
    ["2027-08-30", "Summer bank holiday"], ["2027-12-27", "Christmas Day (substitute)"], ["2027-12-28", "Boxing Day (substitute)"],
  ],
  JPY: [
    ["2026-01-01", "New Year's Day"], ["2026-01-02", "Bank holiday"], ["2026-01-12", "Coming of Age Day"], ["2026-02-11", "National Foundation Day"], ["2026-02-23", "Emperor's Birthday"],
    ["2026-03-20", "Vernal Equinox Day"], ["2026-04-29", "Showa Day"], ["2026-05-04", "Greenery Day"], ["2026-05-05", "Children's Day"], ["2026-05-06", "Constitution Day (substitute)"],
    ["2026-07-20", "Marine Day"], ["2026-08-11", "Mountain Day"], ["2026-09-21", "Respect for the Aged Day"], ["2026-09-22", "Citizens' Holiday"], ["2026-09-23", "Autumnal Equinox Day"],
    ["2026-10-12", "Sports Day"], ["2026-11-03", "Culture Day"], ["2026-11-23", "Labour Thanksgiving Day"], ["2026-12-31", "Bank holiday"],
    ["2027-01-01", "New Year's Day"], ["2027-01-11", "Coming of Age Day"], ["2027-02-11", "National Foundation Day"], ["2027-02-23", "Emperor's Birthday"],
  ],
  CHF: [["2026-01-01", "New Year's Day"], ["2026-01-02", "Berchtoldstag"], ["2026-04-03", "Good Friday"], ["2026-04-06", "Easter Monday"], ["2026-05-14", "Ascension Day"], ["2026-05-25", "Whit Monday"], ["2026-08-01", "Swiss National Day"], ["2026-12-25", "Christmas Day"], ["2026-12-26", "St Stephen's Day"]],
  AUD: [["2026-01-01", "New Year's Day"], ["2026-01-26", "Australia Day"], ["2026-04-03", "Good Friday"], ["2026-04-06", "Easter Monday"], ["2026-04-27", "Anzac Day (substitute)"], ["2026-06-08", "King's Birthday"], ["2026-08-03", "Bank Holiday (NSW)"], ["2026-10-05", "Labour Day (NSW)"], ["2026-12-25", "Christmas Day"], ["2026-12-28", "Boxing Day (substitute)"]],
  CAD: [["2026-01-01", "New Year's Day"], ["2026-02-16", "Family Day"], ["2026-04-03", "Good Friday"], ["2026-05-18", "Victoria Day"], ["2026-07-01", "Canada Day"], ["2026-08-03", "Civic Holiday"], ["2026-09-07", "Labour Day"], ["2026-09-30", "Truth and Reconciliation Day"], ["2026-10-12", "Thanksgiving"], ["2026-11-11", "Remembrance Day"], ["2026-12-25", "Christmas Day"], ["2026-12-28", "Boxing Day (substitute)"]],
  NZD: [["2026-01-01", "New Year's Day"], ["2026-01-02", "Day after New Year's"], ["2026-02-06", "Waitangi Day"], ["2026-04-03", "Good Friday"], ["2026-04-06", "Easter Monday"], ["2026-04-27", "Anzac Day (substitute)"], ["2026-06-01", "King's Birthday"], ["2026-07-10", "Matariki"], ["2026-10-26", "Labour Day"], ["2026-12-25", "Christmas Day"], ["2026-12-28", "Boxing Day (substitute)"]],
};

const TENORS: [string, number, number][] = [
  // tenor, days, ATM multiplier (mild upward term structure; the overnight carries an event premium)
  ["ON", 1, 1.04],
  ["1W", 7, 0.98],
  ["2W", 14, 0.99],
  ["1M", 30, 1.0],
  ["2M", 61, 1.02],
  ["3M", 91, 1.03],
  ["6M", 182, 1.05],
];

/* ------------------------------------------------------------------ */
/* Pricing helpers (demo only; the service prices with crates/optmath) */
/* ------------------------------------------------------------------ */

function ncdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

type Pillar = { tenor: string; days: number; atm: number; rr25: number; bf25: number; rr10?: number | null; bf10?: number | null };

/** Smile at a moneyness: vols at 25Δ / 10Δ from RR/BF, quadratic in standardised log-moneyness. */
function volAt(p: Pillar, strike: number, fwd: number, t: number) {
  const x = Math.log(strike / fwd) / (p.atm * Math.sqrt(Math.max(t, 1 / 365)));
  const z = Math.max(-4, Math.min(4, x / 0.674));
  const wing = Math.abs(z) > 1 && p.rr10 != null && p.bf10 != null ? { rr: p.rr10 / 1.9, bf: p.bf10 / 1.7 } : { rr: p.rr25, bf: p.bf25 };
  return Math.max(0.01, p.atm + (wing.rr / 2) * z + wing.bf * z * z);
}

function interp(pillars: Pillar[], days: number): Pillar {
  const ps = [...pillars].sort((a, b) => a.days - b.days);
  if (days <= ps[0]!.days) return ps[0]!;
  if (days >= ps[ps.length - 1]!.days) return ps[ps.length - 1]!;
  const i = ps.findIndex((p) => p.days >= days);
  const a = ps[i - 1]!;
  const b = ps[i]!;
  const w = (days - a.days) / (b.days - a.days);
  const lerp = (x: number, y: number) => x + (y - x) * w;
  // total variance interpolation for ATM
  const atm = Math.sqrt((lerp(a.atm * a.atm * a.days, b.atm * b.atm * b.days)) / days);
  return { tenor: `${Math.round(days)}d`, days, atm, rr25: lerp(a.rr25, b.rr25), bf25: lerp(a.bf25, b.bf25), rr10: a.rr10 != null && b.rr10 != null ? lerp(a.rr10, b.rr10) : null, bf10: a.bf10 != null && b.bf10 != null ? lerp(a.bf10, b.bf10) : null };
}

function priceBs(kind: "call" | "put", s: number, k: number, t: number, r: number, b: number, v: number) {
  const st = v * Math.sqrt(t);
  const d1 = (Math.log(s / k) + (b + (v * v) / 2) * t) / st;
  const d2 = d1 - st;
  const carry = Math.exp((b - r) * t);
  const disc = Math.exp(-r * t);
  if (kind === "call") return { price: s * carry * ncdf(d1) - k * disc * ncdf(d2), delta: carry * ncdf(d1), probItm: ncdf(d2) };
  return { price: k * disc * ncdf(-d2) - s * carry * ncdf(-d1), delta: carry * (ncdf(d1) - 1), probItm: ncdf(-d2) };
}

function decimalsOf(step: number) {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1]!.length : 0;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

type Surface = { symbol: string; version: number; blendWeight: number; pillars: Pillar[]; reason: string; publishedBy: string; publishedAt: string };
type Expiry = {
  id: number;
  symbol: string;
  date: string;
  kinds: string[];
  cutAt: string;
  twapStart: string;
  status: string;
  fixing: number | null;
  source: string | null;
  run: number;
  samples: number | null;
  expected: number | null;
  coverage: number | null;
  maxGapMs: number | null;
  fixedAt: string | null;
  firstFixedAt: string | null;
  error: string | null;
  series: number;
  samplesSoFar: number;
};
type Audit = { id: number; tenant: string; actor: string; action: string; target: string; before: unknown; after: unknown; reason: string; at: string };

type State = {
  version: number;
  underlyings: Record<string, unknown>[];
  rates: Record<string, { ccy: string; rate: number; kind: string; source: string; asOf: string; updatedAt: string; updatedBy: string }>;
  rateHistory: Record<string, { rate: number; prevRate: number | null; asOf: string; reason: string; changedBy: string; changedAt: string }[]>;
  holidays: { calendar: string; day: string; name: string; source: string; active: boolean; updatedAt: string; updatedBy: string }[];
  surfaces: Record<string, Surface[]>;
  tenants: Record<string, { tenant: string; enabledDemo: boolean; enabledLive: boolean; publicChain: boolean; underlyings: string[] | null; updatedAt: string; updatedBy: string }>;
  groups: Record<string, unknown>[];
  controls: Record<string, unknown>[];
  limits: Record<string, unknown>[];
  expiries: Expiry[];
  audit: Audit[];
  voided: Set<string>;
  reruns: Record<string, number>;
};

const ME = "demo@kalkstrade.com #0";
let state: State | null = null;

function spotOf(sym: string, now = Date.now()) {
  const u = UNDERLYINGS.find((x) => x.symbol === sym)!;
  const wiggle = Math.sin(now / 9000 + hashString(sym)) * 0.0006 + Math.sin(now / 41000 + hashString(sym) / 7) * 0.0011;
  const mid = u.spot * (1 + wiggle);
  const half = u.pipSize * (u.assetClass === "forex" ? 0.6 : 15);
  return { bid: r4(mid - half, u.digits), ask: r4(mid + half, u.digits), mid: r4(mid, u.digits + 1), t: now - 120, recv: now - 80 };
}

function isBusiness(d: Date, cals: string[], hol: Set<string>) {
  const wd = d.getUTCDay();
  if (wd === 0 || wd === 6) return false;
  const ds = dayStr(d.getTime());
  return !cals.some((c) => hol.has(`${c}:${ds}`));
}

function seed(now: number): State {
  const r = seeded(20261002);
  const at = (msAgo: number) => iso(now - msAgo);
  const underlyings = UNDERLYINGS.map((u, i) => ({
    symbol: u.symbol,
    name: u.name,
    assetClass: u.assetClass,
    model: u.model,
    baseCcy: u.baseCcy,
    quoteCcy: u.quoteCcy,
    calendars: u.calendars,
    contractSize: u.contractSize,
    contractUnit: u.contractUnit,
    digits: u.digits,
    pipSize: u.pipSize,
    strikeStep: u.strikeStep,
    strikesEachSide: u.assetClass === "forex" ? 10 : 12,
    extendThreshold: 3,
    expiryKinds: ["daily", "weekly", "monthly"],
    dailyCount: 5,
    weeklyCount: 4,
    monthlyCount: 3,
    cutTime: "10:00",
    cutZone: "America/New_York",
    twapMinutes: 30,
    noOpenMinutes: 15,
    closeOnlyMinutes: 1,
    deltaConvention: u.assetClass === "forex" ? "spot" : "forward",
    weekendVolWeight: 0.15,
    holidayVolWeight: 0.5,
    priceScan: u.assetClass === "forex" ? 0.03 : u.assetClass === "metals" ? 0.05 : 0.08,
    volScan: 0.03,
    extremeMultiple: 3,
    extremeCover: 0.35,
    minContracts: 1,
    maxContracts: u.assetClass === "forex" ? 100 : 50,
    contractStep: 1,
    barriersEnabled: u.assetClass !== "energies",
    enabled: u.enabled ?? true,
    sort: i,
    notes: u.symbol === "NZDUSD" ? "Disabled until a NZDUSD feed is added to config/instruments.json." : "",
    updatedAt: at(9 * DAY + i * HOUR),
    updatedBy: "seed",
  }));

  const rates: State["rates"] = {};
  const rateHistory: State["rateHistory"] = {};
  for (const [ccy, rate, kind, source] of RATES) {
    rates[ccy] = { ccy, rate, kind, source, asOf: dayStr(now - 12 * DAY), updatedAt: at(12 * DAY), updatedBy: "seed" };
    rateHistory[ccy] = [{ rate, prevRate: null, asOf: dayStr(now - 12 * DAY), reason: "Initial seed from central-bank policy rates", changedBy: "seed", changedAt: at(12 * DAY) }];
  }
  // a couple of real-looking changes
  rates.USD = { ...rates.USD!, rate: 0.03625, asOf: dayStr(now - 15 * DAY), updatedAt: at(15 * DAY - 2 * HOUR), updatedBy: "s.okafor@kalkstrade.com #7" };
  rateHistory.USD!.unshift({ rate: 0.03625, prevRate: 0.03875, asOf: dayStr(now - 15 * DAY), reason: "RTE-01 · FOMC cut 25 bp", changedBy: "s.okafor@kalkstrade.com #7", changedAt: at(15 * DAY - 2 * HOUR) });
  rateHistory.GBP!.unshift({ rate: 0.0375, prevRate: 0.04, asOf: dayStr(now - 40 * DAY), reason: "RTE-01 · MPC cut 25 bp", changedBy: "s.okafor@kalkstrade.com #7", changedAt: at(40 * DAY) });

  const holidays: State["holidays"] = [];
  for (const [cal, list] of Object.entries(HOLIDAYS)) for (const [day, name] of list) holidays.push({ calendar: cal, day, name, source: "seed", active: true, updatedAt: at(20 * DAY), updatedBy: "seed" });
  // metals: London + New York closures; oil: New York (as config/holidays)
  const merged = (cals: string[]) => [...new Map(cals.flatMap((c) => HOLIDAYS[c]!).map(([d, n]) => [d, n] as [string, string])).entries()].sort();
  for (const [cal, from] of [["XAU", ["GBP", "USD"]], ["XAG", ["GBP", "USD"]], ["OIL", ["USD"]]] as [string, string[]][])
    for (const [day, name] of merged(from)) holidays.push({ calendar: cal, day, name, source: "seed", active: true, updatedAt: at(20 * DAY), updatedBy: "seed" });
  holidays.push({ calendar: "USD", day: "2026-12-24", name: "Christmas Eve (early close)", source: "admin", active: false, updatedAt: at(6 * DAY), updatedBy: "m.ivanova@kalkstrade.com #3" });

  const surfaces: State["surfaces"] = {};
  for (const u of UNDERLYINGS) {
    const skew = u.assetClass === "metals" ? 0.012 : u.assetClass === "energies" ? -0.018 : u.symbol.startsWith("USD") ? 0.004 : -0.003;
    const mk = (bump: number): Pillar[] =>
      TENORS.map(([tenor, days, m]) => {
        const atm = r4(u.atm * m * (1 + bump), 5);
        return { tenor, days, atm, rr25: r4(skew * (0.8 + days / 300), 5), bf25: r4(atm * 0.035, 5), rr10: r4(skew * 1.9 * (0.8 + days / 300), 5), bf10: r4(atm * 0.11, 5) };
      });
    surfaces[u.symbol] = [
      { symbol: u.symbol, version: 3, blendWeight: 0.7, pillars: mk(0), reason: "VOL-02 · Weekly re-mark to broker quotes", publishedBy: "m.ivanova@kalkstrade.com #3", publishedAt: at(2 * DAY + r.int(1, 8) * HOUR) },
      { symbol: u.symbol, version: 2, blendWeight: 0.7, pillars: mk(0.04), reason: "VOL-03 · Event premium (central-bank week)", publishedBy: "m.ivanova@kalkstrade.com #3", publishedAt: at(9 * DAY) },
      { symbol: u.symbol, version: 1, blendWeight: 0.7, pillars: mk(-0.02), reason: "Initial seed", publishedBy: "seed", publishedAt: at(21 * DAY) },
    ];
  }

  const tenants: State["tenants"] = {
    kalks: { tenant: "kalks", enabledDemo: true, enabledLive: false, publicChain: false, underlyings: null, updatedAt: at(21 * DAY), updatedBy: "seed" },
    "apex-fx": { tenant: "apex-fx", enabledDemo: true, enabledLive: false, publicChain: false, underlyings: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"], updatedAt: at(4 * DAY), updatedBy: "owner@kalkstrade.com #1" },
  };

  const g = (groupCode: string, symbol: string, p: Partial<Record<string, number | boolean>>, ago: number, by: string) => ({
    tenant: "kalks",
    groupCode,
    symbol,
    volSpread: 0.004,
    minSpreadUsd: 0.5,
    commissionPerContract: 0.25,
    commissionCapPct: 10,
    maxContractsPerClient: 200,
    weekendMarginPct: 25,
    enabled: true,
    ...p,
    updatedAt: at(ago),
    updatedBy: by,
  });
  const groups = [
    g("*", "*", {}, 21 * DAY, "seed"),
    g("pro", "*", { volSpread: 0.0025, minSpreadUsd: 0.3, commissionPerContract: 0.15 }, 6 * DAY, "m.ivanova@kalkstrade.com #3"),
    g("standard", "XAUUSD", { volSpread: 0.006, minSpreadUsd: 1, weekendMarginPct: 40 }, 3 * DAY, "m.ivanova@kalkstrade.com #3"),
    g("vip", "*", { volSpread: 0.002, commissionPerContract: 0.1, commissionCapPct: 6, maxContractsPerClient: 500 }, 8 * DAY, "owner@kalkstrade.com #1"),
    g("cent", "*", { enabled: false, maxContractsPerClient: 20 }, 10 * DAY, "m.ivanova@kalkstrade.com #3"),
  ];

  // expiries: the last few days (fixed), today's cut (TWAP running), and the listed cycle
  const hol = new Set(holidays.filter((h) => h.active).map((h) => `${h.calendar}:${h.day}`));
  const expiries: Expiry[] = [];
  let id = 100;
  const today = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()));
  for (const u of UNDERLYINGS) {
    if (u.enabled === false) continue;
    const cals = [...new Set([...u.calendars, "USD"])];
    const days: { date: Date; kinds: string[] }[] = [];
    // past 4 business days
    for (let k = 1, found = 0; found < 4 && k < 12; k++) {
      const d = new Date(today.getTime() - k * DAY);
      if (isBusiness(d, cals, hol)) {
        days.push({ date: d, kinds: ["daily"] });
        found++;
      }
    }
    // today + next business days
    for (let k = 0, found = 0; found < 6 && k < 20; k++) {
      const d = new Date(today.getTime() + k * DAY);
      if (isBusiness(d, cals, hol)) {
        days.push({ date: d, kinds: d.getUTCDay() === 5 ? ["daily", "weekly"] : ["daily"] });
        found++;
      }
    }
    // next Fridays and month ends
    for (let k = 7; k < 95; k++) {
      const d = new Date(today.getTime() + k * DAY);
      if (d.getUTCDay() !== 5) continue;
      const lastFri = new Date(d.getTime() + 7 * DAY).getUTCMonth() !== d.getUTCMonth();
      if (k <= 28 || lastFri) days.push({ date: d, kinds: lastFri ? (k <= 28 ? ["weekly", "monthly"] : ["monthly"]) : ["weekly"] });
    }
    const seen = new Set<string>();
    for (const { date, kinds } of days.sort((a, b) => a.date.getTime() - b.date.getTime())) {
      const ds = dayStr(date.getTime());
      if (seen.has(ds)) continue;
      seen.add(ds);
      let cut = date.getTime() + 14 * HOUR; // 10:00 New York (EDT)
      const isToday = ds === dayStr(today.getTime());
      // demo: today's cut for the majors is 12 minutes away so the TWAP monitor has something to show
      if (isToday && ["EURUSD", "XAUUSD", "USDJPY"].includes(u.symbol)) cut = now + 12 * MIN + (u.symbol === "XAUUSD" ? 4 * MIN : u.symbol === "USDJPY" ? 9 * MIN : 0);
      // … and two fixed 25 minutes ago, still inside the 1-hour re-fix window
      if (isToday && ["GBPUSD", "XAGUSD"].includes(u.symbol)) cut = now - 27 * MIN;
      const twap = cut - 30 * MIN;
      const strikes = 2 * (u.assetClass === "forex" ? 10 : 12) + 1;
      const e: Expiry = { id: id++, symbol: u.symbol, date: ds, kinds, cutAt: iso(cut), twapStart: iso(twap), status: "listed", fixing: null, source: null, run: 0, samples: null, expected: null, coverage: null, maxGapMs: null, fixedAt: null, firstFixedAt: null, error: null, series: strikes * 2, samplesSoFar: 0 };
      if (cut <= now) {
        const cov = u.symbol === "XAGUSD" && cut > now - 2 * DAY ? 0.43 : 0.97 + r.next() * 0.03;
        const fx = r4(u.spot * (1 + r.normal() * 0.004), u.digits);
        const fixedAt = cut + 90_000;
        e.status = cut < now - 3 * DAY ? "expired" : "fixed";
        e.fixing = fx;
        e.source = cov < 0.5 ? "m1_fallback" : "twap";
        e.run = 1;
        e.expected = 1800;
        e.samples = Math.round(1800 * cov);
        e.coverage = r4(cov, 4);
        e.maxGapMs = cov < 0.5 ? 412_000 : r.int(1, 9) * 1000;
        e.fixedAt = iso(fixedAt);
        e.firstFixedAt = e.fixedAt;
        e.samplesSoFar = e.samples;
      } else if (twap <= now) {
        e.samplesSoFar = Math.floor((now - twap) / 1000) - 3;
      }
      expiries.push(e);
    }
  }

  const ctl = (id: number, scope: string, target: string, mode: string, reason: string, ago: number, extra: Record<string, unknown> = {}) => ({
    id,
    tenant: "kalks",
    scope,
    target,
    mode,
    manualVol: null,
    frozenSpot: null,
    reason,
    active: true,
    expiresAt: null,
    createdBy: "j.mensah@kalkstrade.com #5",
    createdAt: at(ago),
    clearedBy: null,
    clearedAt: null,
    clearReason: null,
    ...extra,
  });
  const nextJpy = expiries.find((e) => e.symbol === "USDJPY" && e.status === "listed" && Date.parse(e.cutAt) > now + 20 * HOUR);
  const oilSeries = `UKOIL-${(expiries.find((e) => e.symbol === "UKOIL" && e.status === "listed")?.date ?? dayStr(now)).replace(/-/g, "")}-75.00-C`;
  const controls = [
    ctl(41, "expiry", `USDJPY:${nextJpy?.date ?? dayStr(now + DAY)}`, "manual_vol", "DLR-03 · BoJ decision overnight: event vol until the announcement", 3 * HOUR, { manualVol: 0.142, expiresAt: iso(now + 18 * HOUR) }),
    ctl(40, "series", oilSeries, "close_only", "DLR-02 · Concentrated short interest in one strike", 26 * HOUR),
    ctl(39, "underlying", "XAGUSD", "halt", "DLR-01 · Silver feed gap under review", 40 * MIN, { expiresAt: iso(now + 50 * MIN) }),
    { ...ctl(37, "underlying", "USOIL", "freeze", "DLR-04 · Feed spike on EIA print", 2 * DAY, { frozenSpot: 71.12 }), active: false, clearedBy: "j.mensah@kalkstrade.com #5", clearedAt: at(2 * DAY - 6 * MIN), clearReason: "Feed back to normal" },
    { ...ctl(35, "all", "*", "halt", "DLR-05 · Platform maintenance window", 6 * DAY, { tenant: "*", createdBy: "owner@kalkstrade.com #1" }), active: false, clearedBy: "owner@kalkstrade.com #1", clearedAt: at(6 * DAY - 25 * MIN), clearReason: "Maintenance finished" },
  ];

  const limits = [
    { tenant: "kalks", userId: 10482, maxContracts: 5, maxShortContracts: 0, closeOnly: false, blocked: false, reason: "LIM-01 · Live tester allow-list (O48)", updatedAt: at(5 * DAY), updatedBy: "owner@kalkstrade.com #1" },
    { tenant: "kalks", userId: 10517, maxContracts: 10, maxShortContracts: 2, closeOnly: false, blocked: false, reason: "LIM-01 · Live tester allow-list (O48)", updatedAt: at(5 * DAY), updatedBy: "owner@kalkstrade.com #1" },
    { tenant: "kalks", userId: 20931, maxContracts: 40, maxShortContracts: 10, closeOnly: true, blocked: false, reason: "LIM-03 · Toxic flow: sells 0DTE wings minutes before the cut", updatedAt: at(20 * HOUR), updatedBy: "j.mensah@kalkstrade.com #5" },
    { tenant: "kalks", userId: 31877, maxContracts: null, maxShortContracts: null, closeOnly: false, blocked: true, reason: "LIM-04 · Suitability quiz failed twice", updatedAt: at(2 * DAY), updatedBy: "c.duarte@kalkstrade.com #9" },
  ];

  const audit: Audit[] = [];
  const add = (tenant: string, actor: string, action: string, target: string, reason: string, ago: number, before: unknown = null, after: unknown = null) => audit.push({ id: 0, tenant, actor, action, target, before, after, reason, at: at(ago) });
  add("kalks", "j.mensah@kalkstrade.com #5", "control.add", "expiry:USDJPY", "DLR-03 · BoJ decision overnight: event vol until the announcement", 3 * HOUR, null, { mode: "manual_vol", manualVol: 0.142 });
  add("kalks", "j.mensah@kalkstrade.com #5", "control.add", "underlying:XAGUSD", "DLR-01 · Silver feed gap under review", 40 * MIN, null, { mode: "halt" });
  add("kalks", "m.ivanova@kalkstrade.com #3", "surface.publish", "EURUSD", "VOL-02 · Weekly re-mark to broker quotes", 2 * DAY + 3 * HOUR, { version: 2, blendWeight: 0.7 }, { version: 3, blendWeight: 0.7 });
  add("kalks", "m.ivanova@kalkstrade.com #3", "surface.publish", "XAUUSD", "VOL-02 · Weekly re-mark to broker quotes", 2 * DAY + 2 * HOUR, { version: 2 }, { version: 3 });
  add("kalks", "s.okafor@kalkstrade.com #7", "rate.update", "USD", "RTE-01 · FOMC cut 25 bp", 15 * DAY - 2 * HOUR, { rate: 0.03875 }, { rate: 0.03625 });
  add("kalks", "m.ivanova@kalkstrade.com #3", "group.upsert", "standard/XAUUSD", "FEE-02 · Gold weekend gap risk", 3 * DAY, null, { volSpread: 0.006, weekendMarginPct: 40 });
  add("kalks", "j.mensah@kalkstrade.com #5", "limit.upsert", "20931", "LIM-03 · Toxic flow: sells 0DTE wings minutes before the cut", 20 * HOUR, null, { closeOnly: true, maxContracts: 40 });
  add("kalks", "owner@kalkstrade.com #1", "tenant.update", "apex-fx", "BRK-01 · Broker onboarding: demo first", 4 * DAY, { enabledDemo: false }, { enabledDemo: true, enabledLive: false, underlyings: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"] });
  add("kalks", "m.ivanova@kalkstrade.com #3", "holiday.disable", "USD:2026-12-24", "HOL-02 · Early close only, not a bank holiday", 6 * DAY);
  add("kalks", "s.okafor@kalkstrade.com #7", "fixing.manual", "XAGUSD", "SET-02 · Feed gap: re-fixed from the LBMA reference", 2 * DAY + HOUR, { price: 31.02, run: 1 }, { price: 31.07, run: 2 });
  add("kalks", "j.mensah@kalkstrade.com #5", "control.clear", "37", "Feed back to normal", 2 * DAY - 6 * MIN);
  add("kalks", "owner@kalkstrade.com #1", "control.clear", "35", "Maintenance finished", 6 * DAY - 25 * MIN);
  add("kalks", "m.ivanova@kalkstrade.com #3", "underlying.update", "XAUUSD", "CFG-02 · Wider strike ladder for the gold rally", 8 * DAY, { strikesEachSide: 10 }, { strikesEachSide: 12 });
  add("apex-fx", "risk@apexfx.com #31", "group.upsert", "*/*", "FEE-01 · Launch pricing", 3 * DAY + 5 * HOUR, null, { volSpread: 0.005 });
  audit.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).forEach((a, i, arr) => (a.id = 5000 + arr.length - i));

  return { version: 57, underlyings, rates, rateHistory, holidays, surfaces, tenants, groups, controls, limits, expiries, audit, voided: new Set(), reruns: {} };
}

function db(): State {
  return (state ??= seed(Date.now()));
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

type Res = { status: number; data: unknown };
const ok = (data: unknown): Res => ({ status: 200, data });
const err = (status: number, code: string, message: string): Res => ({ status, data: { error: { code, message } } });
const bad = (message: string) => err(422, "validation", message);

function audit(action: string, target: string, reason: string, before: unknown, after: unknown) {
  const s = db();
  const id = (s.audit[0]?.id ?? 5000) + 1;
  s.audit.unshift({ id, tenant: "kalks", actor: ME, action, target, before, after, reason, at: new Date().toISOString() });
}
function bump() {
  return ++db().version;
}
function needReason(b: Record<string, unknown>): string | Res {
  const r = typeof b.reason === "string" ? b.reason.trim() : "";
  return r.length < 3 ? bad("A reason is required.") : r;
}

function underlyingsView() {
  const s = db();
  return s.underlyings.map((u) => {
    const sym = u.symbol as string;
    const surf = s.surfaces[sym]?.[0];
    const base = UNDERLYINGS.find((x) => x.symbol === sym)!;
    return {
      ...u,
      calendarCodes: [...new Set([...(u.calendars as string[]), "USD"])].sort(),
      spot: u.enabled ? spotOf(sym) : null,
      surfaceVersion: surf?.version ?? null,
      realizedVol: { symbol: sym, estimator: "yang_zhang", tf: "D1", windowBars: 20, value: r4(base.atm * (0.86 + (hashString(sym) % 20) / 100), 5), computedAt: iso(Date.now() - 7 * MIN) },
    };
  });
}

function chainFor(sym: string, expiryDate: string | null, group: string) {
  const s = db();
  const u = UNDERLYINGS.find((x) => x.symbol === sym);
  const cfg = s.underlyings.find((x) => x.symbol === sym);
  if (!u || !cfg) return err(404, "not_found", "Underlying not found.");
  const exps = s.expiries.filter((e) => e.symbol === sym && (e.status === "listed" || e.status === "fixing")).sort((a, b) => a.cutAt.localeCompare(b.cutAt));
  const e = expiryDate ? s.expiries.find((x) => x.symbol === sym && x.date === expiryDate) : exps[0];
  if (!e) return err(404, "not_found", "Expiry not found.");
  const now = Date.now();
  const spot = spotOf(sym, now);
  const t = Math.max((Date.parse(e.cutAt) - now) / (365 * DAY), 1 / (365 * 24 * 12));
  const rd = s.rates[u.quoteCcy]?.rate ?? 0;
  const rf = u.model === "black76" ? rd : (s.rates[u.baseCcy]?.rate ?? 0);
  const b = u.model === "black76" ? 0 : rd - rf;
  const fwd = spot.mid * Math.exp(b * t);
  const surf = s.surfaces[sym]![0]!;
  const p = interp(surf.pillars, t * 365);
  const realized = u.atm * 0.92;
  const blendAtm = surf.blendWeight * p.atm + (1 - surf.blendWeight) * realized;
  const manual = s.controls.find((c) => c.active && c.mode === "manual_vol" && (c.target === sym || c.target === `${sym}:${e.date}`));
  const atmVol = (manual?.manualVol as number | undefined) ?? blendAtm;
  const pAdj = { ...p, atm: atmVol };
  const step = u.strikeStep;
  const each = cfg.strikesEachSide as number;
  const atmStrike = Math.round(spot.mid / step) * step;
  const dec = decimalsOf(step);
  const gs = (s.groups.find((g) => g.groupCode === group && g.symbol === sym) ?? s.groups.find((g) => g.groupCode === group && g.symbol === "*") ?? s.groups.find((g) => g.groupCode === "*" && g.symbol === "*"))!;
  const spread = gs.volSpread as number;
  const usdPerQuote = u.quoteCcy === "USD" ? 1 : u.quoteCcy === "JPY" ? 1 / 149.382 : u.quoteCcy === "CAD" ? 1 / 1.35722 : u.quoteCcy === "CHF" ? 1 / 0.84917 : 1;
  const halted = s.controls.some((c) => c.active && c.mode === "halt" && (c.scope === "all" || c.target === sym || c.target === `${sym}:${e.date}`));
  const minsToCut = (Date.parse(e.cutAt) - now) / MIN;
  const baseState = halted ? "halted" : minsToCut <= 1 ? "closed" : minsToCut <= 15 ? "close_only" : "open";
  const side = (kind: "call" | "put", k: number, label: string) => {
    const code = `${sym}-${e.date.replace(/-/g, "")}-${label}-${kind === "call" ? "C" : "P"}`;
    const v = volAt(pAdj, k, fwd, t);
    const mid = priceBs(kind, spot.mid, k, t, rd, b, v);
    const bid = priceBs(kind, spot.mid, k, t, rd, b, Math.max(v - spread, v * 0.25));
    const ask = priceBs(kind, spot.mid, k, t, rd, b, v + spread);
    const cs = u.contractSize * usdPerQuote;
    const seriesCtl = s.controls.find((c) => c.active && c.scope === "series" && c.target === code);
    return {
      code,
      bid: r4(bid.price, u.digits + 1),
      ask: r4(ask.price, u.digits + 1),
      mark: r4(mid.price, u.digits + 1),
      bidUsd: r4(bid.price * cs, 2),
      askUsd: r4(ask.price * cs, 2),
      markUsd: r4(mid.price * cs, 2),
      iv: r4(v, 5),
      delta: r4(mid.delta, 4),
      gamma: null,
      vega: null,
      theta: null,
      probItm: r4(mid.probItm, 4),
      breakeven: r4(kind === "call" ? k + mid.price : k - mid.price, u.digits),
      state: seriesCtl ? (seriesCtl.mode === "halt" ? "halted" : "close_only") : baseState,
    };
  };
  const rows = [];
  for (let i = -each; i <= each; i++) {
    const k = r4(atmStrike + i * step, dec + 2);
    const label = k.toFixed(dec);
    rows.push({ strike: k, strikeLabel: label, call: side("call", k, label), put: side("put", k, label) });
  }
  return ok({ underlying: sym, name: u.name, model: u.model, expiry: e.date, kinds: e.kinds, cutAt: e.cutAt, twapStart: e.twapStart, status: e.status, state: baseState, contractSize: u.contractSize, contractUnit: u.contractUnit, quoteCcy: u.quoteCcy, digits: u.digits, pipSize: u.pipSize, group, spot, atmStrike: r4(atmStrike, dec + 2), version: s.version, rows });
}

function smileFor(sym: string, expiryDate: string | null) {
  const c = chainFor(sym, expiryDate, "*");
  if (c.status !== 200) return c;
  const chain = c.data as { expiry: string; rows: { strike: number; call: { iv: number } }[]; spot: { mid: number } };
  const s = db();
  const surf = s.surfaces[sym]![0]!;
  const e = s.expiries.find((x) => x.symbol === sym && x.date === chain.expiry)!;
  const t = Math.max((Date.parse(e.cutAt) - Date.now()) / (365 * DAY), 1 / 8760);
  const p = interp(surf.pillars, t * 365);
  const atm = chain.rows[Math.floor(chain.rows.length / 2)]!.call.iv;
  const sqrtT = Math.sqrt(t);
  const strikeAtDelta = (d: number, v: number) => chain.spot.mid * Math.exp(-ncdfInv(d) * v * sqrtT + 0.5 * v * v * t);
  const pillars = [0.1, 0.25, 0.5, 0.75, 0.9].map((d) => {
    const z = d === 0.5 ? 0 : d < 0.5 ? (d === 0.25 ? 1 : 2) : d === 0.75 ? -1 : -2;
    const v = atm + (p.rr25 / 2) * z + p.bf25 * z * z;
    return { callDelta: d, vol: r4(v, 5), strike: r4(strikeAtDelta(d, v), 5) };
  });
  return ok({
    underlying: sym,
    expiry: chain.expiry,
    atmVol: atm,
    points: chain.rows.map((r) => ({ strike: r.strike, vol: r.call.iv })),
    pillars,
    termStructure: surf.pillars,
    inputs: { spot: chain.spot.mid, forward: chain.spot.mid, tCal: t, tVol: t * 0.92, atmVol: atm, surfaceAtm: p.atm, realized: UNDERLYINGS.find((x) => x.symbol === sym)!.atm * 0.92, blendWeight: surf.blendWeight, manualVol: null, surfaceVersion: surf.version },
  });
}

function ncdfInv(p: number) {
  // Acklam's rational approximation (demo smile only)
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

/** Trading engine: the house option book in the engine's units (services/trading api/options.rs `book`): delta in
 *  delta-weighted contracts (+ units of the underlying), gamma = contract-delta change per 1 % spot, vega USD per vol
 *  point, theta USD per day; house side. Moves a little on every call. */
function book(kind: string) {
  const now = Date.now();
  const s = db();
  const w = (sym: string, k: number) => 1 + Math.sin(now / (7000 + k * 1300) + hashString(sym)) * 0.06;
  const scale = kind === "demo" ? 0.35 : kind === "all" ? 1.35 : 1;
  const usdPer = (q: string) => (q === "USD" ? 1 : q === "JPY" ? 1 / 149.382 : q === "CAD" ? 1 / 1.35722 : q === "CHF" ? 1 / 0.84917 : 1);
  const rows: [string, number, number, number, number, number, number, number, number][] = [
    // symbol, delta $/1 %, gamma $/1 %², vega $/vol pt, theta $/day, long, short, clients, share of delta hedged
    ["EURUSD", -18_400, -6_900, -11_800, 4_150, 1_240, 1_980, 186, 0.82],
    ["XAUUSD", 31_600, -12_400, -21_300, 7_900, 2_870, 3_410, 241, 0.74],
    ["USDJPY", -7_200, -3_100, -6_400, 2_250, 640, 910, 97, 0],
    ["GBPUSD", 4_800, -1_900, -3_200, 1_120, 520, 610, 74, 0],
    ["XAGUSD", 9_900, -2_600, -4_700, 1_600, 380, 450, 63, 0.4],
    ["USOIL", -12_300, -4_400, -5_900, 2_700, 690, 880, 88, 0.9],
    ["UKOIL", -2_100, -900, -1_400, 520, 210, 260, 31, 0],
    ["AUDUSD", 1_350, -600, -1_100, 410, 140, 170, 22, 0],
    ["USDCAD", -900, -300, -700, 260, 90, 130, 17, 0],
    ["EURJPY", 650, -250, -500, 180, 60, 75, 12, 0],
    ["GBPJPY", -1_150, -480, -820, 300, 110, 150, 19, 0],
  ];
  const underlyings = rows.map(([symbol, d, g, v, th, l, sh, c, hedged], k) => {
    const u = UNDERLYINGS.find((x) => x.symbol === symbol)!;
    const per = u.contractSize * u.spot * 0.01 * usdPer(u.quoteCcy);
    const netDelta = r4(((d * scale) / per) * w(symbol, k), 4);
    const units = r4(netDelta * u.contractSize, 2);
    const hedgeUnits = r4(-units * hedged, 2);
    return {
      symbol,
      netDelta,
      netDeltaUnits: units,
      clientDelta: -netDelta,
      gamma: r4(((g * scale) / per) * w(symbol, k + 3), 6),
      vega: Math.round(v * scale * w(symbol, k + 5)),
      theta: Math.round(th * scale * w(symbol, k + 7)),
      longContracts: Math.round(l * scale),
      shortContracts: Math.round(sh * scale),
      clients: Math.round(c * scale),
      hedgeContracts: r4(hedgeUnits / u.contractSize, 4),
      hedgeUnits,
      deltaAfterHedgeUnits: r4(units + hedgeUnits, 2),
    };
  });
  const r = seeded(4411);
  const topClients = Array.from({ length: 10 }, (_, i) => {
    const pnl = Math.round((i < 3 ? 1 : i < 6 ? 0.4 : -0.6) * r.range(4_000, 48_000) * scale);
    const contracts = r.int(12, 380);
    return { userId: [20931, 10517, 44120, 38211, 10482, 51870, 27645, 33002, 19388, 46790][i]!, login: 7_100_000 + r.int(1000, 9999), pnl: Math.round(pnl * w(`c${i}`, i)), contracts, todayPnl: Math.round(pnl * r.range(-0.15, 0.35)) };
  }).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  const fixed = s.expiries.filter((e) => e.status === "fixed" || e.status === "expired").sort((a, b) => b.cutAt.localeCompare(a.cutAt)).slice(0, 20);
  const settlements = fixed.map((e, i) => {
    const started = Date.parse(e.fixedAt ?? e.cutAt) + 20_000;
    const run = s.reruns[`${e.symbol}:${e.date}`] ?? 1;
    return {
      id: 900 - i,
      expiry: `${e.symbol}:${e.date}`,
      symbol: e.symbol,
      date: e.date,
      run,
      fixing: e.fixing,
      source: e.source,
      status: "done",
      kind: run > 1 ? "rerun" : "settle",
      positions: 20 + (hashString(e.symbol + e.date) % 160),
      accounts: 8 + (hashString(e.date + e.symbol) % 60),
      payoutUsd: Math.round(((hashString(e.date + e.symbol) % 9000) - 2500) * 3.1),
      failures: 0,
      reason: run > 1 ? "Re-run after a re-fix" : "",
      createdBy: run > 1 ? ME : "system",
      startedAt: iso(started),
      finishedAt: iso(started + 4_000),
    };
  });
  return ok({ kind, underlyings, topClients, settlements, snapshot: { version: s.version, stale: false, lastOkAt: iso(now - 3_000) }, hedgeAccount: 7_000_001 });
}

/** Rejects a surface the service would reject (optmath VolSurface::new): positive wings, increasing days, and total
 *  variance that never falls between tenors for the ATM and every 25Δ / 10Δ wing. */
function checkSurface(pillars: Pillar[]): string | null {
  if (!pillars.length || pillars.length > 24) return "Give 1 to 24 pillars.";
  const ps = [...pillars].sort((a, b) => a.days - b.days);
  const wings = (p: Pillar): [string, number][] => [
    ["ATM", p.atm],
    ["25D call", p.atm + p.bf25 + p.rr25 / 2],
    ["25D put", p.atm + p.bf25 - p.rr25 / 2],
    ...(p.rr10 != null && p.bf10 != null ? ([["10D call", p.atm + p.bf10 + p.rr10 / 2], ["10D put", p.atm + p.bf10 - p.rr10 / 2]] as [string, number][]) : []),
  ];
  for (const [i, p] of ps.entries()) {
    if (!(p.days > 0 && p.days <= 3660)) return `tenor ${p.tenor}: days must be in (0, 3660]`;
    if (!(p.atm > 0.001 && p.atm < 3)) return `tenor ${p.tenor}: ATM vol must be a decimal between 0.001 and 3 (e.g. 0.085)`;
    if ((p.rr10 == null) !== (p.bf10 == null)) return `tenor ${p.tenor}: give both RR10 and BF10 or neither`;
    if (wings(p).some(([, v]) => v <= 0)) return `pillar ${i} is invalid (t <= 0, non-finite, or a wing vol <= 0)`;
    if (i > 0 && p.days <= ps[i - 1]!.days) return `pillar ${i} is not after the previous one`;
  }
  const bad: string[] = [];
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1]!;
    const b = ps[i]!;
    for (const [w, va] of wings(a)) {
      const vb = wings(b).find(([x]) => x === w)?.[1];
      if (vb === undefined) continue;
      const w0 = (va * va * a.days) / 365;
      const w1 = (vb * vb * b.days) / 365;
      if (w1 < w0 - 1e-12) bad.push(`pillar ${i} ${w}: total variance ${w0.toFixed(6)} -> ${w1.toFixed(6)}`);
    }
  }
  return bad.length ? `calendar arbitrage: ${bad.join("; ")}` : null;
}

/** Answers a Back Office request in the demo build. `url` is the browser URL (`/api/options/…`, `/api/trading/…`). */
export async function mockOptionsRequest(method: string, url: string, body?: unknown): Promise<Res> {
  await new Promise((r) => setTimeout(r, method === "GET" ? 120 : 260));
  const u = new URL(url, "http://demo.local");
  const q = u.searchParams;
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const s = db();
  const path = u.pathname;

  if (path === "/api/owner/tenants")
    return ok({
      items: [
        { id: 1, slug: "kalks", name: "Kalks Markets", status: "active" },
        { id: 2, slug: "apex-fx", name: "Apex FX", status: "active" },
        { id: 3, slug: "northstar", name: "Northstar Capital", status: "active" },
        { id: 4, slug: "meridian", name: "Meridian Trade", status: "suspended" },
      ],
    });

  if (path.startsWith("/api/trading/admin/options/")) {
    const p = path.slice("/api/trading/admin/options/".length);
    if (method === "GET" && p === "book") return book(q.get("kind") ?? "live");
    const rerun = p.match(/^settlements\/([^/]+)\/rerun$/);
    if (method === "POST" && rerun) {
      const reason = needReason(b);
      if (typeof reason !== "string") return reason;
      const key = decodeURIComponent(rerun[1]!);
      const e = s.expiries.find((x) => `${x.symbol}:${x.date}` === key);
      if (!e) return bad("expiry must look like EURUSD:2026-10-09");
      if (!e.fixedAt) return bad("Only a settled expiry can be re-run.");
      if (Date.now() - Date.parse(e.firstFixedAt ?? e.fixedAt) > HOUR) return bad("The re-run window (1 hour after the first settlement) has closed.");
      s.reruns[key] = (s.reruns[key] ?? 1) + 1;
      audit("settlement.rerun", key, reason, { run: s.reruns[key]! - 1 }, { run: s.reruns[key] });
      return ok({ ok: true, run: s.reruns[key], positions: 20 + (hashString(e.symbol) % 120), clientsNotified: 11 + (hashString(e.date) % 40) });
    }
    const voidM = p.match(/^trades\/(\d+)\/void$/);
    if (method === "POST" && voidM) {
      const code = typeof b.reasonCode === "string" ? b.reasonCode : "";
      if (!code) return bad("A reason code is required.");
      if (s.voided.has(voidM[1]!)) return bad("This trade is already voided.");
      if (!/^9\d{5,8}$/.test(voidM[1]!)) return err(404, "not_found", "Option trade not found. In the demo, option tickets start with 9 (e.g. 9104421).");
      if (!String(b.note ?? "").trim()) return bad("Voiding a trade needs a note");
      s.voided.add(voidM[1]!);
      audit("trade.void", voidM[1]!, `${code}${b.note ? ` · ${String(b.note)}` : ""}`, null, { voided: true });
      return ok({ data: { ticket: Number(voidM[1]), premiumReversedUsd: 184.5, commissionReversedUsd: 2.5 }, audit: [] });
    }
    return err(404, "engine_pending", "Available after the engine update.");
  }

  if (!path.startsWith("/api/options/")) return err(404, "not_found", "Not found.");
  const p = path.slice("/api/options/".length);
  const seg = p.split("/");

  if (method === "GET") {
    if (p === "overview")
      return ok({
        version: s.version,
        tenant: s.tenants.kalks,
        underlyings: s.underlyings.filter((x) => x.enabled).length,
        expiries: s.expiries.filter((e) => e.status === "listed").length,
        series: s.expiries.filter((e) => e.status === "listed").reduce((n, e) => n + e.series, 0),
        awaitingFixing: s.expiries.filter((e) => e.status === "fixing").length,
        controls: s.controls.filter((c) => c.active).length,
        feedConnected: true,
        jobs: { listing: iso(Date.now() - 18_000), fixing: iso(Date.now() - 1000), refdata: iso(Date.now() - 2000), realized_vol: iso(Date.now() - 7 * MIN), marks_eod: iso(Date.now() - 17 * HOUR) },
      });
    if (p === "underlyings") return ok({ underlyings: underlyingsView() });
    if (p === "rates") return ok({ rates: Object.values(s.rates) });
    if (seg[0] === "rates" && seg[2] === "history") return ok({ ccy: seg[1]!.toUpperCase(), history: s.rateHistory[seg[1]!.toUpperCase()] ?? [] });
    if (p === "holidays") {
      const cal = q.get("calendar")?.toUpperCase();
      const year = q.get("year");
      return ok({ calendars: [...Object.keys(HOLIDAYS), "XAU", "XAG", "OIL"].sort(), holidays: s.holidays.filter((h) => (!cal || h.calendar === cal) && (!year || h.day.startsWith(year))).sort((a, b) => a.calendar.localeCompare(b.calendar) || a.day.localeCompare(b.day)) });
    }
    if (seg[0] === "surfaces" && seg.length === 2) {
      const list = s.surfaces[seg[1]!.toUpperCase()];
      if (!list) return err(404, "not_found", "Underlying not found.");
      const base = UNDERLYINGS.find((x) => x.symbol === seg[1]!.toUpperCase())!;
      const realized = [
        { estimator: "close_to_close", windowBars: 20, value: r4(base.atm * 0.95, 5), bars: 20, computedAt: iso(Date.now() - 7 * MIN) },
        { estimator: "ewma", windowBars: 0, value: r4(base.atm * 0.97, 5), bars: 260, computedAt: iso(Date.now() - 7 * MIN) },
        { estimator: "garman_klass", windowBars: 20, value: r4(base.atm * 0.88, 5), bars: 20, computedAt: iso(Date.now() - 7 * MIN) },
        { estimator: "yang_zhang", windowBars: 20, value: r4(base.atm * 0.92, 5), bars: 20, computedAt: iso(Date.now() - 7 * MIN) },
        { estimator: "yang_zhang", windowBars: 60, value: r4(base.atm * 0.9, 5), bars: 60, computedAt: iso(Date.now() - 7 * MIN) },
      ];
      return ok({ symbol: base.symbol, current: list[0], versions: list.map(({ pillars: _p, symbol: _s, ...v }) => v), realized, realizedUsed: { symbol: base.symbol, estimator: "yang_zhang", tf: "D1", windowBars: 20, value: r4(base.atm * 0.92, 5), computedAt: iso(Date.now() - 7 * MIN) } });
    }
    if (seg[0] === "surfaces" && seg.length === 3) {
      const v = s.surfaces[seg[1]!.toUpperCase()]?.find((x) => String(x.version) === seg[2]);
      return v ? ok(v) : err(404, "not_found", "Surface version not found.");
    }
    if (p === "tenants") return ok({ tenants: Object.values(s.tenants).sort((a, b) => a.tenant.localeCompare(b.tenant)) });
    if (p === "groups") return ok({ groups: s.groups, default: s.groups.find((g) => g.groupCode === "*" && g.symbol === "*") });
    if (p === "controls") {
      const all = q.get("all") === "true";
      return ok({ controls: s.controls.filter((c) => all || (c.active && (!c.expiresAt || Date.parse(c.expiresAt as string) > Date.now()))).sort((a, b) => (b.id as number) - (a.id as number)) });
    }
    if (p === "limits") return ok({ limits: s.limits });
    if (p === "expiries") {
      const sym = q.get("u")?.toUpperCase();
      const st = q.get("status");
      const limit = Number(q.get("limit") ?? 200);
      const now = Date.now();
      const list = s.expiries
        .filter((e) => (!sym || e.symbol === sym) && (!st || e.status === st))
        .map((e) => {
          const twap = Date.parse(e.twapStart);
          const live = e.status === "listed" && now >= twap ? Math.min(1800, Math.floor((now - twap) / 1000) - 3) : e.samplesSoFar;
          return { ...e, samplesSoFar: Math.max(0, live) };
        })
        .sort((a, b) => b.cutAt.localeCompare(a.cutAt))
        .slice(0, limit);
      return ok({ expiries: list.map(({ firstFixedAt: _f, ...e }) => e) });
    }
    if (p === "audit") {
      const before = q.get("before") ? Number(q.get("before")) : null;
      const limit = Math.min(500, Number(q.get("limit") ?? 100));
      const all = q.get("all") === "true";
      const list = s.audit.filter((a) => (all || a.tenant === "kalks") && (before === null || a.id < before)).slice(0, limit);
      return ok({ audit: list, next: list.length === limit ? list[list.length - 1]!.id : null });
    }
    if (p === "smile") return smileFor((q.get("u") ?? "").toUpperCase(), q.get("expiry"));
    if (p === "chain") return chainFor((q.get("u") ?? "").toUpperCase(), q.get("expiry"), q.get("group") ?? "*");
    return err(404, "not_found", "Not found.");
  }

  // writes
  if (method === "POST" && p === "listing/run") {
    bump();
    return ok({ report: { expiriesAdded: 0, seriesAdded: 6, skippedNoPrice: ["NZDUSD"] }, version: s.version });
  }
  const reason = needReason(b);
  if (typeof reason !== "string") return reason;

  if (method === "PUT" && seg[0] === "underlyings") {
    const i = s.underlyings.findIndex((x) => x.symbol === seg[1]);
    if (i < 0) return err(404, "not_found", "Underlying not found.");
    const { reason: _r, ...patch } = b;
    const next: Record<string, unknown> = { ...s.underlyings[i]!, ...patch, updatedAt: new Date().toISOString(), updatedBy: ME };
    if (!/^\d{2}:\d{2}$/.test(String(next.cutTime))) return bad("cutTime must be HH:MM and cutZone one of America/New_York, Europe/London, Asia/Tokyo, UTC.");
    if ((next.noOpenMinutes as number) < (next.closeOnlyMinutes as number)) return bad("noOpenMinutes must be at least closeOnlyMinutes.");
    if ((next.minContracts as number) > (next.maxContracts as number)) return bad("minContracts must not exceed maxContracts.");
    if (!(next.expiryKinds as string[]).length) return bad("expiryKinds must be daily, weekly and/or monthly.");
    audit("underlying.update", seg[1]!, reason, s.underlyings[i], next);
    s.underlyings[i] = next;
    return ok({ underlying: next, version: bump() });
  }
  if (method === "PUT" && seg[0] === "rates") {
    const ccy = seg[1]!.toUpperCase();
    const rate = Number(b.rate);
    if (!(Number.isFinite(rate) && rate > -0.2 && rate < 0.5)) return bad("rate is a decimal (0.0425 = 4.25%) between -0.2 and 0.5.");
    const prev = s.rates[ccy];
    const asOf = typeof b.asOf === "string" && b.asOf ? b.asOf : dayStr(Date.now());
    s.rates[ccy] = { ccy, rate, kind: (b.kind as string) || prev?.kind || (["XAU", "XAG"].includes(ccy) ? "lease" : "policy"), source: (b.source as string) ?? prev?.source ?? "", asOf, updatedAt: new Date().toISOString(), updatedBy: ME };
    (s.rateHistory[ccy] ??= []).unshift({ rate, prevRate: prev?.rate ?? null, asOf, reason, changedBy: ME, changedAt: new Date().toISOString() });
    audit("rate.update", ccy, reason, prev ?? null, { rate, asOf });
    return ok({ rate: s.rates[ccy], version: bump() });
  }
  if (seg[0] === "holidays" && (method === "PUT" || method === "DELETE")) {
    const cal = seg[1]!.toUpperCase();
    const day = seg[2]!;
    const h = s.holidays.find((x) => x.calendar === cal && x.day === day);
    if (method === "DELETE") {
      if (!h || !h.active) return err(404, "not_found", "Active holiday not found.");
      h.active = false;
      h.updatedAt = new Date().toISOString();
      h.updatedBy = ME;
      audit("holiday.disable", `${cal}:${day}`, reason, null, null);
      return ok({ ok: true, version: bump() });
    }
    const name = String(b.name ?? "").trim();
    if (!name) return bad("Name is required.");
    const before = h ? { name: h.name, active: h.active, source: h.source } : null;
    if (h) Object.assign(h, { name, active: b.active !== false, updatedAt: new Date().toISOString(), updatedBy: ME });
    else s.holidays.push({ calendar: cal, day, name, source: "admin", active: b.active !== false, updatedAt: new Date().toISOString(), updatedBy: ME });
    audit("holiday.upsert", `${cal}:${day}`, reason, before, { name, active: b.active !== false });
    return ok({ ok: true, version: bump() });
  }
  if (method === "POST" && seg[0] === "surfaces") {
    const sym = seg[1]!.toUpperCase();
    const list = s.surfaces[sym];
    if (!list) return err(404, "not_found", "Underlying not found.");
    const pillars = (Array.isArray(b.pillars) ? b.pillars : []) as Pillar[];
    const problem = checkSurface(pillars);
    if (problem) return bad(problem);
    const blend = typeof b.blendWeight === "number" ? b.blendWeight : list[0]!.blendWeight;
    if (!(blend >= 0 && blend <= 1)) return bad("blendWeight must be between 0 and 1.");
    const next: Surface = { symbol: sym, version: list[0]!.version + 1, blendWeight: blend, pillars: [...pillars].sort((x, y) => x.days - y.days), reason, publishedBy: ME, publishedAt: new Date().toISOString() };
    list.unshift(next);
    audit("surface.publish", sym, reason, { version: next.version - 1 }, { version: next.version, blendWeight: blend });
    return ok({ symbol: sym, version: next.version, snapshotVersion: bump() });
  }
  if (method === "PUT" && seg[0] === "tenants") {
    const t = seg[1]!;
    const cur = s.tenants[t] ?? { tenant: t, enabledDemo: false, enabledLive: false, publicChain: false, underlyings: null, updatedAt: iso(0), updatedBy: "" };
    const unders = Array.isArray(b.underlyings) ? ((b.underlyings as string[]).length ? (b.underlyings as string[]) : null) : cur.underlyings;
    const next = { tenant: t, enabledDemo: typeof b.enabledDemo === "boolean" ? b.enabledDemo : cur.enabledDemo, enabledLive: typeof b.enabledLive === "boolean" ? b.enabledLive : cur.enabledLive, publicChain: typeof b.publicChain === "boolean" ? b.publicChain : cur.publicChain, underlyings: unders, updatedAt: new Date().toISOString(), updatedBy: ME };
    s.tenants[t] = next;
    audit("tenant.update", t, reason, cur, next);
    return ok({ tenant: next, version: bump() });
  }
  if (seg[0] === "groups" && (method === "PUT" || method === "DELETE")) {
    const [group, symbol] = [seg[1]!, seg[2]!.toUpperCase()];
    const i = s.groups.findIndex((g) => g.groupCode === group && g.symbol === symbol);
    if (method === "DELETE") {
      if (group === "*" && symbol === "*") return bad("The tenant default row can be edited but not deleted.");
      if (i < 0) return err(404, "not_found", "Group settings not found.");
      s.groups.splice(i, 1);
      audit("group.delete", `${group}/${symbol}`, reason, null, null);
      return ok({ ok: true, version: bump() });
    }
    const base = i >= 0 ? s.groups[i]! : s.groups.find((g) => g.groupCode === "*" && g.symbol === "*")!;
    const { reason: _r, ...patch } = b;
    const next: Record<string, unknown> = { ...base, ...patch, tenant: "kalks", groupCode: group, symbol, updatedAt: new Date().toISOString(), updatedBy: ME };
    if ((next.volSpread as number) < 0 || (next.volSpread as number) > 0.2) return bad("Value out of range (group_settings_vol_spread_check).");
    if ((next.commissionCapPct as number) < 0 || (next.commissionCapPct as number) > 100) return bad("Value out of range (group_settings_commission_cap_pct_check).");
    if (i >= 0) s.groups[i] = next;
    else s.groups.push(next);
    audit("group.upsert", `${group}/${symbol}`, reason, i >= 0 ? base : null, next);
    return ok({ group: next, version: bump() });
  }
  if (method === "POST" && p === "controls") {
    const scope = String(b.scope ?? "");
    const mode = String(b.mode ?? "");
    const target = String(b.target ?? "*");
    if (!["all", "underlying", "expiry", "series"].includes(scope)) return bad("scope must be all, underlying, expiry or series.");
    if (!["halt", "close_only", "freeze", "manual_vol"].includes(mode)) return bad("mode must be halt, close_only, freeze or manual_vol.");
    if ((mode === "freeze" || mode === "manual_vol") && (scope === "all" || scope === "series")) return bad(`${mode} applies to an underlying or an expiry.`);
    if (mode === "manual_vol" && !(Number(b.manualVol) > 0.001 && Number(b.manualVol) < 5)) return bad("manualVol is a decimal ATM vol (0.09 = 9%).");
    if (b.expiresAt && Date.parse(String(b.expiresAt)) <= Date.now()) return bad("expiresAt must be in the future.");
    const sym = scope === "underlying" ? target : scope === "expiry" ? target.split(":")[0]! : target.split("-")[0]!;
    const frozen = mode === "freeze" ? (typeof b.frozenSpot === "number" ? b.frozenSpot : spotOf(sym).mid) : null;
    const id = Math.max(...s.controls.map((c) => c.id as number)) + 1;
    const c = { id, tenant: (b.tenant as string) || "kalks", scope, target, mode, manualVol: mode === "manual_vol" ? Number(b.manualVol) : null, frozenSpot: frozen, reason, active: true, expiresAt: (b.expiresAt as string) || null, createdBy: ME, createdAt: new Date().toISOString(), clearedBy: null, clearedAt: null, clearReason: null };
    s.controls.unshift(c);
    audit("control.add", `${scope}:${target}`, reason, null, c);
    return ok({ control: c, version: bump() });
  }
  if (method === "DELETE" && seg[0] === "controls") {
    const c = s.controls.find((x) => String(x.id) === seg[1] && x.active);
    if (!c) return err(404, "not_found", "Active control not found.");
    Object.assign(c, { active: false, clearedBy: ME, clearedAt: new Date().toISOString(), clearReason: reason });
    audit("control.clear", seg[1]!, reason, null, null);
    return ok({ ok: true, version: bump() });
  }
  if (seg[0] === "limits" && (method === "PUT" || method === "DELETE")) {
    const userId = Number(seg[1]);
    const i = s.limits.findIndex((l) => l.userId === userId);
    if (method === "DELETE") {
      if (i < 0) return err(404, "not_found", "Client limit not found.");
      s.limits.splice(i, 1);
      audit("limit.delete", String(userId), reason, null, null);
      return ok({ ok: true, version: bump() });
    }
    const cur = i >= 0 ? s.limits[i]! : null;
    const pick = (k: string) => (k in b ? b[k] : (cur?.[k] ?? null));
    const next = { tenant: "kalks", userId, maxContracts: pick("maxContracts"), maxShortContracts: pick("maxShortContracts"), closeOnly: !!pick("closeOnly"), blocked: !!pick("blocked"), reason, updatedAt: new Date().toISOString(), updatedBy: ME };
    if (i >= 0) s.limits[i] = next;
    else s.limits.unshift(next);
    audit("limit.upsert", String(userId), reason, cur, next);
    return ok({ limit: next, version: bump() });
  }
  if (method === "POST" && seg[0] === "expiries" && seg[2] === "refix") {
    const e = s.expiries.find((x) => String(x.id) === seg[1]);
    if (!e) return err(404, "not_found", "Expiry not found.");
    if (e.status !== "fixed") return bad("Only a fixed expiry can be re-fixed.");
    if (e.firstFixedAt && Date.now() - Date.parse(e.firstFixedAt) > HOUR) return bad("The re-fixing window (1 hour after the first fixing) has closed.");
    const before = { price: e.fixing, run: e.run };
    if (typeof b.price === "number") {
      if (!(b.price > 0)) return bad("price must be positive.");
      Object.assign(e, { fixing: b.price, source: "manual", run: e.run + 1, fixedAt: new Date().toISOString(), samples: 0, expected: 0, coverage: 0, maxGapMs: 0 });
      audit("fixing.manual", `${e.symbol}:${e.date}`, reason, before, { price: e.fixing, run: e.run });
    } else {
      Object.assign(e, { fixing: r4((e.fixing ?? 0) * (1 + 0.00004), UNDERLYINGS.find((x) => x.symbol === e.symbol)!.digits), source: (e.coverage ?? 1) < 0.5 ? "m1_fallback" : "twap", run: e.run + 1, fixedAt: new Date().toISOString() });
      audit("fixing.recompute", `${e.symbol}:${e.date}`, reason, before, { price: e.fixing, run: e.run });
    }
    bump();
    return ok({ expiry: e });
  }
  return err(404, "not_found", "Not found.");
}
