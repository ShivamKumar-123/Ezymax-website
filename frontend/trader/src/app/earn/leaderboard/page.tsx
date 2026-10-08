'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, Trophy, Crown, Medal, TrendingUp, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';

type Row = {
  rank: number;
  user_id: string;
  name: string;
  ac_balance?: number;
  roi_30d_usd?: number;
};

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));
const fmtUsd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const initials = (name: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

export default function EarnLeaderboardPage() {
  return (
    <DashboardShell>
      <Inner />
    </DashboardShell>
  );
}

function Inner() {
  const [tab, setTab] = useState<'traders' | 'earners'>('traders');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<Row[]>(`/rewards/leaderboard?kind=${tab}&limit=20`);
      setRows(r);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  const scoreOf = (r: Row) =>
    tab === 'earners' ? `${fmt(r.ac_balance ?? 0)} AC` : fmtUsd(r.roi_30d_usd ?? 0);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  // Podium visual order: 2nd, 1st, 3rd so #1 sits centre + tallest.
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as Row[];

  const rankStyles: Record<number, { ring: string; badgeBg: string; badgeText: string; icon: ReactNode; label: string }> = {
    1: {
      ring: 'rgba(255,106,0,0.55)',
      badgeBg: 'linear-gradient(180deg, #FFB380, #FF6A00 55%, #C2410C)',
      badgeText: '#060606',
      icon: <Crown className="w-4 h-4" />,
      label: 'Champion',
    },
    2: {
      ring: 'rgba(203,213,225,0.35)',
      badgeBg: 'linear-gradient(180deg, #e2e8f0, #94a3b8)',
      badgeText: '#060606',
      icon: <Medal className="w-4 h-4" />,
      label: 'Runner-up',
    },
    3: {
      ring: 'rgba(217,119,6,0.35)',
      badgeBg: 'linear-gradient(180deg, #fbbf24, #b45309)',
      badgeText: '#060606',
      icon: <Medal className="w-4 h-4" />,
      label: 'Third',
    },
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Premium page header */}
      <header className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,106,0,0.12)', border: '1px solid rgba(255,106,0,0.25)' }}
        >
          <Trophy className="w-5 h-5 text-[#FF6A00]" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-text-primary">Leaderboard</h1>
          <p className="text-sm text-text-tertiary">Top traders by P&amp;L over the last 30 days, and top earners by Coin balance.</p>
        </div>
      </header>

      {/* Segmented tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-border-primary bg-bg-secondary">
        {(['traders', 'earners'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ' +
              (tab === k
                ? 'bg-[#FF6A00] text-[#060606]'
                : 'text-text-secondary hover:text-text-primary')
            }
          >
            {k === 'traders' ? <TrendingUp className="w-4 h-4" /> : <Coins className="w-4 h-4" />}
            {k === 'traders' ? 'Top Traders' : 'Top Earners'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-secondary text-sm gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border-primary bg-card text-center py-16 text-text-tertiary text-sm">
          No data yet.
        </div>
      ) : (
        <>
          {/* ── Top-3 podium ── */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              {podiumOrder.map((r) => {
                const isFirst = r.rank === 1;
                const rs = rankStyles[r.rank] ?? rankStyles[3];
                return (
                  <div
                    key={r.user_id}
                    className={
                      'rounded-2xl border relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ' +
                      (isFirst ? 'sm:-mt-4 sm:pb-2' : '')
                    }
                    style={{
                      background: isFirst
                        ? 'radial-gradient(130% 120% at 50% -25%, rgba(255,106,0,0.18), transparent 60%), var(--bg-card)'
                        : 'radial-gradient(130% 120% at 95% -25%, rgba(255,106,0,0.08), transparent 55%), var(--bg-card)',
                      borderColor: rs.ring,
                      boxShadow: isFirst
                        ? '0 12px 34px rgba(0,0,0,0.34), 0 0 22px rgba(255,106,0,0.12)'
                        : '0 8px 26px rgba(0,0,0,0.28)',
                    }}
                  >
                    {isFirst && (
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-1"
                        style={{ background: 'linear-gradient(90deg, #FFB380, #FF6A00 55%, #C2410C)', boxShadow: '0 0 14px rgba(255,106,0,0.5)' }}
                      />
                    )}
                    <div className="flex flex-col items-center text-center px-4 pt-6 pb-5 gap-3">
                      {/* Avatar with rank badge */}
                      <div className="relative">
                        <div
                          className={
                            'rounded-full flex items-center justify-center font-bold text-text-primary ' +
                            (isFirst ? 'w-20 h-20 text-2xl' : 'w-16 h-16 text-xl')
                          }
                          style={{
                            background: 'var(--bg-secondary)',
                            border: `2px solid ${rs.ring}`,
                            boxShadow: isFirst ? '0 0 18px rgba(255,106,0,0.22)' : 'none',
                          }}
                        >
                          {initials(r.name)}
                        </div>
                        <div
                          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style={{ background: rs.badgeBg, color: rs.badgeText }}
                        >
                          {rs.icon}
                          #{r.rank}
                        </div>
                      </div>
                      <div className="mt-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isFirst ? '#FF6A00' : 'var(--text-tertiary)' }}>
                          {rs.label}
                        </p>
                        <p className="text-sm font-semibold text-text-primary truncate max-w-[12rem]">{r.name}</p>
                      </div>
                      <div
                        className="px-3 py-1.5 rounded-lg text-sm font-bold tabular-nums"
                        style={{
                          background: isFirst ? 'rgba(255,106,0,0.14)' : 'rgba(255,106,0,0.08)',
                          border: '1px solid rgba(255,106,0,0.22)',
                          color: 'var(--accent-ink)',
                        }}
                      >
                        {scoreOf(r)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Ranked rows (4th onward) ── */}
          {rest.length > 0 && (
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: 'var(--bg-card)', borderColor: 'rgba(255,106,0,0.16)', boxShadow: '0 8px 26px rgba(0,0,0,0.28)' }}
            >
              <ul className="divide-y divide-border-primary">
                {rest.map((r) => (
                  <li key={r.user_id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-hover/40">
                    <span className="w-8 shrink-0 text-center text-sm font-bold tabular-nums text-text-tertiary">
                      #{r.rank}
                    </span>
                    <div
                      className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-text-secondary"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                    >
                      {initials(r.name)}
                    </div>
                    <span className="flex-1 text-sm text-text-primary truncate">{r.name}</span>
                    <span
                      className="text-sm font-semibold tabular-nums px-2.5 py-1 rounded-lg"
                      style={{ background: 'rgba(255,106,0,0.07)', border: '1px solid rgba(255,106,0,0.16)', color: 'var(--accent-ink)' }}
                    >
                      {scoreOf(r)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
