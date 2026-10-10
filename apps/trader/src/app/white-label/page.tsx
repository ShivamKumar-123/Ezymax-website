import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead, Reveal } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { BrowserFrame } from '@/components/ui/Frames';
import { CtaBand } from '@/components/ui/CtaBand';
import { ALGO } from '@/content/facts';
import { BRAND_SUPPORT_EMAIL } from '@/lib/brand';
import { REGISTER_HREF } from '@/lib/crm';

export const metadata: Metadata = {
  title: 'White-label brokerage and API & algo trading',
  description:
    'Launch your own brokerage on the Ezymex platform with your brand and domains, or automate trading with webhooks, a REST API, a visual strategy builder and backtests.',
  alternates: { canonical: '/white-label' },
};

const WL = [
  ['Your brand', 'Your name, logo, colours and support email across the website, Client Area, Ezymex Trader and every email.'],
  ['Your domains', 'Your own addresses for the website, the Client Area, the trading terminal and your Back Office.'],
  ['Your product mix', 'Switch modules on per broker: options, copy trading, PAMM and MAM, partners, academy, rewards.'],
  ['Your data, isolated', 'Each broker’s clients, accounts and money are separated at the database level.'],
  ['Your back office', 'Clients, KYC, deposits and withdrawals, dealing, risk, partners and content, with staff roles.'],
  ['The whole platform', 'The same trading engine, option pricing, market data and 22 languages that run Ezymex.'],
];

const API = [
  ['Webhook alerts', `Send alerts from your charting tool to a Ezymex webhook URL. Each webhook can route to up to ${ALGO.webhookRoutes} accounts, each with its own size.`],
  ['REST API', 'API keys with read and trade scopes, never withdrawals. Bearer or HMAC signing, and an IP allow-list required for live trading keys.'],
  ['Visual strategy builder', 'Build rules with blocks, switch to code, or describe a strategy in plain words and let the assistant draft it.'],
  ['Backtests', `Test a strategy on history on our servers, with ${ALGO.indicatorSeries} indicator series that match Ezymex Trader.`],
  ['24/7 deployments', 'Run strategies on our servers on demo or live accounts, with kill switches when you need to stop at once.'],
  ['Marketplace', 'Publish a strategy for others to run, or start from one that someone else built.'],
];

export default function WhiteLabelPage() {
  const mailto = `mailto:${BRAND_SUPPORT_EMAIL}?subject=${encodeURIComponent('White-label enquiry')}`;
  return (
    <>
      <PageHero
        kicker="For business"
        lines={['Your brokerage.', <span key="b" className="text-fg-3">Our platform.</span>]}
        lead="Launch a broker on the Ezymex platform under your own brand and domains, with forex options, CFDs, copy trading and partners built in. Or plug your own systems into ours with the API."
        actions={
          <>
            <Button href={mailto}>Talk to us</Button>
            <Button href="#api" variant="outline" arrow={false}>
              API & algo
            </Button>
          </>
        }
        visual={
          <BrowserFrame
            src="/images/product/focus-whitelabel.webp"
            alt="The Ezymex Client Area rebranded in a blue white-label theme"
            url="app.yourbrand.com"
            width={2940}
            height={1040}
            priority
            tilt
            caption="A white-label theme (illustrative data)"
            sizes="(min-width: 1024px) 680px, 92vw"
          />
        }
      />

      <section className="section" aria-labelledby="wl-title">
        <div className="container-site">
          <SectionHead
            id="wl-title"
            kicker="White-label"
            lines={['Everything Ezymex runs,', 'under your name.']}
            lead="Each broker on the platform gets its own website, Client Area, trading terminal and Back Office. Commercial terms combine a setup fee, a monthly licence and a revenue share; ask us for details."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WL.map(([t, d], i) => (
              <Reveal key={t} delay={(i % 3) * 0.05} className="card card-hover p-7">
                <span className="t-pixel text-[1.4rem] text-ember">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">{t}</h3>
                <p className="t-body mt-2">{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="api" className="section scroll-mt-24 pt-0" aria-labelledby="api-title">
        <div className="container-site grid items-start gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <div className="lg:sticky lg:top-28">
            <SectionHead
              id="api-title"
              kicker="API & algo trading"
              lines={['Automate', 'your trading.']}
              lead="Everything runs on Ezymex servers, around the clock, on demo or live accounts. Algo trading covers CFDs; options stay manual for now."
            />
            <Reveal className="mt-10">
              <BrowserFrame
                src="/images/product/focus-developer.webp"
                alt="The strategy builder in the Ezymex Client Area: rules as blocks, a strategy assistant and deployment"
                url="app.ezymex.com · Developer"
                width={2860}
                height={1200}
                caption="Illustrative data"
              />
            </Reveal>
          </div>
          <dl className="flex flex-col">
            {API.map(([t, d], i) => (
              <Reveal key={t} delay={i * 0.04} className="border-t border-white/[0.08] py-7 first:border-t-0 first:pt-0">
                <dt className="flex items-baseline gap-4">
                  <span className="t-pixel text-[1.3rem] text-ember">{String(i + 1).padStart(2, '0')}</span>
                  <span className="t-h3">{t}</span>
                </dt>
                <dd className="t-body mt-3 pl-10">{d}</dd>
              </Reveal>
            ))}
            <Reveal className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-sm text-fg-2">
              Base URL <span className="num text-fg">api.ezymex.com/algo/public/v1</span> with an OpenAPI description. Rate
              limit {ALGO.rateLimit}.
            </Reveal>
          </dl>
        </div>
      </section>

      <CtaBand
        lines={['Build on', 'Ezymex.']}
        lead="Brokers: tell us about your business and we will walk you through the platform. Builders: open an account and create an API key in the Client Area."
        primary={{ label: 'Talk to us', href: mailto }}
        secondary={{ label: 'Create an account', href: REGISTER_HREF }}
        art="chart-wall"
      />
    </>
  );
}
