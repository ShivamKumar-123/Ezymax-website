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
        title="Trade Gold, Oil & More"
        lead="Diversify your portfolio with top global commodities at competitive rates."
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
          <h2 className="mk-h2">Why Trade Commodities?</h2>
          <p className="mk-lead">
            {`Commodities offer excellent diversification opportunities and act as a hedge against inflation. Trade precious metals like gold and silver, energy commodities like crude oil and natural gas, and agricultural products with ${BRAND_NAME}. Benefit from competitive spreads, flexible leverage, and access to global commodity markets 23 hours a day.`}
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
        <SectionHeading kicker="Why Trade Here" title={`Commodity Trading with ${BRAND_NAME}`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Medal,
              title: 'Trade Precious Metals',
              body: 'Access gold, silver, platinum, and palladium with tight spreads and flexible leverage options.',
            },
            {
              icon: Fuel,
              title: 'Energy Markets',
              body: 'Trade WTI and Brent crude oil, natural gas, and other energy commodities with real-time pricing.',
            },
            {
              icon: BarChart3,
              title: 'Portfolio Diversification',
              body: 'Hedge against market volatility and inflation by adding commodities to your trading portfolio.',
            },
          ]}
        />
      </Section>

      <CtaBanner
        title="Trade Gold, Oil & More"
        lead={`Open a ${BRAND_NAME} account and diversify into metals, energy, and global commodity markets.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Compare Account Types', href: '/account-types' }}
      />
    </main>
  );
}
