// Screen data cache: open to content, not spinners.
// - `useQuery(key, fetcher)` returns the last data at once (memory, else the on-device cache when `persist`),
//   then refreshes in the background when stale. Concurrent callers share one request.
// - Persisted entries are scoped to the signed-in user and wiped on sign-out (clearQueries).
// - Never used for money actions: those call `api()` directly and show the server's answer.
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import type { ApiError, ApiResult } from "./api";
import { kv } from "./kv";

type Entry = { data?: unknown; error?: ApiError; at: number; inflight?: Promise<void>; subs: Set<() => void>; version: number; persist?: boolean; fetch?: () => Promise<ApiResult<unknown>> };
type Fetcher<T> = () => Promise<ApiResult<T>>;

const entries = new Map<string, Entry>();
let scope = "anon";
const PREFIX = "q:";

/** Persisted-cache owner (the user id); set on sign-in. */
export function setQueryScope(id: string | number | null) {
  scope = id === null ? "anon" : String(id);
}

const storageKey = (key: string) => `${PREFIX}${scope}:${key}`;

function entry(key: string, persist: boolean): Entry {
  let e = entries.get(key);
  if (!e) {
    e = { at: 0, subs: new Set(), version: 0 };
    if (persist) {
      const saved = kv.getJSON<{ d: unknown; at: number }>(storageKey(key));
      if (saved) {
        e.data = saved.d;
        e.at = saved.at;
      }
    }
    entries.set(key, e);
  }
  return e;
}

function notify(e: Entry) {
  e.version++;
  e.subs.forEach((f) => f());
}

async function run<T>(key: string, fetcher: Fetcher<T>, persist: boolean): Promise<void> {
  const e = entry(key, persist);
  if (e.inflight) return e.inflight;
  e.inflight = (async () => {
    const r = await fetcher();
    if (r.ok) {
      e.data = r.data;
      e.error = undefined;
      e.at = Date.now();
      if (persist) kv.setJSON(storageKey(key), { d: r.data, at: e.at });
    } else if (r.error.code !== "aborted") {
      e.error = r.error;
    }
  })().finally(() => {
    e.inflight = undefined;
    notify(e);
  });
  notify(e);
  return e.inflight;
}

export type QueryOptions = {
  /** keep the last answer on the device (per user) so the screen opens on it next time */
  persist?: boolean;
  /** refresh when older than this (ms, default 30 s) */
  staleMs?: number;
  /** poll while mounted (ms) */
  intervalMs?: number;
  enabled?: boolean;
};

export type Query<T> = {
  data: T | undefined;
  error: ApiError | undefined;
  /** nothing to show yet (first load) */
  loading: boolean;
  /** a request is in flight */
  fetching: boolean;
  /** time of the data (ms) */
  updatedAt: number;
  refresh: () => Promise<void>;
};

export function useQuery<T>(key: string | null, fetcher: Fetcher<T>, opts: QueryOptions = {}): Query<T> {
  const { persist = false, staleMs = 30_000, intervalMs, enabled = true } = opts;
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const active = enabled && key !== null;

  const subscribe = useCallback(
    (fn: () => void) => {
      if (!key) return () => {};
      const e = entry(key, persist);
      e.subs.add(fn);
      e.persist = persist;
      e.fetch = () => fetchRef.current() as Promise<ApiResult<unknown>>;
      return () => e.subs.delete(fn);
    },
    [key, persist],
  );
  const version = useSyncExternalStore(
    subscribe,
    () => (key ? entry(key, persist).version : -1),
    () => -1,
  );
  void version;
  const e = key ? entry(key, persist) : undefined;

  const refresh = useCallback(() => (key ? run(key, () => fetchRef.current(), persist) : Promise.resolve()), [key, persist]);

  useEffect(() => {
    if (!active || !key) return;
    const cur = entry(key, persist);
    if (cur.data === undefined || Date.now() - cur.at > staleMs) void refresh();
    const onApp = AppState.addEventListener("change", (s) => {
      if (s === "active" && Date.now() - entry(key, persist).at > staleMs) void refresh();
    });
    const timer = intervalMs ? setInterval(() => AppState.currentState === "active" && void refresh(), intervalMs) : undefined;
    return () => {
      onApp.remove();
      if (timer) clearInterval(timer);
    };
  }, [active, key, persist, staleMs, intervalMs, refresh]);

  return {
    data: e?.data as T | undefined,
    error: e?.error,
    loading: !!active && e?.data === undefined && !e?.error,
    fetching: !!e?.inflight,
    updatedAt: e?.at ?? 0,
    refresh,
  };
}

/** Warm a query before its screen opens (e.g. chart candles on a watchlist row press-in). */
export function prefetch<T>(key: string, fetcher: Fetcher<T>, opts: { persist?: boolean; staleMs?: number } = {}) {
  const e = entry(key, !!opts.persist);
  if (e.data !== undefined && Date.now() - e.at < (opts.staleMs ?? 30_000)) return;
  void run(key, fetcher, !!opts.persist);
}

/** Read or write cached data directly (after a mutation the server confirmed). */
export function getQueryData<T>(key: string): T | undefined {
  return entries.get(key)?.data as T | undefined;
}
export function setQueryData<T>(key: string, data: T | ((prev: T | undefined) => T), persist = false) {
  const e = entry(key, persist);
  e.data = typeof data === "function" ? (data as (p: T | undefined) => T)(e.data as T | undefined) : data;
  e.at = Date.now();
  if (persist) kv.setJSON(storageKey(key), { d: e.data, at: e.at });
  notify(e);
}

/** Mark matching queries stale; the ones on screen refetch now. */
export function invalidate(prefix: string) {
  for (const [k, e] of entries) {
    if (!k.startsWith(prefix)) continue;
    e.at = 0;
    if (e.subs.size && e.fetch) void run(k, e.fetch, !!e.persist);
  }
}

/** Sign-out: forget everything of the previous user. */
export function clearQueries() {
  entries.clear();
  kv.clearPrefix(`${PREFIX}${scope}:`);
  scope = "anon";
}
