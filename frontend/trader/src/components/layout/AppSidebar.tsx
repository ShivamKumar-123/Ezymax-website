'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from 'framer-motion';
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

export type LeafItem = { label: string; href: string; icon: any; newTab?: boolean };
export type GroupItem = { label: string; icon: any; key: string; children: LeafItem[] };
export type NavEntry = LeafItem | GroupItem;
export type NavSection = { label: string; items: NavEntry[] };

export const SECTIONS: NavSection[] = [
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
          { label: 'Spin & Win', href: '/earn/play-zone/spin', icon: Sparkles },
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

export function isGroup(e: NavEntry): e is GroupItem {
  return (e as GroupItem).children !== undefined;
}

/* ── Animation config ─────────────────────────────────────────────────
   Framer variants for the staggered entrance. The sliding gold "active
   pill" is a shared-layout element (single layoutId) so it glides from the
   old item to the new one on every navigation. */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const containerV = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};
const sectionV = {
  hidden: {},
  show: { transition: { staggerChildren: 0.028 } },
};
const itemV = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.34, ease: EASE } },
};

const PILL_SPRING = { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.9 };

/** The single shared gold highlight that slides between active items. */
function ActivePill() {
  return (
    <motion.span
      layoutId="sidebar-active-pill"
      className="absolute inset-0 rounded-lg bg-gradient-to-r from-accent/16 via-accent/8 to-accent/[0.03] border border-accent/25 shadow-[0_0_18px_-6px_rgba(214,169,61,0.55)]"
      transition={PILL_SPRING}
    >
      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[55%] w-[3px] rounded-full bg-[#d6a93d] shadow-[0_0_8px_1px_rgba(214,169,61,0.85)]" />
    </motion.span>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useShellStore();
  const reduce = useReducedMotion();

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
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 bg-bg-base/75 z-[65] lg:hidden"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          /* z-[70] above MobileBottomNav (z-[60]) so drawer links receive taps on small screens */
          'fixed top-0 left-0 z-[70] h-full w-[260px] flex flex-col overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden',
          'bg-bg-base border-r border-border-primary',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 gap-2">
          <Link href="/dashboard" className="flex items-center min-w-0 group">
            {/* FXArtha logo image (no text — the asset carries the branding).
                Height-based sizing keeps the horizontal logo's aspect ratio. */}
            <img
              src="/images/fxartha-logo.png"
              alt="FXArtha"
              className="h-9 w-auto object-contain drop-shadow-[0_0_20px_rgba(214,169,61,0.12)] transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-hover transition-colors shrink-0 active:scale-90"
            aria-label="Close menu"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <LayoutGroup id="sidebar">
          <motion.nav
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2 px-2 sidebar-scroll"
            variants={containerV}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            {SECTIONS.map((section) => (
              <motion.div key={section.label} className="mb-1.5" variants={sectionV}>
                <motion.div
                  variants={itemV}
                  className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-text-tertiary select-none"
                >
                  {section.label}
                </motion.div>
                {section.items.map((entry) => {
            if (isGroup(entry)) {
              const expanded = openGroups.has(entry.key);
              const groupActive = entry.children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`));
              // Show the pill on the group header only while collapsed — once
              // expanded, the active child renders it (and it slides down).
              const showGroupPill = groupActive && !expanded;
              return (
                <motion.div key={entry.key} className="mb-0.5" variants={itemV}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(entry.key)}
                    className={cn(
                      'group relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors border border-transparent',
                      groupActive
                        ? 'text-text-primary'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                    )}
                  >
                    {showGroupPill && <ActivePill />}
                    <entry.icon
                      size={17}
                      strokeWidth={1.85}
                      className={cn(
                        'relative z-10 shrink-0 transition-[filter,color,transform] duration-300 sidebar-icon-glow text-[#d6a93d] group-hover:scale-110',
                        groupActive
                          ? 'drop-shadow-[0_0_8px_rgba(214,169,61,0.55)]'
                          : 'drop-shadow-[0_0_6px_rgba(214,169,61,0.35)]',
                      )}
                    />
                    <span className="relative z-10 truncate flex-1 text-left transition-transform duration-300 group-hover:translate-x-0.5">{entry.label}</span>
                    <motion.span
                      className="relative z-10 shrink-0 text-text-tertiary"
                      animate={{ rotate: expanded ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                    >
                      <ChevronDown size={14} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        key="submenu"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: EASE }}
                        className="overflow-hidden"
                      >
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
                                  'group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-colors mb-0.5 border border-transparent',
                                  isActive
                                    ? 'text-text-primary'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                                )}
                              >
                                {isActive && <ActivePill />}
                                <child.icon size={14} strokeWidth={1.85} className="relative z-10 shrink-0 text-[#d6a93d]/85 transition-transform duration-300 group-hover:scale-110" />
                                <span className="relative z-10 truncate transition-transform duration-300 group-hover:translate-x-0.5">{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            }

            const itemPath = entry.href.split('?')[0];
            const isActive = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
            return (
              <motion.div key={entry.href} variants={itemV}>
                <Link
                  href={entry.href}
                  prefetch={false}
                  target={entry.newTab ? '_blank' : undefined}
                  rel={entry.newTab ? 'noopener noreferrer' : undefined}
                  onClick={() => {
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={cn(
                    'group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors mb-0.5 border border-transparent',
                    isActive
                      ? 'text-text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                  )}
                >
                  {isActive && <ActivePill />}
                  <entry.icon
                    size={17}
                    strokeWidth={1.85}
                    className={cn(
                      'relative z-10 shrink-0 transition-[filter,color,transform] duration-300 sidebar-icon-glow text-[#d6a93d] group-hover:scale-110',
                      isActive
                        ? 'drop-shadow-[0_0_8px_rgba(214,169,61,0.55)]'
                        : 'drop-shadow-[0_0_6px_rgba(214,169,61,0.35)]',
                    )}
                  />
                  <span className="relative z-10 truncate transition-transform duration-300 group-hover:translate-x-0.5">{entry.label}</span>
                </Link>
              </motion.div>
            );
                })}
              </motion.div>
            ))}
          </motion.nav>
        </LayoutGroup>

      </aside>
    </>
  );
}
