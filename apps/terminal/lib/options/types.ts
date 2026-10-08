// Ezymex FX Options in Ezymex Trader: shapes of the options service (chain, expiries, underlyings; the wire types
// live next to the demo pricer in @ezymex/mock/options) and of the trading engine's options API (positions,
// preview, orders, settlements: services/trading, "Terminal API · options").

export type {
  ChainBook,
  DepthLevel,
  ExpiryKind,
  OptionChain,
  OptionChainRow,
  OptionExpiry,
  OptionQuote,
  OptionRight,
  OptionTradeState,
  OptionUnderlying,
  OptionCandles,
  PremiumCandle,
  SeriesDepth,
  TapeTrade,
} from "@ezymex/mock/options";
import type { OptionRight } from "@ezymex/mock/options";

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
  /** where the position lives: `book` (the order book, closes through it), `house` (Ezymex-quoted: barriers, legacy) */
  venue?: "book" | "house" | string;
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

/** Knock-in / knock-out terms of a barrier leg (Ezymex-quoted, never on the order book). */
export interface BarrierSpec {
  kind: "UO" | "DO" | "UI" | "DI";
  /** barrier level, a price of the underlying */
  level: number;
  /** cash rebate per unit of the underlying (quote currency) */
  rebate?: number;
}

export interface LegInput {
  series: string;
  side: Side;
  contracts: number;
  /** a barrier leg: the strategy is placed at Ezymex prices (house ticket), never as an RFQ */
  barrier?: BarrierSpec;
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
  /** the engine's account currency of the money fields (USC on cent accounts; the API layer converts to USD) */
  currency?: string;
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
  /** the settlement price (TWAP of the mid over the 30 minutes before the cut); null while unknown */
  fixing: number | null;
  /** cash booked at expiry: + paid to the client, − paid by a seller, 0 = expired worthless (account currency) */
  payout: number;
  /** realised P&L of the position at expiry, premium included (account currency; engine builds) */
  profit?: number;
  at: string;
  run: number;
  /** the run was reversed (a later run or a void replaced it) */
  reversed?: boolean;
}

/* ------------------------------------------------------------------ */
/* Order book (docs/OPTIONS-EXCHANGE.md §2, §5, §12 "Terminal")        */
/* ------------------------------------------------------------------ */

export type BookOrderType = "limit" | "market" | "stop_market" | "stop_limit";
export type BookTif = "gtc" | "ioc" | "fok" | "gtd";
export type BookOrderStatus = "working" | "filled" | "partially_filled" | "cancelled" | "rejected" | "expired" | "pending" | string;

/** Stop trigger: the series' mark (premium per unit) or the underlying's price crossing `price`. */
export interface StopTrigger {
  source: "mark" | "underlying";
  op: "above" | "below";
  price: number;
}

/** `POST /v1/terminal/options/book/orders` (and `…/book/preview`): prices per unit in the quote currency, on the tick. */
export interface BookOrderRequest {
  series: string;
  side: Side;
  type: BookOrderType;
  /** contracts */
  qty: number;
  price?: number;
  tif: BookTif;
  /** ISO, tif = gtd */
  expireAt?: string;
  postOnly?: boolean;
  reduceOnly?: boolean;
  trigger?: StopTrigger;
  clientOrderId: string;
}

export interface BookOrder {
  id: string;
  series: string;
  side: Side;
  type: BookOrderType;
  qty: number;
  filled: number;
  left: number;
  /** per unit */
  avgPrice: number | null;
  price: number | null;
  tif: BookTif;
  expireAt: string | null;
  /** post_only, reduce_only */
  flags: string[];
  /** USD held for the order (order margin) */
  reserved: number;
  createdAt: string;
  updatedAt: string | null;
  status: BookOrderStatus;
  reason?: string;
  trigger: StopTrigger | null;
}

export interface BookFill {
  fillId: string;
  orderId?: string;
  series: string;
  side: Side;
  /** per unit */
  price: number;
  qty: number;
  role: "maker" | "taker" | string;
  /** USD charged (≥ 0) */
  fee: number;
  /** USD paid to the maker (≥ 0) */
  rebate: number;
  positionTicket?: string;
  kind?: string;
  comboId?: string;
  at: string;
}

export interface BookOrderResult {
  status: BookOrderStatus;
  order: BookOrder | null;
  fills: BookFill[];
  reason?: string;
}

/** `POST …/book/preview`: the reserve (order margin), the average price expected from the depth, the fee or rebate. */
export interface BookPreview {
  ok: boolean;
  reasons: Reason[];
  /** USD */
  reserve: number;
  /** per unit; null = nothing would fill now */
  estAvgPrice: number | null;
  /** contracts that would fill now / rest on the book */
  estFilled: number;
  estResting: number;
  /** USD: fee on the part that takes, rebate on the part that rests (paid when it fills) */
  fee: number;
  rebate: number;
  /** market orders: the band the order may fill in (per unit) */
  band: { min: number | null; max: number | null } | null;
  marginBefore?: number;
  marginAfter?: number;
  freeMarginAfter?: number;
  /** client-side estimate (demo builds) */
  estimate?: boolean;
  /** the account's currency of `reserve` / margins (USC on cent accounts: 100 × USD) */
  currency?: string;
}

/** `POST /v1/terminal/positions/{ticket}/close` on a book-venue option (reduce-only market IOC); house: {status, profit}. */
export interface CloseResult {
  status: "filled" | "partial" | "closed" | string;
  filled?: number;
  /** per unit */
  avgPrice?: number;
  left?: number;
  profit?: number;
}

/* ---- combo RFQ (§5) ---- */

export interface RfqLeg {
  series: string;
  side: Side;
  ratio: number;
}

export interface Rfq {
  id: string;
  expiresAt: string;
  legs: RfqLeg[];
  qty: number;
  status?: string;
  /** why the market maker isn't quoting right now (e.g. no price for a leg) */
  note?: string;
}

/** A responder's firm quote: net per combo unit, per unit of the underlying (quote currency). */
export interface RfqQuote {
  quoteId: string;
  responder: string;
  bid: number | null;
  ask: number | null;
  qty: number;
  validUntil: string;
}

export interface RfqAcceptResult {
  status: string;
  comboId?: string;
  fills: BookFill[];
  /** the net price filled, per strategy unit and per unit of the underlying (quote currency): + paid, − received */
  net?: number;
  /** the fills are still being booked on the account (final numbers in a moment) */
  settling?: boolean;
  reason?: string;
}

/**
 * `POST …/combos/{id}/close`. House strategies: `{status, comboId, legs, profit}`. A strategy held on the order book
 * closes through a reduce-only combo RFQ to the market maker and adds `venue: "book"`, the `net` paid (+) or received
 * (−) per strategy unit and per unit of the underlying, the `rfq` id and the legs' fills. `profit` is in the account's
 * currency (USC on cent accounts).
 */
export interface ComboCloseResult {
  status: string;
  comboId?: string | number;
  profit?: number;
  closed?: number[];
  legs?: { ticket?: number | string; dealId?: number | string; profit?: number; fillId?: string; series?: string; price?: number; qty?: number }[];
  venue?: "book" | "house" | string;
  net?: number;
  rfq?: string;
  settling?: boolean;
}
