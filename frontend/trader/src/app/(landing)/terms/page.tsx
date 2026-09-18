import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalClause, LegalP, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Terms & Conditions — public legal page.
 *
 * Section copy is preserved verbatim from the client-supplied PDF
 * "terms and condition.pdf" (delivered 2026-06-09). The 14-section
 * structure + numbered clauses match the PDF; only the visual chrome
 * follows the shared marketing design system. No clause has been
 * reworded, reordered, merged or dropped.
 */

/* Official PDF links live in the footer "Legal documents" row now —
   the on-page PDF grid was removed per client request. */

/**
 * 14 numbered sections preserving the client-PDF wording verbatim.
 * Each clause is rendered as `[number] body…` so the on-screen layout
 * mirrors a typical legal contract.
 */
const SECTIONS: { h: string; clauses: { n: string; body: string }[] }[] = [
  {
    h: '1. Acceptance of Terms',
    clauses: [
      { n: '1.1', body: `By accessing or using this website, or any software, platforms, tools, documentation, or services made available by ${BRAND_NAME} (hereinafter referred to as "${BRAND_NAME}"), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you should not access or use this website or any ${BRAND_NAME} services.` },
      { n: '1.2', body: `These Terms of Service apply to all visitors, prospective clients, and licensees of ${BRAND_NAME}. By accessing or using this website or our software, you acknowledge and accept these Terms of Service.` },
    ],
  },
  {
    h: '2. Nature of Our Relationship',
    clauses: [
      { n: '2.1', body: `${BRAND_NAME} is a software development company that builds and licenses trading technology to licensed brokers and proprietary trading firms. These Terms govern your use of this website and the general relationship between you and ${BRAND_NAME}; any software licence is additionally governed by a separate written agreement.` },
      { n: '2.2', body: `You acknowledge that your continued use of this website and ${BRAND_NAME} services constitutes acceptance of these Terms of Service and any additional policies, notices, or legal documentation published by ${BRAND_NAME}.` },
    ],
  },
  {
    h: '3. Eligibility',
    clauses: [
      { n: '3.1', body: `To use ${BRAND_NAME} services, you must be at least eighteen (18) years old or the legal age required to enter into a binding agreement in your jurisdiction.` },
      { n: '3.2', body: 'Where you access our services on behalf of a business, you confirm that you are authorised to bind that business to these Terms.' },
      { n: '3.3', body: 'Providing false or misleading information about your identity, organisation, or intended use of our software is strictly prohibited and may result in suspension or termination of access.' },
    ],
  },
  {
    h: '4. Nature of Our Services',
    clauses: [
      { n: '4.1', body: `${BRAND_NAME} is a technology vendor. We design, build, license, and support trading software. ${BRAND_NAME} is not a broker, exchange, or financial institution, and does not provide brokerage, financial, investment, tax, or advisory services.` },
      { n: '4.2', body: `${BRAND_NAME} does not solicit or accept investments, and does not execute, route, or manage trades for end users. Trading platforms built by ${BRAND_NAME} and placed into production are operated by our clients under their own brand, licence, and regulatory obligations.` },
      { n: '4.3', body: 'Nothing on this website or within our materials constitutes an offer, solicitation, or recommendation to buy or sell any financial product or to engage in any trading activity.' },
      { n: '4.4', body: 'Leveraged trading carries a high level of risk. Any references to trading functionality describe capabilities of the software; the availability and operation of that functionality for end users is the sole responsibility of the licensed operator of the platform.' },
    ],
  },
  {
    h: '5. Website Accounts and Security',
    clauses: [
      { n: '5.1', body: 'Where you create an account or submit an enquiry through this website, you must provide accurate, complete, and up-to-date information.' },
      { n: '5.2', body: 'You are responsible for maintaining the confidentiality of any account credentials, passwords, and security information used to access this website or our services.' },
      { n: '5.3', body: `${BRAND_NAME} shall not be liable for losses arising from unauthorized access resulting from your failure to protect your credentials.` },
    ],
  },
  {
    h: '6. Software Licensing and Services',
    clauses: [
      { n: '6.1', body: `Access to ${BRAND_NAME} software is provided under licence, on the terms set out in a separate written agreement between you and ${BRAND_NAME}.` },
      { n: '6.2', body: 'Fees, delivery timelines, scope of work, and support arrangements are defined in the applicable order form, statement of work, or licence agreement.' },
      { n: '6.3', body: `${BRAND_NAME} may require verification of your identity or organisation before granting access to certain software or services.` },
      { n: '6.4', body: 'Delivery, configuration, and support timelines may vary depending on the scope of the engagement and the requirements agreed between the parties.' },
    ],
  },
  {
    h: '7. Intellectual Property',
    clauses: [
      { n: '7.1', body: `All software, source code, designs, documentation, trademarks, and other materials provided by ${BRAND_NAME} remain the exclusive property of ${BRAND_NAME} or its licensors.` },
      { n: '7.2', body: 'Any licence granted is limited, non-exclusive, and non-transferable except as expressly set out in the applicable agreement, and confers no ownership rights in the underlying technology.' },
      { n: '7.3', body: `You may not copy, resell, sublicense, reverse engineer, or create derivative works from ${BRAND_NAME} software except as expressly permitted by the applicable agreement or by law.` },
    ],
  },
  {
    h: '8. Acceptable Use',
    clauses: [
      { n: '8.1', body: `You agree to use this website and ${BRAND_NAME} software only for lawful purposes and in accordance with these Terms and any applicable licence agreement.` },
      { n: '8.2', body: `${BRAND_NAME} reserves the right to restrict or suspend access where this website or our software is used in a manner that is fraudulent, unlawful, or in breach of these Terms.` },
      { n: '8.3', body: 'You are responsible for ensuring that your use of our software, and the operation of any platform you deploy from it, complies with all laws and regulations applicable to you.' },
    ],
  },
  {
    h: '9. Compliance and Lawful Use',
    clauses: [
      { n: '9.1', body: `${BRAND_NAME} conducts its business in accordance with applicable laws, including applicable export-control and sanctions requirements.` },
      { n: '9.2', body: 'You may be required to provide information about your organisation and intended use of our software as part of our client onboarding and compliance checks.' },
      { n: '9.3', body: `Where you operate a platform built on ${BRAND_NAME} software, you are solely responsible for meeting your own licensing, regulatory, and other legal obligations.` },
    ],
  },
  {
    h: '10. Limitation of Liability',
    clauses: [
      { n: '10.1', body: `${BRAND_NAME} shall not be liable for any indirect, incidental, consequential, or special damages arising from the use of this website or its services.` },
      { n: '10.2', body: `${BRAND_NAME} is not responsible for losses resulting from decisions made by operators of platforms built on our software, market activity, technical failures, internet disruptions, third-party service interruptions, or force majeure events.` },
    ],
  },
  {
    h: '11. Suspension and Termination',
    clauses: [
      { n: '11.1', body: `${BRAND_NAME} reserves the right to suspend, restrict, or terminate access to its website or services where these Terms of Service or applicable agreements are breached.` },
      { n: '11.2', body: `Upon termination, you must immediately cease using the affected ${BRAND_NAME} website and services, subject to the terms of any applicable licence agreement.` },
    ],
  },
  {
    h: '12. Amendments',
    clauses: [
      { n: '12.1', body: `${BRAND_NAME} reserves the right to modify, update, or replace these Terms of Service at any time.` },
      { n: '12.2', body: `Continued use of this website and ${BRAND_NAME} services after updates become effective constitutes acceptance of the revised Terms of Service.` },
    ],
  },
  {
    h: '13. Governing Law',
    clauses: [
      { n: '13.1', body: `These Terms of Service shall be governed by and interpreted in accordance with the laws applicable to the jurisdiction under which ${BRAND_NAME} operates.` },
      { n: '13.2', body: 'Any disputes arising from these Terms of Service shall be subject to the exclusive jurisdiction of the relevant courts or arbitration authorities.' },
    ],
  },
];

