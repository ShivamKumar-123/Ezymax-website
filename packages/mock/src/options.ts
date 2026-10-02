// Kalks FX Options: client-side pricer and the options-service wire shapes.
//
// A TypeScript port of crates/optmath (generalized Black-Scholes-Merton with cost of carry, Haug ch. 1) and of
// the chain conventions of services/options/src/pricing.rs (smile from ATM + 25-delta RR/BF, vol spread, minimum
// USD spread, Greeks units). Used by:
//   * demo builds (NEXT_PUBLIC_KALKS_MODE=demo): a complete mock chain, so the options workspace works without
//     the options service or the trading engine;
//   * every build: the strategy builder's "today" payoff curve and the payoff maths.
// Pure: no React, no browser APIs. Numbers are close to the service's, not identical (the service blends realized
// vol, uses holiday calendars and a business-time vol clock with holiday weights).

export type OptionRight = "call" | "put";
export type OptionModel = "gk" | "bs" | "black76";
export type ExpiryKind = "daily" | "weekly" | "monthly";
/** Dealing state of a series: `close_only` in the last minutes before the cut, `closed` after it. */
export type OptionTradeState = "open" | "close_only" | "halted" | "closed";

/* ------------------------------------------------------------------ */
/* Wire shapes (services/options/README.md, "Client (BFFs)")          */
/* ------------------------------------------------------------------ */

export interface OptionUnderlying {
  symbol: string;
  name: string;
  assetClass: "forex" | "metals" | "energies" | string;
  model: OptionModel | string;
  baseCcy: string;
  quoteCcy: string;
  contractSize: number;
  contractUnit: string;
  digits: number;
  pipSize: number;
  strikeStep: number;
  cut: { time: string; zone: string };
  twapMinutes: number;
  noOpenMinutes: number;
  closeOnlyMinutes: number;
  minContracts: number;
  maxContracts: number;
  contractStep: number;
  barriers: boolean;
  expiryKinds: ExpiryKind[];
  nextExpiry: { date: string; cutAt: string } | null;
  atmVol: number | null;
  realizedVol: number | null;
}

export interface OptionExpiry {
  id: number;
  date: string;
  kinds: ExpiryKind[];
  cutAt: string;
  twapStart: string;
  status: string;
  state: OptionTradeState;
  series: number;
  secondsToCut: number;
}

export interface OptionQuote {
  code: string;
  /** premium per unit of the underlying, in the quote currency */
  bid: number;
  ask: number;
  mark: number;
  /** premium per contract, USD */
  bidUsd: number;
  askUsd: number;
  markUsd: number;
  /** mark in pips / points */
  markPips: number;
  iv: number;
  ivBid: number;
  ivAsk: number;
  delta: number;
  /** delta change per 1 % spot move */
  gamma: number;
  /** USD per contract per vol point */
  vega: number;
  /** USD per contract over the next calendar day */
  theta: number;
  probItm: number;
  breakeven: number;
  state: OptionTradeState;
  /** our own book (later milestones): open interest and today's volume in contracts, last traded premium */
  oi?: number | null;
  volume?: number | null;
  ltp?: number | null;
  change?: number | null;
}

export interface OptionChainRow {
  strike: number;
  strikeLabel: string;
  call: OptionQuote | null;
  put: OptionQuote | null;
}

export interface OptionChain {
  underlying: string;
  name: string;
  model: string;
  expiry: string;
  kinds: ExpiryKind[];
  cutAt: string;
  cut: { time: string; zone: string };
  twapStart: string;
  status: string;
  state: OptionTradeState;
  contractSize: number;
  contractUnit: string;
  quoteCcy: string;
  digits: number;
  pipSize: number;
  group?: string;
  volSpread: number;
  minSpreadUsd: number;
  commission: { perContract: number; capPct: number };
  spot: { bid: number; ask: number; mid: number; t: number; ageMs: number } | null;
  fixing: { price: number; source: string | null; run: number } | null;
  version: number;
  atmStrike?: number;
  error?: { code: string; message?: string };
  /** public chain only: the open expiries of the underlying */
  expiries?: { date: string; kinds: ExpiryKind[]; cutAt: string }[];
  rows: OptionChainRow[];
}

/* ------------------------------------------------------------------ */
/* Reference data (services/options/src/seed.rs)                       */
/* ------------------------------------------------------------------ */

export interface OptionUnderlyingSpec {
  symbol: string;
  name: string;
  assetClass: "forex" | "metals" | "energies";
  model: OptionModel;
  baseCcy: string;
  quoteCcy: string;
  contractSize: number;
  contractUnit: string;
  digits: number;
  pipSize: number;
  strikeStep: number;
  /** price / vol scan of the scenario margin grid */
  priceScan: number;
  volScan: number;
  /** seeded disabled (no market-data feed yet) */
  enabled: boolean;
  /** ATM vols ON, 1W, 2W, 1M, 2M, 3M */
  atm: [number, number, number, number, number, number];
  /** RR25, BF25, RR10, BF10 */
  skew: [number, number, number, number];
}

