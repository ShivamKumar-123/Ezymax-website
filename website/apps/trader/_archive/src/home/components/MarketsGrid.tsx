'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { Section, SectionHeading } from '@/marketing/components';
import { INSTRUMENTS } from '../data';
import { BRAND_NAME } from '@/lib/brand';

/**
 * "All markets in one account" — the reference's 3×2 product grid.
 *
 * Each tile reserves a 4:3 image area above the title, matching the
 * reference's product artwork. The lucide icon sits inside the reserved
 * box as a marker so the card still reads before real artwork lands;
 * swap the box for an <Image> and nothing reflows.
 */
export function MarketsGrid() {
  return (
    // tight-top: this section follows the full-bleed ticker strip, which
    // already separates it from the hero, so a full section-y on top reads
    // as dead space.
    <Section id="markets" className="mk-section--tight-top">
      <SectionHeading
        kicker="Markets"
        title="Access global markets all in one account"
        lead={`Trade major, minor and exotic currency pairs — plus indices, metals and digital assets — from a single ${BRAND_NAME} login.`}
      />

      <div className="mt-4 flex justify-center">
        <Link href="/markets" className="mk-link">
          View all markets
          <ArrowUpRight size={15} />
        </Link>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
      >
        {INSTRUMENTS.map(({ image, title, body, href }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 * i }}
          >
            <Link href={href} className="mk-card mk-card--hover flex h-full flex-col gap-4">
              {/* Artwork replaces the reserved placeholder box. The source
                  files are 4:3 (1448×1086), which is the ratio the slot was
                  built around, so nothing reflowed when they landed.
                  Decorative: the heading below carries the meaning, so alt
                  stays empty. */}
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: '4 / 3', borderRadius: 'var(--mk-radius)' }}
              >
                <Image
                  src={image}
                  alt=""
                  aria-hidden
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="mk-h3">{title}</h3>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
