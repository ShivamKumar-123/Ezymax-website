'use client';

import { useLiveQuotes } from '@/lib/useLiveQuotes';
import { changePct, formatPct, formatPrice, mid, type QuoteMap } from '@/lib/quotes';
import { cn } from '@/lib/cn';

export type LiveRow = { s: string; name: string; digits: number; group?: string; soon?: boolean };

/** Compact live price list (options underlyings, market highlights). */
export function LiveList({ rows, initial, className }: { rows: LiveRow[]; initial: QuoteMap; className?: string }) {
  const { quotes, live } = useLiveQuotes(
    rows.filter((r) => !r.soon).map((r) => r.s),
    initial,
  );
  let lastGroup: string | undefined;
  return (
    <div className={cn('rounded-[28px] border border-white/[0.09] bg-white/[0.02] p-2', className)}>
      <div className="flex items-center justify-between px-4 pb-2 pt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-3">
        <span>Underlying</span>
        <span className="flex items-center gap-1.5 normal-case tracking-normal">
          <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-up' : 'bg-fg-3')} />
          {live ? 'Live prices' : 'Latest prices'}
        </span>
      </div>
      <ul>
        {rows.map((r) => {
          const header = r.group && r.group !== lastGroup ? r.group : null;
          lastGroup = r.group;
          const q = quotes[r.s];
          const ch = changePct(q);
          return (
            <li key={r.s}>
              {header && <p className="px-4 pb-1 pt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-3">{header}</p>}
              <div className="flex items-center gap-4 rounded-2xl px-4 py-2.5 transition-colors hover:bg-white/[0.04]">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{r.s}</p>
                  <p className="truncate text-[12px] text-fg-3">{r.name}</p>
                </div>
                {r.soon ? (
                  <span className="chip !h-6 text-[10px]">Coming soon</span>
                ) : (
                  <>
                    <span className="num text-[14px]">{formatPrice(mid(q), r.digits)}</span>
                    <span className={cn('num w-16 text-right text-[12px]', ch === undefined ? 'text-fg-3' : ch >= 0 ? 'text-up' : 'text-down')}>
                      {formatPct(ch)}
                    </span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