const FX = "forex" as const;

export const OPTION_UNDERLYINGS: OptionUnderlyingSpec[] = [
  { symbol: "EURUSD", name: "Euro / US Dollar", assetClass: FX, model: "gk", baseCcy: "EUR", quoteCcy: "USD", contractSize: 10_000, contractUnit: "EUR", digits: 5, pipSize: 0.0001, strikeStep: 0.0025, priceScan: 0.03, volScan: 0.03, enabled: true, atm: [0.062, 0.066, 0.068, 0.07, 0.072, 0.073], skew: [0.002, 0.0015, 0.004, 0.005] },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", assetClass: FX, model: "gk", baseCcy: "GBP", quoteCcy: "USD", contractSize: 10_000, contractUnit: "GBP", digits: 5, pipSize: 0.0001, strikeStep: 0.0025, priceScan: 0.03, volScan: 0.03, enabled: true, atm: [0.068, 0.072, 0.074, 0.076, 0.078, 0.079], skew: [-0.003, 0.0018, -0.006, 0.006] },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", assetClass: FX, model: "gk", baseCcy: "USD", quoteCcy: "JPY", contractSize: 10_000, contractUnit: "USD", digits: 3, pipSize: 0.01, strikeStep: 0.5, priceScan: 0.04, volScan: 0.035, enabled: true, atm: [0.095, 0.098, 0.1, 0.102, 0.104, 0.105], skew: [-0.01, 0.003, -0.02, 0.011] },
  { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", assetClass: FX, model: "gk", baseCcy: "AUD", quoteCcy: "USD", contractSize: 10_000, contractUnit: "AUD", digits: 5, pipSize: 0.0001, strikeStep: 0.0025, priceScan: 0.035, volScan: 0.035, enabled: true, atm: [0.082, 0.086, 0.088, 0.09, 0.092, 0.093], skew: [-0.008, 0.0025, -0.015, 0.009] },
  { symbol: "USDCAD", name: "US Dollar / Canadian Dollar", assetClass: FX, model: "gk", baseCcy: "USD", quoteCcy: "CAD", contractSize: 10_000, contractUnit: "USD", digits: 5, pipSize: 0.0001, strikeStep: 0.0025, priceScan: 0.025, volScan: 0.03, enabled: true, atm: [0.05, 0.053, 0.055, 0.056, 0.058, 0.059], skew: [0.004, 0.0015, 0.008, 0.005] },
  { symbol: "USDCHF", name: "US Dollar / Swiss Franc", assetClass: FX, model: "gk", baseCcy: "USD", quoteCcy: "CHF", contractSize: 10_000, contractUnit: "USD", digits: 5, pipSize: 0.0001, strikeStep: 0.0025, priceScan: 0.035, volScan: 0.035, enabled: true, atm: [0.068, 0.071, 0.073, 0.075, 0.077, 0.078], skew: [-0.004, 0.002, -0.008, 0.007] },
  { symbol: "NZDUSD", name: "New Zealand Dollar / US Dollar", assetClass: FX, model: "gk", baseCcy: "NZD", quoteCcy: "USD", contractSize: 10_000, contractUnit: "NZD", digits: 5, pipSize: 0.0001, strikeStep: 0.0025, priceScan: 0.035, volScan: 0.035, enabled: false, atm: [0.088, 0.091, 0.093, 0.095, 0.097, 0.098], skew: [-0.008, 0.0025, -0.015, 0.009] },
  { symbol: "EURJPY", name: "Euro / Japanese Yen", assetClass: FX, model: "gk", baseCcy: "EUR", quoteCcy: "JPY", contractSize: 10_000, contractUnit: "EUR", digits: 3, pipSize: 0.01, strikeStep: 0.5, priceScan: 0.04, volScan: 0.035, enabled: true, atm: [0.088, 0.092, 0.094, 0.096, 0.098, 0.099], skew: [-0.012, 0.003, -0.024, 0.012] },
  { symbol: "GBPJPY", name: "British Pound / Japanese Yen", assetClass: FX, model: "gk", baseCcy: "GBP", quoteCcy: "JPY", contractSize: 10_000, contractUnit: "GBP", digits: 3, pipSize: 0.01, strikeStep: 0.5, priceScan: 0.045, volScan: 0.04, enabled: true, atm: [0.098, 0.102, 0.104, 0.106, 0.108, 0.109], skew: [-0.014, 0.0035, -0.027, 0.013] },
  { symbol: "XAUUSD", name: "Gold / US Dollar", assetClass: "metals", model: "bs", baseCcy: "XAU", quoteCcy: "USD", contractSize: 1, contractUnit: "oz", digits: 2, pipSize: 0.01, strikeStep: 25, priceScan: 0.05, volScan: 0.05, enabled: true, atm: [0.17, 0.18, 0.185, 0.19, 0.195, 0.2], skew: [0.015, 0.004, 0.03, 0.015] },
  { symbol: "XAGUSD", name: "Silver / US Dollar", assetClass: "metals", model: "bs", baseCcy: "XAG", quoteCcy: "USD", contractSize: 50, contractUnit: "oz", digits: 3, pipSize: 0.001, strikeStep: 0.5, priceScan: 0.08, volScan: 0.06, enabled: true, atm: [0.28, 0.3, 0.31, 0.32, 0.325, 0.33], skew: [0.02, 0.008, 0.04, 0.025] },
  { symbol: "USOIL", name: "WTI Crude Oil", assetClass: "energies", model: "black76", baseCcy: "OIL", quoteCcy: "USD", contractSize: 10, contractUnit: "bbl", digits: 2, pipSize: 0.01, strikeStep: 0.5, priceScan: 0.1, volScan: 0.08, enabled: true, atm: [0.3, 0.32, 0.33, 0.34, 0.345, 0.35], skew: [-0.01, 0.008, -0.02, 0.025] },
  { symbol: "UKOIL", name: "Brent Crude Oil", assetClass: "energies", model: "black76", baseCcy: "OIL", quoteCcy: "USD", contractSize: 10, contractUnit: "bbl", digits: 2, pipSize: 0.01, strikeStep: 0.5, priceScan: 0.1, volScan: 0.08, enabled: true, atm: [0.28, 0.3, 0.31, 0.32, 0.325, 0.33], skew: [-0.01, 0.008, -0.02, 0.025] },
];

