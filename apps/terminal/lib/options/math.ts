// Payoff maths, strategy templates and the client-side preview estimate of the options workspace. Pure functions:
// the strategy builder, the simple mode and the ticket all draw from here.
import { OPTION_SPEC, carryOf, legValue, normCdf, scenarioMargin, pricingContext, volYears, type OptionRight } from "@ezymex/mock/options";
import type { OptionChain, OptionChainRow, OptionQuote, OptGreeks, Preview, Side } from "./types";

export interface PayLeg {
  right: OptionRight;
  strike: number;
  side: Side;
  contracts: number;
  /** fill premium per unit (quote currency) */
  premium: number;
  iv?: number;
}

const sgn = (s: Side) => (s === "buy" ? 1 : -1);
const intrinsic = (r: OptionRight, s: number, k: number) => Math.max(0, r === "call" ? s - k : k - s);

/** P&L at expiry in USD when the underlying fixes at `s`. */
export function payoffAt(legs: PayLeg[], s: number, usdPerUnit: number): number {
  let v = 0;
  for (const l of legs) v += sgn(l.side) * l.contracts * usdPerUnit * (intrinsic(l.right, s, l.strike) - l.premium);
  return v;
}

/** P&L now (model value with each leg's vol), `atMs` before the cut. */
export function payoffNow(legs: PayLeg[], s: number, usdPerUnit: number, u: string, cutAtMs: number, atMs = Date.now()): number {
  const spec = OPTION_SPEC[u];
  const { r, b } = spec ? carryOf(spec) : { r: 0.036, b: 0 };
  const tCal = Math.max(0, (cutAtMs - atMs) / (365 * 86_400_000));
  const tVol = volYears(atMs, cutAtMs);
  let v = 0;
  for (const l of legs) v += sgn(l.side) * l.contracts * usdPerUnit * (legValue(l.right, s, l.strike, tCal, tVol, r, b, l.iv ?? spec?.atm[1] ?? 0.1) - l.premium);
  return v;
}

export interface PayoffStats {
  /** null = unlimited */
  maxProfit: number | null;
  /** positive number (the most you can lose); null = unlimited */
  maxLoss: number | null;
  breakevens: number[];
}

/** Max profit / loss and breakevens of the piecewise-linear expiry payoff. */
export function payoffStats(legs: PayLeg[], usdPerUnit: number): PayoffStats {
  if (!legs.length) return { maxProfit: 0, maxLoss: 0, breakevens: [] };
  const ks = [...new Set(legs.map((l) => l.strike))].sort((a, b) => a - b);
  const xs = [0, ...ks];
  const ys = xs.map((x) => payoffAt(legs, x, usdPerUnit));
  // slope beyond the highest strike: calls only
  let slope = 0;
  for (const l of legs) if (l.right === "call") slope += sgn(l.side) * l.contracts * usdPerUnit;
  const eps = 1e-9;
  const maxY = Math.max(...ys);
  const minY = Math.min(...ys);
  const maxProfit = slope > eps ? null : maxY;
  const maxLoss = slope < -eps ? null : Math.max(0, -minY);
  const breakevens: number[] = [];
  for (let i = 1; i < xs.length; i++) {
    const [x0, x1, y0, y1] = [xs[i - 1]!, xs[i]!, ys[i - 1]!, ys[i]!];
    if ((y0 < 0 && y1 > 0) || (y0 > 0 && y1 < 0)) breakevens.push(x0 + ((0 - y0) * (x1 - x0)) / (y1 - y0));
    else if (Math.abs(y1) < eps && i < xs.length - 1) breakevens.push(x1);
  }
  const yl = ys[ys.length - 1]!;
  if (Math.abs(slope) > eps && Math.sign(-yl) === Math.sign(slope) && yl !== 0) breakevens.push(xs[xs.length - 1]! - yl / slope);
  return { maxProfit: maxProfit === null ? null : Math.max(0, maxProfit), maxLoss, breakevens: [...new Set(breakevens.map((b) => +b.toFixed(10)))].filter((b) => b > 0) };
}

