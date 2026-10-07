'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  Gauge,
  Lock,
  MonitorSmartphone,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { LiveTickerBar } from './LiveTickerBar';
import {
  HERO,
  HERO_ASSET_CHIPS,
  HERO_FEATURES,
  HERO_ROTATE_MS,
  HERO_ROTATING,
  SIGNUP_HREF,
} from '../data';
import { BRAND_NAME } from '@/lib/brand';

/** Shared entrance transition; the global reduced-motion guard in
 *  marketing/tokens.css neutralises it for users who ask for that. */
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
});

const FEATURE_ICONS: Record<string, LucideIcon> = {
  Gauge,
  Lock,
  ShieldCheck,
  MonitorSmartphone,
};

/** Chip accent colours, keyed by the `tone` in HERO_ASSET_CHIPS. */
const CHIP_TONE: Record<string, string> = {
  gold:   '#D4A017',
  blue:   '#1E66F5',
  orange: '#F7931A',
  navy:   'var(--brand-navy, #0B2F52)',
};

/**
 * Rotating two-tone headline.
 *
 * Renders HERO_ROTATING[0] on the server and for the first paint, then
 * advances every HERO_ROTATE_MS. Two details worth keeping:
 *
 *  • the block reserves its own height via a grid overlay (both frames
 *    occupy the same cell) so the page does not jolt as lines of
 *    different length swap in — a hero that reflows every four seconds
 *    pushes the CTAs under the cursor mid-click;
 *  • `useReducedMotion` stops the rotation outright rather than just
 *    dropping the transition. For a visitor who asked for less motion,
 *    text that rewrites itself unprompted is the problem, not the fade.
 */
