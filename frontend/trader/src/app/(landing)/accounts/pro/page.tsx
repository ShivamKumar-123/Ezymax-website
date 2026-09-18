'use client';

/**
 * Pro Account — an account SPECIFICATION page, not a pricing plan.
 * Copy carried over verbatim from the previous Pro Account page; restyled
 * onto the shared marketing design system. Every CTA opens an account.
 */
import { Check, Crown, Monitor, Zap } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';

const FEATURES = [
  'Priority 24/7 support',
  'Raw-spread pricing configuration',
  'VPS hosting support',
  'Dedicated account manager tooling',
  'Advanced trading tools',
  'Institutional-grade execution routing',
  'Market research module',
  'Trading signals module',
];

const SPECS = [
  { label: 'Min Deposit', value: '$5,000' },
  { label: 'Spreads From', value: '0.0 pips' },
  { label: 'Leverage', value: '1:200' },
  { label: 'Commission', value: '$3.5/lot' },
];

export default function ProAccountPage() {
  return (
    <main>
      <PageHero
        kicker="A premium account tier"
        title="Pro Account"
        lead="The premium tier your desk can offer power users — raw spreads, priority support and advanced tooling, all configurable in the platform we build under your brand."
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Compare account tiers', href: '/account-types' }}
      />

      <Section raised>
        <SectionHeading kicker="Specifications" title="Account Conditions" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {SPECS.map((s) => (
            <div key={s.label} className="mk-card text-center" style={{ borderColor: 'var(--mk-accent-line)' }}>
              <div
                style={{
                  fontSize: 'var(--mk-text-label)',
                  letterSpacing: 'var(--mk-tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--mk-text-faint)',
                }}
              >
                {s.label}
              </div>
              <div
                className="mt-2 font-extrabold"
                style={{ fontSize: 'var(--mk-text-h3)', color: 'var(--mk-accent)', lineHeight: 1.15 }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-4xl mt-14">
          <h3 className="mk-h2 text-center">Premium Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            {FEATURES.map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <Check size={18} className="mt-1 shrink-0" style={{ color: 'var(--mk-accent)' }} />
                <span className="mk-body">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="What You Get" title="Built for Professional Traders" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Crown,
              title: 'Dedicated Manager Tooling',
              body: 'Built-in tools so your desk can give top clients a dedicated account manager and tailored support.',
            },
            {
              icon: Monitor,
              title: 'VPS Hosting Support',
              body: 'Lets clients run Expert Advisors 24/7 with VPS hosting the platform supports.',
            },
            {
              icon: Zap,
              title: 'Raw Spreads',
              body: 'Wire in institutional-grade pricing with raw spreads on major pairs, configured to your liquidity.',
            },
          ]}
        />
      </Section>

      <CtaBanner
        title="Offer a Pro tier under your brand"
        lead="Configure a professional-grade Pro tier in the platform we build and launch it to your clients under your own brand."
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Compare account tiers', href: '/account-types' }}
      />
    </main>
  );
}
