'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
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
                  title={item.label}
                  aria-label={item.label}
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
    </nav>
  );
}
