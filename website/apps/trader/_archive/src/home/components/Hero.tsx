'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { LiveTickerBar } from './LiveTickerBar';
import { HERO, HERO_TRUST_PILLS, SIGNUP_HREF } from '../data';
import { BRAND_NAME } from '@/lib/brand';

/** Shared entrance transition; the global reduced-motion guard in
 *  marketing/tokens.css neutralises it for users who ask for that. */
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
});

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* The old skin layered a coral bloom and a hairline grid behind the
          headline to keep a black canvas from going dead. On white both
          read as printing artefacts, so the backdrop is now a single very
          faint neutral wash that just stops the fold from being flat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, var(--mk-bg-raised) 0%, var(--mk-bg) 62%)',
        }}
      />

      <div
        className="mk-container relative flex flex-col items-center text-center"
        style={{
          /* Clears the fixed 64px header with room to breathe underneath.
             Trimmed by 2.25rem when the 36px black utility strip above the
             nav was removed, so the gap under the header is unchanged. */
          paddingTop: 'clamp(6.25rem, 4.25rem + 8vw, 9.75rem)',
          paddingBottom: 'var(--mk-space-8)',
          gap: 'var(--mk-space-5)',
        }}
      >
        <motion.span {...rise(0.05)} className="mk-kicker">
          <span className="relative inline-flex items-center justify-center" aria-hidden>
            <span
              className="absolute size-1.5 rounded-full animate-ping opacity-75"
              style={{ background: 'var(--mk-accent)' }}
            />
            <span className="relative size-1.5 rounded-full" style={{ background: 'var(--mk-accent)' }} />
          </span>
          {HERO.pill}
        </motion.span>

        {/* No measure cap here on purpose — a 17ch limit broke the
            headline across two lines on desktop. At the clamped display
            size the line fits the container down to roughly 500px, then
            wraps on its own for phones. */}
        <motion.h1 {...rise(0.12)} className="mk-display">
          {HERO.headline}
        </motion.h1>

        <motion.p {...rise(0.2)} className="mk-lead" style={{ maxWidth: '56ch' }}>
          {HERO.sub}
        </motion.p>

        <motion.div
          {...rise(0.28)}
          className="flex flex-wrap items-center justify-center"
          style={{ gap: 'var(--mk-space-3)', paddingTop: 'var(--mk-space-2)' }}
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

      {/* Product shot — the fold's anchor, sitting directly under the CTAs.
          Two deliberate departures from the placeholder it replaced: it is
          rendered at the asset's own 2.04:1 ratio rather than forced into a
          21:9 box (the artwork has hard-edged white and black regions, so
          any crop would slice through them), and it runs wider than
          .mk-container's 1200px measure on its own 1440px bound, keeping
          just the page gutter either side. */}
      <div
        className="relative mx-auto w-full"
        style={{
          maxWidth: '1440px',
          paddingInline: 'var(--mk-gutter)',
          paddingBottom: 'var(--mk-space-8)',
        }}
      >
        <motion.div
          {...rise(0.44)}
          className="overflow-hidden"
          /* Scales with the viewport so the corners stay proportional to
             the frame instead of flattening out as it grows. */
          style={{ borderRadius: 'clamp(16px, 1.6vw, 28px)' }}
        >
          <Image
            src="/images/home banner 2.png"
            alt={`${BRAND_NAME} trading platform shown on mobile`}
            width={1791}
            height={878}
            /* Above the fold, so it is the LCP candidate — preload it
               rather than letting it lazy-load. */
            priority
            sizes="(max-width: 1440px) 100vw, 1360px"
            className="h-auto w-full"
          />
        </motion.div>
      </div>

      {/* What we are, in three lines — no numbers, no unverifiable claims. */}
      {/* A full --mk-section-y here stacked on top of the ticker strip AND
          the next section's own section-y, leaving ~330px of dead band
          under the trust pills. The ticker is a full-bleed divider in its
          own right, so the hero only needs to clear it. */}
      <div className="mk-container relative" style={{ paddingBottom: 'var(--mk-space-7)' }}>
        <motion.ul
          {...rise(0.5)}
          className="grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3"
        >
          {HERO_TRUST_PILLS.map(({ icon, label, sub }) => (
            <li
              key={label}
              className="mk-card mk-card--outline flex items-start"
              style={{ gap: 'var(--mk-space-3)', padding: 'var(--mk-space-5)' }}
            >
              {/* Full-colour 3D marks, so no tinted plate behind them — that
                  square only existed to give a monochrome line glyph a
                  ground. Decorative: the label beside it carries the
                  meaning, so the alt stays empty. */}
              <Image
                src={icon}
                alt=""
                aria-hidden
                /* 128 rather than the rendered 56 so the mark stays crisp
                   on 2x displays. */
                width={128}
                height={128}
                className="h-14 w-14 shrink-0 object-contain"
              />
              <span className="min-w-0">
                <span className="block font-bold" style={{ fontSize: 'var(--mk-text-sm)' }}>
                  {label}
                </span>
                <span
                  className="block"
                  style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)', marginTop: 2 }}
                >
                  {sub}
                </span>
              </span>
            </li>
          ))}
        </motion.ul>
      </div>

      <p className="sr-only">
        {BRAND_NAME} — forex and CFD trading with major, minor and exotic
        currency pairs, tight spreads and fast execution.
      </p>

      {/* Real market data, straight from the TradingView tape. */}
      <LiveTickerBar />
    </section>
  );
}
