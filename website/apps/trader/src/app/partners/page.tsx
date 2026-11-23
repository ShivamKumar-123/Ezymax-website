import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead, Reveal } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { BrowserFrame } from '@/components/ui/Frames';
import { CtaBand } from '@/components/ui/CtaBand';
import { Faq } from '@/components/ui/Faq';
import { IB, IB_LEVELS } from '@/content/facts';
import { REGISTER_HREF } from '@/lib/crm';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: 'Partners (IB): earn on every lot your network trades',
  description:
    'Every Ezymex client is a partner from sign-up: per-lot commission on three referral tiers, CPA rewards, five levels from Bronze to Diamond and weekly USDT payouts.',
  alternates: { canonical: '/partners' },
};

const HOW = [
  { t: 'Share your link', d: 'Your partner link and code are ready the moment you sign up, with campaign links and a QR code for each channel.' },
  { t: 'Clients trade', d: 'Earn a fixed amount per lot your clients trade, set by asset class and your partner level.' },
  { t: 'Your network grows', d: `Earn on three tiers by default: ${IB.tierShares} of the per-lot rate. Share part of it with sub-partners or as a rebate to clients.` },
  { t: 'Get paid weekly', d: `${IB.payout}, from ${IB.minPayout}.` },
];

const FAQ = [
  {
    q: 'Who can become a partner?',
    a: 'Every Ezymex client. Your partner dashboard, link and code are in the Client Area from day one; there is no separate application.',
  },
  {
    q: 'What counts towards commission?',
    a: 'Closed trades on your clients’ live accounts that were held for at least two minutes.',
  },
  {
    q: 'What is CPA?',
    a: 'A one-off reward for each new client who deposits at least $500 and places a first trade, paid after a 30-day hold. $200 at Bronze and Silver, $300 from Gold.',
  },
  {
    q: 'Can I give part of my commission back?',
    a: 'Yes. You can pass up to 50% to clients as a rebate and up to 50% to your sub-partners.',
  },
  {
    q: 'How do levels work?',
    a: 'You start at Bronze. Levels rise with the number of active clients and the lots they trade each month, and every level raises your per-lot rates.',
  },
];

export default function PartnersPage() {
  return (
    <>
      <PageHero
        kicker="Partners (IB)"
        lines={['Earn on every lot', <span key="b" className="text-fg-3">your network trades.</span>]}
        lead="Every Ezymex client is a partner from sign-up. Share your link, earn per-lot commission on three tiers of referrals, and get paid every week in USDT."
        actions={
          <>
            <Button href={REGISTER_HREF}>Become a partner</Button>
            <Button href="#levels" variant="outline" arrow={false}>
              See the rates
            </Button>
          </>
        }
        visual={
          <BrowserFrame
            src="/images/product/focus-partner.webp"
            alt="Partner dashboard in the Ezymex Client Area with level progress, referral link and earnings"
            url="app.ezymex.com · Partner"
            width={2772}
            height={1120}
            priority
            tilt
            caption="Illustrative data"
            sizes="(min-width: 1024px) 680px, 92vw"
          />
        }
      />

      <section className="section" aria-labelledby="ph-title">
        <div className="container-site">
          <SectionHead id="ph-title" kicker="How it works" lines={['Share, earn,', 'get paid.']} />
          <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {HOW.map((s, i) => (
              <Reveal as="li" key={s.t} delay={i * 0.06} className="card p-6">
                <span className="t-pixel text-[2.4rem] text-ember">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{s.t}</h3>
                <p className="t-body mt-2">{s.d}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section id="levels" className="section scroll-mt-24 pt-0" aria-labelledby="lv-title">
        <div className="container-site">
          <SectionHead
            id="lv-title"
            kicker="Partner levels"
            lines={['Five levels.', 'Higher rates at each.']}
            lead="Commission in US dollars per lot traded by your direct clients. Your level updates as your network grows."
          />
          <div className="no-scrollbar -mx-[var(--gutter)] mt-12 overflow-x-auto px-[var(--gutter)]" data-reveal>
            <table className="table-clean w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th scope="col" className="py-4 pr-4">Level</th>
                  <th scope="col" className="px-4 py-4 !text-right">FX majors</th>
                  <th scope="col" className="px-4 py-4 !text-right">Metals</th>
                  <th scope="col" className="px-4 py-4 !text-right">Crypto</th>
                  <th scope="col" className="px-4 py-4 !text-right">CPA</th>
                  <th scope="col" className="px-4 py-4">To reach it</th>
                </tr>
              </thead>
              <tbody>
                {IB_LEVELS.map((l, i) => (
                  <tr key={l.name} className={cn('border-b border-white/[0.06]', i === IB_LEVELS.length - 1 && 'bg-ember/[0.06]')}>
                    <th scope="row" className="py-4 pr-4 !text-base !font-semibold !normal-case !tracking-tight !text-fg">
                      {l.name}
                    </th>
                    <td className="num px-4 py-4 text-right">${l.fxMajor}</td>
                    <td className="num px-4 py-4 text-right">${l.metals}</td>
                    <td className="num px-4 py-4 text-right">${l.crypto}</td>
                    <td className="num px-4 py-4 text-right">${l.cpa}</td>
                    <td className="px-4 py-4 text-fg-2">{l.needs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-fg-3">
            Rates per standard lot. FX minors, indices, energies and stocks have their own rates at each level, shown in your
            partner dashboard. These are the current default rates and can change.
          </p>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="pt-title">
        <div className="container-site grid gap-4 lg:grid-cols-3">
          {[
            ['Three tiers deep', `Earn on clients referred by your clients: ${IB.tierShares} of the per-lot rate.`],
            ['Campaign links', 'One link per channel, with clicks, sign-ups and first deposits tracked for each.'],
            ['White-label ready', 'Bringing a whole business? Run your own brand on the Ezymex platform.'],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.06} className="card p-7">
              <h3 id={i === 0 ? 'pt-title' : undefined} className="t-h3">
                {t}
              </h3>
              <p className="t-body mt-3">{d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="pfq-title">
        <div className="container-site grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead id="pfq-title" kicker="Questions" lines={['Partners,', 'answered.']} />
          <Faq items={FAQ} schema />
        </div>
      </section>

      <CtaBand
        lines={['Your link is', 'waiting.']}
        lead="Sign up and your partner dashboard, link and code are ready. No application, no minimums to start."
        primary={{ label: 'Become a partner', href: REGISTER_HREF }}
        secondary={{ label: 'White-label', href: '/white-label' }}
        photo="team-desk"
      />
    </>
  );
}
