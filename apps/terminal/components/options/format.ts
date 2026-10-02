// Number and date formatting of the options workspace. Premiums are shown in USD per contract with pips / points
// under them (plan O8); strikes keep the ladder's own decimals; expiries are dated by their cut (10:00 New York).
import { OPTION_SPEC } from "@kalks/mock/options";
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
/**
 * Change of an option's last price as a short label. A % on a near-zero base premium is meaningless (0.01 → 4.32
 * reads "+43100%"), so below $0.50 the change is shown in USD instead; large moves are capped at "> +999%".
 */
export function lastChange(lastUsd: number | null | undefined, change: number | null | undefined): string | null {
  if (!lastUsd || change === null || change === undefined || !Number.isFinite(change) || change <= -1) return null;
  const base = lastUsd / (1 + change);
  if (base < 0.5) return usdSigned(lastUsd - base);
  const r = change * 100;
  return r > 999 ? "> +999%" : `${r >= 0 ? "+" : ""}${r.toFixed(1)}%`;
}
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

/** "$1,234.56" (USD amounts in plain sentences and cards; "−$4.00" below zero). */
export const money = (v: number, d = 2) => {
  if (!Number.isFinite(v)) return "—";
  const r = clean(v, d);
  return `${r < 0 ? "−" : ""}$${usd(Math.abs(r), d)}`;
};
/** "+$12.30" / "−$4.00" / "$0.00". */
export const moneySigned = (v: number, d = 2) => {
  if (!Number.isFinite(v)) return "—";
  const r = clean(v, d);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}$${usd(Math.abs(r), d)}`;
};
/** "+12.4%" / "−3.0%" of a ratio (0.124). */
export const pctSigned = (v: number | null | undefined, d = 1) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const r = clean(v * 100, d);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(d)}%`;
};

/** "Mon, Oct 5 · 14:00 UTC": the cut of an expiry, in UTC (the same instant for every trader). */
export function cutWhen(cutAt: string | number | null | undefined, locale = "en") {
  const ms = typeof cutAt === "number" ? cutAt : cutAt ? Date.parse(cutAt) : NaN;
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  const day = fmt(locale, { weekday: "short", day: "numeric", month: "short" }).format(d);
  return `${day} · ${d.toISOString().slice(11, 16)} UTC`;
}

/** The cut of a YYYY-MM-DD expiry when the engine didn't send it: 10:00 New York (14:00 UTC in summer, 15:00 in winter). */
export function nyCut(date: string, hh = 10): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh, 0);
  // New York's offset at that instant, from the platform's own time-zone data
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23", day: "2-digit" }).formatToParts(new Date(guess));
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    const dd = Number(parts.find((p) => p.type === "day")?.value);
    const off = (h - hh + (dd !== d ? -24 : 0)) * 3_600_000; // NY minus UTC, e.g. −4h
    return guess - off;
  } catch {
    return guess + 4 * 3_600_000;
  }
}

/** The strike as listed in the series code ("1.1250"), else from the number. */
export function strikeOf(o: { series: string; strike: number }, digits: number) {
  const m = /^[A-Z0-9]{3,12}-\d{8}-([0-9]+(?:\.[0-9]+)?)-[CP]/.exec(o.series);
  return m ? m[1]! : strikeText(o.strike, digits);
}

/** A strike with the ladder's own decimals ("1.1250" on a 0.0025 ladder, "2650" on a 5.0 one). */
export function strikeLabelOf(u: string, strike: number) {
  const step = OPTION_SPEC[u]?.strikeStep;
  if (!step) return strikeText(strike, OPTION_SPEC[u]?.digits ?? 5);
  const s = String(step);
  const d = s.includes("e-") ? Number(s.split("e-")[1]) : s.includes(".") ? s.split(".")[1]!.length : 0;
  return strike.toFixed(Math.min(8, d));
}

/**
 * Values put into a translated sentence, each wrapped in a left-to-right isolate (U+2066 … U+2069): in Arabic, Persian
 * and Urdu sentences a price, an amount or "2d 21h" then keeps its own order instead of being pulled into the
 * right-to-left text around it ("2 بعد d 21h"). `count` stays a plain number (it picks the plural form).
 */
export function iso<V extends Record<string, string | number | null | undefined>>(vars: V): V {
  const out: Record<string, string | number | null | undefined> = {};
  for (const [k, v] of Object.entries(vars)) out[k] = k === "count" || v === null || v === undefined ? v : `⁦${v}⁩`;
  return out as V;
}