const CONTACT_HEADING = '14. Contact Information';
const RISK_HEADING = 'Risk Disclaimer';

const TOC = [
  ...SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h })),
  { id: legalAnchor(CONTACT_HEADING), label: CONTACT_HEADING },
  { id: legalAnchor(RISK_HEADING), label: RISK_HEADING },
];

export default function TermsPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Terms of Service"
        lead={`The rules that govern your use of the ${BRAND_NAME} website and software. Please read them carefully.`}
      />

      <Section raised>
        <LegalDoc toc={TOC} updated="June 2026">
          {SECTIONS.map(({ h, clauses }) => (
            <LegalSection key={h} id={legalAnchor(h)} heading={h}>
              {clauses.map(({ n, body }) => (
                <LegalClause key={n} n={n}>{body}</LegalClause>
              ))}
            </LegalSection>
          ))}

          {/* Section 14 — Contact (special handling: includes contact card) */}
          <LegalSection id={legalAnchor(CONTACT_HEADING)} heading={CONTACT_HEADING}>
            <LegalP>
              For any questions, support requests, or concerns regarding these Terms of Service, please contact:
            </LegalP>
            <LegalCallout>
              <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>{BRAND_NAME} Support Team</span>
              <br />
              Email:{' '}
              <a
                href={`mailto:${BRAND_SUPPORT_EMAIL}`}
                className="hover:underline"
                style={{ color: 'var(--mk-accent)' }}
              >
                {BRAND_SUPPORT_EMAIL}
              </a>
            </LegalCallout>
            <LegalP>
              By using this website and {BRAND_NAME} services, you confirm that you have read, understood, and agreed to these Terms of Service.
            </LegalP>
          </LegalSection>

          {/* Risk Disclaimer — kept as the platform's standard trader-facing warning */}
          <LegalSection id={legalAnchor(RISK_HEADING)} heading={RISK_HEADING}>
            <LegalCallout tone="warn">
              Trading in leveraged financial products carries a high level of risk. This company is a software vendor, not a broker or financial adviser, and nothing on this website constitutes an offer, solicitation, or investment advice. Any trading platform built with our software is operated by a licensed third party who is solely responsible for its own regulatory obligations and for the risk disclosures given to its clients. Where such a platform supports leveraged products, those products can amplify both gains and losses, and past performance is not indicative of future results.
            </LegalCallout>
            <LegalP>
              These Terms work alongside our{' '}
              <Link href="/privacy" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="/risk" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Risk Disclaimer
              </Link>
              .
            </LegalP>
          </LegalSection>
        </LegalDoc>
      </Section>

      <CtaBanner
        title="Ready to see the platform?"
        lead={`Book a walkthrough of the ${BRAND_NAME} platform and see how it runs under your brand.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Contact Support', href: `mailto:${BRAND_SUPPORT_EMAIL}` }}
      />
    </main>
  );
}
