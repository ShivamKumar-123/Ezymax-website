'use client';

import Link from 'next/link';
import { Activity } from 'lucide-react';
import { PanelCard } from './PanelCard';
import { EquitySparkline } from './EquitySparkline';

export interface PerformanceStats {
  win_rate: number;
  total_trades: number;
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
    .format(Number.isFinite(n) ? n : 0);

/**
 * Performance — the EXISTING /portfolio/performance equity curve and
 * stats plus total equity from /portfolio/summary, in the reference's
 * "value + wave chart" card style.
 */
export function PerformanceCard({
  totalEquity,
  curve,
  stats,
}: {
  totalEquity: number | null;
  curve: Array<{ date: string; equity: number }>;
  stats: PerformanceStats | null;
}) {
  return (
    <PanelCard
      padding="lg"
      className="h-full flex flex-col"
      title="Performance"
      icon={Activity}
      action={
        <Link
          href="/portfolio?tab=performance"
          className="text-[11px] font-bold text-text-tertiary hover:text-text-primary transition-colors"
        >
          Details →
        </Link>
      }
    >
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-text-tertiary">
        Total equity
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-text-primary leading-none">
        {totalEquity == null ? '—' : fmtUsd(totalEquity)}
      </p>

      <div className="mt-3 -mx-1">
        <EquitySparkline points={curve} height={64} />
      </div>

      <div className="mt-auto pt-4 grid grid-cols-2 gap-3 text-[11px]">
        <div>
          <p className="text-text-tertiary">Win rate</p>
          <p className="font-bold tabular-nums text-text-primary">
            {stats ? `${Number(stats.win_rate).toFixed(1)}%` : '—'}
          </p>
        </div>
        <div>
          <p className="text-text-tertiary">Closed trades</p>
          <p className="font-bold tabular-nums text-text-primary">
            {stats ? stats.total_trades : '—'}
          </p>
        </div>
      </div>
    </PanelCard>
  );
}
