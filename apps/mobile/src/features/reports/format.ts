// Formatting for the reports screens: USD amounts with tabular Latin digits (like the trading screens), holding
// times, weekday / session names and the behaviour insights in the reader's language.
import type { MessageKey, T } from "@/i18n";
import { fmtMoney } from "@/lib/format";
import type { Analytics, Insight } from "./types";

/** "$1,234.56" / "−$12.00" (+ sign when `signed`). */
export const usd = (v: number | null | undefined, signed = false) => fmtMoney(v, { currency: "USD", signed });

/** Short signed amount for tight cells: +8.21, −123, +1.2K, +34K, +1.2M. */
export function compactUsd(v: number): string {
  const a = Math.abs(v);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  if (a < 0.005) return "0";
  if (a < 100) return `${sign}${a.toFixed(2)}`;
  if (a < 1000) return `${sign}${a.toFixed(0)}`;
  if (a < 10_000) return `${sign}${(a / 1000).toFixed(1)}K`;
  if (a < 1_000_000) return `${sign}${(a / 1000).toFixed(0)}K`;
  return `${sign}${(a / 1_000_000).toFixed(1)}M`;
}

export function pct(v: number | null | undefined, decimals = 2, signed = false): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = Math.abs(v).toFixed(decimals);
  return `${v < 0 && Number(s) !== 0 ? "−" : signed && v > 0 ? "+" : ""}${s}%`;
}

/** Holding time: 2d 4h, 3h 12m, 45m, 30s (portfolio.an.hold.*). */
export function fmtHold(t: T, secs: number): string {
  if (!secs || !Number.isFinite(secs)) return "—";
  const m = Math.round(secs / 60);
  if (m >= 1440) return t("portfolio.an.hold.dh", { d: Math.floor(m / 1440), h: Math.floor((m % 1440) / 60) });
  if (m >= 60) return t("portfolio.an.hold.hm", { h: Math.floor(m / 60), m: m % 60 });
  return m ? t("portfolio.an.hold.m", { m }) : t("portfolio.an.hold.s", { s: Math.round(secs) });
}

/** Monday first, like the service's weekday groups ("0" = Monday). */
export const DAY_KEYS = ["portfolio.an.day.mon", "portfolio.an.day.tue", "portfolio.an.day.wed", "portfolio.an.day.thu", "portfolio.an.day.fri", "portfolio.an.day.sat", "portfolio.an.day.sun"] as const satisfies readonly MessageKey[];

const SESSION_KEYS: Record<string, MessageKey> = {
  Asia: "mobileReports.an.session.asia",
  London: "mobileReports.an.session.london",
  "London / New York": "mobileReports.an.session.overlap",
  "New York": "mobileReports.an.session.newYork",
  "Late New York": "mobileReports.an.session.lateNewYork",
};

/** The service's session names in the reader's language (unknown names are kept). */
export const sessionName = (t: T, s: string) => (SESSION_KEYS[s] ? t(SESSION_KEYS[s]!) : s);

export type InsightView = { id: string; tone: Insight["tone"]; title: string; stat: string; text: string; tip: string; /** the stat is money (P&L colours) */ money?: number };

/**
 * A behaviour insight in the reader's language. The service builds the same sentences in English from the numbers
 * in `behaviour` / `stats` / `bySession`; the app formats them from those numbers so every language gets them.
 * Unknown insight ids (a newer service) keep the service's text.
 */
export function insightView(t: T, ins: Insight, d: Analytics): InsightView {
  const b = d.behaviour;
  const s = d.stats;
  const base = { id: ins.id, tone: ins.tone };
  switch (ins.id) {
    case "overtrading": {
      const m = b.normalDayMedianTrades;
      return {
        ...base,
        title: t("mobileReports.insight.overtrading.title", { count: b.overtradingDays }),
        stat: usd(b.overtradingNet),
        money: b.overtradingNet,
        text: t("mobileReports.insight.overtrading.text", { limit: Math.max(m * 2, m + 3).toFixed(0), median: m.toFixed(0), net: usd(b.overtradingNet) }),
        tip: t("mobileReports.insight.overtrading.tip", { cap: Math.max(Math.ceil(m * 1.5), 3) }),
      };
    }
    case "revenge":
      return {
        ...base,
        title: t("mobileReports.insight.revenge.title", { count: b.revengeTrades }),
        stat: usd(b.revengeNet),
        money: b.revengeNet,
        text: t("mobileReports.insight.revenge.text", { rate: b.revengeWinRate.toFixed(0), net: usd(b.revengeNet) }),
        tip: t("mobileReports.insight.revenge.tip"),
      };
    case "risk":
      return {
        ...base,
        title: t("mobileReports.insight.risk.title"),
        stat: `${b.avgRiskPct.toFixed(1)}%`,
        text: t("mobileReports.insight.risk.text", { avg: b.avgRiskPct.toFixed(2), max: b.maxRiskPct.toFixed(2), count: b.tradesOver2pct }),
        tip: t("mobileReports.insight.risk.tip"),
      };
    case "hold_losers":
      return {
        ...base,
        title: t("mobileReports.insight.holdLosers.title"),
        stat: `${(s.avgHoldLossSecs / Math.max(s.avgHoldWinSecs, 1)).toFixed(1)}x`,
        text: t("mobileReports.insight.holdLosers.text", { loss: fmtHold(t, s.avgHoldLossSecs), win: fmtHold(t, s.avgHoldWinSecs) }),
        tip: t("mobileReports.insight.holdLosers.tip"),
      };
    case "stop_out":
      return {
        ...base,
        title: t("mobileReports.insight.stopOut.title", { count: b.stopOuts }),
        stat: String(b.stopOuts),
        text: t("mobileReports.insight.stopOut.text"),
        tip: t("mobileReports.insight.stopOut.tip"),
      };
    case "sl_tp":
      return {
        ...base,
        title: t("mobileReports.insight.slTp.title"),
        stat: `${(((b.closedBySl + b.closedByTp) / Math.max(1, s.trades)) * 100).toFixed(0)}%`,
        text: t("mobileReports.insight.slTp.text", { tp: b.closedByTp, sl: b.closedBySl }),
        tip: t("mobileReports.insight.slTp.tip"),
      };
    case "session": {
      const traded = d.bySession.filter((x) => x.trades > 0);
      const best = traded.reduce<(typeof traded)[number] | undefined>((a, x) => (!a || x.net > a.net ? x : a), undefined);
      const worst = traded.reduce<(typeof traded)[number] | undefined>((a, x) => (!a || x.net < a.net ? x : a), undefined);
      if (!best || !worst) break;
      return {
        ...base,
        title: t("mobileReports.insight.session.title", { session: sessionName(t, best.session) }),
        stat: usd(best.net),
        money: best.net,
        text: t("mobileReports.insight.session.text", { trades: best.trades, rate: best.winRate.toFixed(0), worst: sessionName(t, worst.session), net: usd(worst.net) }),
        tip: t("mobileReports.insight.session.tip", { session: sessionName(t, best.session) }),
      };
    }
  }
  return { ...base, title: ins.title, stat: ins.stat, text: ins.text, tip: ins.tip };
}
