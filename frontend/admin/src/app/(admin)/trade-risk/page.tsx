'use client';

/**
 * Trade Risk (RMS) — B-book desk risk monitor.
 *
 *   • At-Risk Trades — open positions classified by their account's live
 *     margin level (critical ≤ stop-out, warning ≤ margin-call, caution).
 *   • Coordinated Trades — same instrument + same side opened by N+ distinct
 *     users inside a short time window (herding / collusion signal).
 *
 * Both are live reads; the page polls every 5s so the desk sees risk move
 * in real time. Cluster window / min-users are adjustable.
 */
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ShieldAlert, Loader2, ChevronLeft, ChevronRight, Users, RefreshCw,
  AlertTriangle, TrendingUp, TrendingDown,
} from 'lucide-react';

interface Summary {
  open_trades: number;
  at_risk_trades: number;
  critical_trades: number;
  warning_trades: number;
  caution_trades: number;
  accounts_at_risk: number;
  coordinated_clusters: number;
  stop_out_level: number;
  margin_call_level: number;
  caution_level: number;
}
interface AtRiskRow {
  position_id: string;
  user_id: string;
  user_email: string | null;
  account_id: string;
  account_number: string | null;
  is_demo: boolean;
  symbol: string | null;
  side: string | null;
  lots: number;
  open_price: number;
  notional: number;
  profit: number;
  margin_level: number;
  equity: number;
  margin_used: number;
  risk_bucket: string;
  opened_at: string | null;
}
interface ClusterUser { email: string | null }
interface Cluster {
  symbol: string;
  side: string;
  bucket_start: string | null;
  first_trade_at: string | null;
  last_trade_at: string | null;
  user_count: number;
  trade_count: number;
  total_lots: number;
  users: ClusterUser[];
}

type Tab = 'at-risk' | 'coordinated';
const PAGE_SIZE = 25;
const POLL_MS = 5000;

function fmtTime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function num(n: number, d = 2) {
  return (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function TradeRiskPage() {
  const [tab, setTab] = useState<Tab>('at-risk');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [windowMin, setWindowMin] = useState(5);
  const [minUsers, setMinUsers] = useState(3);
  const [lookback, setLookback] = useState(24);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await adminApi.get<Summary>('/trade-risk/summary', {
        window_min: String(windowMin), min_users: String(minUsers), lookback_hours: String(lookback),
      }));
    } catch { /* cards stay as-is */ }
  }, [windowMin, minUsers, lookback]);

  useEffect(() => {
    void loadSummary();
    const t = setInterval(() => void loadSummary(), POLL_MS);
    return () => clearInterval(t);
  }, [loadSummary]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <ShieldAlert size={18} className="text-sell" />
            Trade Risk / RMS
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Open trades near margin-call / stop-out, and coordinated same-side entries across users
          </p>
        </div>
        <button onClick={() => void loadSummary()} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-bg-hover border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-fast">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card label="Open trades" value={summary?.open_trades} />
        <Card label="At risk" value={summary?.at_risk_trades} tone="warn" />
        <Card label={`Critical ≤${summary?.stop_out_level ?? 50}%`} value={summary?.critical_trades} tone="danger" />
        <Card label={`Warning ≤${summary?.margin_call_level ?? 80}%`} value={summary?.warning_trades} tone="warn" />
        <Card label="Accounts at risk" value={summary?.accounts_at_risk} tone="warn" />
        <Card label="Coordinated clusters" value={summary?.coordinated_clusters} tone="danger" />
      </div>

      <div className="flex items-center gap-1 border-b border-border-primary">
        <TabBtn active={tab === 'at-risk'} onClick={() => setTab('at-risk')} icon={<AlertTriangle size={14} />}>
          At-Risk Trades{summary?.at_risk_trades ? ` (${summary.at_risk_trades})` : ''}
        </TabBtn>
        <TabBtn active={tab === 'coordinated'} onClick={() => setTab('coordinated')} icon={<Users size={14} />}>
          Coordinated Trades{summary?.coordinated_clusters ? ` (${summary.coordinated_clusters})` : ''}
        </TabBtn>
      </div>

      {tab === 'at-risk' && <AtRiskTab />}
      {tab === 'coordinated' && (
        <CoordinatedTab
          windowMin={windowMin} minUsers={minUsers} lookback={lookback}
          setWindowMin={setWindowMin} setMinUsers={setMinUsers} setLookback={setLookback}
        />
      )}
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value?: number; icon?: React.ReactNode; tone?: 'warn' | 'danger' }) {
  const hot = (value ?? 0) > 0;
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md p-3">
      <div className="text-xxs text-text-tertiary uppercase tracking-wider">{label}</div>
      <div className={cn(
        'text-xl font-semibold mt-1 tabular-nums',
        tone === 'danger' && hot ? 'text-sell' : '',
        tone === 'warn' && hot ? 'text-yellow-500' : '',
        (!tone || !hot) && 'text-text-primary',
      )}>
        {value == null ? '—' : value.toLocaleString()}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn(
      'flex items-center gap-1.5 px-3 py-2 text-xs font-medium -mb-px border-b-2 transition-fast',
      active ? 'border-accent text-accent' : 'border-transparent text-text-tertiary hover:text-text-primary',
    )}>
      {icon}{children}
    </button>
  );
}

