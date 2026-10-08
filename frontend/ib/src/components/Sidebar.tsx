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
  // Dark in both themes: the wordmark is a glow render and only reads on a
  // dark ground, and the reference layout keeps its rail dark against a
  // light page too.
  return (
    <nav className="flex h-full flex-col gap-1.5 bg-[#0b0908] p-3 text-[#f3efe9]">
      {/* Brand */}
      <div className="mb-3 flex items-center gap-2.5 px-2 pt-2">
        <div className="min-w-0">
          <img
            src="/logo.png"
            alt="Ezymex"
            className="h-7 w-auto object-contain"
          />
          <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-text-tertiary">IB Portal</p>
        </div>
      </div>

      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={clsx(
              'group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-semibold transition-all duration-200',
              active ? 'text-black' : 'text-text-secondary hover:bg-white/[0.045] hover:text-text-primary',
            )}
            style={active ? {
              background: 'linear-gradient(90deg, #FF6A00 0%, #C2410C 100%)',
              boxShadow: '0 8px 20px -8px rgba(255,106,0,0.55)',
            } : undefined}
          >
            <span
              className={clsx(
                'grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors',
                active ? 'bg-black/15' : 'bg-white/[0.045] group-hover:bg-accent/10',
              )}
            >
              <Icon size={16} className={clsx('shrink-0', active ? 'text-black' : 'text-text-tertiary group-hover:text-accent')} />
            </span>
            <span className="truncate">{label}</span>
          </Link>
        );
      })}

      <div className="mt-auto px-2 pb-1 pt-4">
        <p className="text-[10px] leading-relaxed text-text-tertiary">
          Your dedicated partner console.
        </p>
      </div>
    </nav>
  );
}
