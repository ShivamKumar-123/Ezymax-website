'use client';

/**
 * AppNavbar — the top horizontal navigation for the (logged-in)
 * trader app. Replaces the legacy AppSidebar + MobileBottomNav.
 *
 * Visual language mirrors Vantage Markets:
 *   - White background, light-gray hairline bottom border
 *   - Logo on the left
 *   - Center-left primary nav (Home, Accounts, Funds, Trade, Copy
 *     Trading, Affiliates, More dropdown)
 *   - Right side: crypto pill, solid-black Deposit pill, notification
 *     bell, avatar menu
 *
 * Mobile (<lg): logo on left, hamburger on right opens a slide-down
 * drawer with the vertical list.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Bitcoin,
  ChevronDown,
  Copy,
  FileText,
  Home,
  LayoutGrid,
  LineChart,
  Menu,
  MoreHorizontal,
  Newspaper,
  Plug,
  Receipt,
  ShieldCheck,
  Settings,
  Smartphone,
  TrendingUp,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useShellStore } from '@/stores/shellStore';
import { useAuthStore } from '@/stores/authStore';
import { NotificationBell } from '@/components/NotificationListener';
import { cn } from '@/lib/utils';

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  isNew?: boolean;
  /** Anchor id for the first-login feature tour (data-tour="…"). */
  tourKey?: string;
  /** When present, the item renders as a hover dropdown instead of a
   *  plain link (the `href` then points at the first/default child). */
  children?: readonly NavItem[];
  /** File download (e.g. the Android APK) — rendered as a plain <a download>
   *  so the browser saves the file instead of the router trying to navigate. */
  download?: boolean;
};

/** Android APK served by nginx from /opt/swisscresta/downloads on the host. */
const APK_DOWNLOAD_PATH = '/downloads/SwissCresta.apk';

/** Primary horizontal nav items (visible on lg+). */
const PRIMARY_ITEMS: readonly [NavItem, ...NavItem[]] = [
  { label: 'Home', href: '/dashboard', icon: Home, tourKey: 'home' },
  { label: 'Accounts', href: '/accounts', icon: LayoutGrid, tourKey: 'accounts' },
  { label: 'Funds', href: '/wallet', icon: Wallet, tourKey: 'funds' },
  {
    label: 'Social',
    href: '/social',
    icon: Copy,
    tourKey: 'social',
    children: [
      { label: 'Copy Trading', href: '/social', icon: Copy },
      { label: 'PAMM', href: '/pamm', icon: TrendingUp },
    ],
  },
  { label: 'Affiliates', href: '/business', icon: Users, tourKey: 'affiliates' },
];

/** Secondary nav items (live under the "More" dropdown on lg+). */
const MORE_ITEMS: readonly [NavItem, ...NavItem[]] = [
  { label: 'Trade', href: '/trading', icon: LineChart },
  { label: 'Portfolio', href: '/portfolio', icon: Receipt },
  { label: 'Economic News', href: '/news', icon: Newspaper },
  { label: 'Risk Management', href: '/risk-calculator', icon: LineChart },
  { label: 'Algo Connector', href: '/algo-connector', icon: Plug, isNew: true },
  { label: 'KYC', href: '/kyc', icon: ShieldCheck },
  { label: 'Terms', href: '/terms', icon: FileText },
  { label: 'Download Android App', href: APK_DOWNLOAD_PATH, icon: Smartphone, isNew: true, download: true },
];

/** Flattened list — used by the mobile drawer (expands dropdown children). */
const ALL_NAV: readonly NavItem[] = [
  ...PRIMARY_ITEMS.flatMap((i) => (i.children ? [...i.children] : [i])),
  ...MORE_ITEMS,
];

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // For root paths like /dashboard, treat sub-routes as active.
  return pathname.startsWith(`${href}/`);
}

function NewBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-[#E94E1B] px-1.5 py-[1px] text-[10px] font-semibold uppercase leading-none text-white">
      NEW
    </span>
  );
}

