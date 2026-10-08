import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead, Reveal, FactList } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { BrowserFrame } from '@/components/ui/Frames';
import { CtaBand } from '@/components/ui/CtaBand';
import { Faq } from '@/components/ui/Faq';
import { RiskNote } from '@/components/ui/RiskNote';
import { PixelStat } from '@/components/motion/PixelStat';
import { ACCOUNTS, DEMO, FUNDING } from '@/content/facts';
import { REGISTER_HREF } from '@/lib/crm';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: 'Account types: Standard, Pro, ECN, Cent, VIP and demo',
  description:
    'Compare Ezymex trading accounts: minimum deposit from $10, leverage up to 1:1000, all-in spreads or raw spreads with commission, hedging or netting, and free demo accounts.',
  alternates: { canonical: '/accounts' },
};

const ROWS: [string, (a: (typeof ACCOUNTS)[number]) => string][] = [
  ['Account currency', (a) => a.currency],
  ['Minimum deposit', (a) => a.minDeposit],
  ['Leverage', (a) => a.leverageOptions],
  ['Pricing', (a) => a.pricing],
  ['Spread', (a) => a.spread],
  ['Commission', (a) => a.commission],
  ['Margin call / stop out', (a) => `${a.marginCall} / ${a.stopOut}`],
  ['Position mode', (a) => a.mode],
  ['Negative balance protection', () => 'Yes'],
  ['Ezymex FX Options', () => 'Yes, same account'],
  ['Best for', (a) => a.bestFor],
];

const STEPS = [
  { t: 'Sign up', d: 'Create your Ezymex profile in the Client Area with your email. It takes a minute.' },
  { t: 'Open an account', d: 'Choose live or demo, the account type and your leverage. Your login is issued instantly.' },
  { t: 'Fund your wallet', d: `Deposit ${FUNDING.methods}. Credited ${FUNDING.creditTime}.` },
  { t: 'Trade', d: 'Move funds to your account, instantly and free, then trade CFDs and options in Ezymex Trader.' },
];

const FAQ = [
  {
    q: 'How many accounts can I open?',
    a: 'You can hold several live and demo accounts at the same time, up to five of each account type, and move money between them and your wallet instantly.',
  },
  {
    q: 'What is the difference between hedging and netting?',
    a: 'In hedging mode you can hold buy and sell positions on the same instrument at once, each with its own stop loss and take profit. In netting mode each instrument has one position, and new trades add to it or reduce it. Pro accounts come in both modes.',
  },
  {
    q: 'What is a Cent account?',
    a: 'Its balance is shown in US cents, so a $10 deposit appears as 1,000 cents. You trade the same markets at a smaller size, which makes it a good way to test a strategy with real money.',
  },
  {
    q: 'Can I change my leverage later?',
    a: 'Yes, from the Client Area, as long as the account has no open positions. The leverage on any single trade is also capped by the instrument’s own limit.',
  },
  {
    q: 'Do I need to verify my identity?',
    a: 'Not to sign up, open accounts or deposit. Withdrawals need a verified identity (KYC), which you complete in the Client Area with your phone camera.',
  },
  {
    q: 'What does “raw spread” mean?',
    a: 'The spread from our price feed with no markup added. ECN and VIP accounts trade on it and pay a fixed commission per lot instead. Standard, Pro and Cent accounts add a fixed markup and charge no commission.',
  },
];

