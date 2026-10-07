// Crosshair time shared by the options "Both" view (underlying chart + option premium chart side by side): moving the
// crosshair over one chart shows it at the same time on the other. Times are chart times (server-time seconds).
type Fn = (source: string, time: number | null) => void;
const subs = new Set<Fn>();

export const crosshairBus = {
  emit(source: string, time: number | null) {
    subs.forEach((f) => f(source, time));
  },
  on(f: Fn): () => void {
    subs.add(f);
    return () => void subs.delete(f);
  },
};

/** Close of the last bar at or before `time` (binary search over ascending bars), for placing a synced crosshair. */
export function closeAt(bars: readonly { time: unknown; close?: number }[], time: number): number | null {
  let lo = 0;
  let hi = bars.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((bars[mid]!.time as number) <= time) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const b = best >= 0 ? bars[best] : bars[0];
  return b && typeof b.close === "number" ? b.close : null;
}
