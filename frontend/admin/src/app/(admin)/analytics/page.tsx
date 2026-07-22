'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw, DollarSign, TrendingUp, TrendingDown, AlertTriangle, BarChart3, Users, CreditCard, Gift, GitBranch, Search, ChevronLeft, ChevronRight, ArrowUpDown, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import CommissionBreakdownModal from '@/components/analytics/CommissionBreakdownModal';

interface RevenueStats {
  total_revenue: number;
  spread_revenue: number;
  commission_revenue: number;
  swap_revenue: number;
  net_pnl: number;
}

interface ExposureRow {
  symbol: string;
  total_long: number;
  total_short: number;
  net_exposure: number;
  risk_level: 'low' | 'medium' | 'high';
}

interface ProfitableUser {
  user_id: string;
  user_name: string;
  pnl: number;
  trades_count: number;
  win_rate: number;
}

interface UserPnlRow {
  user_id: string;
  user_name: string;
  user_email: string | null;
  net_pnl: number;
  gross_profit: number;
  gross_loss: number;
  commission: number;
  swap: number;
  broker_fees: number;
  avg_per_trade: number;
  trades_count: number;
  wins: number;
  win_rate: number;
  last_closed_at: string | null;
}

interface UserPnlTotals {
  user_net_pnl: number;
  platform_pnl: number;
  commission: number;
  swap: number;
  broker_fees: number;
  trades_count: number;
  users_count: number;
}

interface UserPnlPage {
  items: UserPnlRow[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  period: PeriodKey;
  totals: UserPnlTotals;
}

type SortField = 'net_pnl' | 'gross_profit' | 'gross_loss' | 'trades_count' | 'last_closed_at';

type PeriodKey = 'today' | 'week' | 'month' | 'all';

const PERIOD_LABEL: Record<PeriodKey, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
};

function fmt(n: number) { return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function riskBadge(r: string) {
  return r === 'low' ? 'bg-success/15 text-success' : r === 'medium' ? 'bg-warning/15 text-warning' : 'bg-danger/15 text-danger';
}

function StatBox({ label, value, color, icon: Icon, onClick }: { label: string; value: string; color?: string; icon?: any; onClick?: () => void }) {
  const clickable = typeof onClick === 'function';
  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(); } } : undefined}
      className={cn(
        'bg-bg-secondary border border-border-primary rounded-md p-3',
        clickable && 'cursor-pointer hover:border-buy/50 hover:bg-bg-hover transition-fast focus:outline-none focus:ring-1 focus:ring-buy/50',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={12} className={color || 'text-text-tertiary'} />}
        <span className="text-xxs text-text-tertiary">{label}</span>
        {clickable && <span className="ml-auto text-xxs text-text-tertiary/70">View →</span>}
      </div>
      <p className={cn('text-lg font-semibold font-mono tabular-nums', color || 'text-text-primary')}>{value}</p>
    </div>
  );
}

