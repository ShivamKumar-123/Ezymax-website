/**
 * Currency-aware margin and pip-value math for the Risk Calculator.
 *
 * The previous calculator hard-coded the "USD-base" formula
 * (pipValue = pipSize / price × contractSize, margin = lots × cs × price ÷ lev),
 * which gives the right answer ONLY when the QUOTE currency happens to be the
 * one we're measuring in. For EURUSD (quote=USD) it understates pip value by
 * ~10% and inflates margin proportionally; for USDJPY (base=USD) it inflates
 * margin by ~150× and is accidentally close on pip value.
 *
 * The correct formulas, assuming the trader's account is in USD:
 *
 *   pipValue_USD per lot
 *     • quote = USD              → pipSize × contractSize             (e.g. EURUSD → $10/pip/lot)
 *     • base  = USD              → (pipSize × contractSize) / price   (e.g. USDJPY → ~$6.67/pip/lot at 150)
 *     • cross (no USD on either) → approximated via current price; correct
 *       only when the cross is liquid and roughly anchored to USD
 *
 *   marginRequired_USD per lot
 *     • base  = USD              → contractSize / leverage            (e.g. USDJPY 1 lot @ 100x → $1,000)
 *     • quote = USD or unknown   → (contractSize × price) / leverage  (e.g. EURUSD @ 1.10 → $1,100)
 *     • cross                    → falls back to the quote-USD branch; conversion needs a cross-rate feed
 *
 * Symbol-only fallback: when an Instrument row doesn't carry base/quote
 * currencies (legacy data), we slice the first 3 / last 3 chars of a 6-char
 * forex symbol. Metals / crypto / indices come through with the right
 * base/quote already so the helpers stay correct.
 */

export interface RiskMathInput {
  /** pip_size from Instrument (e.g. 0.0001 for EURUSD, 0.01 for JPY pairs, 0.01 for XAUUSD). */
  pipSize: number;
  /** contract_size from Instrument (100,000 forex; 100 for XAU; 5,000 for XAG; varies for crypto/CFDs). */
  contractSize: number;
  /** Current price (or the user's entered entry price). */
  price: number;
  /** Symbol — used as a fallback to derive base/quote when not on the Instrument row. */
  symbol?: string;
  /** Base currency (e.g. EUR, USD, XAU). May be null/undefined. */
  base?: string | null;
  /** Quote currency (e.g. USD, JPY). May be null/undefined. */
  quote?: string | null;
}

/** Derive (base, quote) from the symbol when not provided on the Instrument. */
function deriveBaseQuote(symbol: string | undefined, base?: string | null, quote?: string | null): { base: string; quote: string } {
  const sym = (symbol || '').toUpperCase();
  const b = (base || (sym.length >= 6 ? sym.slice(0, 3) : '')).toUpperCase();
  const q = (quote || (sym.length >= 6 ? sym.slice(3, 6) : '')).toUpperCase();
  return { base: b, quote: q };
}

/** USD value of one pip for a 1-lot position. Multiply by lots for total. */
export function usdPipValuePerLot(input: RiskMathInput): number {
  const { pipSize, contractSize, price } = input;
  const { base, quote } = deriveBaseQuote(input.symbol, input.base, input.quote);
  const raw = pipSize * contractSize;             // pip value in QUOTE currency
  if (!quote || quote === 'USD') return raw;       // EURUSD, GBPUSD, XAUUSD…
  if (base === 'USD' && price > 0) return raw / price; // USDJPY, USDCHF, USDCAD…
  // Cross-pair (no USD on either side) — use the price as a rough proxy.
  // Calculator results are explicitly labelled "approximate"; the trader UI
  // accepts this until we plumb a per-currency cross-rate feed.
  return price > 0 ? raw / price : raw;
}

/** Required margin in USD for a 1-lot position. Multiply by lots for total. */
export function usdMarginPerLot(input: RiskMathInput, leverage: number): number {
  const { contractSize, price } = input;
  const lev = leverage > 0 ? leverage : 100;
  const { base, quote } = deriveBaseQuote(input.symbol, input.base, input.quote);
  if (base === 'USD') {
    // USDJPY / USDCHF / USDCAD: contract size is denominated in USD, no
    // multiplication by price needed.
    return contractSize / lev;
  }
  // Quote = USD or unknown / cross — value the contract in USD via price.
  return (contractSize * price) / lev;
}

/**
 * Convenience: USD pip value for `lots` lots.
 *   = usdPipValuePerLot(input) × lots
 * Splitting the per-lot helper out lets callers display both pieces (the
 * Risk Calculator shows "Pip Value" and "Lots" separately).
 */
export function usdPipValue(input: RiskMathInput, lots: number): number {
  return usdPipValuePerLot(input) * (lots || 0);
}

/**
 * Suggested lot size from a fixed-USD risk amount and an SL distance in price.
 * Returns 0 if any input is invalid (caller should clamp to the instrument's
 * min_lot / lot_step before submitting).
 */
export function suggestedLotSize(
  input: RiskMathInput,
  riskUsd: number,
  slDistancePrice: number,
): number {
  if (!(riskUsd > 0) || !(slDistancePrice > 0)) return 0;
  const pipVal = usdPipValuePerLot(input);
  const slPips = slDistancePrice / input.pipSize;
  const denom = slPips * pipVal;
  if (!(denom > 0)) return 0;
  return riskUsd / denom;
}
