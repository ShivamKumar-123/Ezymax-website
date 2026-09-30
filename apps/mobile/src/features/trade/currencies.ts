// The currencies a symbol is exposed to and the symbol a link asks for (pure: unit-tested in
// scripts/core-lib.test.mts).

/** Index and energy symbols -> the currency their economy trades in (the prop service's news-window rule). */
const SINGLE: Record<string, string> = { US30: "USD", NAS100: "USD", SPX500: "USD", USOIL: "USD", UKOIL: "USD", GER40: "EUR", UK100: "GBP", JP225: "JPY" };

/**
 * Currencies an instrument is exposed to, the same rule as the prop service's news window
 * (services/prop/src/rules.rs `symbol_currencies`): a six-letter pair -> base and quote; indices and energies -> their
 * economy's currency; stocks and anything else quoted in dollars -> USD.
 */
export function symbolCurrencies(symbol: string): string[] {
  const s = symbol.toUpperCase();
  const one = SINGLE[s];
  if (one) return [one];
  if (/^[A-Z]{6}$/.test(s)) return [s.slice(0, 3), s.slice(3)];
  return ["USD"];
}

/** The calendar to open for a symbol: its base currency when the calendar covers it (EURUSD -> EUR), else the quote
 *  currency (XAUUSD -> USD), else USD. */
export function calendarCurrency(symbol: string, covered: readonly string[]): string {
  return symbolCurrencies(symbol).find((c) => covered.includes(c)) ?? "USD";
}

const SYMBOL_RE = /^[A-Za-z0-9._-]{1,32}$/;

/**
 * The symbol a link asked for (`/trade?symbol=XAUUSD`), as the catalogue spells it: null when it isn't a symbol, or
 * the catalogue is loaded (`known` not empty) and doesn't have it. Before the catalogue arrives the link is taken as
 * it is.
 */
export function matchSymbol(raw: unknown, known: readonly string[]): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!SYMBOL_RE.test(v)) return null;
  if (!known.length) return v;
  return known.find((s) => s === v) ?? known.find((s) => s.toUpperCase() === v.toUpperCase()) ?? null;
}
