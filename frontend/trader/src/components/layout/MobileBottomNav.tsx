'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { getPersistedTradingAccountId, tradingTerminalUrl } from '@/lib/tradingNav';

/* ─── Icons ──────────────────────────────────────────────────────────────── */

const IconHome = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </svg>
);

const IconMarket = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="3" x2="5" y2="6" />
    <rect x="3.25" y="6" width="3.5" height="8" rx="0.5" />
    <line x1="5" y1="14" x2="5" y2="18" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <rect x="10.25" y="5" width="3.5" height="11" rx="0.5" />
    <line x1="12" y1="16" x2="12" y2="21" />
    <line x1="19" y1="5" x2="19" y2="8" />
    <rect x="17.25" y="8" width="3.5" height="7" rx="0.5" />
    <line x1="19" y1="15" x2="19" y2="19" />
  </svg>
);

const IconTrade = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17V5" />
    <path d="M3 9l4-4 4 4" />
    <path d="M17 7v12" />
    <path d="M13 15l4 4 4-4" />
  </svg>
);

const IconChart = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 18 7 12 11 15 15 8 21 11" />
    <line x1="3" y1="21" x2="21" y2="21" />
    <line x1="3" y1="3" x2="3" y2="21" />
  </svg>
);

const IconMore = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="8" r="1.3" fill="currentColor" />
    <circle cx="12" cy="8" r="1.3" fill="currentColor" />
    <circle cx="18.5" cy="8" r="1.3" fill="currentColor" />
    <circle cx="5.5" cy="13" r="1.3" fill="currentColor" />
    <circle cx="12" cy="13" r="1.3" fill="currentColor" />
    <circle cx="18.5" cy="13" r="1.3" fill="currentColor" />
    <circle cx="5.5" cy="18" r="1.3" fill="currentColor" />
    <circle cx="12" cy="18" r="1.3" fill="currentColor" />
    <circle cx="18.5" cy="18" r="1.3" fill="currentColor" />
  </svg>
);

