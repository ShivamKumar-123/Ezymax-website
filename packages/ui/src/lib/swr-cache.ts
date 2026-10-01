// Stale-while-revalidate memory for BFF GET reads, per browser tab. A page opened again shows the data it had a
// moment ago while the hook refetches it, instead of a skeleton for a full round trip.
//
// Safety rules:
// - browser only: on the server nothing is stored or read (module state there is shared by every request);
// - owned by the signed-in user: nothing is cached until the session provider names the owner, and a different
//   owner (or none) clears everything;
// - any write clears everything: a POST/PUT/PATCH/DELETE from this tab drops all cached reads before it is sent,
//   so balances, positions or statuses are never shown from before a change the user just made;
// - entries expire after MAX_AGE_MS; hooks always refetch on mount, the cache only fills the first paint.

const MAX_AGE_MS = 5 * 60_000;
const MAX_ENTRIES = 300;

type Entry = { at: number; data: unknown };
const store = new Map<string, Entry>();
let owner: string | null = null;

const browser = typeof window !== "undefined";

if (browser) {
  const w = window as typeof window & { __kalksReadCache?: true };
  if (!w.__kalksReadCache) {
    w.__kalksReadCache = true;
    const original = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (method !== "GET" && method !== "HEAD") store.clear();
      return original(input, init);
    };
  }
}

/** The signed-in user (or staff member) the cached reads belong to; null or a change clears the cache. */
export function setReadCacheOwner(id: string | number | null | undefined) {
  if (!browser) return;
  const next = id === null || id === undefined ? null : String(id);
  if (next !== owner) {
    store.clear();
    owner = next;
  }
}

/** The last good response for `key`, if it is recent enough. */
export function readCached<T>(key: string): T | undefined {
  if (!browser || owner === null) return undefined;
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > MAX_AGE_MS) {
    store.delete(key);
    return undefined;
  }
  return e.data as T;
}

/** Remember a good response for `key`. */
export function writeCached(key: string, data: unknown) {
  if (!browser || owner === null) return;
  if (!store.has(key) && store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { at: Date.now(), data });
}

export function clearReadCache() {
  store.clear();
}
