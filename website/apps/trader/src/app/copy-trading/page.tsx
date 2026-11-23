import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead, Reveal } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { CtaBand } from '@/components/ui/CtaBand';
import { Faq } from '@/components/ui/Faq';
import { RiskNote } from '@/components/ui/RiskNote';
import { SOCIAL } from '@/content/facts';
import { REGISTER_HREF } from '@/lib/crm';

export const metadata: Metadata = {
  title: 'Copy trading, PAMM and MAM',
  description:
    'Follow verified masters with your own risk controls, invest in PAMM funds or link to a MAM manager. Or become a master and earn a performance fee on new highs.',
  alternates: { canonical: '/copy-trading' },
};

const PRODUCTS = [
  {
    id: 'copy',
    name: 'Copy trading',
    tone: 'ember' as const,
    d: 'A dedicated copy account mirrors every trade of the master you follow: opens, partial closes, stop loss and take profit changes, and pending orders.',
    points: [`Sizing: ${SOCIAL.sizingModes.join(', ').toLowerCase()}`, `Your limits: ${SOCIAL.followerControls.join(', ').toLowerCase()}`, `From ${SOCIAL.minAllocation}`],
  },
  {
    id: 'pamm',
    name: 'PAMM funds',
    tone: 'ink' as const,
    d: 'Invest in a pooled fund run by a manager. Your share is tracked as units with a net asset value that starts at 1.00.',
    points: ['The manager sets the minimum investment, lock-in period and maximum drawdown', 'Set your own stop loss on your investment', 'The manager keeps at least 5% of the fund as own capital'],
  },
  {
    id: 'mam',
    name: 'MAM',
    tone: 'cream' as const,
    d: 'Link your own trading account to a money manager. They trade, you keep the account and the money in it.',
    points: [`Allocation by ${SOCIAL.mamMethods.join(', ').toLowerCase()}`, 'The manager has trading authority only: no deposits or withdrawals', 'Performance fee up to 90% and management fee up to 10% a year, shown before you accept'],
  },
];

const STEPS = [
  { t: 'Pick a master', d: 'Compare verified track records, risk scores from 1 to 10 and fees, all shown up front.' },
  { t: 'Choose sizing', d: 'Proportional to equity, a fixed allocation, a multiplier or a fixed lot size.' },
  { t: 'Set your limits', d: 'Equity stop, maximum drawdown, maximum lot size and symbols you never want copied.' },
  { t: 'Copying starts', d: 'A copy account opens and mirrors every trade. Pause or stop whenever you like.' },
];

const FAQ = [
  {
    q: 'How are masters chosen?',
    a: `Every master is approved by our team. They need a verified identity, a live account, at least ${SOCIAL.trackRecordDays} days of track record and at least ${SOCIAL.minMasterEquity} in equity.`,
  },
  {
    q: 'How do fees work?',
    a: `Masters charge a performance fee of ${SOCIAL.perfFee} of profit, and only on new highs (a high-water mark), so you never pay twice for the same gain. Fees are settled daily, weekly or monthly, as the master chooses, and checked by our team.`,
  },
  {
    q: 'Why is trade history delayed?',
    a: `A master’s public trade history is shown with a ${SOCIAL.historyDelay} delay so nobody can front-run their positions. Your copy account receives trades in real time.`,
  },
  {
    q: 'Can I lose money copying?',
    a: 'Yes. Copying a master means taking the same market risk they take, scaled to your size. Past performance does not guarantee future results; use the equity stop and drawdown limits.',
  },
  {
    q: 'Can I become a master?',
    a: 'Yes, from the Client Area. Meet the requirements, set your fee and strategy description, and apply. Ezymex keeps 20% of the performance fees you earn.',
  },
];

