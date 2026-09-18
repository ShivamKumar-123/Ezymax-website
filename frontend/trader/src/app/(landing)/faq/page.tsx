import type { Metadata } from 'next';
import { Section, SectionHeading, PageHero, CtaBanner, FaqAccordion, type FaqItem } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Standalone FAQ.
 *
 * Every answer below is lifted from copy that already exists on the
 * platform — nothing here is newly invented. Provenance per group:
 *
 *   • src/home/data.ts → FAQ[]            (the homepage accordion)
 *   • src/app/(landing)/how-it-works      (STEPS + broker-vs-protocol cards)
 *   • src/app/(landing)/deposit-withdrawal (the signed Deposit & Withdrawal
 *     Policy — authoritative where it conflicts with older marketing copy,
 *     e.g. supported payment methods)
 *   • src/app/(landing)/restricted-countries and /delete-account
 *
 * Questions we could NOT source an answer for were left out.
 */

export const metadata: Metadata = {
  title: `Frequently Asked Questions | ${BRAND_NAME}`,
  description: `Answers to the most common questions about ${BRAND_NAME} — what we build, how white-label delivery works, timelines, integrations, and support.`,
};

/* ── Getting started ───────────────────────────────────────────────────
   Sources: home/data.ts FAQ[0]; how-it-works hero + broker-vs-protocol
   cards; how-it-works STEPS. */
