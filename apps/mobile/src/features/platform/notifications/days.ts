// Groups inbox items by the reader's local calendar day (Today, Yesterday, then dates), newest first. Pure, so
// `node --test` covers it (scripts/platform-links.test.mts).

export type DayRow<T> = { type: "day"; key: string; label: string } | { type: "item"; key: string; item: T };

/** "2026-09-30" for a timestamp, in the phone's time zone. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Day headers and items for a list that is already sorted newest first. `label(key, daysAgo, dayStartMs)` names a
 * day (daysAgo 0 = today, 1 = yesterday, counted in whole local days).
 */
export function groupByDay<T extends { id: number; createdAt: string }>(items: readonly T[], now: number, label: (key: string, daysAgo: number, dayStart: number) => string): DayRow<T>[] {
  const out: DayRow<T>[] = [];
  const today = startOfDay(now);
  let current = "";
  for (const item of items) {
    const ms = Date.parse(item.createdAt);
    const key = Number.isFinite(ms) ? dayKey(ms) : "unknown";
    if (key !== current) {
      current = key;
      const start = Number.isFinite(ms) ? startOfDay(ms) : today;
      const daysAgo = Math.round((today - start) / 86_400_000);
      out.push({ type: "day", key: `day:${key}`, label: label(key, daysAgo, start) });
    }
    out.push({ type: "item", key: `n:${item.id}`, item });
  }
  return out;
}
