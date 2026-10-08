'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Grip } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SECTIONS,
  isGroup,
  type LeafItem,
} from './AppSidebar';

/**
 * Desktop top navigation (lg+), INLINE in the AppHeader row.
 *
 * Only the handful of routes a trader touches every session stay visible as
 * labelled pills; everything else lives behind a single "More" mega-menu that
 * keeps the sidebar's categories (Money · Trading · Grow · Account). The old
 * version rendered all ~19 leaves as unlabelled icons in a horizontally
 * scrolling strip, which was impossible to scan.
 *
 * Nav data still lives in AppSidebar's SECTIONS — this file only decides which
 * of those leaves are promoted to the bar.
 */

/** Routes promoted out of the More menu, in bar order. */
const PRIMARY_HREFS = ['/dashboard', '/accounts', '/portfolio', '/wallet', '/social'] as const;

/** Bar labels are tighter than sidebar labels so five pills fit on one line. */
const SHORT_LABEL: Record<string, string> = {
  '/wallet': 'Wallet',
  '/social': 'Copy',
};

const PANEL_W = 620;

export default function AppTopNav() {
  const pathname = usePathname();
  /** Instant tooltip: fixed-position so nothing in the header can clip it. */
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null);
  /** More menu anchor, in viewport coords (null = closed). */
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* SyntheticEvent (not MouseEvent) so the same handler serves both
     onMouseEnter and onFocus — it only reads currentTarget. */
  const showTip = (label: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, x: r.left + r.width / 2, y: r.bottom + 8 });
  };

  const leafActive = (item: LeafItem) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`);

  /* Flatten every section's groups (e.g. Grow → Earn) down to leaves, then
     split into the promoted bar items and the per-section remainder. */
  const { primary, rest } = useMemo(() => {
    const flat: LeafItem[] = [];
    const bySection = SECTIONS.map((s) => ({
      label: s.label,
      items: s.items.flatMap((e) => (isGroup(e) ? e.children : [e])),
    }));
    bySection.forEach((s) => flat.push(...s.items));

    const promoted = PRIMARY_HREFS
      .map((href) => flat.find((i) => i.href === href))
      .filter(Boolean) as LeafItem[];

    const remainder = bySection
      .map((s) => ({
        label: s.label,
        items: s.items.filter((i) => !PRIMARY_HREFS.includes(i.href as typeof PRIMARY_HREFS[number])),
      }))
      .filter((s) => s.items.length > 0);

    return { primary: promoted, rest: remainder };
  }, []);

  /** True when the current route lives inside the More menu — the trigger then
      carries the active treatment, so the bar never looks "nowhere". */
  const moreActive = rest.some((s) => s.items.some(leafActive));

  const openMenu = () => {
    const r = moreBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    // Right-align to the trigger, then clamp inside the viewport.
    const left = Math.min(Math.max(12, r.right - PANEL_W), vw - PANEL_W - 12);
    setMenu({ left: Math.max(12, left), top: r.bottom + 10 });
    setTip(null);
  };

  // Close on outside click / Escape / navigation.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || moreBtnRef.current?.contains(t)) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    // The panel is anchored to a rect captured at open time, so a resize would
    // leave it floating in the wrong place — just close it.
    const onResize = () => setMenu(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [menu]);

  useEffect(() => { setMenu(null); }, [pathname]);

  return (
    <nav aria-label="Primary" className="hidden min-w-0 flex-1 lg:block">
      {/* One rounded "capsule" holds the whole nav, and the current route is a
          SOLID brand-lime pill inside it — the shape language the client asked
          for. Lime-on-near-black reads at full contrast in BOTH themes, so the
          active label never washes out the way tinted text did on light. */}
      <div className="flex items-center justify-center px-3">
        <div className="flex items-center gap-0.5 rounded-full border border-border-primary bg-bg-base p-1 shadow-sm">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = leafActive(item);
            const label = SHORT_LABEL[item.href] ?? item.label;
            return (
              <Link
                key={item.href}
                href={item.href}
                target={item.newTab ? '_blank' : undefined}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                onMouseEnter={showTip(item.label)}
                onMouseLeave={() => setTip(null)}
                onFocus={showTip(item.label)}
                onBlur={() => setTip(null)}
                className={cn(
                  'group relative flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 xl:px-3.5',
                  'text-[13px] font-semibold transition-colors duration-200',
                  active
                    ? 'text-[#060606]'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="topnav-active-pill"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-[#FF6A00] shadow-[0_2px_12px_-3px_rgba(255,106,0,0.75)]"
                    transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.9 }}
                  />
                )}
                <motion.span
                  className="relative inline-flex"
                  whileHover={{ scale: 1.18, rotate: 6 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 15 }}
                >
                  <Icon size={16} />
                </motion.span>
                <span className="relative hidden whitespace-nowrap xl:inline">{label}</span>
              </Link>
            );
          })}

          <button
            ref={moreBtnRef}
            type="button"
            onClick={() => (menu ? setMenu(null) : openMenu())}
            aria-haspopup="menu"
            aria-expanded={!!menu}
            aria-label="More"
            className={cn(
              'relative flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 xl:px-3.5',
              'text-[13px] font-semibold transition-colors duration-200',
              moreActive
                ? 'bg-[#FF6A00] text-[#060606] shadow-[0_2px_12px_-3px_rgba(255,106,0,0.75)]'
                : menu
                  ? 'bg-bg-hover text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            )}
          >
            <Grip size={16} />
            <span className="hidden whitespace-nowrap xl:inline">More</span>
            <ChevronDown
              size={13}
              className={cn('transition-transform duration-200', menu && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      {/* ── More mega-menu ──────────────────────────────────────────────
          Fixed-positioned so no rounded/overflowing ancestor can clip it.
          Sections flow in three CSS columns and are kept whole. */}
      <AnimatePresence>
        {menu && (
          <motion.div
            ref={panelRef}
            role="menu"
            className="fixed z-[95] overflow-hidden rounded-2xl border border-border-primary bg-bg-secondary/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl"
            style={{ left: menu.left, top: menu.top, width: PANEL_W }}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            {/* Lime hairline along the top edge — matches the sidebar accent */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6A00]/50 to-transparent"
            />
            <div className="[column-count:3] [column-gap:1.25rem]">
              {rest.map((section) => (
                <div key={section.label} className="mb-4 break-inside-avoid">
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                    {section.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = leafActive(item);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          target={item.newTab ? '_blank' : undefined}
                          role="menuitem"
                          onClick={() => setMenu(null)}
                          className={cn(
                            'group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors',
                            active
                              ? 'bg-[#FF6A00]/10 text-[#FF6A00]'
                              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors',
                              active
                                ? 'border-[#FF6A00]/30 bg-[#FF6A00]/10 text-[#FF6A00]'
                                : 'border-border-primary bg-bg-base text-text-tertiary group-hover:border-[#FF6A00]/25 group-hover:text-[#FF6A00]',
                            )}
                          >
                            <Icon size={14} />
                          </span>
                          <span className="truncate text-[12.5px] font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tip && !menu && (
          <motion.span
            aria-hidden
            className="pointer-events-none fixed z-[90] -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-primary bg-bg-base px-2.5 py-1 text-[11px] font-medium text-text-primary shadow-lg xl:hidden"
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
