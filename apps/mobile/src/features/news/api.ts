// Data layer of the news and calendar screens. Everything goes through the Client Area news BFF
// (apps/crm/app/api/news/[...path], reached as /api/mobile/news/*), the same routes and rules as the web Client Area:
// headlines, the brief and the calendar are broker-scoped public reads (a signed-in client gets the broker's pinned
// and hidden stories); reminders and alerts belong to the client and are refused for view-only and read-only staff
// sessions by the proxy before any handler runs.
//
// Structural sharing: a poll that brings back the same stories / events keeps the previous objects, so the memoised
// rows below the list skip their render (a refresh with nothing new re-renders nothing but the screen shell).
import { api, apiGet, type ApiResult } from "@/lib/api";
import { getQueryData, prefetch, setQueryData } from "@/lib/query";

/* ------------------------------------------------------------------ */
/* Types (the news service's JSON, see services/news/src/api.rs)       */
/* ------------------------------------------------------------------ */

export type Sentiment = "bullish" | "bearish" | "neutral";
export type NewsItem = {
  id: number;
  title: string;
  /** the publisher's teaser only (licensing: the full article stays at the source) */
  summary: string;
  link: string;
  source: { id: string; name: string; homepage: string };
  publishedAt: string;
  countries: string[];
  currencies: string[];
  symbols: string[];
  category: string;
  sentiment: Sentiment;
  /** 0–100 */
  importance: number;
  pinned: boolean;
};
export type Feed = { pinned: NewsItem[]; items: NewsItem[]; next: string | null };

export type BriefMood = "risk-on" | "risk-off" | "mixed" | "cautious";
export type BriefBody = { mood: BriefMood; headline: string; points: { text: string; tone: "up" | "down" | "neutral" }[]; watch: string[]; calendarNote: string };
export type Brief = { brief: BriefBody | null; day: string; model: string | null; createdAt: string | null; configured: boolean };

export type Impact = 0 | 1 | 2 | 3;
export type CalEvent = {
  id: number;
  title: string;
  currency: string;
  country: string;
  startsAt: string;
  /** YYYY-MM-DD and HH:MM in server time (GMT+2 / +3, New York close) */
  serverDate: string;
  serverTime: string;
  allDay: boolean;
  impact: Impact;
  impactLabel: "holiday" | "low" | "medium" | "high";
  forecast: string;
  previous: string;
  actual: string;
  actualSource: string | null;
  /** actual vs forecast for the currency: 1 better, -1 worse, 0 in line / no figures */
  surprise: -1 | 0 | 1;
  lowerIsBetter: boolean;
  symbols: string[];
  updatedAt: string;
};
export type CalendarWeek = {
  events: CalEvent[];
  from: string;
  to: string;
  /** hours ahead of UTC */
  serverOffset: number;
  now: string;
  updatedAt: string | null;
  source: { name: string; url: string; lastOkAt: string | null; lastError: string | null };
};
export type NextEvent = { event: CalEvent | null; serverOffset: number; now: string };
export type CalDetail = { event: CalEvent; history: { startsAt: string; actual: string; forecast: string; previous: string }[] };
export type Alerts = { highImpact: boolean; currencies: string[]; minutes: number };
/** `minutes`: the lead time chosen on this phone per event (the service returns only the event ids). */
export type MyCalendar = { reminders: number[]; alerts: Alerts | null; minutes?: Record<string, number> };
export type Mentions = { hours: number; total: number; mentions: { symbol: string; count: number }[] };

/* ------------------------------------------------------------------ */
/* Filters and paths                                                   */
/* ------------------------------------------------------------------ */

export type Importance = "all" | "important" | "top";
export type NewsFilters = { importance: Importance; tone: Sentiment | null; currency: string | null; symbol: string | null };
export const NO_FILTERS: NewsFilters = { importance: "all", tone: null, currency: null, symbol: null };

/** Importance tiers on the service's 0–100 score (default feed floor 20). */
export const IMPORTANCE_MIN: Record<Importance, number | null> = { all: null, important: 45, top: 70 };
export const tierOf = (importance: number): 1 | 2 | 3 => (importance >= 70 ? 3 : importance >= 45 ? 2 : 1);

/** Currencies the service tags stories and events with (the web calendar's list). */
export const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"] as const;

