'use client';

/**
 * Hedged Trades — standalone admin section.
 *
 * Three tabs:
 *   • Live hedges     — per-client accounts holding both sides of an
 *                       instrument right now, with hedge ratio + net lots.
 *   • Book exposure   — per-instrument client long/short and the house's
 *                       net position (what the desk may offset with the LP).
 *   • History         — closed hedge episodes (recorded going-forward).
 *
 * Actions (hedge.manage): block a specific trade (force-close a position),
 * block the whole account (suspend its trading). Read-only for demo_admin.
 *
 * Backed by /hedge/{live,exposure,history,block-trade,block-account}.
 */
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  Scale, RefreshCw, Loader2, Ban, X, Search, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';

type Tab = 'live' | 'exposure' | 'history';
const POLL_MS = 8000;

interface LiveHedge {
  account_id: string; instrument_id: string; account_number: string;
  user_id: string; client_name: string; email: string; country: string | null;
  symbol: string; long_lots: number; short_lots: number; net_lots: number;
  hedged_lots: number; hedge_ratio_pct: number; leg_count: number;
  routing_type: string; first_leg_at: string | null;
}
interface ExposureRow {
  instrument_id: string; symbol: string;
  client_long_lots: number; client_short_lots: number; client_net_lots: number;
  house_net_lots: number; house_side: 'long' | 'short' | 'flat';
  net_notional_usd: number; accounts: number;
}
interface HistoryRow {
  id: string; account_number: string; client_name: string; email: string;
  country: string | null; symbol: string; peak_long_lots: number;
  peak_short_lots: number; opened_at: string | null; closed_at: string | null;
  duration_min: number | null;
}

