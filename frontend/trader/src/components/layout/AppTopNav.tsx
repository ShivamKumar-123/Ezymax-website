'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SECTIONS,
  isGroup,
  type LeafItem,
  type NavEntry,
} from './AppSidebar';

/**
 * Desktop top navigation (lg+): the sidebar's categorised sections as a
 * horizontal bar. Clicking a category slides a GLASSY panel in from the
 * RIGHT (mirrors the landing site's drawer) listing that category's options
 * with spring-animated icons. Theme-aware via the app's --bg-glass tokens,
 * so it reads as dark glass in dark mode and bright glass in light mode.
 * Mobile keeps the drawer sidebar + bottom nav. Nav data lives in
 * AppSidebar's SECTIONS — one source of truth.
 */
export default function AppTopNav() {
  const pathname = usePathname();
  const [openSection, setOpenSection] = useState<string | null>(null);

  /* Close the panel on route change and on Escape. */
  useEffect(() => setOpenSection(null), [pathname]);
  useEffect(() => {
    if (!openSection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenSection(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSection]);

  const leafActive = (item: LeafItem) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`);

  const entryActive = (entry: NavEntry): boolean =>
    isGroup(entry) ? entry.children.some(leafActive) : leafActive(entry);

  const section = SECTIONS.find((s) => s.label === openSection);

  const renderLeaf = (item: LeafItem, index: number, indent = false) => {
    const Icon = item.icon;
    const active = leafActive(item);
    return (
      <motion.div
        key={item.href}
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.05 + index * 0.045, type: 'spring', stiffness: 260, damping: 24 }}
      >
        <Link
          href={item.href}
          target={item.newTab ? '_blank' : undefined}
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
            indent && 'ml-5',
            active
              ? 'bg-bg-hover text-[#d6a93d]'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
          )}
        >
          {/* animated icon: springs in, wiggles on hover */}
          <motion.span
            className="inline-flex shrink-0"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.08 + index * 0.045, type: 'spring', stiffness: 320, damping: 16 }}
            whileHover={{ scale: 1.25, rotate: 10 }}
          >
            <Icon size={17} />
          </motion.span>
          {item.label}
          <ChevronRight
            size={14}
            className="ml-auto opacity-0 -translate-x-1 transition-all group-hover:opacity-60 group-hover:translate-x-0"
          />
        </Link>
      </motion.div>
    );
  };

  /* Flatten a section into render rows (group headers + leaves) with a
     running index so the stagger reads top-to-bottom. */
  const renderSectionItems = (items: readonly NavEntry[]) => {
    const rows: React.ReactNode[] = [];
    let i = 0;
    for (const entry of items) {
      if (isGroup(entry)) {
        rows.push(
          <div
            key={`h-${entry.key}`}
            className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-text-tertiary select-none"
          >
            {entry.label}
          </div>,
        );
        for (const child of entry.children) rows.push(renderLeaf(child, i++, true));
      } else {
        rows.push(renderLeaf(entry, i++));
      }
    }
    return rows;
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="hidden lg:block border-b border-border-primary bg-bg-base"
      >
        <div className="flex items-center gap-1 px-4 h-12">
          {SECTIONS.map((s) => {
            const active = s.items.some(entryActive);
            const open = openSection === s.label;
            return (
              <button
                key={s.label}
                type="button"
                aria-expanded={open}
                onClick={() => setOpenSection(open ? null : s.label)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                  active || open
                    ? 'text-[#d6a93d] bg-bg-hover'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                )}
              >
                {s.label}
                <motion.span
                  className="inline-flex"
                  animate={{ rotate: open ? 90 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <ChevronRight size={14} />
                </motion.span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Right-side glassy options panel */}
      <AnimatePresence>
        {section && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-[84] cursor-default"
              style={{ background: 'rgba(2, 6, 12, 0.35)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpenSection(null)}
            />
            <motion.aside
              aria-label={`${section.label} menu`}
              className="fixed right-0 top-0 z-[85] flex h-full w-[340px] max-w-[88vw] flex-col"
              style={{
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                borderLeft: '1px solid var(--border-glass-bright)',
              }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            >
              <div className="flex items-center justify-between border-b border-border-primary px-5 py-4">
                <span className="text-sm font-semibold tracking-wide text-text-primary">
                  {section.label}
                </span>
                <motion.button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpenSection(null)}
                  className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                  whileHover={{ rotate: 90 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {renderSectionItems(section.items)}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
