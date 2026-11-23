'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ArrowUpRight } from 'lucide-react';
import { useLiveQuotes } from '@/lib/useLiveQuotes';
import { changePct, formatPct, formatPrice } from '@/lib/quotes';
import { TRADER_URL } from '@/lib/crm';
import { cn } from '@/lib/cn';

/** Row in public/data/instruments.json: [symbol, name, class, exchange, status, digits] */
type Row = [string, string, string, string, 'live' | 'soon', number];

export const CLASSES = [
  { id: 'all', label: 'All' },
  { id: 'forex', label: 'Forex' },
  { id: 'metals', label: 'Metals' },
  { id: 'energies', label: 'Energies' },
  { id: 'indices', label: 'Indices' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'stocks', label: 'Stocks' },
] as const;

const PAGE = 30;

export function MarketsTable() {
  const params = useSearchParams();
  const router = useRouter();
  const initialClass = CLASSES.some((c) => c.id === params.get('class')) ? (params.get('class') as string) : 'all';
  const [cls, setCls] = useState<string>(initialClass);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [visibleKey, setVisibleKey] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  // Load the list only when the table is close to the viewport.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!near || rows) return;
    fetch('/data/instruments.json')
      .then((r) => r.json())
      .then((d: { rows: Row[] }) => setRows(d.rows))
      .catch(() => setFailed(true));
  }, [near, rows]);

  useEffect(() => {
    const c = params.get('class');
    if (c && CLASSES.some((x) => x.id === c)) setCls(c);
  }, [params]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (cls === 'all' || r[2] === cls) &&
        (!needle || r[0].toLowerCase().includes(needle) || r[1].toLowerCase().includes(needle) || r[3].toLowerCase().includes(needle)),
    );
  }, [rows, cls, q]);
  const shown = filtered.slice(0, limit);

  // Debounce which symbols get live prices.
  const shownKey = shown.map((r) => r[0]).join(',');
  useEffect(() => {
    const t = window.setTimeout(() => setVisibleKey(shownKey ? shownKey.split(',') : []), 350);
    return () => window.clearTimeout(t);
  }, [shownKey]);
  const { quotes, live } = useLiveQuotes(visibleKey, {}, visibleKey.length > 0);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows?.length ?? 0 };
    rows?.forEach((r) => (c[r[2]] = (c[r[2]] || 0) + 1));
    return c;
  }, [rows]);

  const pick = (id: string) => {
    setCls(id);
    setLimit(PAGE);
    const url = id === 'all' ? '/markets' : `/markets?class=${id}`;
    router.replace(url + '#list', { scroll: false });
  };

  return (
    <div ref={box}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Asset class" className="no-scrollbar -mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] lg:mx-0 lg:px-0">
          {CLASSES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={cls === c.id}
              type="button"
              onClick={() => pick(c.id)}
              className={cn(
                'flex h-10 flex-none items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                cls === c.id ? 'border-ember bg-ember text-[#120804]' : 'border-white/15 text-fg-2 hover:border-white/30 hover:text-fg',
              )}
            >
              {c.label}
              {rows && <span className={cn('num text-[11px]', cls === c.id ? 'text-black/60' : 'text-fg-3')}>{counts[c.id] ?? 0}</span>}
            </button>
          ))}
        </div>
        <label className="relative flex h-11 w-full items-center lg:w-80">
          <Search size={16} className="pointer-events-none absolute left-4 text-fg-3" aria-hidden />
          <span className="sr-only">Search markets</span>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search EURUSD, gold, Apple…"
            className="h-full w-full rounded-full border border-white/15 bg-white/[0.03] pl-11 pr-4 text-sm text-fg placeholder:text-fg-3 focus:border-ember/60 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-6 overflow-hidden rounded-[24px] border border-white/[0.09] bg-white/[0.015]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3 text-[11px] text-fg-3">
          <span>{rows ? `${filtered.length.toLocaleString('en-US')} instruments` : 'Loading instruments…'}</span>
          <span className="flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-up' : 'bg-fg-3')} />
            {live ? 'Live where streaming, otherwise latest' : 'Latest prices'}
          </span>
        </div>
        <table className="table-clean w-full">
          <thead className="hidden sm:table-header-group">
            <tr className="border-b border-white/[0.07]">
              <th scope="col" className="px-5 py-3">Instrument</th>
              <th scope="col" className="hidden px-3 py-3 md:table-cell">Class</th>
              <th scope="col" className="px-3 py-3 !text-right">Bid</th>
              <th scope="col" className="hidden px-3 py-3 !text-right sm:table-cell">Ask</th>
              <th scope="col" className="px-3 py-3 !text-right">Day</th>
              <th scope="col" className="hidden px-5 py-3 !text-right lg:table-cell">Status</th>
            </tr>
          </thead>
          <tbody>
            {!rows &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.05]">
                  <td colSpan={6} className="px-5 py-4">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-white/[0.05]" />
                  </td>
                </tr>
              ))}
            {failed && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-fg-2">
                  The list did not load. Refresh the page to try again.
                </td>
              </tr>
            )}
            {shown.map(([s, name, c, ex, status, digits]) => {
              const qq = quotes[s];
              const ch = changePct(qq);
              return (
                <tr key={s} className="group border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]">
                  <td className="px-5 py-3.5">
                    <a href={TRADER_URL} className="flex flex-col">
                      <span className="flex items-center gap-2 text-[14px] font-semibold">
                        {s}
                        <ArrowUpRight size={13} className="text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                      </span>
                      <span className="max-w-[46vw] truncate text-[12px] text-fg-3 sm:max-w-[320px]">
                        {name}
                        {ex ? ` · ${ex}` : ''}
                      </span>
                    </a>
                  </td>
                  <td className="hidden px-3 py-3.5 text-[13px] capitalize text-fg-2 md:table-cell">{c}</td>
                  <td className="num px-3 py-3.5 text-right text-[13px]">{formatPrice(qq?.bid, digits)}</td>
                  <td className="num hidden px-3 py-3.5 text-right text-[13px] sm:table-cell">{formatPrice(qq?.ask, digits)}</td>
                  <td className={cn('num px-3 py-3.5 text-right text-[12px]', ch === undefined ? 'text-fg-3' : ch >= 0 ? 'text-up' : 'text-down')}>
                    {formatPct(ch)}
                  </td>
                  <td className="hidden px-5 py-3.5 text-right lg:table-cell">
                    {status === 'live' ? (
                      <span className="chip !h-6 !border-up/30 !bg-up/10 text-[11px] !text-[#7ee2a1]">Live</span>
                    ) : (
                      <span className="chip !h-6 text-[11px]">Live soon · demo now</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows && !filtered.length && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-fg-2">
                  Nothing matches “{q}”. Try a symbol like XAUUSD or a name like Tesla.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filtered.length > limit && (
          <div className="flex justify-center p-5">
            <button type="button" onClick={() => setLimit((l) => l + PAGE * 2)} className="btn btn-outline btn-sm">
              Show more ({(filtered.length - limit).toLocaleString('en-US')} left)
            </button>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-fg-3">
        Bid and ask from the Ezymex public market-data feed; day change is the mid price against the day’s open. Symbols that
        are not streaming show their latest snapshot. The spread on your account depends on its type.
      </p>
    </div>
  );
}
