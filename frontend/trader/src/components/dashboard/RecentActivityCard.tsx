'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRight,
  Repeat,
} from 'lucide-react';

/**
 * The last few wallet movements, in the shape of the reference layout's
 * transactions list: a round icon, the description over a date, the amount
 * right-aligned.
 *
 * Signed by direction rather than by the ledger's sign, because a withdrawal
 * and a deposit are both stored positive — reading the type is the only way
 * to know which way the money went.
 */

export interface ActivityRow {
  id: string;
  type: string;
  description?: string;
  amount: number;
  createdAt: string | null;
  status: string;
}

const OUTBOUND = new Set(['withdrawal', 'withdraw', 'transfer_out', 'fee']);

function icon(type: string) {
  const t = type.toLowerCase();
  if (OUTBOUND.has(t)) return ArrowUpFromLine;
  if (t.includes('transfer')) return Repeat;
  return ArrowDownToLine;
}

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function RecentActivityCard({
  rows,
  loading,
  fmt,
}: {
  rows: ActivityRow[];
  loading?: boolean;
  fmt: (n: number) => string;
}) {
  const router = useRouter();

  return (
    <div
      className="flex h-full flex-col lg-surface p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">
          Last transactions
        </p>
        <button
          type="button"
          onClick={() => router.push('/transactions')}
          className="inline-flex items-center gap-1 text-[11px] text-text-tertiary transition-colors hover:text-[#FF6A00]"
        >
          All <ArrowRight size={12} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="lg-surface-raised h-12 animate-pulse"
              
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
          No movements yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => {
            const Icon = icon(row.type);
            const out = OUTBOUND.has(row.type.toLowerCase());
            return (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-xl px-1 py-2"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full"
                  style={{
                    background: out
                      ? 'rgba(255,106,0,0.12)'
                      : 'rgba(34,197,94,0.12)',
                    color: out ? '#FF6A00' : '#22c55e',
                  }}
                >
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text-primary capitalize">
                    {row.description || row.type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    {when(row.createdAt)}
                    {row.status && row.status !== 'completed'
                      ? ` · ${row.status}`
                      : ''}
                  </p>
                </div>
                <span
                  className="shrink-0 text-[13px] font-semibold tabular-nums"
                  style={{ color: out ? 'var(--text-primary)' : '#22c55e' }}
                >
                  {out ? '−' : '+'}
                  {fmt(Math.abs(row.amount))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
