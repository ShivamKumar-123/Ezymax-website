// Pure helpers for the partner (IB) screens (no React Native, no app state, so node tests run them): USD with tabular
// Latin digits (like the trading screens), lots, rates, week buckets, durations, the server's enums in words,
// commission lines, referral links and the campaign slug rule of services/ib.
import type { T } from "@kalks/i18n/core";
import { fmtMoney } from "@/lib/format";
import type { CommissionRow } from "./types";

/** "$1,234.56" / "−$12.00" (+ sign when `signed`). */
export const usd = (v: number | null | undefined, signed = false, decimals = 2) => fmtMoney(v, { currency: "USD", signed, decimals });

/** Whole dollars when the amount is whole: "$200", "$13.50". */
export const usdShort = (v: number) => fmtMoney(v, { currency: "USD", decimals: Math.abs(v % 1) > 0.0001 ? 2 : 0 });

/** Lots with a fixed number of decimals (tabular). */
export function lots(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 12.5 -> "12.5%", 12 -> "12%". */
export function pct(v: number): string {
  return `${Number.isInteger(v) ? v : +v.toFixed(2)}%`;
}

/** "$5" / "$13.50" per lot. */
export const rate = (v: number) => `$${v % 1 ? v.toFixed(2) : v.toFixed(0)}`;

/** Whole counts with grouping ("1,204"). */
export const count = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const valid = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const DAY_MS = 86_400_000;

/**
 * The last `n` weeks (Monday 00:00 UTC starts, oldest first) with the amounts of `weekly` (the IB service lists
 * only weeks with commission), so a quiet week still gets its bar.
 */
export function lastWeeks(weekly: { week: string; amount: number }[], n = 12, now = Date.now()): { key: string; value: number }[] {
  const d = new Date(now);
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS;
  const byWeek = new Map<number, number>();
  for (const w of weekly) {
    const t = Date.parse(w.week);
    if (Number.isFinite(t)) byWeek.set(t, (byWeek.get(t) ?? 0) + w.amount);
  }
  return Array.from({ length: n }, (_, i) => {
    const start = monday - (n - 1 - i) * 7 * DAY_MS;
    return { key: new Date(start).toISOString(), value: byWeek.get(start) ?? 0 };
  });
}

/** "just now", "5m ago", "3h ago", "12d ago", "4mo ago" (Hermes has no Intl.RelativeTimeFormat). */
export function ago(t: T, iso: string | null | undefined, now = Date.now()): string {
  const d = valid(iso);
  if (!d) return "—";
  const m = Math.round((now - d.getTime()) / 60000);
  if (m < 1) return t("mobilePartner.time.justNow");
  if (m < 60) return t("mobilePartner.time.minutes", { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t("mobilePartner.time.hours", { n: h });
  const days = Math.round(h / 24);
  if (days < 45) return t("mobilePartner.time.days", { n: days });
  return t("mobilePartner.time.months", { n: Math.round(days / 30) });
}

/**
 * Holding time of a trade: "45s", "1m 40s", "12m", "2h 5m", "1d 4h". Minutes are never rounded up, and seconds show
 * under ten minutes, so a trade held 1m 50s never reads "2m" next to "held too briefly" (the minimum is often 2 min).
 */
export function held(t: T, ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return t("mobilePartner.dur.s", { s });
  if (s < 600 && s % 60) return t("mobilePartner.dur.ms", { m: Math.floor(s / 60), s: s % 60 });
  if (s < 3600) return t("mobilePartner.dur.m", { m: Math.floor(s / 60) });
  const h = Math.floor(s / 3600);
  return h < 24 ? t("mobilePartner.dur.hm", { h, m: Math.round((s % 3600) / 60) }) : t("mobilePartner.dur.dh", { d: Math.floor(h / 24), h: h % 24 });
}

/** A duration setting in words: "2 min" / "90 sec". */
export function minHold(t: T, seconds: number): string {
  return seconds >= 60 ? t("mobilePartner.unit.min", { n: +(seconds / 60).toFixed(1) }) : t("mobilePartner.unit.sec", { n: seconds });
}

/* ------------------------------------------------------------------ */
/* Server enums in words                                               */
/* ------------------------------------------------------------------ */

export const kindLabel = (t: T, k: string) => t.dyn(`mobilePartner.kind.${k}`, k.replace(/_/g, " "));
export const statusLabel = (t: T, s: string) => t.dyn(`mobilePartner.status.${s}`, s.replace(/_/g, " "));
export const scheduleLabel = (t: T, s: string) => t.dyn(`mobilePartner.schedule.${s}`, s);
export const payoutStatusLabel = (t: T, s: string) => t.dyn(`mobilePartner.payout.status.${s}`, s.replace(/_/g, " "));
export const clientStatusLabel = (t: T, s: string) => t.dyn(`mobilePartner.clientStatus.${s}`, s);
export const kycLabel = (t: T, s: string) => t.dyn(`mobilePartner.kyc.${s}`, s.replace(/_/g, " "));

/** Why a deal earned nothing, in words (the IB service's reason codes; unknown codes are humanised). */
export const reasonLabel = (t: T, r: string | null) => (r ? t.dyn(`mobilePartner.reason.${r}`, r.replace(/_/g, " ")) : t("mobilePartner.reason.notEligible"));

/**
 * One line describing a commission: "EURUSD · 0.50 lot · L1", "CPA bonus", "Sub-IB split · EURUSD · L2".
 * `compact` (narrow cards) leaves the tier out; the ledger and the line's sheet show it.
 */
export function commissionLine(t: T, e: CommissionRow, compact = false): string {
  const lot = (v: number) => t("mobilePartner.line.lots", { lots: lots(v) });
  const tier = compact ? null : `L${e.tier}`;
  if (e.kind === "cpa") return kindLabel(t, "cpa");
  if (e.kind === "lot") return [e.symbol ?? t("mobilePartner.line.trade"), lot(e.lots), tier].filter(Boolean).join(" · ");
  if (e.kind === "split") return [kindLabel(t, "split"), e.symbol, tier].filter(Boolean).join(" · ");
  if (e.kind === "rebate") return [kindLabel(t, "rebate"), e.symbol, e.lots ? lot(e.lots) : null].filter(Boolean).join(" · ");
  return kindLabel(t, e.kind);
}

/** The rate a line was paid at: "$5 × 20%", "Fixed", "20% of the tier-2 amount". */
export function rateText(t: T, e: CommissionRow): string {
  if (e.kind === "cpa") return t("mobilePartner.com.rateFixed");
  if (e.kind === "split") return t("mobilePartner.com.rateSplit", { pct: pct(e.sharePct) });
  if (e.kind === "rebate") return t("mobilePartner.com.rateRebate", { pct: pct(e.sharePct) });
  if (e.kind === "lot") return `${rate(e.rate)}${e.sharePct !== 100 ? ` × ${pct(e.sharePct)}` : ""}`;
  return "—";
}

/** Referral links: /r/CODE[/campaign] on the broker's Client Area (recorded as a click, then the sign-up form). */
export const referralLink = (base: string, code: string) => `${base.replace(/\/+$/, "")}/r/${code}`;
export const campaignLink = (base: string, code: string, slug: string) => (slug ? `${referralLink(base, code)}/${slug}` : referralLink(base, code));
export const shortUrl = (u: string) => u.replace(/^https?:\/\//, "");

/** The slug the IB service derives from a campaign name (services/ib slugify: lowercase ASCII letters and digits,
 *  anything else one "-", trimmed, at most 40 characters). */
export function slugOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** A slug a partner types (services/ib clean_slug): 1–40 letters, digits, - or _. */
export const SLUG_RE = /^[A-Za-z0-9_-]{1,40}$/;