const fmtLots = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUsd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDur = (m: number | null) => {
  if (m == null) return '—';
  if (m < 60) return `${m.toFixed(0)}m`;
  if (m < 1440) return `${(m / 60).toFixed(1)}h`;
  return `${(m / 1440).toFixed(1)}d`;
};
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function HedgePage() {
  const [tab, setTab] = useState<Tab>('live');
  const [live, setLive] = useState<LiveHedge[]>([]);
  const [exposure, setExposure] = useState<ExposureRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    kind: 'trade' | 'account'; id: string; label: string;
  }>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    adminApi.get<{ permissions?: string[] }>('/auth/me')
      .then((me) => setCanManage(!!me.permissions?.some((p) => p === '*' || p === 'hedge.manage')))
      .catch(() => setCanManage(false));
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (tab === 'live') {
        const r = await adminApi.get<{ items: LiveHedge[] }>('/hedge/live', search ? { search } : undefined);
        setLive(r.items || []);
      } else if (tab === 'exposure') {
        const r = await adminApi.get<{ items: ExposureRow[] }>('/hedge/exposure');
        setExposure(r.items || []);
      } else {
        const r = await adminApi.get<{ items: HistoryRow[] }>('/hedge/history', search ? { search } : undefined);
        setHistory(r.items || []);
      }
    } catch (e: any) {
      if (!silent) toast.error(e?.message || 'Failed to load hedged trades');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => { void load(); }, [load]);
  // Live + exposure poll; history is static enough to load on demand.
  useEffect(() => {
    if (tab === 'history') return;
    const t = setInterval(() => { if (!document.hidden) void load(true); }, POLL_MS);
    return () => clearInterval(t);
  }, [tab, load]);

  const doAction = async () => {
    if (!confirm) return;
    setActing(true);
    try {
      const url = confirm.kind === 'trade'
        ? `/hedge/block-trade/${confirm.id}`
        : `/hedge/block-account/${confirm.id}`;
      const r = await adminApi.post<{ message: string }>(url);
      toast.success(r.message || 'Done');
      setConfirm(null);
      void load();
    } catch (e: any) {
      toast.error(e?.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Scale size={20} className="text-[#d6a93d]" /> Hedged Trades
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Clients holding both sides of an instrument, live book exposure, and hedge history.
          </p>
        </div>
        <button onClick={() => load()} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border-primary hover:bg-bg-hover">
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      <div className="flex items-center gap-1.5 border-b border-border-primary">
        {([['live', 'Live Hedges'], ['exposure', 'Book Exposure'], ['history', 'History']] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              'px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
              tab === k ? 'border-[#d6a93d] text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-primary',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 'exposure' && (
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Account # or email…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border-primary bg-bg-input"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-text-secondary gap-2 text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : tab === 'live' ? (
        <LiveTable rows={live} canManage={canManage} onBlock={setConfirm} />
      ) : tab === 'exposure' ? (
        <ExposureTable rows={exposure} />
      ) : (
        <HistoryTable rows={history} />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.kind === 'trade' ? 'Block this trade?' : 'Block this account?'}
          body={confirm.kind === 'trade'
            ? `This force-closes position ${confirm.label} at its open price (zero P/L) and releases its margin.`
            : `This suspends all trading for account ${confirm.label}. Open positions are left as-is; the client cannot open or close trades until unblocked.`}
          acting={acting}
          onCancel={() => setConfirm(null)}
          onConfirm={doAction}
        />
      )}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={cn('px-3 py-2 text-[11px] uppercase tracking-wide text-text-tertiary font-semibold', right ? 'text-right' : 'text-left')}>{children}</th>;
}
function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return <td className={cn('px-3 py-2.5 text-sm', right && 'text-right', mono && 'tabular-nums')}>{children}</td>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-sm text-text-tertiary">{msg}</div>;
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border-primary overflow-x-auto">{children}</div>;
}

function LiveTable({ rows, canManage, onBlock }: {
  rows: LiveHedge[]; canManage: boolean;
  onBlock: (c: { kind: 'trade' | 'account'; id: string; label: string }) => void;
}) {
  if (rows.length === 0) return <Empty msg="No accounts are currently hedged." />;
  return (
    <Card>
      <table className="w-full min-w-[860px]">
        <thead className="bg-bg-secondary">
          <tr>
            <Th>Client</Th><Th>Account</Th><Th>Symbol</Th>
            <Th right>Long</Th><Th right>Short</Th><Th right>Net</Th>
            <Th right>Hedge %</Th><Th>Routing</Th><Th>Since</Th>
            {canManage && <Th right>Action</Th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {rows.map((r) => (
            <tr key={`${r.account_id}-${r.instrument_id}`} className="hover:bg-bg-hover">
              <Td>
                <div className="font-medium text-text-primary">{r.client_name}</div>
                <div className="text-xs text-text-tertiary">{r.email}{r.country ? ` · ${r.country}` : ''}</div>
              </Td>
              <Td mono>#{r.account_number}</Td>
              <Td><span className="font-semibold">{r.symbol}</span></Td>
              <Td right mono>{fmtLots(r.long_lots)}</Td>
              <Td right mono>{fmtLots(r.short_lots)}</Td>
              <Td right mono>
                <span className={cn(r.net_lots > 0 ? 'text-emerald-500' : r.net_lots < 0 ? 'text-red-500' : 'text-text-tertiary')}>
                  {r.net_lots > 0 ? '+' : ''}{fmtLots(r.net_lots)}
                </span>
              </Td>
              <Td right mono>
                <span className={cn('px-1.5 py-0.5 rounded text-xs font-bold',
                  r.hedge_ratio_pct >= 95 ? 'bg-amber-500/15 text-amber-500' : 'bg-bg-secondary text-text-secondary')}>
                  {r.hedge_ratio_pct.toFixed(0)}%
                </span>
              </Td>
              <Td><span className="text-xs">{r.routing_type}</span></Td>
              <Td><span className="text-xs text-text-tertiary">{fmtDate(r.first_leg_at)}</span></Td>
              {canManage && (
                <Td right>
                  <button
                    onClick={() => onBlock({ kind: 'account', id: r.account_id, label: `#${r.account_number}` })}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-red-500/40 text-red-500 hover:bg-red-500/10"
                  >
                    <Ban size={12} /> Block account
                  </button>
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ExposureTable({ rows }: { rows: ExposureRow[] }) {
  if (rows.length === 0) return <Empty msg="No open client positions." />;
  return (
    <Card>
      <table className="w-full min-w-[720px]">
        <thead className="bg-bg-secondary">
          <tr>
            <Th>Symbol</Th><Th right>Client Long</Th><Th right>Client Short</Th>
            <Th right>Client Net</Th><Th>House Position</Th><Th right>Net Notional</Th><Th right>Accounts</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {rows.map((r) => {
            const Icon = r.house_side === 'long' ? TrendingUp : r.house_side === 'short' ? TrendingDown : Minus;
            return (
              <tr key={r.instrument_id} className="hover:bg-bg-hover">
                <Td><span className="font-semibold">{r.symbol}</span></Td>
                <Td right mono>{fmtLots(r.client_long_lots)}</Td>
                <Td right mono>{fmtLots(r.client_short_lots)}</Td>
                <Td right mono>
                  <span className={cn(r.client_net_lots > 0 ? 'text-emerald-500' : r.client_net_lots < 0 ? 'text-red-500' : 'text-text-tertiary')}>
                    {r.client_net_lots > 0 ? '+' : ''}{fmtLots(r.client_net_lots)}
                  </span>
                </Td>
                <Td>
                  <span className={cn('inline-flex items-center gap-1 text-xs font-semibold',
                    r.house_side === 'long' ? 'text-emerald-500' : r.house_side === 'short' ? 'text-red-500' : 'text-text-tertiary')}>
                    <Icon size={13} /> {r.house_side === 'flat' ? 'Flat' : `${fmtLots(Math.abs(r.house_net_lots))} ${r.house_side}`}
                  </span>
                </Td>
                <Td right mono>{fmtUsd(r.net_notional_usd)}</Td>
                <Td right mono>{r.accounts}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) return <Empty msg="No closed hedge episodes yet. History accrues from when this feature went live." />;
  return (
    <Card>
      <table className="w-full min-w-[820px]">
        <thead className="bg-bg-secondary">
          <tr>
            <Th>Client</Th><Th>Account</Th><Th>Symbol</Th>
            <Th right>Peak Long</Th><Th right>Peak Short</Th>
            <Th>Opened</Th><Th>Closed</Th><Th right>Duration</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-bg-hover">
              <Td>
                <div className="font-medium text-text-primary">{r.client_name}</div>
                <div className="text-xs text-text-tertiary">{r.email}</div>
              </Td>
              <Td mono>#{r.account_number}</Td>
              <Td><span className="font-semibold">{r.symbol}</span></Td>
              <Td right mono>{fmtLots(r.peak_long_lots)}</Td>
              <Td right mono>{fmtLots(r.peak_short_lots)}</Td>
              <Td><span className="text-xs text-text-tertiary">{fmtDate(r.opened_at)}</span></Td>
              <Td><span className="text-xs text-text-tertiary">{fmtDate(r.closed_at)}</span></Td>
              <Td right mono>{fmtDur(r.duration_min)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ConfirmModal({ title, body, acting, onCancel, onConfirm }: {
  title: string; body: string; acting: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl border border-border-primary bg-bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-text-primary">{title}</h3>
          <button onClick={onCancel} className="text-text-tertiary hover:text-text-primary"><X size={18} /></button>
        </div>
        <p className="text-sm text-text-secondary mt-2 leading-relaxed">{body}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-border-primary hover:bg-bg-hover">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={acting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60"
          >
            {acting ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
