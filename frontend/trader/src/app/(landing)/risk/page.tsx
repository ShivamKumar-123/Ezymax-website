import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalP, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Risk Disclaimer — public legal page.
 * Linked from footer. Boilerplate adapted to the platform's product mix
 * (forex, CFDs, crypto). Restyled onto the shared marketing design
 * system; every clause is carried over verbatim.
 */

const SECTIONS = [
  {
    h: '1. Technology Vendor, Not a Broker',
    p: `${BRAND_NAME} is a software development company. We build and license trading technology to
    licensed brokers and proprietary trading firms. ${BRAND_NAME} is not a broker, exchange, or
    financial institution, and does not provide brokerage, investment, financial, tax, or advisory
    services.`,
  },
  {
    h: '2. No Offer or Solicitation',
    p: `Nothing on this website, in our marketing materials, or within any demonstration environment
    constitutes an offer, solicitation, recommendation, or inducement to buy or sell any financial
    product or to engage in any trading activity. ${BRAND_NAME} does not solicit or accept
    investments.`,
  },
  {
    h: '3. Client-Operated Platforms',
    p: `Trading platforms built with ${BRAND_NAME} software and placed into production are operated by
    our clients under their own brand, licence, and regulatory authority. ${BRAND_NAME} does not
    execute, route, or manage trades for any end user, and is not a party to any relationship between
    a licensed operator and its clients.`,
  },
  {
    h: '4. Leveraged Trading Is Risky',
    p: `Leveraged products such as forex, contracts-for-difference (CFDs), and crypto-assets carry a
    high level of risk and can result in losses that exceed the amount originally committed. Where our
    software supports such products, the decision to offer them, and the terms on which they are
    offered to end users, rests entirely with the licensed operator of the platform.`,
  },
  {
    h: '5. No Investment or Financial Advice',
    p: `Information published by ${BRAND_NAME} is general in nature, is directed at businesses evaluating
    our technology, and does not constitute investment, financial, tax, or legal advice. ${BRAND_NAME}
    does not consider the individual circumstances of any trader and is not responsible for trading
    decisions made on platforms built with its software.`,
  },
  {
    h: '6. Software Provided Under Agreement',
    p: `${BRAND_NAME} software is delivered and supported under a separate written agreement. Features
    described on this website illustrate the capabilities of the platform; their availability,
    configuration, and operation in production depend on the choices and obligations of the licensed
    operator. Past performance of any strategy, tool, or market is not indicative of future results.`,
  },
  {
    h: '7. AI & Algorithmic Trading Tools',
    p: `Where ${BRAND_NAME} builds AI-driven or algorithmic trading tools into a platform, those tools
    analyse historical and live market data but cannot anticipate every market condition. Back-tested
    or historical performance is not indicative of future results. Responsibility for enabling,
    monitoring, and setting risk limits on such tools lies with the operator and its users.`,
  },
  {
    h: '8. Technical & Operational Risk',
    p: `No software is free from the risk of interruption. Internet connectivity, hosting, third-party
    integrations, and force-majeure events may affect the availability or performance of any platform.
    ${BRAND_NAME} provides its software and support on the terms set out in the applicable agreement
    and does not guarantee uninterrupted or error-free operation.`,
  },
  {
    h: '9. Tax & Legal Responsibility',
    p: `The tax and legal treatment of trading activity varies by jurisdiction and is the
    responsibility of the operator and its clients. ${BRAND_NAME} does not provide tax or legal
    advice — consult a qualified adviser for your situation.`,
  },
  {
    h: '10. Third-Party Content & Market Data',
    p: `Market data, charts, news, and other third-party content that may appear within our software or
    on this website are provided for general information only. ${BRAND_NAME} does not warrant the
    accuracy, completeness, or timeliness of such content and accepts no liability for reliance placed
    on it.`,
  },
  {
    h: '11. Lawful Use & Availability',
    p: `${BRAND_NAME} evaluates each client engagement individually and complies with applicable
    export-control and sanctions laws. It is the responsibility of each operator to ensure that any
    platform it runs, and the markets it offers, are lawful in the jurisdictions in which it and its
    clients operate.`,
  },
  {
    h: '12. Acknowledgement',
    p: `By using this website you confirm that you have read and understood this Disclaimer, that you
    understand ${BRAND_NAME} is a technology vendor and not a broker, and that nothing here constitutes
    an offer, solicitation, or advice.`,
  },
];

const TOC = SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h }));

export default function RiskPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Disclaimer"
        lead={`How ${BRAND_NAME} works as a software vendor — and why nothing here is an offer, solicitation, or advice.`}
      />

      <Section raised>
        <LegalDoc toc={TOC}>
          <LegalCallout tone="warn">
            <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>Important:</span> We build and
            license trading software; we are not a broker and do not provide investment advice. Nothing
            on this page is an offer or solicitation. Trading leveraged products is high-risk, and any
            platform built with our software is operated by a licensed third party responsible for its
            own client disclosures.
          </LegalCallout>

          {SECTIONS.map(({ h, p }) => (
            <LegalSection key={h} id={legalAnchor(h)} heading={h}>
              <LegalP>{p}</LegalP>
            </LegalSection>
          ))}

          <LegalP>
            Cross-read with our{' '}
            <Link href="/terms" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Privacy Policy
            </Link>
            . Questions about this Disclaimer can be sent to{' '}
            <a
              href={`mailto:${BRAND_SUPPORT_EMAIL}`}
              className="hover:underline"
              style={{ color: 'var(--mk-accent)' }}
            >
              {BRAND_SUPPORT_EMAIL}
            </a>
            .
          </LegalP>
        </LegalDoc>
      </Section>

      <CtaBanner
        title="See the platform"
        lead="Book a walkthrough and see how the platform runs under your own brand and licence."
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Read the Risk Warning', href: '/risk-warning' }}
      />
    </main>
  );
}
