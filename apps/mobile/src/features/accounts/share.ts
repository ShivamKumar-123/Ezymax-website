// Structural sharing for polled answers: the new answer reuses every part of the previous one that is deep-equal, so
// memoised components see the same objects and a refresh that changed nothing re-renders nothing.

const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** `next`, reusing every part of `prev` that is deep-equal (the whole of `prev` when nothing changed). */
export function share<T>(prev: unknown, next: T): T {
  if (Object.is(prev, next)) return prev as T;
  if (Array.isArray(prev) && Array.isArray(next)) {
    let same = prev.length === next.length;
    const out = next.map((v, i) => {
      const s = share(prev[i], v);
      if (s !== prev[i]) same = false;
      return s;
    });
    return (same ? prev : out) as T;
  }
  if (plain(prev) && plain(next)) {
    const keys = Object.keys(next);
    let same = keys.length === Object.keys(prev).length;
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const s = share(prev[k], next[k]);
      out[k] = s;
      if (s !== prev[k]) same = false;
    }
    return (same ? prev : out) as T;
  }
  return next;
}
