/**
 * Trade timestamps, rendered in ONE timezone everywhere.
 *
 * These used to render with `toLocaleString()`, i.e. in whatever timezone the
 * device happened to be in. The same closed trade then read 19:17 on a laptop
 * in India, 17:47 on a phone in the Gulf, and 13:47 in the database — and a
 * trader checking their history against a support reply could not tell whether
 * they were looking at one trade or three.
 *
 * Server time (UTC) is what the platform stores and what support and the admin
 * panel read, so that is what every trade list shows, labelled so nobody has to
 * guess. This mirrors how a terminal shows broker server time rather than the
 * clock on the wall.
 */

const UTC_DATE_TIME: Intl.DateTimeFormatOptions = {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

const UTC_SHORT: Intl.DateTimeFormatOptions = {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

const UTC_DATE: Intl.DateTimeFormatOptions = {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
};

function format(iso: string | number | Date | undefined | null, opts: Intl.DateTimeFormatOptions, suffix: string) {
  if (iso === undefined || iso === null || iso === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-GB', opts)}${suffix}`;
}

/** Full stamp: `18 Sep 2026, 13:47:42 UTC`. */
export function formatTradeTime(iso: string | number | Date | undefined | null): string {
  return format(iso, UTC_DATE_TIME, ' UTC');
}

/** Compact stamp for dense rows: `18 Sep, 13:47 UTC`. */
export function formatTradeTimeShort(iso: string | number | Date | undefined | null): string {
  return format(iso, UTC_SHORT, ' UTC');
}

/** Date only: `18 Sep 2026`. Timezone-safe — no suffix needed. */
export function formatTradeDate(iso: string | number | Date | undefined | null): string {
  return format(iso, UTC_DATE, '');
}
