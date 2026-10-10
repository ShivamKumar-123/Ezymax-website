import type { Metadata } from 'next';
import Link from 'next/link';
import { CandlestickChart, Globe2, Layers, LineChart, Users } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead, Reveal } from '@/components/ui/Section';
import { Button, ArrowCircle } from '@/components/ui/Button';
import { BrandWall } from '@/components/brand/BrandWall';
import { CtaBand } from '@/components/ui/CtaBand';
import { INSTRUMENTS, OPTIONS } from '@/content/facts';
import { REGISTER_HREF } from '@/lib/crm';

export const metadata: Metadata = {
  title: 'About Ezymex',
  description:
    'Ezymex is a global multi-asset trading platform: Ezymex FX Options, CFDs on 1,389 instruments, copy trading and PAMM, built on our own technology and translated into 22 languages.',
  alternates: { canonical: '/about' },
};

const PRODUCTS = [
  { Icon: LineChart, t: 'Ezymex FX Options', d: `Option chains on ${OPTIONS.fxPairs - 1} FX pairs, gold, silver and oil, with daily, weekly and monthly expiries.`, href: '/options' },
  { Icon: CandlestickChart, t: 'CFDs', d: `${INSTRUMENTS.total.toLocaleString('en-US')} instruments across forex, metals, energies, indices and crypto, with stocks coming soon.`, href: '/markets' },
  { Icon: Users, t: 'Copy trading, PAMM, MAM', d: 'Follow verified masters with your own limits, invest in managed funds, or become a master.', href: '/copy-trading' },
  { Icon: Layers, t: 'Partners and white-label', d: 'A five-level partner programme, and the whole platform for brokers under their own brand.', href: '/partners' },
  { Icon: Globe2, t: 'Academy', d: '118 lessons in 9 phases, from how markets work to macro regimes and FX options.', href: '/academy' },
];

const PRINCIPLES = [
  {
    t: 'One account, one wallet',
    d: 'Options sit in the same trading account as CFDs. Copy trading, PAMM and partner earnings live beside them in the Client Area, all funded from one USDT wallet.',
  },
  {
    t: 'Plain language',
    d: 'Every account states its pricing in one line, and every options ticket ends with a card that says what you pay, the most you can lose and how it settles.',
  },
  {
    t: 'Built in-house',
    d: 'Ezymex runs on its own technology: the trading engine, the market-data service and its candles, the option pricing, Ezymex Trader and the Client Area are all ours.',
  },
  {
    t: 'Made for every market',
    d: 'Ezymex Trader and the Client Area are translated into 22 languages, right-to-left included, and run in any modern browser on desktop and phone.',
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        kicker="About Ezymex"
        lines={['A trading platform', <span key="b" className="text-fg-3">built for every market.</span>]}
        lead="Ezymex brings forex options, CFDs, copy trading and a partner programme together on one account, on technology we build ourselves."
        actions={
          <>
            <Button href={REGISTER_HREF}>Open account</Button>
            <Button href="/contact" variant="outline" arrow={false}>
              Contact us
            </Button>
          </>
        }
        visual={
          <div className="relative mx-auto w-full max-w-[640px] overflow-hidden rounded-[28px] border border-white/10 rim">
            <BrandWall />
          </div>
        }
      />

      <section className="section" aria-labelledby="what-title">
        <div className="container-site">
          <SectionHead
            id="what-title"
            kicker="What we do"
            lines={['Five products.', 'One platform.']}
            lead="Everything a trader needs, from the first demo trade to running a fund or a brokerage."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map(({ Icon, t, d, href }, i) => (
              <Reveal key={t} delay={(i % 3) * 0.05}>
                <Link href={href} className="group card card-hover flex h-full flex-col p-6 sm:p-7">
                  <div className="flex items-start justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ember/15 text-ember-2">
                      <Icon size={20} aria-hidden />
                    </span>
                    <ArrowCircle />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight">{t}</h3>
                  <p className="t-body mt-2">{d}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="how-title">
        <div className="container-site grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <SectionHead id="how-title" kicker="How we build" lines={['Clear, fast,', 'and our own.']} />
          <ol className="flex flex-col">
            {PRINCIPLES.map((p, i) => (
              <Reveal as="li" key={p.t} delay={i * 0.05} className="border-t border-white/[0.09] py-8 first:border-t-0 first:pt-0">
                <div className="flex items-start gap-6">
                  <span className="t-pixel w-12 flex-none text-[2.2rem] text-ember">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="t-h3">{p.t}</h3>
                    <p className="t-body mt-3 max-w-xl">{p.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand lines={['Trade with', 'Ezymex.']} lead="Open an account in a minute, start on demo, and fund with USDT when you are ready." />
    </>
  );
}
