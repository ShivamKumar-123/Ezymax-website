'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, CandlestickChart, Search } from 'lucide-react';
import { ibGet, ibPost, fmt, fmtDate, UnauthorizedError } from '@/lib/api';
import type { IbUserDetail } from '@/lib/types';
import StatCard from './StatCard';
import SectionCard from './SectionCard';
import Spinner from './Spinner';
import PhoneActions from './PhoneActions';

type TradeStatus = 'all' | 'open' | 'closed';

interface UnifiedTrade {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number | null;
  exit_price: number | null;
  profit: number;
  status: 'open' | 'closed';
  account_number: string | null;
  when: string | null;
}

export default function UserDetail({ userId }: { userId: string }) {
  const router = useRouter();
  const [data, setData] = useState<IbUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  // Trade filters
  const [statusFilter, setStatusFilter] = useState<TradeStatus>('all');
  const [symbolFilter, setSymbolFilter] = useState('');

  const openTerminal = async () => {
    if (opening) return;
    setOpening(true);
    const tab = window.open('', '_blank');
    try {
      const acc = data?.accounts?.[0]?.id;
      const res = await ibPost<{ redirect_url: string }>(
        `/business/ib/users/${userId}/impersonate${acc ? `?account_id=${acc}` : ''}`,
      );
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

  // Live P&L. The detail (open positions + their P&L) is a one-time snapshot,
  // so after the IB opened a trade on this account the position's P&L looked
  // frozen. Re-fetch silently every 2.5s while the tab is visible — no loading
  // spinner, keeps the last good data on a transient error — so P&L moves and
  // newly opened trades appear without a manual refresh.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const fresh = await ibGet<IbUserDetail>(`/business/ib/users/${userId}`);
        if (!cancelled) setData(fresh);
      } catch {
        /* transient — keep showing the last good snapshot */
      }
    };
    const id = setInterval(tick, 2500);
    return () => { cancelled = true; clearInterval(id); };
  }, [userId]);

  // Combine open positions + closed history into one filterable log.
  const allTrades = useMemo<UnifiedTrade[]>(() => {
    if (!data) return [];
    const open: UnifiedTrade[] = (data.open_positions || []).map((p) => ({
      id: p.id,
      symbol: (p.symbol || p.instrument || '') as string,
      side: p.side,
      lots: p.lots,
      open_price: p.open_price ?? null,
      exit_price: p.current_price ?? null,
      profit: p.profit ?? 0,
      status: 'open',
      account_number: null,
      when: p.created_at ?? null,
    }));
    const closed: UnifiedTrade[] = (data.closed_trades || []).map((t) => ({
      id: t.id,
      symbol: t.symbol || '',
      side: t.side,
      lots: t.lots,
      open_price: t.open_price,
      exit_price: t.close_price,
      profit: t.profit,
      status: 'closed',
      account_number: t.account_number,
      when: t.closed_at,
    }));
    // Open first, then closed by most recent.
    return [...open, ...closed];
  }, [data]);

  const filteredTrades = useMemo(() => {
    const sym = symbolFilter.trim().toLowerCase();
    return allTrades.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (sym && !t.symbol.toLowerCase().includes(sym)) return false;
      return true;
    });
  }, [allTrades, statusFilter, symbolFilter]);

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
  const openCount = data.open_positions?.length || 0;
  const closedCount = data.closed_trades?.length || 0;

  return (
    <div className="space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary">
        <ArrowLeft size={14} /> Back
      </button>

      {/* Follower header + contact */}
      <div className="rounded-2xl border border-border-primary bg-card p-5 noise-texture">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{u.name || u.email}</h1>
            <p className="text-xs text-text-tertiary">{u.email}</p>
            <div className="mt-2.5">
              <PhoneActions phone={u.phone} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
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

      {/* Stats — corrected labels */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Commission earned" value={`$${fmt(data.commission_earned)}`} color="text-success" />
        <StatCard label="Total deposits" value={`$${fmt(data.deposits_total)}`} color="text-accent" />
        <StatCard label="Accounts" value={String(data.accounts.length)} color="text-text-primary" />
        <StatCard label="Open trades" value={String(openCount)} color="text-warning" />
        <StatCard label="Closed trades" value={String(closedCount)} color="text-text-secondary" />
      </div>

      {/* Trading accounts */}
      <SectionCard title="Trading accounts" subtitle="Balances across this user's accounts">
        {data.accounts.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-text-tertiary">No accounts.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-xs">
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
          </div>
        )}
      </SectionCard>

      {/* Trades — open + closed, filterable */}
      <SectionCard
        title="Trades"
        subtitle="Open and closed trades on this user's accounts"
      >
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border-primary px-4 py-3">
          <div className="inline-flex rounded-lg border border-border-primary p-0.5">
            {(['all', 'open', 'closed'] as TradeStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                  statusFilter === s ? 'bg-accent text-black' : 'text-text-tertiary hover:text-text-primary'
                }`}
              >
                {s}
                {s === 'open' && openCount ? ` (${openCount})` : ''}
                {s === 'closed' && closedCount ? ` (${closedCount})` : ''}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              placeholder="Filter by symbol"
              className="w-40 rounded-lg border border-border-primary bg-bg-input py-1.5 pl-8 pr-2 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </div>
          <span className="ml-auto text-[11px] text-text-tertiary">{filteredTrades.length} shown</span>
        </div>

        {filteredTrades.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-text-tertiary">No trades match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-border-primary text-[10px] uppercase tracking-wide text-text-tertiary">
                  <th className="px-4 py-2.5 text-left">Symbol</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Side</th>
                  <th className="px-4 py-2.5 text-right">Lots</th>
                  <th className="px-4 py-2.5 text-right">Open</th>
                  <th className="px-4 py-2.5 text-right">Exit / Current</th>
                  <th className="px-4 py-2.5 text-right">P&amp;L</th>
                  <th className="px-4 py-2.5 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((t) => (
                  <tr key={`${t.status}-${t.id}`} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
                    <td className="px-4 py-2.5 text-text-primary">{t.symbol || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          t.status === 'open' ? 'bg-warning/15 text-warning' : 'bg-text-tertiary/15 text-text-tertiary'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 uppercase text-text-secondary">{t.side}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{t.lots}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{t.open_price ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{t.exit_price ?? '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${t.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                      ${fmt(t.profit)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-tertiary">{fmtDate(t.when)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
