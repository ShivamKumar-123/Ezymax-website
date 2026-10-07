"use client";

// Live News and Calendar toolbox tabs (services/news through /api/news). Same feed as the Client Area
// dashboard, news page and world map; staff pins / hides apply here too.

import * as React from "react";
import { ExternalLink, Newspaper, RefreshCw, CalendarDays } from "lucide-react";
import { Flag, cn } from "@kalks/ui";
import { ALL_INSTRUMENTS } from "@kalks/mock";
import { useTerminal } from "@/lib/store";
import { Td, Th } from "@/components/ui/panel";
import { Badge, Empty } from "@/components/ui/primitives";

type NewsItem = {
  id: number;
  title: string;
  summary: string;
  link: string;
  source: { name: string };
  publishedAt: string;
  countries: string[];
  currencies: string[];
  symbols: string[];
  sentiment: "bullish" | "bearish" | "neutral";
  importance: number;
  pinned: boolean;
};
type CalEvent = {
  id: number;
  title: string;
  currency: string;
  country: string;
  startsAt: string;
  serverDate: string;
  serverTime: string;
  allDay: boolean;
  impact: number;
  forecast: string;
  previous: string;
  actual: string;
  surprise: number;
  symbols: string[];
};

const KNOWN = new Set(ALL_INSTRUMENTS.map((i) => i.symbol));
const CCYS = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"];

/** Currencies of a Kalks symbol (EURUSD → EUR, USD; XAUUSD → USD; indices by country). */
function symbolCurrencies(s: string): string[] {
  if (/^[A-Z]{6}$/.test(s)) return [s.slice(0, 3), s.slice(3)].filter((c) => CCYS.includes(c));
  if (s.endsWith("USD")) return ["USD"];
  const byIndex: Record<string, string> = { GER40: "EUR", UK100: "GBP", JP225: "JPY" };
  return [byIndex[s] ?? "USD"];
}

function useJson<T>(url: string, refreshMs: number) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const ctl = new AbortController();
    fetch(url, { cache: "no-store", signal: ctl.signal })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error?.message ?? "News is unavailable right now.");
        setData(j as T);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      });
    return () => ctl.abort();
  }, [url, tick]);
  React.useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && setTick((x) => x + 1), refreshMs);
    return () => clearInterval(t);
  }, [refreshMs]);
  return { data, error, reload: () => setTick((x) => x + 1) };
}

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
}

