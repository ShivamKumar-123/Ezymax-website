// Formatting for the social screens. Money, percentages, NAV and units use Latin tabular digits (like the web
// and the terminal); dates follow the reader's language in server time (useFormat / i18n.fmt).
import { i18n, type T } from "@/i18n";
import { fmtMoney, fmtPct } from "@/lib/format";
import type { FeePeriod, MamMethod, MasterView, SizingMode, Sizing } from "./api";

const safe = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** "$1,234.56"; `signed` adds + / −. */
export const usd = (v: number | null | undefined, decimals = 2, signed = false) => fmtMoney(safe(v), { currency: "USD", decimals, signed });

/** "$1.2M" / "$45.1K" / "$950". */
export function compactUsd(v: number | null | undefined) {
  const n = safe(v);
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return usd(n, 0);
}

/** "+12.34%" / "−3.10%" / "0.00%". */
export const pct = (v: number | null | undefined, decimals = 2, signed = true) => fmtPct(safe(v), decimals, signed);

/** Drawdown as a negative percentage ("−7.9%"), "0.0%" when flat. */
export const ddText = (v: number | null | undefined, decimals = 1) => (safe(v) > 0 ? `−${safe(v).toFixed(decimals)}%` : `${(0).toFixed(decimals)}%`);

export const nav4 = (v: number | null | undefined) => safe(v).toFixed(4);
export const units4 = (v: number | null | undefined) => {
  const [i, f] = Math.abs(safe(v)).toFixed(4).split(".");
  return `${safe(v) < 0 ? "−" : ""}${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${f}`;
};
export const lots = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "—");

/** Tone of a money / return figure: green / red are for money only. */
export const moneyTone = (v: number | null | undefined): "up" | "down" | "secondary" => (safe(v) > 0 ? "up" : safe(v) < 0 ? "down" : "secondary");

export function formatAge(days: number | null | undefined, t: T = i18n.t) {
  const d = Math.max(0, Math.floor(safe(days)));
  if (d < 30) return t("mobileSocial.age.days", { d });
  const y = Math.floor(d / 365);
  const mo = Math.floor((d % 365) / 30.4);
  return y > 0 ? t("mobileSocial.age.yearsMonths", { y, mo }) : t("mobileSocial.age.months", { mo });
}

export const periodLabel = (p: FeePeriod, t: T = i18n.t) => t.dyn(`mobileSocial.period.${p}`, p);

export const SIZING_MODES: SizingMode[] = ["equity", "fixed_lot", "multiplier", "allocation"];
const SIZING_KEY: Record<SizingMode, "sizing.equity" | "sizing.fixedLot" | "sizing.multiplier" | "sizing.allocation"> = {
  equity: "sizing.equity",
  fixed_lot: "sizing.fixedLot",
  multiplier: "sizing.multiplier",
  allocation: "sizing.allocation",
};
export const sizingLabel = (m: SizingMode, t: T = i18n.t) => t(`mobileSocial.${SIZING_KEY[m]}`);

export function sizingText(s: Sizing | null | undefined, t: T = i18n.t) {
  if (!s) return "—";
  switch (s.mode) {
    case "equity":
      return t("mobileSocial.sizing.equity");
    case "fixed_lot":
      return t("mobileSocial.sizing.fixedLotValue", { lot: safe(s.value).toFixed(2) });
    case "multiplier":
      return t("mobileSocial.sizing.multiplierValue", { value: safe(s.value) });
    case "allocation":
      return t("mobileSocial.sizing.allocationValue", { amount: usd(s.value, 0) });
  }
}

export const methodLabel = (m: MamMethod, t: T = i18n.t) => t.dyn(`mobileSocial.mam.method.${m}`, m);
export const methodHint = (m: MamMethod, t: T = i18n.t) => t.dyn(`mobileSocial.mam.methodHint.${m}`, "");

export function mamFeesText(m: { perfFeePct: number; mgmtFeePct: number; feePeriod: FeePeriod }, t: T = i18n.t) {
  const period = periodLabel(m.feePeriod, t).toLowerCase();
  return m.mgmtFeePct > 0 ? t("mobileSocial.mam.feesTextMgmt", { perf: m.perfFeePct, mgmt: m.mgmtFeePct, period }) : t("mobileSocial.mam.feesText", { perf: m.perfFeePct, period });
}

export type RiskLevel = "low" | "medium" | "high";
export const riskLevel = (r: number): RiskLevel => (r <= 3 ? "low" : r <= 6 ? "medium" : "high");
export const clampRisk = (r: number | null | undefined) => Math.max(1, Math.min(10, Math.round(safe(r) || 1)));

/** A master's return for a leaderboard period. */
export const periodReturn = (m: MasterView, p: "1m" | "3m" | "1y" | "all") => (p === "1m" ? m.stats.return1m : p === "3m" ? m.stats.return3m : p === "1y" ? m.stats.return1y : m.stats.returnAll);

/** Follower lot for a 1.00-lot master trade (rounded down to 0.01, capped by the max lot), like the web wizard. */
export function exampleLot(mode: SizingMode, value: number, allocation: number, masterEquity: number, maxLot: number | null) {
  const me = masterEquity > 0 ? masterEquity : 0;
  let v = mode === "equity" ? (me ? allocation / me : 0) : mode === "allocation" ? (me ? value / me : 0) : value;
  v = Math.floor(v * 100 + 1e-9) / 100;
  if (maxLot && v > maxLot) v = maxLot;
  return v;
}

/** Parses a decimal typed on a phone keyboard ("1,5" in some locales). null when empty or invalid. */
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  if (!/^\d*\.?\d*$/.test(s) || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Keeps only digits and one decimal separator while typing (max `decimals` places). */
export function cleanAmount(raw: string, decimals = 2) {
  let s = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot >= 0)
    s =
      s.slice(0, dot + 1) +
      s
        .slice(dot + 1)
        .replace(/\./g, "")
        .slice(0, decimals);
  if (decimals === 0) s = s.replace(".", "");
  return s.replace(/^0+(?=\d)/, "");
}
