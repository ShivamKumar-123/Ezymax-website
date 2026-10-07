'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { BlurText } from './BlurText';
import {
  CTA,
  COPYRIGHT,
  BRAND,
  FOOTER_BLURB,
  FOOTER_EXPLORE,
  FOOTER_PLATFORM,
  FOOTER_COMPANY,
  NEWSLETTER,
  RISK_DISCLAIMER,
  SOCIAL_LINKS,
} from '../data';
import { BRAND_SUPPORT_EMAIL } from '@/lib/brand';

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
};

/**
 * Newsletter capture.
 *
 * NEWSLETTER.endpoint is the integration point. While it is empty there is
 * no subscribe route on the gateway, so rather than POST into the void —
 * a form that silently swallows an address is worse than no form — the
 * submit opens a prefilled mail to support, which reaches a person. Set
 * the endpoint and the fallback stops being used; nothing else changes.
 */
function NewsletterCard() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    if (!NEWSLETTER.endpoint) {
      window.location.href =
        `mailto:${BRAND_SUPPORT_EMAIL}` +
        `?subject=${encodeURIComponent('Newsletter subscription')}` +
        `&body=${encodeURIComponent(`Please add ${email.trim()} to the mailing list.`)}`;
      setState('done');
      return;
    }

    setState('sending');
    try {
      const res = await fetch(NEWSLETTER.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      setState(res.ok ? 'done' : 'error');
      if (res.ok) setEmail('');
    } catch {
      setState('error');
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6"
      style={{
        background: 'linear-gradient(145deg, rgba(30,102,245,0.10) 0%, rgba(11,47,82,0.22) 100%)',
        border: '1px solid rgba(90,150,255,0.28)',
        boxShadow: '0 0 0 1px rgba(90,150,255,0.06), 0 18px 50px -20px rgba(30,102,245,0.45)',
      }}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(30,102,245,0.16)', border: '1px solid rgba(90,150,255,0.25)' }}
        >
          <Mail className="size-5" style={{ color: '#5B8CFF' }} />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-xl font-extrabold tracking-tight text-white">
            {NEWSLETTER.title}{' '}
            <span style={{ color: '#5B8CFF' }}>{NEWSLETTER.titleAccent}</span>
          </h3>
          <p className="mt-1 font-body text-sm leading-relaxed text-white/60">
            {NEWSLETTER.body}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state !== 'idle') setState('idle');
          }}
          placeholder={NEWSLETTER.placeholder}
          className="min-w-0 flex-1 rounded-xl px-4 py-3 font-body text-sm text-white outline-none transition-colors placeholder:text-white/35"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: 'linear-gradient(180deg, #2E7FC2 0%, #1E66F5 100%)' }}
        >
          {state === 'sending' ? 'Sending…' : NEWSLETTER.cta}
          <ArrowRight className="size-4" />
        </button>
      </form>

      {/* aria-live so the outcome is announced, not just shown. */}
      <p aria-live="polite" className="mt-2 min-h-[18px] font-body text-xs">
        {state === 'done' && <span className="text-white/60">Thanks — we&apos;ll be in touch.</span>}
        {state === 'error' && (
          <span style={{ color: '#E63A3A' }}>
            Could not subscribe just now. Email {BRAND_SUPPORT_EMAIL} instead.
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * Closing CTA + site footer.
 *
 * Two bands: a light CTA, then the dark footer. The footer follows the
 * 2026-10 design — brand + socials, three link columns under red rules, a
 * newsletter card, then legal fine print.
 *
 * Two elements of that design are deliberately absent:
 *
 *  • App Store / Play Store badges. There is no published iOS or Android
 *    app, and public/downloads/ezymex.apk (which the header still points
 *    at) does not exist either. A store badge that does not reach a store
 *    listing is a broken promise on the most-trusted part of the page.
 *    An identical badge row was already removed from this file once
 *    before, for the same reason.
 *  • Hardcoded social links. Every icon previously pointed at the apex
 *    domain, so all four bounced the visitor back to the homepage. They
 *    now render only for entries in SOCIAL_LINKS that carry a real url.
 *
 * Fill either in and they appear; neither needs a code change beyond the
 * data file.
 */
export function CtaFooter() {
  const socials = SOCIAL_LINKS.filter((s) => s.href);

  return (
    <section id="cta" className="relative">
      {/* ── Closing CTA ─────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'var(--mk-bg-raised)' }}
      >
        <div
          className="mk-container relative z-10 flex flex-col items-center px-4 text-center sm:px-6"
          style={{ paddingBlock: 'var(--mk-section-y)' }}
        >
          <BlurText
            text={CTA.headline}
            as="h2"
            className="max-w-[18ch] break-words text-center font-display text-[clamp(32px,6.4vw,72px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-foreground"
          />
          <motion.p
            initial={{ filter: 'blur(10px)', opacity: 0, y: 16 }}
            whileInView={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: 0.4, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mk-lead mt-6 max-w-xl text-center"
          >
            {CTA.sub}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Button variant="hero" asChild>
              <Link href={CTA.href}>
                {CTA.primary}
                <ArrowUpRight className="ml-1 size-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden text-white" style={{ background: '#05070D' }}>
        {/* Depth wash. The design's globe-and-candles artwork is rendered
            as gradients rather than shipped as an image: at footer size it
            reads as a glow either way, and this costs no bytes and needs
            no dark-mode variant. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(70% 120% at 88% 18%, rgba(30,102,245,0.20) 0%, rgba(30,102,245,0) 60%),' +
              'radial-gradient(60% 100% at 4% 92%, rgba(124,58,237,0.16) 0%, rgba(124,58,237,0) 62%),' +
              'radial-gradient(90% 60% at 50% 0%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%)',
          }}
        />

        <div
          className="relative mx-auto max-w-[1320px] pb-10 pt-16"
          style={{ paddingLeft: 'var(--gutter)', paddingRight: 'var(--gutter)' }}
        >
          <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
            {/* ── Brand ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 lg:col-span-3">
              <Link href="/" className="flex items-center gap-2">
                {BRAND.logoLight ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={BRAND.logoLight} alt={BRAND.name} className="h-10 w-auto object-contain" />
                ) : (
                  <span className="font-display text-xl font-extrabold tracking-tight text-white">
                    {BRAND.name}
                  </span>
                )}
              </Link>
              <p className="max-w-xs font-body text-sm leading-relaxed text-white/60">
                {FOOTER_BLURB}
              </p>
              {socials.length > 0 && (
                <div className="mt-2 flex items-center gap-3">
                  {socials.map(({ key, href }) => {
                    const Icon = SOCIAL_ICONS[key];
                    if (!Icon) return null;
                    return (
                      <a
                        key={key}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={key}
                        className="flex size-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/40 hover:text-white"
                      >
                        <Icon className="size-4" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Link columns ──────────────────────────────────── */}
            {[
              { title: 'Explore',  links: FOOTER_EXPLORE },
              { title: 'Platform', links: FOOTER_PLATFORM },
              { title: 'Company',  links: FOOTER_COMPANY },
            ].map(({ title, links }) => (
              <div key={title} className="flex flex-col gap-3 lg:col-span-2">
                <span className="font-body text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                  {title}
                </span>
                {/* Short brand rule under each heading, per the design. */}
                <span
                  aria-hidden
                  className="mb-1 block"
                  style={{ width: 26, height: 2, borderRadius: 2, background: 'var(--mk-accent, #CC0000)' }}
                />
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="font-body text-sm text-white/65 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}

            {/* ── Newsletter ────────────────────────────────────── */}
            <div className="md:col-span-2 lg:col-span-3">
              <NewsletterCard />
            </div>
          </div>

          {/* Legal fine print. */}
          <nav
            aria-label="Legal documents"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/12 pt-8"
          >
            {[
              { name: 'Privacy Policy',   href: '/privacy' },
              { name: 'Terms of Service', href: '/terms' },
              { name: 'Disclaimer',       href: '/risk' },
            ].map((doc, i) => (
              <span key={doc.name} className="flex items-center gap-6">
                {i > 0 && <span aria-hidden className="text-white/20">|</span>}
                <Link
                  href={doc.href}
                  className="font-body text-xs text-white/45 transition-colors hover:text-white/80 hover:underline"
                >
                  {doc.name}
                </Link>
              </span>
            ))}
          </nav>

          <div className="mt-6 flex flex-col gap-4 border-t border-white/12 pt-8">
            <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
              <span className="max-w-2xl font-body text-xs text-white/50">{COPYRIGHT}</span>
              <a
                href={`mailto:${BRAND_SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-2 font-body text-xs text-white/50 transition-colors hover:text-white/80"
              >
                <Mail className="size-3.5" />
                {BRAND_SUPPORT_EMAIL}
              </a>
            </div>
            <p className="max-w-4xl font-body text-[11px] leading-relaxed text-white/40">
              {RISK_DISCLAIMER}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