const SYMBOL_RE = /^[A-Z0-9]{2,12}$/;
const CCY_RE = /^[A-Z]{3}$/;
export const cleanSymbol = (v: unknown): string | null => (typeof v === "string" && SYMBOL_RE.test(v.toUpperCase()) ? v.toUpperCase() : null);
export const cleanCurrency = (v: unknown): string | null => (typeof v === "string" && CCY_RE.test(v.toUpperCase()) ? v.toUpperCase() : null);

export const PAGE = 30;

export function feedPath(f: NewsFilters, before?: string | null, limit = PAGE): string {
  const q = new URLSearchParams({ limit: String(limit) });
  const min = IMPORTANCE_MIN[f.importance];
  if (min !== null) q.set("minImportance", String(min));
  if (f.tone) q.set("sentiment", f.tone);
  if (f.currency) q.set("currency", f.currency);
  if (f.symbol) q.set("symbol", f.symbol);
  if (before) q.set("before", before);
  return `news/feed?${q}`;
}

export const activeFilters = (f: NewsFilters) => (f.importance !== "all" ? 1 : 0) + (f.tone ? 1 : 0) + (f.currency ? 1 : 0) + (f.symbol ? 1 : 0);

/* ------------------------------------------------------------------ */
/* Query keys and fetchers                                             */
/* ------------------------------------------------------------------ */

export const keys = {
  feed: (f: NewsFilters) => feedPath(f),
  brief: "news/brief",
  item: (id: number) => `news/item/${id}`,
  related: (by: { symbol?: string; currency?: string }) => (by.symbol ? `news/related/s/${by.symbol}` : `news/related/c/${by.currency}`),
  mentions: "news/mentions",
  calendar: (from: string | null) => `news/calendar/${from ?? "current"}`,
  next: "news/calendar/next",
  event: (id: number) => `news/calendar/event/${id}`,
  my: "news/me/calendar",
};

/** Items seen in any feed page, so a story opens at once from a list (no request, no spinner). */
const seen = new Map<number, NewsItem>();
export function remember(items: NewsItem[]) {
  for (const n of items) seen.set(n.id, n);
  // keep memory flat on long sessions: the oldest entries go first (Map keeps insertion order)
  if (seen.size > 600) for (const k of [...seen.keys()].slice(0, seen.size - 500)) seen.delete(k);
}
/** A story already on the phone: from a list page, the story cache, or the Home headlines. */
export function knownItem(id: number): NewsItem | undefined {
  return seen.get(id) ?? getQueryData<{ item: NewsItem }>(keys.item(id))?.item ?? getQueryData<{ items?: NewsItem[] }>("home/news")?.items?.find((n) => n.id === id);
}

const sig = (n: NewsItem) => `${n.title}|${n.summary}|${n.pinned}|${n.importance}|${n.sentiment}|${n.category}|${n.symbols.join(",")}|${n.currencies.join(",")}|${n.countries.join(",")}|${n.link}`;
function reuseItems(next: NewsItem[], prev: Map<number, NewsItem>): NewsItem[] {
  return next.map((n) => {
    const p = prev.get(n.id);
    return p && sig(p) === sig(n) ? p : n;
  });
}
const sameList = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Fetcher for a feed's first page: keeps unchanged stories (and the whole answer) identical to the cached ones. */
export function fetchFeed(f: NewsFilters) {
  const key = keys.feed(f);
  return async (): Promise<ApiResult<Feed>> => {
    const r = await apiGet<Feed>(feedPath(f));
    if (!r.ok) return r;
    const prev = getQueryData<Feed>(key);
    const byId = new Map<number, NewsItem>([...(prev?.pinned ?? []), ...(prev?.items ?? []), ...seen.values()].map((n) => [n.id, n]));
    const pinned = reuseItems(r.data.pinned ?? [], byId);
    const items = reuseItems(r.data.items ?? [], byId);
    remember(pinned);
    remember(items);
    if (prev && sameList(prev.pinned, pinned) && sameList(prev.items, items) && prev.next === r.data.next) return { ...r, data: prev };
    return { ...r, data: { pinned, items, next: r.data.next ?? null } };
  };
}

/** An older page (infinite scroll); not cached across launches. */
export async function fetchOlder(f: NewsFilters, before: string): Promise<ApiResult<Feed>> {
  const r = await apiGet<Feed>(feedPath(f, before));
  if (r.ok) remember(r.data.items ?? []);
  return r;
}

export const fetchBrief = () => apiGet<Brief>("news/brief");

export function fetchItem(id: number) {
  return async (): Promise<ApiResult<{ item: NewsItem }>> => {
    const r = await apiGet<{ item: NewsItem }>(`news/feed/${id}`);
    if (r.ok) remember([r.data.item]);
    return r;
  };
}

