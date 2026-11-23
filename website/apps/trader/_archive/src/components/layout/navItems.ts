import { BRAND_NAME } from '@/lib/brand';
import {
  Home, LayoutGrid, Wallet, History, TrendingUp, Copy, Users,
  GraduationCap, Newspaper, ShieldCheck, Settings, Receipt,
  Calculator,
} from 'lucide-react';

export type LeafItem = { label: string; href: string; icon: any };
export type GroupItem = { label: string; icon: any; key: string; children: LeafItem[] };
export type NavEntry = LeafItem | GroupItem;

/**
 * Single source of truth for the authenticated app's navigation.
 * Consumed by TopNavMenu (the header hamburger's slide-down panel).
 */
export const NAV_ITEMS: NavEntry[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Accounts', href: '/accounts', icon: LayoutGrid },
  { label: 'Deposit/Withdraw', href: '/wallet', icon: Wallet },
  { label: 'Transactions', href: '/transactions', icon: History },
  { label: 'Portfolio', href: '/portfolio', icon: Receipt },
  { label: 'Referral', href: '/referral', icon: Users },
  { label: 'Trade Insurance', href: '/insurance', icon: ShieldCheck },
  { label: 'PAMM', href: '/pamm', icon: TrendingUp },
  { label: 'MAMM', href: '/social', icon: Copy },
  { label: 'Affiliates', href: '/business', icon: Users },
  { label: `${BRAND_NAME} Academy`, href: '/academy', icon: GraduationCap },
  { label: 'Economic News', href: '/news', icon: Newspaper },
  { label: 'Risk Management', href: '/risk-calculator', icon: Calculator },
  { label: 'KYC', href: '/kyc', icon: ShieldCheck },
  { label: 'Settings', href: '/profile', icon: Settings },
];

export function isGroup(e: NavEntry): e is GroupItem {
  return (e as GroupItem).children !== undefined;
}

/** Flatten groups into their leaf children — used by the top menu grid. */
export function flattenNav(entries: NavEntry[]): LeafItem[] {
  const out: LeafItem[] = [];
  for (const e of entries) {
    if (isGroup(e)) out.push(...e.children);
    else out.push(e);
  }
  return out;
}