function Chip({ on, onClick, children, testId }: { on: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button data-testid={testId} onClick={onClick} className={cn("flex h-6 shrink-0 items-center gap-1 rounded-[5px] border px-2 text-[11px] transition-colors", on ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-2 hover:bg-surface-3 hover:text-fg")}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* News                                                                */
/* ------------------------------------------------------------------ */

export function LiveNewsTab() {
  const T = useTerminal();
  const [scope, setScope] = React.useState<"all" | "symbol" | string>("all");
  const [open, setOpen] = React.useState<number | null>(null);
  const qs = new URLSearchParams({ limit: "40" });
  if (scope === "symbol") qs.set("symbol", T.activeSymbol);
  else if (scope !== "all") qs.set("currency", scope);
  const feed = useJson<{ pinned: NewsItem[]; items: NewsItem[] }>(`/api/news/feed?${qs}`, 120_000);
  const items = [...(feed.data?.pinned ?? []), ...(feed.data?.items ?? [])];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="t-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-2 py-1.5">
        <Chip on={scope === "all"} onClick={() => setScope("all")}>
          All
        </Chip>
        <Chip on={scope === "symbol"} onClick={() => setScope("symbol")} testId="news-scope-symbol">
          {T.activeSymbol}
        </Chip>
        <span className="mx-1 h-4 w-px bg-line" />
        {CCYS.map((c) => (
          <Chip key={c} on={scope === c} onClick={() => setScope(scope === c ? "all" : c)}>
            {c}
          </Chip>
        ))}
        <button onClick={feed.reload} aria-label="Refresh news" className="ml-auto grid size-6 shrink-0 place-items-center rounded-[5px] text-fg-3 hover:bg-surface-3 hover:text-fg">
          <RefreshCw className="size-3.5" />
        </button>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-auto p-2">
        {!feed.data && !feed.error && <Empty icon={<Newspaper />} title="Loading headlines…" />}
        {feed.error && !feed.data && <Empty icon={<Newspaper />} title={feed.error} />}
        {feed.data && items.length === 0 && <Empty icon={<Newspaper />} title="No headlines" sub={scope === "symbol" ? `Nothing tagged ${T.activeSymbol} yet.` : undefined} />}
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2 2xl:grid-cols-3">
          {items.map((n) => {
            const expanded = open === n.id;
            return (
              <div key={n.id} data-testid="terminal-news-item" className={cn("rounded-[7px] border bg-surface-2/40 p-2 transition-colors", expanded ? "border-line-top bg-surface-2" : "border-line hover:border-line-top hover:bg-surface-2")}>
                <button className="block w-full text-left" onClick={() => setOpen(expanded ? null : n.id)}>
                  <div className="flex items-center gap-1.5 text-[10px] text-fg-3">
                    {n.countries.slice(0, 2).map((c) => (
                      <Flag key={c} country={c} className="size-3" />
                    ))}
                    <span className="truncate">{n.source.name}</span>
                    <span className="shrink-0">· {ago(n.publishedAt)}</span>
                    {n.pinned && (
                      <Badge tone="ember" className="h-4 text-[8.5px]">
                        pinned
                      </Badge>
                    )}
                    {n.sentiment !== "neutral" && (
                      <Badge tone={n.sentiment === "bullish" ? "up" : "down"} className="ml-auto h-4 text-[8.5px]">
                        {n.sentiment === "bullish" ? "positive" : "negative"}
                      </Badge>
                    )}
                  </div>
                  <div className={cn("mt-1 text-[12px] font-medium leading-[1.3] text-fg", !expanded && "line-clamp-2")}>{n.title}</div>
                </button>
                {expanded && n.summary && <p className="mt-1 text-[11.5px] leading-[1.4] text-fg-2">{n.summary}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {n.symbols.slice(0, expanded ? 6 : 3).map((s) =>
                    KNOWN.has(s) ? (
                      <button key={s} onClick={() => T.openSymbol(s)} className="rounded-[3px] bg-surface-3 px-1 font-mono text-[9.5px] text-fg-2 hover:text-ember" title={`Open ${s} chart`}>
                        {s}
                      </button>
                    ) : (
                      <span key={s} className="rounded-[3px] bg-surface-3 px-1 font-mono text-[9.5px] text-fg-2">
                        {s}
                      </span>
                    ),
                  )}
                  {expanded && n.link && (
                    <a href={n.link} target="_blank" rel="noopener noreferrer nofollow" className="ml-auto flex items-center gap-1 text-[11px] text-fg-3 hover:text-fg">
                      Read at {n.source.name} <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export function LiveCalendarTab() {
  const T = useTerminal();
  const [impacts, setImpacts] = React.useState<number[]>([2, 3]);
  const [ccy, setCcy] = React.useState<"all" | "symbol" | string>("all");
  const cal = useJson<{ events: CalEvent[]; serverOffset: number }>("/api/news/calendar", 300_000);
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const symCcys = symbolCurrencies(T.activeSymbol);
  const offset = cal.data?.serverOffset ?? 3;
  const today = new Date(now + offset * 3600e3).toISOString().slice(0, 10);
  const events = (cal.data?.events ?? []).filter(
    (e) => (impacts.includes(e.impact) || (e.impact === 0 && impacts.includes(1))) && (ccy === "all" || (ccy === "symbol" ? symCcys.includes(e.currency) : e.currency === ccy)) && e.serverDate >= today,
  );
  const toggle = (i: number) => setImpacts((x) => (x.includes(i) ? (x.length > 1 ? x.filter((y) => y !== i) : x) : [...x, i]));
  let lastDay = "";
  let nowShown = false;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="t-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-2 py-1.5">
        {[3, 2, 1].map((i) => (
          <Chip key={i} on={impacts.includes(i)} onClick={() => toggle(i)} testId={`impact-${i}`}>
            <span className="flex gap-0.5">
              {[1, 2, 3].map((k) => (
                <span key={k} className={cn("h-2 w-[3px] rounded-[1px]", k <= i ? (i === 3 ? "bg-down" : i === 2 ? "bg-warn" : "bg-fg-3") : "bg-surface-3")} />
              ))}
            </span>
            {i === 3 ? "High" : i === 2 ? "Medium" : "Low"}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        <Chip on={ccy === "all"} onClick={() => setCcy("all")}>
          All
        </Chip>
        <Chip on={ccy === "symbol"} onClick={() => setCcy("symbol")}>
          {T.activeSymbol} ({symCcys.join("/")})
        </Chip>
        {CCYS.map((c) => (
          <Chip key={c} on={ccy === c} onClick={() => setCcy(ccy === c ? "all" : c)}>
            {c}
          </Chip>
        ))}
        <span className="ml-auto shrink-0 pl-2 text-[10.5px] text-fg-3">Server time GMT+{offset}</span>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-auto">
        {!cal.data && !cal.error && <Empty icon={<CalendarDays />} title="Loading calendar…" />}
        {cal.error && !cal.data && <Empty icon={<CalendarDays />} title={cal.error} />}
        {cal.data && events.length === 0 && <Empty icon={<CalendarDays />} title="No events for these filters this week" />}
        {events.length > 0 && (
          <table className="w-full min-w-[760px] border-separate border-spacing-0">
            <thead>
              <tr>
                <Th className="pl-3">Time</Th>
                <Th>Ccy</Th>
                <Th>Impact</Th>
                <Th>Event</Th>
                <Th right>Actual</Th>
                <Th right>Forecast</Th>
                <Th right>Previous</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const rows: React.ReactNode[] = [];
                if (e.serverDate !== lastDay) {
                  lastDay = e.serverDate;
                  rows.push(
                    <tr key={`d-${e.serverDate}`}>
                      <td colSpan={7} className="border-b border-line bg-panel-2/60 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-fg-3">
                        {e.serverDate === today ? "Today" : new Date(`${e.serverDate}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}
                      </td>
                    </tr>,
                  );
                }
                const past = Date.parse(e.startsAt) <= now;
                if (!past && !nowShown && e.serverDate === today) {
                  nowShown = true;
                  rows.push(
                    <tr key="now">
                      <td colSpan={7} className="h-0 border-b border-ember/60 p-0" />
                    </tr>,
                  );
                }
                rows.push(
                  <tr key={e.id} data-testid="terminal-calendar-row" className={cn("hover:bg-surface-2/70", past && "opacity-70")}>
                    <Td mono className={cn("pl-3", e.impact === 3 ? "shadow-[inset_3px_0_0_var(--k-down)]" : e.impact === 2 ? "shadow-[inset_3px_0_0_var(--k-warn)]" : "shadow-[inset_3px_0_0_var(--k-surface-3)]")}>
                      {e.allDay ? "All day" : e.serverTime}
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <Flag country={e.country} className="size-3.5" />
                        <span className="font-mono text-[11px]">{e.currency}</span>
                      </span>
                    </Td>
                    <Td>
                      <span className="flex gap-0.5">
                        {[1, 2, 3].map((i) => (
                          <span key={i} className={cn("h-2.5 w-1 rounded-[1px]", i <= e.impact ? (e.impact === 3 ? "bg-down" : e.impact === 2 ? "bg-warn" : "bg-fg-3") : "bg-surface-3")} />
                        ))}
                      </span>
                    </Td>
                    <Td className="font-medium">
                      <button className="text-left hover:text-ember" onClick={() => e.symbols.find((s) => KNOWN.has(s)) && T.openSymbol(e.symbols.find((s) => KNOWN.has(s))!)} title={e.symbols.length ? `Moves ${e.symbols.join(", ")}` : undefined}>
                        {e.title}
                      </button>
                    </Td>
                    <Td right mono className={e.actual ? (e.surprise > 0 ? "text-up" : e.surprise < 0 ? "text-down" : "text-fg") : "text-fg-3"}>
                      {e.actual || "—"}
                    </Td>
                    <Td right mono className="text-fg-2">
                      {e.forecast || "—"}
                    </Td>
                    <Td right mono className="text-fg-3">
                      {e.previous || "—"}
                    </Td>
                  </tr>,
                );
                return rows;
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