/* More-sheet section items */
const SHEET_ITEMS = [
  {
    name: 'Portfolio',
    path: '/portfolio',
    color: '#00e676',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
  },
  {
    name: 'Wallet',
    path: '/wallet',
    color: '#3b82f6',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
    ),
  },
  {
    name: 'Transactions',
    path: '/transactions',
    color: '#a855f7',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
      </svg>
    ),
  },
  {
    name: 'Copy Trade',
    path: '/social',
    color: '#f59e0b',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </svg>
    ),
  },
  {
    name: 'Affiliates',
    path: '/business',
    color: '#ec4899',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    name: 'PAMM',
    path: '/pamm',
    color: '#06b6d4',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    name: 'Academy',
    path: '/academy',
    color: '#10b981',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
  },
  {
    name: 'News',
    path: '/news',
    color: '#f97316',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
      </svg>
    ),
  },
  {
    name: 'Profile',
    path: '/profile',
    color: '#8b5cf6',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    name: 'Support',
    path: '/support',
    color: '#14b8a6',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme, toggleTheme } = useUIStore();
  const logout = useAuthStore((s) => s.logout);
  const [showMore, setShowMore] = useState(false);

  const tradingAccountId = useMemo(() => {
    if (pathname?.startsWith('/trading/terminal')) return searchParams.get('account');
    return getPersistedTradingAccountId();
  }, [pathname, searchParams]);

  const navItems = useMemo(
    () => [
      { label: 'Home', href: '/accounts', view: null as string | null, icon: <IconHome /> },
      {
        label: 'Market',
        href: tradingAccountId ? tradingTerminalUrl(tradingAccountId, { view: 'watchlist' }) : '/trading',
        view: 'watchlist' as string | null,
        icon: <IconMarket />,
      },
      {
        label: 'Trade',
        href: tradingAccountId ? tradingTerminalUrl(tradingAccountId, { view: 'order' }) : '/trading',
        view: 'order' as string | null,
        icon: <IconTrade />,
      },
      {
        label: 'Chart',
        href: tradingAccountId ? tradingTerminalUrl(tradingAccountId, { view: 'chart' }) : '/trading',
        view: 'chart' as string | null,
        icon: <IconChart />,
      },
    ],
    [tradingAccountId],
  );

  const isPublicPage =
    pathname === '/' ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname === '/risk' ||
    pathname === '/about' ||
    pathname === '/contact' ||
    pathname === '/platforms' ||
    pathname === '/white-label';
  if (pathname?.startsWith('/auth') || isPublicPage) return null;

  const handleLogout = () => {
    setShowMore(false);
    logout();
    router.push('/auth/login');
  };

  const currentView = searchParams.get('view') || '';
  const isTradingArea = pathname?.startsWith('/trading');

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-[60] transition-colors duration-300"
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="relative bg-bg-primary/95 backdrop-blur-xl border-t border-white/[0.06] shadow-[0_-8px_32px_rgba(0,0,0,0.4)]">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00e676]/30 to-transparent" />

          <div className="flex items-stretch justify-around h-[60px] px-1">
            {navItems.map((item) => {
              const isActive = item.view
                ? isTradingArea &&
                  (pathname?.includes('/terminal')
                    ? currentView === item.view
                    : item.view === 'watchlist' && (pathname === '/trading' || pathname === '/trading/'))
                : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="relative flex flex-1 flex-col items-center justify-center gap-[3px] outline-none select-none"
                >
                  <span
                    className={clsx(
                      'absolute top-0 h-[3px] rounded-full transition-all duration-300',
                      isActive ? 'w-6 bg-[#00e676] shadow-[0_0_8px_rgba(0,230,118,0.8)]' : 'w-0 bg-transparent',
                    )}
                  />
                  <span
                    className={clsx(
                      'transition-all duration-300',
                      isActive
                        ? 'text-[#00e676] drop-shadow-[0_0_8px_rgba(0,230,118,0.6)] -translate-y-0.5 scale-110'
                        : 'text-white/40',
                    )}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={clsx(
                      'text-[9.5px] font-semibold tracking-wide leading-none transition-colors duration-300',
                      isActive ? 'text-[#00e676]' : 'text-white/35',
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {/* More button */}
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="relative flex flex-1 flex-col items-center justify-center gap-[3px] outline-none select-none"
            >
              <span
                className={clsx(
                  'absolute top-0 h-[3px] rounded-full transition-all duration-300',
                  showMore ? 'w-6 bg-[#00e676] shadow-[0_0_8px_rgba(0,230,118,0.8)]' : 'w-0 bg-transparent',
                )}
              />
              <span className={clsx('transition-all duration-300', showMore ? 'text-[#00e676] drop-shadow-[0_0_8px_rgba(0,230,118,0.6)] scale-110' : 'text-white/40')}>
                <IconMore />
              </span>
              <span className={clsx('text-[9.5px] font-semibold tracking-wide leading-none', showMore ? 'text-[#00e676]' : 'text-white/35')}>
                More
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── More Bottom Sheet ─────────────────────────────────────────────── */}
      {showMore && (
        <div className="fixed inset-0 z-[80] md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMore(false)}
          />

          {/* Sheet */}
          <div className="relative rounded-t-[28px] border-t border-white/[0.08] bg-[#0e0e0e] shadow-2xl animate-in slide-in-from-bottom duration-300"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-4">
              <span className="text-white font-bold text-base tracking-tight">Quick Access</span>
              <button
                onClick={() => setShowMore(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-white/60 hover:text-white transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-5 gap-y-5 gap-x-2 px-4 pb-5">
              {SHEET_ITEMS.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    router.push(item.path);
                    setShowMore(false);
                  }}
                  className="flex flex-col items-center gap-2 outline-none active:scale-95 transition-transform"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: `${item.color}18`, color: item.color, boxShadow: `0 0 0 1px ${item.color}22` }}
                  >
                    {item.icon}
                  </div>
                  <span className="text-[10px] text-white/60 font-medium leading-tight text-center">{item.name}</span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="mx-4 h-px bg-white/[0.06] mb-4" />

            {/* Theme toggle + Logout row */}
            <div className="flex gap-3 px-4 pb-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] active:scale-[0.98] transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-[#00e676]/10 flex items-center justify-center text-[#00e676]">
                  {theme === 'dark' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                  )}
                </div>
                <span className="text-white/80 text-sm font-semibold">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/[0.06] border border-red-500/[0.12] active:scale-[0.98] transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                </div>
                <span className="text-red-400 text-sm font-semibold">Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
