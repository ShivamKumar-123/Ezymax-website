'use client';

/** Analytics tab — everything the user has done on the platform: balances,
 *  P&L, trades, charges (commission + swap), deposits and withdrawals. All
 *  from existing endpoints; nothing is mocked. */
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api/client';
import Pagination, { usePagination } from '@/components/ui/Pagination';

interface Summary { total_balance?: number; total_equity?: number; total_unrealized_pnl?: number; open_positions_count?: number }
interface Perf {
  equity_curve?: Array<{ date: string; equity: number }>;
  stats?: Record<string, number | null | undefined>;
  monthly_breakdown?: Array<{ month: string; pnl: number }>;
  symbol_breakdown?: Array<{ symbol: string; pnl: number; trades: number }>;
}
interface Trade { id: string; symbol: string; side: string; lots: number; pnl: number; commission?: number; swap?: number; close_time?: string; closed_at?: string; open_time?: string; entry_price?: number; exit_price?: number }
interface Txn { id?: string; type?: string; kind?: string; amount?: number; status?: string; created_at?: string; method?: string; currency?: string }

const usd = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);
const asList = <T,>(d: unknown): T[] => {
  if (Array.isArray(d)) return d as T[];
  const o = d as Record<string, unknown> | null;
  for (const k of ['items', 'trades', 'transactions', 'deposits', 'withdrawals', 'results']) {
    if (o && Array.isArray(o[k])) return o[k] as T[];
  }
  return [];
};

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card-nested)' }}>
      <p className="text-[11px] uppercase tracking-wide font-medium text-text-tertiary">{label}</p>
      <p className={clsx('mt-1 text-xl font-semibold tabular-nums', tone === 'up' ? 'text-emerald-500' : tone === 'down' ? 'text-red-500' : 'text-text-primary')}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-text-tertiary">{hint}</p>}
    </div>
  );
}

function EquityCurve({ points }: { points: Array<{ date: string; equity: number }> }) {
  if (points.length < 2) return <p className="py-10 text-center text-xs text-text-tertiary">Not enough history for a curve yet.</p>;
  const W = 600, H = 140, P = 6;
  const vals = points.map((p) => p.equity);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts = points.map((p, i) => `${P + (i / (points.length - 1)) * (W - P * 2)},${P + (1 - (p.equity - min) / span) * (H - P * 2)}`).join(' ');
  const up = vals[vals.length - 1]! >= vals[0]!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? 'var(--crx-yellow)' : 'var(--text-tertiary)'} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

