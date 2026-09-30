// Server-only: a small in-process TTL cache with in-flight de-duplication, for upstream reads that many
// requests share (session checks, tenant-scoped reference data). Each Next process keeps its own copy; nothing
// here survives a restart, and nothing per-user money-related should be cached with it.

type Entry<T> = { at: number; ttl: number; value?: T; pending?: Promise<T> };

export class Memo<T> {
  private map = new Map<string, Entry<T>>();
  constructor(
    private readonly ttlMs: number,
    private readonly max = 1000,
  ) {}

  /** The cached value of `key` while fresh, else `load()` (concurrent callers share one call).
   *  `keep(value)` false: hand the value back but don't cache it (errors, unavailable upstreams). */
  async get(key: string, load: () => Promise<T>, keep: (v: T) => boolean = () => true): Promise<T> {
    const now = Date.now();
    const hit = this.map.get(key);
    if (hit?.pending) return hit.pending;
    if (hit && hit.value !== undefined && now - hit.at < hit.ttl) return hit.value;
    const pending = load().then(
      (v) => {
        if (keep(v)) {
          if (this.map.size >= this.max) this.map.clear();
          this.map.set(key, { at: Date.now(), ttl: this.ttlMs, value: v });
        } else this.map.delete(key);
        return v;
      },
      (e) => {
        this.map.delete(key);
        throw e;
      },
    );
    this.map.set(key, { at: now, ttl: this.ttlMs, pending });
    return pending;
  }

  delete(key: string) {
    this.map.delete(key);
  }

  /** Drops every key starting with `prefix` (e.g. after a write to the cached resource). */
  deletePrefix(prefix: string) {
    for (const k of this.map.keys()) if (k.startsWith(prefix)) this.map.delete(k);
  }
}

/** A cache key for a secret (session token): never keep raw tokens as map keys. */
export async function secretKey(secret: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Buffer.from(d).toString("base64url");
}
