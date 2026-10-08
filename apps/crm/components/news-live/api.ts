"use client";

// Browser client for the news + calendar BFF (/api/news/*, see app/api/news/[...path]/route.ts).

import * as React from "react";
import { tr } from "@ezymex/i18n/react";
import { readCached, writeCached } from "@ezymex/ui/swr-cache";

export type Sentiment = "bullish" | "bearish" | "neutral";
export type NewsItem = {
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
  sentiment: Sentiment;
  importance: number;
  pinned: boolean;
};
export type Feed = { pinned: NewsItem[]; items: NewsItem[]; next: string | null };
export type MapCountry = { country: string; name: string; count: number; bullish: number; bearish: number; sentiment: number; top: { id: number; title: string; source: string; publishedAt: string } | null };
export type NewsMap = { hours: number; total: number; countries: MapCountry[]; mentions: { symbol: string; count: number }[] };
export type Brief = {
  brief: { mood: "risk-on" | "risk-off" | "mixed" | "cautious"; headline: string; points: { text: string; tone: "up" | "down" | "neutral" }[]; watch: string[]; calendarNote: string } | null;
  day: string;
  model: string | null;
  createdAt: string | null;
  configured: boolean;
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
  impact: 0 | 1 | 2 | 3;
  impactLabel: "holiday" | "low" | "medium" | "high";
  forecast: string;
  previous: string;
  actual: string;
  actualSource: string | null;
  surprise: -1 | 0 | 1;
  lowerIsBetter: boolean;
  symbols: string[];
  updatedAt: string;
};
export type CalendarWeek = {
  events: CalEvent[];
  from: string;
  to: string;
  serverOffset: number;
  now: string;
  updatedAt: string | null;
  source: { name: string; url: string; lastOkAt: string | null; lastError: string | null };
};
export type CalDetail = { event: CalEvent; history: { startsAt: string; actual: string; forecast: string; previous: string }[] };
export type MyCalendar = { reminders: number[]; alerts: { highImpact: boolean; currencies: string[]; minutes: number } | null };

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
      headers: method !== "GET" ? { "content-type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: init?.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new NewsError(0, "network", tr("common.networkError"));
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!res.ok) throw new NewsError(res.status, data.error?.code ?? "error", data.error?.message ?? tr("common.errorRetry"));
  return data as T;
}

/** Loads `path` (again on `reload()` and every `refreshMs` while the tab is visible); `path = null` waits.
 *  Opened again, a page starts from this tab's last answer while it refetches (@ezymex/ui/swr-cache). */
export function useNewsApi<T>(path: string | null, refreshMs = 0) {
  const [data, setData] = React.useState<T | null>(() => (path ? (readCached<T>(`news:${path}`) ?? null) : null));
  const [error, setError] = React.useState<NewsError | null>(null);
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  React.useEffect(() => {
    if (!path) return;
    const cached = readCached<T>(`news:${path}`);
    if (cached !== undefined) setData(cached);
    const ctl = new AbortController();
    newsApi<T>(path, { signal: ctl.signal })
      .then((d) => {
        setData(d);
        writeCached(`news:${path}`, d);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof NewsError ? e : new NewsError(0, "error", tr("common.errorRetry")));
      });
    return () => ctl.abort();
  }, [path, tick]);
  React.useEffect(() => {
    if (!refreshMs) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setTick((x) => x + 1);
    }, refreshMs);
    return () => clearInterval(t);
  }, [refreshMs]);
  return { data, error, loading: data === null && error === null, reload, setData };
}
