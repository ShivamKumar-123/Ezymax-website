import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead, Reveal, FactList } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { CtaBand } from '@/components/ui/CtaBand';
import { Faq } from '@/components/ui/Faq';
import { RiskNote } from '@/components/ui/RiskNote';
import { PixelStat } from '@/components/motion/PixelStat';
import { PROP } from '@/content/facts';
import { REGISTER_HREF } from '@/lib/crm';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: 'Prop challenges: Classic 2-Step, Rapid 1-Step and Instant Funding',
  description:
    'Ezymex prop challenges: simulated accounts from $5k to $200k, fees from $49, profit split from 70–80% scaling to 90%, payouts every two weeks, rules checked live on the server.',
  alternates: { canonical: '/prop' },
};

const SIZES = ['$5k', '$10k', '$25k', '$50k', '$100k', '$200k'];

const STEPS = [
  { t: 'Choose a challenge', d: 'Pick a plan and an account size, and pay the fee from your USDT wallet.' },
  { t: 'Hit the target', d: 'Trade within the rules. Every limit is checked about once a second, with warnings at 50%, 75% and 90% of your daily loss.' },
  { t: 'Get funded', d: 'Pass and your funded account opens, with a certificate anyone can verify online.' },
  { t: 'Get paid', d: 'Request payouts on schedule once your identity is verified. Grow the account by 25% every four months at 10% profit.' },
];

const FAQ = [
  {
    q: 'Is the capital real?',
    a: 'Challenge and funded accounts trade simulated funds. Your profit split on a funded account is paid in real money to your Ezymex wallet, on the payout schedule of your plan.',
  },
  {
    q: 'When does the trading day reset?',
    a: 'At 17:00 New York time. Daily loss limits are measured from that point.',
  },
  {
    q: 'What is not allowed?',
    a: 'High-frequency trading, latency arbitrage, tick scalping, and copying or hedging across accounts. Rapid and Instant plans also exclude news trading and holding over the weekend.',
  },
  {
    q: 'What can I trade?',
    a: 'CFDs on the instruments available to your prop account. Prop accounts cannot trade options and do not count towards partner commissions.',
  },
  {
    q: 'What is the consistency rule?',
    a: 'On Rapid (40%) and Instant (30%) plans, no single day may make up more than that share of your total profit. Classic has no consistency rule.',
  },
  {
    q: 'Do I get the fee back?',
    a: 'On Classic and Rapid, yes: the challenge fee is refunded with your first payout. Instant Funding fees are not refunded.',
  },
];

export default function PropPage() {
  return (
    <>
      <PageHero
        kicker="Prop challenges"
        lines={['Prove your edge.', <span key="b" className="text-ember-grad">Keep up to 90%.</span>]}
        lead="Pass a 1-Step or 2-Step evaluation, or start funded instantly. Simulated accounts from $5k to $200k, rules checked live on the server, payouts in USDT."
        art="burst"
        artPosition="75% center"
        actions={
          <>
            <Button href={REGISTER_HREF}>Start a challenge</Button>
            <Button href="#plans" variant="outline" arrow={false}>
              Compare plans
            </Button>
          </>
        }
        footer={
          <dl className="grid max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-6">
            {[
              { v: 90, s: '%', l: 'Top profit split' },
              { v: 200, p: '$', s: 'k', l: 'Largest account' },
              { v: 49, p: '$', l: 'Fees from' },
            ].map((x) => (
              <div key={x.l}>
                <dt className="sr-only">{x.l}</dt>
                <dd>
                  <PixelStat value={x.v} prefix={x.p} suffix={x.s} className="t-pixel block text-[2.2rem] sm:text-[2.8rem]" />
                  <p className="mt-1 text-[12px] text-fg-2">{x.l}</p>
                </dd>
              </div>
            ))}
          </dl>
        }
      />

      <section id="plans" className="section scroll-mt-24" aria-labelledby="plans-title">
        <div className="container-site">
          <SectionHead
            id="plans-title"
            kicker="Plans"
            lines={['Three ways', 'to get funded.']}
            lead="The rules below are the plan defaults shown in the Client Area when you buy."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {PROP.map((p, i) => (
              <Reveal
                key={p.id}
                delay={i * 0.06}
                className={cn(
                  'flex flex-col rounded-[28px] border p-7',
                  i === 0 ? 'border-ember/50 bg-[linear-gradient(180deg,rgba(255,90,31,0.16),rgba(255,90,31,0.02)_60%)]' : 'border-white/[0.09] bg-[linear-gradient(180deg,#131317,#0d0d10)]',
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[1.9rem] font-semibold tracking-[-0.045em]">{p.name}</h3>
                  {i === 0 && <span className="chip chip-ember">Most popular</span>}
                </div>
                <p className="mt-2 text-fg-2">{p.summary}</p>
                <FactList
                  className="mt-6"
                  items={[
                    ['Targets', p.phases],
                    ['Minimum days', p.minDays],
                    ['Daily loss limit', p.dailyLoss],
                    ['Maximum drawdown', p.maxDrawdown],
                    ['Profit split', p.split],
                    ['Payouts', p.payouts],
                    ['Leverage', p.leverage],
                    ['Challenge fee', p.refund],
                    ['Style', p.news],
                  ]}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="price-title">
        <div className="container-site">
          <SectionHead id="price-title" kicker="Fees" lines={['One-time fee,', 'by account size.']} />
          <div className="no-scrollbar -mx-[var(--gutter)] mt-12 overflow-x-auto px-[var(--gutter)]" data-reveal>
            <table className="table-clean w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th scope="col" className="py-4 pr-4">Account size</th>
                  {PROP.map((p) => (
                    <th key={p.id} scope="col" className="px-4 py-4 !text-right !text-[0.9rem] !normal-case !tracking-tight !text-fg">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SIZES.map((size) => (
                  <tr key={size} className="border-b border-white/[0.06]">
                    <th scope="row" className="py-4 pr-4 !text-base !font-semibold !normal-case !tracking-tight !text-fg">
                      {size}
                    </th>
                    {PROP.map((p) => {
                      const hit = p.sizes.find(([s]) => s === size);
                      return (
                        <td key={p.id} className="num px-4 py-4 text-right text-[0.95rem]">
                          {hit ? hit[1] : <span className="text-fg-3">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-fg-3">Fees are paid once, in USDT from your Ezymex wallet. Instant Funding is available up to $100k.</p>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="how-prop">
        <div className="container-site">
          <SectionHead id="how-prop" kicker="How it works" lines={['From challenge', 'to payout.']} />
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

      <section className="section pt-0" aria-labelledby="pfaq-title">
        <div className="container-site grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead id="pfaq-title" kicker="Questions" lines={['Prop,', 'answered.']} />
          <div>
            <Faq items={FAQ} schema />
            <p className="mt-8 max-w-2xl text-[0.78rem] leading-relaxed text-fg-3">
              Prop challenge and funded accounts use simulated funds; the fee pays for the evaluation. Payouts follow your plan’s
              rules and require a verified identity.
            </p>
            <RiskNote className="mt-3" />
          </div>
        </div>
      </section>

      <CtaBand lines={['Your challenge', 'starts today.']} primary={{ label: 'Start a challenge', href: REGISTER_HREF }} art="chart-wall" />
    </>
  );
}
