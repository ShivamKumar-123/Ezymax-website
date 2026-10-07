'use client';

import { BookOpen, BarChart3, DollarSign, Info, PieChart, TrendingUp, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import type { TradingJournalBlock } from '@/lib/trading-dashboard';

const NEON = '#1E88FF';
const CARD = 'var(--bg-card)';
const BORDER = 'var(--border-primary)';

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtCompactSigned(n: number) {
  const sign = n >= 0 ? '+' : '−';
  const a = Math.abs(n);
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

function RingGauge({
  value,
  max,
  label,
  sub,
  size = 100,
}: {
  value: number;
  max: number;
  label: string;
  sub: string;
  size?: number;
}) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  const dash = c * pct;
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-primary)" strokeWidth={6} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={NEON}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className="drop-shadow-[0_0_6px_rgba(30,136,255,0.45)]"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-text-primary leading-none">{label}</span>
          <span className="text-[9px] text-text-tertiary uppercase mt-1 tracking-wide">{sub}</span>
        </div>
      </div>
    </div>
  );
}

export default function TradingJournalSection({
  journal: j,
  title = 'Trading Journal',
}: {
  journal: TradingJournalBlock;
  title?: string;
}) {
  return (
    <section className="text-text-primary">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#1E88FF]/12 border border-[#1E88FF]/25 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-[#1E88FF]" />
        </div>
        <h2 className="text-lg md:text-xl font-bold tracking-tight">{title}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="group rounded-2xl p-4 pl-5 border relative overflow-hidden transition-all duration-300 hover:-translate-y-1" style={{ background: 'radial-gradient(130% 120% at 95% -25%, rgba(30,136,255,0.14), transparent 55%), var(--bg-card)', borderColor: 'rgba(30,136,255,0.22)', boxShadow: '0 8px 26px rgba(0,0,0,0.28)' }}>
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5" style={{ background: 'linear-gradient(180deg, #7CC9FF, #1E88FF 55%, #0B5BD3)', boxShadow: '0 0 14px rgba(30,136,255,0.5)' }} aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent opacity-70 transition-opacity group-hover:opacity-100" aria-hidden />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1E88FF]" />
                Balance
              </p>
              <p className="text-2xl md:text-3xl font-bold mt-1 tabular-nums">{fmtUsd(j.balance)}</p>
            </div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(30,136,255,0.12)', border: '1px solid rgba(30,136,255,0.28)' }}>
              <Wallet className="w-5 h-5 text-[#1E88FF]" />
            </div>
          </div>
        </div>
        <div className="group rounded-2xl p-4 pl-5 border relative overflow-hidden transition-all duration-300 hover:-translate-y-1" style={{ background: 'radial-gradient(130% 120% at 95% -25%, rgba(30,136,255,0.14), transparent 55%), var(--bg-card)', borderColor: 'rgba(30,136,255,0.22)', boxShadow: '0 8px 26px rgba(0,0,0,0.28)' }}>
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5" style={{ background: 'linear-gradient(180deg, #7CC9FF, #1E88FF 55%, #0B5BD3)', boxShadow: '0 0 14px rgba(30,136,255,0.5)' }} aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent opacity-70 transition-opacity group-hover:opacity-100" aria-hidden />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1E88FF]" />
                Equity
              </p>
              <p className="text-2xl md:text-3xl font-bold mt-1 tabular-nums">{fmtUsd(j.equity)}</p>
            </div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(30,136,255,0.12)', border: '1px solid rgba(30,136,255,0.28)' }}>
              <DollarSign className="w-5 h-5 text-[#1E88FF]" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {[
          {
            label: 'Net P&L',
            icon: DollarSign,
            value: fmtCompactSigned(j.netPl),
            valueClass: j.netPl >= 0 ? 'text-[#1E88FF]' : 'text-red-400',
            sub: `${j.netPlTradeCount} trades`,
          },
          {
            label: 'Profit factor',
            icon: TrendingUp,
            value: String(j.profitFactor),
            valueClass: 'text-[#1E88FF]',
            sub: j.profitFactorNote,
          },
          {
            label: 'Lots traded',
            icon: BarChart3,
            value: j.lotsTraded.toFixed(2),
            valueClass: 'text-text-primary',
            sub: `${j.totalTrades} trades`,
          },
          {
            label: 'Total trades',
            icon: BarChart3,
            value: String(j.totalTrades),
            valueClass: 'text-text-primary',
            sub: `${j.wins} win, ${j.losses} losses`,
          },
        ].map((m) => (
          <div key={m.label} className="group rounded-2xl p-3.5 border transition-all duration-300 hover:-translate-y-0.5 hover:border-[#1E88FF]/30" style={{ background: 'radial-gradient(130% 100% at 90% -25%, rgba(30,136,255,0.05), transparent 60%), var(--bg-card)', borderColor: BORDER }}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wide mb-1.5">
              <span className="grid place-items-center w-6 h-6 rounded-lg" style={{ background: 'rgba(30,136,255,0.10)' }}>
                <m.icon className="w-3.5 h-3.5 text-[#1E88FF]" />
              </span>
              {m.label}
            </div>
            <p className={clsx('text-xl md:text-2xl font-extrabold tabular-nums', m.valueClass)}>{m.value}</p>
            <p className="text-[11px] text-text-tertiary mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-2xl p-4 border" style={{ background: 'radial-gradient(120% 100% at 92% -20%, rgba(30,136,255,0.045), transparent 60%), var(--bg-card)', borderColor: BORDER }}>
          <div className="flex items-center gap-2 text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-4">
            Current streak
            <Info className="w-3.5 h-3.5 text-text-tertiary" />
          </div>
          <div className="flex flex-wrap justify-around gap-6">
            <RingGauge value={j.streakDays} max={7} label={String(j.streakDays)} sub={`Days / ${j.streakDaysNote}`} />
            <RingGauge
              value={j.streakTrades}
              max={10}
              label={String(j.streakTrades)}
              sub={`Trades / ${j.streakTradesNote}`}
            />
          </div>
        </div>
        <div className="rounded-2xl p-4 border" style={{ background: 'radial-gradient(120% 100% at 92% -20%, rgba(30,136,255,0.045), transparent 60%), var(--bg-card)', borderColor: BORDER }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
            <PieChart className="w-4 h-4 text-[#1E88FF]" />
            Account stats
          </div>
          <ul className="space-y-2.5 text-sm">
            {[
              ['Free margin', fmtUsd(j.freeMargin)],
              ['Used margin', fmtUsd(j.usedMargin)],
              ['Margin level', j.marginLevel ?? 'N/A'],
              ['Currency', j.currency],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2">
                <span className="text-text-tertiary">{k}</span>
                <span className="text-text-primary font-medium tabular-nums text-right">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
