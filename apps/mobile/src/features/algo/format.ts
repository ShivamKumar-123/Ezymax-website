// Formatting for the Algo screens. Money and ratios use Latin digits and fixed decimals (tabular), like the trading
// screens; dates follow the reader's language in server time (the platform's day, GMT+3). Pure (no React Native).
import type { MessageKey, T } from "@/i18n";
import type { Formatter } from "@kalks/i18n/format";
import { fmtMoney, fmtPct } from "@/lib/format";
import type { BacktestStatus, Deployment, DeploymentStatus } from "./api";

export type Tone = "neutral" | "ember" | "gold" | "sand" | "cream" | "up" | "down" | "warn" | "info";

/** USD with a sign when asked: "+$1,234.50", "−$12.00". */
export const usd = (v: number | null | undefined, signed = false, decimals = 2) => fmtMoney(v, { currency: "USD", signed, decimals });

/** A percentage with a real minus sign: "+2.11%", "−3.13%" (unsigned: "24.14%"). */
export const pct = (v: number | null | undefined, decimals = 2, signed = true) => fmtPct(v, decimals, signed);

/** Ratios (profit factor, Sharpe, payoff): two decimals, a real minus, a dash when there is none. */
export function ratio(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (Math.abs(v) < 0.5 / 10 ** decimals) v = 0;
  return `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(decimals)}`;
}