/** Probability that the expiry P&L is positive, under a lognormal at the given vol around the forward. */
export function probProfit(legs: PayLeg[], usdPerUnit: number, forward: number, vol: number, years: number): number {
  if (!legs.length || !(forward > 0) || !(vol > 0) || !(years > 0)) return 0;
  const sd = vol * Math.sqrt(years);
  const mu = Math.log(forward) - 0.5 * sd * sd;
  const N = 600;
  let p = 0;
  let prev = 0;
  for (let i = 0; i <= N; i++) {
    const z = -6 + (12 * i) / N;
    const cdf = normCdf(z);
    if (i > 0) {
      const zm = z - 6 / N;
      const s = Math.exp(mu + sd * zm);
      if (payoffAt(legs, s, usdPerUnit) > 0) p += cdf - prev;
    }
    prev = cdf;
  }
  return Math.min(1, Math.max(0, p));
}

/** USD per contract per unit of premium, read off the chain (contract size × USD per quote currency). */
export function usdPerUnitOf(chain: Pick<OptionChain, "rows" | "contractSize" | "quoteCcy"> | null | undefined): number {
  if (!chain) return 0;
  for (const r of chain.rows) {
    for (const q of [r.call, r.put]) if (q && q.ask > 0 && q.askUsd > 0) return q.askUsd / q.ask;
  }
  // an order book with no offers at all: the marks carry the same rate
  for (const r of chain.rows) {
    for (const q of [r.call, r.put]) if (q && q.mark > 0 && q.markUsd > 0) return q.markUsd / q.mark;
  }
  return chain.quoteCcy === "USD" ? chain.contractSize : 0;
}

/**
 * Fill premium per unit of a leg: the ask when buying, the bid when selling (or the limit). On the order book an
 * empty side (0) has no price to fill at: the mark stands in for estimates (payoff, simple-mode ideas).
 */
export const fillOf = (q: Pick<OptionQuote, "bid" | "ask"> & Partial<Pick<OptionQuote, "mark" | "book">>, side: Side, limit?: number) => {
  if (limit !== undefined && limit > 0) return limit;
  const p = side === "buy" ? q.ask : q.bid;
  return q.book && !(p > 0) && q.mark !== undefined ? q.mark : p;
};

