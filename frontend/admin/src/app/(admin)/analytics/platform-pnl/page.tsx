'use client';

// Platform P&L deep-dive. Admin lands here from the Dashboard's
// "Platform P&L" card (now clickable) or from the Analytics page.
// Shows everything that contributes to the broker's net position in
// B-book: the user-trade-mirror leg, the brokerage commission leg,
// the swap leg, plus the users who individually moved the needle.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Loader2, RefreshCw, TrendingUp, TrendingDown,
  DollarSign, BarChart3, Users, ExternalLink, Activity,
} from 'lucide-react';

interface PeriodStats {
  total_revenue: number;        // commission + swap (broker side income)
  commission_revenue: number;   // brokerage on positions
  swap_revenue: number;         // overnight fees collected
  spread_revenue: number;       // 0 — placeholder, not retroactively computable
  net_pnl: number;              // mirror of user trade P&L (negated)
}

interface UserImpact {
  user_id: string;
  user_name: string;
  user_email: string | null;
  user_pnl: number;
  platform_impact: number;
  trades_count: number;
}

interface BigTrade {
  trade_id: string;
  user_id: string | null;
  user_name: string;
  user_email: string | null;
  symbol: string | null;
  side: string;
  lots: number;
  user_pnl: number;
  platform_impact: number;
  close_reason: string;
  closed_at: string | null;
}

interface PlatformPnlPayload {
  periods: {
    today: PeriodStats;
    this_week: PeriodStats;
    this_month: PeriodStats;
    all_time: PeriodStats;
  };
  top_costs: UserImpact[];
  top_earnings: UserImpact[];
  big_trades: BigTrade[];
}

function fmt(n: number) {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return d; }
}

// Platform P&L for a period = side income (commission + swap) +
// trade mirror (already negated for broker in _revenue_stats).
function platformPnl(p: PeriodStats): number {
  return (p.commission_revenue || 0) + (p.swap_revenue || 0) + (p.net_pnl || 0);
}

