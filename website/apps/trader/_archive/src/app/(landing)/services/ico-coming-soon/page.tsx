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
        title={<>ICO &amp; Early-Stage <span style={{ color: 'var(--mk-accent)' }}>Investments</span></>}
        lead={`Early access to promising blockchain projects, vetted by ${BRAND_NAME} before they hit the wider market. Coming soon — join the early-access list to be notified the moment the first round opens.`}
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
            { icon: ShieldCheck, title: 'Due-Diligence First', body: 'Every project undergoes a 6-stage review — team, tokenomics, audit, treasury, market fit, legal.' },
            { icon: Layers,      title: 'Multi-Stage Rounds',  body: 'Seed, private, and public tranches with transparent pricing and vesting schedules.' },
            { icon: Lock,        title: 'On-Chain Custody',    body: 'Allocations are claimed directly to your wallet — non-custodial from day one.' },
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
            { icon: Sparkles,    title: 'Curated Projects',     body: 'Hand-picked launchpad — quality over quantity. Expect 3–6 projects per quarter, not a daily firehose.' },
            { icon: Users,       title: 'Early-Access Tiers',   body: `Loyalty-based allocation tiers. Active ${BRAND_NAME} traders get priority access and higher allocation caps.` },
            { icon: Gem,         title: 'Discounted Entry',     body: `Strategic-round pricing for ${BRAND_NAME} investors — below public-sale rates, with vesting to align incentives.` },
            { icon: ShieldCheck, title: 'Audited Contracts',    body: 'No project lists without a clean audit from a tier-one firm and a published bug-bounty programme.' },
            { icon: Lock,        title: 'Vesting Transparency', body: 'Schedules published on-chain — see every team and investor unlock before you commit a dollar.' },
            { icon: Layers,      title: 'Secondary Liquidity',  body: 'Tokens go straight to your wallet — trade on any DEX from the moment vesting unlocks.' },
          ]}
        />
      </Section>

      <CtaBanner
        title="Be First in Line"
        lead={`Open a ${BRAND_NAME} account today — every trade you place between now and launch counts toward your early-access tier.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
      />
    </main>
  );
}
