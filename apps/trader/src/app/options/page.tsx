import type { Metadata } from 'next';
import Image from 'next/image';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead, Reveal, FactList } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { BrowserFrame } from '@/components/ui/Frames';
import { CtaBand } from '@/components/ui/CtaBand';
import { RiskNote } from '@/components/ui/RiskNote';
import { Faq } from '@/components/ui/Faq';
import { PixelStat } from '@/components/motion/PixelStat';
import { LiveList, type LiveRow } from '@/components/market/LiveList';
import { Payoff, STRATEGY_NOTES } from '@/components/options/Payoff';
import { OPTIONS } from '@/content/facts';
import { REGISTER_HREF } from '@/lib/crm';
import { getQuotes } from '@/lib/quotes';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Ezymex FX Options: the first forex options platform',
  description:
    'Buy or sell calls and puts on 9 FX pairs, gold, silver and oil with daily, weekly and monthly expiries. Quick trade in three taps, a strategy builder and plain-language risk, in the same account as your CFDs.',
  alternates: { canonical: '/options' },
};

const UNDERLYINGS: LiveRow[] = [
  { s: 'EURUSD', name: 'Euro / US Dollar', digits: 5, group: 'Forex' },
  { s: 'GBPUSD', name: 'British Pound / US Dollar', digits: 5, group: 'Forex' },
  { s: 'USDJPY', name: 'US Dollar / Japanese Yen', digits: 3, group: 'Forex' },
  { s: 'AUDUSD', name: 'Australian Dollar / US Dollar', digits: 5, group: 'Forex' },
  { s: 'USDCAD', name: 'US Dollar / Canadian Dollar', digits: 5, group: 'Forex' },
  { s: 'USDCHF', name: 'US Dollar / Swiss Franc', digits: 5, group: 'Forex' },
  { s: 'EURJPY', name: 'Euro / Japanese Yen', digits: 3, group: 'Forex' },
  { s: 'GBPJPY', name: 'British Pound / Japanese Yen', digits: 3, group: 'Forex' },
  { s: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', digits: 5, group: 'Forex', soon: true },
  { s: 'XAUUSD', name: 'Gold / US Dollar', digits: 2, group: 'Metals' },
  { s: 'XAGUSD', name: 'Silver / US Dollar', digits: 3, group: 'Metals' },
  { s: 'USOIL', name: 'WTI Crude Oil', digits: 2, group: 'Energies' },
  { s: 'UKOIL', name: 'Brent Crude Oil', digits: 2, group: 'Energies' },
];

const CHAIN_MARKERS = [
  { n: 1, x: 14.2, y: 15.1, t: 'Expiries', d: 'Daily expiries for the next five business days, weekly (W) on Fridays and monthly (M) at month end.' },
  { n: 2, x: 34.1, y: 29.8, t: 'Calls', d: 'On the left. A call profits if the market rises above its strike.' },
  { n: 3, x: 54.4, y: 73.8, t: 'Strikes', d: 'In the middle, with the at-the-money strike marked and the live price drawn across the chain.' },
  { n: 4, x: 64.1, y: 29.8, t: 'Puts', d: 'On the right. A put profits if the market falls below its strike.' },
  { n: 5, x: 13.5, y: 35, t: 'Breakeven and chance', d: 'Where each option starts to pay at expiry, and the chance the pricing model gives it of finishing in the money.' },
];

const EXAMPLES = [
  {
    t: 'You think gold rises before Friday',
    trade: 'Buy 1 XAUUSD call, strike 4,150, weekly expiry',
    lines: [
      ['You pay (premium)', '$28 per contract (1 oz)'],
      ['Breakeven at expiry', '4,178'],
      ['Gold settles at 4,200', 'Option pays $50: you make $22'],
      ['Gold settles at or below 4,150', 'Option expires worthless: you lose $28'],
    ],
  },
  {
    t: 'You hold EURUSD and fear a drop at the ECB meeting',
    trade: 'Buy 1 EURUSD put, strike 1.1150, daily expiry',
    lines: [
      ['You pay (premium)', '$8 per contract (10,000 EUR)'],
      ['EURUSD settles at 1.1050', 'Put pays $100, offsetting losses on your CFD'],
      ['EURUSD stays above 1.1150', 'You lose the $8 you paid, like an insurance premium'],
      ['Most you can lose', '$8'],
    ],
  },
  {
    t: 'You expect a big oil move, direction unknown',
    trade: 'Buy a USOIL straddle: 1 call and 1 put, strike 88.00',
    lines: [
      ['You pay (two premiums)', '$9 + $8 = $17 for 10 barrels'],
      ['Breakevens', '86.30 and 89.70'],
      ['Oil settles at 92.00', 'Call pays $40: you make $23'],
      ['Oil settles at 88.00', 'Both expire worthless: you lose $17'],
    ],
  },
];

const FAQ = [
  {
    q: 'What is an FX option?',
    a: 'A contract that gives you the right, but not the obligation, to gain from a currency pair (or gold, silver or oil) finishing above or below a price, called the strike, at a set expiry. A call pays if the market finishes above the strike; a put pays if it finishes below. Ezymex FX Options are European style: they settle at expiry, and you can close them at any time before.',
  },
  {
    q: 'Can I lose more than I pay?',
    a: 'Not when you buy. When you buy a call or a put, the most you can lose is the premium you paid. Selling (writing) an option is different: you receive the premium, but your loss is not limited to it, and the position uses margin.',
  },
  {
    q: 'Do I need a separate account?',
    a: 'No. Options sit in the same Ezymex trading account as your CFDs, with one balance and cross-margin. Switch between CFD and Options at the top of Ezymex Trader. Prop, copy, PAMM and MAM accounts cannot trade options.',
  },
  {
    q: 'How do options settle?',
    a: 'In cash, in US dollars, automatically. The settlement price is the average of one-second mid prices over the 30 minutes before the 10:00 New York cut, so a single tick cannot decide the outcome.',
  },
  {
    q: 'What does it cost?',
    a: 'You pay the option premium shown on the chain, plus a commission of $0.25 per contract, capped at 10% of the premium.',
  },
  {
    q: 'When can I trade?',
    a: 'Options follow the trading hours of their underlying market. New positions stop 15 minutes before the cut, and all trading on an expiry stops in its final minute.',
  },
  {
    q: 'Can I practise first?',
    a: 'Yes. Open a free demo account in the Client Area and trade options with virtual funds on live prices.',
  },
];

export default async function OptionsPage() {
  const quotes = await getQuotes(UNDERLYINGS.filter((u) => !u.soon).map((u) => u.s));
  return (
    <>
      <PageHero
        kicker="Ezymex FX Options · New"
        lines={['The first forex', <span key="o" className="text-ember-grad">options platform.</span>]}
        lead="Buy or sell calls and puts on 9 FX pairs, gold, silver and oil, with daily, weekly and monthly expiries. Settled in cash in US dollars, in the same account as your CFDs."
        actions={
          <>
            <Button href={REGISTER_HREF}>
              Open account
            </Button>
            <Button href="#how" variant="outline" arrow={false}>
              How it works
            </Button>
          </>
        }
        footer={<p className="text-sm text-fg-3">Inside Ezymex Trader. Start on a free demo account.</p>}
        visual={
          <div className="relative">
            <BrowserFrame
              src="/images/product/focus-chain-explained.webp"
              alt="Ezymex FX Options chain for EURUSD: expiries along the top, calls left, puts right, strikes in the middle"
              url="trade.ezymex.com · Options"
              width={2472}
              height={1268}
              priority
              tilt
              sizes="(min-width: 1024px) 680px, 92vw"
            />
            <div className="glass absolute -bottom-10 right-2 w-[280px] rounded-[22px] p-5 sm:right-6 lg:-left-10 lg:right-auto">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ember-2">What happens · Example</p>
              <p className="mt-2 text-[15px] font-semibold leading-snug">Buy 1 EURUSD 1.1200 call</p>
              <ul className="mt-3 flex flex-col gap-1.5 text-[13px] text-fg-2">
                <li className="flex justify-between gap-3">
                  <span>You pay</span>
                  <span className="num text-fg">$12.10</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Most you can lose</span>
                  <span className="num text-fg">$12.10</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Profit if above</span>
                  <span className="num text-fg">1.12121</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Settles</span>
                  <span className="text-fg">in cash, automatically</span>
                </li>
              </ul>
            </div>
          </div>
        }
      />

      {/* Numbers */}
      <section className="pb-8 pt-16 lg:pt-24" aria-label="Ezymex FX Options in numbers">
        <div className="container-site">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-10 border-y border-white/[0.08] py-10 lg:grid-cols-4">
            {[
              { v: OPTIONS.underlyingsLive.length, l: 'Underlyings: 8 FX pairs, gold, silver, WTI, Brent' },
              { v: OPTIONS.dailyPerWeek, l: 'Daily expiries every week, plus weekly and monthly' },
              { v: OPTIONS.strategies.length, l: 'Strategy templates, up to 8 legs per order' },
              { v: 0.25, l: 'Commission per contract, capped at 10% of premium', prefix: '$', decimals: 2 },
            ].map((s) => (
              <div key={s.l} data-reveal>
                <dt className="sr-only">{s.l}</dt>
                <dd>
                  <PixelStat value={s.v} prefix={s.prefix} decimals={s.decimals} className="t-pixel block text-[3rem] sm:text-[4rem]" />
                  <p className="mt-3 max-w-[15rem] text-[13px] leading-snug text-fg-2">{s.l}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* How the chain works */}
      <section id="how" className="section scroll-mt-24" aria-labelledby="how-title">
        <div className="container-site">
          <SectionHead
            id="how-title"
            kicker="How the chain works"
            lines={['Read a chain', 'in thirty seconds.']}
            lead="Every option for one market and one expiry on a single screen. Tap any price and the order ticket opens with that option filled in."
          />
          <Reveal className="relative mt-14">
            <div className="relative overflow-hidden rounded-[22px] border border-white/10 rim">
              <Image
                src="/images/product/focus-chain-explained.webp"
                alt="EURUSD option chain with numbered callouts for expiries, calls, strikes, puts, breakeven and chance"
                width={2472}
                height={1268}
                sizes="(min-width: 1360px) 1300px, 94vw"
                className="block h-auto w-full"
              />
              {CHAIN_MARKERS.map((m) => (
                <span
                  key={m.n}
                  aria-hidden
                  className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[linear-gradient(120deg,#ff5a1f,#ff8a3d)] text-[11px] font-bold text-[#120804] shadow-[0_0_0_5px_rgba(255,90,31,0.25)] animate-pulse-ring sm:h-8 sm:w-8 sm:text-[13px]"
                  style={{ left: `${m.x}%`, top: `${m.y}%` }}
                >
                  {m.n}
                </span>
              ))}
            </div>
          </Reveal>
          <ol className="mt-8 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-5">
            {CHAIN_MARKERS.map((m, i) => (
              <Reveal as="li" key={m.n} delay={i * 0.05} className="flex gap-3 border-t border-white/[0.08] py-4">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full border border-ember/60 text-[12px] font-semibold text-ember-2">
                  {m.n}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold">{m.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-fg-2">{m.d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Quick trade */}
      <section className="section relative overflow-hidden" aria-labelledby="qt-title">
        <div aria-hidden className="glow-ember right-[-20%] top-[20%] h-[60%] w-[50%] opacity-30" />
        <div className="container-site relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <Reveal className="order-2 lg:order-1">
            <BrowserFrame
              src="/images/product/focus-quick.webp"
              alt="Quick trade ticket: pick a market, then choose up or down, then when"
              url="trade.ezymex.com · Quick trade"
              width={896}
              height={1208}
              className="mx-auto max-w-[440px]"
              sizes="(min-width: 1024px) 440px, 88vw"
            />
          </Reveal>
          <div className="order-1 lg:order-2">
            <SectionHead
              id="qt-title"
              kicker="Quick trade"
              lines={['Up or down.', 'By when.', 'How far.']}
              lead="Quick trade turns a view into an option without the jargon. Choose a market and a direction, pick a date, then pick how far you think it will go. Ezymex shows the chance the model gives each choice, the cost, and the most you can lose."
            />
            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {[
                ['Up', 'Buys a call'],
                ['Down', 'Buys a put'],
                ['Today, tomorrow, later', 'Daily, weekly or monthly expiry'],
                ['What happens', 'The outcome in plain words before you confirm'],
              ].map(([a, b], i) => (
                <Reveal as="li" key={a} delay={i * 0.05} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <p className="text-[15px] font-semibold">{a}</p>
                  <p className="mt-1 text-sm text-fg-2">{b}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Strategy builder */}
      <section className="section" aria-labelledby="sb-title">
        <div className="container-site">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <SectionHead
              id="sb-title"
              kicker="Strategy builder"
              lines={['Spreads, straddles,', 'iron condors.']}
              lead="Start from a template or build your own: up to 8 legs in one order, filled all together or not at all, with the payoff drawn before you send it."
            />
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OPTIONS.strategies.map((s, i) => (
              <Reveal
                key={s}
                delay={(i % 4) * 0.05}
                className="group rounded-[24px] border border-white/[0.09] bg-[linear-gradient(180deg,#131317,#0d0d10)] p-5 transition-colors duration-500 hover:border-ember/40"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[1.05rem] font-semibold">{s}</h3>
                  <span className="chip !h-6 text-[10px]">{STRATEGY_NOTES[s]?.view}</span>
                </div>
                <Payoff name={s} className="mt-5 h-20 w-full" />
                <p className="mt-4 text-sm leading-relaxed text-fg-2">{STRATEGY_NOTES[s]?.d}</p>
              </Reveal>
            ))}
          </div>
          <p className="mt-5 text-xs text-fg-3">Payoff shapes at expiry are schematic, not to scale. A dashed line marks break-even.</p>
        </div>
      </section>

      {/* Examples */}
      <section className="section pt-0" aria-labelledby="ex-title">
        <div className="container-site">
          <SectionHead
            id="ex-title"
            kicker="Examples"
            lines={['Three trades,', 'worked through.']}
            lead="Illustrative prices to show the arithmetic. Real premiums come from the live chain and change all the time; commission is not included."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {EXAMPLES.map((ex, i) => (
              <Reveal key={ex.t} delay={i * 0.06} className="card flex flex-col p-6 sm:p-7">
                <span className="t-pixel text-[2rem] text-ember">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="t-h3 mt-4 !text-[1.35rem]">{ex.t}</h3>
                <p className="mt-3 rounded-xl border border-ember/30 bg-ember/[0.08] px-3.5 py-2.5 text-sm font-medium text-[#ffc7a6]">{ex.trade}</p>
                <FactList className="mt-4" items={ex.lines.map(([k, v]) => [k, v] as [string, string])} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Sell, book, rules */}
      <section className="section pt-0" aria-labelledby="rules-title">
        <div className="container-site grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <SectionHead
              id="rules-title"
              kicker="The rules"
              lines={['Clear rules,', 'stated up front.']}
            />
            <div className="mt-10 grid gap-4">
              <Reveal className="card p-6">
                <h3 className="text-lg font-semibold">Selling is allowed, and labelled</h3>
                <p className="t-body mt-2">
                  Anyone can sell (write) options. The ticket says plainly that your risk is not limited to the premium you
                  receive, and shows the margin the position uses. Seller margin is stress-tested across 16 price and
                  volatility scenarios.
                </p>
              </Reveal>
              <Reveal className="card p-6" delay={0.05}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">Exchange-style order book</h3>
                  <span className="chip chip-ember">Rolling out</span>
                </div>
                <p className="t-body mt-2">
                  Built into the chain: clients trade with each other and the Ezymex market maker quotes both sides under the
                  same rules. Limit, post-only, IOC and FOK orders, market orders inside a price band, reduce-only and stop
                  orders. The Book tab already shows depth and trades for every option.
                </p>
              </Reveal>
            </div>
          </div>
          <Reveal className="card self-start p-6 sm:p-8">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-fg-3">Contract terms</h3>
            <FactList
              className="mt-3"
              items={[
                ['Style', 'European, cash-settled in USD'],
                ['Expiries', 'Daily (next 5 business days), weekly (next 4 Fridays), monthly (next 3 month-ends)'],
                ['Cut', OPTIONS.cut],
                ['Settlement price', 'Average of 1-second mids over the final 30 minutes'],
                ['FX contract', OPTIONS.contract.fx],
                ['Gold · Silver', `${OPTIONS.contract.xau} · ${OPTIONS.contract.xag}`],
                ['WTI · Brent', OPTIONS.contract.oil],
                ['Contracts per order', OPTIONS.contractsPerOrder],
                ['Commission', OPTIONS.commission],
                ['Last new position', '15 minutes before the cut'],
                ['Buying', 'No margin; the most you can lose is the premium'],
                ['Selling', 'Uses margin; losses can exceed the premium'],
                ['Account', 'Same account as your CFDs, cross-margined'],
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* Analytics */}
      <section className="section overflow-x-clip pt-0" aria-labelledby="an-title">
        <div className="container-site">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHead id="an-title" kicker="Analytics" lines={['Analytics that', 'explain the price.']} />
            <p className="t-lead max-w-md" data-reveal>
              Volatility smile, term structure, open interest and the put/call ratio for every underlying. Prices come from
              standard models: {OPTIONS.models}.
            </p>
          </div>
          <Reveal className="mt-12">
            <BrowserFrame
              src="/images/product/focus-analytics.webp"
              alt="Options analytics for EURUSD: volatility smile, term structure, open interest by strike and the put/call ratio"
              url="trade.ezymex.com · Analytics"
              width={2200}
              height={1088}
              sizes="(min-width: 1360px) 1300px, 94vw"
            />
          </Reveal>
        </div>
      </section>

      {/* Underlyings */}
      <section className="section pt-0" aria-labelledby="und-title">
        <div className="container-site grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              id="und-title"
              kicker="Underlyings"
              lines={['Forex majors,', 'metals and oil.']}
              lead="Options on the markets you already trade: eight FX pairs live and NZDUSD next, gold and silver, WTI and Brent crude."
            />
            <div className="mt-8" data-reveal>
              <Button href="/markets" variant="outline">
                All markets
              </Button>
            </div>
          </div>
          <Reveal>
            <LiveList rows={UNDERLYINGS} initial={quotes} />
          </Reveal>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="faq-title">
        <div className="container-site grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead id="faq-title" kicker="Questions" lines={['Options,', 'answered.']} />
          <div>
            <Faq items={FAQ} schema />
            <RiskNote options className="mt-8" />
          </div>
        </div>
      </section>

      <CtaBand
        lines={['Make the call.', 'Try it on demo.']}
        lead="Open a free demo account, switch Ezymex Trader to Options, and place your first trade with virtual funds on live prices."
        options
        art="phone-light"
      />
    </>
  );
}
