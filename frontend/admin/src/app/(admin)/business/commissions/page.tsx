'use client';

/**
 * IB Commission Report — admin.
 * Per-IB summary + row-level ledger of every IB commission, filterable by
 * date (all time / quick ranges / custom) with pagination. Shows the
 * two-tier split: own-referral earnings (L1) vs Master-IB share (L2).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Search, Download } from 'lucide-react';
import toast from 'react-hot-toast';

type View = 'summary' | 'ledger';

interface SummaryRow {
  ib_id: string; ib_name: string; ib_email: string; ib_referral_code: string;
  ib_kind: string; own_amount: number; master_share_amount: number;
  total_amount: number; source_users: number; entries: number;
}
interface LedgerRow {
  created_at: string; amount: number; level: number; commission_type: string;
  ib_name: string; ib_email: string; ib_referral_code: string; ib_kind: string;
  source_user: string; source_email: string | null; source_trade_id: string | null;
}

const money = (n: number) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Quick date ranges. Values are YYYY-MM-DD (local) or '' for all-time.
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
const QUICK = [
  { label: 'All time', from: '', to: '' },
  { label: 'Last 10 days', from: daysAgo(10), to: '' },
  { label: 'Last 30 days', from: daysAgo(30), to: '' },
  { label: 'Today', from: daysAgo(0), to: '' },
];

export default function IBCommissionsPage() {
  const [view, setView] = useState<View>('summary');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<'' | '1' | '2'>('');
  const [page, setPage] = useState(1);
  const perPage = 50;

  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [totals, setTotals] = useState({ total_amount: 0, rows: 0, ibs: 0, source_users: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    if (search.trim()) p.set('search', search.trim());
    if (view === 'ledger' && level) p.set('level', level);
    return p.toString();
  }, [page, dateFrom, dateTo, search, level, view]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === 'summary') {
        const r = await adminApi.get<{ items: SummaryRow[]; total: number }>(`/business/ib/commissions/summary?${qs}`);
        setSummary(r.items || []);
        setTotal(r.total || 0);
      } else {
        const r = await adminApi.get<{ items: LedgerRow[]; total: number; summary: typeof totals }>(`/business/ib/commissions?${qs}`);
        setLedger(r.items || []);
        setTotal(r.total || 0);
        if (r.summary) setTotals(r.summary);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }, [view, qs]);

  useEffect(() => { load(); }, [load]);
  // Reset to page 1 whenever a filter or the view changes.
  useEffect(() => { setPage(1); }, [view, dateFrom, dateTo, search, level]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const exportCsv = () => {
    const rows = view === 'summary'
      ? [['IB', 'Email', 'Code', 'Type', 'Own (L1)', 'Master share (L2)', 'Total', 'Users', 'Entries'],
         ...summary.map((s) => [s.ib_name, s.ib_email, s.ib_referral_code, s.ib_kind, s.own_amount, s.master_share_amount, s.total_amount, s.source_users, s.entries])]
      : [['Date', 'IB', 'Code', 'Type', 'Level', 'From user', 'Amount'],
         ...ledger.map((l) => [l.created_at, l.ib_name, l.ib_referral_code, l.ib_kind, l.level, l.source_user, l.amount])];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ib-commissions-${view}-${dateFrom || 'all'}_${dateTo || 'now'}.csv`;
    a.click();
  };

  const activeQuick = (q: typeof QUICK[number]) => dateFrom === q.from && dateTo === q.to;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">IB Commission Report</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">Per-IB earnings and the full commission ledger — who earned how much, from which users.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary transition-fast">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 p-1 rounded-md bg-bg-secondary border border-border-primary w-fit">
        {(['summary', 'ledger'] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={cn('px-3 py-1.5 rounded text-xs font-medium capitalize transition-fast',
              view === v ? 'bg-accent text-black' : 'text-text-secondary hover:text-text-primary')}>
            {v === 'summary' ? 'Per-IB Summary' : 'Detailed Ledger'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {QUICK.map((q) => (
          <button key={q.label} onClick={() => { setDateFrom(q.from); setDateTo(q.to); }}
            className={cn('px-2.5 py-1 rounded-full text-xxs font-semibold border transition-fast',
              activeQuick(q) ? 'border-accent bg-accent/15 text-accent' : 'border-border-primary text-text-secondary hover:text-text-primary')}>
            {q.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 text-xxs text-text-tertiary">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-xs text-text-primary" />
          <span>→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-xs text-text-primary" />
        </div>
        {view === 'ledger' && (
          <select value={level} onChange={(e) => setLevel(e.target.value as any)}
            className="rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-xs text-text-primary">
            <option value="">All levels</option>
            <option value="1">L1 — Direct IB</option>
            <option value="2">L2 — Master share</option>
          </select>
        )}
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="IB code / email / user"
            className="w-56 rounded-md border border-border-primary bg-bg-primary pl-7 pr-2 py-1 text-xs text-text-primary" />
        </div>
      </div>

      {view === 'ledger' && (
        <div className="flex items-center gap-4 text-xs text-text-secondary bg-bg-secondary border border-border-primary rounded-md px-4 py-2">
          <span>Total: <span className="font-bold text-accent tabular-nums">{money(totals.total_amount)}</span></span>
          <span>Entries: <span className="font-semibold text-text-primary tabular-nums">{totals.rows}</span></span>
          <span>IBs: <span className="font-semibold text-text-primary tabular-nums">{totals.ibs}</span></span>
          <span>Generating users: <span className="font-semibold text-text-primary tabular-nums">{totals.source_users}</span></span>
        </div>
      )}

      <div className="bg-bg-secondary border border-border-primary rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div>
          ) : view === 'summary' ? (
            <table className="w-full text-xs">
              <thead className="bg-bg-tertiary text-text-tertiary">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">IB</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-right px-3 py-2 font-medium">Own (L1)</th>
                  <th className="text-right px-3 py-2 font-medium">Master share (L2)</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                  <th className="text-right px-3 py-2 font-medium">Users</th>
                  <th className="text-right px-3 py-2 font-medium">Entries</th>
                </tr>
              </thead>
              <tbody>
                {summary.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-text-tertiary">No commissions in this range</td></tr>
                ) : summary.map((s) => (
                  <tr key={s.ib_id} className="border-t border-border-primary/60">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-text-primary">{s.ib_name}</div>
                      <div className="text-text-tertiary text-[11px]">{s.ib_email} · {s.ib_referral_code}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', s.ib_kind === 'Master IB' ? 'bg-accent/15 text-accent' : 'bg-bg-tertiary text-text-secondary')}>{s.ib_kind}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{money(s.own_amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{money(s.master_share_amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-buy">{money(s.total_amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{s.source_users}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{s.entries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-bg-tertiary text-text-tertiary">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">IB</th>
                  <th className="text-left px-3 py-2 font-medium">Level</th>
                  <th className="text-left px-3 py-2 font-medium">From user</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-text-tertiary">No commissions in this range</td></tr>
                ) : ledger.map((l, i) => (
                  <tr key={i} className="border-t border-border-primary/60">
                    <td className="px-3 py-2 text-text-tertiary whitespace-nowrap">{l.created_at ? new Date(l.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-text-primary">{l.ib_name}</div>
                      <div className="text-text-tertiary text-[11px]">{l.ib_referral_code} · {l.ib_kind}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', l.level >= 2 ? 'bg-accent/15 text-accent' : 'bg-buy/15 text-buy')}>
                        {l.level >= 2 ? 'L2 Master' : 'L1 Direct'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-text-primary">{l.source_user}</div>
                      {l.source_email && <div className="text-text-tertiary text-[11px]">{l.source_email}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-buy">{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-text-tertiary">
        <span>{total.toLocaleString()} {view === 'summary' ? 'IBs' : 'entries'}</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-md border border-border-primary disabled:opacity-30 hover:text-text-primary transition-fast">← Prev</button>
          <span className="tabular-nums">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-md border border-border-primary disabled:opacity-30 hover:text-text-primary transition-fast">Next →</button>
        </div>
      </div>
    </div>
  );
}
