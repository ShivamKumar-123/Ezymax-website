import Link from 'next/link';
import { Globe2 } from 'lucide-react';
import { SectionHead, Reveal } from '@/components/ui/Section';
import { Headline } from '@/components/motion/Headline';
import { PixelStat } from '@/components/motion/PixelStat';
import { HorizontalShowcase, type ShowcaseSlide } from '@/components/motion/HorizontalShowcase';
import { BrowserFrame } from '@/components/ui/Frames';
import { Picture } from '@/components/ui/Picture';
import { Art } from '@/components/ui/Art';
import { Button } from '@/components/ui/Button';
import { RiskNote } from '@/components/ui/RiskNote';
import { ACCOUNTS, OPTIONS } from '@/content/facts';
import { cn } from '@/lib/cn';

/* ── Options: quick trade in three steps ─────────────────────────────────── */
export function OptionsTeaser() {
  const steps = [
    { n: '01', t: 'Up or down?', d: 'Pick a market and a direction. Up buys a call, down buys a put.' },
    { n: '02', t: 'By when?', d: 'Today, tomorrow, Friday or later: daily, weekly and monthly expiries.' },
    { n: '03', t: 'How far?', d: 'Choose a strike. Ezymex shows the chance the model gives each one.' },
  ];
  return (
    <section className="section relative overflow-hidden" aria-labelledby="quick-title">
      <div aria-hidden className="glow-ember left-[-20%] top-[10%] h-[70%] w-[60%] opacity-30" />
      <div className="container-site relative grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
        <div>
          <SectionHead
            id="quick-title"
            kicker="Ezymex FX Options · Quick trade"
            lines={['An option', 'in three taps.']}
            lead="You never need to read an option chain to place an option trade. Quick trade asks three questions, then a What happens card spells out the cost, the most you can lose and when it settles, before you confirm."
          />
          <ol className="mt-12 flex flex-col">
            {steps.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 0.08} className="flex gap-6 border-t border-white/[0.08] py-6">
                <span className="t-pixel w-14 flex-none text-[1.9rem] text-ember">{s.n}</span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{s.t}</h3>
                  <p className="t-body mt-1">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3" data-reveal>
            <Button href="/options">How Ezymex FX Options work</Button>
          </div>
        </div>
        <Reveal className="relative mx-auto w-full max-w-[460px]">
          <BrowserFrame
            src="/images/product/focus-quick.webp"
            alt="Ezymex FX Options quick trade ticket: pick a market, choose up or down, then choose when"
            width={896}
            height={1208}
            sizes="(min-width: 1024px) 460px, 88vw"
          />
          <div className="glass absolute -bottom-8 -left-2 max-w-[270px] rounded-[20px] p-4 sm:-left-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-3">Buying an option</p>
            <p className="mt-1.5 text-[15px] font-semibold leading-snug">The most you can lose is the price you pay.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Why Ezymex ───────────────────────────────────────────────────────────── */
export function WhyEzymex() {
  const items = [
    {
      t: 'One account for CFDs and options',
      d: 'Options sit in the same trading account as your CFDs, with one balance and cross-margin. Copy trading, PAMM and partner earnings sit beside them in the Client Area, all funded from one USDT wallet.',
    },
    {
      t: 'Plain language before you confirm',
      d: 'Every options ticket ends with a What happens card: what you pay, the most you can lose, how it settles. Selling is allowed and clearly marked as the riskier side, with the margin it uses shown up front.',
    },
    {
      t: 'Pricing you can read',
      d: 'Each account states its pricing in one line: an all-in spread with no commission, or a raw spread plus a fixed commission. Margin call and stop-out levels are published, and negative balance protection resets a negative balance to zero.',
    },
    {
      t: 'Money in, in about a minute',
      d: 'Deposit USDT on BNB Chain or TRON from 10 USDT; deposits are usually credited within a minute. Moving money between your wallet and your accounts is instant and free.',
    },
  ];
  return (
    <section className="section" aria-labelledby="why-title">
      <div className="container-site grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead
            id="why-title"
            kicker="Why Ezymex"
            lines={['Built like', 'an exchange.', <span key="x" className="text-fg-3">Explained like</span>, <span key="y" className="text-fg-3">a friend.</span>]}
          />
          <Reveal className="mt-10">
            <Art
              name="desk-streaks"
              className="aspect-[4/3] rounded-[28px] border border-white/[0.08]"
              sizes="(min-width: 1024px) 560px, 92vw"
            />
          </Reveal>
        </div>
        <ol className="flex flex-col">
          {items.map((it, i) => (
            <Reveal as="li" key={it.t} delay={i * 0.05} className="group border-t border-white/[0.09] py-10 first:border-t-0 first:pt-0 lg:py-12">
              <div className="flex items-start gap-6 sm:gap-10">
                <span className="t-pixel flex-none text-[2.6rem] text-fg-3 transition-colors duration-500 group-hover:text-ember sm:text-[3.4rem]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="t-h3">{it.t}</h3>
                  <div className="mt-4 h-px w-16 bg-ember" />
                  <p className="t-body mt-5 max-w-xl text-[1.02rem]">{it.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Pixel stats band ────────────────────────────────────────────────────── */
export function StatsBand() {
  const stats = [
    { v: 1389, label: 'Instruments on Ezymex Trader' },
    { v: OPTIONS.underlyingsLive.length, label: 'Markets with an option chain' },
    { v: 22, label: 'Languages, right to left included' },
    { v: 1000, prefix: '1:', label: 'Maximum leverage (Standard, Cent)', group: false },
  ];
  return (
    <section className="section pt-0" aria-label="Ezymex in numbers">
      <div className="container-site">
        <div className="relative overflow-hidden rounded-[36px] border border-white/[0.08] bg-[linear-gradient(180deg,#120d0b_0%,#0b0a0c_100%)] px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
          <div aria-hidden className="glow-ember right-[-10%] top-[-50%] h-[90%] w-[55%] opacity-35" />
          <div className="relative grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="flex items-start gap-4" data-reveal>
              <span className="grid h-11 w-11 flex-none place-items-center rounded-full border border-white/15">
                <Globe2 size={20} aria-hidden />
              </span>
              <p className="max-w-[15rem] text-sm leading-relaxed text-fg-2">
                One platform for traders everywhere: Ezymex Trader, the Client Area and Ezymex FX Options.
              </p>
            </div>
            <Headline
              lines={[
                'Real numbers from the platform,',
                <span key="b" className="text-fg-3">
                  not marketing. Every figure here
                </span>,
                <span key="c" className="text-fg-3">
                  is what you can trade today.
                </span>,
              ]}
              className="font-display text-[1.6rem] font-medium leading-[1.12] tracking-[-0.03em] sm:text-[2.2rem]"
            />
          </div>
          <dl className="relative mt-16 grid grid-cols-2 gap-x-6 gap-y-12 lg:mt-24 lg:grid-cols-4">
            {stats.map((s, i) => (
              <div key={s.label} data-reveal style={{ ['--reveal-delay' as string]: `${i * 0.08}s` }}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <PixelStat value={s.v} prefix={s.prefix} group={s.group !== false} className="t-pixel block text-[2.9rem] text-fg sm:text-[4rem] lg:text-[4.3rem] xl:text-[4.9rem]" />
                  <p className="mt-4 flex items-center gap-2 text-[13px] text-fg-2" aria-hidden>
                    <span className="h-1.5 w-1.5 rounded-full bg-ember" />
                    {s.label}
                  </p>
                  <div className="stat-line mt-4" />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ── Account types teaser ────────────────────────────────────────────────── */
export function AccountsTeaser() {
  return (
    <section className="section" aria-labelledby="acc-title">
      <div className="container-site">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHead
            id="acc-title"
            kicker="Account types"
            lines={['An account', 'for how you trade.']}
            lead="Five live account types plus demo. Pick all-in pricing or raw spreads with a commission, hedging or netting, US dollars or US cents."
          />
          <div data-reveal>
            <Button href="/accounts" variant="outline">
              Compare accounts
            </Button>
          </div>
        </div>
        <div className="no-scrollbar -mx-[var(--gutter)] mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[var(--gutter)] pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {ACCOUNTS.map((a, i) => (
            <Link
              key={a.id}
              href={`/accounts#${a.id}`}
              data-reveal
              style={{ ['--reveal-delay' as string]: `${i * 0.06}s` }}
              className={cn(
                'group relative flex w-[78vw] max-w-[300px] flex-none snap-start flex-col rounded-[26px] border p-6 transition-colors duration-500 lg:w-auto lg:max-w-none',
                a.highlight
                  ? 'border-ember/50 bg-[linear-gradient(180deg,rgba(255,90,31,0.16),rgba(255,90,31,0.03))]'
                  : 'border-white/[0.09] bg-white/[0.02] hover:border-white/20',
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-[1.6rem] font-semibold tracking-[-0.04em]">{a.name}</h3>
                {a.highlight && <span className="chip chip-ember !h-6 text-[10px]">Popular</span>}
              </div>
              <p className="mt-2 min-h-[3rem] text-sm text-fg-2">{a.tagline}</p>
              <dl className="mt-6 flex flex-col gap-2.5 text-sm">
                {[
                  ['Min. deposit', a.minDeposit],
                  ['Leverage up to', a.leverage],
                  ['Spread', a.spread],
                  ['Commission', a.commission],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-t border-white/[0.07] pt-2.5">
                    <dt className="text-fg-3">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-xs text-fg-3">
          “Raw” is the market spread from our price feed; 1 pip = 10 points on a 5-digit FX pair. Demo accounts are free with
          virtual funds. Conditions are the current defaults and can change.
        </p>
      </div>
    </section>
  );
}

/* ── Platform showcase (pinned horizontal) ───────────────────────────────── */
const SLIDES: ShowcaseSlide[] = [
  {
    src: '/images/product/focus-chart.webp',
    w: 2472,
    h: 1568,
    url: 'trade.ezymex.com',
    t: 'A big, clean chart',
    d: '4 chart types, 9 timeframes, 35 indicators and drawing tools. Drag your stop loss, take profit and alerts on the chart.',
    alt: 'Ezymex Trader chart on XAUUSD with moving averages and stop loss, take profit, alert and pending order lines',
  },
  {
    src: '/images/product/focus-chain.webp',
    w: 2472,
    h: 916,
    url: 'trade.ezymex.com · Options',
    t: 'The option chain',
    d: 'Calls and puts around every strike, with the breakeven and the model’s chance shown beside each price.',
    alt: 'EURUSD option chain around the at-the-money strike: calls left, puts right, breakeven and chance columns',
  },
  {
    src: '/images/product/focus-analytics.webp',
    w: 2200,
    h: 1088,
    url: 'trade.ezymex.com · Analytics',
    t: 'Analytics that explain',
    d: 'Volatility smile, term structure, open interest and the put/call ratio for every underlying.',
    alt: 'Options analytics: volatility smile, term structure, open interest by strike and the put/call ratio',
  },
  {
    src: '/images/product/focus-depth.webp',
    w: 2248,
    h: 1600,
    url: 'trade.ezymex.com',
    t: 'Depth beside the chart',
    d: 'A depth ladder next to the chart, with one-click trading on and off, and a full chart mode.',
    alt: 'Ezymex Trader chart with the depth of market ladder beside it',
  },
  {
    src: '/images/product/focus-client.webp',
    w: 2940,
    h: 1040,
    url: 'app.ezymex.com',
    t: 'The Client Area',
    d: 'Accounts, wallet, copy trading, PAMM, partner earnings and the academy in one place. Illustrative data.',
    alt: 'Ezymex Client Area overview with equity, P&L, wallet, accounts and total balance (illustrative data)',
  },
];

export function PlatformShowcase() {
  return (
    <HorizontalShowcase
      slides={SLIDES}
      intro={
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="flex flex-col gap-5">
            <span className="kicker" data-reveal>
              The platform
            </span>
            <Headline lines={['One terminal. Every market.']} className="t-h2 sc-title text-balance" />
          </div>
          <p className="t-lead max-w-md" data-reveal>
            Ezymex Trader runs in the browser, on desktop and phone. Nothing to install, nothing to update.
          </p>
        </div>
      }
    />
  );
}

/* ── Global band: photo + statement ─────────────────────────────────────── */
export function GlobalBand() {
  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="global-title">
      <div className="container-site section grid items-center gap-12 lg:min-h-[90vh] lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div className="flex flex-col items-start gap-10">
          <p className="kicker kicker-crimson" data-reveal>
            One platform, every market
          </p>
          <Headline id="global-title" lines={['A global platform,', 'in your language.']} className="t-display max-w-[13ch]" />
          <p className="t-lead max-w-xl text-fg" data-reveal>
            Ezymex Trader and the Client Area are translated into 22 languages, from Arabic, Urdu and Persian (right to left)
            to Hindi, Bengali, Tamil, Bahasa, Thai, Vietnamese, Chinese, Japanese, Korean, Swahili and the main European
            languages.
          </p>
          <div className="flex flex-wrap gap-2" data-reveal>
            {['English', 'हिन्दी', 'العربية', 'Español', 'Português', 'Français', 'Deutsch', 'Русский', 'Türkçe', 'Bahasa Indonesia', '简体中文', '日本語', '한국어', 'Kiswahili'].map((l) => (
              <span key={l} className="chip glass !border-white/15 text-fg">
                {l}
              </span>
            ))}
            <span className="chip chip-ember">+8 more</span>
          </div>
        </div>
        <Reveal className="relative mx-auto w-full max-w-[400px] lg:max-w-[470px]">
          {/* crimson sampled from the portal (#971b25 rings), so the carved wall dissolves into the page */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[42%] -z-10 h-[120%] w-[150%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,rgba(120,16,28,0.5)_0%,rgba(70,10,18,0.22)_50%,transparent_78%)] blur-2xl"
          />
          <Picture
            name="/images/brand/hero-portal"
            widths={[736, 490]}
            height={1308}
            alt="A carved circular portal in deep crimson red, with a small statue standing at its centre"
            sizes="(min-width: 1024px) 470px, min(92vw, 400px)"
            className="hero-portal-mask block"
          />
        </Reveal>
      </div>
    </section>
  );
}

export function HomeRisk() {
  return (
    <div className="container-site -mt-6 mb-10">
      <RiskNote options />
    </div>
  );
}

