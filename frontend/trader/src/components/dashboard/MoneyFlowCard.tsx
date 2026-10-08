'use client';

import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

/**
 * Deposits against withdrawals, as the two-figure split the reference layout
 * uses for its income-and-expenses panel: the percentages large, a single
 * stacked bar underneath carrying both shares.
 *
 * Lifetime totals from /wallet/summary, not a period — the endpoint has no
 * window, and a percentage labelled with a timeframe it was not measured over
 * would be worse than one with no timeframe at all.
 */
export function MoneyFlowCard({
  deposited,
  withdrawn,
  fmt,
  loading,
}: {
  deposited: number;
  withdrawn: number;
  fmt: (n: number) => string;
  loading?: boolean;
}) {
  const total = deposited + withdrawn;
  const inPct = total > 0 ? (deposited / total) * 100 : 0;
  const outPct = total > 0 ? (withdrawn / total) * 100 : 0;
  const empty = !loading && total === 0;

  return (
    <div
      className="flex h-full flex-col lg-surface p-5"
    >
      <p className="text-sm font-semibold text-text-primary">
        Deposits &amp; withdrawals
      </p>

      {empty ? (
        <p className="mt-4 text-xs leading-relaxed text-text-tertiary">
          Nothing has moved yet. Your first deposit will show here.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-end gap-8">
            <div>
              <p className="text-2xl font-bold tabular-nums text-text-primary">
                {Math.round(inPct)}%
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-text-tertiary">
                <ArrowDownToLine size={11} className="text-[#22c55e]" /> In ·{' '}
                {fmt(deposited)}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-text-primary">
                {Math.round(outPct)}%
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-text-tertiary">
                <ArrowUpFromLine size={11} className="text-[#FF6A00]" /> Out ·{' '}
                {fmt(withdrawn)}
              </p>
            </div>
          </div>

          <div
            className="mt-5 flex h-2.5 overflow-hidden rounded-full"
            style={{ background: 'var(--bg-active)' }}
          >
            <span style={{ width: `${inPct}%`, background: '#22c55e' }} />
            <span style={{ width: `${outPct}%`, background: '#FF6A00' }} />
          </div>

          <p className="mt-3 text-[10px] text-text-tertiary">
            Lifetime totals across your wallet.
          </p>
        </>
      )}
    </div>
  );
}