function RotatingHeadline() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduced || HERO_ROTATING.length < 2) return;
    const id = setInterval(
      () => setI((n) => (n + 1) % HERO_ROTATING.length),
      HERO_ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [reduced]);

  // noUncheckedIndexedAccess makes a variable index possibly-undefined.
  // Index 0 is a literal into a non-empty `as const` tuple, so it is
  // statically known to exist and makes a safe floor.
  const { lead, accent } = HERO_ROTATING[i] ?? HERO_ROTATING[0];

  return (
    <h1
      className="mk-display"
      style={{ display: 'grid', textAlign: 'left' }}
      /* The headline rewrites itself on a timer. Announcing every frame
         would hijack a screen reader, so the live region is off and the
         full offering is stated once in the visually-hidden summary at
         the foot of this section. */
      aria-live="off"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={i}
          /* Both frames share one grid cell, so the taller of the two
             sets the height and nothing below ever moves. */
          style={{ gridArea: '1 / 1' }}
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -16 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {lead}{' '}
          <span style={{ color: 'var(--mk-accent)' }}>{accent}</span>
        </motion.span>
      </AnimatePresence>
    </h1>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft wash behind the fold — a flat white plate makes the cutout
          look pasted on, and a hard gradient competes with it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 78% 28%, rgba(204,0,0,0.07) 0%, rgba(204,0,0,0) 55%),' +
            'radial-gradient(90% 70% at 10% 20%, rgba(11,47,82,0.06) 0%, rgba(11,47,82,0) 60%),' +
            'linear-gradient(180deg, var(--mk-bg-raised) 0%, var(--mk-bg) 70%)',
        }}
      />

      <div
        className="mk-container relative"
        style={{
          paddingTop: 'clamp(5rem, 3.5rem + 6vw, 7.5rem)',
          paddingBottom: 'var(--mk-space-7)',
        }}
      >
        {/* Text left, artwork right. The artwork column is given the larger
            share because the cutout is 2.16:1 — at an even split it shrinks
            to the point the laptop screen is unreadable. */}
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-6">
          {/* ── Left: copy ─────────────────────────────────────────── */}
          <div className="text-left">
            <motion.span
              {...rise(0.05)}
              className="mk-kicker"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 26,
                  height: 3,
                  borderRadius: 2,
                  background: 'var(--mk-accent)',
                }}
              />
              {HERO.pill}
            </motion.span>

            <motion.div {...rise(0.12)} style={{ marginTop: 'var(--mk-space-4)' }}>
              <RotatingHeadline />
            </motion.div>

            {/* ── Feature strip ──────────────────────────────────── */}
            <motion.ul
              {...rise(0.26)}
              className="grid grid-cols-2 sm:grid-cols-4"
              style={{
                gap: 'var(--mk-space-4)',
                marginTop: 'var(--mk-space-6)',
                listStyle: 'none',
                padding: 0,
              }}
            >
              {HERO_FEATURES.map(({ icon, label, sub }) => {
                const Icon = FEATURE_ICONS[icon] ?? ShieldCheck;
                return (
                  <li key={label} className="flex items-start" style={{ gap: 10 }}>
                    <span
                      aria-hidden
                      className="shrink-0 inline-flex items-center justify-center"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: 'rgba(204,0,0,0.09)',
                        color: 'var(--mk-accent)',
                      }}
                    >
                      <Icon size={16} strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0">
                      <span
                        className="block font-bold leading-tight"
                        style={{ fontSize: 'var(--mk-text-sm)' }}
                      >
                        {label}
                      </span>
                      <span
                        className="block leading-tight"
                        style={{
                          fontSize: 'var(--mk-text-xs)',
                          color: 'var(--mk-text-faint)',
                          marginTop: 3,
                        }}
                      >
                        {sub}
                      </span>
                    </span>
                  </li>
                );
              })}
            </motion.ul>

            {/* ── CTAs ───────────────────────────────────────────── */}
            <motion.div
              {...rise(0.34)}
              className="flex flex-wrap items-center"
              style={{ gap: 'var(--mk-space-3)', marginTop: 'var(--mk-space-6)' }}
            >
              <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary mk-btn--lg">
                {HERO.ctaPrimary}
                <ArrowUpRight size={16} />
              </Link>
              <Link href={HERO.ctaSecondaryHref} className="mk-btn mk-btn--ghost mk-btn--lg">
                {HERO.ctaSecondary}
              </Link>
            </motion.div>
          </div>

          {/* ── Right: artwork + floating chips ────────────────────── */}
          <motion.div
            {...rise(0.2)}
            className="relative mx-auto w-full"
            style={{ maxWidth: 760 }}
          >
            <Image
              src="/images/hero-trader.png"
              alt={`A trader holding a laptop running the ${BRAND_NAME} terminal`}
              width={1829}
              height={846}
              /* Above the fold and the LCP candidate — preload rather than
                 letting it lazy-load. */
              priority
              sizes="(max-width: 1024px) 92vw, 760px"
              className="h-auto w-full"
            />

            {/* Decorative market chips. Labels only, no prices: a static
                number next to a trading screenshot reads as a quote. */}
            {HERO_ASSET_CHIPS.map(({ label, glyph, tone, top, left }, idx) => (
              <motion.span
                key={label}
                aria-hidden
                className="pointer-events-none absolute hidden select-none items-center sm:inline-flex"
                style={{
                  top,
                  left,
                  gap: 7,
                  padding: '7px 13px 7px 7px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.92)',
                  border: '1px solid rgba(11,47,82,0.10)',
                  boxShadow: '0 8px 24px rgba(11,47,82,0.12)',
                  backdropFilter: 'blur(6px)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: 'var(--mk-ink, #0B1B33)',
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
                transition={{
                  opacity: { delay: 0.5 + idx * 0.09, duration: 0.4 },
                  scale: { delay: 0.5 + idx * 0.09, duration: 0.4 },
                  /* Staggered so the four never bob in unison. */
                  y: {
                    duration: 3.6 + idx * 0.45,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: idx * 0.3,
                  },
                }}
              >
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: CHIP_TONE[tone] ?? 'var(--mk-accent)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {glyph}
                </span>
                {label}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* The headline rotates, so no single frame of it describes the
          offering. This states it once, for screen readers and crawlers. */}
      <p className="sr-only">
        {BRAND_NAME} is a multi-asset trading platform. Trade forex, metals,
        indices and crypto from one account across web, desktop and mobile,
        with stop-loss, take-profit and stop-out enforced on our servers.
        Trading leveraged products carries a high level of risk to your capital.
      </p>

      {/* Real market data, straight from the TradingView tape. */}
      <LiveTickerBar />
    </section>
  );
}
