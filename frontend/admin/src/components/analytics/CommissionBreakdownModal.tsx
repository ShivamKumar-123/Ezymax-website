'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { X, Search, ChevronLeft, ChevronRight, Loader2, DollarSign } from 'lucide-react';

// Per-user row + grand totals behind the "Admin Commission (Total)" card.
// Spread is 0 today (baked into the executable price) but kept as a column
// so the layout doesn't change when per-trade spread capture lands.
interface Row {
  user_id: string;
  email: string;
  name: string | null;
  spread: number;
  charges: number;
  swap: number;
  total: number;
}
interface Totals { spread: number; charges: number; swap: number; total: number }
interface Page {
  totals: Totals;
  items: Row[];
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

function money(n: number) {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CommissionBreakdownModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const perPage = 25;

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: String(perPage) };
      if (search) params.search = search;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await adminApi.get<Page>('/analytics/commission-breakdown', params);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, dateFrom, dateTo]);

  useEffect(() => { void fetchPage(); }, [fetchPage]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const applySearch = () => setSearch(searchInput.trim());
  const totals = data?.totals;
  const totalPages = data?.total_pages ?? 1;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-bg-secondary border border-border-primary rounded-lg shadow-xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-success" />
            <h2 className="text-sm font-semibold text-text-primary">Admin Commission — Spread / Charges / Swap</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-text-tertiary hover:bg-bg-hover hover:text-text-primary transition-fast" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Totals row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4">
          <TotalTile label="Spread" value={totals?.spread ?? 0} hint="baked into price" />
          <TotalTile label="Charges" value={totals?.charges ?? 0} />
          <TotalTile label="Swap" value={totals?.swap ?? 0} />
          <TotalTile label="Total" value={totals?.total ?? 0} emphasize />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-2 px-4 pb-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xxs text-text-tertiary mb-1">Search user</label>
            <div className="flex">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
                placeholder="email or name"
                className="flex-1 px-2 py-1.5 text-xs bg-bg-input border border-border-primary rounded-l-md text-text-primary focus:outline-none focus:border-buy/50"
              />
              <button onClick={applySearch} className="px-2.5 bg-bg-input border border-l-0 border-border-primary rounded-r-md text-text-tertiary hover:text-text-primary">
                <Search size={13} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xxs text-text-tertiary mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 text-xs bg-bg-input border border-border-primary rounded-md text-text-primary focus:outline-none focus:border-buy/50" />
          </div>
          <div>
            <label className="block text-xxs text-text-tertiary mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 text-xs bg-bg-input border border-border-primary rounded-md text-text-primary focus:outline-none focus:border-buy/50" />
          </div>
          {(search || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); setDateFrom(''); setDateTo(''); }}
              className="px-2.5 py-1.5 text-xxs text-text-tertiary border border-border-primary rounded-md hover:bg-bg-hover"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="px-4 pb-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="text-text-tertiary border-b border-border-primary">
                <th className="text-left font-medium py-2 pr-3">User</th>
                <th className="text-right font-medium py-2 px-3">Spread</th>
                <th className="text-right font-medium py-2 px-3">Charges</th>
                <th className="text-right font-medium py-2 px-3">Swap</th>
                <th className="text-right font-medium py-2 pl-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-10 text-center text-text-tertiary"><Loader2 className="inline animate-spin" size={16} /></td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-text-tertiary">No commission data for this filter.</td></tr>
              ) : (
                data.items.map((r) => (
                  <tr key={r.user_id} className="border-b border-border-primary/50 hover:bg-bg-hover">
                    <td className="py-2 pr-3">
                      <div className="text-text-primary truncate max-w-[220px]">{r.name || '—'}</div>
                      <div className="text-text-tertiary text-xxs truncate max-w-[220px]">{r.email}</div>
                    </td>
                    <td className="text-right py-2 px-3 font-mono tabular-nums text-text-tertiary">${money(r.spread)}</td>
                    <td className="text-right py-2 px-3 font-mono tabular-nums text-text-secondary">${money(r.charges)}</td>
                    <td className="text-right py-2 px-3 font-mono tabular-nums text-text-secondary">${money(r.swap)}</td>
                    <td className="text-right py-2 pl-3 font-mono tabular-nums font-semibold text-success">${money(r.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-primary">
          <span className="text-xxs text-text-tertiary">
            {data ? `${data.total_count} user${data.total_count === 1 ? '' : 's'}` : '—'}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md border border-border-primary text-text-secondary disabled:opacity-40 hover:bg-bg-hover"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xxs text-text-tertiary tabular-nums">Page {data?.page ?? page} / {totalPages}</span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md border border-border-primary text-text-secondary disabled:opacity-40 hover:bg-bg-hover"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}

function TotalTile({ label, value, hint, emphasize }: { label: string; value: number; hint?: string; emphasize?: boolean }) {
  return (
    <div className={cn('rounded-md border p-3', emphasize ? 'border-success/40 bg-success/5' : 'border-border-primary bg-bg-page')}>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xxs text-text-tertiary uppercase tracking-wide">{label}</span>
        {hint && <span className="text-[9px] text-text-tertiary/60">({hint})</span>}
      </div>
      <p className={cn('text-base font-semibold font-mono tabular-nums', emphasize ? 'text-success' : 'text-text-primary')}>${money(value)}</p>
    </div>
  );
}
