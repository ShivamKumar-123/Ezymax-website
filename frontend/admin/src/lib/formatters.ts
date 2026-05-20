/**
 * Shared number / currency / date formatters for the admin app.
 *
 * Mirrors `frontend/trader/src/lib/formatters.ts`. We keep the per-app
 * copy instead of a monorepo-shared lib because each Next.js app has
 * its own bundler/tsconfig — the duplication is ~70 lines and lets
 * either app tweak its own locale rules without rebuilding the other.
 *
 * Use these instead of inline `Intl.NumberFormat(...)` or
 * `Number.prototype.toLocaleString(...)`.
 */

const _currencyFormatters = new Map<string, Intl.NumberFormat>();

function _currencyFmt(currency: string): Intl.NumberFormat {
  const key = (currency || 'USD').toUpperCase();
  let f = _currencyFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: key,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    _currencyFormatters.set(key, f);
  }
  return f;
}

/** "$1,234.56" — locale-aware currency with 2dp. */
export function formatCurrency(n: number | null | undefined, currency: string = 'USD'): string {
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  return _currencyFmt(currency).format(v);
}

/** Signed currency: "+$12.34" / "-$5.67". */
export function formatCurrencySigned(n: number | null | undefined, currency: string = 'USD'): string {
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  const formatted = _currencyFmt(currency).format(Math.abs(v));
  return v >= 0 ? `+${formatted}` : `-${formatted}`;
}

/** "1,234.56" — locale-aware decimal with configurable precision. */
export function formatNumber(
  n: number | null | undefined,
  dp: number = 2,
): string {
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  return v.toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

/** Integer with thousands separator: "1,234". */
export function formatInteger(n: number | null | undefined): string {
  const v = Number.isFinite(n as number) ? Math.round(n as number) : 0;
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** "+12.34%" / "-0.05%". */
export function formatPct(n: number | null | undefined, dp: number = 2): string {
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(dp)}%`;
}

/** Short date + 24h time: "May 20, 2026, 14:32". */
export function formatDateTime(d: Date | string | number | null | undefined): string {
  if (d == null) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Date only: "May 20, 2026". */
export function formatDate(d: Date | string | number | null | undefined): string {
  if (d == null) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { dateStyle: 'medium' });
}

/** Time only: "14:32". */
export function formatTime(d: Date | string | number | null | undefined): string {
  if (d == null) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleTimeString('en-US', { timeStyle: 'short' });
}