/** Signed sum of quote Greeks over legs (delta / gamma in contracts, vega / theta in USD). */
export function sumGreeks(legs: { side: Side; contracts: number; q: Pick<OptionQuote, "delta" | "gamma" | "vega" | "theta"> | null | undefined }[]): Required<OptGreeks> {
  const g = { delta: 0, gamma: 0, vega: 0, theta: 0 };
  for (const l of legs) {
    if (!l.q) continue;
    const k = sgn(l.side) * l.contracts;
    g.delta += k * l.q.delta;
    g.gamma += k * l.q.gamma;
    g.vega += k * l.q.vega;
    g.theta += k * l.q.theta;
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Strategy templates                                                  */
/* ------------------------------------------------------------------ */

export type TemplateId = "long_call" | "long_put" | "straddle" | "strangle" | "bull_call" | "bear_put" | "iron_condor" | "butterfly";
export const TEMPLATES: TemplateId[] = ["long_call", "long_put", "straddle", "strangle", "bull_call", "bear_put", "iron_condor", "butterfly"];

export interface TemplateLeg {
  right: OptionRight;
  side: Side;
  /** strike offset from ATM, in ladder steps (× width) */
  at: number;
  ratio: number;
}

const T: Record<TemplateId, TemplateLeg[]> = {
  long_call: [{ right: "call", side: "buy", at: 0, ratio: 1 }],
  long_put: [{ right: "put", side: "buy", at: 0, ratio: 1 }],
  straddle: [
    { right: "call", side: "buy", at: 0, ratio: 1 },
    { right: "put", side: "buy", at: 0, ratio: 1 },
  ],
  strangle: [
    { right: "put", side: "buy", at: -1, ratio: 1 },
    { right: "call", side: "buy", at: 1, ratio: 1 },
  ],
  bull_call: [
    { right: "call", side: "buy", at: 0, ratio: 1 },
    { right: "call", side: "sell", at: 1, ratio: 1 },
  ],
  bear_put: [
    { right: "put", side: "buy", at: 0, ratio: 1 },
    { right: "put", side: "sell", at: -1, ratio: 1 },
  ],
  iron_condor: [
    { right: "put", side: "buy", at: -2, ratio: 1 },
    { right: "put", side: "sell", at: -1, ratio: 1 },
    { right: "call", side: "sell", at: 1, ratio: 1 },
    { right: "call", side: "buy", at: 2, ratio: 1 },
  ],
  butterfly: [
    { right: "call", side: "buy", at: -1, ratio: 1 },
    { right: "call", side: "sell", at: 0, ratio: 2 },
    { right: "call", side: "buy", at: 1, ratio: 1 },
  ],
};

/** Index of the row closest to the ATM strike (the forward), else to spot. */
export function atmIndex(chain: Pick<OptionChain, "rows" | "atmStrike" | "spot">): number {
  const ref = chain.atmStrike ?? chain.spot?.mid;
  if (!chain.rows.length || ref === undefined) return Math.floor(chain.rows.length / 2);
  let best = 0;
  for (let i = 1; i < chain.rows.length; i++) if (Math.abs(chain.rows[i]!.strike - ref) < Math.abs(chain.rows[best]!.strike - ref)) best = i;
  return best;
}

/** A template's legs on the chain: strikes `width` ladder steps apart around ATM. */
export function templateLegs(id: TemplateId, chain: Pick<OptionChain, "rows" | "atmStrike" | "spot">, width: number, contracts: number): { row: OptionChainRow; right: OptionRight; side: Side; contracts: number }[] {
  const i0 = atmIndex(chain);
  const out: { row: OptionChainRow; right: OptionRight; side: Side; contracts: number }[] = [];
  for (const l of T[id]) {
    const i = Math.min(chain.rows.length - 1, Math.max(0, i0 + l.at * Math.max(1, width)));
    const row = chain.rows[i];
    if (row) out.push({ row, right: l.right, side: l.side, contracts: l.ratio * contracts });
  }
  return out;
}

/** Best-effort name of a set of legs (positions grouped by combo, the builder's custom legs). */
export function detectTemplate(legs: { right: OptionRight; side: Side; strike: number; contracts: number }[]): TemplateId | null {
  const key = (ls: typeof legs) =>
    [...ls]
      .sort((a, b) => a.strike - b.strike || a.right.localeCompare(b.right))
      .map((l) => `${l.side[0]}${l.right[0]}`)
      .join(",");
  const k = key(legs);
  const strikes = [...new Set(legs.map((l) => l.strike))].length;
  if (legs.length === 1) return k === "bc" ? "long_call" : k === "bp" ? "long_put" : null;
  if (legs.length === 2) {
    if (strikes === 1 && legs.every((l) => l.side === "buy") && legs.some((l) => l.right === "call") && legs.some((l) => l.right === "put")) return "straddle";
    if (k === "bp,bc") return "strangle";
    if (k === "bc,sc") return "bull_call";
    if (k === "sp,bp") return "bear_put";
  }
  if (legs.length === 4 && k === "bp,sp,sc,bc") return "iron_condor";
  if (legs.length === 3 && k === "bc,sc,bc") return "butterfly";
  return null;
}

/* ------------------------------------------------------------------ */
/* Client-side preview estimate                                        */
/* ------------------------------------------------------------------ */

export interface EstimateLeg {
  series: string;
  right: OptionRight;
  strike: number;
  side: Side;
  contracts: number;
  quote: OptionQuote | null;
}

export interface EstimateInput {
  underlying: string;
  legs: EstimateLeg[];
  type: "market" | "limit";
  limitPremium?: number;
  chain: Pick<OptionChain, "rows" | "contractSize" | "quoteCcy" | "commission" | "spot" | "cutAt" | "state">;
  account: { cash: number; margin: number; free: number };
  /** open short-option legs on the same underlying (scenario margin is per underlying) */
  existing?: { right: OptionRight; strike: number; qty: number; iv: number }[];
  marketOpen: boolean;
}

/** What the engine's preview would say, computed in the browser (demo builds; live until the engine answers). */
export function estimatePreview(inp: EstimateInput): Preview {
  const usd = usdPerUnitOf(inp.chain as OptionChain);
  const reasons: string[] = [];
  const single = inp.legs.length === 1;
  const pay: PayLeg[] = [];
  let net = 0;
  let commission = 0;
  const legs = inp.legs.map((l) => {
    const price = l.quote ? fillOf(l.quote, l.side, single && inp.type === "limit" ? inp.limitPremium : undefined) : 0;
    const premium = price * usd * l.contracts;
    net += sgn(l.side) * premium;
    commission += Math.min(inp.chain.commission.perContract * l.contracts, (inp.chain.commission.capPct / 100) * premium);
    pay.push({ right: l.right, strike: l.strike, side: l.side, contracts: l.contracts, premium: price, iv: l.quote?.iv });
    if (!l.quote) reasons.push("no_price");
    else if (l.quote.state === "halted") reasons.push("series_halted");
    else if (l.quote.state === "close_only") reasons.push("cutoff");
    else if (l.quote.state === "closed") reasons.push("closed");
    return { series: l.series, side: l.side, contracts: l.contracts, price, premium: +premium.toFixed(2) };
  });
  const stats = payoffStats(pay, usd);
  const spec = OPTION_SPEC[inp.underlying];
  let addMargin = 0;
  if (spec && inp.chain.spot) {
    const ctx = pricingContext(spec, inp.chain.spot.mid, Date.parse(inp.chain.cutAt), Date.now(), usd / spec.contractSize);
    const ctxUsd = { ...ctx, usdPerUnit: usd || ctx.usdPerUnit };
    const before = scenarioMargin(ctxUsd, inp.existing ?? []);
    const after = scenarioMargin(ctxUsd, [...(inp.existing ?? []), ...pay.map((p) => ({ right: p.right, strike: p.strike, qty: sgn(p.side) * p.contracts, iv: p.iv ?? ctx.quotes.atm }))]);
    addMargin = Math.max(0, after - before);
  }
  const cashAfter = inp.account.cash - net - commission;
  const freeAfter = inp.account.free - Math.max(0, net) - commission - addMargin + Math.max(0, -net);
  if (!inp.marketOpen) reasons.push("market_closed");
  if (net + commission > inp.account.cash && net > 0) reasons.push("insufficient_cash");
  else if (freeAfter < 0) reasons.push("insufficient_margin");
  const g = sumGreeks(inp.legs.map((l) => ({ side: l.side, contracts: l.contracts, q: l.quote })));
  return {
    ok: reasons.length === 0,
    reasons: [...new Set(reasons)],
    legs,
    netPremium: +net.toFixed(2),
    commission: +commission.toFixed(2),
    marginBefore: +inp.account.margin.toFixed(2),
    marginAfter: +(inp.account.margin + addMargin).toFixed(2),
    freeMarginAfter: +freeAfter.toFixed(2),
    cashAfter: +cashAfter.toFixed(2),
    // like the engine's preview: the commission lowers the best case and adds to the worst case
    maxProfit: stats.maxProfit === null ? null : +(stats.maxProfit - commission).toFixed(2),
    maxLoss: stats.maxLoss === null ? null : +(stats.maxLoss + commission).toFixed(2),
    breakevens: stats.breakevens,
    greeks: g,
    estimate: true,
  };
}

/* ------------------------------------------------------------------ */
/* Analytics: smile, open interest and the what-if book                */
/* ------------------------------------------------------------------ */

/** Inverse of the standard normal CDF (Acklam's rational approximation, relative error < 1.2e-9). */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

/** Strike at a forward call delta N(d1) for a vol (the service's smile convention): K = F·exp(−N⁻¹(Δ)·σ√t + ½σ²t). */
export function strikeAtCallDelta(forward: number, callDelta: number, vol: number, years: number): number {
  if (!(forward > 0) || !(callDelta > 0 && callDelta < 1) || !(vol > 0) || !(years > 0)) return NaN;
  const v = vol * Math.sqrt(years);
  return forward * Math.exp(-normInv(callDelta) * v + 0.5 * v * v);
}

export interface SmilePillar {
  /** forward call delta N(d1): 0.25 = the 25-delta call, 0.75 = the 25-delta put */
  callDelta: number;
  vol: number;
  strike: number;
}

/** 25-delta risk reversal (call vol − put vol) and butterfly (wings over ATM) read off the smile's pillars. */
export function skewOf(pillars: Pick<SmilePillar, "callDelta" | "vol">[], atmVol?: number | null): { rr25: number | null; bf25: number | null } {
  const at = (d: number) => pillars.find((p) => Math.abs(p.callDelta - d) < 0.02)?.vol;
  const c25 = at(0.25);
  const p25 = at(0.75);
  const atm = at(0.5) ?? atmVol ?? undefined;
  return {
    rr25: c25 !== undefined && p25 !== undefined ? c25 - p25 : null,
    bf25: c25 !== undefined && p25 !== undefined && atm !== undefined ? (c25 + p25) / 2 - atm : null,
  };
}

/** Puts over calls (open interest or volume); null without calls. */
export const putCallRatio = (puts: number, calls: number): number | null => (calls > 0 ? puts / calls : null);

/**
 * Max pain: the listed strike where the holders of the expiry's open interest would collect the least at expiry
 * (calls pay max(0, F − K), puts max(0, K − F) per unit). Null without open interest.
 */
export function maxPain(rows: { strike: number; callOi: number; putOi: number }[]): number | null {
  if (!rows.some((r) => r.callOi > 0 || r.putOi > 0)) return null;
  let best: number | null = null;
  let bestPay = Infinity;
  for (const f of rows) {
    let pay = 0;
    for (const r of rows) pay += r.callOi * Math.max(0, f.strike - r.strike) + r.putOi * Math.max(0, r.strike - f.strike);
    if (pay < bestPay - 1e-12) {
      bestPay = pay;
      best = f.strike;
    }
  }
  return best;
}

/** An option leg of the what-if book: an open position or a ticket leg. */
export interface WhatIfLeg {
  right: OptionRight;
  strike: number;
  side: Side;
  contracts: number;
  /** entry premium per unit (quote currency): the open price, or the fill price of a ticket leg */
  premium: number;
  /** implied vol of the series now (decimal, business-time clock like the chain's `iv`) */
  iv: number;
  /** the cut (ms) */
  cutAtMs: number;
  /** USD per contract for one unit of premium at today's spot */
  usdPerUnit: number;
}

/** A linear position on the same underlying (a CFD): `units` = lots × contract size. */
export interface WhatIfLinear {
  side: Side;
  units: number;
  openPrice: number;
}

export interface WhatIfBook {
  /** the underlying's price now: USD conversions of USD-based pairs are scaled from it */
  spot: number;
  /** rate and cost of carry (GK: r_quote − r_base, BS: with the lease rate, Black-76: 0) */
  r: number;
  b: number;
  /** USD per unit of the quote currency moves as 1 / S (USDJPY, USDCAD, USDCHF) */
  inverseUsd: boolean;
  /** USD per unit of the quote currency now (linear positions) */
  usdPerQuote: number;
  options: WhatIfLeg[];
  linear: WhatIfLinear[];
}

/** Each option leg's calendar and vol-clock years to its cut at an instant (volYears walks days: once per curve). */
export function whatIfClock(book: Pick<WhatIfBook, "options">, atMs: number): { tCal: number; tVol: number }[] {
  return book.options.map((l) => ({ tCal: Math.max(0, (l.cutAtMs - atMs) / (365 * 86_400_000)), tVol: volYears(atMs, l.cutAtMs) }));
}

/**
 * P&L of the book in USD (against each entry) if the underlying trades at `s` at the clock's instant, with every
 * leg's implied vol moved by `ivShift` (decimal: 0.01 = one vol point). Options are valued with the demo pricer's
 * maths (generalized BSM: GK / BS / Black-76 by the carry), at intrinsic once past their cut; CFDs are linear.
 * Before commissions and swaps.
 */
export function whatIfPnl(book: WhatIfBook, s: number, clock: { tCal: number; tVol: number }[], ivShift = 0): number {
  if (!(s > 0)) return NaN;
  const fx = book.inverseUsd && book.spot > 0 ? book.spot / s : 1;
  let v = 0;
  for (let i = 0; i < book.options.length; i++) {
    const l = book.options[i]!;
    const c = clock[i] ?? { tCal: 0, tVol: 0 };
    const sigma = Math.max(0.005, l.iv + ivShift);
    v += sgn(l.side) * l.contracts * l.usdPerUnit * fx * (legValue(l.right, s, l.strike, c.tCal, c.tVol, book.r, book.b, sigma) - l.premium);
  }
  const usdQ = book.inverseUsd ? 1 / s : book.usdPerQuote;
  for (const p of book.linear) v += sgn(p.side) * p.units * (s - p.openPrice) * usdQ;
  return v;
}

/** A "nice" ± range in percent of spot that covers `need` (fraction), for the what-if price axis and slider. */
export function niceRangePct(need: number): number {
  const steps = [0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 7.5, 10, 15, 20, 25, 30, 40, 50];
  const want = Math.max(0, need) * 100;
  return steps.find((x) => x >= want) ?? 50;
}
