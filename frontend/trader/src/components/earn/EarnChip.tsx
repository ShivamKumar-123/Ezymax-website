'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Coins as CoinIcon } from 'lucide-react';
import api from '@/lib/api/client';

type RewardsState = {
  level: number;
  level_label: string;
  xp: number;
  ac_balance: number;
  ps: number;
  ps_rank: string;
  streak_count?: number;
};

function formatCompact(n: number) {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return Math.round(n).toString();
}

/** Topbar chip showing total XP + AC balance + level/rank, links to /earn/tasks. */
export default function EarnChip() {
  const [s, setS] = useState<RewardsState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await api.get<RewardsState>('/rewards/state');
        if (!cancelled) setS(r);
      } catch { /* silent — chip just hides numbers */ }
    };
    void fetchOnce();
    const t = setInterval(fetchOnce, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return (
    <Link
      href="/earn/tasks"
      className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full border border-[#d6a93d]/25 bg-[#d6a93d]/5 hover:bg-[#d6a93d]/10 transition-colors"
      title={s ? `${s.level_label} • ${s.ps_rank}` : 'Earn'}
    >
      <Sparkles size={13} className="text-[#d6a93d] shrink-0" />
      <span className="text-[12px] font-medium text-text-primary tabular-nums">
        {s ? formatCompact(s.xp) : '—'}
      </span>
      <span className="text-[11px] text-text-tertiary">XP</span>
      <span className="w-px h-3 bg-border-primary mx-0.5" />
      <CoinIcon size={13} className="text-[#d6a93d] shrink-0" />
      <span className="text-[12px] font-medium text-text-primary tabular-nums">
        {s ? formatCompact(s.ac_balance) : '—'}
      </span>
    </Link>
  );
}
