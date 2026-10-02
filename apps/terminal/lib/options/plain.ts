// Plain-language reading of an option position or order: what shape it is (bought call, sold put, a strategy), where
// it makes money at expiry (above / below / between / outside prices), what it would pay at a price, and the numbers
// a beginner needs (cost or credit, the most it can lose or make, breakevens). Pure functions; the ticket, the guided
// flow, the position cards and the settlements all read from here, so every screen says the same thing.
import { payoffAt, payoffStats, type PayLeg } from "./math";
import type { OptionRight, Side } from "./types";

export type Shape = "long_call" | "long_put" | "short_call" | "short_put" | "multi";

export function shapeOf(legs: { right: OptionRight; side: Side }[]): Shape {
  if (legs.length !== 1) return "multi";
  const l = legs[0]!;
  return `${l.side === "buy" ? "long" : "short"}_${l.right}` as Shape;
}

/** Where the expiry P&L is above zero, in words a beginner reads. */
export type ProfitZone =
  | { kind: "above"; at: number }
  | { kind: "below"; at: number }
  | { kind: "between"; lo: number; hi: number }
  | { kind: "outside"; lo: number; hi: number }
  | { kind: "always" }
  | { kind: "never" }
  | { kind: "list"; at: number[] };

/** The profit zone of a payoff from its breakevens (P&L at expiry before commission, like the breakevens). */
export function profitZone(legs: PayLeg[], usdPerUnit: number, breakevens: number[], ref: number): ProfitZone {
  const bes = [...breakevens].filter((b) => b > 0 && Number.isFinite(b)).sort((a, b) => a - b);
  const k = usdPerUnit > 0 ? usdPerUnit : 1;
  const pos = (s: number) => payoffAt(legs, s, k) > 1e-9;
  if (!bes.length) return pos(ref > 0 ? ref : 1) ? { kind: "always" } : { kind: "never" };
  const out = (b: number, dir: 1 | -1) => b * (1 + dir * 0.005);
  const segs: boolean[] = [pos(out(bes[0]!, -1))];
  for (let i = 1; i < bes.length; i++) segs.push(pos((bes[i - 1]! + bes[i]!) / 2));
  segs.push(pos(out(bes[bes.length - 1]!, 1)));
  if (bes.length === 1) {
    if (segs[1] && !segs[0]) return { kind: "above", at: bes[0]! };
    if (segs[0] && !segs[1]) return { kind: "below", at: bes[0]! };
  }
  if (bes.length === 2) {
    if (segs[1] && !segs[0] && !segs[2]) return { kind: "between", lo: bes[0]!, hi: bes[1]! };
    if (!segs[1] && segs[0] && segs[2]) return { kind: "outside", lo: bes[0]!, hi: bes[1]! };
  }
  return { kind: "list", at: bes };
}

/** Cash the legs pay at expiry if the underlying fixes at `s` (USD; + paid to the holder of the legs, − paid by them). */
export function expiryCash(legs: { right: OptionRight; strike: number; side: Side; contracts: number }[], s: number, usdPerUnit: number): number {
  let v = 0;
  for (const l of legs) v += (l.side === "buy" ? 1 : -1) * l.contracts * usdPerUnit * Math.max(0, l.right === "call" ? s - l.strike : l.strike - s);
  return v;
}

export interface PlainNumbers {
  /** net premium in USD: + paid (debit), − received (credit) */
  net: number;
  commission: number;
  /** null = no limit */
  maxLoss: number | null;
  maxProfit: number | null;
  breakevens: number[];
  zone: ProfitZone;
  /** a short leg is open without a matching long leg: the risk isn't the premium (sellers' warning, margin) */
  selling: boolean;
}

/**
 * The plain numbers of a set of legs. Engine figures (a preview) win when given: the net premium, commission, the
 * most it can lose / make (commission included, like the engine) and the breakevens; otherwise they come from the
 * legs' fill prices.
 */
export function plainNumbers(legs: PayLeg[], usdPerUnit: number, ref: number, engine?: { netPremium: number; commission: number; maxLoss: number | null; maxProfit: number | null; breakevens: number[] } | null, commissionEstimate = 0): PlainNumbers {
  const st = payoffStats(legs, usdPerUnit);
  const net = engine ? engine.netPremium : legs.reduce((s, l) => s + (l.side === "buy" ? 1 : -1) * l.premium * usdPerUnit * l.contracts, 0);
  const commission = engine ? engine.commission : commissionEstimate;
  const maxLoss = engine ? engine.maxLoss : st.maxLoss === null ? null : st.maxLoss + commission;
  const maxProfit = engine ? engine.maxProfit : st.maxProfit === null ? null : st.maxProfit - commission;
  const breakevens = engine && engine.breakevens.length ? engine.breakevens : st.breakevens;
  const selling = isSelling(legs);
  return { net, commission, maxLoss, maxProfit, breakevens, zone: profitZone(legs, usdPerUnit, breakevens, ref), selling };
}

/** True when some sold contracts aren't covered by bought contracts of the same right (call / put). */
export function isSelling(legs: { right: OptionRight; side: Side; contracts: number }[]): boolean {
  for (const r of ["call", "put"] as const) {
    const sold = legs.filter((l) => l.right === r && l.side === "sell").reduce((s, l) => s + l.contracts, 0);
    const bought = legs.filter((l) => l.right === r && l.side === "buy").reduce((s, l) => s + l.contracts, 0);
    if (sold > bought) return true;
  }
  return false;
}

/** Breakeven of one option position: strike ± the premium per unit it was opened at. */
export const breakevenOf = (right: OptionRight, strike: number, premium: number) => (right === "call" ? strike + premium : strike - premium);