/** Warm the story screen (list row press-in): the list already has the story, so this costs nothing. */
export function primeStory(n: NewsItem) {
  remember([n]);
  if (!getQueryData(keys.item(n.id))) setQueryData(keys.item(n.id), { item: n });
}

export function relatedPath(by: { symbol?: string; currency?: string }) {
  return by.symbol ? `news/feed?limit=6&symbol=${encodeURIComponent(by.symbol)}` : `news/feed?limit=6&currency=${encodeURIComponent(by.currency ?? "")}`;
}
export const fetchRelated = (by: { symbol?: string; currency?: string }) => async () => {
  const r = await apiGet<Feed>(relatedPath(by));
  if (r.ok) remember(r.data.items ?? []);
  return r;
};
export function prefetchRelated(n: NewsItem) {
  const by = relatedOf(n);
  if (by) prefetch(keys.related(by), fetchRelated(by), { staleMs: 120_000 });
}
/** What "More on …" under a story is about: its first instrument, else its first currency. */
export function relatedOf(n: Pick<NewsItem, "symbols" | "currencies">): { symbol?: string; currency?: string } | null {
  if (n.symbols[0]) return { symbol: n.symbols[0] };
  if (n.currencies[0]) return { currency: n.currencies[0] };
  return null;
}

export const fetchMentions = () => apiGet<Mentions>("news/map?hours=48");

/* ---- calendar ---- */

const evSig = (e: CalEvent) => `${e.updatedAt}|${e.startsAt}|${e.actual}|${e.forecast}|${e.previous}|${e.impact}|${e.surprise}|${e.title}`;

export function calendarPath(from: string | null) {
  if (!from) return "news/calendar";
  const to = new Date(new Date(from).getTime() + 7 * 86_400_000).toISOString();
  return `news/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

/** A week of events: unchanged events keep their objects between polls. */
export function fetchCalendar(from: string | null) {
  const key = keys.calendar(from);
  return async (): Promise<ApiResult<CalendarWeek>> => {
    const r = await apiGet<CalendarWeek>(calendarPath(from));
    if (!r.ok) return r;
    const prev = getQueryData<CalendarWeek>(key);
    if (!prev) return r;
    const old = new Map(prev.events.map((e) => [e.id, e]));
    const events = r.data.events.map((e) => {
      const p = old.get(e.id);
      return p && evSig(p) === evSig(e) ? p : e;
    });
    if (sameList(prev.events, events) && prev.from === r.data.from && prev.serverOffset === r.data.serverOffset) return { ...r, data: { ...prev, now: r.data.now, updatedAt: r.data.updatedAt, source: r.data.source } };
    return { ...r, data: { ...r.data, events } };
  };
}

export const fetchNext = () => apiGet<NextEvent>("news/calendar/next?impact=3");
export const fetchEvent = (id: number) => () => apiGet<CalDetail>(`news/calendar/${id}`);
export const prefetchEvent = (id: number) => prefetch(keys.event(id), fetchEvent(id), { staleMs: 120_000 });

/** My reminders and alert subscription; keeps the lead times chosen on this phone for the events still reminded. */
export async function fetchMy(): Promise<ApiResult<MyCalendar>> {
  const r = await apiGet<MyCalendar>("news/me/calendar");
  if (!r.ok) return r;
  const prev = getQueryData<MyCalendar>(keys.my)?.minutes ?? {};
  const minutes: Record<string, number> = {};
  for (const id of r.data.reminders) if (prev[id]) minutes[id] = prev[id]!;
  return { ...r, data: { reminders: r.data.reminders ?? [], alerts: r.data.alerts ?? null, minutes } };
}

export const addReminder = (eventId: number, minutes: number) => api<{ eventId: number; minutes: number; remindAt: string }>("news/me/calendar/reminders", { method: "POST", body: { eventId, minutes } });
export const deleteReminder = (eventId: number) => api<{ ok: boolean }>(`news/me/calendar/reminders/${eventId}`, { method: "DELETE" });
export const saveAlerts = (a: Alerts) => api<{ alerts: Alerts }>("news/me/calendar/alerts", { method: "PUT", body: a });
export const clearAlerts = () => api<{ alerts: null }>("news/me/calendar/alerts", { method: "DELETE" });

/** Lead times the service accepts for a reminder. */
export const REMIND_MINUTES = [5, 15, 30, 60] as const;
