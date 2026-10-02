// Payoff maths, strategy templates and the client-side preview estimate of the options workspace. Pure functions:
// the strategy builder, the simple mode and the ticket all draw from here.
import { OPTION_SPEC, carryOf, legValue, normCdf, scenarioMargin, pricingContext, volYears, type OptionRight } from "@kalks/mock/options";
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
  return chain.quoteCcy === "USD" ? chain.contractSize : 0;
}

/** Fill premium per unit of a leg: the ask when buying, the bid when selling (or the limit). */
export const fillOf = (q: Pick<OptionQuote, "bid" | "ask">, side: Side, limit?: number) => (limit !== undefined && limit > 0 ? limit : side === "buy" ? q.ask : q.bid);

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
    maxProfit: stats.maxProfit === null ? null : +stats.maxProfit.toFixed(2),
    maxLoss: stats.maxLoss === null ? null : +stats.maxLoss.toFixed(2),
    breakevens: stats.breakevens,
    greeks: g,
    estimate: true,
  };
}
