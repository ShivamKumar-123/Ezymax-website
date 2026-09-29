// Shared clocks for relative times, "past" rows, the now line and countdowns. One timer per clock while anything
// listens (none when the screens are closed); leaf components subscribe, so a tick re-renders only the texts that
// show time, never a list.
import { useSyncExternalStore } from "react";

function clock(periodMs: number) {
  let now = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const subs = new Set<() => void>();
  const tick = () => {
    now = Date.now();
    subs.forEach((f) => f());
    // align to the period boundary (minute clocks flip exactly on the minute)
    timer = setTimeout(tick, periodMs - (now % periodMs) + 5);
  };
  return {
    get: () => now,
    subscribe(fn: () => void) {
      subs.add(fn);
      if (!timer) {
        now = Date.now();
        timer = setTimeout(tick, periodMs - (now % periodMs) + 5);
      }
      return () => {
        subs.delete(fn);
        if (!subs.size && timer) {
          clearTimeout(timer);
          timer = null;
        }
      };
    },
  };
}

const minute = clock(60_000);
const second = clock(1_000);

/** Current time, updated on every minute boundary. */
export const useMinute = () => useSyncExternalStore(minute.subscribe, minute.get, minute.get);
/** Current time, updated every second (countdowns only). */
export const useSecond = () => useSyncExternalStore(second.subscribe, second.get, second.get);
