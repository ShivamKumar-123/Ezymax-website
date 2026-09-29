// Number formatting for trading screens. Prices and money always use Latin digits (like MT5) and fixed
// decimals, so tabular digits never jump.

/** Price with the instrument's digits (no grouping, like the terminal). */
export function fmtPrice(v: number | null | undefined, digits: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toFixed(Math.max(0, digits));
}

/** 1234567.8 -> "1,234,567.80" (optional sign). */
export function fmtMoney(v: number | null | undefined, opts: { decimals?: number; signed?: boolean; currency?: string } = {}): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const d = opts.decimals ?? 2;
  const abs = Math.abs(v);
  const [int, frac] = abs.toFixed(d).split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = v < 0 ? "−" : opts.signed && v > 0 ? "+" : "";
  const num = frac ? `${grouped}.${frac}` : grouped;
  if (!opts.currency) return `${sign}${num}`;
  const sym = opts.currency === "USD" ? "$" : opts.currency === "USC" ? "¢" : "";
  return sym ? `${sign}${sym}${num}` : `${sign}${num} ${opts.currency}`;
}

export function fmtPct(v: number | null | undefined, decimals = 2, signed = true): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = Math.abs(v).toFixed(decimals);
  return `${v < 0 ? "−" : signed && v > 0 ? "+" : ""}${s}%`;
}

export function fmtLots(v: number): string {
  return v.toFixed(2);
}

/** Splits a price for the MT5-style big-figure display: [lead, big (pips), pipette]. */
export function splitPrice(text: string, digits: number): [string, string, string] {
  if (digits >= 3 && text.length > 3) {
    const pipette = text.slice(-1);
    const big = text.slice(-3, -1);
    return [text.slice(0, -3), big, pipette];
  }
  if (text.length > 2) return [text.slice(0, -2), text.slice(-2), ""];
  return ["", text, ""];
}
