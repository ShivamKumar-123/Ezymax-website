'use client';

import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Menu, X, ChevronDown, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { NAV_ITEMS, BRAND, SIGNUP_HREF, APK_HREF, type NavItem } from '../data';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Desktop dropdown nav item.
 * The dropdown panel is rendered via createPortal to `document.body` so it
 * cannot be clipped by any ancestor's `overflow: hidden` (the navbar pill
 * uses liquid-glass which clips its children to keep the gradient border
 * inside the rounded shape).
 */
function DesktopNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = pathname === item.href || item.children?.some((c) => c.href === pathname);

  useEffect(() => setMounted(true), []);

  // Position the portal panel under the trigger.
  useIsomorphicLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const measure = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      setCoords({
        top:  r.bottom + 10,           // 10px gap below trigger
        left: r.left + r.width / 2,    // horizontally center to trigger
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  if (!item.children) {
    const linkClass = `relative whitespace-nowrap rounded px-3 py-5 font-body text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active ? 'text-foreground' : 'text-foreground/70 hover:text-foreground'
    }`;
    // External items (e.g. the liquidity subdomain) open in a new tab.
    if (item.external) {
      return (
        <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {item.label}
        </a>
      );
    }
    return (
      <Link href={item.href} className={linkClass}>
        {item.label}
        {/* Full-width underline rather than a floating dot — it reads as a
            tab indicator and sits flush with the nav's bottom hairline. */}
        {active && (
          <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />
        )}
      </Link>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onMouseEnter={() => { cancelClose(); setOpen(true); }}
        onMouseLeave={scheduleClose}
        onFocus={() => { cancelClose(); setOpen(true); }}
        onClick={() => setOpen((v) => !v)}
        suppressHydrationWarning
        className={`relative inline-flex items-center gap-1 whitespace-nowrap rounded px-3 py-5 font-body text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          active ? 'text-foreground' : 'text-foreground/70 hover:text-foreground'
        }`}
      >
        {item.label}
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        {active && (
          <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />
        )}
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                role="menu"
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="brand-home fixed z-[200] min-w-[240px] rounded-xl border border-[hsl(var(--border)/0.10)] bg-white p-1.5 shadow-[0_18px_44px_rgba(11,11,12,0.14)]"
                style={{
                  top: coords.top,
                  left: coords.left,
                  transform: 'translateX(-50%)',
                }}
              >
                {item.children!.map((c) => {
                  const isActive = pathname === c.href;
                  return (
                    <Link
                      key={c.href}
                      href={c.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className={`block rounded-lg px-3.5 py-2.5 font-body text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[hsl(var(--muted))] text-primary'
                          : 'text-foreground/75 hover:bg-[hsl(var(--muted))] hover:text-foreground'
                      }`}
                    >
                      {c.label}
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/** Mobile nav row — children render as nested expandable list. */
function MobileNavRow({
  item,
  onSelect,
}: {
  item: NavItem;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!item.children) {
    const rowClass =
      'font-display uppercase text-2xl tracking-tight text-foreground/85 hover:text-foreground py-2 block';
    if (item.external) {
      return (
        <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={onSelect} className={rowClass}>
          {item.label}
        </a>
      );
    }
    return (
      <Link href={item.href} onClick={onSelect} className={rowClass}>
        {item.label}
      </Link>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="font-display uppercase text-2xl tracking-tight text-foreground/85 hover:text-foreground py-2 inline-flex items-center gap-2"
      >
        {item.label}
        <ChevronDown className={`size-5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden flex flex-col items-center gap-1 py-2"
          >
            {item.children.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                onClick={onSelect}
                className="font-body text-base text-foreground/70 hover:text-primary transition-colors py-1.5"
              >
                {c.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const pathname = usePathname() ?? '/';

  useMotionValueEvent(scrollY, 'change', (v) => {
    setScrolled(v > 40);
  });

  return (
    <>
      {/* Single-tier white chrome. The black utility strip that used to sit
          above the nav is gone; the affordances it carried (locale, sign-in)
          moved into the primary bar next to the CTA, so the header is one
          64px band instead of 36px + 64px. Both hero paddings were trimmed
          by the same 36px to keep the gap under the header unchanged. */}
      <motion.header
        data-scrolled={scrolled}
        className="fixed inset-x-0 top-0 z-50"
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <nav
          className={`border-b bg-white transition-shadow ${
            scrolled
              ? 'border-transparent shadow-[0_1px_16px_rgba(11,11,12,0.10)]'
              : 'border-[hsl(var(--border)/0.10)]'
          }`}
          aria-label="Primary"
          suppressHydrationWarning
        >
          <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-8 px-4 sm:px-6">
            <Link href="/" className="group flex shrink-0 items-center gap-2" aria-label={`${BRAND.name} home`}>
              {BRAND.logoDark ? (
                <img src={BRAND.logoDark} alt={BRAND.name} className="h-8 w-auto object-contain" />
              ) : (
                <span className="whitespace-nowrap font-display text-xl font-extrabold tracking-tight text-foreground">
                  {BRAND.name}
                </span>
              )}
            </Link>

            {/* Left-aligned next to the brand rather than centred — the
                reference anchors navigation to the wordmark. */}
            <div className="hidden flex-1 items-center gap-0.5 lg:flex">
              {NAV_ITEMS.map((item) => (
                <DesktopNavLink key={item.label} item={item} pathname={pathname} />
              ))}
            </div>

            <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
              {/* Direct Android APK download. Plain <a download> so the file
                  downloads instead of navigating. */}
              <a
                href={APK_HREF}
                download
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[hsl(var(--border)/0.2)] px-4 py-2.5 font-body text-[15px] font-medium text-foreground/80 transition-colors hover:text-foreground hover:bg-[hsl(var(--muted))]"
              >
                <Download className="size-4" />
                Download App
              </a>
              <Link
                href="/auth/login"
                className="whitespace-nowrap rounded-full px-4 py-2.5 font-body text-[15px] font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                Client Login
              </Link>
              <Button variant="hero" className="h-auto rounded-full px-5 py-2.5 text-sm" asChild>
                <Link href={SIGNUP_HREF}>
                  Book a Demo
                  <ArrowUpRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-1 lg:hidden">
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={open}
                className="flex size-9 items-center justify-center rounded-full border border-[hsl(var(--border)/0.14)] text-foreground transition-colors hover:bg-[hsl(var(--muted))]"
                onClick={() => setOpen(true)}
              >
                <Menu className="size-4" />
              </button>
            </div>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] overflow-y-auto bg-white lg:hidden"
          >
            <div className="absolute right-4 top-4">
              <button
                type="button"
                aria-label="Close menu"
                className="flex size-10 items-center justify-center rounded-full border border-[hsl(var(--border)/0.14)] text-foreground transition-colors hover:bg-[hsl(var(--muted))]"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-full flex flex-col items-center justify-center gap-1 px-6 py-20">
              {NAV_ITEMS.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full flex flex-col items-center"
                >
                  <MobileNavRow item={item} onSelect={() => setOpen(false)} />
                </motion.div>
              ))}
              <a
                href={APK_HREF}
                download
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 font-display uppercase text-2xl tracking-tight text-foreground/85 hover:text-foreground py-2 mt-4"
              >
                <Download className="size-5" />
                Download App
              </a>
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="font-display uppercase text-2xl tracking-tight text-foreground/85 hover:text-foreground py-2 block mt-2"
              >
                Client Login
              </Link>
              <Button variant="hero" asChild className="mt-2">
                <Link href={SIGNUP_HREF} onClick={() => setOpen(false)}>
                  Book a Demo
                  <ArrowUpRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
