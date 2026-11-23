'use client';

import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, Wallet } from 'lucide-react';
import { PanelCard } from './PanelCard';

export interface WalletSummary {
  main_wallet_balance?: number;
  main_wallet_bonus?: number;
  total_deposited?: number;
  total_withdrawn?: number;
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
    .format(Number.isFinite(n) ? n : 0);

/**
 * Main wallet — the platform's EXISTING funding hub (/wallet/summary),
 * presented in the reference's "linked account card" style. Actions are
 * the existing Deposit / Withdraw flows on /wallet.
 */
export function MainWalletCard({ summary }: { summary: WalletSummary | null }) {
  const s = summary;
  return (
    <PanelCard padding="lg" className="h-full flex flex-col">
      <div className="flex items-center justify-between">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(225, 32, 25,0.12)' }}
        >
          <Wallet size={17} className="text-[#E12019]" />
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-text-tertiary">
          Main wallet
        </span>
      </div>

      <p className="mt-4 text-2xl font-extrabold tabular-nums text-text-primary leading-none">
        {s ? fmtUsd(s.main_wallet_balance ?? 0) : '—'}
      </p>
      {(s?.main_wallet_bonus ?? 0) > 0 && (
        <p className="mt-1 text-[11px] font-semibold text-[#E12019] tabular-nums">
          + {fmtUsd(s?.main_wallet_bonus ?? 0)} bonus
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
        <div>
          <p className="text-text-tertiary">Total deposited</p>
          <p className="font-bold tabular-nums text-text-primary">{s ? fmtUsd(s.total_deposited ?? 0) : '—'}</p>
        </div>
        <div>
          <p className="text-text-tertiary">Total withdrawn</p>
          <p className="font-bold tabular-nums text-text-primary">{s ? fmtUsd(s.total_withdrawn ?? 0) : '—'}</p>
        </div>
      </div>

      <div className="mt-auto pt-5 flex gap-2">
        <Link
          href="/wallet"
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-extrabold"
          style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
        >
          <ArrowDownToLine size={12} /> Receive
        </Link>
        <Link
          href="/wallet"
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold transition-colors hover:bg-bg-hover"
          style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
        >
          <ArrowUpFromLine size={12} /> Send
        </Link>
      </div>
    </PanelCard>
  );
}
