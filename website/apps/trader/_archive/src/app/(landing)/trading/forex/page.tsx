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
        title="Trade Forex with Confidence"
        lead="Access 60+ currency pairs with spreads from 0.0 pips and leverage up to 1:500."
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Explore All Markets', href: '/markets' }}
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
            {`Forex (foreign exchange) is the world's largest and most liquid financial market, with over $6 trillion traded daily. Trade major, minor, and exotic currency pairs with ${BRAND_NAME} and benefit from tight spreads, fast execution, and advanced trading tools. Whether you're a beginner or professional trader, our platform provides everything you need to succeed in the forex market.`}
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
        <SectionHeading kicker="Why Trade Here" title={`Forex Trading with ${BRAND_NAME}`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Zap,
              title: 'Lightning-Fast Execution',
              body: 'Execute trades in under 30ms with our institutional-grade infrastructure and zero requotes.',
            },
            {
              icon: DollarSign,
              title: 'Competitive Spreads',
              body: 'Enjoy spreads from 0.0 pips on major pairs and transparent pricing with no hidden fees.',
            },
            {
              icon: Lock,
              title: 'Secure Trading',
              body: 'Your funds are protected in segregated accounts with tier-1 banks and negative balance protection.',
            },
          ]}
        />
      </Section>

      <CtaBanner
        title="Trade Forex with Confidence"
        lead={`Open a ${BRAND_NAME} account and start trading major, minor, and exotic currency pairs.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Compare Account Types', href: '/account-types' }}
      />
    </main>
  );
}
