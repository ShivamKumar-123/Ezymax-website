"use client";

import { AnimatedLink } from "@/components/ui/animated-link";
import { AnimatedGradient } from "@/components/ui/animated-gradient";
import { BrandLogo } from "@/components/ui/brand-logo";
import type { footerContent } from "@/data/mocks/site";

export interface SiteFooterProps {
  content: typeof footerContent;
}

export const SiteFooter = ({ content }: SiteFooterProps) => (
  <footer className="relative z-10 overflow-hidden rounded-t-card bg-ink/85 text-white backdrop-blur-sm">
    {/* Gradient band along the bottom edge, masked so it fades up into the
        footer rather than cutting a hard line across it. */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-72 opacity-70 [mask-image:linear-gradient(to_top,black,transparent)]"
    >
      <AnimatedGradient config={{ preset: "Artha" }} noise={{ opacity: 0.35 }} />
    </div>

    <div className="relative shell px-5 pt-20 pb-10 sm:px-8 lg:pt-24">
      <div className="grid grid-cols-2 gap-12 border-b border-white/10 pb-16 lg:grid-cols-7">
        <div className="col-span-2">
          <BrandLogo tone="dark" className="h-12" />
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/55">
            {content.tagline}
          </p>
          <a
            href={`mailto:${content.email}`}
            className="mt-5 inline-block text-sm text-accent-from transition-colors duration-[var(--duration-fast)] ease-entrance hover:text-white"
          >
            {content.email}
          </a>
        </div>

        {content.columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-xs font-mono tracking-label text-white/40 uppercase">
              {column.title}
            </h2>
            <ul className="mt-4 flex flex-col gap-3 text-sm">
              {column.links.map((link) => (
                <li key={link.label}>
                  <AnimatedLink href={link.href}>{link.label}</AnimatedLink>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <section
        aria-labelledby="risk-warning"
        className="border-b border-white/10 py-10"
      >
        <h2
          id="risk-warning"
          className="text-xs font-mono tracking-label text-white/40 uppercase"
        >
          {content.riskTitle}
        </h2>
        <p className="mt-4 max-w-5xl text-xs leading-relaxed text-white/45">
          {content.riskBody}
        </p>
        <p className="mt-3 max-w-5xl text-xs leading-relaxed text-white/45">
          {content.riskNote}
        </p>
      </section>

      <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-white/45 sm:flex-row">
        <p>{content.legal}</p>
        <ul className="flex flex-wrap justify-center gap-6">
          {content.legalLinks.map((link) => (
            <li key={link.label}>
              <AnimatedLink href={link.href} subtle>
                {link.label}
              </AnimatedLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </footer>
);
