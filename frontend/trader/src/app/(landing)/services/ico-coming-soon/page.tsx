'use client';

import { useState } from 'react';
import { Gem, ShieldCheck, Layers, Users, Lock, Bell, Sparkles } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Services → ICO (coming soon). Restyled onto the shared marketing design
 * system. The early-access notify form keeps its original local-state
 * behaviour; all copy is carried over unchanged.
 */

export default function IcoComingSoonPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  return (
    <main>
      <PageHero
        kicker="Coming Soon"
        title={<>Token Launch &amp; ICO <span style={{ color: 'var(--mk-accent)' }}>Tooling</span></>}
        lead={`A launchpad module for running vetted token sales on your platform — due-diligence workflow, multi-stage rounds, vesting, and on-chain claims. Coming soon — join the ${BRAND_NAME} early-access list to hear the moment it ships.`}
      >
        {/* Notify form */}
        <form onSubmit={onSubmit} className="w-full max-w-xl mt-4">
          {submitted ? (
            <div
              className="font-bold"
              style={{
                background: 'var(--mk-surface)',
                border: '1px solid var(--mk-accent-line)',
                borderRadius: 'var(--mk-radius-pill)',
                padding: '0.85rem 1.25rem',
                fontSize: 'var(--mk-text-sm)',
                color: 'var(--mk-accent)',
              }}
            >
              You&apos;re on the list. We&apos;ll email{' '}
              <span style={{ color: 'var(--mk-text)' }}>{email}</span> at launch.
            </div>
          ) : (
            <div
              className="flex items-center gap-2"
              style={{
                background: 'var(--mk-surface)',
                border: '1px solid var(--mk-line)',
                borderRadius: 'var(--mk-radius-pill)',
                padding: '0.35rem',
              }}
            >
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 min-w-0 bg-transparent px-4 py-2 outline-none"
                style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}
                aria-label="Email address for ICO launch notification"
              />
              <button type="submit" className="mk-btn mk-btn--primary shrink-0">
                Notify Me <Bell size={16} />
              </button>
            </div>
          )}
          <p className="mt-3" style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>
            No spam. One email at launch. You can unsubscribe with one click.
          </p>
        </form>
      </PageHero>

      {/* Countdown / target */}
      <Section raised>
        <SectionHeading kicker="Launch" title="Coming Soon" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: ShieldCheck, title: 'Built-In Due Diligence', body: 'A structured review workflow — team, tokenomics, audit, treasury, market fit, and legal — before a project can be listed.' },
            { icon: Layers,      title: 'Multi-Stage Rounds',  body: 'Configure seed, private, and public tranches with transparent pricing and vesting schedules.' },
            { icon: Lock,        title: 'On-Chain Claims',     body: 'Allocations settle straight to investor wallets, on-chain.' },
          ]}
        />
      </Section>

      {/* What to expect */}
      <Section>
        <SectionHeading kicker="Roadmap" title="What to Expect at Launch" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Sparkles,    title: 'Curated Launchpad',    body: 'Quality over quantity — the module is built for a handful of vetted projects, not a daily firehose.' },
            { icon: Users,       title: 'Loyalty-Based Tiers',  body: 'Reward your most active clients with priority access and higher allocation caps, tied to the loyalty rules you set.' },
            { icon: Gem,         title: 'Strategic-Round Pricing', body: 'Offer strategic-round pricing to selected clients — below public-sale rates, with vesting to align incentives.' },
            { icon: ShieldCheck, title: 'Audit Requirements',   body: 'Enforce listing rules — a clean contract audit and a published bug-bounty programme — before a project goes live.' },
            { icon: Lock,        title: 'Vesting Transparency', body: 'Vesting schedules are published on-chain, so every team and investor unlock is visible before anyone commits.' },
            { icon: Layers,      title: 'Secondary Liquidity',  body: 'Tokens settle to investor wallets — tradable on any DEX from the moment vesting unlocks.' },
          ]}
        />
      </Section>

      <CtaBanner
        title="Be First in Line"
        lead={`Book a demo to see the ${BRAND_NAME} launchpad roadmap and how token-sale tooling will fit into your platform.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
      />
    </main>
  );
}
