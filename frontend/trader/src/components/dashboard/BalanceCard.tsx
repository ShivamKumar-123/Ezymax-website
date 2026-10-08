'use client';

import { ArrowDownToLine, ArrowUpFromLine, Wifi } from 'lucide-react';

/**
 * The account rendered as a payment card, in the shape the reference layout
 * uses for its balance panel: a tall card with the number across the middle,
 * the holder and a validity row along the bottom, and the two money actions
 * sitting under it.
 *
 * It replaced a looping promo video, which took the most valuable slot on the
 * dashboard and told the account holder nothing about their account.
 *
 * The "card number" is the trading account number, grouped in fours so it
 * reads like one — it is not a card number and there is none to show, so
 * nothing here is styled to suggest a PAN that could be typed somewhere.
 */

function groupAccountNumber(n: string): string {
  const digits = (n || '').replace(/\s+/g, '');
  return digits.replace(/(.{4})/g, '$1 ').trim() || '————';
}

export function BalanceCard({
  accountNumber,
  holder,
  balance,
  equity,
  isDemo,
  currency = 'USD',
  onDeposit,
  onWithdraw,
  fmt,
}: {
  accountNumber: string;
  holder: string;
  balance: number;
  equity: number;
  isDemo: boolean;
  currency?: string;
  onDeposit: () => void;
  onWithdraw: () => void;
  fmt: (n: number) => string;
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div
        className="relative flex-1 overflow-hidden rounded-2xl p-5"
        style={{
          background:
            'linear-gradient(135deg, #2a1206 0%, #140a04 45%, #0b0705 100%)',
          border: '1px solid rgba(255,106,0,0.28)',
        }}
      >
        {/* The soft sheen a physical card catches. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(255,106,0,0.30), transparent 65%)',
          }}
        />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[11px] tracking-wide text-text-tertiary uppercase">
              {isDemo ? 'Demo balance' : 'Available balance'}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-text-primary">
              {fmt(balance)}
            </p>
          </div>
          <Wifi size={18} className="rotate-90 text-[#FF6A00]/70" />
        </div>

        {/* The chip, because a card without one does not read as a card. */}
        <div
          aria-hidden
          className="relative mt-6 h-8 w-11 rounded-md"
          style={{
            background: 'linear-gradient(135deg, #f0b67a, #c57a2e 60%, #8a4d16)',
          }}
        />

        <p className="relative mt-5 font-mono text-base tracking-[0.22em] text-text-secondary">
          {groupAccountNumber(accountNumber)}
        </p>

        <div className="relative mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] tracking-wide text-text-tertiary uppercase">
              Account holder
            </p>
            <p className="truncate text-sm font-medium text-text-primary">
              {holder || '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-wide text-text-tertiary uppercase">
              Equity
            </p>
            <p className="text-sm font-semibold tabular-nums text-text-primary">
              {fmt(equity)}
            </p>
          </div>
          <span
            className="rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide"
            style={{
              background: 'rgba(255,106,0,0.14)',
              color: '#FF6A00',
            }}
          >
            {currency}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onDeposit}
          className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-transform active:scale-[0.98]"
          style={{ background: '#FF6A00', color: '#0a0705' }}
        >
          <ArrowDownToLine size={16} /> Deposit
        </button>
        <button
          type="button"
          onClick={onWithdraw}
          className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-text-primary transition-colors"
          style={{
            background: 'var(--bg-card-nested)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <ArrowUpFromLine size={16} /> Withdraw
        </button>
      </div>
    </div>
  );
}
