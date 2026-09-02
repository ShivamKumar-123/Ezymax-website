'use client';

import { useBrandDisplay } from '@/components/providers/BrandingProvider';

type DisplayMode = 'pnl' | 'roi' | 'ticks';

export interface ShareSummary {
  total_pnl: number;
  total_trades: number;
  open_count: number;
  closed_count: number;
  wins: number;
  losses: number;
  win_rate: number;
  roi_pct: number;
  ticks: number;
  best_pnl: number;
  worst_pnl: number;
}

interface SharePortfolioCardProps {
  scope: 'open' | 'history';
  summary: ShareSummary;
  displayMode: DisplayMode;
  shortUrl: string;
}

function money(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`;
}

/** Sign comes from the value, never assumed: an all-losing account's BEST
 *  trade is still negative, and an all-winning account's WORST is positive. */
function signedMoney(n: number): string {
  return `${n >= 0 ? '+' : '-'}${money(n)}`;
}

/**
 * Share card for an ACCOUNT-WIDE link ("all open positions" / "entire
 * history"). Deliberately mirrors ShareTradeCard's frame — same 4:5 ratio,
 * star field, corner brackets and brand mark — so the two card types read
 * as one family when a user posts them side by side. Only the middle band
 * differs: aggregate figures instead of a single trade's entry/exit.
 */
export default function SharePortfolioCard({
  scope,
  summary,
  displayMode,
  shortUrl,
}: SharePortfolioCardProps) {
  const brand = useBrandDisplay();
  const positive = summary.total_pnl >= 0;
  const displayColor = positive ? '#10b981' : '#ef4444';

  const headline =
    displayMode === 'roi'
      ? `${Math.abs(summary.roi_pct).toFixed(2)}%`
      : displayMode === 'ticks'
        ? `${Math.abs(summary.ticks).toFixed(1)} ticks`
        : money(summary.total_pnl);

  // Ticks sign tracks the tick total, not P&L — a portfolio can be up on
  // pips while down on money (or vice versa) once lot sizes differ.
  const sign =
    displayMode === 'ticks' ? (summary.ticks >= 0 ? '+' : '-') : positive ? '+' : '-';

  const stats: { label: string; value: string }[] = [
    { label: 'Trades', value: String(summary.total_trades) },
    { label: 'Win rate', value: `${summary.win_rate.toFixed(0)}%` },
    {
      label: scope === 'open' ? 'Open' : 'Closed',
      value: String(scope === 'open' ? summary.open_count : summary.closed_count),
    },
  ];

  return (
    <div
      className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden border border-white/10"
      style={{
        background:
          'radial-gradient(circle at 50% 0%, rgba(30, 64, 175, 0.35) 0%, rgba(8, 10, 24, 0.95) 50%, rgba(0, 0, 0, 1) 100%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 20% 30%, #ffffff 1px, transparent 0), radial-gradient(1px 1px at 70% 20%, #ffffff 1px, transparent 0), radial-gradient(1px 1px at 40% 70%, #ffffff 1px, transparent 0), radial-gradient(1px 1px at 85% 50%, #ffffff 1px, transparent 0), radial-gradient(1px 1px at 15% 85%, #ffffff 1px, transparent 0), radial-gradient(1px 1px at 60% 90%, #ffffff 1px, transparent 0)',
          backgroundSize: '200px 200px',
        }}
      />

      <div className="absolute top-5 left-5 w-6 h-6 border-l-2 border-t-2 border-white/40" />
      <div className="absolute top-5 right-5 w-6 h-6 border-r-2 border-t-2 border-white/40" />
      <div className="absolute bottom-5 left-5 w-6 h-6 border-l-2 border-b-2 border-white/40" />
      <div className="absolute bottom-5 right-5 w-6 h-6 border-r-2 border-b-2 border-white/40" />

      <div className="relative h-full flex flex-col p-6 md:p-8">
        <div className="flex flex-col items-center justify-center pt-1 pb-3 gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brand.logoUrl || '/marketing/swisscresta_fevicon.png'}
            alt={brand.name}
            width={40}
            height={40}
            style={{ height: 40, width: 40, objectFit: 'contain', borderRadius: 8 }}
          />
          <span className="text-white text-[11px] font-bold tracking-[0.32em]">{brand.name.toUpperCase()}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <p className="text-white/70 text-sm font-semibold tracking-wider uppercase">
            {scope === 'open' ? 'Open Positions' : 'Trading History'}
          </p>
          <div className="flex items-baseline gap-1">
            <span
              className="text-5xl md:text-6xl font-extrabold tabular-nums"
              style={{ color: displayColor }}
            >
              {sign}
              {headline}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            {stats.map((s) => (
              <span
                key={s.label}
                className="px-2.5 py-1 rounded-md text-xs font-bold bg-white/10 text-white border border-white/20"
              >
                {s.value}{' '}
                <span className="font-semibold text-white/60 uppercase tracking-wide">{s.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="text-center py-3">
          <p className="text-white/60 text-xs font-mono">{shortUrl.replace(/^https?:\/\//, '')}</p>
        </div>

        <div className="flex items-center justify-around text-white pt-2 border-t border-white/10">
          <div className="text-center">
            <p
              className={`text-sm font-bold tabular-nums ${summary.best_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {signedMoney(summary.best_pnl)}
            </p>
            <p className="text-[10px] text-white/60 mt-0.5">BEST</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold tabular-nums">
              {summary.wins}W / {summary.losses}L
            </p>
            <p className="text-[10px] text-white/60 mt-0.5">RECORD</p>
          </div>
          <div className="text-center">
            <p
              className={`text-sm font-bold tabular-nums ${summary.worst_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {signedMoney(summary.worst_pnl)}
            </p>
            <p className="text-[10px] text-white/60 mt-0.5">WORST</p>
          </div>
        </div>
      </div>
    </div>
  );
}
