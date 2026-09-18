'use client';

/**
 * Trading → Commodities. Restyled onto the shared marketing design system;
 * all copy, figures and instrument specs carried over from the previous
 * TradingPageTemplate-driven page.
 */
import { Medal, Fuel, BarChart3 } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const STATS = [
  { label: 'Spread From', value: '0.3 pips' },
  { label: 'Leverage', value: '1:200' },
  { label: 'Instruments', value: '15+' },
  { label: 'Market Hours', value: '23/5' },
];

const INSTRUMENTS = [
  { symbol: 'XAU/USD (Gold)', spread: '0.3 pips', leverage: '1:200', margin: '0.5%' },
  { symbol: 'XAG/USD (Silver)', spread: '0.5 pips', leverage: '1:200', margin: '0.5%' },
  { symbol: 'WTI Crude Oil', spread: '3.0 pips', leverage: '1:100', margin: '1.0%' },
  { symbol: 'Brent Oil', spread: '3.0 pips', leverage: '1:100', margin: '1.0%' },
  { symbol: 'Natural Gas', spread: '0.5 pips', leverage: '1:100', margin: '1.0%' },
  { symbol: 'Copper', spread: '0.8 pips', leverage: '1:100', margin: '1.0%' },
];

export default function CommoditiesPage() {
  return (
    <main>
      <PageHero
        kicker="Commodities"
        title="Commodities support for your platform"
        lead="Give your clients top global commodities — metals, energy and more — with commodities support built into the platform we deliver under your brand."
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
          <h2 className="mk-h2">Why offer Commodities?</h2>
          <p className="mk-lead">
            {`Commodities offer excellent diversification opportunities and act as a hedge against inflation. The ${BRAND_NAME} platform supports precious metals like gold and silver, energy commodities like crude oil and natural gas, and more — with configurable spreads, flexible leverage and access to global commodity markets nearly around the clock, all under your brand.`}
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="Instruments" title="Popular Commodities" />
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
        <SectionHeading kicker="Platform capability" title={`Commodities on the ${BRAND_NAME} platform`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Medal,
              title: 'Precious Metals',
              body: 'Clients access gold, silver, platinum and palladium with configurable spreads and flexible leverage.',
            },
            {
              icon: Fuel,
              title: 'Energy Markets',
              body: 'Support for WTI and Brent crude oil, natural gas and other energy commodities with real-time pricing.',
            },
            {
              icon: BarChart3,
              title: 'Portfolio Diversification',
              body: 'Lets clients diversify against volatility and inflation by adding commodities to their portfolio.',
            },
          ]}
        />
      </Section>

      <CtaBanner
        title="Add commodities to your platform"
        lead={`Book a demo and see how the ${BRAND_NAME} platform supports metals, energy and global commodity markets under your brand.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Compare account tiers', href: '/account-types' }}
      />
    </main>
  );
}
