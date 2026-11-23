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
        title="Crypto CFDs — Trade the Future"
        lead="Trade Bitcoin, Ethereum, and top altcoins as CFDs without owning the asset."
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
          <h2 className="mk-h2">Why Trade Crypto CFDs?</h2>
          <p className="mk-lead">
            {`Cryptocurrency CFDs allow you to speculate on the price movements of Bitcoin, Ethereum, and other digital assets without the complexity of owning and storing them. Trade crypto 24/7 with leverage, go long or short, and benefit from ${BRAND_NAME}'s secure platform and competitive spreads. Perfect for traders who want exposure to the crypto market with the flexibility of traditional CFD trading.`}
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
        <SectionHeading kicker="Why Trade Here" title={`Crypto CFD Trading with ${BRAND_NAME}`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: ShieldCheck,
              title: 'No Wallet Needed',
              body: 'Trade crypto CFDs without the hassle of managing wallets, private keys, or exchange accounts.',
            },
            {
              icon: Zap,
              title: '24/7 Trading',
              body: 'Access cryptocurrency markets around the clock, every day of the week with instant execution.',
            },
            {
              icon: TrendingDown,
              title: 'Go Long or Short',
              body: 'Profit from both rising and falling crypto prices with the ability to short sell any instrument.',
            },
          ]}
        />
      </Section>

      <CtaBanner
        title="Crypto CFDs — Trade the Future"
        lead={`Open a ${BRAND_NAME} account and trade Bitcoin, Ethereum, and top altcoins as CFDs.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Compare Account Types', href: '/account-types' }}
      />
    </main>
  );
}
