import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead, Reveal } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { BrowserFrame, PhoneFrame } from '@/components/ui/Frames';
import { Art } from '@/components/ui/Art';
import { CtaBand } from '@/components/ui/CtaBand';
import { ANDROID_APP, TRADER } from '@/content/facts';
import { CRM_URL, REGISTER_HREF, TRADER_URL } from '@/lib/crm';

export const metadata: Metadata = {
  title: 'Platforms: Ezymex Trader web terminal, Client Area and mobile',
  description:
    'Ezymex Trader is an MT5-style web terminal for CFDs and options: a big chart, 35 indicators, one-click trading, a depth ladder and full chart mode. The Client Area runs everything around it. Now also as an Android app.',
  alternates: { canonical: '/platforms' },
};

const TRADER_FEATURES = [
  ['Charts', `${TRADER.chartTypes} chart types, ${TRADER.timeframes.length} timeframes from M1 to MN, ${TRADER.indicators} indicators in 5 groups and ${TRADER.drawingTools} drawing tools.`],
  ['Orders', 'Market, limit, stop and stop-limit. Stop loss and take profit, a server-side trailing stop, OCO, and expiry by date.'],
  ['One-click trading', 'Sell and buy straight from the chart, or switch it off to confirm every trade in the order ticket.'],
  ['Trade on the chart', 'Drag stop loss, take profit, pending orders and alerts right on the price axis.'],
  ['Depth ladder', 'The order book beside the chart, with limit orders placed in one click.'],
  ['Position tools', 'Partial close, close by, and bulk close: all, profitable, losing, buys or sells.'],
  ['Full chart mode', 'Hide everything but the chart when you want to focus.'],
  ['Options tab', 'Switch between CFD and Options at the top. Same account, same balance.'],
];

const CLIENT_FEATURES = [
  ['Accounts', 'Open live and demo accounts, change leverage, set investor (read-only) passwords.'],
  ['Wallet', 'Deposit and withdraw USDT; move money between wallet and accounts instantly and free.'],
  ['Copy trading, PAMM, MAM', 'Follow masters, invest in funds, or apply to become a master yourself.'],
  ['Prop challenges', 'Buy a challenge, track every rule in real time, request payouts, download certificates.'],
  ['Partner dashboard', 'Referral links, clients, your network, commissions and weekly payouts.'],
  ['Academy', '118 lessons in 9 phases, quizzes, exams and verifiable certificates.'],
  ['Developer', 'API keys, webhooks, a visual strategy builder, backtests and 24/7 deployments.'],
  ['Support', 'Chat with support from any page, with an instant help assistant and our team behind it.'],
];

