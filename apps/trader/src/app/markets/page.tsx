import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead, Reveal } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { CtaBand } from '@/components/ui/CtaBand';
import { MarketsTable } from '@/components/market/MarketsTable';
import { PixelStat } from '@/components/motion/PixelStat';
import { INSTRUMENTS, LEVERAGE } from '@/content/facts';
import { REGISTER_HREF } from '@/lib/crm';

export const metadata: Metadata = {
  title: 'Markets: 1,389 instruments across forex, metals, energies, indices, crypto and stocks',
  description:
    'Trade CFDs on 63 forex pairs, 16 metals, 4 energies, 34 indices and 167 cryptocurrencies, with 1,100 US, Hong Kong and Tokyo stocks coming soon. Search every instrument with live prices.',
  alternates: { canonical: '/markets' },
};

const CLASSES = [
  {
    id: 'forex',
    name: 'Forex',
    total: INSTRUMENTS.byClass.forex.total,
    live: INSTRUMENTS.byClass.forex.live,
    lev: `Up to 1:${LEVERAGE.coreCaps.forex} on majors`,
    hours: '24 hours, Monday to Friday',
    eg: 'EURUSD · GBPUSD · USDJPY · AUDUSD · EURGBP · USDCNH',
    d: 'Majors, minors and exotics, priced from the interbank feed with spreads measured on the live stream.',
  },
  {
    id: 'metals',
    name: 'Metals',
    total: INSTRUMENTS.byClass.metals.total,
    live: INSTRUMENTS.byClass.metals.live,
    lev: `Up to 1:${LEVERAGE.coreCaps.metals} on gold`,
    hours: '24 hours, Monday to Friday, with a 1-hour daily break',
    eg: 'XAUUSD · XAGUSD · XPTUSD · copper',
    d: 'Gold and silver against the dollar, platinum, copper and more.',
  },
  {
    id: 'energies',
    name: 'Energies',
    total: INSTRUMENTS.byClass.energies.total,
    live: INSTRUMENTS.byClass.energies.live,
    lev: `Up to 1:${LEVERAGE.coreCaps.energies}`,
    hours: '23 hours, Monday to Friday',
    eg: 'USOIL (WTI) · UKOIL (Brent) · natural gas',
    d: 'Crude oil benchmarks and natural gas.',
  },
  {
    id: 'indices',
    name: 'Indices',
    total: INSTRUMENTS.byClass.indices.total,
    live: INSTRUMENTS.byClass.indices.live,
    lev: `Up to 1:${LEVERAGE.coreCaps.indices}`,
    hours: 'Cash indices on their exchange hours',
    eg: 'US30 · NAS100 · SPX500 · GER40 · UK100 · JP225 · HK50',
    d: 'The world’s benchmark stock indices, from Wall Street to Frankfurt, London, Tokyo and Hong Kong.',
  },
  {
    id: 'crypto',
    name: 'Crypto',
    total: INSTRUMENTS.byClass.crypto.total,
    live: INSTRUMENTS.byClass.crypto.live,
    lev: `Up to 1:${LEVERAGE.coreCaps.crypto}`,
    hours: '24/7, weekends included',
    eg: 'BTCUSD · ETHUSD · SOLUSD · XRPUSD · BNBUSD · DOGEUSD',
    d: 'Bitcoin, Ethereum and over 150 more coins against the dollar, long or short, around the clock.',
  },
  {
    id: 'stocks',
    name: 'Stocks',
    total: INSTRUMENTS.byClass.stocks.total,
    live: INSTRUMENTS.byClass.stocks.live,
    lev: `Up to 1:${LEVERAGE.coreCaps.stocks}`,
    hours: 'Exchange hours (US 09:30–16:00 New York)',
    eg: 'AAPL · NVDA · TSLA · META · NFLX · 00700.HK (Tencent) · 7203.JP (Toyota)',
    d: '800 US, 150 Hong Kong and 150 Tokyo stocks on demo now, coming to live accounts soon. Apple, NVIDIA, Tesla, Meta and Netflix are live today.',
    soon: true,
  },
];

