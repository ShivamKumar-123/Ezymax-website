'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export interface FilterState {
  search?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  traded?: string; // 'all' | 'true' | 'false'
}

export default function Filters({
  value,
  onChange,
  showSearch = true,
  showDates = true,
  showStatus = false,
  showTraded = false,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  showSearch?: boolean;
  showDates?: boolean;
  showStatus?: boolean;
  showTraded?: boolean;
}) {
  const [search, setSearch] = useState(value.search || '');

  // debounce search → onChange
  useEffect(() => {
    const t = setTimeout(() => {
      if ((value.search || '') !== search) onChange({ ...value, search });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // NOTE: globals.css sets `input,select,textarea { width:100% }`, so every
  // control needs an explicit width class (a class beats the element selector)
  // to stay compact and sit inline instead of stretching full-width.
  const inputCls =
    'rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-xs text-text-primary outline-none focus:border-accent/50';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showSearch && (
        <div className="relative w-full sm:w-60">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name / email"
            className={`${inputCls} w-full pl-7`}
          />
        </div>
      )}
      {showDates && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.date_from || ''}
            onChange={(e) => onChange({ ...value, date_from: e.target.value })}
            className={`${inputCls} w-[9.5rem] shrink-0`}
            aria-label="From date"
          />
          <span className="text-xs text-text-tertiary">–</span>
          <input
            type="date"
            value={value.date_to || ''}
            onChange={(e) => onChange({ ...value, date_to: e.target.value })}
            className={`${inputCls} w-[9.5rem] shrink-0`}
            aria-label="To date"
          />
        </div>
      )}
      {showStatus && (
        <select
          value={value.status || ''}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
          className={`${inputCls} w-auto`}
        >
          <option value="">All status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      )}
      {showTraded && (
        <select
          value={value.traded || 'all'}
          onChange={(e) => onChange({ ...value, traded: e.target.value })}
          className={`${inputCls} w-auto`}
        >
          <option value="all">All users</option>
          <option value="true">Traded</option>
          <option value="false">Not traded</option>
        </select>
      )}
    </div>
  );
}
