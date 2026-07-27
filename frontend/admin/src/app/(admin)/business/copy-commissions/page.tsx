'use client';

/**
 * Copy-Trade Commission Report — admin.
 * Per-master (per-user) copy-trade commission earnings + a row-level ledger,
 * filterable by date (all time / quick ranges / custom) with pagination.
 * Mirrors the IB Commission Report. Copy-trade fees are isolated from IB
 * commissions server-side by their transaction description.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Search, Download } from 'lucide-react';
import toast from 'react-hot-toast';

type View = 'summary' | 'ledger';

interface SummaryRow {
  master_user_id: string; master_name: string; master_email: string;
  earned: number; entries: number; followers: number;
}
interface LedgerRow {
  created_at: string; amount: number;
  master_name: string; master_email: string;
  follower_name: string; follower_email: string | null; follower_account: string | null;
}

const money = (n: number) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

export default function CopyCommissionsPage() {
  const [view, setView] = useState<View>('summary');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 50;

  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    if (search.trim()) p.set('search', search.trim());
    return p.toString();
  }, [page, dateFrom, dateTo, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === 'summary') {
        const r = await adminApi.get<{ items: SummaryRow[]; total: number; grand_total: number }>(`/social/copy-commissions/summary?${qs}`);
        setSummary(r.items || []);
        setTotal(r.total || 0);
        setGrandTotal(r.grand_total || 0);
      } else {
        const r = await adminApi.get<{ items: LedgerRow[]; total: number }>(`/social/copy-commissions?${qs}`);
        setLedger(r.items || []);
        setTotal(r.total || 0);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load copy commissions');
    } finally {
      setLoading(false);
    }
  }, [view, qs]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [view, dateFrom, dateTo, search]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const exportCsv = () => {
    const rows = view === 'summary'
      ? [['Master', 'Email', 'Earned', 'Entries', 'Followers'],
         ...summary.map((s) => [s.master_name, s.master_email, s.earned, s.entries, s.followers])]
      : [['Date', 'Master', 'Follower', 'Follower account', 'Amount'],
         ...ledger.map((l) => [l.created_at, l.master_name, l.follower_name, l.follower_account ?? '', l.amount])];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `copy-commissions-${view}-${dateFrom || 'all'}_${dateTo || 'now'}.csv`;
    a.click();
  };

  const activeQuick = (q: typeof QUICK[number]) => dateFrom === q.from && dateTo === q.to;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Copy-Trade Commission Report</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">Per-master copy-trading commission earnings — who earned how much, from which followers.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary transition-fast">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-md bg-bg-secondary border border-border-primary w-fit">
        {(['summary', 'ledger'] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={cn('px-3 py-1.5 rounded text-xs font-medium transition-fast',
              view === v ? 'bg-accent text-black' : 'text-text-secondary hover:text-text-primary')}>
            {v === 'summary' ? 'Per-Master Summary' : 'Detailed Ledger'}
          </button>
        ))}
      </div>

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
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Master / follower email"
            className="w-56 rounded-md border border-border-primary bg-bg-primary pl-7 pr-2 py-1 text-xs text-text-primary" />
        </div>
      </div>

      {view === 'summary' && (
        <div className="flex items-center gap-4 text-xs text-text-secondary bg-bg-secondary border border-border-primary rounded-md px-4 py-2">
          <span>Total commission (all masters, this range): <span className="font-bold text-accent tabular-nums">{money(grandTotal)}</span></span>
          <span>Masters: <span className="font-semibold text-text-primary tabular-nums">{total}</span></span>
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
                  <th className="text-left px-3 py-2 font-medium">Master</th>
                  <th className="text-right px-3 py-2 font-medium">Commission earned</th>
                  <th className="text-right px-3 py-2 font-medium">Entries</th>
                  <th className="text-right px-3 py-2 font-medium">Followers</th>
                </tr>
              </thead>
              <tbody>
                {summary.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-text-tertiary">No copy commissions in this range</td></tr>
                ) : summary.map((s) => (
                  <tr key={s.master_user_id} className="border-t border-border-primary/60">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-text-primary">{s.master_name}</div>
                      <div className="text-text-tertiary text-[11px]">{s.master_email}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-buy">{money(s.earned)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{s.entries}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{s.followers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-bg-tertiary text-text-tertiary">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Master</th>
                  <th className="text-left px-3 py-2 font-medium">From follower</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-text-tertiary">No copy commissions in this range</td></tr>
                ) : ledger.map((l, i) => (
                  <tr key={i} className="border-t border-border-primary/60">
                    <td className="px-3 py-2 text-text-tertiary whitespace-nowrap">{l.created_at ? new Date(l.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-text-primary">{l.master_name}</div>
                      <div className="text-text-tertiary text-[11px]">{l.master_email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-text-primary">{l.follower_name}</div>
                      {l.follower_account && <div className="text-text-tertiary text-[11px]">#{l.follower_account}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-buy">{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-text-tertiary">
        <span>{total.toLocaleString()} {view === 'summary' ? 'masters' : 'entries'}</span>
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
