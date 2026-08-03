'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SECTIONS,
  isGroup,
  type LeafItem,
  type NavEntry,
} from './AppSidebar';

/**
 * Desktop top navigation (lg+): the sidebar's categorised sections rendered
 * as dropdown menus in a horizontal bar. Mobile keeps the drawer sidebar +
 * bottom nav. Data lives in AppSidebar's SECTIONS — one source of truth.
 */
export default function AppTopNav() {
  const pathname = usePathname();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  /* Close the open menu on route change and on outside click. */
  useEffect(() => setOpenKey(null), [pathname]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const leafActive = (item: LeafItem) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`);

  const entryActive = (entry: NavEntry): boolean =>
    isGroup(entry) ? entry.children.some(leafActive) : leafActive(entry);

  const renderLeaf = (item: LeafItem, indent = false) => {
    const Icon = item.icon;
    const active = leafActive(item);
    return (
      <Link
        key={item.href}
        href={item.href}
        target={item.newTab ? '_blank' : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
          indent && 'pl-8',
          active
            ? 'bg-bg-hover text-[#d6a93d]'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
        )}
      >
        <Icon size={15} className="shrink-0" />
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      ref={rootRef}
      aria-label="Primary"
      className="hidden lg:block border-b border-border-primary bg-bg-base"
    >
      <div className="flex items-center gap-1 px-4 h-12">
        {SECTIONS.map((section) => {
          const active = section.items.some(entryActive);
          const open = openKey === section.label;
          return (
            <div key={section.label} className="relative">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenKey(open ? null : section.label)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                  active || open
                    ? 'text-[#d6a93d] bg-bg-hover'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                )}
              >
                {section.label}
                <ChevronDown
                  size={14}
                  className={cn('transition-transform', open && 'rotate-180')}
                />
              </button>

              {open && (
                <div className="absolute left-0 top-full z-[80] mt-1 w-64 rounded-xl border border-border-primary bg-bg-base p-2 shadow-xl">
                  {section.items.map((entry) =>
                    isGroup(entry) ? (
                      <div key={entry.key}>
                        <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-text-tertiary select-none">
                          {entry.label}
                        </div>
                        {entry.children.map((child) => renderLeaf(child, true))}
                      </div>
                    ) : (
                      renderLeaf(entry)
                    ),
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
