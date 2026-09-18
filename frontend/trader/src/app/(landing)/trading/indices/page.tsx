'use client';

/**
 * Trading → Indices. Restyled onto the shared marketing design system;
 * all copy, figures and instrument specs carried over from the previous
 * TradingPageTemplate-driven page.
 */
import { Globe, TrendingUp, Clock } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const STATS = [
  { label: 'Spread From', value: '0.4 pips' },
  { label: 'Leverage', value: '1:200' },
  { label: 'Indices', value: '20+' },
  { label: 'Market Hours', value: '24/7' },
];

const INSTRUMENTS = [
  { symbol: 'US500 (S&P 500)', spread: '0.4 pips', leverage: '1:200', margin: '0.5%' },
  { symbol: 'NAS100 (NASDAQ)', spread: '0.6 pips', leverage: '1:200', margin: '0.5%' },
  { symbol: 'UK100 (FTSE 100)', spread: '0.8 pips', leverage: '1:200', margin: '0.5%' },
  { symbol: 'GER40 (DAX 40)', spread: '0.8 pips', leverage: '1:200', margin: '0.5%' },
  { symbol: 'JPN225 (Nikkei)', spread: '1.0 pips', leverage: '1:200', margin: '0.5%' },
  { symbol: 'AUS200 (ASX 200)', spread: '1.0 pips', leverage: '1:200', margin: '0.5%' },
];

export default function IndicesPage() {
  return (
    <main>
      <PageHero
        kicker="Indices"
        title={'Indices support for your platform'}
        lead="Give your clients exposure to US500, UK100, GER40 and more — index support built into the platform we deliver under your brand."
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
          <h2 className="mk-h2">What are Index CFDs?</h2>
          <p className="mk-lead">
            {`Index trading lets clients speculate on the performance of entire markets or sectors without buying individual stocks. The ${BRAND_NAME} platform supports popular indices like the S&P 500, NASDAQ 100, FTSE 100 and DAX 40, with lower margin requirements, extended trading hours and the ability to go long or short on market movements — all under your brand.`}
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="Instruments" title="Popular Index CFDs" />
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
        <SectionHeading kicker="Platform capability" title={`Indices on the ${BRAND_NAME} platform`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Globe,
              title: 'Global Market Access',
              body: 'Clients reach major indices from the US, Europe, Asia and Australia, all from one platform.',
            },
            {
              icon: TrendingUp,
              title: 'Low Margin Requirements',
              body: 'Support for large positions with configurable margin rates and flexible leverage up to 1:200.',
            },
            {
              icon: Clock,
              title: 'Extended Trading Hours',
              body: 'Clients trade indices nearly around the clock, with access to both cash and futures contracts.',
            },
          ]}
        />
      </Section>

      <CtaBanner
        title={'Add indices to your platform'}
        lead={`Book a demo and see how the ${BRAND_NAME} platform supports the major US, European and Asian indices under your brand.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Compare account tiers', href: '/account-types' }}
      />
    </main>
  );
}