export default function PlatformsPage() {
  return (
    <>
      <PageHero
        kicker="Platforms"
        lines={['Ezymex Trader.', <span key="b" className="text-fg-3">Nothing to install.</span>]}
        lead="An MT5-style web terminal for CFDs and options with a big, clean chart. The Client Area handles everything around your trading. Both run in any modern browser, on desktop and phone."
        actions={
          <>
            <Button href={TRADER_URL}>
              Open Ezymex Trader
            </Button>
            <Button href={REGISTER_HREF} variant="outline" arrow={false}>
              Create an account
            </Button>
          </>
        }
        visual={
          <BrowserFrame
            src="/images/product/trader-cfd.webp"
            alt="Ezymex Trader: XAUUSD chart with moving averages, stop loss and take profit lines, and the instruments list"
            priority
            tilt
            sizes="(min-width: 1024px) 680px, 92vw"
          />
        }
      />

      <section id="trader" className="section scroll-mt-24" aria-labelledby="trader-title">
        <div className="container-site">
          <SectionHead
            id="trader-title"
            kicker="Ezymex Trader"
            lines={['Built like the', 'terminals pros use.']}
            lead="The layout traders know from MT5 and the big exchanges: the chart first, the watchlist on the side, positions below. Designed to be fast, compact and calm."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRADER_FEATURES.map(([t, d], i) => (
              <Reveal key={t} delay={(i % 4) * 0.05} className="card card-hover p-6">
                <span className="t-pixel text-[1.4rem] text-ember">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{t}</h3>
                <p className="t-body mt-2 text-[0.92rem]">{d}</p>
              </Reveal>
            ))}
          </div>
          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            <Reveal>
              <BrowserFrame src="/images/product/trader-fullchart.webp" alt="Ezymex Trader in full chart mode" caption="Full chart mode" />
            </Reveal>
            <Reveal delay={0.08}>
              <BrowserFrame src="/images/product/focus-depth.webp" width={2248} height={1600} alt="Ezymex Trader with the depth ladder beside the chart" caption="Depth ladder beside the chart" />
            </Reveal>
          </div>
        </div>
      </section>

      <section id="client-area" className="section scroll-mt-24 pt-0" aria-labelledby="ca-title">
        <div className="container-site grid items-center gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <div>
            <SectionHead
              id="ca-title"
              kicker="Client Area"
              lines={['Everything around', 'your trading.']}
              lead="One place for accounts, money, copy trading, prop, partner earnings and learning, in 22 languages with light and dark themes."
            />
            <dl className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {CLIENT_FEATURES.map(([t, d], i) => (
                <Reveal key={t} delay={(i % 2) * 0.05} className="border-t border-white/[0.08] pt-4">
                  <dt className="text-[15px] font-semibold">{t}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-fg-2">{d}</dd>
                </Reveal>
              ))}
            </dl>
            <div className="mt-10" data-reveal>
              <Button href={CRM_URL} variant="outline">
                Go to the Client Area
              </Button>
            </div>
          </div>
          <Reveal>
            <BrowserFrame
              src="/images/product/focus-client.webp"
              alt="Ezymex Client Area overview: equity, P&L, wallet, accounts and quick actions"
              url="app.ezymex.com"
              width={2940}
              height={1040}
              tilt
              caption="Illustrative data"
            />
          </Reveal>
        </div>
      </section>

      <section id="mobile" className="section scroll-mt-24 pt-0" aria-labelledby="mob-title">
        <div className="container-site">
          <div className="relative isolate overflow-hidden rounded-[36px] border border-white/[0.08]">
            <Art name="phone-light" alt="" className="!absolute inset-0 -z-10" sizes="(min-width: 1360px) 1360px, 100vw" position="70% center" />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(7,7,10,0.95)_0%,rgba(7,7,10,0.75)_50%,rgba(7,7,10,0.4)_100%)]" />
            <div className="grid items-center gap-12 p-6 sm:p-12 lg:grid-cols-[1.2fr_0.8fr] lg:p-16">
              <div>
                <span className="chip chip-ember" data-reveal>
                  Android · v{ANDROID_APP.version}
                </span>
                <SectionHead
                  id="mob-title"
                  className="mt-6"
                  lines={['Ezymex on Android.']}
                  lead="The Client Area, Ezymex Trader and Ezymex FX Options in one app, in all 22 languages, with biometric sign-in. Download the APK below; the Play Store listing follows."
                />
                <div className="mt-8 flex flex-wrap gap-3" data-reveal>
                  <Button href={ANDROID_APP.href} arrow={false}>
                    Download for Android
                  </Button>
                  <Button href={TRADER_URL} variant="outline">
                    Open Ezymex Trader
                  </Button>
                </div>
                <p className="mt-4 max-w-md text-[13px] leading-relaxed text-fg-3" data-reveal>
                  APK · {ANDROID_APP.minAndroid} or newer{ANDROID_APP.sizeMb ? ` · ${ANDROID_APP.sizeMb} MB` : ''}. Android asks once to allow installs from your browser.
                  Older 32-bit phones:{' '}
                  <a href={ANDROID_APP.hrefUniversal} className="underline decoration-fg-3/40 underline-offset-2 hover:text-fg">
                    universal APK
                  </a>
                  .{ANDROID_APP.sha256 ? ` SHA-256 ${ANDROID_APP.sha256.slice(0, 16)}…` : ''}
                </p>
              </div>
              <Reveal>
                <PhoneFrame src="/images/product/phone-dashboard.webp" alt="The Ezymex Client Area on a phone" />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="api-teaser">
        <div className="container-site">
          <Reveal className="card flex flex-col items-start justify-between gap-8 p-8 sm:p-12 lg:flex-row lg:items-center">
            <div>
              <p className="kicker">API & algo trading</p>
              <h2 id="api-teaser" className="t-h2 mt-5 max-w-[18ch]">
                Automate it.
              </h2>
              <p className="t-body mt-4 max-w-xl">
                Webhook alerts, a REST API with scoped keys, a visual strategy builder and backtests, running on our servers
                around the clock.
              </p>
            </div>
            <Button href="/white-label#api" variant="outline">
              API & algo
            </Button>
          </Reveal>
        </div>
      </section>

      <CtaBand lines={['See it for', 'yourself.']} lead="Open a free demo account and trade on live prices in Ezymex Trader, in your browser, in a minute." />
    </>
  );
}
