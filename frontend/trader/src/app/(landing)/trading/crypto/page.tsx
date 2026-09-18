'use client';

/**
 * Trading → Crypto CFDs. Restyled onto the shared marketing design system;
 * all copy, figures and instrument specs carried over from the previous
 * TradingPageTemplate-driven page.
 */
import { ShieldCheck, Zap, TrendingDown } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const STATS = [
  { label: 'Spread From', value: '0.5%' },
  { label: 'Leverage', value: '1:50' },
  { label: 'Cryptocurrencies', value: '25+' },
  { label: 'Market Hours', value: '24/7' },
];

const INSTRUMENTS = [
  { symbol: 'BTC/USD (Bitcoin)', spread: '0.5%', leverage: '1:50', margin: '2.0%' },
  { symbol: 'ETH/USD (Ethereum)', spread: '0.6%', leverage: '1:50', margin: '2.0%' },
  { symbol: 'SOL/USD (Solana)', spread: '0.8%', leverage: '1:25', margin: '4.0%' },
  { symbol: 'XRP/USD (Ripple)', spread: '0.7%', leverage: '1:25', margin: '4.0%' },
  { symbol: 'BNB/USD (Binance)', spread: '0.7%', leverage: '1:25', margin: '4.0%' },
  { symbol: 'ADA/USD (Cardano)', spread: '0.8%', leverage: '1:25', margin: '4.0%' },
];

export default function CryptoPage() {
  return (
    <main>
      <PageHero
        kicker="Crypto CFDs"
        title="Crypto CFD support for your platform"
        lead="Let your clients trade Bitcoin, Ethereum and top altcoins as CFDs without owning the asset — crypto support built into the platform we deliver under your brand."
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
          <h2 className="mk-h2">Why offer Crypto CFDs?</h2>
          <p className="mk-lead">
            {`Cryptocurrency CFDs let clients speculate on the price movements of Bitcoin, Ethereum and other digital assets without the complexity of owning and storing them. The ${BRAND_NAME} platform supports crypto CFDs around the clock, long or short, with a secure engine and configurable spreads — ideal for the clients you serve who want crypto exposure with the flexibility of traditional CFD trading.`}
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="Instruments" title="Popular Crypto CFDs" />
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
        <SectionHeading kicker="Platform capability" title={`Crypto CFDs on the ${BRAND_NAME} platform`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: ShieldCheck,
              title: 'No Wallet Needed',
              body: 'Clients trade crypto CFDs without managing wallets, private keys or exchange accounts.',
            },
            {
              icon: Zap,
              title: '24/7 Markets',
              body: 'Around-the-clock access to cryptocurrency markets, every day of the week, with instant execution.',
            },
            {
              icon: TrendingDown,
              title: 'Go Long or Short',
              body: 'Clients can act on both rising and falling crypto prices, with the ability to short-sell any instrument.',
            },
          ]}
        />
      </Section>

      <CtaBanner
        title="Add crypto CFDs to your platform"
        lead={`Book a demo and see how the ${BRAND_NAME} platform supports Bitcoin, Ethereum and top altcoins as CFDs under your brand.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Compare account tiers', href: '/account-types' }}
      />
    </main>
  );
}