export const OPTION_SPEC: Record<string, OptionUnderlyingSpec> = Object.fromEntries(OPTION_UNDERLYINGS.map((u) => [u.symbol, u]));

/** Annual decimals per currency: policy rates, metal lease rates (seed values, approximate). */
export const OPTION_RATES: Record<string, number> = { USD: 0.03625, EUR: 0.02, GBP: 0.0375, JPY: 0.0075, CHF: 0, CAD: 0.0225, AUD: 0.036, NZD: 0.0225, XAU: 0.005, XAG: 0.01 };

/** Pillar tenors in days (ON, 1W, 2W, 1M, 2M, 3M); the skew is scaled down at the short end. */
const TENOR_DAYS = [1, 7, 14, 30, 61, 91];
const SKEW_SCALE = [0.8, 0.9, 0.95, 1, 1, 1];

/** Group defaults (`*` row of group_settings). */
export const OPTION_DEFAULTS = { volSpread: 0.004, minSpreadUsd: 0.5, commissionPerContract: 0.25, commissionCapPct: 10, minContracts: 1, maxContracts: 100, contractStep: 1, noOpenMinutes: 15, closeOnlyMinutes: 1, twapMinutes: 30 };

/* ------------------------------------------------------------------ */
/* Normal distribution (West 2005: double-precision Cody-like CDF)     */
/* ------------------------------------------------------------------ */

export function normPdf(x: number): number {
  return 0.3989422804014327 * Math.exp(-0.5 * x * x);
}

