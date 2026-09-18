'use client';

/**
 * Standard Account — an account SPECIFICATION page, not a pricing plan.
 * Copy carried over verbatim from the previous Standard Account page;
 * restyled onto the shared marketing design system. Every CTA opens an
 * account (no checkout, no plan selection).
 */
import { Check } from 'lucide-react';
import { Section, SectionHeading, PageHero, CtaBanner } from '@/marketing/components';

const FEATURES = [
  'Free educational content',
  '24/7 customer support',
  'Negative balance protection',
  'Access to all trading platforms',
  'No hidden fees',
  'Free deposits & withdrawals',
  'Real-time market data',
  'Mobile trading apps',
];

const SPECS = [
  { label: 'Min Deposit', value: '$100' },
  { label: 'Spreads From', value: '1.1 pips' },
  { label: 'Leverage', value: '1:500' },
  { label: 'Commission', value: 'None' },
];

const COMPARISON = [
  { feature: 'Minimum Deposit', standard: '$100', pro: '$5,000', demo: '$0' },
  { feature: 'Spreads From', standard: '1.1 pips', pro: '0.0 pips', demo: 'Live spreads' },
  { feature: 'Leverage', standard: 'Up to 1:500', pro: 'Up to 1:200', demo: 'Up to 1:500' },
  { feature: 'Commission', standard: 'None', pro: '$3.5/lot', demo: 'None' },
  { feature: 'Platforms', standard: 'Web, Copy Trading', pro: 'Web, Copy Trading', demo: 'Web, Copy Trading' },
  { feature: 'Support', standard: '24/7', pro: 'Priority 24/7', demo: '24/7' },
];

export default function StandardAccountPage() {
  return (
    <main>
      <PageHero
        kicker="For Beginners & Retail Traders"
        title="Standard Account"
        lead="Start your trading journey with our beginner-friendly Standard Account. Low minimum deposit, competitive spreads, and no commission."
        primary={{ label: 'Open Standard Account', href: '/auth/register' }}
        secondary={{ label: 'Try Demo First', href: '/accounts/demo' }}
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
          <h3 className="mk-h2 text-center">Account Features</h3>
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
        <SectionHeading kicker="Side by Side" title="Compare Account Types" />

        <div className="mt-12 overflow-x-auto">
          <div
            className="min-w-[560px] overflow-hidden"
            style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius-lg)' }}
          >
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Feature', 'Standard', 'Pro', 'Demo'].map((h, i) => (
                    <th
                      key={h}
                      className={i === 0 ? 'text-left px-5 py-4' : 'text-center px-5 py-4'}
                      style={{
                        background: 'var(--mk-surface-2)',
                        color: 'var(--mk-accent)',
                        fontSize: 'var(--mk-text-label)',
                        letterSpacing: 'var(--mk-tracking-label)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} style={{ borderTop: '1px solid var(--mk-line)' }}>
                    <td className="px-5 py-4" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', background: 'var(--mk-surface-2)' }}>
                      {row.feature}
                    </td>
                    <td className="px-5 py-4 text-center font-semibold" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)', background: 'var(--mk-surface)' }}>
                      {row.standard}
                    </td>
                    <td className="px-5 py-4 text-center" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', background: 'var(--mk-surface)' }}>
                      {row.pro}
                    </td>
                    <td className="px-5 py-4 text-center" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', background: 'var(--mk-surface)' }}>
                      {row.demo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <CtaBanner
        title="Ready to Start Trading?"
        lead="Open your Standard Account today with just $100 and start trading global markets."
        primary={{ label: 'Open Standard Account', href: '/auth/register' }}
        secondary={{ label: 'Try Demo First', href: '/accounts/demo' }}
      />
    </main>
  );
}
