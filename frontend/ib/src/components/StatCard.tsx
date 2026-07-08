'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import {
  DollarSign, TrendingUp, Clock, Users, UserPlus, Network as NetworkIcon, Award,
} from 'lucide-react';

const STAT_ICONS: Record<string, any> = {
  'Total Commission': DollarSign,
  'Total Earned': TrendingUp,
  'Pending Payout': Clock,
  'Referrals': Users,
  'No Trade Yet': UserPlus,
  'Sub-IBs': NetworkIcon,
  'Level': Award,
};

export interface StatCardProps {
  label: string;
  value: string;
  color?: string;
  href?: string;
}

export default function StatCard({ label, value, color = 'text-text-primary', href }: StatCardProps) {
  const Icon = STAT_ICONS[label] || DollarSign;
  const body = (
    <div className="relative h-full overflow-hidden rounded-2xl border border-border-primary bg-card p-4 sm:p-5 noise-texture transition-transform hover:scale-[1.015]">
      <div className="absolute top-0 right-0 h-16 w-16 rounded-bl-[40px] bg-accent/[0.05] pointer-events-none" />
      <div className="relative flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/25 bg-accent/10">
          <Icon size={18} className="text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">{label}</p>
          <p className={clsx('mt-0.5 truncate font-mono text-lg sm:text-xl font-bold tabular-nums', color)}>{value}</p>
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
