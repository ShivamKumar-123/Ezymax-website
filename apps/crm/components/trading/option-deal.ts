// Kalks FX Options in the Client Area's trade lists: series codes, readable terms and premiums per contract.
// Plain functions (no React, no "use client"): the trading BFF's CSV export uses them on the server too.
//
// The engine records option trades like CFD deals (services/trading views.rs deal_json): `symbol` is the series code
// (`EURUSD-20261002-1.1000-C`), `volume` the contracts, `price` / `openPrice` the premium per unit of the underlying
// in its quote currency, `profit` the realised P&L in the account currency, plus `instrument: "option"` and an
// `option` object {series, underlying, right, strike, expiry, style, cash, usdPerQuote, …}. Option positions carry
// `option` = the full terms (with `contractSize`, `quoteCurrency`), `premium` (signed cash booked at open) and
// `markValue` (value now), both in the account currency.

export type OptionRight = "call" | "put";
export type InstrumentFilter = "all" | "cfd" | "option";

/** `option` of an engine deal (services/trading views.rs deal_option_json). Every field may be missing on old data. */
export interface DealOption {
  series?: string;
  underlying?: string;
  right?: string;
  strike?: number;
  expiry?: string;
  style?: string;
  /** Signed cash booked on the balance by this deal, commission excluded (account currency). */
  cash?: number;
  /** Quote currency → USD rate used for the cash. */
  usdPerQuote?: number;
  /** Units of the underlying per contract (sent by newer engines). */
  contractSize?: number;
  quoteCurrency?: string;
  spot?: number | null;
  fixing?: number | null;
  run?: number | null;
  comboId?: number | null;
  /** Commission charged by this deal itself (account currency). */
  commissionCharged?: number;
}

/** `option` of an engine position / order leg (services/trading engine/options.rs terms_json). */
export interface PositionOption {
  series?: string;
  underlying?: string;
  right?: string;
  strike?: number;
  expiry?: string;
  expiryAt?: string;
  style?: string;
  contractSize?: number;
  quoteCurrency?: string;
  barrier?: { kind: string; level: number; rebate: number; knockedIn?: boolean } | null;
}

export interface OptionTerms {
  series: string;
  underlying: string;
  right: OptionRight;
  strike: number;
  /** Strike as written in the series code (keeps the strike step's decimals, e.g. "1.1000"). */
  strikeLabel: string;
  /** YYYY-MM-DD */
  expiry: string;
  quoteCurrency?: string;
}

const SERIES_RE = /^([A-Za-z0-9]{2,16})-(\d{4})(\d{2})(\d{2})-(\d+(?:\.\d+)?)-([CPcp])$/;

/** `EURUSD-20261002-1.1000-C` → its parts (null for anything that isn't a series code). Same rule as the reports
 *  service's `is_option_series`. */
export function parseSeries(code: string | null | undefined): Omit<OptionTerms, "quoteCurrency"> | null {
  const m = SERIES_RE.exec(code ?? "");
  if (!m) return null;
  return {
    series: code!,
    underlying: m[1]!.toUpperCase(),
    expiry: `${m[2]}-${m[3]}-${m[4]}`,
    strike: Number(m[5]),
    strikeLabel: m[5]!,
    right: m[6]!.toUpperCase() === "C" ? "call" : "put",
  };
}

export const isOptionSymbol = (symbol: string | null | undefined) => SERIES_RE.test(symbol ?? "");

type Tradeish = { symbol: string; instrument?: string | null; option?: unknown };

/** An option deal / position / order (engine flag, option facts, or a series-code symbol on older data). */
export const isOptionTrade = (d: Tradeish) => d.instrument === "option" || (d.option !== null && d.option !== undefined) || isOptionSymbol(d.symbol);

export const matchesInstrument = (d: Tradeish, f: InstrumentFilter) => f === "all" || (f === "option") === isOptionTrade(d);

/** Quote currency of an underlying when the data doesn't say: the last three letters of a six-letter pair
 *  (EURUSD → USD, USDJPY → JPY, XAUUSD → USD). */
