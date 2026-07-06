'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, CandlestickChart } from 'lucide-react';
import { ibGet, ibPost, fmt, fmtDate, UnauthorizedError } from '@/lib/api';
import type { IbUserDetail } from '@/lib/types';
import StatCard from './StatCard';
import SectionCard from './SectionCard';
import Spinner from './Spinner';

export default function UserDetail({ userId }: { userId: string }) {
  const router = useRouter();
  const [data, setData] = useState<IbUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const openTerminal = async () => {
    if (opening) return;
    setOpening(true);
    const tab = window.open('', '_blank');
    try {
      const res = await ibPost<{ redirect_url: string }>(`/business/ib/users/${userId}/impersonate`);
      if (tab) tab.location.href = res.redirect_url;
      else window.location.href = res.redirect_url;
    } catch (e: any) {
      if (tab) tab.close();
      if (e instanceof UnauthorizedError) return router.replace('/login');
      toast.error(e?.message || 'Could not open terminal.');
    } finally {
      setOpening(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setData(await ibGet<IbUserDetail>(`/business/ib/users/${userId}`));
      } catch (e: any) {
        if (e instanceof UnauthorizedError) return router.replace('/login');
        setErr(e?.message || 'Could not load user.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, router]);

  if (loading) return <Spinner />;
  if (err || !data) {
    return (
      <div className="rounded-2xl border border-border-primary bg-card p-8 text-center noise-texture">
        <p className="text-sm text-text-secondary">{err || 'User not found.'}</p>
        <button onClick={() => router.back()} className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg border border-border-primary px-4 py-2 text-xs text-text-secondary hover:bg-bg-hover">
          <ArrowLeft size={14} /> Back
        </button>
      </div>
    );
  }

  const u = data.user;
  return (
    <div className="space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="rounded-2xl border border-border-primary bg-card p-5 noise-texture">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{u.name || u.email}</h1>
            <p className="text-xs text-text-tertiary">{u.email}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded bg-bg-hover px-2 py-0.5 text-text-secondary">Status: {u.status}</span>
              <span className="rounded bg-bg-hover px-2 py-0.5 text-text-secondary">KYC: {u.kyc_status}</span>
              {u.country && <span className="rounded bg-bg-hover px-2 py-0.5 text-text-secondary">{u.country}</span>}
              <span className="rounded bg-bg-hover px-2 py-0.5 text-text-secondary">Joined {fmtDate(u.created_at)}</span>
            </div>
          </div>
          <button
            onClick={openTerminal}
            disabled={opening}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent px-3 py-2 text-xs font-semibold text-accent hover:bg-accent hover:text-black disabled:opacity-50"
          >
            <CandlestickChart size={14} /> {opening ? 'Opening…' : 'Trade for this user'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Commission" value={`$${fmt(data.commission_earned)}`} color="text-success" />
        <StatCard label="Total Earned" value={`$${fmt(data.deposits_total)}`} color="text-accent" />
        <StatCard label="Referrals" value={String(data.accounts.length)} color="text-text-primary" />
        <StatCard label="No Trade Yet" value={String(data.open_positions.length)} color="text-warning" />
      </div>

      <SectionCard title="Trading accounts" subtitle="Balances across this user's accounts">
        {data.accounts.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-text-tertiary">No accounts.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-[10px] uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-2.5 text-left">Account</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-right">Balance</th>
                <th className="px-4 py-2.5 text-right">Equity</th>
                <th className="px-4 py-2.5 text-right">Free margin</th>
                <th className="px-4 py-2.5 text-center">Leverage</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr key={a.id} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
                  <td className="px-4 py-2.5 font-mono text-text-primary">{a.account_number}</td>
                  <td className="px-4 py-2.5">
                    <span className={a.is_demo ? 'text-text-tertiary' : 'text-success'}>{a.is_demo ? 'Demo' : 'Live'}</span>
                    {a.book_type && <span className="ml-1 text-text-tertiary">· {a.book_type}-book</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-primary">${fmt(a.balance)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary">${fmt(a.equity)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary">${fmt(a.free_margin)}</td>
                  <td className="px-4 py-2.5 text-center text-text-secondary">1:{a.leverage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard title="Open positions" subtitle="Live positions on this user's accounts">
        {data.open_positions.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-text-tertiary">No open positions.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-[10px] uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-2.5 text-left">Symbol</th>
                <th className="px-4 py-2.5 text-left">Side</th>
                <th className="px-4 py-2.5 text-right">Lots</th>
                <th className="px-4 py-2.5 text-right">Open</th>
                <th className="px-4 py-2.5 text-right">Current</th>
                <th className="px-4 py-2.5 text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {data.open_positions.map((p) => (
                <tr key={p.id} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
                  <td className="px-4 py-2.5 text-text-primary">{p.symbol || p.instrument}</td>
                  <td className="px-4 py-2.5 uppercase text-text-secondary">{p.side}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{p.lots}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{p.open_price ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{p.current_price ?? '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${(p.profit ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                    ${fmt(p.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