export default function AppNavbar() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useShellStore();

  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const moreRef = useRef<HTMLDivElement | null>(null);
  const userRef = useRef<HTMLDivElement | null>(null);

  // Reuse `sidebarOpen` from shellStore as the mobile drawer flag —
  // legacy stores already toggle it; renaming it everywhere would be
  // out of scope for this redesign.
  const mobileOpen = sidebarOpen;

  const handle = useMemo(() => {
    if (user?.first_name) return [user.first_name, user.last_name].filter(Boolean).join(' ');
    if (user?.email) return user.email.split('@')[0] ?? 'Trader';
    return 'Trader';
  }, [user]);

  const initials = useMemo(() => {
    if (!user) return 'U';
    if (user.first_name?.[0] && user.last_name?.[0]) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return (user.first_name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase();
  }, [user]);

  // Click-outside handlers for dropdowns
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false);
      if (userRef.current && !userRef.current.contains(t)) setUserMenuOpen(false);
    };
    if (moreOpen || userMenuOpen) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [moreOpen, userMenuOpen]);

  // Close mobile drawer on route change
  useEffect(() => {
    setSidebarOpen(false);
    // Only close on actual route changes, not on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const onSignOut = () => {
    setUserMenuOpen(false);
    logout();
    router.push('/auth/login');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#E5E5E5] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[60px] max-w-[1400px] items-center px-4 lg:px-6">
        {/* LEFT — Logo (same PNG as the marketing navbar) */}
        <Link href="/dashboard" className="flex items-center shrink-0" aria-label="SwissCresta home">
          <Image
            src="/marketing/swisscresta-logo.png"
            alt="SwissCresta"
            width={200}
            height={44}
            priority
            className="h-9 w-auto"
          />
        </Link>

        {/* CENTER — Primary nav (lg+) */}
        <nav className="hidden lg:flex items-center gap-1 ml-8">
          {PRIMARY_ITEMS.map((item) => {
            // Hover dropdown (e.g. Social → Copy Trading / PAMM)
            if (item.children) {
              const groupActive = item.children.some((c) => isActive(pathname, c.href));
              return (
                <div key={item.label} className="relative group">
                  <button
                    type="button"
                    data-tour={item.tourKey}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors',
                      groupActive ? 'bg-[#FCE6DD] text-[#E94E1B]' : 'text-[#0A0A0A] hover:bg-[#F5F5F5]',
                    )}
                    aria-haspopup="menu"
                  >
                    <span>{item.label}</span>
                    <ChevronDown size={14} className="transition-transform group-hover:rotate-180" />
                  </button>
                  {/* pt-2 keeps a hover bridge so the menu doesn't close in the gap */}
                  <div className="absolute left-0 top-full pt-2 hidden group-hover:block">
                    <div className="min-w-[200px] rounded-xl border border-[#E5E5E5] bg-white p-1.5 shadow-xl ring-1 ring-black/5">
                      {item.children.map((child) => {
                        const childActive = isActive(pathname, child.href);
                        const ChildIcon = child.icon;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            prefetch={false}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                              childActive ? 'bg-[#FCE6DD] text-[#E94E1B]' : 'text-[#0A0A0A] hover:bg-[#F5F5F5]',
                            )}
                          >
                            <ChildIcon size={16} strokeWidth={1.9} />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                data-tour={item.tourKey}
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors',
                  active
                    ? 'bg-[#FCE6DD] text-[#E94E1B]'
                    : 'text-[#0A0A0A] hover:bg-[#F5F5F5]',
                )}
              >
                <span>{item.label}</span>
                {item.isNew && <NewBadge />}
              </Link>
            );
          })}

          {/* MORE dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors',
                MORE_ITEMS.some((i) => isActive(pathname, i.href))
                  ? 'bg-[#FCE6DD] text-[#E94E1B]'
                  : 'text-[#0A0A0A] hover:bg-[#F5F5F5]',
              )}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal size={16} strokeWidth={2} />
              <span>More</span>
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-[520px] rounded-2xl border border-[#E5E5E5] bg-white p-3 shadow-xl ring-1 ring-black/5"
              >
                <div className="grid grid-cols-2 gap-1">
                  {MORE_ITEMS.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    const rowCls = cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-[#FCE6DD] text-[#E94E1B]'
                        : 'text-[#0A0A0A] hover:bg-[#F5F5F5]',
                    );
                    const inner = (
                      <>
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                            active ? 'bg-[#E94E1B] text-white' : 'bg-[#F5F5F5] text-[#0A0A0A]',
                          )}
                        >
                          <Icon size={17} strokeWidth={1.9} />
                        </span>
                        <span className="truncate">{item.label}</span>
                        {item.isNew && <NewBadge />}
                      </>
                    );
                    // File downloads bypass the Next router — a plain anchor
                    // lets the browser save the file (APK) directly.
                    return item.download ? (
                      <a key={item.href} href={item.href} download onClick={() => setMoreOpen(false)} className={rowCls}>
                        {inner}
                      </a>
                    ) : (
                      <Link key={item.href} href={item.href} prefetch={false} onClick={() => setMoreOpen(false)} className={rowCls}>
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* SPACER */}
        <div className="flex-1" />

        {/* RIGHT — actions (lg+) */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Crypto + Deposit pills are hidden for try-with-demo users —
              demo accounts run on play money so funding doesn't apply,
              and clicking either would just bounce them to the
              DemoLockGate on /wallet anyway. */}
          {!user?.is_demo && (
            <>
              <Link
                href="/wallet"
                prefetch={false}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-[12px] font-medium text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
                aria-label="Crypto deposit"
              >
                <Bitcoin size={14} className="text-[#F7931A]" />
                <span>Crypto</span>
              </Link>

              <Link
                href="/wallet"
                prefetch={false}
                data-tour="deposit"
                className="inline-flex items-center rounded-full bg-[#0A0A0A] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#222] transition-colors"
              >
                Deposit
              </Link>
            </>
          )}

          {/* Notifications */}
          <div className="text-[#0A0A0A]">
            <NotificationBell />
          </div>

          {/* Avatar dropdown */}
          <div className="relative" ref={userRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full p-0.5 hover:bg-[#F5F5F5] transition-colors"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <div className="h-8 w-8 rounded-full bg-[#FCE6DD] border border-[#E94E1B]/30 flex items-center justify-center text-[12px] font-bold uppercase text-[#E94E1B]">
                {initials}
              </div>
              <ChevronDown size={14} className="text-[#5B5B5B] mr-1" />
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-[220px] rounded-xl border border-[#E5E5E5] bg-white py-1 shadow-lg"
              >
                <div className="px-3 pt-2 pb-2 border-b border-[#EDEDED] mb-1">
                  <div className="text-[13px] font-semibold text-[#0A0A0A] truncate">{handle}</div>
                  {user?.email && (
                    <div className="text-[11.5px] text-[#9A9A9A] truncate">{user.email}</div>
                  )}
                </div>
                <Link
                  href="/profile"
                  prefetch={false}
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-3 py-2 text-[13px] text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
                >
                  Profile &amp; Settings
                </Link>
                <Link
                  href="/wallet"
                  prefetch={false}
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-3 py-2 text-[13px] text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
                >
                  Wallet
                </Link>
                <Link
                  href="/kyc"
                  prefetch={false}
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-3 py-2 text-[13px] text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
                >
                  KYC Verification
                </Link>
                <div className="border-t border-[#EDEDED] my-1" />
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full text-left px-3 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEE2E2]/50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — mobile (lg-) */}
        <div className="flex lg:hidden items-center gap-1">
          {!user?.is_demo && (
            <Link
              href="/wallet"
              prefetch={false}
              className="inline-flex items-center rounded-full bg-[#0A0A0A] px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              Deposit
            </Link>
          )}
          <div className="text-[#0A0A0A]">
            <NotificationBell />
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(!mobileOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#0A0A0A] hover:bg-[#F5F5F5]"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 top-[60px] z-40 bg-black/30 lg:hidden"
            aria-hidden
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed left-0 right-0 top-[60px] z-50 max-h-[calc(100dvh-60px)] overflow-y-auto border-b border-[#E5E5E5] bg-white lg:hidden">
            <nav className="px-3 py-3">
              {ALL_NAV.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                const rowCls = cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors',
                  active
                    ? 'bg-[#FCE6DD] text-[#E94E1B]'
                    : 'text-[#0A0A0A] hover:bg-[#F5F5F5]',
                );
                const inner = (
                  <>
                    <Icon size={18} strokeWidth={1.85} className="shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.isNew && <NewBadge />}
                  </>
                );
                return item.download ? (
                  <a key={item.href} href={item.href} download onClick={() => setSidebarOpen(false)} className={rowCls}>
                    {inner}
                  </a>
                ) : (
                  <Link key={item.href} href={item.href} prefetch={false} onClick={() => setSidebarOpen(false)} className={rowCls}>
                    {inner}
                  </Link>
                );
              })}
              <div className="my-3 h-px bg-[#EDEDED]" />
              <Link
                href="/profile"
                prefetch={false}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#0A0A0A] hover:bg-[#F5F5F5]"
              >
                <Settings size={18} strokeWidth={1.85} />
                <span>Profile &amp; Settings</span>
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#DC2626] hover:bg-[#FEE2E2]/50"
              >
                Sign Out
              </button>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
