// Formatting for the partner (IB) screens: the pure helpers (lib.ts) plus dates in the reader's language and phone
// time, and UTC period boundaries (payout periods, week starts).
import { intlTag } from "@kalks/i18n/locales";
import { i18n } from "@/i18n";
import { DAY_MS, valid } from "./lib";

export * from "./lib";

const dfCache = new Map<string, Intl.DateTimeFormat>();
function df(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${i18n.locale}|${JSON.stringify(opts)}`;
  let f = dfCache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(intlTag(i18n.locale), opts);
    } catch {
      f = new Intl.DateTimeFormat("en-GB", opts);
    }
    dfCache.set(key, f);
  }
  return f;
}

/** "28 Sep 2026" (phone time). */
export function date(iso: string | null | undefined, withYear = true): string {
  const d = valid(iso);
  if (!d) return "—";
  return df(withYear ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" }).format(d);
}

/** "28 Sep, 14:03" (phone time). */
export function dateTime(iso: string | null | undefined): string {
  const d = valid(iso);
  if (!d) return "—";
  return df({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** "Mon 5 Oct" (phone time). */
export function day(iso: string | null | undefined): string {
  const d = valid(iso);
  if (!d) return "—";
  return df({ weekday: "short", day: "numeric", month: "short" }).format(d);
}

/** "Mar 2024". */
export function month(iso: string | null | undefined): string {
  const d = valid(iso);
  if (!d) return "—";
  return df({ month: "short", year: "numeric" }).format(d);
}

/** Month name of a "YYYY-MM" key ("Sep"), optionally shifted by `offset` months. */
export function monthName(key: string, offset = 0): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return "";
  return df({ month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1 + offset, 15)));
}

/** "5 Oct" / "5 Oct 2026" for a UTC midnight (payout periods, week starts). */
export function utcDay(ms: number, withYear = false): string {
  return df(withYear ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(ms));
}

/** A payout period: "28 Sep – 4 Oct 2026" (period ends are exclusive UTC midnights). */
export function period(schedule: string, endIso: string, startIso?: string | null): string {
  const end = Date.parse(endIso);
  if (!Number.isFinite(end)) return "—";
  const start = startIso ? Date.parse(startIso) : end - (schedule === "daily" ? 1 : schedule === "monthly" ? 30 : 7) * DAY_MS;
  const last = end - DAY_MS;
  return last <= start ? utcDay(start, true) : `${utcDay(start)} – ${utcDay(last, true)}`;
}

