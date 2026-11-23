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
  'Raw spreads from 0.0 pips',
  'Free VPS hosting',
  'Dedicated account manager',
  'Advanced trading tools',
  'Institutional-grade execution',
  'Premium market research',
  'Exclusive trading signals',
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
        kicker="For Experienced & Professional Traders"
        title="Pro Account"
        lead="Experience professional-grade trading with raw spreads, priority support, and exclusive benefits designed for serious traders."
        primary={{ label: 'Open Pro Account', href: '/auth/register' }}
        secondary={{ label: 'Compare All Accounts', href: '/account-types' }}
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
              title: 'Dedicated Manager',
              body: 'Get a personal account manager who understands your trading needs and provides tailored support.',
            },
            {
              icon: Monitor,
              title: 'Free VPS Hosting',
              body: 'Run your Expert Advisors 24/7 with our complimentary VPS hosting service.',
            },
            {
              icon: Zap,
              title: 'Raw Spreads',
              body: 'Access institutional-grade pricing with spreads from 0.0 pips on major pairs.',
            },
          ]}
        />
      </Section>

      <CtaBanner
        title="Elevate Your Trading"
        lead="Join the elite. Open a Pro Account and experience professional-grade trading."
        primary={{ label: 'Open Pro Account', href: '/auth/register' }}
        secondary={{ label: 'Compare All Accounts', href: '/account-types' }}
      />
    </main>
  );
}
