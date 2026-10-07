'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  Clock,
  Gauge,
  Lock,
  MonitorSmartphone,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { LiveTickerBar } from './LiveTickerBar';
import {
  HERO,
  HERO_ASSET_CHIPS,
  HERO_FEATURES,
  HERO_ROTATE_MS,
  HERO_ROTATING,
  HERO_STATS,
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
  Clock,
  TrendingUp,
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
      style={{
        display: 'grid',
        textAlign: 'left',
        /* .mk-display is sized for a centred, full-width headline. In a
           ~560px column that overflowed into the artwork, so the hero
           caps it rather than inheriting --mk-text-display. */
        fontSize: 'clamp(2.1rem, 1.3rem + 2.3vw, 3.4rem)',
        lineHeight: 1.04,
      }}
      /* The headline rewrites itself on a timer. Announcing every frame
         would hijack a screen reader, so the live region is off and the
         full offering is stated once in the visually-hidden summary at
         the foot of this section. */
      aria-live="off"
    >
      {/* No mode="wait": that holds the incoming frame until the
          outgoing one has finished leaving, so the headline is BLANK
          for the length of the transition — every four seconds, in the
          largest text on the page. Both frames share grid cell 1/1, so
          the default sync mode crossfades them in place instead. */}
      <AnimatePresence initial={false}>
        <motion.span
          key={i}
          /* Both frames occupy the same cell, so they crossfade on top of
             each other and the taller one sets the block height — nothing
             below ever moves as the text changes. */
          style={{ gridArea: '1 / 1' }}
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -16 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {lead}
          {/* Own line: the design breaks the two tones, and inline the
              red ran up against the artwork mid-word. */}
          <span className="block" style={{ color: 'var(--mk-accent)' }}>{accent}</span>
        </motion.span>
      </AnimatePresence>
    </h1>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background plate.
          Composed from the supplied hero artwork: its two clean edges —
          the candlestick cityscape on the left, the globe and trading
          floor on the right — stretched and feathered into a light
          middle. The middle is deliberately empty because that is where
          the headline and the cutout go; the source artwork had the
          model, copy and a stat bar baked into it, none of which can be
          background on a page that renders all three as live markup. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* A CSS background rather than next/image: the plate is 3.1:1 and
            the fold is nearer 1.7:1, so object-cover scaled it to the
            height and cropped the SIDES — losing the cityscape and the
            globe, which are the only parts worth showing. Stretching to
            100% x 100% guarantees both edges land; on an out-of-focus
            plate the vertical stretch is invisible. 61KB, so skipping the
            optimiser costs nothing. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/images/hero-bg.jpg)',
            backgroundSize: '100% 100%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        {/* Scrim. Heaviest under the headline, lifting toward the right so
            the globe stays visible behind the artwork. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.80) 24%, rgba(255,255,255,0.58) 48%, rgba(255,255,255,0.18) 72%, rgba(255,255,255,0.00) 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-28"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, var(--mk-bg) 92%)' }}
        />
      </div>

      <div
        className="mk-container mk-container--wide relative"
        style={{
          paddingTop: 'clamp(5rem, 3.75rem + 4vw, 7rem)',  /* clears the 80px fixed header */
          paddingBottom: 0,
        }}
      >
        {/* Text left, artwork right. The artwork column is given the larger
            share because the cutout is 2.16:1 — at an even split it shrinks
            to the point the laptop screen is unreadable. */}
        {/* Text is capped at a readable measure; the artwork takes
            whatever is left and is bottom-aligned so she stands on the
            fold instead of floating in it. */}
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,38rem)_minmax(0,1fr)] lg:gap-4">
          {/* ── Left: copy ─────────────────────────────────────────── */}
          <div className="text-left" style={{ paddingBottom: 'var(--mk-space-8)' }}>
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

            <motion.p
              {...rise(0.2)}
              className="mk-lead"
              style={{ marginTop: 'var(--mk-space-4)', maxWidth: '46ch' }}
            >
              {HERO.blurb}
            </motion.p>

            {/* ── Feature strip ──────────────────────────────────── */}
            <motion.ul
              {...rise(0.26)}
              className="grid grid-cols-2 xl:grid-cols-4"
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
                        style={{ fontSize: 'var(--mk-text-sm)', textWrap: 'balance' }}
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
            className="relative w-full self-end"
            style={{ marginBottom: '-1px', marginRight: 'calc(var(--mk-gutter) * -1)' }}
          >
            <Image
              src="/images/hero-trader.png"
              alt={`A trader holding a laptop running the ${BRAND_NAME} terminal`}
              width={1829}
              height={846}
              /* Above the fold and the LCP candidate — preload rather than
                 letting it lazy-load. */
              priority
              sizes="(max-width: 1024px) 100vw, 56vw"
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

      {/* ── Stat bar ────────────────────────────────────────────────
          Dark pill straddling the foot of the fold, as the reference has.
          Figures are platform facts, not traction numbers — see
          HERO_STATS in data.ts for why. */}
      <div className="mk-container mk-container--wide relative" style={{ paddingBottom: 'var(--mk-space-7)' }}>
        <motion.ul
          {...rise(0.5)}
          className="mx-auto grid max-w-3xl grid-cols-1 overflow-hidden rounded-2xl sm:grid-cols-3"
          style={{
            background: 'linear-gradient(180deg, rgba(10,13,20,0.94) 0%, rgba(6,8,13,0.96) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 50px -24px rgba(11,27,51,0.55)',
            listStyle: 'none',
            padding: 0,
          }}
        >
          {HERO_STATS.map(({ icon, value, label }, i) => {
            const Icon = FEATURE_ICONS[icon] ?? ShieldCheck;
            return (
              <li
                key={label}
                className="flex items-center justify-center gap-3 px-5 py-4"
                style={{
                  borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span
                  aria-hidden
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(204,0,0,0.18)', color: '#FF6B6B' }}
                >
                  <Icon size={17} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block font-display text-xl font-extrabold leading-none text-white">
                    {value}
                  </span>
                  <span className="mt-1 block text-xs text-white/55">{label}</span>
                </span>
              </li>
            );
          })}
        </motion.ul>
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
