'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { ArrowUpRight, Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';
import { Button } from '../ui/Button';
import { BlurText } from './BlurText';
import {
  CTA,
  COPYRIGHT,
  BRAND,
  FOOTER_EXPLORE,
  FOOTER_PLATFORM,
  FOOTER_COMPANY,
  RISK_DISCLAIMER,
} from '../data';
import { BRAND_DOMAIN, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Closing CTA + site footer.
 *
 * 2026-09-01 redesign. Previously one `min-h-screen` section painted with a
 * black radial gradient and a translucent overlay: on the light canvas that
 * resolved to a full-viewport grey void with the footer floating inside it.
 * Split into the two bands the reference actually uses —
 *   1. a light CTA band, and
 *   2. a true black footer —
 * with the viewport-height minimum dropped so the section is only as tall
 * as its content. Copy, links and ordering are unchanged.
 */
export function CtaFooter() {
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

      {/* An App Store / Play Store badge row and a "Trusted By" partner
          marquee used to sit here. Both were carried over from the site
          this was cloned from: the store badges linked to "#" because no
          native app exists (see /download), and the partner logos were
          that site's marks, since deleted from public/images. Neither had
          any Bullza artwork to fall back on, so both are gone. */}

      {/* ── Footer ──────────────────────────────────────────────────── */}
      {/* Black band. `.text-foreground` resolves to ink inside .brand-home,
          so everything here sets its colour explicitly rather than relying
          on the inherited token. */}
      <div className="relative w-full bg-black text-white">
        <div
          className="mx-auto max-w-[1320px] pb-10 pt-16"
          style={{ paddingLeft: 'var(--gutter)', paddingRight: 'var(--gutter)' }}
        >
          {/* Tablet: brand takes a full row above the three link columns.
              Desktop: brand sits beside them, 2 + 1 + 1 + 1. */}
          <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8 lg:grid-cols-5">
            <div className="flex flex-col gap-4 md:col-span-3 lg:col-span-2">
              <Link href="/" className="flex items-center gap-2">
                {BRAND.logoLight ? (
                  <img src={BRAND.logoLight} alt={BRAND.name} className="h-9 w-auto object-contain" />
                ) : (
                  <span className="font-display text-xl font-extrabold tracking-tight text-white">
                    {BRAND.name}
                  </span>
                )}
              </Link>
              {/* One line, not the two paragraphs that used to sit here.
                  A footer blurb is a signature, not an About page — the
                  detail it repeated already lives on /company/about. */}
              <p className="max-w-xs font-body text-sm leading-relaxed text-white/60">
                A forex and CFD trading platform built for serious traders — fast
                execution, competitive spreads, transparent pricing.
              </p>
              <div className="mt-2 flex items-center gap-3">
                {[
                  { Icon: Facebook,  label: 'Facebook',  href: `https://${BRAND_DOMAIN}` },
                  { Icon: Instagram, label: 'Instagram', href: `https://${BRAND_DOMAIN}` },
                  { Icon: Linkedin,  label: 'LinkedIn',  href: `https://${BRAND_DOMAIN}` },
                  { Icon: Youtube,   label: 'YouTube',   href: `https://${BRAND_DOMAIN}` },
                ].map(({ Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex size-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/40 hover:text-white"
                  >
                    <Icon className="size-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Three columns of four. The first is NAV_ITEMS itself, so
                the footer opens with exactly what the header offers. */}
            {[
              { title: 'Explore',  links: FOOTER_EXPLORE },
              { title: 'Platform', links: FOOTER_PLATFORM },
              { title: 'Company',  links: FOOTER_COMPANY },
            ].map(({ title, links }) => (
              <div key={title} className="flex flex-col gap-3">
                <span className="mb-1 font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  {title}
                </span>
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
          </div>

          {/* Legal / policy links. Demoted to fine print: six of them in
              body size read as a second navigation column, which is what
              made this band look busy. */}
          <nav
            aria-label="Legal documents"
            className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/12 pt-8"
          >
            {[
              { name: 'Privacy Policy',              href: '/privacy' },
              { name: 'Terms & Conditions',          href: '/terms' },
              { name: 'Deposit & withdrawal Policy', href: '/deposit-withdrawal' },
              { name: 'Restricted Countries',        href: '/restricted-countries' },
              { name: 'Risk Warning',                href: '/risk-warning' },
              { name: 'Risk Disclosure',             href: '/risk' },
            ].map((doc) => (
              <a
                key={doc.name}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-xs text-white/45 transition-colors hover:text-white/80 hover:underline"
              >
                {doc.name}
              </a>
            ))}
          </nav>

          <div className="mt-6 flex flex-col gap-4 border-t border-white/12 pt-8">
            {/* Contact used to be a fourth grid column carrying an email,
                a three-line address and "24/7 Available". It is reference
                detail, not navigation — the Contact page in the Company
                column is the route for reaching us — so it sits here as
                one line instead. */}
            <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
              <span className="max-w-2xl font-body text-xs text-white/50">{COPYRIGHT}</span>
              <span className="font-body text-xs text-white/50">
                <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="transition-colors hover:text-white/80">
                  {BRAND_SUPPORT_EMAIL}
                </a>
                {' · '}18 Young St, Edinburgh EH2 4JB, Scotland
              </span>
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
