'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Section } from '@/marketing/components';
import { HOW_IT_WORKS, SIGNUP_HREF } from '../data';
import { BRAND_NAME } from '@/lib/brand';

/**
 * "Join" panel — the reference closes with a tinted rounded panel: the
 * numbered signup steps on the left, a portrait image on the right.
 *
 * Steps come from HOW_IT_WORKS so the homepage and the /how-it-works page
 * cannot drift apart.
 */
export function JoinPanel() {
  return (
    <Section>
      <div
        className="overflow-hidden"
        style={{
          background: 'var(--mk-bg-raised)',
          borderRadius: 'var(--mk-radius-lg)',
        }}
      >
        <div
          className="grid grid-cols-1 items-center lg:grid-cols-2"
          style={{ gap: 'var(--mk-space-7)', padding: 'clamp(1.75rem, 1rem + 3vw, 3.5rem)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col"
            style={{ gap: 'var(--mk-space-5)' }}
          >
            <div className="flex flex-col" style={{ gap: 'var(--mk-space-2)' }}>
              <h2 className="mk-h2">Join {BRAND_NAME}</h2>
              <p className="mk-lead">Get started in three simple steps.</p>
            </div>

            <ol className="flex flex-col" style={{ gap: 'var(--mk-space-4)' }}>
              {HOW_IT_WORKS.map(({ n, title, body }) => (
                <li key={n} className="flex items-start" style={{ gap: 'var(--mk-space-3)' }}>
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold"
                    style={{
                      background: 'var(--mk-accent)',
                      color: '#fff',
                      fontSize: 'var(--mk-text-xs)',
                    }}
                    aria-hidden
                  >
                    {n}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold" style={{ fontSize: 'var(--mk-text-body)' }}>
                      {title}
                    </span>
                    <span className="mk-body block" style={{ fontSize: 'var(--mk-text-sm)' }}>
                      {body}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            <div>
              <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">Start Trading</Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          >
            {/* The asset is already 4:3, so it drops straight into the
                footprint the placeholder reserved — nothing reflows. */}
            <div className="overflow-hidden" style={{ borderRadius: 'clamp(12px, 1.2vw, 20px)' }}>
              <Image
                src="/images/card banner3.png"
                alt={`Two traders pulling on the same rope, illustrating getting started with ${BRAND_NAME}`}
                width={1448}
                height={1086}
                sizes="(max-width: 1024px) 100vw, 560px"
                className="h-auto w-full"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}
