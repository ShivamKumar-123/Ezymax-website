'use client';

import { Flame, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { PanelCard } from './PanelCard';

export interface Mover { symbol: string; pct: number; price: number }

const fmtNum = (n: number, dp = 2) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
    .format(Number.isFinite(n) ? n : 0);

/**
 * Top daily movers — the EXISTING live-movers computation (day-open from
 * /instruments/{s}/bars vs live /instruments/prices/all), restyled to the
 * reference's compact market list.
 */
export function TopMoversCard({ movers }: { movers: Mover[] }) {
  return (
    <PanelCard title="Top daily movers" icon={Flame}>
      {movers.length === 0 ? (
        <p className="py-8 text-center text-xs text-text-tertiary flex items-center justify-center gap-2">
          <Loader2 size={13} className="animate-spin" /> Loading…
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
          {movers.map((m) => {
            const up = m.pct >= 0;
            const Icon = up ? TrendingUp : TrendingDown;
            return (
              <li key={m.symbol} className="py-2.5 flex items-center gap-3">
                <span className="text-sm font-bold text-text-primary flex-1">{m.symbol}</span>
                <span className="text-xs font-mono tabular-nums text-text-secondary">
                  {Number.isFinite(m.price) && m.price > 0
                    ? fmtNum(m.price, m.symbol === 'BTCUSD' ? 0 : 4)
                    : '—'}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums"
                  style={{
                    color: up ? '#22c55e' : '#ef4444',
                    background: up ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
                  }}
                >
                  <Icon size={11} />
                  {Number.isFinite(m.pct) ? `${up ? '+' : ''}${m.pct.toFixed(2)}%` : '—'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}
