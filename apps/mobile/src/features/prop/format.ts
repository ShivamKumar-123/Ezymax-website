// Prop money and labels. Money uses Latin tabular digits like every trading screen of the app (lib/format);
// dates follow the reader's language in broker server time (i18n formatter), the same clock as the rules.
import { i18n, type T } from "@/i18n";
import { fmtMoney } from "@/lib/format";

/** "$1,234.56"; `decimals` 0 for plan terms ("$500"). */
export const usd = (v: number | null | undefined, decimals = 2) => fmtMoney(v, { currency: "USD", decimals });

/** "+$12.30" / "−$4.00" / "$0.00". */
export const usdSigned = (v: number | null | undefined, decimals = 2) => fmtMoney(v, { currency: "USD", decimals, signed: true });

/** A fee as the plan prices it: whole dollars unless it has cents. */
export const feeLabel = (fee: number) => usd(fee, fee % 1 ? 2 : 0);

/** "$10K", "$200K", "$1.5M" (account sizes; the display face is uppercase anyway). */
export function sizeLabel(n: number): string {
  if (n >= 1_000_000) return `$${+(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${+(n / 1000).toFixed(1)}K`;
  return `$${n}`;
}

/** "8%", "2.5%". */
export const pct = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${+v.toFixed(d)}%`);

export const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : i18n.fmt.date(d);
}

/** A certificate's issue date: UTC, like the certificate itself and its public verify page. */
export function fmtCertDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : i18n.fmt.date(d, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : i18n.fmt.dateTime(d);
}

/** Compact trade duration: "42s", "3m 12s", "2h 5m", "1d 4h". */
export function fmtDuration(t: T, secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "—";
  if (secs < 60) return t("mobileProp.duration.s", { s: Math.round(secs) });
  if (secs < 3600) return t("mobileProp.duration.ms", { m: Math.floor(secs / 60), s: Math.round(secs % 60) });
  if (secs < 86400) return t("mobileProp.duration.hm", { h: Math.floor(secs / 3600), m: Math.floor((secs % 3600) / 60) });
  return t("mobileProp.duration.dh", { d: Math.floor(secs / 86400), h: Math.floor((secs % 86400) / 3600) });
}

/** "05:12:33" (countdowns; digits stay left-to-right in every language). */
export function hms(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "--:--:--";
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Next 17:00 New York, the prop trading day's reset (21:00 UTC during US daylight time, 22:00 UTC otherwise). */
export function nextNyClose(now = new Date()): Date {
  const y = now.getUTCFullYear();
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (n - 1) * 7;
  };
  const dstStart = Date.UTC(y, 2, nthSunday(2, 2), 7);
  const dstEnd = Date.UTC(y, 10, nthSunday(10, 1), 6);
  const hour = now.getTime() >= dstStart && now.getTime() < dstEnd ? 21 : 22;
  let at = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour);
  if (at <= now.getTime()) at += 86_400_000;
  return new Date(at);
}
