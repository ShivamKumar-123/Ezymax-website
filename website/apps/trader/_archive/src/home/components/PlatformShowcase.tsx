'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Section } from '@/marketing/components';
import { PLATFORM_FEATURES } from '../data';

/**
 * Platform showcase — the reference's two-column band: a large product
 * screenshot on the left, and a headline plus ticked capability list with
 * a single CTA on the right.
 *
 * The image side renders at the asset's own 4:3 ratio rather than the 3:2
 * the placeholder reserved — the shot is a centred laptop composition on a
 * gradient ground, so cropping it to a wider box would clip the frame.
 */
export function PlatformShowcase() {
  return (
    <Section id="platforms">
      <div
        className="grid grid-cols-1 items-center lg:grid-cols-2"
        style={{ gap: 'var(--mk-space-8)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="overflow-hidden" style={{ borderRadius: 'clamp(12px, 1.2vw, 20px)' }}>
            <Image
              src="/images/hero banner 4.png"
              alt="The trading platform running on a laptop, showing a live chart and the order ticket"
              width={1448}
              height={1086}
              sizes="(max-width: 1024px) 100vw, 560px"
              className="h-auto w-full"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          className="flex flex-col"
          style={{ gap: 'var(--mk-space-5)' }}
        >
          <h2 className="mk-h2">Trade on a platform built for currencies</h2>

          <ul className="flex flex-col" style={{ gap: 'var(--mk-space-3)' }}>
            {PLATFORM_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start" style={{ gap: 'var(--mk-space-3)' }}>
                <span
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                  aria-hidden
                >
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className="mk-body" style={{ color: 'var(--mk-text)' }}>{feature}</span>
              </li>
            ))}
          </ul>

          <div>
            <Link href="/platforms/web" className="mk-btn mk-btn--primary">Explore platforms</Link>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}
