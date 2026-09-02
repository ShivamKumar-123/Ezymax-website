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
  Bitcoin,
  Bot,
  ChevronDown,
  Copy,
  Home,
  LayoutGrid,
  Menu,
  Moon,
  Settings,
  Sun,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useShellStore } from '@/stores/shellStore';
import { useAuthStore } from '@/stores/authStore';
import { useWarmTheme } from '@/stores/warmThemeStore';
import { NotificationBell } from '@/components/NotificationListener';
import { cn } from '@/lib/utils';
import DockNav, { type DockItemSpec } from '@/components/layout/DockNav';
import { useBrandDisplay } from '@/components/providers/BrandingProvider';

/** Sun/moon toggle for the warm theme's dark variant. */
function ThemeToggle({ className }: { className?: string }) {
  const dark = useWarmTheme((s) => s.dark);
  const toggle = useWarmTheme((s) => s.toggle);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full bg-crx-pill border border-border-primary backdrop-blur text-text-primary hover:bg-bg-hover transition-colors',
        className,
      )}
    >
      {dark ? <Sun size={16} strokeWidth={1.9} /> : <Moon size={16} strokeWidth={1.9} />}
    </button>
  );
}

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  isNew?: boolean;
  /** Anchor id for the first-login feature tour (data-tour="…"). */
  tourKey?: string;
  /** Route prefix that should light this item up (defaults to `href`). */
  match?: string;
  /** When present, the item renders as a hover dropdown instead of a
   *  plain link (the `href` then points at the first/default child). */
  children?: readonly NavItem[];
  /** File download (e.g. the Android APK) — rendered as a plain <a download>
   *  so the browser saves the file instead of the router trying to navigate. */
  download?: boolean;
};

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
  // Opens the builder (chat) directly — the saved-strategies list stays
  // reachable from the builder's "All strategies" link.
  { label: 'AI Strategies', href: '/ai-strategies/new', match: '/ai-strategies', icon: Bot, isNew: true },
];

/** Dock order (lg+): primary items, then Profile — identical to the old pill. */
const DOCK_ITEMS: readonly DockItemSpec[] = [
  ...PRIMARY_ITEMS,
  { label: 'Profile', href: '/profile', icon: User },
];

/** Flattened list — used by the mobile drawer (expands dropdown children). */
const ALL_NAV: readonly NavItem[] = [
  ...PRIMARY_ITEMS.flatMap((i) => (i.children ? [...i.children] : [i])),
];

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // For root paths like /dashboard, treat sub-routes as active.
  return pathname.startsWith(`${href}/`);
}

function NewBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-crx-yellow px-1.5 py-[1px] text-[10px] font-semibold uppercase leading-none text-white">
      NEW
    </span>
  );
}

