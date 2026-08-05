'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  SECTIONS,
  isGroup,
  type LeafItem,
} from './AppSidebar';

/**
 * Desktop top navigation (lg+), INLINE in the AppHeader row — every nav item
 * as a visible button on the same line as the coin/balance widgets, grouped
 * by the sidebar's categories (Main · Money · Trading · Grow · Account) with
 * hairline separators. Icons spring on hover; the row scrolls horizontally
 * when the viewport is narrower than the buttons. Mobile keeps the drawer
 * sidebar + bottom nav. Nav data lives in AppSidebar's SECTIONS.
 */
export default function AppTopNav() {
  const pathname = usePathname();
  /** Instant tooltip: fixed-position so the scrollable row can't clip it. */
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null);

  /* SyntheticEvent (not MouseEvent) so the same handler serves both
     onMouseEnter and onFocus — it only reads currentTarget. */
  const showTip = (label: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, x: r.left + r.width / 2, y: r.bottom + 8 });
  };

  const leafActive = (item: LeafItem) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`);

  /* Flatten groups (e.g. Grow → Earn) so every leaf is a visible button. */
  const sectionLeaves = (sectionLabel: string): LeafItem[] => {
    const section = SECTIONS.find((s) => s.label === sectionLabel);
    if (!section) return [];
    return section.items.flatMap((e) => (isGroup(e) ? e.children : [e]));
  };

  return (
    <nav
      aria-label="Primary"
      className="hidden min-w-0 flex-1 lg:block"
    >
      <div className="flex items-center gap-0.5 overflow-x-auto px-3 [scrollbar-width:thin]">
        {SECTIONS.map((section) => (
          <div key={section.label} className="flex items-center gap-0.5 shrink-0">
            {sectionLeaves(section.label).map((item) => {
              const Icon = item.icon;
              const active = leafActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.newTab ? '_blank' : undefined}
                  aria-label={item.label}
                  onMouseEnter={showTip(item.label)}
                  onMouseLeave={() => setTip(null)}
                  onFocus={showTip(item.label)}
                  onBlur={() => setTip(null)}
                  className={cn(
                    'group relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors shrink-0',
                    active
                      ? 'bg-bg-hover text-[#d6a93d]'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                  )}
                >
                  <motion.span
                    className="inline-flex"
                    whileHover={{ scale: 1.35, rotate: 10 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 15 }}
                  >
                    <Icon size={17} />
                  </motion.span>
                  {active && (
                    <span
                      aria-hidden
                      className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#d6a93d]"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {tip && (
          <motion.span
            aria-hidden
            className="pointer-events-none fixed z-[90] -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-primary bg-bg-base px-2.5 py-1 text-[11px] font-medium text-text-primary shadow-lg"
            style={{ left: tip.x, top: tip.y }}
            initial={{ opacity: 0, y: -4, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          >
            {tip.label}
          </motion.span>
        )}
      </AnimatePresence>
    </nav>
  );
}
