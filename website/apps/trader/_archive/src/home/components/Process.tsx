'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { Section, SectionHeading } from '@/marketing/components';
import { SIGNUP_HREF } from '../data';
import { BRAND_NAME } from '@/lib/brand';

/* Three steps only — the account tiers / "choose your plan" step was
   dropped with the pricing section the client asked us to remove. */
const STEPS = [
  { n: 1, title: 'Open an Account', body: 'Register and complete verification to activate live trading.' },
  { n: 2, title: 'Fund',            body: 'Deposit by bank transfer, card, e-wallet or crypto.' },
  { n: 3, title: 'Trade',           body: `Trade major, minor and exotic currency pairs from your ${BRAND_NAME} account.` },
];

export function Process() {
  return (
    <Section id="process">
      <SectionHeading
        kicker="How It Works"
        title="Start trading in three steps"
        lead="From registration to your first live position on the currency markets."
      />

      <div
        className="grid grid-cols-1 md:grid-cols-3"
        style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
      >
        {STEPS.map((step, i) => (
          <motion.article
            key={step.n}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 * i }}
            className="mk-card mk-card--hover relative flex flex-col"
            style={{ gap: 'var(--mk-space-3)' }}
          >
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-full font-extrabold"
              style={{
                background: 'var(--mk-accent-soft)',
                border: '1px solid var(--mk-accent-line)',
                color: 'var(--mk-accent)',
                fontSize: 'var(--mk-text-sm)',
              }}
              aria-hidden
            >
              {String(step.n).padStart(2, '0')}
            </span>
            <h3 className="mk-h3">{step.title}</h3>
            <p className="mk-body">{step.body}</p>
          </motion.article>
        ))}
      </div>

      <div
        className="flex flex-wrap items-center justify-center"
        style={{ gap: 'var(--mk-space-3)', marginTop: 'var(--mk-space-7)' }}
      >
        <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">
          Start Trading
          <ArrowUpRight size={16} />
        </Link>
        <Link href="/markets" className="mk-btn mk-btn--ghost">
          Explore Markets
        </Link>
      </div>
    </Section>
  );
}
