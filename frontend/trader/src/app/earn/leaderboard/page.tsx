'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
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

  return (
    <div className="space-y-5 pb-8">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
          Leaderboard <Trophy size={22} className="text-[#d6a93d]" />
        </h1>
        <p className="text-sm text-text-secondary mt-1">Top traders by P&amp;L over the last 30 days, and top earners by Coin balance.</p>
      </header>

      <div className="rounded-xl border border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-1 p-1 border-b border-border-primary">
          {(['traders', 'earners'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
                (tab === k
                  ? 'bg-[#d6a93d]/15 text-text-primary border border-[#d6a93d]/40'
                  : 'text-text-secondary hover:text-text-primary border border-transparent')
              }
            >
              {k === 'traders' ? 'Top Traders' : 'Top Earners'}
            </button>
          ))}
        </div>

        <div className="p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-text-secondary text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-text-tertiary text-sm">No data yet.</div>
          ) : (
            <ul className="divide-y divide-border-primary">
              {rows.map((r) => (
                <li key={r.user_id} className="flex items-center gap-3 px-3 py-3">
                  <span className="w-7 text-center text-sm font-bold tabular-nums text-text-tertiary">
                    #{r.rank}
                  </span>
                  <span className="flex-1 text-sm text-text-primary truncate">{r.name}</span>
                  <span className="text-sm font-semibold tabular-nums text-text-primary">
                    {tab === 'earners'
                      ? `${fmt(r.ac_balance ?? 0)} AC`
                      : fmtUsd(r.roi_30d_usd ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
