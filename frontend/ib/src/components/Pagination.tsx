'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) {
    return (
      <div className="flex items-center justify-end px-4 py-3 text-[11px] text-text-tertiary">
        {total} total
      </div>
    );
  }
  const btn =
    'grid h-7 w-7 place-items-center rounded-lg border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-[11px] text-text-tertiary">{total} total</span>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={14} />
        </button>
        <span className="text-[11px] font-medium text-text-secondary">
          Page {page} / {pages}
        </span>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
