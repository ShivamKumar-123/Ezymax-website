// Kalks FX Options in Kalks Trader: shapes of the options service (chain, expiries, underlyings; the wire types
// live next to the demo pricer in @kalks/mock/options) and of the trading engine's options API (positions,
// preview, orders, settlements: services/trading, "Terminal API · options").

export type {
  ExpiryKind,
  OptionChain,
  OptionChainRow,
  OptionExpiry,
  OptionQuote,
  OptionRight,
  OptionTradeState,
  OptionUnderlying,
} from "@kalks/mock/options";
import type { OptionRight } from "@kalks/mock/options";

export type Side = "buy" | "sell";

/** `option` of an engine position / order. */
export interface OptionInfo {
  series: string;
  underlying: string;
  right: OptionRight;
  strike: number;
  /** YYYY-MM-DD */
  expiry: string;
  /** the cut (ISO) */
  expiryAt: string;
  style: string;
  barrier?: { type?: string; kind?: string; level?: number; price?: number; rebate?: number; knocked?: boolean } | null;
  contractSize: number;
}

export interface OptGreeks {
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
}

/** An open option position (engine position with `option`, or a demo-build fill). */
export interface OptPosition {
  ticket: string;
  login: string;
  side: Side;
  contracts: number;
  /** premium per unit paid / received (quote currency) */
  openPrice: number;
  openTime: string;
  /** USD (account currency) */
  commission: number;
  profit?: number;
  /** model mark per unit (quote currency) */
  mark?: number;
  greeks?: OptGreeks;
  comboId?: string;
  sl?: number;
  tp?: number;
  option: OptionInfo;
}

/** A working option order (limit premium / underlying trigger). */
export interface OptOrder {
  ticket: string;
  login: string;
  side: Side;
  contracts: number;
  type: string;
  /** limit premium per unit */
  price?: number;
  trigger?: { symbol: string; op: string; price: number } | null;
  comboId?: string;
  placedAt: string;
  option: OptionInfo;
}

export interface LegInput {
  series: string;
  side: Side;
  contracts: number;
}

export interface PreviewRequest {
  legs: LegInput[];
  type: "market" | "limit";
  limitPremium?: number;
}

export interface PreviewLeg {
  series: string;
  side: Side;
  contracts: number;
  /** fill premium per unit */
  price?: number;
  /** USD for the leg (signed or not, depending on the engine) */
  premium?: number;
}

export type Reason = string | { code?: string; message?: string };

export interface Preview {
  ok: boolean;
  reasons: Reason[];
  legs: PreviewLeg[];
  /** USD, positive = the client pays (debit) */
  netPremium: number;
  commission: number;
  marginBefore: number;
  marginAfter: number;
  freeMarginAfter: number;
  cashAfter: number;
  maxProfit: number | null;
  maxLoss: number | null;
  breakevens: number[];
  greeks: OptGreeks;
  /** client-side estimate (the engine's options API isn't live yet, or a demo build) */
  estimate?: boolean;
}

export interface Trigger {
  symbol: string;
  op: "above" | "below";
  price: number;
}

export interface OrderRequest extends PreviewRequest {
  sl?: number;
  tp?: number;
  trigger?: Trigger;
  tif?: "gtc" | "day";
  clientOrderId: string;
}

export interface OrderResult {
  status: "filled" | "placed" | "duplicate" | string;
  positions?: unknown[];
  order?: unknown;
}

export interface Settlement {
  ticket: number | string;
  series: string;
  side: Side;
  contracts: number;
  fixing: number;
  payout: number;
  at: string;
  run: number;
}