export default function AppNavbar() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const dark = useWarmTheme((s) => s.dark);
  const brand = useBrandDisplay();
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useShellStore();

  const [userMenuOpen, setUserMenuOpen] = useState(false);

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

  const avatarSrc = useMemo(() => {
    const a = (user as { avatar?: string | null } | null)?.avatar;
    return a && (a.startsWith('data:') || a.startsWith('http') || a.startsWith('/')) ? a : null;
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
      if (userRef.current && !userRef.current.contains(t)) setUserMenuOpen(false);
    };
    if (userMenuOpen) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [userMenuOpen]);

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
    <header className="sticky top-0 z-50 bg-transparent">
      <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-3 px-4 lg:px-6">
        {/* LEFT — Logo, plain on the canvas (no pill/card) */}
        <Link
          href="/dashboard"
          className="flex items-center shrink-0 gap-2"
          aria-label={`${brand.name} home`}
        >
          {brand.isWhiteLabel ? (
            /* White-label tenant: their uploaded logo, or their brand
               name as text when no logo is set. Plain <img> — tenant
               logos are served from the same-origin /api/v1 proxy. */
            brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-8 sm:h-9 w-auto max-w-[180px] object-contain"
              />
            ) : (
              <span className="font-bold tracking-tight text-lg text-text-primary select-none truncate max-w-[180px]">
                {brand.name}
              </span>
            )
          ) : (
            /* Platform lockup. The original's wordmark is black, invisible
               on the Vantablack canvas, so dark mode uses the generated
               white-text variant (same red mark, wordmark recoloured). */
            <Image
              src={dark ? '/marketing/swisscresta-logo-dark.png' : '/marketing/swisscresta-logo.png'}
              alt="SwissCresta"
              width={195}
              height={36}
              priority
              className="h-8 sm:h-9 w-auto"
            />
          )}
        </Link>

        {/* CENTER — Primary nav as a floating dock (lg+). Same slot/order as
            before; Profile rides along as the last dock item. */}
        <DockNav
          items={DOCK_ITEMS}
          pathname={pathname}
          isActive={isActive}
          className="hidden lg:flex ml-auto"
        />

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
               
                className="inline-flex items-center gap-1.5 rounded-full border border-border-primary bg-crx-pill backdrop-blur px-3 py-2 text-[12px] font-medium text-text-primary hover:bg-bg-hover transition-colors"
                aria-label="Crypto deposit"
              >
                <Bitcoin size={14} className="text-[#F7931A]" />
                <span>Crypto</span>
              </Link>

              <Link
                href="/wallet"
               
                data-tour="deposit"
                className="inline-flex items-center rounded-full bg-crx-charcoal px-4 py-2 text-[13px] font-semibold text-crx-charcoal-ink hover:bg-crx-charcoal-hover transition-colors"
              >
                Deposit
              </Link>
            </>
          )}

          {/* Theme toggle + notifications */}
          <ThemeToggle />
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-crx-pill border border-border-primary backdrop-blur text-text-primary">
            <NotificationBell />
          </div>

          {/* Avatar dropdown */}
          <div className="relative" ref={userRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-crx-pill border border-border-primary backdrop-blur p-1 hover:bg-bg-hover transition-colors"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-crx-yellow flex items-center justify-center text-[12px] font-semibold uppercase text-white">
                  {initials}
                </div>
              )}
              <ChevronDown size={14} className="text-text-secondary mr-1" />
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-[220px] rounded-2xl border border-border-primary bg-bg-glass-heavy backdrop-blur py-1 shadow-lg"
              >
                <div className="px-3 pt-2 pb-2 border-b border-border-secondary mb-1">
                  <div className="text-[13px] font-semibold text-text-primary truncate">{handle}</div>
                  {user?.email && (
                    <div className="text-[11.5px] text-text-tertiary truncate">{user.email}</div>
                  )}
                </div>
                <Link
                  href="/profile"
                 
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-3 py-2 text-[13px] text-text-primary hover:bg-bg-hover transition-colors"
                >
                  Profile &amp; Settings
                </Link>
                <Link
                  href="/wallet"
                 
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-3 py-2 text-[13px] text-text-primary hover:bg-bg-hover transition-colors"
                >
                  Wallet
                </Link>
                <Link
                  href="/kyc"
                 
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-3 py-2 text-[13px] text-text-primary hover:bg-bg-hover transition-colors"
                >
                  KYC Verification
                </Link>
                <div className="border-t border-border-secondary my-1" />
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
        <div className="flex lg:hidden items-center gap-1 ml-auto">
          <ThemeToggle className="h-9 w-9" />
          {!user?.is_demo && (
            <Link
              href="/wallet"
             
              className="inline-flex items-center rounded-full bg-crx-charcoal px-3 py-1.5 text-[12px] font-semibold text-crx-charcoal-ink"
            >
              Deposit
            </Link>
          )}
          <div className="text-text-primary">
            <NotificationBell />
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(!mobileOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-primary hover:bg-bg-hover"
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
          <div className="fixed left-0 right-0 top-[60px] z-50 max-h-[calc(100dvh-60px)] overflow-y-auto border-b border-border-primary bg-bg-glass-heavy backdrop-blur lg:hidden">
            <nav className="px-3 py-3">
              {ALL_NAV.map((item) => {
                const active = isActive(pathname, item.match ?? item.href);
                const Icon = item.icon;
                const rowCls = cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors',
                  active
                    ? 'bg-crx-yellow-soft text-text-primary'
                    : 'text-text-primary hover:bg-bg-hover',
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
                  <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={rowCls}>
                    {inner}
                  </Link>
                );
              })}
              <div className="my-3 h-px bg-border-secondary" />
              <Link
                href="/profile"
               
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-text-primary hover:bg-bg-hover"
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
