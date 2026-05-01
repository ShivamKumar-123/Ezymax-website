'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Coins, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import SpinWheel from '@/components/earn/SpinWheel';
import api from '@/lib/api/client';

type RecentSpin = {
  id: string;
  label: string;
  payout_kind: 'xp' | 'ac' | 'cashback' | 'nothing';
  payout_amount: number;
  ac_cost: number;
  awarded_at: string;
};

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

export default function SpinPage() {
  return (
    <DashboardShell>
      <Inner />
    </DashboardShell>
  );
}

function Inner() {
  const [acBalance, setAcBalance] = useState<number>(0);
  const [recent, setRecent] = useState<RecentSpin[]>([]);
  const [loading, setLoading] = useState(true);

  const loadState = useCallback(async () => {
    try {
      const s = await api.get<{ ac_balance: number }>('/rewards/state');
      setAcBalance(Number(s.ac_balance ?? 0));
    } catch (err: any) {
      toast.error(err?.message || 'Could not load balance');
    }
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const r = await api.get<RecentSpin[]>('/play/spin/recent?limit=10');
      setRecent(r);
    } catch { /* recent list is optional */ }
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadState(), loadRecent()]);
      setLoading(false);
    })();
  }, [loadState, loadRecent]);

  return (
    <div className="space-y-6 pb-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/earn/play-zone"
            className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-hover transition-colors"
            aria-label="Back to Play Zone"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">Spin &amp; Win</h1>
            <p className="text-sm text-text-secondary mt-0.5">Spend Artha Coins to spin the wheel and win cashback or bonus AC.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#d6a93d]/30 bg-[#d6a93d]/5">
          <Coins size={14} className="text-[#d6a93d]" />
          <span className="text-sm font-semibold text-text-primary tabular-nums">{fmt(acBalance)} AC</span>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-text-secondary text-sm gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 rounded-xl border border-border-primary bg-bg-secondary p-6 sm:p-10">
            <SpinWheel
              acBalance={acBalance}
              onResult={() => { void loadRecent(); }}
              onAcChange={(b) => setAcBalance(b)}
            />
          </div>

          <aside className="rounded-xl border border-border-primary bg-bg-secondary p-4">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Your recent spins</h2>
            {recent.length === 0 ? (
              <p className="text-xs text-text-tertiary">No spins yet — give the wheel a turn!</p>
            ) : (
              <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-md border border-border-primary bg-bg-base">
                    <div>
                      <p className="text-text-primary font-medium">{r.label}</p>
                      <p className="text-text-tertiary text-[10.5px] mt-0.5">
                        {new Date(r.awarded_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    <span
                      className={
                        'tabular-nums font-semibold ' +
                        (r.payout_kind === 'nothing' ? 'text-text-tertiary' : 'text-emerald-400')
                      }
                    >
                      {r.payout_kind === 'nothing'
                        ? '—'
                        : `+${fmt(r.payout_amount)} ${r.payout_kind === 'xp' ? 'XP' : 'AC'}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
