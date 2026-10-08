'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Coins, Loader2, Sparkles, History, Gift } from 'lucide-react';
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
      {/* Premium page header */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-text-tertiary hover:text-text-primary p-2 rounded-lg border border-border-primary hover:bg-bg-hover transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,106,0,0.12)', border: '1px solid rgba(255,106,0,0.25)' }}
          >
            <Sparkles className="w-5 h-5 text-[#FF6A00]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-text-primary">Spin &amp; Win</h1>
            <p className="text-sm text-text-tertiary">Spend AC Coins to spin the wheel and win cashback or bonus AC.</p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl shrink-0"
          style={{ background: 'rgba(255,106,0,0.10)', border: '1px solid rgba(255,106,0,0.25)' }}
        >
          <Coins size={16} className="text-[#FF6A00]" />
          <span className="text-sm font-bold text-text-primary tabular-nums">{fmt(acBalance)} <span className="text-text-tertiary font-medium">AC</span></span>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-text-secondary text-sm gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Wheel — hero premium card with accent bar */}
          <div
            className="lg:col-span-2 rounded-2xl border relative overflow-hidden transition-all duration-300 pl-5"
            style={{
              background: 'radial-gradient(130% 120% at 50% -25%, rgba(255,106,0,0.10), transparent 55%), var(--bg-card)',
              borderColor: 'rgba(255,106,0,0.16)',
              boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
            }}
          >
            <div
              className="pointer-events-none absolute left-0 top-0 bottom-0 w-1"
              style={{ background: 'linear-gradient(180deg, #FFB380, #FF6A00 55%, #C2410C)', boxShadow: '0 0 14px rgba(255,106,0,0.5)' }}
            />
            <div className="p-6 sm:p-10">
              <SpinWheel
                acBalance={acBalance}
                onResult={() => { void loadRecent(); }}
                onAcChange={(b) => setAcBalance(b)}
              />
            </div>
          </div>

          {/* Recent spins — premium card */}
          <aside
            className="rounded-2xl border relative overflow-hidden"
            style={{
              background: 'radial-gradient(130% 120% at 95% -25%, rgba(255,106,0,0.08), transparent 55%), var(--bg-card)',
              borderColor: 'rgba(255,106,0,0.16)',
              boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
            }}
          >
            <div className="p-4">
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,106,0,0.10)', border: '1px solid rgba(255,106,0,0.22)' }}
                >
                  <History className="w-4 h-4 text-[#FF6A00]" />
                </div>
                <h2 className="text-sm font-bold text-text-primary">Your recent spins</h2>
              </div>
              {recent.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.18)' }}
                  >
                    <Gift className="w-6 h-6 text-[#FF6A00]" />
                  </div>
                  <p className="text-xs text-text-tertiary">No spins yet — give the wheel a turn!</p>
                </div>
              ) : (
                <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {recent.map((r) => {
                    const won = r.payout_kind !== 'nothing';
                    return (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-2 text-xs px-3 py-2.5 rounded-xl border transition-colors"
                        style={{
                          background: won ? 'rgba(255,106,0,0.06)' : 'var(--bg-secondary)',
                          borderColor: won ? 'rgba(255,106,0,0.18)' : 'var(--border-primary)',
                        }}
                      >
                        <div className="min-w-0">
                          <p className="text-text-primary font-semibold truncate">{r.label}</p>
                          <p className="text-text-tertiary text-[10.5px] mt-0.5">
                            {new Date(r.awarded_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                        <span
                          className={
                            'tabular-nums font-bold shrink-0 ' +
                            (won ? 'text-[#FF6A00]' : 'text-text-tertiary')
                          }
                        >
                          {won ? `+${fmt(r.payout_amount)} ${r.payout_kind === 'xp' ? 'XP' : 'AC'}` : '—'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
