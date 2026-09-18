'use client';

/**
 * Demo Account — an account SPECIFICATION page, not a pricing plan.
 * Copy carried over verbatim from the previous Demo Account page; restyled
 * onto the shared marketing design system. Every CTA opens an account.
 */
import { Check, GraduationCap, BarChart3, RefreshCw } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';

const FEATURES = [
  'Identical to live trading environment',
  'Unlimited demo resets',
  'Access to all platforms (Web, Copy Trading)',
  'No credit card required',
  'Real-time market data',
  'Practice with $100,000 virtual funds',
  'Test trading strategies risk-free',
  'Learn platform features',
];

const SPECS = [
  { label: 'Virtual Funds', value: '$100,000' },
  { label: 'Cost', value: 'Free' },
  { label: 'Duration', value: 'Unlimited' },
  { label: 'Platforms', value: 'All' },
];

const STEPS = [
  { n: '1', title: 'Client signs up', body: 'A client creates a free demo account in seconds' },
  { n: '2', title: 'Choose platform', body: 'They pick Web Platform or Copy Trading' },
  { n: '3', title: 'Start practising', body: 'They practise with $100,000 virtual funds' },
];

export default function DemoAccountPage() {
  return (
    <main>
      <PageHero
        kicker="A risk-free demo tier"
        title="Give clients a $100,000 virtual-funds demo tier"
        lead="Let clients test strategies on live market conditions with virtual funds — a demo tier built into the platform we deliver under your brand. No credit card required."
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View live tiers', href: '/accounts/standard' }}
      />

      <Section raised>
        <SectionHeading kicker="Specifications" title="Account Conditions" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {SPECS.map((s) => (
            <div key={s.label} className="mk-card text-center">
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
          <h3 className="mk-h2 text-center">Demo Account Features</h3>
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
        <SectionHeading kicker="Benefits" title="Why offer a demo tier?" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: GraduationCap,
              title: 'Learn Risk-Free',
              body: 'Lets clients practise strategies and test their skills without risking real money.',
            },
            {
              icon: BarChart3,
              title: 'Real Market Conditions',
              body: 'Live market prices and conditions identical to a funded account.',
            },
            {
              icon: RefreshCw,
              title: 'Unlimited Resets',
              body: 'Clients can reset the demo anytime and start fresh with $100,000 virtual funds.',
            },
          ]}
        />
      </Section>

      <Section raised>
        <SectionHeading kicker="Getting Started" title="How clients get started" />
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {STEPS.map((s) => (
            <li key={s.n} className="mk-card mk-card--hover flex flex-col items-center text-center gap-3">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0 font-bold"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                {s.n}
              </span>
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <CtaBanner
        title="See the platform for yourself"
        lead={'Book a demo and see the demo tier and the live tiers running on the platform we build under your brand.'}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View live tiers', href: '/accounts/standard' }}
      />
    </main>
  );
}
