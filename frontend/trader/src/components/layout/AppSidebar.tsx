'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useShellStore } from '@/stores/shellStore';
import { cn } from '@/lib/utils';
import {
  Home,
  LayoutGrid,
  Wallet,
  History,
  TrendingUp,
  Copy,
  Users,
  GraduationCap,
  Newspaper,
  ShieldCheck,
  Settings,
  X,
  Receipt,
  Calculator,
  Gift,
  ChevronDown,
  CheckSquare,
  Trophy,
  Sparkles,
  ShoppingBag,
  Coins,
} from 'lucide-react';

type LeafItem = { label: string; href: string; icon: any; newTab?: boolean };
type GroupItem = { label: string; icon: any; key: string; children: LeafItem[] };
type NavEntry = LeafItem | GroupItem;
type NavSection = { label: string; items: NavEntry[] };

const SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Home },
      { label: 'Accounts', href: '/accounts', icon: LayoutGrid },
      { label: 'Portfolio', href: '/portfolio', icon: Receipt },
    ],
  },
  {
    label: 'Money',
    items: [
      { label: 'Deposit/Withdraw', href: '/wallet', icon: Wallet },
      { label: 'Transactions', href: '/transactions', icon: History },
    ],
  },
  {
    label: 'Trading',
    items: [
      { label: 'Copy Trading', href: '/social', icon: Copy },
      { label: 'PAMM', href: '/pamm', icon: TrendingUp },
      { label: 'Trade Insurance', href: '/insurance', icon: ShieldCheck },
    ],
  },
  {
    label: 'Grow',
    items: [
      {
        label: 'Earn',
        icon: Gift,
        key: 'earn',
        children: [
          { label: 'Tasks', href: '/earn/tasks', icon: CheckSquare },
          { label: 'Leaderboard', href: '/earn/leaderboard', icon: Trophy },
          { label: 'Play Zone', href: '/earn/play-zone', icon: Sparkles },
          { label: 'Rewards Store', href: '/earn/store', icon: ShoppingBag },
          { label: 'Staking', href: '/earn/staking', icon: Coins },
        ],
      },
      { label: 'Affiliates', href: '/business', icon: Users },
      { label: 'FXArtha Academy', href: '/academy', icon: GraduationCap },
      { label: 'Economic News', href: '/news', icon: Newspaper },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Risk Management', href: '/risk-calculator', icon: Calculator },
      { label: 'KYC', href: '/kyc', icon: ShieldCheck },
      { label: 'Settings', href: '/profile', icon: Settings },
    ],
  },
];

// Flat list of all entries — used by the auto-expand logic below.
const ALL_ITEMS: NavEntry[] = SECTIONS.flatMap((s) => s.items);

function isGroup(e: NavEntry): e is GroupItem {
  return (e as GroupItem).children !== undefined;
}

export default function AppSidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useShellStore();

  // Auto-expand the group whose children include the current route, but let
  // the user collapse/expand manually after that.
  const initiallyOpenGroups = useMemo(() => {
    const open = new Set<string>();
    for (const e of ALL_ITEMS) {
      if (isGroup(e) && e.children.some((c) => pathname.startsWith(c.href))) {
        open.add(e.key);
      }
    }
    return open;
  }, [pathname]);
  const [openGroups, setOpenGroups] = useState<Set<string>>(initiallyOpenGroups);
  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-bg-base/75 z-[65] lg:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          /* z-[70] above MobileBottomNav (z-[60]) so drawer links receive taps on small screens */
          'fixed top-0 left-0 z-[70] h-full w-[260px] flex flex-col overflow-hidden transition-transform duration-200',
          'bg-bg-base border-r border-border-primary',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 gap-2">
          <Link href="/dashboard" className="flex items-center min-w-0">
            {/* FXArtha logo image (no text — the asset carries the branding).
                Height-based sizing keeps the horizontal logo's aspect ratio. */}
            <img
              src="/images/fxartha-logo.png"
              alt="FXArtha"
              className="h-9 w-auto object-contain drop-shadow-[0_0_20px_rgba(214,169,61,0.12)]"
            />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-hover transition-colors shrink-0"
            aria-label="Close menu"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2 px-2 sidebar-scroll">
          {SECTIONS.map((section) => (
            <div key={section.label} className="mb-1.5">
              <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-text-tertiary select-none">
                {section.label}
              </div>
              {section.items.map((entry) => {
            if (isGroup(entry)) {
              const expanded = openGroups.has(entry.key);
              const groupActive = entry.children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`));
              return (
                <div key={entry.key} className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(entry.key)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors',
                      groupActive
                        ? 'bg-accent/10 text-text-primary border border-accent/22'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent',
                    )}
                  >
                    <entry.icon
                      size={17}
                      strokeWidth={1.85}
                      className={cn(
                        'shrink-0 transition-[filter,color] sidebar-icon-glow text-[#d6a93d]',
                        groupActive
                          ? 'drop-shadow-[0_0_8px_rgba(214,169,61,0.55)]'
                          : 'drop-shadow-[0_0_6px_rgba(214,169,61,0.35)]',
                      )}
                    />
                    <span className="truncate flex-1 text-left">{entry.label}</span>
                    <ChevronDown
                      size={14}
                      className={cn('shrink-0 transition-transform text-text-tertiary', expanded && 'rotate-180')}
                    />
                  </button>
                  {expanded && (
                    <div className="ml-3 border-l border-border-primary pl-1 mt-0.5 mb-1">
                      {entry.children.map((child) => {
                        const isActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            prefetch={false}
                            onClick={() => {
                              if (window.innerWidth < 1024) setSidebarOpen(false);
                            }}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-colors mb-0.5',
                              isActive
                                ? 'bg-accent/10 text-text-primary border border-accent/22'
                                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent',
                            )}
                          >
                            <child.icon size={14} strokeWidth={1.85} className="shrink-0 text-[#d6a93d]/85" />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const itemPath = entry.href.split('?')[0];
            const isActive = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                prefetch={false}
                target={entry.newTab ? '_blank' : undefined}
                rel={entry.newTab ? 'noopener noreferrer' : undefined}
                onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors mb-0.5',
                  isActive
                    ? 'bg-accent/10 text-text-primary border border-accent/22'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent',
                )}
              >
                <entry.icon
                  size={17}
                  strokeWidth={1.85}
                  className={cn(
                    'shrink-0 transition-[filter,color] sidebar-icon-glow text-[#d6a93d]',
                    isActive
                      ? 'drop-shadow-[0_0_8px_rgba(214,169,61,0.55)]'
                      : 'drop-shadow-[0_0_6px_rgba(214,169,61,0.35)]',
                  )}
                />
                <span className="truncate">{entry.label}</span>
              </Link>
            );
              })}
            </div>
          ))}
        </nav>

      </aside>
    </>
  );
}
