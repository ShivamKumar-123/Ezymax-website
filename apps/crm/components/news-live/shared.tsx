"use client";

import * as React from "react";
import Link from "next/link";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Chip, SymbolAvatar, cn } from "@kalks/ui";
import { INSTRUMENT_MAP } from "@kalks/mock";
import type { CalEvent, NewsItem, Sentiment } from "./api";

export const SENT: Record<Sentiment, { tone: "up" | "down" | "neutral"; icon: React.ReactNode; label: string }> = {
  bullish: { tone: "up", icon: <TrendingUp className="size-3" />, label: "Positive" },
  bearish: { tone: "down", icon: <TrendingDown className="size-3" />, label: "Negative" },
  neutral: { tone: "neutral", icon: <Minus className="size-3" />, label: "Neutral" },
};

export const COUNTRY_NAME: Record<string, string> = {
  us: "United States", eu: "Euro area", de: "Germany", fr: "France", it: "Italy", es: "Spain", gb: "United Kingdom", jp: "Japan", au: "Australia",
  ca: "Canada", ch: "Switzerland", nz: "New Zealand", cn: "China", in: "India", sa: "Saudi Arabia", ru: "Russia", ir: "Iran", br: "Brazil",
  mx: "Mexico", kr: "South Korea", sg: "Singapore",
};

export const CATEGORY_LABEL: Record<string, string> = { macro: "Central banks & macro", forex: "Forex", metals: "Metals", indices: "Indices", energies: "Energy", crypto: "Crypto", stocks: "Stocks", markets: "Markets" };

/** Local photo per category (publisher images are never copied; cards use our own library). */
const COVER: Record<string, string[]> = {
  macro: ["/assets/photos/finance.jpg", "/assets/photos/skyscrapers.jpg", "/assets/photos/london.jpg", "/assets/photos/nyc.jpg"],
  forex: ["/assets/photos/money.jpg", "/assets/photos/charts.jpg"],
  metals: ["/assets/photos/gold.jpg"],
  indices: ["/assets/photos/stock-market.jpg", "/assets/photos/trading-screen.jpg"],
  energies: ["/assets/photos/dubai.jpg", "/assets/photos/skyline.jpg"],
  crypto: ["/assets/photos/bitcoin.jpg", "/assets/photos/crypto-coins.jpg", "/assets/photos/crypto.jpg"],
  stocks: ["/assets/photos/analytics.jpg", "/assets/photos/stock-market.jpg"],
  markets: ["/assets/photos/dashboard.jpg", "/assets/photos/trader.jpg", "/assets/photos/singapore.jpg"],
};
export function coverFor(n: Pick<NewsItem, "id" | "category">) {
  const list = COVER[n.category] ?? COVER.markets!;
  return list[n.id % list.length]!;
}

export function ago(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60 ? `${m % 60}m ` : ""}ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function Flag({ country, className }: { country: string; className?: string }) {
  if (!country) return null;
  return <span className={cn(`fi fis fi-${country} shrink-0 rounded-full`, className ?? "size-3.5")} aria-hidden />;
}

export function SymbolPill({ s, href }: { s: string; href?: string }) {
  if (!INSTRUMENT_MAP[s]) return <span className="rounded-full border border-line bg-surface-3 px-2 py-0.5 font-mono text-[10.5px] text-fg-2">{s}</span>;
  return (
    <Link target="_blank" rel="noopener" href={href ?? `/trade?symbol=${s}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 rounded-full border border-line bg-surface-3 py-0.5 pl-0.5 pr-2 font-mono text-[10.5px] text-fg-2 transition-colors hover:border-ember/40 hover:text-ember">
      <SymbolAvatar symbol={s} size={14} />
      {s}
    </Link>
  );
}

export function SentimentChip({ s, className }: { s: Sentiment; className?: string }) {
  return (
    <Chip size="sm" tone={SENT[s].tone} className={className}>
      {SENT[s].icon}
      {SENT[s].label}
    </Chip>
  );
}

export function ImpactBars({ impact, className }: { impact: number; className?: string }) {
  const color = impact === 3 ? "bg-down" : impact === 2 ? "bg-warn" : "bg-fg-2";
  return (
    <span className={cn("inline-flex items-end gap-[3px]", className)} aria-label={impact ? `Impact ${impact} of 3` : "Holiday"}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn("w-[4px] rounded-full", i <= impact ? color : "bg-surface-3")} style={{ height: 6 + i * 3 }} />
      ))}
    </span>
  );
}

export function ActualValue({ e }: { e: CalEvent }) {
  if (!e.actual) return <span className="text-fg-3">—</span>;
  return <span className={cn("font-semibold", e.surprise === 1 ? "text-up" : e.surprise === -1 ? "text-down" : "text-fg")}>{e.actual}</span>;
}

/** Server-time offset label, e.g. "GMT+3". */
export const gmt = (offset: number) => `GMT${offset >= 0 ? "+" : ""}${offset}`;

export function localTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Ticking "now" (every `ms`), null until mounted so SSR and the first client render agree. */
export function useNow(ms = 1000) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

/** Heat for the world map: tone per country (−1..1), damped for countries with few stories. */
export function heatOf(countries: { country: string; count: number; sentiment: number }[]) {
  const out: Record<string, number> = {};
  for (const c of countries) if (c.count > 0 && c.sentiment !== 0) out[c.country] = Math.max(-1, Math.min(1, c.sentiment * Math.min(1, c.count / 3)));
  return out;
}