/** A plain number with Latin digits and grouping: 15899 -> "15,899". */
export function int(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return Math.round(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 0.10 -> "0.1", 25 -> "25", 1.5 -> "1.5" (Latin digits, like prices). */
export function num(v: number | null | undefined, max = 5): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return String(Number(v.toFixed(max)));
}

/** Money colour tone of a figure: green up, red down, neutral at zero. */
export const moneyTone = (v: number | null | undefined): "up" | "down" | "secondary" => (!v || !Number.isFinite(v) ? "secondary" : v > 0 ? "up" : "down");

/** Realized P&L of a deployment (the service keeps it in `stats`). */
export const realizedOf = (d: Pick<Deployment, "stats">) => Number(d.stats?.realized ?? 0) || 0;
export const tradesOf = (d: Pick<Deployment, "stats">) => Number(d.stats?.trades ?? 0) || 0;
export const winsOf = (d: Pick<Deployment, "stats">) => Number(d.stats?.wins ?? 0) || 0;
export const winRateOf = (d: Pick<Deployment, "stats">) => (tradesOf(d) > 0 ? (winsOf(d) / tradesOf(d)) * 100 : null);

/** Running or paused: the deployment is alive (controls apply). */
export const isLive = (s: DeploymentStatus) => s === "running" || s === "paused";

// green / red stay for money: a killed deployment is a stopped one, an error is a warning
export const DEP_TONE: Record<DeploymentStatus, Tone> = { running: "ember", paused: "gold", stopped: "neutral", killed: "neutral", error: "warn" };
export const DEP_LABEL: Record<DeploymentStatus, MessageKey> = {
  running: "mobileAlgo.dep.status.running",
  paused: "mobileAlgo.dep.status.paused",
  stopped: "mobileAlgo.dep.status.stopped",
  killed: "mobileAlgo.dep.status.killed",
  error: "mobileAlgo.dep.status.error",
};
export const depLabel = (t: T, s: string) => (s in DEP_LABEL ? t(DEP_LABEL[s as DeploymentStatus]) : s);

export const BT_TONE: Record<BacktestStatus, Tone> = { queued: "neutral", running: "ember", done: "neutral", failed: "warn", cancelled: "neutral" };
export const btLabel = (t: T, s: string) => t.dyn(`mobileAlgo.bt.status.${s}`, s);

/** Account kind words: "Demo" / "Live". */
export const kindLabel = (t: T, type: string) => (type === "live" ? t("common.live") : t("common.demo"));

/** "Demo · 50000083" */
export const accountLabel = (t: T, type: string, login: number | null | undefined) => `${kindLabel(t, type)} · ${login ?? "—"}`;

/** "verified live · 12.4 days" (a track younger than a day: "verified live · under a day"). */
export function verifiedLine(t: T, type: string, days: number): string {
  const kind = kindLabel(t, type).toLowerCase();
  return days < 1 ? t("mobileAlgo.market.verifiedNew", { type: kind }) : t("mobileAlgo.market.verifiedDays", { type: kind, days: Number(days.toFixed(1)) });
}

/** The strategy's origin in words (AI, template, marketplace, manual). */
export const originLabel = (t: T, origin: string) => t.dyn(`mobileAlgo.origin.${origin}`, origin);

/** Exit reason of a trade in words (sl, tp, trailing, rule exit, session close…). */
export const exitLabel = (t: T, reason: string | null | undefined) => {
  const r = (reason ?? "").trim();
  if (!r) return "—";
  return t.dyn(`mobileAlgo.exit.${r}`, r.replace(/_/g, " "));
};

/** Backtest stage the service reports while it runs, in words. */
export function stageText(t: T, stage: string | null | undefined, status: BacktestStatus): string {
  if (status === "queued") return t("mobileAlgo.bt.stage.queued");
  const s = (stage ?? "").toLowerCase();
  if (/^loading m1/.test(s)) return t("mobileAlgo.bt.stage.m1");
  if (/^loading/.test(s)) return t("mobileAlgo.bt.stage.loading");
  if (/^simulat/.test(s)) return t("mobileAlgo.bt.stage.simulating");
  if (/^requeued/.test(s)) return t("mobileAlgo.bt.stage.queued");
  return t("mobileAlgo.bt.stage.running");
}

/** Unix seconds or ISO -> milliseconds. */
export const ms = (v: number | string) => (typeof v === "number" ? v * 1000 : new Date(v).getTime());

/** "30 Mar 2026" (server day). */
export const day = (f: Formatter, v: number | string | null | undefined) => (v === null || v === undefined ? "—" : f.date(ms(v)));

/** "30 Mar – 29 Sep 2026": a tested range, compact. */
export function range(f: Formatter, from: number | string, to: number | string): string {
  const a = new Date(ms(from));
  const b = new Date(ms(to));
  const sameYear = f.date(a, { year: "numeric" }) === f.date(b, { year: "numeric" });
  const left = sameYear ? f.date(a, { day: "numeric", month: "short" }) : f.date(a);
  return `${left} – ${f.date(b)}`;
}

/** A tested range for a list row: "30 Mar – 29 Sep" within one year, "Oct 24 – Sep 26" across years. */
export function rangeShort(f: Formatter, from: number | string, to: number | string): string {
  const a = new Date(ms(from));
  const b = new Date(ms(to));
  if (f.date(a, { year: "numeric" }) === f.date(b, { year: "numeric" })) return `${f.date(a, { day: "numeric", month: "short" })} – ${f.date(b, { day: "numeric", month: "short" })}`;
  return `${f.date(a, { month: "short", year: "2-digit" })} – ${f.date(b, { month: "short", year: "2-digit" })}`;
}

/** "5 min ago" / "never". */
export const ago = (t: T, f: Formatter, iso: string | null | undefined) => (iso ? f.relative(iso) : t("mobileAlgo.never"));

/** A compact duration of held bars / days: "3.5 d". */
export const daysText = (t: T, d: number) => t("mobileAlgo.days", { n: d >= 10 ? Math.round(d) : Number(d.toFixed(1)) });

/** How long a trade was held, compact: "45m", "5h", "5h 20m", "3d 14h". */
export function held(t: T, seconds: number): string {
  const m = Math.max(0, Math.round(seconds / 60));
  if (m < 60) return t("mobileAlgo.dur.m", { m });
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm ? t("mobileAlgo.dur.hm", { h, m: rm }) : t("mobileAlgo.dur.h", { h });
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? t("mobileAlgo.dur.dh", { d, h: rh }) : t("mobileAlgo.dur.d", { d });
}

/** Weekday names (0 = Sunday), short, in the reader's language. */
export function weekday(f: Formatter, d: number): string {
  // 2026-01-04 is a Sunday
  return f.date(Date.UTC(2026, 0, 4 + d, 12), { weekday: "short", timeZone: "UTC" });
}
