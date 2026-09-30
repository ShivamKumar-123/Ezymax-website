// Structural sharing for polled answers (pure, no React Native: covered by scripts/algo-lib.test.mts).

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** `next`, reusing every part of `prev` that is deep-equal: a poll that changed nothing re-renders no row. */
export function share<T>(prev: unknown, next: T): T {
  if (Object.is(prev, next)) return prev as T;
  if (Array.isArray(prev) && Array.isArray(next)) {
    let same = prev.length === next.length;
    const out = next.map((n, i) => {
      const r = share(prev[i], n);
      if (r !== prev[i]) same = false;
      return r;
    });
    return (same ? prev : out) as T;
  }
  if (isPlain(prev) && isPlain(next)) {
    const keys = Object.keys(next);
    let same = keys.length === Object.keys(prev).length;
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const r = share(prev[k], next[k]);
      out[k] = r;
      if (r !== prev[k]) same = false;
    }
    return (same ? prev : out) as T;
  }
  return next;
}
