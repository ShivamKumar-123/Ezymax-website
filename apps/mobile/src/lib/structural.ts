// Structural sharing for cached answers (pure; used by useQuerySelect in query.ts).

const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/**
 * `next` with every part that deep-equals the same part of `prev` replaced by `prev`'s own object (all of `prev` when
 * nothing changed), so a selection keeps its identity where the data didn't change. JSON-shaped data only (plain
 * objects, arrays, primitives); anything else counts as changed unless it is the same object.
 */
export function share<T>(prev: unknown, next: T): T {
  if (Object.is(prev, next)) return prev as T;
  if (Array.isArray(prev) && Array.isArray(next)) {
    let same = prev.length === next.length;
    const out = next.map((x, i) => {
      const y = share(prev[i], x);
      if (y !== prev[i]) same = false;
      return y;
    });
    return (same ? prev : out) as T;
  }
  if (plain(prev) && plain(next)) {
    const keys = Object.keys(next);
    let same = keys.length === Object.keys(prev).length;
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const y = share(prev[k], next[k]);
      out[k] = y;
      if (y !== prev[k] || !(k in prev)) same = false;
    }
    return (same ? prev : out) as T;
  }
  return next;
}