export default function MarketsPage() {
  return (
    <>
      <PageHero
        kicker="Markets"
        lines={['1,389 instruments.', <span key="b" className="text-fg-3">Six asset classes.</span>]}
        lead={`Forex, metals, energies, indices and crypto, with ${INSTRUMENTS.liveMarkets} markets live on real-money accounts today and 1,100 stocks coming soon. Every instrument is on demo.`}
        actions={
          <>
            <Button href={REGISTER_HREF}>Open account</Button>
            <Button href="#list" variant="outline" arrow={false}>
              Search the list
            </Button>
          </>
        }
        visual={
          <div className="glass grid grid-cols-2 gap-px overflow-hidden rounded-[30px] bg-white/[0.06] p-0 sm:grid-cols-3">
            {CLASSES.map((c) => (
              <a key={c.id} href={`/markets?class=${c.id}#list`} className="group bg-ink/80 p-5 transition-colors hover:bg-ink-3 sm:p-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-fg-3">{c.name}</p>
                <PixelStat value={c.total} className="t-pixel mt-4 block text-[2.6rem] sm:text-[3rem]" />
                <p className="mt-2 text-[12px] text-fg-2">{c.soon ? `${c.live} live · rest soon` : c.live === c.total ? 'All live' : `${c.live} live`}</p>
              </a>
            ))}
          </div>
        }
      />

      <section className="section" aria-labelledby="classes-title">
        <div className="container-site">
          <SectionHead
            id="classes-title"
            kicker="Asset classes"
            lines={['Every market', 'that moves.']}
            lead="CFDs let you go long or short with leverage, without owning the asset. The maximum leverage on a trade is the lower of your account’s leverage and the instrument’s own cap."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {CLASSES.map((c, i) => (
              <Reveal key={c.id} delay={(i % 3) * 0.05} className="card card-hover flex flex-col p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="t-h3">{c.name}</h3>
                  {c.soon ? <span className="chip chip-ember">Coming soon</span> : <span className="chip">{c.total} instruments</span>}
                </div>
                <p className="t-body mt-3">{c.d}</p>
                <dl className="mt-6 flex flex-col gap-2 text-sm">
                  <div className="flex justify-between gap-4 border-t border-white/[0.07] pt-2.5">
                    <dt className="text-fg-3">Leverage</dt>
                    <dd className="text-right">{c.lev}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-white/[0.07] pt-2.5">
                    <dt className="text-fg-3">Hours</dt>
                    <dd className="text-right">{c.hours}</dd>
                  </div>
                </dl>
                <p className="mt-5 text-[12px] leading-relaxed text-fg-3">{c.eg}</p>
                <a href={`/markets?class=${c.id}#list`} className="prose-link mt-5 self-start text-sm">
                  See all {c.name.toLowerCase()}
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="list" className="section scroll-mt-24 pt-0" aria-labelledby="list-title">
        <div className="container-site">
          <SectionHead id="list-title" kicker="Live list" lines={['Find your market.']} />
          <div className="mt-10">
            <Suspense fallback={null}>
              <MarketsTable />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="cond-title">
        <div className="container-site grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <SectionHead id="cond-title" kicker="Trading conditions" lines={['What you see', 'is what you pay.']} />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Spreads', 'Typical spreads are measured on the live stream, per instrument. Your account type adds its stated markup, or none with a commission.'],
              ['Overnight financing', 'Shown in its real unit in Ezymex Trader: a yearly percentage for most markets, points for the original 28. Crypto is charged every night.'],
              ['Contract sizes', 'Set per instrument and shown in the order ticket before you trade. Crypto and index contracts are sized so one lot is worth about 1,000 to 10,000 USD.'],
              ['Protection', 'Margin call at 100% and stop out at 50% (Cent: 60% and 20%). Negative balance protection resets a negative balance to zero.'],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={i * 0.05} className="card p-6">
                <h3 className="text-lg font-semibold">{t}</h3>
                <p className="t-body mt-2">{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand lines={['Pick a market.', 'Start on demo.']} art="watchlist-eye" />
    </>
  );
}
