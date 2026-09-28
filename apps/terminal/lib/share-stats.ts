// Server-safe helpers for share pages (no React, no hooks): totals and formatting.
import { getInstrument } from "@kalks/mock";
import { pipSize } from "./trading";
import type { ShareTrade } from "./share";

export function tradePips(t: Pick<ShareTrade, "symbol" | "side" | "openPrice">, price: number) {
  const diff = t.side === "buy" ? price - t.openPrice : t.openPrice - price;
  return diff / pipSize(getInstrument(t.symbol));
}
export function tradePct(t: Pick<ShareTrade, "side" | "openPrice">, price: number) {
  return ((t.side === "buy" ? price - t.openPrice : t.openPrice - price) / t.openPrice) * 100;
}

export interface ShareTotals {
  open: number;
  pending: number;
  closed: number;
  wins: number;
  winRate: number | null;
  pips: number;
  pct: number;
  profit: number | null;
}

/** Totals over closed trades plus, optionally, live open results (`live[ticket] = { pips, pct, profit }`). */
export function shareTotals(trades: ShareTrade[], live: Record<string, { pips: number; pct: number; profit: number }> = {}, showAmounts = false): ShareTotals {
  const closed = trades.filter((t) => t.status === "closed" && t.closePrice !== undefined);
  const open = trades.filter((t) => t.status === "open");
  let pips = 0;
  let pct = 0;
  let profit = 0;
  let wins = 0;
  for (const t of closed) {
    const p = t.pips ?? tradePips(t, t.closePrice!);
    pips += p;
    pct += tradePct(t, t.closePrice!);
    profit += t.profit ?? 0;
    if ((t.profit ?? p) > 0) wins++;
  }
  for (const t of open) {
    const l = live[t.ticket];
    if (!l) continue;
    pips += l.pips;
    pct += l.pct;
    profit += l.profit;
  }
  return {
    open: open.length,
    pending: trades.filter((t) => t.status === "pending").length,
    closed: closed.length,
    wins,
    winRate: closed.length ? (wins / closed.length) * 100 : null,
    pips,
    pct,
    profit: showAmounts ? profit : null,
  };
}

/** Signed number; values that round to zero get no sign (never "−0.0"). */
export function signed(v: number, d = 1) {
  const r = Number(v.toFixed(d));
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
export function usd(v: number) {
  const r = Number(v.toFixed(2));
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}$${Math.abs(r).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "2d 4h", "3h 12m", "8m" */
export function duration(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${mm}m`;
  return `${mm}m`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Deterministic UTC date ("28 Sep 2026") so server and browser render the same text. */
export function dateLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