export default function CopyTradingPage() {
  return (
    <>
      <PageHero
        kicker="Copy trading · PAMM · MAM"
        lines={['Follow a master.', <span key="b" className="text-fg-3">Or become one.</span>]}
        lead="Mirror verified traders with limits you set, invest in managed funds, or let a manager trade your account. Fees are charged only on new highs."
        art="analyst"
        artPosition="70% 30%"
        actions={
          <>
            <Button href={REGISTER_HREF}>Start copying</Button>
            <Button href="#master" variant="outline" arrow={false}>
              Become a master
            </Button>
          </>
        }
      />

      <section className="section" aria-labelledby="ways-title">
        <div className="container-site">
          <SectionHead id="ways-title" kicker="Three ways in" lines={['Choose how hands-on', 'you want to be.']} />
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {PRODUCTS.map((p, i) => (
              <Reveal
                key={p.id}
                delay={i * 0.06}
                className={
                  p.tone === 'ember'
                    ? 'scroll-mt-28 rounded-[28px] bg-[linear-gradient(135deg,#ff5a1f,#ff8a3d)] p-7 text-[#140904]'
                    : p.tone === 'cream'
                      ? 'scroll-mt-28 rounded-[28px] bg-cream p-7 text-[#140904]'
                      : 'scroll-mt-28 rounded-[28px] border border-white/[0.09] bg-[linear-gradient(180deg,#131317,#0d0d10)] p-7'
                }
              >
                <span id={p.id} aria-hidden />
                <h3 className="font-display text-[2rem] font-semibold tracking-[-0.045em]">{p.name}</h3>
                <p className={p.tone === 'ink' ? 't-body mt-3' : 'mt-3 leading-relaxed text-black/75'}>{p.d}</p>
                <ul className="mt-6 flex flex-col">
                  {p.points.map((pt) => (
                    <li key={pt} className={p.tone === 'ink' ? 'border-t border-white/[0.08] py-3 text-sm text-fg' : 'border-t border-black/15 py-3 text-sm'}>
                      {pt}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="cs-title">
        <div className="container-site">
          <SectionHead id="cs-title" kicker="How copying works" lines={['Four steps,', 'your rules.']} />
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

      <section id="master" className="section scroll-mt-24 pt-0" aria-labelledby="m-title">
        <div className="container-site">
          <div className="relative overflow-hidden rounded-[36px] border border-white/[0.08] bg-[linear-gradient(180deg,#120d0b,#0b0a0c)] p-6 sm:p-12 lg:p-16">
            <div aria-hidden className="glow-ember right-[-15%] top-[-40%] h-[90%] w-[50%] opacity-35" />
            <div className="relative grid gap-12 lg:grid-cols-2">
              <SectionHead
                id="m-title"
                kicker="For traders with a record"
                lines={['Become a master.', 'Earn on new highs.']}
                lead="Publish your strategy, let others copy it or invest in your fund, and earn a performance fee whenever your followers reach a new high."
              />
              <ul className="grid gap-3 self-end sm:grid-cols-2">
                {[
                  ['Performance fee', `${SOCIAL.perfFee}, on new highs only`],
                  ['Track record', `${SOCIAL.trackRecordDays} days minimum`],
                  ['Master equity', `${SOCIAL.minMasterEquity} minimum`],
                  ['PAMM own capital', 'At least 5% of the fund'],
                  ['Approval', 'Verified identity and a live account'],
                  ['Platform share', '20% of the fees you earn'],
                ].map(([k, v]) => (
                  <li key={k} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4" data-reveal>
                    <p className="text-[12px] uppercase tracking-[0.12em] text-fg-3">{k}</p>
                    <p className="mt-1.5 text-[15px] font-semibold">{v}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="cfaq-title">
        <div className="container-site grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead id="cfaq-title" kicker="Questions" lines={['Copying,', 'answered.']} />
          <div>
            <Faq items={FAQ} schema />
            <p className="mt-8 max-w-2xl text-[0.78rem] leading-relaxed text-fg-3">
              Past performance is not a reliable indicator of future results. Copy trading, PAMM and MAM accounts trade CFDs and
              cannot trade options.
            </p>
            <RiskNote className="mt-3" />
          </div>
        </div>
      </section>

      <CtaBand lines={['Find a master', 'to follow.']} primary={{ label: 'Start copying', href: REGISTER_HREF }} art="desk-streaks" />
    </>
  );
}
