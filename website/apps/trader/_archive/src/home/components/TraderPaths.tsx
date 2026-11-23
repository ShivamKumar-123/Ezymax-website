'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { Section, SectionHeading } from '@/marketing/components';
import { TRADER_PATHS } from '../data';

/**
 * "Everything you need to trade the markets" — the reference splits this
 * band into two audience columns, each with an image above a short list of
 * deep links.
 *
 * The banners render at their own ~1.55 ratio rather than the 3:2 the
 * placeholder reserved. Both assets are 1564×1006, so forcing them into a
 * 3:2 box would crop the composition for no reason; the two columns still
 * line up because the pair share a ratio.
 */
export function TraderPaths() {
  return (
    <Section raised>
      <SectionHeading title="Everything you need to trade the markets" />

      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{ gap: 'var(--mk-space-7)', marginTop: 'var(--mk-space-7)' }}
      >
        {TRADER_PATHS.map(({ heading, image, links }, i) => (
          <motion.div
            key={heading}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 * i }}
            className="flex flex-col"
            style={{ gap: 'var(--mk-space-4)' }}
          >
            <h3 className="mk-h3">{heading}</h3>
            {/* Decorative: the heading above and the link list below carry
                the meaning, so the alt stays empty. */}
            <div className="overflow-hidden" style={{ borderRadius: 'clamp(12px, 1.2vw, 20px)' }}>
              <Image
                src={image}
                alt=""
                aria-hidden
                width={1564}
                height={1006}
                sizes="(max-width: 768px) 100vw, 560px"
                className="h-auto w-full"
              />
            </div>
            <ul className="flex flex-col" style={{ gap: 'var(--mk-space-2)' }}>
              {links.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="mk-link">
                    {label}
                    <ArrowUpRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