export default function PlatformPnlPage() {
  const router = useRouter();
  const [data, setData] = useState<PlatformPnlPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<PlatformPnlPayload>('/analytics/platform-pnl');
      setData(res);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load Platform P&L detail');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  const all = data.periods.all_time;
  const allTotal = platformPnl(all);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-fast mb-2">
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-lg font-semibold text-text-primary">Platform P&L — Full Breakdown</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            B-book mirror of user trade P&L + brokerage commissions + swap income.
            Positive = broker is winning, negative = broker is losing.
          </p>
        </div>
        <button onClick={fetchData} className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Big number — All-Time Platform P&L */}
      <div
        className="rounded-2xl p-5 border"
        style={{
          background: allTotal >= 0 ? 'var(--card-green-bg)' : 'var(--card-red-bg)',
          borderColor: allTotal >= 0 ? 'var(--card-green-border)' : 'var(--card-red-border)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xxs uppercase tracking-wide font-medium" style={{ color: allTotal >= 0 ? 'var(--card-green-text-muted)' : 'var(--card-red-text-muted)' }}>
              All-Time Net Platform P&L
            </p>
            <p className="text-3xl font-bold font-mono tabular-nums mt-1" style={{ color: allTotal >= 0 ? 'var(--card-green-icon)' : 'var(--card-red-icon)' }}>
              {allTotal >= 0 ? '+' : ''}${fmt(allTotal)}
            </p>
            <p className="text-xs mt-1" style={{ color: allTotal >= 0 ? 'var(--card-green-text-faint)' : 'var(--card-red-text-faint)' }}>
              Trade mirror: {all.net_pnl >= 0 ? '+' : ''}${fmt(all.net_pnl)} ·
              Brokerage: +${fmt(all.commission_revenue)} ·
              Swap: +${fmt(all.swap_revenue)}
            </p>
          </div>
          {allTotal >= 0 ? <TrendingUp size={36} style={{ color: 'var(--card-green-icon)' }} /> : <TrendingDown size={36} style={{ color: 'var(--card-red-icon)' }} />}
        </div>
      </div>

      {/* Per-period breakdown */}
      <div>
        <h2 className="text-sm font-medium text-text-primary mb-2">By Period</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <PeriodCard title="Today" stats={data.periods.today} />
          <PeriodCard title="This Week" stats={data.periods.this_week} />
          <PeriodCard title="This Month" stats={data.periods.this_month} />
          <PeriodCard title="All Time" stats={data.periods.all_time} />
        </div>
      </div>

      {/* Two side-by-side impact tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Users costing the platform (broker losses) */}
        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="px-4 py-3 border-b border-border-primary">
            <h2 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <TrendingDown size={14} className="text-danger" />
              Top 10 — Costing the Platform
            </h2>
            <p className="text-xxs text-text-tertiary mt-0.5">
              Users with the largest realized profits → biggest broker losses (B-book mirror).
            </p>
          </div>
          <ImpactTable rows={data.top_costs} negative onRowClick={(uid) => router.push(`/users/${uid}`)} />
        </div>

        {/* Users earning the platform (broker wins) */}
        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="px-4 py-3 border-b border-border-primary">
            <h2 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <TrendingUp size={14} className="text-success" />
              Top 10 — Earning the Platform
            </h2>
            <p className="text-xxs text-text-tertiary mt-0.5">
              Users with the largest realized losses → biggest broker gains (B-book mirror).
            </p>
          </div>
          <ImpactTable rows={data.top_earnings} negative={false} onRowClick={(uid) => router.push(`/users/${uid}`)} />
        </div>
      </div>

      {/* Recent big trades */}
      <div className="bg-bg-secondary border border-border-primary rounded-md">
        <div className="px-4 py-3 border-b border-border-primary">
          <h2 className="text-sm font-medium text-text-primary flex items-center gap-2">
            <Activity size={14} className="text-buy" />
            Recent Big Trades (last 30 days)
          </h2>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Top 30 trades sorted by absolute platform impact. Click a row to open that user's full ledger.
          </p>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border-primary bg-bg-tertiary/40">
                {['Closed', 'User', 'Symbol', 'Side', 'Lots', 'User P&L', 'Platform Impact', 'Reason'].map((h, i) => (
                  <th key={h} className={cn('px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase', [4, 5, 6].includes(i) ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.big_trades.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-xs text-text-tertiary">No big trades in the last 30 days</td></tr>
              ) : data.big_trades.map((t) => (
                <tr
                  key={t.trade_id}
                  onClick={() => t.user_id && router.push(`/users/${t.user_id}`)}
                  className="border-b border-border-primary/50 hover:bg-bg-hover cursor-pointer transition-fast"
                >
                  <td className="px-4 py-2 text-xxs text-text-tertiary font-mono">{formatDate(t.closed_at)}</td>
                  <td className="px-4 py-2">
                    <p className="text-xs text-text-primary truncate">{t.user_name}</p>
                    {t.user_email && <p className="text-xxs text-text-tertiary truncate">{t.user_email}</p>}
                  </td>
                  <td className="px-4 py-2 text-xs text-text-primary font-medium">{t.symbol || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={cn('text-xs font-bold', t.side?.toLowerCase() === 'buy' ? 'text-buy' : 'text-sell')}>
                      {t.side?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-right font-mono tabular-nums">{t.lots}</td>
                  <td className={cn('px-4 py-2 text-xs text-right font-mono tabular-nums font-semibold', t.user_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                    {t.user_pnl >= 0 ? '+' : ''}${fmt(t.user_pnl)}
                  </td>
                  <td className={cn('px-4 py-2 text-xs text-right font-mono tabular-nums font-semibold', t.platform_impact >= 0 ? 'text-success' : 'text-danger')}>
                    {t.platform_impact >= 0 ? '+' : ''}${fmt(t.platform_impact)}
                  </td>
                  <td className="px-4 py-2 text-xxs capitalize text-text-tertiary">{t.close_reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-3 space-y-2">
          {data.big_trades.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-tertiary">No big trades in the last 30 days</div>
          ) : data.big_trades.map((t) => (
            <div
              key={t.trade_id}
              onClick={() => t.user_id && router.push(`/users/${t.user_id}`)}
              className="bg-bg-tertiary/40 border border-border-primary rounded-md p-3 active:scale-[0.99] transition-fast"
            >
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{t.user_name}</p>
                  <p className="text-xxs text-text-tertiary truncate">{t.symbol} · <span className={cn('font-bold', t.side?.toLowerCase() === 'buy' ? 'text-buy' : 'text-sell')}>{t.side?.toUpperCase()}</span> · {t.lots} lots</p>
                </div>
                <span className={cn('shrink-0 px-2 py-1 rounded text-xs font-semibold font-mono', t.platform_impact >= 0 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>
                  {t.platform_impact >= 0 ? '+' : ''}${fmt(t.platform_impact)}
                </span>
              </div>
              <div className="flex justify-between text-xxs text-text-tertiary">
                <span>User P&L: <span className={cn('font-mono', t.user_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{t.user_pnl >= 0 ? '+' : ''}${fmt(t.user_pnl)}</span></span>
                <span className="capitalize">{t.close_reason}</span>
              </div>
              <p className="text-xxs text-text-tertiary mt-1">{formatDate(t.closed_at)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PeriodCard({ title, stats }: { title: string; stats: PeriodStats }) {
  const total = platformPnl(stats);
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md p-4">
      <p className="text-xxs text-text-tertiary uppercase tracking-wide font-medium mb-1">{title}</p>
      <p className={cn('text-xl font-bold font-mono tabular-nums mb-3', total >= 0 ? 'text-success' : 'text-danger')}>
        {total >= 0 ? '+' : ''}${fmt(total)}
      </p>
      <div className="space-y-1.5 text-xs">
        <Line label="Trade mirror" value={stats.net_pnl} highlightSign />
        <Line label="Brokerage" value={stats.commission_revenue} positive />
        <Line label="Swap" value={stats.swap_revenue} positive />
      </div>
    </div>
  );
}

function Line({ label, value, positive, highlightSign }: { label: string; value: number; positive?: boolean; highlightSign?: boolean }) {
  const isNeg = value < 0;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-text-tertiary">{label}</span>
      <span className={cn(
        'font-mono tabular-nums',
        positive ? 'text-success' : highlightSign ? (isNeg ? 'text-danger' : 'text-success') : 'text-text-primary',
      )}>
        {value >= 0 ? '+' : ''}${fmt(value)}
      </span>
    </div>
  );
}

function ImpactTable({
  rows, negative, onRowClick,
}: {
  rows: UserImpact[];
  negative: boolean;  // true if these rows REDUCE platform P&L
  onRowClick: (uid: string) => void;
}) {
  if (rows.length === 0) {
    return <div className="text-center py-12 text-xs text-text-tertiary">No users in this segment</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-primary bg-bg-tertiary/40">
            {['#', 'User', 'Trades', 'User P&L', 'Platform Impact', ''].map((h, i) => (
              <th key={h || i} className={cn('px-3 py-2 text-xxs font-medium text-text-tertiary uppercase', [2, 3, 4].includes(i) ? 'text-right' : 'text-left')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((u, i) => (
            <tr key={u.user_id} onClick={() => onRowClick(u.user_id)} className="border-b border-border-primary/50 hover:bg-bg-hover cursor-pointer transition-fast">
              <td className="px-3 py-2 text-xs text-text-tertiary">{i + 1}</td>
              <td className="px-3 py-2">
                <p className="text-xs text-text-primary truncate">{u.user_name}</p>
                {u.user_email && <p className="text-xxs text-text-tertiary truncate">{u.user_email}</p>}
              </td>
              <td className="px-3 py-2 text-xs text-right font-mono tabular-nums">{u.trades_count}</td>
              <td className={cn('px-3 py-2 text-xs text-right font-mono tabular-nums', u.user_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {u.user_pnl >= 0 ? '+' : ''}${fmt(u.user_pnl)}
              </td>
              <td className={cn('px-3 py-2 text-xs text-right font-mono tabular-nums font-semibold', negative ? 'text-danger' : 'text-success')}>
                {negative ? '-' : '+'}${fmt(Math.abs(u.platform_impact))}
              </td>
              <td className="px-3 py-2 text-right">
                <ExternalLink size={11} className="inline text-text-tertiary" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
