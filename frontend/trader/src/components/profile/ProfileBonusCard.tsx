'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gift, ArrowRight, Info } from 'lucide-react';
import api from '@/lib/api/client';

/**
 * Bonus Wallet card for the profile — a wallet-like section where bonus money
 * lives. Bonus is non-withdrawable "credit": the user transfers it into a
 * trading account (Accounts → Internal Transfer → Bonus Wallet), it counts
 * toward margin, and is consumed before real balance on losses.
 */
export default function ProfileBonusCard() {
  const [bonus, setBonus] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<{ bonus_balance?: number }>('/wallet/summary')
      .then((s) => setBonus(Number(s.bonus_balance) || 0))
      .catch(() => setBonus(0));
  }, []);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5"
      style={{
        background: 'radial-gradient(120% 90% at 85% -10%, rgba(204,255,0,0.08), transparent 55%), var(--bg-card)',
        borderColor: 'rgba(204,255,0,0.18)',
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent" aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid size-11 place-items-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, #eaff8a, #ccff00 60%, #a6d600)', color: '#0a0a0a', boxShadow: '0 8px 20px rgba(204,255,0,0.3)' }}
          >
            <Gift size={20} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Bonus Wallet</p>
            <p className="text-2xl font-extrabold tabular-nums text-text-primary">
              ${bonus === null ? '—' : fmt(bonus)}
            </p>
          </div>
        </div>
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-transform hover:brightness-105 active:scale-[0.98]"
          style={{ background: '#ccff00', color: '#0a0a0a' }}
        >
          Transfer to account <ArrowRight size={15} />
        </Link>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-accent/20 bg-accent/[0.05] p-3 text-[11px] leading-relaxed text-text-secondary">
        <Info size={14} className="mt-0.5 shrink-0 text-accent" />
        <span>
          Bonus is <span className="font-semibold text-text-primary">credit, not cash</span> — move it into a trading
          account to trade with it. It&apos;s used <span className="font-semibold text-text-primary">before your real
          balance</span> on losses, and <span className="font-semibold text-text-primary">can&apos;t be withdrawn</span>.
        </span>
      </div>
    </div>
  );
}
