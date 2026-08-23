'use client';

/**
 * DockNav — the logged-in app's primary navigation rendered as a floating
 * dock (macOS-style). Same slot and item order as the old pill nav; what
 * changes is the feel:
 *
 *   • Icons magnify as the cursor approaches (distance-based spring), the
 *     neighbours swell a little, everything settles back on leave.
 *   • The active state is one charcoal pill that SLIDES between items
 *     (framer `layoutId`) instead of snapping.
 *   • Labels lift 1px and tighten on hover; below `xl` they collapse into
 *     a floating tooltip so the dock stays compact on smaller laptops.
 *   • Honors `prefers-reduced-motion` — magnification and springs are off,
 *     plain hover states remain.
 */

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DockItemSpec = {
  label: string;
  href: string;
  icon: LucideIcon;
  isNew?: boolean;
  tourKey?: string;
  match?: string;
  children?: readonly { label: string; href: string; icon: LucideIcon }[];
};

const MAGNIFY_RADIUS = 120; // px from item centre where magnification fades to 1
const MAGNIFY_MAX = 1.32;
const SPRING = { mass: 0.12, stiffness: 220, damping: 16 };

function NewBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-crx-yellow px-1.5 py-[1px] text-[10px] font-semibold uppercase leading-none text-white">
      NEW
    </span>
  );
}

/** One dock entry. `mouseX` is the dock-wide cursor position (Infinity when
 *  the cursor is outside) — each item derives its own magnification. */
function DockItem({
  mouseX,
  icon: Icon,
  label,
  active,
  isNew,
  tourKey,
  href,
  trailing,
  dropdown,
}: {
  mouseX: MotionValue<number>;
  icon: LucideIcon;
  label: string;
  active: boolean;
  isNew?: boolean;
  tourKey?: string;
  href?: string;
  trailing?: ReactNode;
  dropdown?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  const distance = useTransform(mouseX, (x) => {
    const b = ref.current?.getBoundingClientRect();
    if (!b || !Number.isFinite(x)) return Infinity;
    return x - (b.left + b.width / 2);
  });
  const targetScale = useTransform(distance, [-MAGNIFY_RADIUS, 0, MAGNIFY_RADIUS], [1, reduce ? 1 : MAGNIFY_MAX, 1]);
  const scale = useSpring(targetScale, SPRING);
  const targetLift = useTransform(distance, [-MAGNIFY_RADIUS, 0, MAGNIFY_RADIUS], [0, reduce ? 0 : -3, 0]);
  const lift = useSpring(targetLift, SPRING);

  const body = (
    <>
      {active && (
        <motion.span
          layoutId="dock-active-pill"
          className="absolute inset-0 rounded-full bg-crx-charcoal"
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
          aria-hidden
        />
      )}
      <motion.span
        style={{ scale, y: lift }}
        className={cn(
          'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
          active ? 'text-crx-charcoal-ink' : 'text-text-secondary group-hover:text-text-primary',
        )}
      >
        <Icon size={17} strokeWidth={1.9} />
      </motion.span>
      <motion.span
        animate={reduce ? undefined : { y: hovered ? -1 : 0, letterSpacing: hovered ? '0.015em' : '0em' }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn(
          'relative hidden items-center whitespace-nowrap pr-1 text-[13px] font-medium xl:inline-flex',
          active ? 'text-crx-charcoal-ink' : 'text-text-secondary group-hover:text-text-primary',
        )}
      >
        {label}
        {isNew && <NewBadge />}
        {trailing}
      </motion.span>

      {/* Compact (lg–xl): label floats below the icon on hover (above would
          leave the viewport — the dock sits at the very top of the page) */}
      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border-primary bg-bg-glass-heavy px-2.5 py-1 text-[11px] font-semibold text-text-primary shadow-lg backdrop-blur xl:hidden"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </>
  );

  const itemClass = 'group relative flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 xl:pr-3 outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {href ? (
        <Link href={href} data-tour={tourKey} className={itemClass} aria-current={active ? 'page' : undefined}>
          {body}
        </Link>
      ) : (
        <button type="button" data-tour={tourKey} className={itemClass} aria-haspopup="menu" aria-expanded={hovered}>
          {body}
        </button>
      )}
      {dropdown}
    </div>
  );
}

export default function DockNav({
  items,
  pathname,
  isActive,
  className,
}: {
  items: readonly DockItemSpec[];
  pathname: string;
  isActive: (pathname: string, href: string) => boolean;
  className?: string;
}) {
  const mouseX = useMotionValue<number>(Infinity);
  const reduce = useReducedMotion();

  return (
    <motion.nav
      aria-label="Primary"
      initial={reduce ? false : { y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        'relative flex items-center gap-0.5 rounded-full border border-border-primary bg-crx-pill p-1 backdrop-blur-xl',
        // Floating: lifted off the canvas with a soft drop shadow + hairline highlight.
        'shadow-[0_16px_40px_-18px_rgba(0,0,0,0.45),0_2px_8px_-4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.25)]',
        className,
      )}
    >
      {items.map((item) => {
        if (item.children) {
          const groupActive = item.children.some((c) => isActive(pathname, c.href));
          return (
            <div key={item.label} className="group/menu relative">
              <DockItem
                mouseX={mouseX}
                icon={item.icon}
                label={item.label}
                active={groupActive}
                tourKey={item.tourKey}
                trailing={<ChevronDown size={13} className="ml-1 transition-transform group-hover/menu:rotate-180" />}
                dropdown={
                  /* pt-2 keeps a hover bridge so the menu doesn't close in the gap */
                  <div className="absolute left-0 top-full hidden pt-2 group-hover/menu:block">
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.16 }}
                      className="min-w-[200px] rounded-2xl border border-border-primary bg-bg-glass-heavy p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur"
                    >
                      {item.children.map((child) => {
                        const childActive = isActive(pathname, child.href);
                        const ChildIcon = child.icon;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                              childActive ? 'bg-crx-yellow-soft text-text-primary' : 'text-text-primary hover:bg-bg-hover',
                            )}
                          >
                            <ChildIcon size={16} strokeWidth={1.9} />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </motion.div>
                  </div>
                }
              />
            </div>
          );
        }
        return (
          <DockItem
            key={item.href}
            mouseX={mouseX}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={isActive(pathname, item.match ?? item.href)}
            isNew={item.isNew}
            tourKey={item.tourKey}
          />
        );
      })}
    </motion.nav>
  );
}