export function quoteOf(underlying: string, given?: string | null): string | undefined {
  if (given) return given;
  return /^[A-Z]{6}$/.test(underlying) ? underlying.slice(3) : undefined;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function trimNum(v: number) {
  return String(Number(v.toFixed(8)));
}

/** The option's terms from its `option` object, falling back to the series code in `symbol`. */
export function optionTerms(symbol: string, o?: DealOption | PositionOption | null): OptionTerms | null {
  const p = parseSeries(o?.series) ?? parseSeries(symbol);
  const underlying = (o?.underlying || p?.underlying || "").toUpperCase();
  const r = (o?.right ?? "").toLowerCase();
  const right: OptionRight | undefined = r === "call" || r === "c" ? "call" : r === "put" || r === "p" ? "put" : p?.right;
  const strike = finite(o?.strike) ? o!.strike : p?.strike;
  const expiry = (o?.expiry ?? "").slice(0, 10) || p?.expiry;
  if (!underlying || !right || strike === undefined || !expiry) return null;
  const strikeLabel = p && Math.abs(p.strike - strike) < 1e-9 ? p.strikeLabel : trimNum(strike);
  return { series: o?.series || p?.series || symbol, underlying, right, strike, strikeLabel, expiry, quoteCurrency: quoteOf(underlying, o?.quoteCurrency) };
}

/** Account-currency units per USD (cent accounts keep money in US cents). */
export const usdFactorOf = (a: { cent?: boolean; currency?: string } | null | undefined) => (a?.cent || a?.currency === "USC" ? 100 : 1);

type DealLike = { entry: string; volume: number; price: number; openPrice?: number | null; profit: number; option?: DealOption | null };

/**
 * Premiums of an option deal in USD per contract. `own` is the premium at this deal's price (an entry: what was
 * paid / received; an exit: the close price, the expiry payout or the knock-out rebate); `open` is the premium the
 * closed contracts were opened at (exits only).
 *
 * premium per unit × contractSize × usdPerQuote when the deal carries the contract size; otherwise from the cash the
 * deal booked (|cash| / contracts), which is the same number in the account currency. An exit's open premium comes
 * from its realised P&L (profit = cash + premium booked at open), which is exact even when the quote currency
 * isn't USD. null when neither is available (show the per-unit price instead).
 */
export function dealPremiumsUsd(d: DealLike, usdFactor: number): { own: number | null; open: number | null } {
  const o = d.option ?? undefined;
  const n = Math.abs(d.volume);
  const k = usdFactor > 0 ? usdFactor : 1;
  const perUnitUsd = finite(o?.contractSize) && finite(o?.usdPerQuote) && o!.contractSize! > 0 && o!.usdPerQuote! > 0 ? o!.contractSize! * o!.usdPerQuote! : null;
  const cash = finite(o?.cash) ? o!.cash! : null;
  let own: number | null = null;
  if (perUnitUsd !== null && finite(d.price)) own = Math.abs(d.price) * perUnitUsd;
  else if (cash !== null && n > 0) own = Math.abs(cash) / n / k;
  let open: number | null = null;
  if (d.entry !== "in") {
    if (cash !== null && n > 0 && finite(d.profit)) open = Math.abs(d.profit - cash) / n / k;
    else if (perUnitUsd !== null && finite(d.openPrice)) open = Math.abs(d.openPrice!) * perUnitUsd;
  }
  return { own, open };
}

type PositionLike = { volume: number; premium?: number | null; markValue?: number | null };

/** Open premium and value now of an option position, in USD per contract (null when the engine didn't send them). */
export function positionPremiumsUsd(p: PositionLike, usdFactor: number): { open: number | null; now: number | null } {
  const n = Math.abs(p.volume);
  const k = usdFactor > 0 ? usdFactor : 1;
  return {
    open: n > 0 && finite(p.premium) ? Math.abs(p.premium!) / n / k : null,
    now: n > 0 && finite(p.markValue) ? Math.abs(p.markValue!) / n / k : null,
  };
}

/** Commission this deal adds to a period total: CFD charges at entry (an exit's commission is the closed share of
 *  it); an option deal charges its own `commissionCharged` at entry and exit. Positive = charged. */
export function dealCommission(d: { entry: string; commission: number; option?: DealOption | null; instrument?: string | null; symbol: string }) {
  if (isOptionTrade(d) && finite(d.option?.commissionCharged)) return d.option!.commissionCharged!;
  return d.entry === "in" ? d.commission || 0 : 0;
}

/** Deal reasons that read as their own label on an option exit (engine DealReason). */
export const DEAL_REASONS = ["client", "dealer", "force", "sl", "tp", "stop_out", "close_by", "pending_fill", "price_correction", "reversal", "expiry", "knock_out", "novation"] as const;
