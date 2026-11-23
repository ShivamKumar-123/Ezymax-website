'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Headphones, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShellStore } from '@/stores/shellStore';
import { usePlatformStatusStore } from '@/stores/platformStatusStore';
import { NAV_ITEMS, isGroup, type LeafItem, type NavEntry } from './navItems';

/**
 * Slide-down navigation panel opened by the header hamburger.
 *
 * Replaces the old behaviour where the hamburger toggled the left
 * sidebar: the menu now drops in from the top across the content area.
 * Entries come from the shared NAV_ITEMS list, so this panel and the
 * sidebar always show the same destinations. Group entries (Earn) are
 * flattened into their children — a dropdown inside a dropdown adds a
 * click for no benefit at this size.
 */
export default function TopNavMenu() {
  const { topMenuOpen, setTopMenuOpen } = useShellStore();
  const pathname = usePathname();
  const pammEnabled = usePlatformStatusStore((s) => s.pamm_enabled);
  const mamEnabled = usePlatformStatusStore((s) => s.mam_enabled);

  // Close on route change so a tap navigates and dismisses in one go.
  useEffect(() => { setTopMenuOpen(false); }, [pathname, setTopMenuOpen]);

  // Escape closes; body scroll is locked while open.
  useEffect(() => {
    if (!topMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTopMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [topMenuOpen, setTopMenuOpen]);

  const items: LeafItem[] = useMemo(() => {
    const visible = NAV_ITEMS.filter((e: NavEntry) => {
      const href = (e as LeafItem).href;
      if (href === '/pamm' && !pammEnabled) return false;
      if (href === '/social' && !mamEnabled) return false;
      return true;
    });
    const out: LeafItem[] = [];
    for (const e of visible) {
      if (isGroup(e)) out.push(...e.children);
      else out.push(e);
    }
    return out;
  }, [pammEnabled, mamEnabled]);

  return (
    <>
      {/* Backdrop — click anywhere outside to dismiss. */}
      <div
        className={cn(
          'fixed inset-0 z-[78] bg-black/35 transition-opacity duration-200',
          topMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden
        onClick={() => setTopMenuOpen(false)}
      />

      {/* Panel — anchored to the top edge, slides down over the content. */}
      <div
        className={cn(
          'fixed inset-x-0 top-0 z-[79] origin-top transition-transform duration-250 ease-out',
          topMenuOpen ? 'translate-y-0' : '-translate-y-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        aria-hidden={!topMenuOpen}
      >
        <div
          className="mx-2 sm:mx-3 mt-2 sm:mt-3 rounded-2xl overflow-hidden max-h-[85dvh] flex flex-col"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass-bright)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 sm:px-5 h-[56px] sm:h-[65px] shrink-0"
            style={{ borderBottom: '1px solid var(--border-secondary)' }}
          >
            <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-text-tertiary">
              Menu
            </span>
            <button
              type="button"
              onClick={() => setTopMenuOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              aria-label="Close menu"
              tabIndex={topMenuOpen ? 0 : -1}
            >
              <X size={18} />
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {items.map((item) => {
                const base = item.href.split('?')[0];
                const active = pathname === base || pathname.startsWith(`${base}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      tabIndex={topMenuOpen ? 0 : -1}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-3 py-3 text-[13px] font-semibold transition-colors border',
                        active
                          ? 'bg-accent/10 text-text-primary border-accent/25'
                          : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border-transparent',
                      )}
                    >
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: 'var(--bg-card-nested)',
                          border: '1px solid var(--border-secondary)',
                        }}
                      >
                        <item.icon size={15} strokeWidth={1.9} className="text-[#E12019]" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div
              className="mt-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2"
              style={{ borderTop: '1px solid var(--border-secondary)' }}
            >
              <Link
                href="/terms"
                tabIndex={topMenuOpen ? 0 : -1}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <FileText size={14} className="text-accent shrink-0" />
                Terms &amp; Conditions
              </Link>
              <Link
                href="/support"
                tabIndex={topMenuOpen ? 0 : -1}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <Headphones size={14} className="text-accent shrink-0" />
                Get Support
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
