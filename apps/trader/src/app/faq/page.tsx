import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Faq } from '@/components/ui/Faq';
import { RiskNote } from '@/components/ui/RiskNote';
import { ACCOUNTS, DEMO, FUNDING, OPTIONS, IB } from '@/content/facts';
import { BRAND_SUPPORT_EMAIL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Answers about Ezymex accounts, USDT deposits and withdrawals, trading conditions, Ezymex FX Options, copy trading, partners and the platform.',
  alternates: { canonical: '/faq' },
};

type Group = { id: string; title: string; items: { q: string; a: string }[] };

const minDeposits = ACCOUNTS.map((a) => `${a.name} ${a.minDeposit}`).join(', ');

const GROUPS: Group[] = [
  {
    id: 'accounts',
    title: 'Accounts',
    items: [
      {
        q: 'Which account types are there?',
        a: `Three live account types, Standard, Pro and VIP, plus free demo accounts. Standard uses an all-in spread with no commission; Pro and VIP trade on tighter spreads with a fixed commission per lot. Minimum deposits: ${minDeposits}.`,
      },
      {
        q: 'How do I open an account?',
        a: 'Sign up in the Client Area with your email, then open a live or demo account, choose the account type and leverage. Your login is issued instantly.',
      },
      {
        q: 'Is the demo account free?',
        a: `Yes. A demo account starts with ${DEMO.defaultBalance} in virtual funds (you can choose from ${DEMO.balanceRange}), can be refilled up to ${DEMO.refillsPerDay} times a day, and trades every instrument on live prices, options included.`,
      },
      {
        q: 'Do I need to verify my identity?',
        a: 'Not to sign up, open accounts or deposit. Withdrawals need a verified identity (KYC), which you complete in the Client Area with your phone camera.',
      },
    ],
  },
  {
    id: 'funding',
    title: 'Deposits and withdrawals',
    items: [
      {
        q: 'How do I deposit?',
        a: `Deposit ${FUNDING.methods} to your Ezymex wallet, from MetaMask or TronLink or by sending to your deposit address. The minimum is ${FUNDING.minDeposit}, and deposits are ${FUNDING.creditTime}. USDT is credited 1:1 as US dollars.`,
      },
      {
        q: 'How do I withdraw?',
        a: `Request a withdrawal from your wallet in the Client Area: ${FUNDING.withdrawalRange} per request, with a ${FUNDING.withdrawalFee} fee. Withdrawals need a verified identity and are reviewed before they are sent. To protect your account, funds cannot be withdrawn within 24 hours of a deposit.`,
      },
      {
        q: 'How do I move money between my wallet and my accounts?',
        a: `${FUNDING.transfers}, from the wallet page in the Client Area.`,
      },
      {
        q: 'Can I deposit by card or bank transfer?',
        a: 'Not at the moment. Ezymex accepts USDT on BNB Chain (BEP20) and TRON (TRC20).',
      },
    ],
  },
  {
    id: 'trading',
    title: 'Trading conditions',
    items: [
      {
        q: 'What can I trade?',
        a: 'CFDs on 1,389 instruments: forex, metals, energies, indices and crypto (24/7), with 1,100 US, Hong Kong and Tokyo stocks on demo now and coming to live accounts soon. Ezymex FX Options add calls and puts on forex, gold, silver and oil.',
      },
      {
        q: 'What is the maximum leverage?',
        a: 'Up to 1:1000 on Standard accounts and 1:500 on Pro and VIP. The leverage on a single trade is also capped by the instrument, for example 1:20 on the main cryptocurrencies.',
      },
      {
        q: 'What are the margin call and stop-out levels?',
        a: 'Margin call at 100% and stop out at 50% on all accounts except Cent, where they are 60% and 20%. Negative balance protection resets a negative balance to zero.',
      },
      {
        q: 'Do you charge overnight financing?',
        a: 'Positions held overnight are charged or credited financing, shown in Ezymex Trader for each instrument before you trade. Crypto is charged every night, weekends included.',
      },
    ],
  },
  {
    id: 'options',
    title: 'Ezymex FX Options',
    items: [
      {
        q: 'What are Ezymex FX Options?',
        a: `Calls and puts on ${OPTIONS.fxPairs - 1} FX pairs, gold, silver, WTI and Brent, with daily, weekly and monthly expiries. They are European style and settled in cash in US dollars, in the same account as your CFDs.`,
      },
      {
        q: 'What is the most I can lose?',
        a: 'When you buy an option, the most you can lose is the premium you paid. Selling an option is different: your loss is not limited to the premium you receive, and the position uses margin.',
      },
      {
        q: 'What does it cost?',
        a: `The premium shown on the chain, plus a commission of ${OPTIONS.commission}.`,
      },
      {
        q: 'How do options settle?',
        a: `Automatically, in cash, at the average of one-second mid prices over the 30 minutes before the ${OPTIONS.cut} cut. You can also close a position at any time before then.`,
      },
    ],
  },
  {
    id: 'copy',
    title: 'Copy trading, PAMM and MAM',
    items: [
      {
        q: 'How does copy trading work?',
        a: 'A copy account mirrors every trade of the master you follow, sized the way you choose, within limits you set: equity stop, maximum drawdown, maximum lot size and excluded symbols. You can pause or stop at any time.',
      },
      {
        q: 'What do masters charge?',
        a: 'A performance fee of up to 50% of profit, charged only on new highs, so you never pay twice for the same gain.',
      },
      {
        q: 'Can I lose money copying?',
        a: 'Yes. Copying takes the same market risk the master takes, scaled to your size. Past performance does not guarantee future results.',
      },
    ],
  },
  {
    id: 'partners',
    title: 'Partners',
    items: [
      {
        q: 'How do I become a partner?',
        a: 'Every Ezymex client is a partner from sign-up. Your partner link, code and dashboard are in the Client Area; there is no separate application.',
      },
      {
        q: 'How am I paid?',
        a: `A fixed amount per lot your clients trade, set by asset class and your partner level, on ${IB.tiers} tiers of referrals. Payouts: ${IB.payout.toLowerCase()}, from ${IB.minPayout}.`,
      },
    ],
  },
  {
    id: 'platform',
    title: 'Platform and apps',
    items: [
      {
        q: 'Do I need to install anything?',
        a: 'No. Ezymex Trader and the Client Area run in any modern browser on desktop and phone.',
      },
      {
        q: 'Is there a mobile app?',
        a: 'A native Android app is coming soon. Until then, everything works in your phone’s browser.',
      },
      {
        q: 'Which languages are available?',
        a: 'Ezymex Trader and the Client Area are translated into 22 languages, including Arabic, Urdu and Persian (right to left), Hindi, Bengali, Tamil, Chinese, Japanese, Korean and the main European languages.',
      },
    ],
  },
];

const LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: GROUPS.flatMap((g) => g.items).map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
};

export default function FaqPage() {
  return (
    <>
      <PageHero
        compact
        kicker="FAQ"
        lines={['Questions,', <span key="b" className="text-fg-3">answered.</span>]}
        lead="Accounts, funding, trading conditions, options, copy trading, partners and the platform."
      />
      <section className="section pt-8" aria-label="Frequently asked questions">
        <div className="container-site grid gap-12 lg:grid-cols-[240px_1fr] lg:gap-16">
          <nav aria-label="FAQ topics" className="lg:sticky lg:top-28 lg:self-start">
            <ul className="no-scrollbar -mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] lg:mx-0 lg:flex-col lg:gap-1 lg:px-0">
              {GROUPS.map((g) => (
                <li key={g.id} className="flex-none">
                  <a href={`#${g.id}`} className="chip lg:!flex lg:!h-auto lg:!border-0 lg:!bg-transparent lg:!px-0 lg:!py-1.5 lg:!text-sm lg:hover:!text-fg">
                    {g.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-16">
            {GROUPS.map((g) => (
              <div key={g.id} id={g.id} className="scroll-mt-28">
                <h2 className="t-h3 mb-4">{g.title}</h2>
                <Faq items={g.items} />
              </div>
            ))}
            <p className="text-sm text-fg-2">
              Still have a question? <Link href="/contact" className="prose-link">Contact us</Link> or write to{' '}
              <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="prose-link">
                {BRAND_SUPPORT_EMAIL}
              </a>
              .
            </p>
            <RiskNote options />
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }} />
    </>
  );
}
