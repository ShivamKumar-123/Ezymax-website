// Number and date formatting of the options workspace. Premiums are shown in USD per contract with pips / points
// under them (plan O8); strikes keep the ladder's own decimals; expiries are dated by their cut (10:00 New York).
import type { OptionExpiry, OptionRight } from "@/lib/options/types";

/** Rounded to `d` decimals without a "-0". */
const clean = (v: number, d: number) => {
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return r === 0 ? 0 : r;
};
export const usd = (v: number, d = 2) => (Number.isFinite(v) ? clean(v, d).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
export const usdSigned = (v: number, d = 2) => {
  if (!Number.isFinite(v)) return "—";
  const r = clean(v, d);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${usd(Math.abs(r), d)}`;
};
export const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`);
export const pips = (v: number) => (Number.isFinite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: v < 100 ? 1 : 0 }) : "—");
export const greek = (v: number | undefined, d = 3) => (v === undefined || !Number.isFinite(v) ? "—" : clean(v, d).toFixed(d));
/** A price of the underlying with its digits (strikes, breakevens, spot). */
export const px = (v: number | null | undefined, digits: number) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(digits));

const dateFmt = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: string, opts: Intl.DateTimeFormatOptions) {
  const k = `${locale}|${JSON.stringify(opts)}`;
  let f = dateFmt.get(k);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" });
    } catch {
      f = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
    }
    dateFmt.set(k, f);
  }
  return f;
}

/** "Fri 09 Oct" for YYYY-MM-DD. */
export function expiryLabel(date: string, locale = "en", withWeekday = true) {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return fmt(locale, withWeekday ? { weekday: "short", day: "2-digit", month: "short" } : { day: "2-digit", month: "short" }).format(d);
}

/** Calendar days to the cut, by the cut's date (0 = expires today). */
export function dte(e: Pick<OptionExpiry, "cutAt">, now = Date.now()): number {
  return Math.max(0, Math.floor((Date.parse(e.cutAt) - now) / 86_400_000));
}

/** "2d 4h", "3h 12m", "4m 10s" until an instant. */
export function countdown(toMs: number, now = Date.now()): string {
  let s = Math.max(0, Math.round((toMs - now) / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export const rightLetter = (r: OptionRight) => (r === "call" ? "C" : "P");

/** "EURUSD 1.1650 C" */
export const seriesShort = (u: string, strikeLabel: string, r: OptionRight) => `${u} ${strikeLabel} ${rightLetter(r)}`;

/** A strike label with the ladder's decimals, from a number. */
export function strikeText(strike: number, digits: number) {
  const s = strike.toFixed(Math.min(digits, 6));
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") || "0" : s;
}