const GETTING_STARTED: FaqItem[] = [
  {
    q: 'How long does it take to launch a platform?',
    a: 'Most white-label platforms go live in weeks, not months. The exact timeline depends on the modules and integrations you need — we agree it with you during scoping, before any work starts.',
  },
  {
    q: `Is ${BRAND_NAME} a broker?`,
    a: (
      <>
        <p>
          {BRAND_NAME} is a software company, not a broker. We build and license the trading
          technology; you run the brokerage under your own licence, brand and domain.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {[
            'Web, mobile and desktop terminals',
            'Admin back office, CRM and reporting',
            'Risk controls and liquidity routing',
            'Payments, KYC/AML and CRM integrations',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span
                className="shrink-0 rounded-full"
                style={{ width: '5px', height: '5px', marginTop: '0.62em', background: 'var(--mk-accent)' }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    q: 'What are the steps from demo to launch?',
    a: (
      <>
        <p>A clear path from first demo to a platform live under your brand.</p>
        <ol className="mt-3 flex flex-col gap-1.5">
          {[
            'Book a demo — see the platform and tell us what your brokerage needs.',
            'Scope & plan — agree modules, integrations, branding and a launch timeline.',
            'Brand & configure — your logo, domain and colours across every screen.',
            'Wire integrations — payments, KYC/AML, liquidity and CRM connected to your setup.',
            'Test & review — you review the platform end to end before go-live.',
            'Go live — we launch on your domain, under your brand.',
            'Ongoing support — the same team keeps it running after launch.',
          ].map((item, i) => (
            <li key={item} className="flex items-start gap-3">
              <span
                className="shrink-0 font-mono"
                style={{ color: 'var(--mk-accent)', fontSize: 'var(--mk-text-sm)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </>
    ),
  },
];

/* ── Funding ───────────────────────────────────────────────────────────
   Sources: deposit-withdrawal policy §2, §4.3, §7, §8, §10. */
const FUNDING: FaqItem[] = [
  {
    q: 'Which payment integrations can the platform support?',
    a: (
      <>
        <p>The platforms we build can integrate a range of payment and wallet providers, wired to your setup.</p>
        <p className="mt-3">Common integrations include:</p>
        <p className="mt-1">
          Card and bank-transfer processors · Cryptocurrency wallets (BTC, ETH, USDT, USDC) · KYC/AML
          providers · CRM and liquidity bridges.
        </p>
        <p className="mt-3">
          The exact providers depend on your licence and jurisdiction. We wire in the integrations you
          choose; your brokerage runs the payment flows under your own brand.
        </p>
      </>
    ),
  },
  {
    q: 'Can you integrate our existing providers?',
    a: (
      <>
        <p>
          Yes. We can integrate the payment, KYC, liquidity and CRM providers you already use, or
          recommend ones that fit your setup.
        </p>
        <p className="mt-3">
          Integration work is scoped up front, so you know the timeline before we start.
        </p>
      </>
    ),
  },
  {
    q: 'What does the admin back office include?',
    a: (
      <>
        <p>
          {BRAND_NAME} builds a full back office into your platform: client CRM, KYC/AML workflows,
          risk controls, liquidity routing, reporting and partner management — everything your team
          needs to run the brokerage.
        </p>
      </>
    ),
  },
  {
    q: 'Can we start with some modules and add more later?',
    a: (
      <>
        <p>
          Yes. You can launch with the modules you need and add copy trading, prop trading, IB
          management, MAM/PAMM and more as you grow.
        </p>
        <p className="mt-3">
          Because the platform is built in-house, new modules fit the same system rather than being
          bolted on.
        </p>
      </>
    ),
  },
  {
    q: 'Who owns the branding and domain?',
    a: (
      <>
        <p>
          You do. Everything ships white-label: your name, logo, colours and domain across web, mobile
          and desktop. Nothing carries our brand.
        </p>
        <p className="mt-3">
          Your clients see your brokerage, not us.
        </p>
      </>
    ),
  },
];

/* ── Trading ───────────────────────────────────────────────────────────
   Sources: home/data.ts FAQ[4], FAQ[5], FAQ[6]. */
const TRADING: FaqItem[] = [
  {
    q: 'Which asset classes can the platform support?',
    a: `The platforms we build can support multi-asset trading — forex majors, minors and exotics, stock indices, commodities such as gold and silver, and major digital assets — all from a single account for your clients.`,
  },
  {
    q: 'Can we set our own spreads, leverage and pricing?',
    a: 'Yes. Spreads, commissions, leverage and instrument settings are all configurable, so your team sets the trading conditions your clients see. Higher leverage increases both potential gains and potential losses for the end client.',
  },
  {
    q: 'How does order execution work on the platform?',
    a: 'The engine fills market orders at the live quote and holds pending orders, stop-loss and take-profit levels server-side, so they stay active even when the client’s browser is closed. Execution runs under your brokerage’s setup, not ours.',
  },
  {
    q: 'Does the platform include partner and IB management?',
    a: 'Yes. IB and partner management ships as part of the platform: referral links, marketing kits, per-lot commission tracking and payouts, all run by your team from the admin back office. You configure the programme; your partners work under your brand.',
  },
];

/* ── Account & security ────────────────────────────────────────────────
   Sources: deposit-withdrawal policy §5 and §6; restricted-countries §2;
   delete-account page. */
const ACCOUNT: FaqItem[] = [
  {
    q: 'How is KYC/AML handled in the platform?',
    a: (
      <>
        <p>
          We build KYC and AML workflows into the platform — document capture, identity checks, selfie
          verification and compliance review queues — wired to the providers you choose.
        </p>
        <p className="mt-3">
          Your compliance team runs these workflows under your licence; {BRAND_NAME} builds the
          tooling.
        </p>
      </>
    ),
  },
  {
    q: 'What risk and compliance controls can we configure?',
    a: (
      <>
        <p>
          The back office includes configurable risk and compliance controls: source-of-funds checks,
          transaction monitoring, review queues, account freezes and reporting. Your team sets the
          rules and acts on them; we build the controls.
        </p>
      </>
    ),
  },
  {
    q: 'Can we restrict access by country?',
    a: (
      <>
        <p>
          Yes. The platform can restrict sign-up and access by jurisdiction, so you enforce the list
          your licence requires.
        </p>
        <p className="mt-3">
          You control which countries are allowed; {BRAND_NAME} provides the tooling to enforce it.
        </p>
      </>
    ),
  },
  {
    q: 'What support do we get after launch?',
    a: (
      <>
        <p>
          The team that builds your platform supports it after go-live — by live chat, email and phone
          — covering monitoring, updates and new modules as you grow.
        </p>
        <p className="mt-3">
          We do not disappear at launch; ongoing support is part of how we work.
        </p>
      </>
    ),
  },
];

const GROUPS: { id: string; kicker: string; title: string; items: FaqItem[] }[] = [
  { id: 'getting-started', kicker: 'Getting started', title: 'Working with us', items: GETTING_STARTED },
  { id: 'funding', kicker: 'Platform', title: 'Platform & integrations', items: FUNDING },
  { id: 'trading', kicker: 'Capabilities', title: 'Platform capabilities', items: TRADING },
  { id: 'account-security', kicker: 'Delivery & support', title: 'Delivery, compliance & support', items: ACCOUNT },
];

export default function FaqPage() {
  return (
    <main>
      <PageHero
        kicker="Support"
        title="Frequently Asked Questions"
        lead={`Everything you need to know about launching a white-label platform with ${BRAND_NAME}. Still have questions? Book a demo.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View platforms', href: '/platforms/web' }}
      />

      {GROUPS.map((group, i) => (
        <Section key={group.id} id={group.id} raised={i % 2 === 0}>
          <SectionHeading align="left" kicker={group.kicker} title={group.title} />
          <div className="mt-8 max-w-3xl">
            <FaqAccordion items={group.items} />
          </div>
        </Section>
      ))}

      <CtaBanner
        title="Still have a question?"
        lead={`Our team is here to help — or book a demo and see the ${BRAND_NAME} platform for yourself.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View platforms', href: '/platforms/web' }}
      />
    </main>
  );
}
