'use client';

import { useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { formatDate, formatDateTime, formatNumber } from '@/lib/formatters';
import type { BacktestStats, BacktestTrade, EquityPoint } from '@/lib/ai-strategies';

// ─── Equity curve — bespoke inline SVG (no chart lib in this codebase) ────────

const W = 700;
const H = 220;
const PAD_L = 10;
const PAD_R = 10;
const PAD_T = 14;
const PAD_B = 26;

export function EquityCurve({ curve }: { curve: EquityPoint[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const model = useMemo(() => {
    const pts = (curve || []).filter((p) => Number.isFinite(p?.equity) && Number.isFinite(p?.ts));
    if (pts.length < 2) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const p of pts) {
      if (p.equity < min) min = p.equity;
      if (p.equity > max) max = p.equity;
    }
    if (max - min < 1e-9) {
      max += 1;
      min -= 1;
    }
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;
    const x = (i: number) => PAD_L + (i / (pts.length - 1)) * plotW;
    const y = (v: number) => PAD_T + (1 - (v - min) / (max - min)) * plotH;
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.equity).toFixed(2)}`).join('');
    const areaPath = `${linePath}L${x(pts.length - 1).toFixed(2)},${H - PAD_B}L${PAD_L},${H - PAD_B}Z`;
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    const up = last.equity >= first.equity;
    return { pts, min, max, x, y, linePath, areaPath, first, last, up };
  }, [curve]);

  if (!model) {
    return <p className="text-[11px] text-text-tertiary py-6 text-center">Not enough equity data to draw a curve.</p>;
  }

  const { pts, min, max, x, y, linePath, areaPath, first, last, up } = model;
  // Green when the strategy ended at/above its starting equity, red otherwise.
  const stroke = up ? '#059669' : '#DC2626';
  const gradId = up ? 'aiEquityFillUp' : 'aiEquityFillDown';

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const t = (vx - PAD_L) / (W - PAD_L - PAD_R);
    const idx = Math.round(t * (pts.length - 1));
    setHoverIdx(Math.max(0, Math.min(pts.length - 1, idx)));
  };

  const hover = hoverIdx != null ? pts[hoverIdx] : undefined;
  const hoverX = hoverIdx != null ? x(hoverIdx) : 0;
  const hoverAnchor: 'start' | 'end' = hoverX > W * 0.6 ? 'end' : 'start';

  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[420px] h-auto block"
        role="img"
        aria-label={`Equity curve from ${formatDate(first.ts * 1000)} to ${formatDate(last.ts * 1000)}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* recessive top/bottom gridlines at max/min */}
        <line x1={PAD_L} x2={W - PAD_R} y1={y(max)} y2={y(max)} stroke="currentColor" className="text-border-primary" strokeDasharray="3 4" strokeWidth="1" />
        <line x1={PAD_L} x2={W - PAD_R} y1={y(min)} y2={y(min)} stroke="currentColor" className="text-border-primary" strokeDasharray="3 4" strokeWidth="1" />

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* min / max equity labels */}
        <text x={PAD_L} y={y(max) - 4} fontSize="10" fill="currentColor" className="text-text-tertiary">
          ${formatNumber(max)}
        </text>
        <text x={PAD_L} y={y(min) - 4} fontSize="10" fill="currentColor" className="text-text-tertiary">
          ${formatNumber(min)}
        </text>

        {/* start / end date labels */}
        <text x={PAD_L} y={H - 8} fontSize="10" fill="currentColor" className="text-text-tertiary">
          {formatDate(first.ts * 1000)}
        </text>
        <text x={W - PAD_R} y={H - 8} fontSize="10" textAnchor="end" fill="currentColor" className="text-text-tertiary">
          {formatDate(last.ts * 1000)}
        </text>

        {/* hover crosshair + readout */}
        {hover && (
          <g pointerEvents="none">
            <line x1={hoverX} x2={hoverX} y1={PAD_T} y2={H - PAD_B} stroke="currentColor" className="text-text-tertiary" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={hoverX} cy={y(hover.equity)} r="3.5" fill={stroke} stroke="#fff" strokeWidth="1.5" />
            <text
              x={hoverAnchor === 'start' ? hoverX + 6 : hoverX - 6}
              y={PAD_T + 10}
              fontSize="10.5"
              fontWeight="600"
              textAnchor={hoverAnchor}
              fill="currentColor"
              className="text-text-primary"
            >
              ${formatNumber(hover.equity)} · {formatDate(hover.ts * 1000)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ─── Stats grid + trades table ────────────────────────────────────────────────

function pnlCls(v: number) {
  return v >= 0 ? 'text-emerald-600' : 'text-red-600';
}

export default function BacktestPanel({
  stats,
  curve,
  trades,
  subtitle,
}: {
  stats: BacktestStats;
  curve: EquityPoint[];
  trades?: BacktestTrade[];
  subtitle?: string;
}) {
  const cells: { label: string; value: string; cls?: string }[] = [
    { label: 'Net Profit', value: `${stats.net_profit >= 0 ? '+' : '-'}$${formatNumber(Math.abs(stats.net_profit))}`, cls: pnlCls(stats.net_profit) },
    { label: 'Return', value: `${stats.return_pct >= 0 ? '+' : ''}${formatNumber(stats.return_pct)}%`, cls: pnlCls(stats.return_pct) },
    { label: 'Win Rate', value: `${formatNumber(stats.win_rate, 1)}%` },
    { label: 'Profit Factor', value: Number.isFinite(stats.profit_factor) ? formatNumber(stats.profit_factor) : '∞' },
    { label: 'Max Drawdown', value: `${formatNumber(stats.max_drawdown_pct)}%`, cls: 'text-red-600' },
    { label: 'Trades', value: `${stats.total_trades} (${stats.wins}W / ${stats.losses}L)` },
  ];

  return (
    <div className="space-y-4">
      {subtitle && <p className="text-[11px] text-text-tertiary">{subtitle}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg border border-border-primary bg-bg-secondary/50 px-3 py-2">
            <p className="text-[9.5px] uppercase tracking-wide font-semibold text-text-tertiary">{c.label}</p>
            <p className={clsx('text-sm font-bold font-mono tabular-nums mt-0.5', c.cls ?? 'text-text-primary')}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border-primary bg-card p-3">
        <div className="flex items-baseline justify-between gap-2 mb-1 px-1">
          <p className="text-[11px] font-semibold text-text-secondary">Equity Curve</p>
          <p className="text-[10px] text-text-tertiary tabular-nums">
            ${formatNumber(stats.initial_balance)} → ${formatNumber(stats.final_balance)} · {stats.bars_used} bars
          </p>
        </div>
        <EquityCurve curve={curve} />
      </div>

      {trades && trades.length > 0 && <BacktestTradesTable trades={trades} />}
    </div>
  );
}

/** Simulated fills from a backtest run — reused by the strategy detail page. */
export function BacktestTradesTable({ trades }: { trades: BacktestTrade[] }) {
  return (
    <div className="rounded-xl border border-border-primary bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border-primary">
        <p className="text-[11px] font-semibold text-text-secondary">Trades (last {trades.length})</p>
      </div>
      <div className="max-h-72 overflow-y-auto overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border-primary text-text-tertiary text-left">
                  <th className="px-3 py-2 font-medium">Side</th>
                  <th className="px-3 py-2 font-medium">Entry</th>
                  <th className="px-3 py-2 font-medium">Exit</th>
                  <th className="px-3 py-2 font-medium text-right">Lots</th>
                  <th className="px-3 py-2 font-medium text-right">P&amp;L</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i} className="border-b border-border-primary last:border-0 hover:bg-bg-hover">
                    <td className="px-3 py-2">
                      <span className={clsx(
                        'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                        String(t.side).toLowerCase() === 'buy' ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell',
                      )}>
                        {t.side}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                      <span className="font-mono text-text-primary">{t.entry_price}</span>
                      <span className="text-text-tertiary text-[10px] ml-1.5">{formatDateTime(t.entry_ts * 1000)}</span>
                    </td>
                    <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                      <span className="font-mono text-text-primary">{t.exit_price}</span>
                      <span className="text-text-tertiary text-[10px] ml-1.5">{formatDateTime(t.exit_ts * 1000)}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-text-primary">{t.lots}</td>
                    <td className={clsx('px-3 py-2 text-right font-mono font-bold tabular-nums', pnlCls(t.pnl))}>
                      {t.pnl >= 0 ? '+' : '-'}${formatNumber(Math.abs(t.pnl))}
                    </td>
                    <td className="px-3 py-2 text-text-tertiary">{t.exit_reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
        </table>
      </div>
    </div>
  );
}