function bucketBadge(b: string) {
  const map: Record<string, string> = {
    critical: 'bg-sell/20 text-sell',
    warning: 'bg-yellow-500/20 text-yellow-500',
    caution: 'bg-info/15 text-info',
    healthy: 'bg-bg-hover text-text-tertiary',
  };
  return map[b] || 'bg-bg-hover text-text-secondary';
}

function SideTag({ side }: { side: string | null }) {
  const buy = (side || '').toLowerCase() === 'buy';
  return (
    <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase',
      buy ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell')}>
      {buy ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{side}
    </span>
  );
}

/* ── Tab: At-Risk Trades ─────────────────────────────────────────────── */
function AtRiskTab() {
  const [page, setPage] = useState(1);
  const [bucket, setBucket] = useState('');
  const [includeDemo, setIncludeDemo] = useState(false);
  const [items, setItems] = useState<AtRiskRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: String(PAGE_SIZE) };
      if (bucket) params.bucket = bucket;
      if (includeDemo) params.include_demo = 'true';
      const res = await adminApi.get<{ items: AtRiskRow[]; total: number }>('/trade-risk/at-risk', params);
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load at-risk trades');
      setItems([]); setTotal(0);
    } finally { setLoading(false); }
  }, [page, bucket, includeDemo]);

  useEffect(() => {
    void fetchRows();
    const t = setInterval(() => void fetchRows(), POLL_MS);
    return () => clearInterval(t);
  }, [fetchRows]);
  useEffect(() => { setPage(1); }, [bucket, includeDemo]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md">
      <div className="flex flex-wrap items-end gap-3 p-3 border-b border-border-primary">
        <div>
          <span className="text-xxs text-text-tertiary block mb-1">Risk level</span>
          <select value={bucket} onChange={(e) => setBucket(e.target.value)} className="text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary">
            <option value="">All at-risk</option>
            <option value="critical">Critical (near stop-out)</option>
            <option value="warning">Warning (margin-call)</option>
            <option value="caution">Caution</option>
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none">
          <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} className="accent-accent" />
          Include demo accounts
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-primary text-left text-text-tertiary uppercase tracking-wider">
              <th className="px-3 py-2 font-semibold">Risk</th>
              <th className="px-3 py-2 font-semibold">User / Account</th>
              <th className="px-3 py-2 font-semibold">Instrument</th>
              <th className="px-3 py-2 font-semibold text-right">Lots</th>
              <th className="px-3 py-2 font-semibold text-right">Notional</th>
              <th className="px-3 py-2 font-semibold text-right">Margin lvl</th>
              <th className="px-3 py-2 font-semibold text-right">Equity</th>
              <th className="px-3 py-2 font-semibold">Opened</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-12 text-center text-text-tertiary"><Loader2 className="inline animate-spin mr-2" size={16} />Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-text-tertiary">No open trades currently at risk. 🎉</td></tr>
            ) : items.map((r) => (
              <tr key={r.position_id} className="border-b border-border-primary/60 hover:bg-bg-hover/40 transition-fast">
                <td className="px-3 py-2 align-top">
                  <span className={cn('px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase', bucketBadge(r.risk_bucket))}>{r.risk_bucket}</span>
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="text-text-primary font-medium">{r.user_email || '—'}{r.is_demo && <span className="ml-1 text-[10px] text-text-tertiary">(demo)</span>}</div>
                  <div className="text-[10px] text-text-tertiary font-mono">{r.account_number}</div>
                </td>
                <td className="px-3 py-2 align-top whitespace-nowrap">
                  <span className="text-text-primary font-medium mr-1.5">{r.symbol}</span><SideTag side={r.side} />
                </td>
                <td className="px-3 py-2 align-top text-right text-text-secondary tabular-nums">{num(r.lots, 2)}</td>
                <td className="px-3 py-2 align-top text-right text-text-secondary tabular-nums">{num(r.notional, 0)}</td>
                <td className="px-3 py-2 align-top text-right tabular-nums font-semibold">
                  <span className={cn(
                    r.risk_bucket === 'critical' && 'text-sell',
                    r.risk_bucket === 'warning' && 'text-yellow-500',
                    r.risk_bucket === 'caution' && 'text-info',
                  )}>{num(r.margin_level, 1)}%</span>
                </td>
                <td className="px-3 py-2 align-top text-right text-text-secondary tabular-nums">{num(r.equity, 2)}</td>
                <td className="px-3 py-2 align-top text-text-tertiary whitespace-nowrap">{fmtTime(r.opened_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border-primary text-xxs text-text-tertiary">
          <span>Page {page} of {totalPages} · {total} total</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1 rounded border border-border-primary disabled:opacity-40 hover:bg-bg-hover"><ChevronLeft size={14} /></button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="p-1 rounded border border-border-primary disabled:opacity-40 hover:bg-bg-hover"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tab: Coordinated Trades ─────────────────────────────────────────── */
function CoordinatedTab({
  windowMin, minUsers, lookback, setWindowMin, setMinUsers, setLookback,
}: {
  windowMin: number; minUsers: number; lookback: number;
  setWindowMin: (n: number) => void; setMinUsers: (n: number) => void; setLookback: (n: number) => void;
}) {
  const [items, setItems] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<Cluster[]>('/trade-risk/clusters', {
        window_min: String(windowMin), min_users: String(minUsers), lookback_hours: String(lookback),
      });
      setItems(res || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load clusters');
      setItems([]);
    } finally { setLoading(false); }
  }, [windowMin, minUsers, lookback]);

  useEffect(() => {
    void fetchClusters();
    const t = setInterval(() => void fetchClusters(), POLL_MS);
    return () => clearInterval(t);
  }, [fetchClusters]);

  return (
    <div className="space-y-3">
      <div className="bg-bg-secondary border border-border-primary rounded-md flex flex-wrap items-end gap-4 p-3">
        <NumCtl label="Time window (min)" value={windowMin} onChange={setWindowMin} min={1} max={240} />
        <NumCtl label="Min users" value={minUsers} onChange={setMinUsers} min={2} max={100} />
        <NumCtl label="Lookback (hours)" value={lookback} onChange={setLookback} min={1} max={168} />
        <span className="text-xxs text-text-tertiary ml-auto">
          Same instrument + same side opened by ≥ {minUsers} users within {windowMin} min
        </span>
      </div>

      {loading && items.length === 0 ? (
        <div className="bg-bg-secondary border border-border-primary rounded-md px-3 py-12 text-center text-text-tertiary"><Loader2 className="inline animate-spin mr-2" size={16} />Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-bg-secondary border border-border-primary rounded-md px-3 py-12 text-center text-text-tertiary">
          No coordinated same-side clusters in the last {lookback}h above the threshold.
        </div>
      ) : items.map((c, i) => (
        <div key={`${c.symbol}-${c.side}-${c.bucket_start}-${i}`} className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border-primary">
            <div className="flex items-center gap-2">
              <span className="font-medium text-text-primary text-sm">{c.symbol}</span>
              <SideTag side={c.side} />
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-sell/15 text-sell text-[10px] font-semibold">
                <Users size={10} /> {c.user_count} users
              </span>
              <span className="text-xxs text-text-tertiary">{c.trade_count} trades · {num(c.total_lots, 2)} lots</span>
            </div>
            <span className="text-xxs text-text-tertiary">{fmtTime(c.first_trade_at)} → {fmtTime(c.last_trade_at)}</span>
          </div>
          <div className="px-3 py-2 flex flex-wrap gap-2">
            {c.users.map((u, j) => (
              <span key={j} className="px-2 py-1 rounded bg-bg-input border border-border-primary text-xs text-text-primary">{u.email || '—'}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NumCtl({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div>
      <span className="text-xxs text-text-tertiary block mb-1">{label}</span>
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n))); }}
        className="text-xs py-1.5 px-2 w-28 bg-bg-input border border-border-primary rounded-md text-text-primary"
      />
    </div>
  );
}
