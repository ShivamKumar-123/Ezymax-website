import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalP, LegalList, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Risk Warning — public legal page.
 *
 * Surfaces the same core warning copy already shown in the Footer
 * Risk Warning callout, expanded into a full document. This sits
 * alongside /risk (the deeper Risk Disclaimer) and is linked from
 * the footer 'Legal documents' row. Restyled onto the shared marketing
 * design system; every clause is carried over verbatim.
 */

const SECTIONS: { h: string; body: string; list?: string[]; trailing?: string }[] = [
  {
    h: '1. Technology Vendor Disclaimer',
    body: `${BRAND_NAME} is a software development company that builds and licenses trading technology to licensed brokers and proprietary trading firms. ${BRAND_NAME} is not a broker, exchange, or financial institution, does not provide investment advice, and does not solicit or accept investments. This notice is provided for general information.`,
  },
  {
    h: '2. Nothing Here Is an Offer',
    body: `Nothing on the ${BRAND_NAME} website or in its materials is an offer, solicitation, or recommendation to buy or sell any financial product or to engage in any trading activity. Any references to trading describe the capabilities of software that ${BRAND_NAME} builds for licensed operators.`,
  },
  {
    h: '3. Leveraged Trading Is High-Risk',
    body: `Trading forex, CFDs, indices, commodities, and crypto-assets involves a significant level of risk and is not suitable for everyone. Where a platform built with ${BRAND_NAME} software offers such products, the operator of that platform is responsible for the risk warnings and disclosures given to its own clients.`,
  },
  {
    h: '4. Risks of the Underlying Markets',
    body: `The markets that a platform built with ${BRAND_NAME} software may cover carry risks including but not limited to:`,
    list: [
      'Extreme intraday volatility',
      'Regulatory uncertainty in many jurisdictions',
      'Blockchain network congestion, fee spikes, or temporary outages',
      'Smart-contract, custody, and exchange-platform risk',
      'Irreversibility of on-chain transactions',
    ],
    trailing: 'Past price performance is not indicative of future results.',
  },
  {
    h: '5. Client-Operated Platforms',
    body: `Trading platforms built with ${BRAND_NAME} software and placed into production are operated by our clients under their own brand, licence, and regulatory authority. ${BRAND_NAME} does not execute, route, or manage trades for end users.`,
  },
  {
    h: '6. Technology & Platform Risk',
    body: `Any software may be affected by internet connectivity issues, hosting or third-party integration failures, hardware faults, and force-majeure events, which can temporarily prevent normal operation. ${BRAND_NAME} provides its software and support under the terms of the applicable agreement and does not guarantee uninterrupted or error-free operation.`,
  },
  {
    h: '7. Software Licensing',
    body: `Access to ${BRAND_NAME} software is provided under a separate written licence agreement that sets out fees, scope, delivery, and support. Features shown on the website illustrate platform capabilities; their availability in production depends on the operator's configuration and obligations.`,
  },
  {
    h: '8. Lawful Use & Availability',
    body: `${BRAND_NAME} evaluates each client engagement individually and complies with applicable export-control and sanctions laws. Each operator is responsible for ensuring that any platform it runs is lawful in the jurisdictions in which it and its clients operate. See our Restricted Countries page for more on how ${BRAND_NAME} approaches jurisdictional and sanctions compliance.`,
  },
  {
    h: '9. No Investment Advice',
    body: `Information provided on the ${BRAND_NAME} website or through any ${BRAND_NAME} communication channel is for general informational purposes only and does not constitute investment, financial, tax, or legal advice. ${BRAND_NAME} does not consider the circumstances of any individual trader.`,
  },
  {
    h: '10. Acknowledgement',
    body: `By using this website you confirm that you have read, understood, and accept this Risk Warning, alongside our Terms of Service, Privacy Policy, and Disclaimer, and that you understand ${BRAND_NAME} is a technology vendor and not a broker.`,
  },
];

const TOC = SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h }));

export default function RiskWarningPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Risk Warning"
        lead={`${BRAND_NAME} is a software vendor, not a broker. This notice explains what that means and the risks of the markets our software can support.`}
      />

      <Section raised>
        <LegalDoc toc={TOC}>
          {/* Top alert — highlighted warning above the section list */}
          <LegalCallout tone="warn">
            <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>Important:</span> We build and
            license trading software; we are not a broker and do not provide investment advice. Nothing
            here is an offer or solicitation. Trading leveraged products is high-risk, and any platform
            built with our software is operated by a licensed third party responsible for its own client
            disclosures.
          </LegalCallout>

          {SECTIONS.map(({ h, body, list, trailing }) => (
            <LegalSection key={h} id={legalAnchor(h)} heading={h}>
              <LegalP>{body}</LegalP>
              {list && <LegalList items={list} />}
              {trailing && <LegalP>{trailing}</LegalP>}
            </LegalSection>
          ))}

          <LegalP>
            Read this alongside our{' '}
            <Link href="/risk" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Risk Disclaimer
            </Link>{' '}
            and{' '}
            <Link href="/terms" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Terms of Service
            </Link>
            . Questions can be sent to{' '}
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
        secondary={{ label: 'Restricted Countries', href: '/restricted-countries' }}
      />
    </main>
  );
}
