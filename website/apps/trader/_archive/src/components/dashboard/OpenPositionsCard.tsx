'use client';

import Link from 'next/link';
import { Layers, TrendingDown, TrendingUp } from 'lucide-react';
import { PanelCard } from './PanelCard';

export interface HoldingRow {
  symbol: string;
  side: string;
  lots: number;
  entry_price: number;
  current_price: number;
  pnl: number;
  pnl_pct: number;
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
    .format(Number.isFinite(n) ? n : 0);

/**
 * Open positions — the EXISTING /portfolio/summary holdings, presented
 * in the reference's "activity" list style. Links out to the existing
 * portfolio page and trading terminal; no new actions.
 */
export function OpenPositionsCard({ holdings, count }: { holdings: HoldingRow[]; count: number }) {
  return (
    <PanelCard
      title={`Open positions${count > 0 ? ` (${count})` : ''}`}
      icon={Layers}
      action={
        <Link
          href="/portfolio"
          className="text-[11px] font-bold text-text-tertiary hover:text-text-primary transition-colors"
        >
          View portfolio →
        </Link>
      }
    >
      {holdings.length === 0 ? (
        <p className="py-6 text-center text-xs text-text-tertiary">
          No open positions right now.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
          {holdings.slice(0, 5).map((h, i) => {
            const up = h.pnl >= 0;
            const Icon = up ? TrendingUp : TrendingDown;
            const buy = h.side?.toLowerCase() === 'buy';
            return (
              <li key={`${h.symbol}-${i}`} className="py-2.5 flex items-center gap-3">
                <span
                  className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-md"
                  style={buy
                    ? { color: '#22c55e', background: 'rgba(34,197,94,0.10)' }
                    : { color: '#ef4444', background: 'rgba(239,68,68,0.10)' }}
                >
                  {buy ? 'Buy' : 'Sell'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text-primary leading-tight">{h.symbol}</p>
                  <p className="text-[10px] text-text-tertiary tabular-nums">
                    {h.lots} lots @ {h.entry_price}
                  </p>
                </div>
                <span
                  className="inline-flex items-center gap-1 text-xs font-extrabold tabular-nums"
                  style={{ color: up ? '#22c55e' : '#ef4444' }}
                >
                  <Icon size={12} />
                  {up ? '+' : ''}{fmtUsd(h.pnl)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}
