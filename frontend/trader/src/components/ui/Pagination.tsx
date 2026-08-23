'use client';

/**
 * Pagination — Crextio-style pager used on every list in the app.
 *
 *   const pager = usePagination(items, 10);
 *   pager.items.map(...)            // current page slice
 *   <Pagination {...pager.props} /> // controls + "Showing 1–10 of 57"
 *
 * Keeps the page in range when the source list shrinks (filters, deletes),
 * exposes a rows-per-page picker, and renders nothing when there is only one
 * page and the default page size — so small lists stay clean.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { clsx } from 'clsx';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizes?: number[];
  /** Hide entirely when everything fits on one page (default true). */
  autoHide?: boolean;
  className?: string;
  itemLabel?: string;
}

const DEFAULT_SIZES = [10, 25, 50];

function pageWindow(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(pages - 1, page + 1);
  if (lo > 2) out.push('gap');
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < pages - 1) out.push('gap');
  out.push(pages);
  return out;
}

export function Pagination({
  page, pageSize, total, onPageChange, onPageSizeChange,
  pageSizes = DEFAULT_SIZES, autoHide = true, className, itemLabel = 'items',
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  if (autoHide && pages <= 1 && (!onPageSizeChange || total <= pageSizes[0]!)) return null;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-semibold transition-colors disabled:opacity-35 disabled:cursor-not-allowed';
  const ghost = 'text-text-secondary hover:bg-bg-hover hover:text-text-primary';

  return (
    <div className={clsx('flex flex-wrap items-center justify-between gap-3 pt-3', className)}>
      <p className="text-[11px] text-text-tertiary tabular-nums">
        Showing <span className="font-semibold text-text-secondary">{from}–{to}</span> of{' '}
        <span className="font-semibold text-text-secondary">{total}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
            Rows
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-full border border-border-secondary bg-bg-card-nested px-2 text-xs text-text-primary focus:outline-none"
            >
              {pageSizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
        <nav className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: 'var(--bg-card-nested)' }} aria-label="Pagination">
          <button type="button" className={clsx(btn, ghost)} onClick={() => onPageChange(1)} disabled={page <= 1} aria-label="First page"><ChevronsLeft size={14} /></button>
          <button type="button" className={clsx(btn, ghost)} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={14} /></button>
          {pageWindow(page, pages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-text-tertiary">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={clsx(btn, p === page ? 'bg-crx-charcoal text-crx-charcoal-ink' : ghost)}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" className={clsx(btn, ghost)} onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label="Next page"><ChevronRight size={14} /></button>
          <button type="button" className={clsx(btn, ghost)} onClick={() => onPageChange(pages)} disabled={page >= pages} aria-label="Last page"><ChevronsRight size={14} /></button>
        </nav>
      </div>
    </div>
  );
}

/** Client-side pagination over an in-memory array. */
export function usePagination<T>(items: readonly T[], initialSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const slice = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);
  return {
    items: slice,
    page, pageSize, total, pages,
    setPage,
    props: {
      page, pageSize, total,
      onPageChange: (p: number) => setPage(Math.min(Math.max(1, p), pages)),
      onPageSizeChange: (s: number) => { setPageSize(s); setPage(1); },
    } satisfies PaginationProps,
  };
}

export default Pagination;
