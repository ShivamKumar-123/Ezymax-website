'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { Section, SectionHeading } from '@/marketing/components';
import { REWARDS, SIGNUP_HREF } from '../data';

/**
 * Rewards band — large image-led cards, mirroring the reference's
 * "rewards and rebates" pair.
 *
 * The reference fills each card almost entirely with artwork and drops the
 * title and a "Learn more" link over the lower third, so the reserved
 * image area here is deliberately large (16:9) rather than a thumbnail.
 *
 * The pair became a single card when the first-deposit bonus promotion was
 * withdrawn, so the grid only splits into two columns when REWARDS actually
 * holds more than one entry — one card in a half-width column reads as a
 * layout bug rather than a deliberate feature.
 */
export function Rewards() {
  return (
    <Section raised>
      <SectionHeading
        kicker="Rewards"
        title="Earn more as you trade"
        lead="Earn commissions by introducing other traders to the platform."
      />

      <div
        className={`mx-auto grid grid-cols-1 ${
          REWARDS.length > 1 ? 'md:grid-cols-2' : 'max-w-2xl'
        }`}
        style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
      >
        {REWARDS.map(({ image, title, body, href }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 * i }}
          >
            <Link href={href} className="mk-card mk-card--hover flex h-full flex-col gap-5">
              {/* Artwork replaces the reserved placeholder box. The source is
                  1564×1006, within a hair of the 1120×720 the slot was built
                  around, so the card holds its shape — and the slot takes the
                  file's own ratio rather than the old 16:9, which would have
                  cropped through the figures at both edges. Decorative: the
                  heading below carries the meaning, so alt stays empty. */}
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: '1564 / 1006', borderRadius: 'var(--mk-radius)' }}
              >
                <Image
                  src={image}
                  alt=""
                  aria-hidden
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 672px"
                />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="mk-h3">{title}</h3>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
                <span className="mk-link" style={{ marginTop: 'var(--mk-space-2)' }}>
                  Learn more
                  <ArrowUpRight size={15} />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div
        className="flex flex-wrap items-center justify-center"
        style={{ gap: 'var(--mk-space-3)', marginTop: 'var(--mk-space-7)' }}
      >
        <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">Start Trading</Link>
        <Link href="/accounts/demo" className="mk-btn mk-btn--ghost">Open a demo account</Link>
      </div>
    </Section>
  );
}
