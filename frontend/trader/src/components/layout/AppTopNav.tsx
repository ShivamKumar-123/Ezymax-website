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
 * Desktop top navigation (lg+): EVERY nav item as a visible button in one
 * horizontal bar, grouped by the sidebar's categories (Main · Money ·
 * Trading · Grow · Account) with hairline separators — nothing hidden
 * behind menus. Icons spring on hover. Scrolls horizontally if the viewport
 * is narrower than the row. Mobile keeps the drawer sidebar + bottom nav.
 * Nav data lives in AppSidebar's SECTIONS — one source of truth.
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
      className="hidden lg:block border-b border-border-primary bg-bg-base"
    >
      <div className="flex items-center gap-0.5 overflow-x-auto px-3 h-12 [scrollbar-width:thin]">
        {SECTIONS.map((section, sectionIndex) => (
          <div key={section.label} className="flex items-center gap-0.5 shrink-0">
            {sectionIndex > 0 && (
              <span
                aria-hidden
                className="mx-2 h-5 w-px bg-border-primary shrink-0"
              />
            )}
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-text-tertiary select-none shrink-0">
              {section.label}
            </span>
            {sectionLeaves(section.label).map((item) => {
              const Icon = item.icon;
              const active = leafActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.newTab ? '_blank' : undefined}
                  title={item.label}
                  className={cn(
                    'group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors shrink-0',
                    active
                      ? 'bg-bg-hover text-[#d6a93d]'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                  )}
                >
                  <motion.span
                    className="inline-flex shrink-0"
                    whileHover={{ scale: 1.3, rotate: 10 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 15 }}
                  >
                    <Icon size={15} />
                  </motion.span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