export default function AccountsPage() {
  return (
    <>
      <PageHero
        kicker="Account types"
        lines={['Five live accounts.', <span key="b" className="text-fg-3">Free demo.</span>]}
        lead="Standard, Pro, ECN, Cent and VIP: choose all-in pricing or raw spreads with a commission, hedging or netting, dollars or cents. Every account trades CFDs and Ezymex FX Options."
        actions={
          <>
            <Button href={REGISTER_HREF}>Open account</Button>
            <Button href="#compare" variant="outline" arrow={false}>
              Compare all
            </Button>
          </>
        }
        visual={
          <BrowserFrame
            src="/images/product/focus-open-account.webp"
            alt="Opening a trading account in the Ezymex Client Area: live or demo, with the account’s terms on the right"
            url="app.ezymex.com"
            width={2772}
            height={1280}
            priority
            tilt
            sizes="(min-width: 1024px) 680px, 92vw"
          />
        }
      />

      <section className="section" aria-labelledby="types-title">
        <div className="container-site">
          <SectionHead id="types-title" kicker="Choose" lines={['Pick your pricing.']} />
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ACCOUNTS.map((a, i) => (
              <Reveal
                key={a.id}
                delay={(i % 3) * 0.05}
                className={cn(
                  'relative flex scroll-mt-28 flex-col overflow-hidden rounded-[28px] border p-7',
                  a.highlight
                    ? 'border-ember/50 bg-[linear-gradient(180deg,rgba(255,90,31,0.18),rgba(255,90,31,0.02)_60%)]'
                    : 'border-white/[0.09] bg-[linear-gradient(180deg,#131317,#0d0d10)]',
                )}
              >
                <span id={a.id} className="absolute -top-28" aria-hidden />
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[2.2rem] font-semibold tracking-[-0.045em]">{a.name}</h3>
                  {a.highlight && <span className="chip chip-ember">Most popular</span>}
                </div>
                <p className="mt-2 text-fg-2">{a.tagline}</p>
                <div className="mt-6 flex items-end gap-6">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-fg-3">From</p>
                    <p className="t-pixel mt-1 text-[2.6rem]">{a.minDeposit}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-fg-3">Leverage up to</p>
                    <p className="t-pixel mt-1 text-[2.6rem]">{a.leverage}</p>
                  </div>
                </div>
                <FactList
                  className="mt-6"
                  items={[
                    ['Spread', a.spread],
                    ['Commission', a.commission],
                    ['Margin call / stop out', `${a.marginCall} / ${a.stopOut}`],
                    ['Mode', a.mode],
                  ]}
                />
                <div className="mt-auto pt-7">
                  <Button href={REGISTER_HREF} variant={a.highlight ? 'ember' : 'outline'} size="sm">
                    Open {a.name}
                  </Button>
                </div>
              </Reveal>
            ))}
            <Reveal
              delay={0.1}
              className="relative flex scroll-mt-28 flex-col overflow-hidden rounded-[28px] bg-cream p-7 text-[#140904]"
            >
              <span id="demo" className="absolute -top-28" aria-hidden />
              <h3 className="font-display text-[2.2rem] font-semibold tracking-[-0.045em]">Demo</h3>
              <p className="mt-2 text-black/70">Practise for free with virtual funds on live prices. CFDs and options.</p>
              <div className="mt-6 flex items-end gap-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-black/55">Starts with</p>
                  <p className="t-pixel mt-1 text-[2.6rem]">{DEMO.defaultBalance}</p>
                </div>
              </div>
              <ul className="mt-6 flex flex-col gap-2.5 text-sm text-black/75">
                <li className="border-t border-black/10 pt-2.5">Choose any balance from {DEMO.balanceRange}</li>
                <li className="border-t border-black/10 pt-2.5">Refill up to {DEMO.refillsPerDay} times a day</li>
                <li className="border-t border-black/10 pt-2.5">Every instrument, stocks included</li>
                <li className="border-t border-black/10 pt-2.5">Expires after 10 days without a login</li>
              </ul>
              <div className="mt-auto pt-7">
                <Button href={REGISTER_HREF} variant="light" size="sm" className="!bg-[#140904] !text-cream">
                  Try a free demo
                </Button>
              </div>
            </Reveal>
          </div>
          <p className="mt-6 text-xs text-fg-3">
            1 pip = 10 points on a 5-digit FX pair. Raw spreads are the spreads of our price feed and move with the market. The
            figures shown are the current defaults and can change.
          </p>
        </div>
      </section>

      <section id="compare" className="section scroll-mt-24 pt-0" aria-labelledby="cmp-title">
        <div className="container-site">
          <SectionHead id="cmp-title" kicker="Side by side" lines={['Compare every', 'account.']} />
          <div className="no-scrollbar -mx-[var(--gutter)] mt-12 overflow-x-auto px-[var(--gutter)]" data-reveal>
            <table className="table-clean w-full min-w-[860px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 w-[200px] bg-ink py-4 pr-4">
                    <span className="sr-only">Feature</span>
                  </th>
                  {ACCOUNTS.map((a) => (
                    <th
                      key={a.id}
                      scope="col"
                      className={cn('px-4 py-4 !text-[0.95rem] !normal-case !tracking-tight !text-fg', a.highlight && 'rounded-t-2xl bg-ember/[0.1]')}
                    >
                      {a.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, get]) => (
                  <tr key={label}>
                    <th scope="row" className="sticky left-0 z-10 border-t border-white/[0.07] bg-ink py-3.5 pr-4 !text-[0.8rem] !font-normal !normal-case !tracking-normal text-fg-3">
                      {label}
                    </th>
                    {ACCOUNTS.map((a) => (
                      <td key={a.id} className={cn('border-t border-white/[0.07] px-4 py-3.5 align-top text-fg', a.highlight && 'bg-ember/[0.06]')}>
                        {get(a)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="open" className="section scroll-mt-24 pt-0" aria-labelledby="open-title">
        <div className="container-site">
          <SectionHead id="open-title" kicker="Get started" lines={['Trading in', 'four steps.']} />
          <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.t} delay={i * 0.06} className="card p-6">
                <span className="t-pixel text-[2.4rem] text-ember">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{s.t}</h3>
                <p className="t-body mt-2">{s.d}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section id="funding" className="section scroll-mt-24 pt-0" aria-labelledby="fund-title">
        <div className="container-site">
          <div className="relative overflow-hidden rounded-[36px] border border-white/[0.08] bg-[linear-gradient(180deg,#120d0b,#0b0a0c)] p-6 sm:p-12 lg:p-16">
            <div aria-hidden className="glow-ember right-[-15%] top-[-40%] h-[90%] w-[50%] opacity-35" />
            <div className="relative grid gap-12 lg:grid-cols-[1fr_1fr]">
              <SectionHead
                id="fund-title"
                kicker="Funding"
                lines={['Deposit USDT.', 'Trade in a minute.']}
                lead="Your Ezymex wallet takes USDT on BNB Chain (BEP20) and TRON (TRC20), verified on-chain. Pay from MetaMask or TronLink, or send to your deposit address. USDT is credited 1:1 as US dollars."
              />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-10 self-end">
                {[
                  { v: 10, s: ' USDT', l: 'Minimum deposit' },
                  { v: 1, s: ' min', l: 'Usual time to credit', pre: '~' },
                  { v: 1, s: ' USDT', l: 'Withdrawal fee, flat' },
                  { v: 0, s: '', l: 'Fee to move funds between wallet and accounts', pre: '$' },
                ].map((x) => (
                  <div key={x.l} data-reveal>
                    <dt className="sr-only">{x.l}</dt>
                    <dd>
                      <PixelStat value={x.v} prefix={x.pre} suffix={x.s} className="t-pixel block text-[2.4rem] sm:text-[3rem]" />
                      <p className="mt-2 text-[13px] text-fg-2">{x.l}</p>
                      <div className="stat-line mt-3" />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="relative mt-10 text-xs text-fg-3">
              Withdrawals from {FUNDING.withdrawalRange} per request need a verified identity and are reviewed before they are
              sent. To protect your account, funds cannot be withdrawn within 24 hours of a deposit.
            </p>
          </div>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="afaq-title">
        <div className="container-site grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead id="afaq-title" kicker="Questions" lines={['Accounts,', 'answered.']} />
          <div>
            <Faq items={FAQ} schema />
            <RiskNote className="mt-8" />
          </div>
        </div>
      </section>

      <CtaBand lines={['Open an account', 'in a minute.']} art="analyst" />
    </>
  );
}