export function normCdf(x: number): number {
  const z = Math.abs(x);
  let c: number;
  if (z > 37) c = 0;
  else {
    const e = Math.exp(-0.5 * z * z);
    if (z < 7.07106781186547) {
      let n = 0.0352624965998911 * z + 0.700383064443688;
      n = n * z + 6.37396220353165;
      n = n * z + 33.912866078383;
      n = n * z + 112.079291497871;
      n = n * z + 221.213596169931;
      n = n * z + 220.206867912376;
      let d = 0.0883883476483184 * z + 1.75566716318264;
      d = d * z + 16.064177579207;
      d = d * z + 86.7807322029461;
      d = d * z + 296.564248779674;
      d = d * z + 637.333633378831;
      d = d * z + 793.826512519948;
      d = d * z + 440.413735824752;
      c = (e * n) / d;
    } else {
      let b = z + 0.65;
      b = z + 4 / b;
      b = z + 3 / b;
      b = z + 2 / b;
      b = z + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

/* ------------------------------------------------------------------ */
/* Generalized BSM with cost of carry (crates/optmath/src/bsm.rs)      */
/* ------------------------------------------------------------------ */

export interface Greeks {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  /** -dV/dT per year */
  theta: number;
}

const sign = (k: OptionRight) => (k === "call" ? 1 : -1);

/** Price of a European option: `s` spot (forward for b = 0), `k` strike, `t` years, `r` rate, `b` carry, `sigma` vol. */
export function bsmPrice(kind: OptionRight, s: number, k: number, t: number, r: number, b: number, sigma: number): number {
  if (!(s > 0 && k > 0 && t >= 0 && sigma >= 0)) return NaN;
  const w = sign(kind);
  const carry = Math.exp((b - r) * t);
  const df = Math.exp(-r * t);
  if (t === 0 || sigma === 0) return Math.max(0, w * (s * carry - k * df));
  const v = sigma * Math.sqrt(t);
  const d1 = (Math.log(s / k) + (b + 0.5 * sigma * sigma) * t) / v;
  const d2 = d1 - v;
  return w * (s * carry * normCdf(w * d1) - k * df * normCdf(w * d2));
}

export function bsmGreeks(kind: OptionRight, s: number, k: number, t: number, r: number, b: number, sigma: number): Greeks {
  const w = sign(kind);
  const carry = Math.exp((b - r) * t);
  const df = Math.exp(-r * t);
  if (!(s > 0 && k > 0) || t <= 0 || sigma <= 0) {
    const intrinsic = w * (s * carry - k * df);
    return { price: Math.max(0, intrinsic), delta: intrinsic > 0 ? w * carry : 0, gamma: 0, vega: 0, theta: 0 };
  }
  const sq = Math.sqrt(t);
  const v = sigma * sq;
  const d1 = (Math.log(s / k) + (b + 0.5 * sigma * sigma) * t) / v;
  const d2 = d1 - v;
  const nd1 = normCdf(w * d1);
  const nd2 = normCdf(w * d2);
  const pdf1 = normPdf(d1);
  const fwdPv = s * carry;
  const strikePv = k * df;
  return {
    price: w * (fwdPv * nd1 - strikePv * nd2),
    delta: w * carry * nd1,
    gamma: (carry * pdf1) / (s * v),
    vega: fwdPv * pdf1 * sq,
    theta: (-fwdPv * pdf1 * sigma) / (2 * sq) - w * (b - r) * fwdPv * nd1 - w * r * strikePv * nd2,
  };
}

/** Carry of an underlying: GK `b = r_quote − r_base`, BS the same with the metal lease rate, Black-76 `b = 0`. */
export function carryOf(spec: Pick<OptionUnderlyingSpec, "model" | "baseCcy" | "quoteCcy">): { r: number; b: number } {
  const r = OPTION_RATES[spec.quoteCcy] ?? OPTION_RATES.USD!;
  if (spec.model === "black76") return { r, b: 0 };
  return { r, b: r - (OPTION_RATES[spec.baseCcy] ?? 0) };
}

/* ------------------------------------------------------------------ */
/* Smile + term structure                                              */
/* ------------------------------------------------------------------ */

export interface SmileQuotes {
  atm: number;
  rr25: number;
  bf25: number;
}

/** ATM / RR25 / BF25 at `days`: ATM interpolated in total variance, the skew linearly; flat beyond the pillars. */
export function quotesAt(spec: OptionUnderlyingSpec, days: number): SmileQuotes {
  const d = Math.max(days, 1 / 24);
  const pts = TENOR_DAYS.map((td, i) => ({ td, atm: spec.atm[i]!, rr: spec.skew[0] * SKEW_SCALE[i]!, bf: spec.skew[1] * SKEW_SCALE[i]! }));
  if (d <= pts[0]!.td) return { atm: pts[0]!.atm, rr25: pts[0]!.rr, bf25: pts[0]!.bf };
  const last = pts[pts.length - 1]!;
  if (d >= last.td) return { atm: last.atm, rr25: last.rr, bf25: last.bf };
  let i = 1;
  while (pts[i]!.td < d) i++;
  const a = pts[i - 1]!;
  const b = pts[i]!;
  const k = (d - a.td) / (b.td - a.td);
  const va = a.atm * a.atm * a.td;
  const vb = b.atm * b.atm * b.td;
  return { atm: Math.sqrt((va + (vb - va) * k) / d), rr25: a.rr + (b.rr - a.rr) * k, bf25: a.bf + (b.bf - a.bf) * k };
}

/** Vol at a call delta (Malz): σ(Δ) = ATM − 2·RR·(Δ − ½) + 16·BF·(Δ − ½)². */
export function smileAtDelta(q: SmileQuotes, callDelta: number): number {
  const x = Math.min(0.99, Math.max(0.01, callDelta)) - 0.5;
  return Math.max(0.01, q.atm - 2 * q.rr25 * x + 16 * q.bf25 * x * x);
}

/* ------------------------------------------------------------------ */
/* Pricing context                                                     */
/* ------------------------------------------------------------------ */

const YEAR_MS = 365 * 86_400_000;
const WEEKEND_WEIGHT = 0.15;
const AVG_WEIGHT = (5 + 2 * WEEKEND_WEIGHT) / 7;

/** Business-time years to the cut: weekend hours count 15 %, normalised so a full week equals a calendar week. */
export function volYears(nowMs: number, cutMs: number): number {
  if (cutMs <= nowMs) return 0;
  const HOUR = 3_600_000;
  let w = 0;
  let t = nowMs;
  while (t < cutMs) {
    const step = Math.min(HOUR, cutMs - t);
    const day = new Date(t).getUTCDay();
    w += (step / HOUR) * (day === 0 || day === 6 ? WEEKEND_WEIGHT : 1);
    t += step;
  }
  return (w / 24 / AVG_WEIGHT) / 365;
}

export interface PricingContext {
  spec: OptionUnderlyingSpec;
  spot: number;
  tCal: number;
  tVol: number;
  /** same clock, one calendar day later (theta) */
  tCal1d: number;
  tVol1d: number;
  r: number;
  b: number;
  quotes: SmileQuotes;
  usdPerQuote: number;
  /** usdPerQuote × contractSize: premium per unit → USD per contract */
  usdPerUnit: number;
}

export function pricingContext(spec: OptionUnderlyingSpec, spot: number, cutAtMs: number, nowMs: number, usdPerQuote: number): PricingContext {
  const { r, b } = carryOf(spec);
  const tCal = Math.max(0, (cutAtMs - nowMs) / YEAR_MS);
  const tVol = volYears(nowMs, cutAtMs);
  const later = nowMs + 86_400_000;
  return {
    spec,
    spot,
    tCal,
    tVol,
    tCal1d: Math.max(0, (cutAtMs - later) / YEAR_MS),
    tVol1d: volYears(later, cutAtMs),
    r,
    b,
    quotes: quotesAt(spec, (cutAtMs - nowMs) / 86_400_000),
    usdPerQuote,
    usdPerUnit: usdPerQuote * spec.contractSize,
  };
}

/** The effective vol on the calendar clock for a business-time vol. */
export const effectiveVol = (sigma: number, tVol: number, tCal: number) => (tCal <= 0 || tVol <= 0 ? 0 : sigma * Math.sqrt(tVol / tCal));

/** Smile vol at a strike: a fixed point on the call delta (three iterations are plenty). */
export function volAtStrike(ctx: PricingContext, k: number): number {
  let sigma = ctx.quotes.atm;
  if (ctx.tVol <= 0) return sigma;
  for (let i = 0; i < 3; i++) {
    const v = sigma * Math.sqrt(ctx.tVol);
    const d1 = (Math.log(ctx.spot / k) + (ctx.b + 0.5 * sigma * sigma) * ctx.tVol) / v;
    sigma = smileAtDelta(ctx.quotes, Math.exp((ctx.b - ctx.r) * ctx.tVol) * normCdf(d1));
  }
  return sigma;
}

/** ATM strike: the forward. */
export const forwardOf = (ctx: Pick<PricingContext, "spot" | "b" | "tCal">) => ctx.spot * Math.exp(ctx.b * ctx.tCal);

/** Model value per unit of a leg at spot `s`, `tCal` years before the cut, with vol `sigma` (business-time adjusted). */
export function legValue(kind: OptionRight, s: number, k: number, tCal: number, tVol: number, r: number, b: number, sigma: number): number {
  if (tCal <= 0 || tVol <= 0) return Math.max(0, sign(kind) * (s - k));
  return bsmPrice(kind, s, k, tCal, r, b, effectiveVol(sigma, tVol, tCal));
}

/* ------------------------------------------------------------------ */
/* Quotes and chains in the service's shape                            */
/* ------------------------------------------------------------------ */

const roundTo = (x: number, d: number) => {
  if (!Number.isFinite(x)) return 0;
  const p = 10 ** d;
  return Math.round(x * p) / p;
};
const sigRound = (x: number, digits: number) => {
  if (x === 0 || !Number.isFinite(x)) return 0;
  const mag = Math.floor(Math.log10(Math.abs(x)));
  return roundTo(x, Math.min(12, Math.max(0, digits - 1 - mag)));
};

export function quoteSeries(ctx: PricingContext, kind: OptionRight, k: number, code: string, state: OptionTradeState, group = { volSpread: OPTION_DEFAULTS.volSpread, minSpreadUsd: OPTION_DEFAULTS.minSpreadUsd }): OptionQuote {
  const { spec } = ctx;
  const sig = volAtStrike(ctx, k);
  const alive = ctx.tVol > 0 && ctx.tCal > 0;
  const intrinsic = Math.max(0, sign(kind) * (ctx.spot - k));
  const mark = alive ? bsmPrice(kind, ctx.spot, k, ctx.tCal, ctx.r, ctx.b, effectiveVol(sig, ctx.tVol, ctx.tCal)) : intrinsic;
  const usd = ctx.usdPerUnit;
  const minUnit = usd > 0 ? group.minSpreadUsd / usd : 0;
  let bid = mark;
  let ask = mark;
  let ivBid = sig;
  let ivAsk = sig;
  if (alive) {
    const kf = Math.sqrt(ctx.tVol / ctx.tCal);
    ivBid = Math.max(0.001, 0.25 * sig, sig - group.volSpread);
    ivAsk = sig + group.volSpread;
    bid = bsmPrice(kind, ctx.spot, k, ctx.tCal, ctx.r, ctx.b, ivBid * kf);
    ask = bsmPrice(kind, ctx.spot, k, ctx.tCal, ctx.r, ctx.b, ivAsk * kf);
    if (ask - bid < minUnit) {
      bid = mark - 0.5 * minUnit;
      ask = mark + 0.5 * minUnit;
    }
  }
  if (bid < 0) {
    bid = 0;
    ask = Math.max(ask, minUnit);
  }
  let delta: number;
  let gamma = 0;
  let vega = 0;
  let probItm: number;
  if (alive) {
    const kf = Math.sqrt(ctx.tVol / ctx.tCal);
    const se = sig * kf;
    const g = bsmGreeks(kind, ctx.spot, k, ctx.tCal, ctx.r, ctx.b, se);
    const d2 = (Math.log(ctx.spot / k) + (ctx.b - 0.5 * se * se) * ctx.tCal) / (se * Math.sqrt(ctx.tCal));
    delta = g.delta;
    gamma = g.gamma * ctx.spot * 0.01;
    vega = g.vega * kf * 0.01 * usd;
    probItm = normCdf(sign(kind) * d2);
  } else {
    delta = intrinsic > 0 ? sign(kind) : 0;
    probItm = intrinsic > 0 ? 1 : 0;
  }
  const tomorrow = legValue(kind, ctx.spot, k, ctx.tCal1d, ctx.tVol1d, ctx.r, ctx.b, sig);
  const pd = spec.digits + 2;
  return {
    code,
    bid: roundTo(bid, pd),
    ask: roundTo(ask, pd),
    mark: roundTo(mark, pd),
    bidUsd: roundTo(bid * usd, 2),
    askUsd: roundTo(ask * usd, 2),
    markUsd: roundTo(mark * usd, 2),
    markPips: roundTo(mark / spec.pipSize, 1),
    iv: roundTo(sig, 5),
    ivBid: roundTo(ivBid, 5),
    ivAsk: roundTo(ivAsk, 5),
    delta: roundTo(delta, 4),
    gamma: sigRound(gamma, 4),
    vega: roundTo(vega, 2),
    theta: roundTo((tomorrow - mark) * usd, 2),
    probItm: roundTo(probItm, 4),
    breakeven: roundTo(kind === "call" ? k + ask : k - ask, spec.digits),
    state,
  };
}

/* ------------------------------------------------------------------ */
/* Series codes, strikes, expiries                                     */
/* ------------------------------------------------------------------ */

/** Decimals of a strike step (0.0025 → 4, 0.5 → 1, 25 → 0). */
export function stepDecimals(step: number): number {
  for (let d = 0; d <= 8; d++) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-9) return d;
  return 8;
}

export const strikeLabel = (strike: number, step: number) => strike.toFixed(stepDecimals(step));

/** `EURUSD-20261009-1.1650-C` */
export function seriesCode(symbol: string, date: string, strike: number, right: OptionRight, step: number): string {
  return `${symbol}-${date.replace(/-/g, "")}-${strikeLabel(strike, step)}-${right === "call" ? "C" : "P"}`;
}

/** `EURUSD-20261009-1.1650-C` → parts (null for anything else). */
export function parseSeriesCode(code: string): { underlying: string; date: string; strike: number; strikeLabel: string; right: OptionRight } | null {
  const m = /^([A-Z0-9]{3,12})-(\d{4})(\d{2})(\d{2})-([0-9]+(?:\.[0-9]+)?)-([CP])$/.exec(code);
  if (!m) return null;
  return { underlying: m[1]!, date: `${m[2]}-${m[3]}-${m[4]}`, strike: Number(m[5]), strikeLabel: m[5]!, right: m[6] === "C" ? "call" : "put" };
}

/** New York UTC offset in minutes at a UTC instant (US DST: 2nd Sunday of March 07:00 UTC → 1st Sunday of November 06:00 UTC). */
export function newYorkOffset(ms: number): number {
  const y = new Date(ms).getUTCFullYear();
  const nthSunday = (month: number, n: number) => {
    const d = new Date(Date.UTC(y, month, 1));
    const first = (7 - d.getUTCDay()) % 7;
    return Date.UTC(y, month, 1 + first + (n - 1) * 7);
  };
  const start = nthSunday(2, 2) + 7 * 3_600_000;
  const end = nthSunday(10, 1) + 6 * 3_600_000;
  return ms >= start && ms < end ? -240 : -300;
}

/** 10:00 New York on `date` (YYYY-MM-DD) as a UTC instant. */
export function cutInstant(date: string, hh = 10, mm = 0): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return guess - newYorkOffset(guess + 5 * 3_600_000) * 60_000;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const ymd = (ms: number) => {
  const d = new Date(ms);
  return iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/** Open expiries (daily: next 5 business days, weekly: next 4 Fridays, monthly: next 3 last Fridays), soonest first. */
export function mockExpiries(symbol: string, nowMs: number): OptionExpiry[] {
  const out = new Map<string, Set<ExpiryKind>>();
  const add = (date: string, kind: ExpiryKind) => {
    if (cutInstant(date) <= nowMs) return false;
    (out.get(date) ?? out.set(date, new Set()).get(date)!).add(kind);
    return true;
  };
  const day0 = Date.UTC(new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth(), new Date(nowMs).getUTCDate());
  for (let i = 0, n = 0; n < 5 && i < 20; i++) {
    const t = day0 + i * 86_400_000;
    const wd = new Date(t).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (add(ymd(t), "daily")) n++;
  }
  for (let i = 0, n = 0; n < 4 && i < 60; i++) {
    const t = day0 + i * 86_400_000;
    if (new Date(t).getUTCDay() === 5 && add(ymd(t), "weekly")) n++;
  }
  const now = new Date(nowMs);
  for (let i = 0, n = 0; n < 3 && i < 6; i++) {
    const y = now.getUTCFullYear() + Math.floor((now.getUTCMonth() + i) / 12);
    const m = (now.getUTCMonth() + i) % 12;
    const last = new Date(Date.UTC(y, m + 1, 0));
    const back = (last.getUTCDay() - 5 + 7) % 7;
    if (add(iso(y, m, last.getUTCDate() - back), "monthly")) n++;
  }
  const order: ExpiryKind[] = ["daily", "weekly", "monthly"];
  return [...out.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, kinds], i) => {
      const cut = cutInstant(date);
      return {
        id: 1000 + hashSymbol(symbol) * 100 + i,
        date,
        kinds: order.filter((k) => kinds.has(k)),
        cutAt: new Date(cut).toISOString(),
        twapStart: new Date(cut - OPTION_DEFAULTS.twapMinutes * 60_000).toISOString(),
        status: "listed",
        state: tradeState(cut, nowMs),
        series: 0,
        secondsToCut: Math.round((cut - nowMs) / 1000),
      };
    });
}

function hashSymbol(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 97;
  return h;
}

export function tradeState(cutMs: number, nowMs: number): OptionTradeState {
  const left = cutMs - nowMs;
  if (left <= OPTION_DEFAULTS.closeOnlyMinutes * 60_000) return "closed";
  if (left <= OPTION_DEFAULTS.noOpenMinutes * 60_000) return "close_only";
  return "open";
}

/** Strike ladder around a centre: ATM ± max(10, ~2.5σ√t) steps, at most 40 per side. */
export function strikeLadder(spec: OptionUnderlyingSpec, centre: number, atmVol: number, years: number): number[] {
  const step = spec.strikeStep;
  const atm = Math.round(centre / step) * step;
  const n = Math.min(40, Math.max(10, Math.ceil((2.5 * atmVol * Math.sqrt(Math.max(years, 1 / 365)) * centre) / step)));
  const out: number[] = [];
  const d = stepDecimals(step);
  for (let i = -n; i <= n; i++) {
    const k = +(atm + i * step).toFixed(d);
    if (k > 0) out.push(k);
  }
  return out;
}

/** The demo listing keeps its strikes (like the service: strikes are never removed), centred where it first priced. */
const ladders = new Map<string, number[]>();

export interface MockChainInput {
  symbol: string;
  expiry: OptionExpiry;
  spot: { bid: number; ask: number };
  nowMs: number;
  /** USD per unit of the quote currency (1 for USD; 1 / USDJPY for JPY …) */
  usdPerQuote: number;
  version?: number;
}

/** A full chain in the service's shape (services/options/src/pricing.rs `chain`). */
export function mockChain(inp: MockChainInput): OptionChain {
  const spec = OPTION_SPEC[inp.symbol]!;
  const cut = Date.parse(inp.expiry.cutAt);
  const mid = (inp.spot.bid + inp.spot.ask) / 2;
  const ctx = pricingContext(spec, mid, cut, inp.nowMs, inp.usdPerQuote);
  const key = `${inp.symbol}|${inp.expiry.date}`;
  let ladder = ladders.get(key);
  if (!ladder) {
    ladder = strikeLadder(spec, mid, ctx.quotes.atm, ctx.tCal);
    ladders.set(key, ladder);
  }
  // spot drifted towards an edge: extend (never remove) like the service's listing job
  const step = spec.strikeStep;
  const d = stepDecimals(step);
  while (ladder.length && mid > ladder[ladder.length - 4]!) ladder.push(+(ladder[ladder.length - 1]! + step).toFixed(d));
  while (ladder.length && mid < ladder[3]! && ladder[0]! - step > 0) ladder.unshift(+(ladder[0]! - step).toFixed(d));
  const expState = tradeState(cut, inp.nowMs);
  const rows: OptionChainRow[] = ladder.map((k) => ({
    strike: k,
    strikeLabel: strikeLabel(k, step),
    call: quoteSeries(ctx, "call", k, seriesCode(spec.symbol, inp.expiry.date, k, "call", step), expState),
    put: quoteSeries(ctx, "put", k, seriesCode(spec.symbol, inp.expiry.date, k, "put", step), expState),
  }));
  return {
    underlying: spec.symbol,
    name: spec.name,
    model: spec.model,
    expiry: inp.expiry.date,
    kinds: inp.expiry.kinds,
    cutAt: inp.expiry.cutAt,
    cut: { time: "10:00", zone: "America/New_York" },
    twapStart: inp.expiry.twapStart,
    status: "listed",
    state: expState,
    contractSize: spec.contractSize,
    contractUnit: spec.contractUnit,
    quoteCcy: spec.quoteCcy,
    digits: spec.digits,
    pipSize: spec.pipSize,
    group: "*",
    volSpread: OPTION_DEFAULTS.volSpread,
    minSpreadUsd: OPTION_DEFAULTS.minSpreadUsd,
    commission: { perContract: OPTION_DEFAULTS.commissionPerContract, capPct: OPTION_DEFAULTS.commissionCapPct },
    spot: { bid: inp.spot.bid, ask: inp.spot.ask, mid, t: inp.nowMs, ageMs: 0 },
    fixing: null,
    version: inp.version ?? 1,
    atmStrike: roundTo(forwardOf(ctx), spec.digits),
    rows,
  };
}

/** The underlying list in the service's shape (`GET /v1/options/underlyings`). */
export function mockUnderlyings(nowMs: number): OptionUnderlying[] {
  return OPTION_UNDERLYINGS.filter((u) => u.enabled).map((u) => {
    const next = mockExpiries(u.symbol, nowMs)[0];
    return {
      symbol: u.symbol,
      name: u.name,
      assetClass: u.assetClass,
      model: u.model,
      baseCcy: u.baseCcy,
      quoteCcy: u.quoteCcy,
      contractSize: u.contractSize,
      contractUnit: u.contractUnit,
      digits: u.digits,
      pipSize: u.pipSize,
      strikeStep: u.strikeStep,
      cut: { time: "10:00", zone: "America/New_York" },
      twapMinutes: OPTION_DEFAULTS.twapMinutes,
      noOpenMinutes: OPTION_DEFAULTS.noOpenMinutes,
      closeOnlyMinutes: OPTION_DEFAULTS.closeOnlyMinutes,
      minContracts: OPTION_DEFAULTS.minContracts,
      maxContracts: OPTION_DEFAULTS.maxContracts,
      contractStep: OPTION_DEFAULTS.contractStep,
      barriers: true,
      expiryKinds: ["daily", "weekly", "monthly"],
      nextExpiry: next ? { date: next.date, cutAt: next.cutAt } : null,
      atmVol: quotesAt(u, 7).atm,
      realizedVol: +(u.atm[3] * 0.94).toFixed(4),
    };
  });
}

/** USD per unit of a quote currency from a mid-price lookup (USD 1; JPY / CAD / CHF via the USD pair). */
export function usdPerQuoteCcy(ccy: string, mid: (symbol: string) => number | undefined): number {
  if (ccy === "USD") return 1;
  const usdX = mid(`USD${ccy}`);
  if (usdX && usdX > 0) return 1 / usdX;
  const xUsd = mid(`${ccy}USD`);
  return xUsd && xUsd > 0 ? xUsd : 1;
}

/* ------------------------------------------------------------------ */
/* Scenario margin (SPAN-like, services/options README step 6)         */
/* ------------------------------------------------------------------ */

export interface MarginLeg {
  right: OptionRight;
  strike: number;
  /** + long, − short (contracts) */
  qty: number;
  iv: number;
}

/**
 * Worst loss of a set of legs on one underlying over a 16-scenario grid (spot ±⅓, ±⅔, ±1 × priceScan, vol ±volScan,
 * plus two extreme moves covered at 35 %), one business day ahead. Long-only books have no margin.
 */
export function scenarioMargin(ctx: PricingContext, legs: MarginLeg[]): number {
  if (!legs.some((l) => l.qty < 0)) return 0;
  const { spec } = ctx;
  const t1 = Math.max(0, ctx.tCal - 1 / 365);
  const v1 = Math.max(0, ctx.tVol - 1 / 365);
  const value = (s: number, dv: number, tc: number, tv: number) => legs.reduce((sum, l) => sum + l.qty * legValue(l.right, s, l.strike, tc, tv, ctx.r, ctx.b, Math.max(0.005, l.iv + dv)), 0);
  const base = value(ctx.spot, 0, ctx.tCal, ctx.tVol);
  let worst = 0;
  for (const m of [0, 1 / 3, -1 / 3, 2 / 3, -2 / 3, 1, -1]) {
    for (const dv of [spec.volScan, -spec.volScan]) {
      const loss = base - value(ctx.spot * (1 + m * spec.priceScan), dv, t1, v1);
      worst = Math.max(worst, loss);
    }
  }
  for (const m of [3, -3]) worst = Math.max(worst, 0.35 * (base - value(ctx.spot * (1 + m * spec.priceScan), 0, t1, v1)));
  return worst * ctx.usdPerUnit;
}
