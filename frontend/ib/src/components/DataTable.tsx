'use client';

import { clsx } from 'clsx';

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
}

export default function DataTable<T extends { id?: string | number }>({
  columns,
  rows,
  loading,
  empty = 'No data.',
  onRowClick,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  empty?: string;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T, i: number) => string | number;
}) {
  if (loading) {
    return <p className="px-5 py-10 text-center text-xs text-text-tertiary">Loading…</p>;
  }
  if (!rows.length) {
    return <p className="px-5 py-10 text-center text-xs text-text-tertiary">{empty}</p>;
  }
  const alignCls = (a?: string) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  return (
    <div className="-mx-1 overflow-x-auto sm:mx-0">
    <table className="w-full min-w-[560px] text-xs">
      <thead>
        <tr className="border-b border-border-primary text-[10px] uppercase tracking-wide text-text-tertiary">
          {columns.map((c) => (
            <th key={c.key} className={clsx('px-4 py-2.5', alignCls(c.align))}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={rowKey ? rowKey(row, i) : (row.id ?? i)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={clsx(
              'border-b border-border-primary/50',
              onRowClick ? 'cursor-pointer hover:bg-bg-hover/40' : 'hover:bg-bg-hover/20',
            )}
          >
            {columns.map((c) => (
              <td key={c.key} className={clsx('px-4 py-2.5', alignCls(c.align))}>
                {c.render ? c.render(row) : (row as any)[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