export default function AnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [perf, setPerf] = useState<Perf | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [deposits, setDeposits] = useState<Txn[]>([]);
  const [withdrawals, setWithdrawals] = useState<Txn[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, p, t, d, w] = await Promise.all([
        api.get<Summary>('/portfolio/summary').catch(() => null),
        api.get<Perf>('/portfolio/performance').catch(() => null),
        api.get<unknown>('/portfolio/trades').catch(() => []),
        api.get<unknown>('/wallet/deposits').catch(() => []),
        api.get<unknown>('/wallet/withdrawals').catch(() => []),
      ]);
      if (cancelled) return;
      setSummary(s); setPerf(p);
      setTrades(asList<Trade>(t)); setDeposits(asList<Txn>(d)); setWithdrawals(asList<Txn>(w));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(() => {
    const closed = trades.filter((t) => Number.isFinite(Number(t.pnl)));
    const net = closed.reduce((a, t) => a + Number(t.pnl || 0), 0);
    const wins = closed.filter((t) => Number(t.pnl) > 0).length;
    const charges = closed.reduce((a, t) => a + Math.abs(Number(t.commission || 0)) + Math.abs(Number(t.swap || 0)), 0);
    const dep = deposits.filter((x) => (x.status || 'completed').toLowerCase().includes('complet') || (x.status || '').toLowerCase() === 'approved').reduce((a, x) => a + Number(x.amount || 0), 0);
    const wd = withdrawals.filter((x) => (x.status || 'completed').toLowerCase().includes('complet') || (x.status || '').toLowerCase() === 'approved').reduce((a, x) => a + Number(x.amount || 0), 0);
    return { net, count: closed.length, winRate: closed.length ? (wins / closed.length) * 100 : 0, charges, dep, wd };
  }, [trades, deposits, withdrawals]);


  const recent = [...trades].sort((a, b) => Date.parse(b.close_time || b.closed_at || '') - Date.parse(a.close_time || a.closed_at || ''));
  const txns: Array<Txn & { kind: string }> = [
    ...deposits.map((x) => ({ ...x, kind: 'Deposit' })),
    ...withdrawals.map((x) => ({ ...x, kind: 'Withdrawal' })),
  ].sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));

  const tradePager = usePagination(recent, 10);
  const txnPager = usePagination(txns, 10);

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-tertiary"><Loader2 size={16} className="animate-spin" /> Loading analytics…</div>;
  }

  return (
    <div className="p-5 sm:p-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Total balance" value={usd(summary?.total_balance)} hint={`Equity ${usd(summary?.total_equity)}`} />
        <Tile label="Net P&L (closed)" value={`${totals.net >= 0 ? '+' : ''}${usd(totals.net)}`} tone={totals.net >= 0 ? 'up' : 'down'} hint={`${totals.count} trades · ${totals.winRate.toFixed(0)}% win rate`} />
        <Tile label="Charges paid" value={usd(totals.charges)} hint="Commission + swap on closed trades" />
        <Tile label="Deposits / withdrawals" value={usd(totals.dep)} hint={`Withdrawn ${usd(totals.wd)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card-nested)' }}>
          <p className="text-sm font-semibold text-text-primary">Equity curve</p>
          <EquityCurve points={perf?.equity_curve ?? []} />
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card-nested)' }}>
          <p className="text-sm font-semibold text-text-primary">By instrument</p>
          <ul className="mt-2 divide-y divide-border-secondary">
            {(perf?.symbol_breakdown ?? []).slice(0, 6).map((s) => (
              <li key={s.symbol} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono font-semibold text-text-primary">{s.symbol}</span>
                <span className="text-xs text-text-tertiary">{s.trades} trades</span>
                <span className={clsx('tabular-nums font-medium', s.pnl >= 0 ? 'text-emerald-500' : 'text-red-500')}>{s.pnl >= 0 ? '+' : ''}{usd(s.pnl)}</span>
              </li>
            ))}
            {(perf?.symbol_breakdown ?? []).length === 0 && <li className="py-6 text-center text-xs text-text-tertiary">No closed trades yet.</li>}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl p-4 overflow-x-auto" style={{ background: 'var(--bg-card-nested)' }}>
          <p className="text-sm font-semibold text-text-primary">Recent trades</p>
          <table className="mt-2 w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-text-tertiary">
              <tr><th className="py-1.5 text-left">Symbol</th><th className="text-left">Side</th><th className="text-right">Lots</th><th className="text-right">Charges</th><th className="text-right">P&L</th></tr>
            </thead>
            <tbody className="divide-y divide-border-secondary">
              {tradePager.items.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 font-mono font-semibold text-text-primary">{t.symbol}</td>
                  <td className={clsx('capitalize', t.side?.toLowerCase() === 'buy' ? 'text-buy' : 'text-sell')}>{t.side}</td>
                  <td className="text-right tabular-nums text-text-secondary">{Number(t.lots).toFixed(2)}</td>
                  <td className="text-right tabular-nums text-text-secondary">{usd(Math.abs(Number(t.commission || 0)) + Math.abs(Number(t.swap || 0)))}</td>
                  <td className={clsx('text-right tabular-nums font-medium', Number(t.pnl) >= 0 ? 'text-emerald-500' : 'text-red-500')}>{Number(t.pnl) >= 0 ? '+' : ''}{usd(t.pnl)}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-text-tertiary">No trades yet.</td></tr>}
            </tbody>
          </table>
          <Pagination {...tradePager.props} itemLabel="trades" />
        </div>
        <div className="rounded-2xl p-4 overflow-x-auto" style={{ background: 'var(--bg-card-nested)' }}>
          <p className="text-sm font-semibold text-text-primary">Transactions</p>
          <table className="mt-2 w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-text-tertiary">
              <tr><th className="py-1.5 text-left">Type</th><th className="text-left">Method</th><th className="text-left">Status</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-border-secondary">
              {txnPager.items.map((x, i) => (
                <tr key={x.id ?? i}>
                  <td className="py-2 font-semibold text-text-primary">{x.kind}</td>
                  <td className="text-text-secondary capitalize">{x.method || x.type || '—'}</td>
                  <td className="text-text-secondary capitalize">{x.status || '—'}</td>
                  <td className="text-right tabular-nums font-medium text-text-primary">{usd(x.amount)}</td>
                </tr>
              ))}
              {txns.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-text-tertiary">No deposits or withdrawals yet.</td></tr>}
            </tbody>
          </table>
          <Pagination {...txnPager.props} itemLabel="transactions" />
        </div>
      </div>
    </div>
  );
}