function RevenueCard({ title, stats, active, onClick }: { title: string; stats: RevenueStats; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left w-full bg-bg-secondary border rounded-md p-4 transition-fast hover:border-buy/60 cursor-pointer',
        active ? 'border-buy ring-1 ring-buy/40' : 'border-border-primary',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xxs text-text-tertiary uppercase tracking-wide font-medium">{title}</h3>
        {active && <span className="text-xxs text-buy font-medium">● filtering</span>}
      </div>
      <p className="text-xl font-semibold text-text-primary font-mono tabular-nums mb-3">${fmt(stats.total_revenue)}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><p className="text-xxs text-text-tertiary">Commission</p><p className="text-text-primary font-mono">${fmt(stats.commission_revenue)}</p></div>
        <div><p className="text-xxs text-text-tertiary">Swap</p><p className="text-text-primary font-mono">${fmt(stats.swap_revenue)}</p></div>
        <div><p className="text-xxs text-text-tertiary">Spread</p><p className="text-text-primary font-mono">${fmt(stats.spread_revenue)}</p></div>
        <div><p className="text-xxs text-text-tertiary">Net P&L</p><p className={cn('font-mono font-medium', stats.net_pnl >= 0 ? 'text-success' : 'text-danger')}>{stats.net_pnl >= 0 ? '+' : ''}${fmt(stats.net_pnl)}</p></div>
      </div>
      <p className="text-xxs text-buy/80 mt-2">Click → {title} ke users ↓</p>
    </button>
  );
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return d; }
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [exposure, setExposure] = useState<ExposureRow[]>([]);
  const [profitableUsers, setProfitableUsers] = useState<ProfitableUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-user P&L breakdown — fully paginated + searchable + sortable.
  // Loaded independently of the overview so the page paints fast and
  // admins can drill the table without waiting for /analytics/dashboard
  // to refresh.
  const [pnlRows, setPnlRows] = useState<UserPnlRow[]>([]);
  const [pnlTotal, setPnlTotal] = useState(0);
  const [pnlPages, setPnlPages] = useState(1);
  const [pnlPage, setPnlPage] = useState(1);
  const [pnlSearch, setPnlSearch] = useState('');
  const [pnlSearchInput, setPnlSearchInput] = useState('');
  const [pnlSortBy, setPnlSortBy] = useState<SortField>('net_pnl');
  const [pnlSortDir, setPnlSortDir] = useState<'asc' | 'desc'>('desc');
  const [pnlLoading, setPnlLoading] = useState(false);
  // Active period filter for the per-user breakdown, driven by clicking
  // the Today / This Week / This Month / All Time cards above.
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [pnlTotals, setPnlTotals] = useState<UserPnlTotals | null>(null);
  const breakdownRef = useRef<HTMLDivElement>(null);

  const selectPeriod = (p: PeriodKey) => {
    setPeriod(p);
    setPnlPage(1);
    // Jump the admin straight to the filtered list.
    setTimeout(() => breakdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, expRes] = await Promise.all([
        adminApi.get<any>('/analytics/dashboard'),
        adminApi.get<{ exposure: ExposureRow[]; profitable_users?: ProfitableUser[] }>('/analytics/exposure'),
      ]);
      setData(dashRes);
      setExposure(expRes.exposure || []);
      setProfitableUsers(expRes.profitable_users || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPnl = useCallback(async () => {
    setPnlLoading(true);
    try {
      const res = await adminApi.get<UserPnlPage>('/analytics/user-pnl', {
        page: String(pnlPage),
        per_page: '50',
        sort_by: pnlSortBy,
        sort_dir: pnlSortDir,
        period,
        ...(pnlSearch ? { search: pnlSearch } : {}),
      });
      setPnlRows(res.items || []);
      setPnlTotal(res.total || 0);
      setPnlPages(res.pages || 1);
      setPnlTotals(res.totals || null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load per-user P&L');
      setPnlRows([]);
      setPnlTotals(null);
    } finally {
      setPnlLoading(false);
    }
  }, [pnlPage, pnlSortBy, pnlSortDir, pnlSearch, period]);

  // Toggle a column's sort direction: clicking the active column flips
  // dir, clicking a different column resets to desc.
  const toggleSort = (field: SortField) => {
    if (pnlSortBy === field) {
      setPnlSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setPnlSortBy(field);
      setPnlSortDir('desc');
    }
    setPnlPage(1);
  };

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchPnl(); }, [fetchPnl]);

  if (loading) return <><div className="flex items-center justify-center h-96"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div></>;

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Analytics</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">Complete platform revenue, IB, copy trading, and business analytics</p>
          </div>
          <button onClick={fetchData} className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast"><RefreshCw size={14} /></button>
        </div>

        {/* Revenue Cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <RevenueCard title="Today" stats={data.today} active={period === 'today'} onClick={() => selectPeriod('today')} />
            <RevenueCard title="This Week" stats={data.this_week} active={period === 'week'} onClick={() => selectPeriod('week')} />
            <RevenueCard title="This Month" stats={data.this_month} active={period === 'month'} onClick={() => selectPeriod('month')} />
            <RevenueCard title="All Time" stats={data.all_time} active={period === 'all'} onClick={() => selectPeriod('all')} />
          </div>
        )}

        {/* Platform Overview */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatBox label="Total Deposits" value={`$${fmt(data.total_deposits)}`} color="text-success" icon={DollarSign} />
            <StatBox label="Total Withdrawals" value={`$${fmt(data.total_withdrawals)}`} color="text-danger" icon={DollarSign} />
            <StatBox label="Net Deposits" value={`$${fmt(data.net_deposits)}`} color="text-buy" icon={TrendingUp} />
            <StatBox
              label="Admin Commission (Total)"
              value={`$${fmt(data.trading_commission_total ?? data.total_admin_commission ?? 0)}`}
              color="text-success"
              icon={DollarSign}
              onClick={() => setShowCommissionModal(true)}
            />
            <StatBox label="Open / Closed Trades" value={`${data.open_positions} / ${data.closed_trades}`} icon={BarChart3} />
          </div>
        )}

        {/* IB & Sub-Broker Section */}
        {data && (
          <>
            <div className="bg-bg-secondary border border-border-primary rounded-md">
              <div className="px-4 py-3 border-b border-border-primary">
                <h2 className="text-sm font-medium text-text-primary">IB & Sub-Broker Revenue</h2>
                <p className="text-xxs text-text-tertiary mt-0.5">Commission paid to IBs and sub-brokers from user trades</p>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatBox label="Active IBs" value={String(data.total_ibs || 0)} color="text-buy" icon={Users} />
                <StatBox label="Sub-Brokers" value={String(data.total_sub_brokers || 0)} color="text-buy" icon={GitBranch} />
                <StatBox label="Total IB Commission Paid" value={`$${fmt(data.total_ib_commission || 0)}`} color="text-warning" icon={DollarSign} />
                <StatBox label="IB Pending Payout" value={`$${fmt(data.ib_pending_commission || 0)}`} color="text-text-tertiary" icon={DollarSign} />
              </div>
            </div>
          </>
        )}

        {/* Copy Trading / PAMM Section */}
        {data && (
          <div className="bg-bg-secondary border border-border-primary rounded-md">
            <div className="px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-medium text-text-primary">MAMM Trading / PAMM</h2>
              <p className="text-xxs text-text-tertiary mt-0.5">Signal providers, managed accounts, and copy trade performance</p>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Active Masters" value={String(data.active_masters || 0)} color="text-buy" icon={Users} />
              <StatBox label="Total Followers" value={String(data.total_followers || 0)} icon={Users} />
              <StatBox label="Total AUM" value={`$${fmt(data.total_aum || 0)}`} color="text-success" icon={DollarSign} />
              <StatBox label="Copy Trades (Total)" value={String(data.total_copy_trades || 0)} icon={BarChart3} />
              <StatBox label="Active Copies" value={String(data.active_copies || 0)} color={data.active_copies > 0 ? 'text-buy' : undefined} icon={TrendingUp} />
              <StatBox label="Master Earnings" value={`$${fmt(data.master_earnings_total || 0)}`} color="text-warning" icon={DollarSign} />
              <StatBox label="PAMM Admin Commission" value={`$${fmt(data.pamm_admin_commission || 0)}`} color="text-success" icon={DollarSign} />
              <StatBox label="Copy Trade Admin Revenue" value={`$${fmt(data.copy_trade_revenue || 0)}`} color="text-success" icon={DollarSign} />
            </div>
          </div>
        )}

        {/* Bonus Section */}
        {data && (
          <div className="bg-bg-secondary border border-border-primary rounded-md">
            <div className="px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-medium text-text-primary">Bonus & Promotions</h2>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatBox label="Total Bonus Given" value={`$${fmt(data.total_bonus_given || 0)}`} color="text-warning" icon={Gift} />
              <StatBox label="Active Bonuses" value={String(data.active_bonuses || 0)} icon={CreditCard} />
            </div>
          </div>
        )}

        {/* Exposure Monitor */}
        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="px-4 py-3 border-b border-border-primary flex items-center gap-2">
            <AlertTriangle size={14} className="text-warning" />
            <h2 className="text-sm font-medium text-text-primary">Exposure Monitor</h2>
          </div>
          {exposure.length === 0 ? (
            <div className="text-center text-xs text-text-tertiary py-12">No open exposure</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border-primary bg-bg-tertiary/40">
                  {['Symbol', 'Long', 'Short', 'Net', 'Risk'].map(c => (
                    <th key={c} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase', ['Long', 'Short', 'Net'].includes(c) && 'text-right')}>{c}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {exposure.map(r => (
                    <tr key={r.symbol} className="border-b border-border-primary/50 hover:bg-bg-hover">
                      <td className="px-4 py-2 text-xs text-text-primary font-medium">{r.symbol}</td>
                      <td className="px-4 py-2 text-xs text-buy text-right font-mono">{r.total_long.toFixed(2)}</td>
                      <td className="px-4 py-2 text-xs text-sell text-right font-mono">{r.total_short.toFixed(2)}</td>
                      <td className={cn('px-4 py-2 text-xs text-right font-mono', r.net_exposure >= 0 ? 'text-buy' : 'text-sell')}>{r.net_exposure >= 0 ? '+' : ''}{r.net_exposure.toFixed(2)}</td>
                      <td className="px-4 py-2"><span className={cn('px-1.5 py-0.5 rounded-sm text-xxs font-medium uppercase', riskBadge(r.risk_level))}>{r.risk_level}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Profitable Users (Admin Losses) */}
        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="px-4 py-3 border-b border-border-primary">
            <h2 className="text-sm font-medium text-text-primary">Top Profitable Users</h2>
            <p className="text-xxs text-text-tertiary mt-0.5">Users with highest realized P&L (admin B-book losses)</p>
          </div>
          {profitableUsers.length === 0 ? (
            <div className="text-center text-xs text-text-tertiary py-12">No data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border-primary bg-bg-tertiary/40">
                  {['#', 'User', 'P&L', 'Trades', 'Win Rate'].map(c => (
                    <th key={c} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase', ['P&L', 'Win Rate'].includes(c) && 'text-right')}>{c}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {profitableUsers.map((u, i) => (
                    <tr key={u.user_id} className="border-b border-border-primary/50 hover:bg-bg-hover">
                      <td className="px-4 py-2 text-xs text-text-tertiary">{i + 1}</td>
                      <td className="px-4 py-2 text-xs text-text-primary">{u.user_name}</td>
                      <td className="px-4 py-2 text-xs text-danger text-right font-mono font-medium">-${fmt(u.pnl)}</td>
                      <td className="px-4 py-2 text-xs text-text-primary font-mono">{u.trades_count}</td>
                      <td className={cn('px-4 py-2 text-xs text-right font-mono', u.win_rate >= 50 ? 'text-success' : 'text-text-secondary')}>{u.win_rate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── PER-USER P&L BREAKDOWN ─── */}
        <div ref={breakdownRef} className="bg-bg-secondary border border-border-primary rounded-md scroll-mt-4">
          <div className="px-4 py-3 border-b border-border-primary flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-text-primary">
                Per-User P&amp;L Breakdown
                <span className="ml-2 text-xxs font-normal text-buy">· {PERIOD_LABEL[period]}</span>
              </h2>
              <p className="text-xxs text-text-tertiary mt-0.5">
                {period === 'all'
                  ? 'Every user with at least one closed trade. Click a row to open the full ledger.'
                  : `Users who closed a trade ${PERIOD_LABEL[period].toLowerCase()} — profit, loss & broker fees. Click a row for the full ledger.`}
              </p>
            </div>
            {/* Period segmented control — same source of truth as the cards above */}
            <div className="flex items-center gap-1 bg-bg-tertiary/40 border border-border-primary rounded-md p-0.5 self-start">
              {(['today', 'week', 'month', 'all'] as PeriodKey[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectPeriod(p)}
                  className={cn(
                    'px-2.5 py-1 text-xxs font-medium rounded transition-fast',
                    period === p ? 'bg-buy text-white' : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Period totals summary — across all matching users, not just this page */}
          {pnlTotals && (
            <div className="px-4 py-3 border-b border-border-primary grid grid-cols-2 md:grid-cols-5 gap-3 bg-bg-tertiary/20">
              <div><p className="text-xxs text-text-tertiary uppercase">Users</p><p className="text-sm font-mono text-text-primary">{pnlTotals.users_count}</p></div>
              <div><p className="text-xxs text-text-tertiary uppercase">Trades</p><p className="text-sm font-mono text-text-primary">{pnlTotals.trades_count}</p></div>
              <div><p className="text-xxs text-text-tertiary uppercase">Users' Net P&L</p><p className={cn('text-sm font-mono', pnlTotals.user_net_pnl >= 0 ? 'text-success' : 'text-danger')}>{pnlTotals.user_net_pnl >= 0 ? '+' : ''}${fmt(pnlTotals.user_net_pnl)}</p></div>
              <div><p className="text-xxs text-text-tertiary uppercase">Platform P&L</p><p className={cn('text-sm font-mono', pnlTotals.platform_pnl >= 0 ? 'text-success' : 'text-danger')}>{pnlTotals.platform_pnl >= 0 ? '+' : ''}${fmt(pnlTotals.platform_pnl)}</p></div>
              <div><p className="text-xxs text-text-tertiary uppercase">Broker Fees (Comm+Swap)</p><p className="text-sm font-mono text-success">${fmt(pnlTotals.broker_fees)}</p></div>
            </div>
          )}
          <div className="px-4 py-2.5 border-b border-border-primary flex items-center justify-end">
            <form
              onSubmit={(e) => { e.preventDefault(); setPnlSearch(pnlSearchInput.trim()); setPnlPage(1); }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  value={pnlSearchInput}
                  onChange={(e) => setPnlSearchInput(e.target.value)}
                  placeholder="Search email or name…"
                  className="text-xs pl-7 pr-2 py-1.5 bg-bg-input border border-border-primary rounded-md text-text-primary placeholder:text-text-tertiary focus:border-buy outline-none w-56"
                />
              </div>
              <button type="submit" className="px-3 py-1.5 text-xs font-medium bg-buy text-white rounded-md hover:bg-buy/80 transition-fast">Search</button>
              {pnlSearch && (
                <button
                  type="button"
                  onClick={() => { setPnlSearchInput(''); setPnlSearch(''); setPnlPage(1); }}
                  className="text-xxs text-text-tertiary hover:text-text-primary"
                >
                  Clear
                </button>
              )}
            </form>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border-primary bg-bg-tertiary/40">
                  <th className="text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase">User</th>
                  <SortHeader label="Trades" field="trades_count" active={pnlSortBy === 'trades_count'} dir={pnlSortDir} onClick={toggleSort} align="right" />
                  <th className="text-right px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase">Win Rate</th>
                  <SortHeader label="Gross Profit" field="gross_profit" active={pnlSortBy === 'gross_profit'} dir={pnlSortDir} onClick={toggleSort} align="right" />
                  <SortHeader label="Gross Loss" field="gross_loss" active={pnlSortBy === 'gross_loss'} dir={pnlSortDir} onClick={toggleSort} align="right" />
                  <th className="text-right px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase">Commission</th>
                  <th className="text-right px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase">Swap</th>
                  <SortHeader label="Net P&L" field="net_pnl" active={pnlSortBy === 'net_pnl'} dir={pnlSortDir} onClick={toggleSort} align="right" />
                  <th className="text-right px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase">Avg / Trade</th>
                  <SortHeader label="Last Trade" field="last_closed_at" active={pnlSortBy === 'last_closed_at'} dir={pnlSortDir} onClick={toggleSort} align="left" />
                  <th className="text-right px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {pnlLoading ? (
                  <tr><td colSpan={11} className="py-12 text-center"><Loader2 size={18} className="inline-block animate-spin text-text-tertiary" /></td></tr>
                ) : pnlRows.length === 0 ? (
                  <tr><td colSpan={11} className="py-12 text-center text-xs text-text-tertiary">No users found</td></tr>
                ) : (
                  pnlRows.map((u) => (
                    <tr
                      key={u.user_id}
                      onClick={() => router.push(`/users/${u.user_id}`)}
                      className="border-b border-border-primary/50 hover:bg-bg-hover cursor-pointer transition-fast"
                    >
                      <td className="px-4 py-2">
                        <p className="text-xs text-text-primary truncate">{u.user_name}</p>
                        {u.user_email && <p className="text-xxs text-text-tertiary truncate">{u.user_email}</p>}
                      </td>
                      <td className="px-4 py-2 text-xs text-text-primary text-right font-mono tabular-nums">{u.trades_count}</td>
                      <td className={cn('px-4 py-2 text-xs text-right font-mono tabular-nums', u.win_rate >= 50 ? 'text-success' : 'text-text-secondary')}>{u.win_rate.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-xs text-emerald-400 text-right font-mono tabular-nums">${fmt(u.gross_profit)}</td>
                      <td className="px-4 py-2 text-xs text-rose-400 text-right font-mono tabular-nums">${fmt(u.gross_loss)}</td>
                      <td className="px-4 py-2 text-xs text-text-secondary text-right font-mono tabular-nums">${fmt(u.commission)}</td>
                      <td className="px-4 py-2 text-xs text-text-secondary text-right font-mono tabular-nums">${fmt(u.swap)}</td>
                      <td className={cn('px-4 py-2 text-xs text-right font-mono tabular-nums font-semibold', u.net_pnl >= 0 ? 'text-success' : 'text-danger')}>
                        {u.net_pnl >= 0 ? '+' : ''}${fmt(u.net_pnl)}
                      </td>
                      <td className={cn('px-4 py-2 text-xs text-right font-mono tabular-nums', u.avg_per_trade >= 0 ? 'text-text-secondary' : 'text-danger')}>
                        {u.avg_per_trade >= 0 ? '+' : ''}${fmt(u.avg_per_trade)}
                      </td>
                      <td className="px-4 py-2 text-xxs text-text-tertiary font-mono whitespace-nowrap">{fmtDate(u.last_closed_at)}</td>
                      <td className="px-4 py-2 text-right">
                        <ExternalLink size={12} className="inline-block text-text-tertiary" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — same data, vertical layout */}
          <div className="md:hidden p-3 space-y-2">
            {pnlLoading ? (
              <div className="py-12 flex justify-center"><Loader2 size={18} className="animate-spin text-text-tertiary" /></div>
            ) : pnlRows.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-tertiary">No users found</div>
            ) : (
              pnlRows.map((u) => (
                <div
                  key={u.user_id}
                  onClick={() => router.push(`/users/${u.user_id}`)}
                  className="bg-bg-tertiary/40 border border-border-primary rounded-md p-3 active:scale-[0.99] transition-fast"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">{u.user_name}</p>
                      {u.user_email && <p className="text-xxs text-text-tertiary truncate">{u.user_email}</p>}
                    </div>
                    <span className={cn('shrink-0 px-2 py-1 rounded text-xs font-semibold font-mono', u.net_pnl >= 0 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>
                      {u.net_pnl >= 0 ? '+' : ''}${fmt(u.net_pnl)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xxs">
                    <div>
                      <p className="text-text-tertiary uppercase">Trades</p>
                      <p className="text-text-primary font-mono">{u.trades_count}</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary uppercase">Win %</p>
                      <p className="text-text-primary font-mono">{u.win_rate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary uppercase">Avg / Trade</p>
                      <p className={cn('font-mono', u.avg_per_trade >= 0 ? 'text-text-primary' : 'text-danger')}>${fmt(u.avg_per_trade)}</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary uppercase">Gross +</p>
                      <p className="text-emerald-400 font-mono">${fmt(u.gross_profit)}</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary uppercase">Gross -</p>
                      <p className="text-rose-400 font-mono">${fmt(u.gross_loss)}</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary uppercase">Commission</p>
                      <p className="text-text-secondary font-mono">${fmt(u.commission)}</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary uppercase">Swap</p>
                      <p className="text-text-secondary font-mono">${fmt(u.swap)}</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary uppercase">Last</p>
                      <p className="text-text-tertiary font-mono">{u.last_closed_at ? new Date(u.last_closed_at).toLocaleDateString() : '—'}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {pnlPages > 1 && (
            <div className="px-4 py-3 border-t border-border-primary flex items-center justify-between">
              <p className="text-xxs text-text-tertiary">
                {pnlTotal} user{pnlTotal === 1 ? '' : 's'} · Page {pnlPage} of {pnlPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pnlPage <= 1 || pnlLoading}
                  onClick={() => setPnlPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none transition-fast"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2 text-xs text-text-secondary font-mono tabular-nums">
                  {pnlPage} / {pnlPages}
                </span>
                <button
                  type="button"
                  disabled={pnlPage >= pnlPages || pnlLoading}
                  onClick={() => setPnlPage((p) => p + 1)}
                  className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none transition-fast"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Per-user business breakdown — deposits, brokerage, commission, net
            revenue per user (drill-down for "who brought how much"). */}
        <UserRevenueTable />
      </div>

      {showCommissionModal && (
        <CommissionBreakdownModal onClose={() => setShowCommissionModal(false)} />
      )}
    </>
  );
}

// Sortable column header for the per-user P&L table. Shows an
// arrow that flips between ↑ and ↓ when the field is the active
// sort column.
function SortHeader({
  label, field, active, dir, onClick, align,
}: {
  label: string;
  field: SortField;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: (f: SortField) => void;
  align: 'left' | 'right';
}) {
  return (
    <th className={cn('px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase select-none', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={() => onClick(field)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-text-primary transition-fast',
          align === 'right' && 'ml-auto',
          active && 'text-buy',
        )}
      >
        {label}
        {active ? (dir === 'desc' ? '↓' : '↑') : <ArrowUpDown size={10} className="opacity-50" />}
      </button>
    </th>
  );
}


interface RevenueRow {
  user_id: string;
  name: string | null;
  email: string | null;
  total_deposit: number;
  total_withdrawal: number;
  net_deposit: number;
  lots_traded: number;
  realized_pnl: number;
  trades_count: number;
  gross_brokerage: number;
  ib_commission: number;
  net_revenue: number;
}

/** Per-user business breakdown drill-down (deposits / brokerage / commission /
 *  net revenue). Self-contained: own fetch + search + sort + pagination. */
function UserRevenueTable() {
  const router = useRouter();
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('net_revenue');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const perPage = 25;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ items: RevenueRow[]; total: number }>('/analytics/user-revenue', {
        page: String(page), per_page: String(perPage), sort, order,
        ...(search ? { search } : {}),
      });
      setRows(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load user revenue');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, sort, order, search]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleSort = (f: string) => {
    if (sort === f) setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    else { setSort(f); setOrder('desc'); }
    setPage(1);
  };
  const pages = Math.max(1, Math.ceil(total / perPage));
  const money = (n: number, signed = false) => `${signed && n >= 0 ? '+' : ''}$${fmt(n)}`;

  const Th = ({ label, field }: { label: string; field: string }) => (
    <th className="px-3 py-2.5 text-xxs font-medium text-text-tertiary uppercase select-none text-right">
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={cn('inline-flex items-center gap-1 ml-auto hover:text-text-primary transition-fast', sort === field && 'text-buy')}
      >
        {label}
        {sort === field ? (order === 'desc' ? '↓' : '↑') : <ArrowUpDown size={10} className="opacity-50" />}
      </button>
    </th>
  );

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md">
      <div className="px-4 py-3 border-b border-border-primary flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Revenue by user</h3>
          <p className="text-xxs text-text-tertiary">Per-user deposits, brokerage, IB commission and net revenue — click a row for the full ledger</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or email…"
            className="text-xs py-1.5 pl-8 pr-2 w-60 bg-bg-input border border-border-primary rounded-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="px-3 py-2.5 text-left text-xxs font-medium text-text-tertiary uppercase">User</th>
              <Th label="Deposits" field="total_deposit" />
              <Th label="Withdrawals" field="total_withdrawal" />
              <Th label="Net Dep" field="net_deposit" />
              <Th label="Brokerage" field="gross_brokerage" />
              <Th label="IB Comm" field="ib_commission" />
              <Th label="Net Revenue" field="net_revenue" />
              <Th label="Lots" field="lots_traded" />
              <Th label="Realized P&L" field="realized_pnl" />
              <Th label="Trades" field="trades_count" />
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-text-tertiary"><Loader2 size={16} className="inline animate-spin mr-2" />Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-text-tertiary">No users</td></tr>
            ) : rows.map((r) => (
              <tr
                key={r.user_id}
                onClick={() => router.push(`/users/${r.user_id}`)}
                className="border-b border-border-primary/50 hover:bg-bg-hover/50 cursor-pointer transition-fast"
              >
                <td className="px-3 py-2.5">
                  <div className="text-text-primary font-medium truncate max-w-[180px]">{r.name || r.email || '—'}</div>
                  {r.name && <div className="text-xxs text-text-tertiary truncate max-w-[180px]">{r.email}</div>}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-success">${fmt(r.total_deposit)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-danger">${fmt(r.total_withdrawal)}</td>
                <td className={cn('px-3 py-2.5 text-right font-mono tabular-nums', r.net_deposit >= 0 ? 'text-text-primary' : 'text-danger')}>{money(r.net_deposit, true)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-primary">${fmt(r.gross_brokerage)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-warning">${fmt(r.ib_commission)}</td>
                <td className={cn('px-3 py-2.5 text-right font-mono tabular-nums font-semibold', r.net_revenue >= 0 ? 'text-success' : 'text-danger')}>{money(r.net_revenue, true)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-secondary">{fmt(r.lots_traded)}</td>
                <td className={cn('px-3 py-2.5 text-right font-mono tabular-nums', r.realized_pnl >= 0 ? 'text-success' : 'text-danger')}>{money(r.realized_pnl, true)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-secondary">{r.trades_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="px-4 py-3 border-t border-border-primary flex items-center justify-between">
          <p className="text-xxs text-text-tertiary">{total} user{total === 1 ? '' : 's'} · Page {page} of {pages}</p>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none transition-fast"><ChevronLeft size={14} /></button>
            <span className="px-2 text-xs text-text-secondary font-mono tabular-nums">{page} / {pages}</span>
            <button type="button" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none transition-fast"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
