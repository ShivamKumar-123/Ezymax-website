'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { getPersistedTradingAccountId, tradingTerminalUrl } from '@/lib/tradingNav';

/* ─── Icons ─── */

const IconHome = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    {!active && <polyline points="9 22 9 12 15 12 15 22" />}
  </svg>
);

const IconMarket = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="3" x2="5" y2="6" /><rect x="3.25" y="6" width="3.5" height="8" rx="0.5" />
    <line x1="5" y1="14" x2="5" y2="18" /><line x1="12" y1="2" x2="12" y2="5" />
    <rect x="10.25" y="5" width="3.5" height="11" rx="0.5" /><line x1="12" y1="16" x2="12" y2="21" />
    <line x1="19" y1="5" x2="19" y2="8" /><rect x="17.25" y="8" width="3.5" height="7" rx="0.5" />
    <line x1="19" y1="15" x2="19" y2="19" />
  </svg>
);

const IconChart = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const IconOrders = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

const IconMore = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

/* More-sheet items */
const SHEET_ITEMS = [
  { name: 'Deposit', path: '/wallet', color: '#00e676', icon: '💰' },
  { name: 'Wallet', path: '/wallet', color: '#3b82f6', icon: '💳' },
  { name: 'Portfolio', path: '/portfolio', color: '#8b5cf6', icon: '📊' },
  { name: 'Copy Trade', path: '/social', color: '#f59e0b', icon: '📋' },
  { name: 'Affiliates', path: '/business', color: '#ec4899', icon: '👥' },
  { name: 'PAMM', path: '/pamm', color: '#06b6d4', icon: '📈' },
  { name: 'History', path: '/transactions', color: '#a855f7', icon: '🔄' },
  { name: 'News', path: '/news', color: '#f97316', icon: '📰' },
  { name: 'Profile', path: '/profile', color: '#8b5cf6', icon: '👤' },
  { name: 'Support', path: '/support', color: '#14b8a6', icon: '💬' },
];

/* ─── Component ─── */

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

  const isPublicPage =
    pathname === '/' || pathname === '/privacy' || pathname === '/terms' ||
    pathname === '/risk' || pathname === '/about' || pathname === '/contact' ||
    pathname === '/platforms' || pathname === '/white-label';
  if (pathname?.startsWith('/auth') || isPublicPage) return null;

  const currentView = searchParams.get('view') || '';
  const isTradingArea = pathname?.startsWith('/trading');
  const chartHref = tradingAccountId
    ? tradingTerminalUrl(tradingAccountId, { view: 'chart' })
    : '/trading';
  const marketHref = tradingAccountId
    ? tradingTerminalUrl(tradingAccountId, { view: 'watchlist' })
    : '/trading';
  const ordersHref = tradingAccountId
    ? tradingTerminalUrl(tradingAccountId, { view: 'order' })
    : '/trading';

  const isHome = pathname === '/accounts' || pathname === '/dashboard';
  const isMarket = isTradingArea && (currentView === 'watchlist' || (!currentView && pathname === '/trading'));
  const isChart = isTradingArea && (currentView === 'chart' || (pathname?.includes('/terminal') && !currentView));
  const isOrders = isTradingArea && currentView === 'order';

  const handleLogout = () => { setShowMore(false); logout(); router.push('/auth/login'); };

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[60]"
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="relative" style={{ background: '#0a0a0a' }}>
          {/* Top border glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00e676]/20 to-transparent" />

          <div className="flex items-end justify-around h-[62px] px-1">
            {/* Home */}
            <Link href="/accounts" className="flex flex-col items-center justify-center gap-[2px] flex-1 py-2">
              <span className={clsx('transition-colors', isHome ? 'text-[#00e676]' : 'text-white/40')}>
                <IconHome active={isHome} />
              </span>
              <span className={clsx('text-[10px] font-semibold', isHome ? 'text-[#00e676]' : 'text-white/40')}>Home</span>
            </Link>

            {/* Market */}
            <Link href={marketHref} className="flex flex-col items-center justify-center gap-[2px] flex-1 py-2">
              <span className={clsx('transition-colors', isMarket ? 'text-[#00e676]' : 'text-white/40')}>
                <IconMarket active={isMarket} />
              </span>
              <span className={clsx('text-[10px] font-semibold', isMarket ? 'text-[#00e676]' : 'text-white/40')}>Market</span>
            </Link>

            {/* Chart — elevated center button */}
            <Link href={chartHref} className="flex flex-col items-center justify-center flex-1 -mt-4">
              <div className={clsx(
                'w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all',
                isChart
                  ? 'bg-[#00e676] text-black shadow-[0_4px_20px_rgba(0,230,118,0.4)]'
                  : 'bg-[#1a1a1a] text-white/80 border border-white/10',
              )}>
                <IconChart />
              </div>
              <span className={clsx('text-[10px] font-semibold mt-1', isChart ? 'text-[#00e676]' : 'text-white/40')}>Chart</span>
            </Link>

            {/* Orders */}
            <Link href={ordersHref} className="flex flex-col items-center justify-center gap-[2px] flex-1 py-2">
              <span className={clsx('transition-colors', isOrders ? 'text-[#00e676]' : 'text-white/40')}>
                <IconOrders active={isOrders} />
              </span>
              <span className={clsx('text-[10px] font-semibold', isOrders ? 'text-[#00e676]' : 'text-white/40')}>Orders</span>
            </Link>

            {/* More */}
            <button onClick={() => setShowMore(true)} className="flex flex-col items-center justify-center gap-[2px] flex-1 py-2">
              <span className={clsx('transition-colors', showMore ? 'text-[#00e676]' : 'text-white/40')}>
                <IconMore active={showMore} />
              </span>
              <span className={clsx('text-[10px] font-semibold', showMore ? 'text-[#00e676]' : 'text-white/40')}>More</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── More Bottom Sheet ─── */}
      {showMore && (
        <div className="fixed inset-0 z-[80] lg:hidden flex flex-col justify-end" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative rounded-t-3xl border-t border-white/[0.08] shadow-2xl"
            style={{ background: '#0e0e0e', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-4">
              <span className="text-white font-bold text-base">Quick Access</span>
              <button onClick={() => setShowMore(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-white/60">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-5 gap-y-5 gap-x-2 px-4 pb-5">
              {SHEET_ITEMS.map((item) => (
                <Link
                  key={item.name}
                  href={item.path}
                  onClick={() => setShowMore(false)}
                  className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg"
                    style={{ background: `${item.color}15`, boxShadow: `0 0 0 1px ${item.color}22` }}
                  >
                    {item.icon}
                  </div>
                  <span className="text-[10px] text-white/60 font-medium text-center">{item.name}</span>
                </Link>
              ))}
            </div>

            <div className="mx-4 h-px bg-white/[0.06] mb-4" />
            <div className="flex gap-3 px-4 pb-2">
              <button onClick={toggleTheme}
                className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] active:scale-[0.98]">
                <span className="text-[#00e676]">{theme === 'dark' ? '☀️' : '🌙'}</span>
                <span className="text-white/80 text-sm font-semibold">{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
              <button onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/[0.06] border border-red-500/[0.12] active:scale-[0.98]">
                <span>🚪</span>
                <span className="text-red-400 text-sm font-semibold">Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
