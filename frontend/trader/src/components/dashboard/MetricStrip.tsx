'use client';

/**
 * The segmented metric strip across the top of the dashboard.
 *
 * Borrowed from the reference layout's Interviews / Hired / Project time /
 * Output row: a line of small pill-labelled values, one of them filled with
 * the accent, the rest outlined, with a hatched remainder so the row reads as
 * one bar rather than four separate chips.
 *
 * What it shows here is the account, not a work plan: how much of the balance
 * is committed as margin, and what is left.
 */

export interface MetricStripItem {
  label: string;
  value: string;
  /** 0–1. Drives the pill's width share of the row. */
  weight: number;
  tone?: 'accent' | 'solid' | 'outline';
}

export function MetricStrip({ items }: { items: MetricStripItem[] }) {
  const total = items.reduce((s, i) => s + Math.max(i.weight, 0.08), 0) || 1;

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      {items.map((item) => {
        const share = Math.max(item.weight, 0.08) / total;
        return (
          <div
            key={item.label}
            className="min-w-[88px] flex-1"
            style={{ flexGrow: share * 100 }}
          >
            <p className="mb-1.5 text-[11px] text-text-tertiary">{item.label}</p>
            <div
              className="flex h-9 items-center justify-center rounded-full px-3 text-xs font-semibold tabular-nums"
              style={
                item.tone === 'accent'
                  ? { background: '#FF6A00', color: '#0a0705' }
                  : item.tone === 'solid'
                    ? { background: 'var(--bg-active)', color: 'var(--text-primary)' }
                    : {
                        border: '1px solid var(--border-primary)',
                        color: 'var(--text-secondary)',
                      }
              }
            >
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
