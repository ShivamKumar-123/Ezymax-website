'use client';

/**
 * RMS — Risk Dashboard (Module 1).
 *
 * Executive summary of the brokerage's live risk & financial health:
 * accounts/traders, floating P/L, daily revenue & flows, platform-wide
 * margin aggregates, risk events, and A/B-book exposure. Read-only; polls
 * every 5s (configurable per the RMS spec). Backed by
 * GET /rms-dashboard/overview (rms.view).
 */
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import {
  Activity, Users, LayoutList, Layers, TrendingUp, TrendingDown,
  DollarSign, ArrowDownToLine, ArrowUpFromLine, Gauge, Wallet,
  ShieldAlert, AlertTriangle, Ban, Scale, RefreshCw, Loader2,
} from 'lucide-react';

interface ExposureRow {
  symbol: string;
  total_long: number;
  total_short: number;
  net_exposure: number;
  risk_level: 'low' | 'medium' | 'high';
}
interface Overview {
  active_accounts: number;
  online_traders: number;
  total_open_positions: number;
  total_open_lots: number;
  total_floating_pnl: number;
  broker_net_floating_pnl: number;
  daily_brokerage_revenue: number;
  daily_spread_revenue: number;
  daily_swap_revenue: number;
  daily_commission_revenue: number;
  daily_deposits: number;
  daily_withdrawals: number;
  total_margin_used: number;
  total_free_margin: number;
  total_equity: number;
  margin_level_pct: number | null;
  accounts_at_risk: number;
  margin_calls: number;
  stop_outs: number;
  net_exposure: number;
  a_book_exposure: number;
  b_book_exposure: number;
  stop_out_level: number;
  margin_call_level: number;
  exposure: ExposureRow[];
  generated_at: string;
}

const POLL_MS = 5000;

