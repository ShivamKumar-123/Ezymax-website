import { intlTag } from "./locales";

/** Server time used for statements, swaps and daily P&L (New York close = GMT+3). */
export const SERVER_TZ = "Europe/Istanbul";

type DateInput = string | number | Date;
const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();
function memo<F>(key: string, make: () => F): F {
  let f = cache.get(key) as F | undefined;
  if (!f) {
    f = make();
    cache.set(key, f as never);
  }
  return f;
}

export interface Formatter {
  locale: string;
  number(v: number, decimals?: number): string;
  /** Currency amount, e.g. "$1,234.50" / "1.234,50 $" / "US$ 1.234,50" (Latin digits). */
  money(v: number, currency?: string, decimals?: number): string;
  percent(v: number, decimals?: number, signed?: boolean): string;
  compact(v: number): string;
  /** Date only, e.g. "24 Sep 2026" in the reader's language. */
  date(d: DateInput, opts?: Intl.DateTimeFormatOptions): string;
  /** Date and time in server time unless `opts.timeZone` is given. */
  dateTime(d: DateInput, opts?: Intl.DateTimeFormatOptions): string;
  time(d: DateInput, opts?: Intl.DateTimeFormatOptions): string;
  /** "3 minutes ago" / "in 2 days". */
  relative(d: DateInput, now?: number): string;
}

export function createFormatter(locale: string): Formatter {
  const tag = intlTag(locale);
  const nf = (o: Intl.NumberFormatOptions) => memo(`${tag}|n|${JSON.stringify(o)}`, () => new Intl.NumberFormat(tag, o));
  const df = (o: Intl.DateTimeFormatOptions) => memo(`${tag}|d|${JSON.stringify(o)}`, () => new Intl.DateTimeFormat(tag, o));
  return {
    locale,
    number: (v, decimals = 2) => nf({ minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v),
    money: (v, currency = "USD", decimals = 2) => {
      try {
        return nf({ style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
      } catch {
        // crypto and other non-ISO codes (USDT): number + code
        return `${nf({ minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)} ${currency}`;
      }
    },
    percent: (v, decimals = 2, signed = false) => `${signed && v > 0 ? "+" : ""}${nf({ minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)}%`,
    compact: (v) => nf({ notation: "compact", maximumFractionDigits: 2 }).format(v),
    date: (d, opts = { day: "numeric", month: "short", year: "numeric" }) => df({ timeZone: SERVER_TZ, ...opts }).format(toDate(d)),
    dateTime: (d, opts = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) => df({ timeZone: SERVER_TZ, ...opts }).format(toDate(d)),
    time: (d, opts = { hour: "2-digit", minute: "2-digit" }) => df({ timeZone: SERVER_TZ, ...opts }).format(toDate(d)),
    relative: (d, now = Date.now()) => {
      const rtf = memo(`${tag}|r`, () => new Intl.RelativeTimeFormat(tag, { numeric: "auto" }));
      const diff = (toDate(d).getTime() - now) / 1000;
      const abs = Math.abs(diff);
      const [v, unit]: [number, Intl.RelativeTimeFormatUnit] =
        abs < 60 ? [diff, "second"] : abs < 3600 ? [diff / 60, "minute"] : abs < 86400 ? [diff / 3600, "hour"] : abs < 2592000 ? [diff / 86400, "day"] : abs < 31536000 ? [diff / 2592000, "month"] : [diff / 31536000, "year"];
      return rtf.format(Math.round(v), unit);
    },
  };
}
