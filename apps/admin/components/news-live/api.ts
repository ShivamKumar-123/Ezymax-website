"use client";

// Browser client for the Back Office news BFF (/api/news/*, see app/api/news/[...path]/route.ts).

import * as React from "react";

export type AdminItem = {
  id: number;
  title: string;
  summary: string;
  link: string;
  source: { id: string; name: string; homepage: string };
  publishedAt: string;
  countries: string[];
  currencies: string[];
  symbols: string[];
  category: string;
  sentiment: "bullish" | "bearish" | "neutral";
  importance: number;
  pinned: boolean;
  hidden: boolean;
  retagged: boolean;
  sourceEnabled: boolean;
  auto: { symbols: string[]; countries: string[]; importance: number };
  updatedBy: string | null;
  updatedAt: string | null;
};
export type Source = {
  id: string;
  name: string;
  url: string;
  homepage: string;
  country: string;
  kind: "central_bank" | "statistics" | "energy" | "news" | "provider";
  enabled: boolean;
  terms: string;
  intervalSecs: number;
  lastFetchAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  items: number;
  last24h: number;
  connected: boolean | null;
};
export type Stats = {
  news: { last24h: number; total: number; pinned: number; hidden: number };
  sources: { enabled: number; total: number; failing: number };
  calendar: { week: number; high: number; source: { lastOkAt: string | null; lastError: string | null; events: number } };
  brief: { configured: boolean; today: string | null; model: string };
};
export type CalEvent = {
  id: number;
  title: string;
  currency: string;
  country: string;
  startsAt: string;
  serverDate: string;
  serverTime: string;
  allDay: boolean;
  impact: number;
  feedImpact: number;
  impactOverride: number | null;
  forecast: string;
  previous: string;
  actual: string;
  actualSource: string | null;
  surprise: number;
  symbols: string[];
};
export type AdminCalendar = {
  events: CalEvent[];
  from: string;
  to: string;
  serverOffset: number;
  source: { name: string; lastFetchAt: string | null; lastOkAt: string | null; lastError: string | null; events: number };
  cooldown: number;
  reminders: number;
  subscribers: number;
  licensedActuals: boolean;
};
export type Brief = { brief: { mood: string; headline: string; points: { text: string; tone: string }[]; watch: string[]; calendarNote: string } | null; day: string; model: string | null; createdAt: string | null; configured: boolean };
export type AuditEntry = { staff: string; action: string; target: string; detail: Record<string, unknown>; at: string };

export class NewsError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function newsApi<T>(path: string, init?: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const method = init?.method ?? (init?.body !== undefined ? "POST" : "GET");
  let res: Response;
  try {
    res = await fetch(`/api/news/${path}`, {
      method,
      headers: method === "GET" ? undefined : { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(init?.body ?? {}),
      cache: "no-store",
      signal: init?.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new NewsError(0, "network", "Network error. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!res.ok) throw new NewsError(res.status, data.error?.code ?? "error", data.error?.message ?? "Something went wrong. Please try again.");
  return data as T;
}

export function useNews<T>(path: string | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<NewsError | null>(null);
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  React.useEffect(() => {
    if (!path) return;
    const ctl = new AbortController();
    newsApi<T>(path, { signal: ctl.signal })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof NewsError ? e : new NewsError(0, "error", "Something went wrong."));
      });
    return () => ctl.abort();
  }, [path, tick]);
  return { data, error, loading: data === null && error === null, reload, setData };
}

export const KIND_LABEL: Record<Source["kind"], string> = { central_bank: "Central bank", statistics: "Statistics office", energy: "Energy agency", news: "News publisher", provider: "Data provider" };
export const INSTRUMENTS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "GBPJPY", "EURJPY", "USDINR", "XAUUSD", "XAGUSD", "US30", "NAS100", "SPX500", "GER40", "UK100", "JP225", "USOIL", "UKOIL", "BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "AAPL", "TSLA", "NVDA", "META", "NFLX"];
export const COUNTRIES: [string, string][] = [["us", "United States"], ["eu", "Euro area"], ["de", "Germany"], ["fr", "France"], ["it", "Italy"], ["es", "Spain"], ["gb", "United Kingdom"], ["jp", "Japan"], ["au", "Australia"], ["ca", "Canada"], ["ch", "Switzerland"], ["nz", "New Zealand"], ["cn", "China"], ["in", "India"], ["sa", "Saudi Arabia"], ["ru", "Russia"], ["ir", "Iran"], ["br", "Brazil"], ["mx", "Mexico"], ["kr", "South Korea"], ["sg", "Singapore"]];

export function ago(iso: string | null) {
  if (!iso) return "never";
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}