const num = (n: number | null | undefined, d = 2) =>
  (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (n: number | null | undefined, d = 2) => `$${num(n, d)}`;
const pnl = (n: number | null | undefined) => `${(n ?? 0) >= 0 ? '+' : ''}${usd(n)}`;
const pnlColor = (n: number | null | undefined) => ((n ?? 0) >= 0 ? 'text-success' : 'text-sell');

function Card({
  label, value, icon: Icon, tone = 'default', hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: any;
  tone?: 'default' | 'good' | 'bad' | 'warn' | 'info';
  hint?: string;
}) {
  const valColor =
    tone === 'good' ? 'text-success'
    : tone === 'bad' ? 'text-sell'
    : tone === 'warn' ? 'text-warning'
    : tone === 'info' ? 'text-buy'
    : 'text-text-primary';
  const iconTint =
    tone === 'good' ? 'text-success bg-success/10'
    : tone === 'bad' ? 'text-sell bg-sell/10'
    : tone === 'warn' ? 'text-warning bg-warning/10'
    : tone === 'info' ? 'text-buy bg-buy/10'
    : 'text-text-tertiary bg-bg-hover';
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md p-4">
      <div className="flex items-start gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconTint)}>
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <p className="text-xxs uppercase tracking-wide text-text-tertiary font-medium">{label}</p>
          <p className={cn('text-xl font-semibold mt-1 tabular-nums truncate', valColor)}>{value}</p>
          {hint && <p className="text-xxs text-text-tertiary mt-0.5">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xxs uppercase tracking-wider text-text-tertiary font-semibold px-0.5">{children}</p>;
}

export default function RmsDashboardPage() {
  const [d, setD] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    try {
      setD(await adminApi.get<Overview>('/rms-dashboard/overview'));
      setErr(false);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const marginTone = (() => {
    if (!d?.margin_level_pct) return 'default' as const;
    if (d.margin_level_pct <= d.stop_out_level) return 'bad' as const;
    if (d.margin_level_pct <= d.margin_call_level) return 'warn' as const;
    return 'good' as const;
  })();

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Gauge size={18} className="text-buy" />
            Risk Dashboard
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Live executive summary of exposure, margin, revenue & risk — refreshes every 5s
            {d && <span className="ml-2">· updated {new Date(d.generated_at).toLocaleTimeString()}</span>}
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-bg-hover border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-fast"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading && !d ? (
        <div className="flex items-center justify-center py-20 text-text-tertiary gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading risk data…
        </div>
      ) : err && !d ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-md bg-sell/10 border border-sell/30 text-sell text-sm">
          <AlertTriangle size={15} /> Couldn't load risk data. Retrying…
        </div>
      ) : d ? (
        <>
          {/* Activity */}
          <SectionLabel>Activity</SectionLabel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card label="Active Accounts" value={num(d.active_accounts, 0)} icon={Activity} />
            <Card label="Online Traders" value={num(d.online_traders, 0)} icon={Users} hint="with an open position" />
            <Card label="Open Positions" value={num(d.total_open_positions, 0)} icon={LayoutList} />
            <Card label="Open Lots" value={num(d.total_open_lots)} icon={Layers} />
          </div>

          {/* Floating P/L */}
          <SectionLabel>Floating P/L</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Card
              label="Total Floating Client P/L" value={pnl(d.total_floating_pnl)}
              icon={d.total_floating_pnl >= 0 ? TrendingUp : TrendingDown}
              tone={d.total_floating_pnl >= 0 ? 'good' : 'bad'}
            />
            <Card
              label="Broker Net Floating P/L" value={pnl(d.broker_net_floating_pnl)}
              icon={d.broker_net_floating_pnl >= 0 ? TrendingUp : TrendingDown}
              tone={d.broker_net_floating_pnl >= 0 ? 'good' : 'bad'}
              hint="B-book counter-position"
            />
          </div>

          {/* Daily revenue */}
          <SectionLabel>Daily Revenue</SectionLabel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card label="Brokerage Revenue" value={usd(d.daily_brokerage_revenue)} icon={DollarSign} tone="good" />
            <Card label="Spread Revenue" value={usd(d.daily_spread_revenue)} icon={DollarSign} hint="baked into fills" />
            <Card label="Swap Revenue" value={usd(d.daily_swap_revenue)} icon={DollarSign} />
            <Card label="Commission Revenue" value={usd(d.daily_commission_revenue)} icon={DollarSign} />
          </div>

          {/* Daily flows */}
          <SectionLabel>Daily Flows</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Card label="Deposits (today)" value={usd(d.daily_deposits)} icon={ArrowDownToLine} tone="good" />
            <Card label="Withdrawals (today)" value={usd(d.daily_withdrawals)} icon={ArrowUpFromLine} tone="warn" />
          </div>

          {/* Margin (live) */}
          <SectionLabel>Margin (platform-wide, live)</SectionLabel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card label="Equity" value={usd(d.total_equity)} icon={Wallet} />
            <Card label="Margin Used" value={usd(d.total_margin_used)} icon={Gauge} />
            <Card label="Free Margin" value={usd(d.total_free_margin)} icon={Wallet} />
            <Card
              label="Margin Level" value={d.margin_level_pct == null ? '—' : `${num(d.margin_level_pct, 1)}%`}
              icon={Gauge} tone={marginTone}
            />
          </div>

          {/* Risk events */}
          <SectionLabel>Risk Events</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <Card label="Accounts at Risk" value={num(d.accounts_at_risk, 0)} icon={ShieldAlert} tone={d.accounts_at_risk > 0 ? 'warn' : 'default'} hint="≤ margin-call level" />
            <Card label="Margin Calls" value={num(d.margin_calls, 0)} icon={AlertTriangle} tone={d.margin_calls > 0 ? 'warn' : 'default'} />
            <Card label="Stop-Outs (today)" value={num(d.stop_outs, 0)} icon={Ban} tone={d.stop_outs > 0 ? 'bad' : 'default'} />
          </div>

          {/* Exposure */}
          <SectionLabel>Exposure</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <Card label="Net Exposure" value={usd(d.net_exposure)} icon={Scale} tone="info" hint="Σ |net| across instruments" />
            <Card label="A-Book Exposure" value={usd(d.a_book_exposure)} icon={Scale} hint="routed to LP" />
            <Card label="B-Book Exposure" value={usd(d.b_book_exposure)} icon={Scale} hint="broker holds" />
          </div>

          {/* Exposure by instrument */}
          <div className="bg-bg-secondary border border-border-primary rounded-md">
            <div className="px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Exposure by instrument</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-primary">
                    {['Instrument', 'Long lots', 'Short lots', 'Net lots', 'Risk'].map((h, i) => (
                      <th key={h} className={cn('px-4 py-2 text-xxs uppercase font-semibold text-text-tertiary', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.exposure.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-text-tertiary text-sm">No open positions</td></tr>
                  ) : d.exposure.map((r) => (
                    <tr key={r.symbol} className="border-b border-border-primary/50 hover:bg-bg-hover/40">
                      <td className="px-4 py-2.5 text-sm font-medium text-text-primary">{r.symbol}</td>
                      <td className="px-4 py-2.5 text-sm text-right tabular-nums text-text-secondary">{num(r.total_long)}</td>
                      <td className="px-4 py-2.5 text-sm text-right tabular-nums text-text-secondary">{num(r.total_short)}</td>
                      <td className={cn('px-4 py-2.5 text-sm text-right tabular-nums font-medium', r.net_exposure >= 0 ? 'text-success' : 'text-sell')}>
                        {r.net_exposure >= 0 ? '+' : ''}{num(r.net_exposure)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={cn(
                          'inline-block px-2 py-0.5 rounded text-xxs font-semibold uppercase',
                          r.risk_level === 'high' ? 'bg-sell/15 text-sell'
                            : r.risk_level === 'medium' ? 'bg-warning/15 text-warning'
                            : 'bg-success/15 text-success',
                        )}>{r.risk_level}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
