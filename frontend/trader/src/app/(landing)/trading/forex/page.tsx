'use client';

/**
 * Trading → Forex. Restyled onto the shared marketing design system;
 * all copy, figures and instrument specs carried over from the previous
 * TradingPageTemplate-driven page.
 */
import { Zap, DollarSign, Lock } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const STATS = [
  { label: 'Spread From', value: '0.0 pips' },
  { label: 'Leverage', value: '1:500' },
  { label: 'Market Hours', value: '24/7' },
  { label: 'Currency Pairs', value: '60+' },
];

const INSTRUMENTS = [
  { symbol: 'EUR/USD', spread: '0.0 pips', leverage: '1:500', margin: '0.2%' },
  { symbol: 'GBP/USD', spread: '0.1 pips', leverage: '1:500', margin: '0.2%' },
  { symbol: 'USD/JPY', spread: '0.1 pips', leverage: '1:500', margin: '0.2%' },
  { symbol: 'AUD/USD', spread: '0.2 pips', leverage: '1:500', margin: '0.2%' },
  { symbol: 'USD/CHF', spread: '0.2 pips', leverage: '1:500', margin: '0.2%' },
  { symbol: 'EUR/GBP', spread: '0.3 pips', leverage: '1:500', margin: '0.2%' },
];

export default function ForexPage() {
  return (
    <main>
      <PageHero
        kicker="Forex"
        title="Forex support for your platform"
        lead="Give your clients 60+ currency pairs with configurable spreads and leverage — forex support built into the platform we deliver under your brand."
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Explore market coverage', href: '/markets' }}
      />

      <Section raised>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {STATS.map((s) => (
            <div key={s.label} className="mk-card text-center">
              <div
                className="font-extrabold"
                style={{ fontSize: 'var(--mk-text-h3)', color: 'var(--mk-accent)', lineHeight: 1.15 }}
              >
                {s.value}
              </div>
              <div
                className="mt-2"
                style={{
                  fontSize: 'var(--mk-text-label)',
                  letterSpacing: 'var(--mk-tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--mk-text-faint)',
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 mx-auto max-w-3xl mt-14 text-center">
          <h2 className="mk-h2">What is Forex Trading?</h2>
          <p className="mk-lead">
            {`Forex (foreign exchange) is the world's largest and most liquid financial market, with over $6 trillion traded daily. The platform ${BRAND_NAME} builds supports major, minor and exotic currency pairs, with tight configurable spreads, fast execution and advanced trading tools — everything your clients need in the forex market, delivered under your brand.`}
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="Instruments" title="Popular Currency Pairs" />
        <div className="mt-12 overflow-x-auto">
          <div
            className="min-w-[520px] overflow-hidden"
            style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius-lg)' }}
          >
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Instrument', 'Spread From', 'Max Leverage', 'Margin'].map((h, i) => (
                    <th
                      key={h}
                      className={i === 0 ? 'text-left px-5 py-4' : 'text-right px-5 py-4'}
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
                {INSTRUMENTS.map((i) => (
                  <tr key={i.symbol} style={{ borderTop: '1px solid var(--mk-line)', background: 'var(--mk-surface)' }}>
                    <td className="px-5 py-4 font-semibold" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}>{i.symbol}</td>
                    <td className="px-5 py-4 text-right" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', fontFamily: 'var(--mk-font-mono)' }}>{i.spread}</td>
                    <td className="px-5 py-4 text-right" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', fontFamily: 'var(--mk-font-mono)' }}>{i.leverage}</td>
                    <td className="px-5 py-4 text-right" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', fontFamily: 'var(--mk-font-mono)' }}>{i.margin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section raised>
        <SectionHeading kicker="Platform capability" title={`Forex on the ${BRAND_NAME} platform`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Zap,
              title: 'Fast Execution',
              body: 'Low-latency execution on institutional-grade infrastructure with zero requotes.',
            },
            {
              icon: DollarSign,
              title: 'Configurable Spreads',
              body: 'Set spreads on major pairs with transparent pricing wired to your own liquidity providers.',
            },
            {
              icon: Lock,
              title: 'Secure Platform',
              body: 'Hardened infrastructure with negative balance protection controls and role-based access built in.',
            },
          ]}
        />
      </Section>

      <CtaBanner
        title="Add forex to your platform"
        lead={`Book a demo and see how the ${BRAND_NAME} platform supports major, minor and exotic currency pairs under your brand.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Compare account tiers', href: '/account-types' }}
      />
    </main>
  );
}
