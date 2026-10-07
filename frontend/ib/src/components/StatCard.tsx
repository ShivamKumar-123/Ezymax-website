'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import {
  DollarSign, TrendingUp, Clock, Users, UserPlus, Network as NetworkIcon, Award,
  ArrowUpRight,
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

export type StatVariant = 'lime' | 'green' | 'amber' | 'blue' | 'purple' | 'neutral';

// Each variant maps to the theme-aware gradient card tokens in globals.css
// (--card-*), except `lime` which is the brand accent (no --card-lime token).
const VARIANTS: Record<StatVariant, { bg: string; border: string; iconBg: string; iconBorder: string; icon: string; blob: string }> = {
  lime:    { bg: 'linear-gradient(135deg, rgba(30,136,255,0.13) 0%, rgba(30,136,255,0.03) 60%, transparent 100%)', border: 'rgba(30,136,255,0.30)', iconBg: 'rgba(30,136,255,0.14)', iconBorder: 'rgba(30,136,255,0.32)', icon: '#1E88FF', blob: 'rgba(30,136,255,0.22)' },
  green:   { bg: 'var(--card-green-bg)',  border: 'var(--card-green-border)',  iconBg: 'var(--card-green-icon-bg)',  iconBorder: 'var(--card-green-icon-border)',  icon: 'var(--card-green-icon)',  blob: 'var(--card-green-icon-bg)' },
  amber:   { bg: 'var(--card-amber-bg)',  border: 'var(--card-amber-border)',  iconBg: 'var(--card-amber-icon-bg)',  iconBorder: 'var(--card-amber-icon-border)',  icon: 'var(--card-amber-icon)',  blob: 'var(--card-amber-icon-bg)' },
  blue:    { bg: 'var(--card-blue-bg)',   border: 'var(--card-blue-border)',   iconBg: 'var(--card-blue-icon-bg)',   iconBorder: 'var(--card-blue-icon-border)',   icon: 'var(--card-blue-icon)',   blob: 'var(--card-blue-icon-bg)' },
  purple:  { bg: 'var(--card-purple-bg)', border: 'var(--card-purple-border)', iconBg: 'var(--card-purple-icon-bg)', iconBorder: 'var(--card-purple-icon-border)', icon: 'var(--card-purple-icon)', blob: 'var(--card-purple-icon-bg)' },
  neutral: { bg: 'var(--bg-card)',        border: 'var(--border-primary)',     iconBg: 'rgba(255,255,255,0.05)',     iconBorder: 'var(--border-primary)',        icon: 'var(--text-secondary)',   blob: 'rgba(255,255,255,0.05)' },
};

export interface StatCardProps {
  label: string;
  value: string;
  color?: string;
  href?: string;
  variant?: StatVariant;
  sub?: string;
}

export default function StatCard({ label, value, href, variant = 'lime', sub }: StatCardProps) {
  const Icon = STAT_ICONS[label] || DollarSign;
  const v = VARIANTS[variant];
  const body = (
    <div
      className="group relative h-full overflow-hidden rounded-2xl p-4 sm:p-5 transition-all duration-300 hover:-translate-y-1"
      style={{ background: v.bg, border: `1px solid ${v.border}`, boxShadow: '0 12px 30px -14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)' }}
    >
      {/* Soft glow blob — brightens on hover for an eye-catching lift. */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-40 blur-2xl transition-opacity duration-300 group-hover:opacity-80"
        style={{ background: v.blob }}
        aria-hidden
      />
      {href && (
        <ArrowUpRight
          size={15}
          className="pointer-events-none absolute right-3 top-3 text-text-tertiary opacity-0 transition-all duration-300 group-hover:opacity-70 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          aria-hidden
        />
      )}
      <div className="relative">
        <div
          className="mb-3 grid h-11 w-11 place-items-center rounded-xl"
          style={{ background: v.iconBg, border: `1px solid ${v.iconBorder}` }}
        >
          <Icon size={19} style={{ color: v.icon }} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">{label}</p>
        <p className="mt-1 truncate font-mono text-2xl font-bold tabular-nums text-text-primary sm:text-[26px]">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-text-tertiary">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
