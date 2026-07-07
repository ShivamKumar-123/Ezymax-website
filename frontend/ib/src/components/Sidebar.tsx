'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Users, DollarSign, UserPlus, Network,
  GitBranch, CandlestickChart,
} from 'lucide-react';

export const NAV_ITEMS = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/referrals', label: 'Referrals', icon: Users },
  { href: '/commissions', label: 'Commissions', icon: DollarSign },
  { href: '/untraded', label: 'Not Traded Yet', icon: UserPlus },
  { href: '/sub-ibs', label: 'Sub-IBs', icon: Network },
  { href: '/tree', label: 'MLM Tree', icon: GitBranch },
  { href: '/trade', label: 'Trade', icon: CandlestickChart },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="px-2 pb-3 pt-1">
        <span className="text-lg font-bold tracking-tight">
          <span className="text-accent">FX</span>
          <span className="text-text-primary">Artha</span>
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">IB Portal</p>
      </div>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-l-2 border-accent bg-accent/10 text-accent'
                : 'border-l-2 border-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            )}
          >
            <Icon size={17} className="shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
