'use client';

import { useState, type ReactNode } from 'react';
import { Quote } from 'lucide-react';
import { BRAND_LOGO, BRAND_NAME } from '@/lib/brand';

/**
 * Famous-investor quote band. Drop in any page — accepts a custom quote,
 * author, role, portrait, and initials. Defaults render the Warren
 * Buffett "Rule No. 1" quote used on the homepage.
 */
interface QuoteSectionProps {
  /** Pre-formatted JSX so brand-green highlight spans can sit inline. */
  quote?: ReactNode;
  author?: string;
  role?: string;
  portrait?: string;
  /** Two-letter initials shown if the portrait image fails to load. */
  initials?: string;
  /** Small uppercase eyebrow label above the headline (default "Investor Wisdom"). */
  eyebrow?: string;
}

export function QuoteSection({
  quote,
  author = 'Warren Buffett',
  role = 'Chairman & CEO — Berkshire Hathaway',
  /* No default portrait: the file this used to point at came from the
     cloned site and is gone, so the initials monogram below is the
     default until a real portrait is passed in. */
  portrait: portraitProp = '',
  initials = 'WB',
  eyebrow = 'Investor Wisdom',
}: QuoteSectionProps = {}) {
  const [imgErrored, setImgErrored] = useState(false);
  const portrait = portraitProp;
  /* An empty src makes the browser re-request the page itself instead of
     firing onError, so an absent portrait skips the <img> outright. */
  const showPortrait = Boolean(portrait) && !imgErrored;
  const defaultQuote = (
    <>
      &ldquo;Rule No. 1 is <span className="text-primary font-bold">never lose money.</span>{' '}
      Rule No. 2 is <span className="text-primary font-bold">never forget</span> Rule No. 1.&rdquo;
    </>
  );

  return (
    <section className="relative px-3 sm:px-6 py-10 sm:py-16 md:py-20">
      <div
        className="max-w-[1200px] mx-auto rounded-3xl overflow-hidden relative"
        style={{
          background: 'var(--mk-bg-raised)',
          border: '1px solid var(--mk-line)',
          boxShadow: 'none',
        }}
      >
        {/* Subtle decorative ring on the right side (mirrors the reference design) */}
        <div
          aria-hidden
          className="absolute -right-24 -top-24 size-[360px] rounded-full pointer-events-none hidden md:block"
          style={{
            border: '1px solid var(--mk-line)',
            background: 'transparent',
          }}
        />
        <div
          aria-hidden
          className="absolute -right-44 top-12 size-[300px] rounded-full pointer-events-none hidden md:block"
          style={{ border: '1px solid var(--mk-line)' }}
        />

        <div className="relative grid md:grid-cols-[2fr_1fr] gap-6 sm:gap-10 p-5 sm:p-10 md:p-14 items-center">
          {/* Left — quote */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              {BRAND_LOGO ? (
                <img
                  src={BRAND_LOGO}
                  alt={BRAND_NAME}
                  className="h-7 w-auto opacity-90"
                />
              ) : (
                <span className="font-display font-black tracking-tight text-base text-foreground opacity-90">
                  {BRAND_NAME}
                </span>
              )}
              <span className="text-[11px] uppercase tracking-[0.22em] text-foreground/55 font-semibold ml-2">
                {eyebrow}
              </span>
            </div>

            <Quote className="size-7 text-primary/70 mb-4" aria-hidden />

            <blockquote className="font-display text-xl sm:text-3xl md:text-[40px] lg:text-5xl leading-[1.15] sm:leading-[1.12] text-foreground tracking-tight max-w-none break-words">
              {quote ?? defaultQuote}
            </blockquote>

            <div className="mt-7 flex items-center gap-3">
              <div className="h-px w-10 bg-primary/60" />
              <div>
                <div className="font-display uppercase text-sm tracking-tight text-foreground">
                  {author}
                </div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/55">
                  {role}
                </div>
              </div>
            </div>
          </div>

          {/* Right — portrait (image with initials fallback) */}
          <div className="relative flex justify-center md:justify-end">
            <div
              className="size-[180px] sm:size-[220px] md:size-[260px] rounded-2xl overflow-hidden flex items-center justify-center font-display font-bold"
              style={{
                background: showPortrait ? 'var(--mk-surface)' : 'var(--mk-surface-2)',
                color: 'var(--mk-accent)',
                border: '1px solid var(--mk-line)',
                boxShadow: 'none',
              }}
              aria-hidden
            >
              {showPortrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portrait}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setImgErrored(true)}
                />
              ) : (
                <span className="text-5xl sm:text-6xl">{initials}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
