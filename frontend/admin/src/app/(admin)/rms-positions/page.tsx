'use client';

/**
 * RMS — Live Position Monitor (Module 2).
 *
 * Every open position with the desk columns (client, country, IB, routing)
 * and live current price + floating P/L. Filterable + paginated, polls every
 * 5s. Backed by GET /rms-dashboard/positions (rms.view). Read-only aside from
 * View (drill to the user) and CSV export.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import {
  Radar, RefreshCw, Loader2, ChevronLeft, ChevronRight, Download,
  ExternalLink, Search,
} from 'lucide-react';

interface Row {
  ticket_id: string;
  account_number: string | null;
  client_name: string;
  user_id: string;
  country: string | null;
  introducing_broker: string | null;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  open_price: number;
  current_price: number;
  floating_pnl: number;
  margin_used: number;
  leverage: number;
  open_time: string | null;
  routing_type: string;
  liquidity_provider: string | null;
  is_demo: boolean;
}

const POLL_MS = 5000;
const PAGE_SIZE = 50;

const num = (n: number | null | undefined, d = 2) =>
  (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

function holding(openIso: string | null): string {
  if (!openIso) return '—';
  const ms = Date.now() - new Date(openIso).getTime();
  if (ms < 0) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export default function RmsPositionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // filters
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState('');
  const [book, setBook] = useState('');
  const [country, setCountry] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = { page: String(page), per_page: String(PAGE_SIZE) };
      if (symbol) params.symbol = symbol.trim();
      if (side) params.side = side;
      if (book) params.book_type = book;
      if (country) params.country = country.trim();
      if (search) params.search = search.trim();
      const res = await adminApi.get<{ items: Row[]; total: number }>('/rms-dashboard/positions', params);
      setRows(res.items || []);
      setTotal(res.total || 0);
    } catch { /* keep last */ } finally {
      setLoading(false);
    }
  }, [page, symbol, side, book, country, search]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // reset to page 1 whenever a filter changes
  useEffect(() => { setPage(1); }, [symbol, side, book, country, search]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const totals = useMemo(() => {
    const pnl = rows.reduce((s, r) => s + (r.floating_pnl || 0), 0);
    const lots = rows.reduce((s, r) => s + (r.lots || 0), 0);
    return { pnl, lots };
  }, [rows]);

  function exportCsv() {
    const cols = ['ticket_id', 'account_number', 'client_name', 'country', 'introducing_broker',
      'symbol', 'side', 'lots', 'open_price', 'current_price', 'floating_pnl', 'margin_used',
      'leverage', 'open_time', 'routing_type', 'liquidity_provider'];
    const head = cols.join(',');
    const body = rows.map((r) => cols.map((c) => {
      const v = (r as any)[c];
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([`${head}\n${body}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `positions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const inputCls = 'px-2.5 py-1.5 text-xs bg-bg-secondary border border-border-primary rounded-md text-text-primary focus:border-accent/50 focus:outline-none';

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Radar size={18} className="text-buy" /> Live Position Monitor
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Every open position with live price & floating P/L — refreshes every 5s · {total.toLocaleString()} open
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-bg-hover border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-fast">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={() => void load()} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-bg-hover border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-fast">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-secondary border border-border-primary rounded-md">
          <Search size={13} className="text-text-tertiary" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Account or email" className="bg-transparent text-xs text-text-primary outline-none w-40" />
        </div>
        <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="Instrument" className={cn(inputCls, 'w-28')} />
        <select value={side} onChange={(e) => setSide(e.target.value)} className={inputCls}>
          <option value="">All sides</option><option value="buy">Buy</option><option value="sell">Sell</option>
        </select>
        <select value={book} onChange={(e) => setBook(e.target.value)} className={inputCls}>
          <option value="">A + B book</option><option value="A">A-Book</option><option value="B">B-Book</option>
        </select>
        <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className={cn(inputCls, 'w-24')} />
        {(symbol || side || book || country || search) && (
          <button onClick={() => { setSymbol(''); setSide(''); setBook(''); setCountry(''); setSearch(''); }}
            className="text-xxs text-text-tertiary hover:text-text-primary underline">clear</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-bg-secondary border border-border-primary rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-border-primary">
                {['Ticket', 'Account', 'Client', 'Country', 'IB', 'Instrument', 'Side', 'Lots', 'Open', 'Current', 'Floating P/L', 'Margin', 'Lev', 'Holding', 'Routing', ''].map((h, i) => (
                  <th key={i} className={cn('px-3 py-2 text-xxs uppercase font-semibold text-text-tertiary whitespace-nowrap', ['Lots', 'Open', 'Current', 'Floating P/L', 'Margin', 'Lev'].includes(h) ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={16} className="px-3 py-10 text-center text-text-tertiary"><Loader2 size={15} className="animate-spin inline mr-2" /> Loading positions…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={16} className="px-3 py-10 text-center text-text-tertiary text-sm">No open positions match these filters</td></tr>
              ) : rows.map((r) => (
                <tr key={r.ticket_id} className="border-b border-border-primary/40 hover:bg-bg-hover/40">
                  <td className="px-3 py-2 text-xxs font-mono text-text-tertiary">{r.ticket_id.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-xs font-mono text-text-secondary whitespace-nowrap">{r.account_number || '—'}</td>
                  <td className="px-3 py-2 text-xs text-text-primary whitespace-nowrap max-w-[160px] truncate">{r.client_name}</td>
                  <td className="px-3 py-2 text-xs text-text-secondary">{r.country || '—'}</td>
                  <td className="px-3 py-2 text-xs text-text-secondary whitespace-nowrap max-w-[120px] truncate">{r.introducing_broker || '—'}</td>
                  <td className="px-3 py-2 text-xs font-medium text-text-primary">{r.symbol}</td>
                  <td className="px-3 py-2">
                    <span className={cn('px-1.5 py-0.5 rounded text-xxs font-semibold uppercase', r.side === 'buy' ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell')}>{r.side}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums text-text-secondary">{num(r.lots)}</td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums text-text-tertiary">{num(r.open_price, 5)}</td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums text-text-secondary">{num(r.current_price, 5)}</td>
                  <td className={cn('px-3 py-2 text-xs text-right tabular-nums font-semibold', r.floating_pnl >= 0 ? 'text-success' : 'text-sell')}>
                    {r.floating_pnl >= 0 ? '+' : ''}${num(r.floating_pnl)}
                  </td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums text-text-secondary">${num(r.margin_used)}</td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums text-text-tertiary">1:{r.leverage}</td>
                  <td className="px-3 py-2 text-xxs text-text-tertiary whitespace-nowrap">{holding(r.open_time)}</td>
                  <td className="px-3 py-2">
                    <span className={cn('px-1.5 py-0.5 rounded text-xxs font-semibold', r.routing_type === 'A-Book' ? 'bg-buy/15 text-buy' : 'bg-bg-hover text-text-secondary')}>{r.routing_type}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/users/${r.user_id}`} className="inline-flex items-center gap-1 text-xxs text-text-tertiary hover:text-accent" title="View client">
                      <ExternalLink size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-border-primary bg-bg-hover/30">
                  <td colSpan={7} className="px-3 py-2 text-xxs uppercase text-text-tertiary font-semibold">Page totals</td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums text-text-secondary">{num(totals.lots)}</td>
                  <td colSpan={2} />
                  <td className={cn('px-3 py-2 text-xs text-right tabular-nums font-semibold', totals.pnl >= 0 ? 'text-success' : 'text-sell')}>
                    {totals.pnl >= 0 ? '+' : ''}${num(totals.pnl)}
                  </td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-md border border-border-primary text-text-secondary disabled:opacity-30 hover:text-text-primary"><ChevronLeft size={14} /></button>
          <span className="text-xs text-text-tertiary tabular-nums">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-md border border-border-primary text-text-secondary disabled:opacity-30 hover:text-text-primary"><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}
