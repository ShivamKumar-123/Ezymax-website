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
      { n: '1.1', body: `By accessing or using any services, products, platforms, or tools offered by ${BRAND_NAME} (hereinafter referred to as "${BRAND_NAME}"), you agree to be bound by these Terms & Conditions. If you do not agree with any part of these terms, you should not access or use any ${BRAND_NAME} services.` },
      { n: '1.2', body: `These Terms & Conditions apply to all users, clients, visitors, and customers of ${BRAND_NAME}, whether registered or unregistered. By accessing or using the platform, you acknowledge and accept these Terms & Conditions.` },
    ],
  },
  {
    h: '2. Binding Agreement',
    clauses: [
      { n: '2.1', body: `By registering for an account or using ${BRAND_NAME} services, you enter into a legally binding agreement with ${BRAND_NAME}.` },
      { n: '2.2', body: `You acknowledge that your continued use of ${BRAND_NAME} services constitutes acceptance of these Terms & Conditions and any additional policies, agreements, disclosures, or legal documentation published by ${BRAND_NAME}.` },
    ],
  },
  {
    h: '3. Eligibility and Age Requirement',
    clauses: [
      { n: '3.1', body: `To use ${BRAND_NAME} services, you must be at least eighteen (18) years old or the legal age required to enter into a binding agreement in your jurisdiction.` },
      { n: '3.2', body: 'By opening an account, you confirm that all information provided is accurate and that you meet the eligibility requirements.' },
      { n: '3.3', body: 'Providing false information regarding your identity, age, or residency is strictly prohibited and may result in immediate account suspension or termination.' },
    ],
  },
  {
    h: '4. Trading Risk Disclosure',
    clauses: [
      { n: '4.1', body: 'Forex, commodities, cryptocurrencies, indices, and CFD trading involve substantial risk and may not be suitable for all investors.' },
      { n: '4.2', body: 'You acknowledge that you may lose part or all of your deposited funds and that past performance does not guarantee future results.' },
      { n: '4.3', body: `${BRAND_NAME} does not guarantee profits, returns, or successful trading outcomes unless explicitly stated under a specific promotional program governed by separate terms.` },
      { n: '4.4', body: 'Clients are solely responsible for their trading decisions and investment activities.' },
    ],
  },
  {
    h: '5. Account Registration and Security',
    clauses: [
      { n: '5.1', body: 'Clients must provide accurate, complete, and up-to-date information during registration.' },
      { n: '5.2', body: 'You are responsible for maintaining the confidentiality of your account credentials, passwords, and security information.' },
      { n: '5.3', body: `${BRAND_NAME} shall not be liable for losses arising from unauthorized access resulting from your failure to protect account credentials.` },
    ],
  },
  {
    h: '6. Deposits and Withdrawals',
    clauses: [
      { n: '6.1', body: `Clients may fund their accounts using payment methods approved by ${BRAND_NAME}.` },
      { n: '6.2', body: 'Withdrawal requests are subject to verification, compliance checks, and anti-money laundering (AML) procedures.' },
      { n: '6.3', body: `${BRAND_NAME} reserves the right to request additional identification documents before processing withdrawals.` },
      { n: '6.4', body: 'Processing times may vary depending on the selected payment method and verification requirements.' },
    ],
  },
  {
    h: '7. Bonuses, Promotions, and Trade Insurance',
    clauses: [
      { n: '7.1', body: 'Any bonuses, deposit promotions, referral rewards, trade insurance programs, or special offers are subject to separate promotional terms.' },
      { n: '7.2', body: `${BRAND_NAME} reserves the right to modify, suspend, or cancel promotional programs at any time without prior notice.` },
      { n: '7.3', body: 'Abuse, manipulation, arbitrage, or fraudulent use of promotional programs may result in cancellation of rewards and account restrictions.' },
    ],
  },
  {
    h: '8. Referral and Introducing Broker (IB) Program',
    clauses: [
      { n: '8.1', body: 'Participants in the Referral Program and IB Program must comply with all applicable laws and ethical marketing standards.' },
      { n: '8.2', body: `${BRAND_NAME} reserves the right to adjust, withhold, or revoke commissions generated through fraudulent, misleading, or prohibited activities.` },
      { n: '8.3', body: 'Referral and IB commissions are subject to qualification requirements outlined in the relevant program documentation.' },
    ],
  },
  {
    h: '9. Anti-Money Laundering (AML) and Compliance',
    clauses: [
      { n: '9.1', body: `${BRAND_NAME} maintains strict AML and Know Your Customer (KYC) procedures.` },
      { n: '9.2', body: 'Clients may be required to provide identification documents, proof of address, and other verification materials.' },
      { n: '9.3', body: `${BRAND_NAME} reserves the right to suspend or terminate accounts involved in suspicious, illegal, or non-compliant activities.` },
    ],
  },
  {
    h: '10. Limitation of Liability',
    clauses: [
      { n: '10.1', body: `${BRAND_NAME} shall not be liable for any indirect, incidental, consequential, or special damages arising from the use of its services.` },
      { n: '10.2', body: `${BRAND_NAME} is not responsible for losses resulting from market volatility, technical failures, internet disruptions, third-party service interruptions, or force majeure events.` },
    ],
  },
  {
    h: '11. Suspension and Termination',
    clauses: [
      { n: '11.1', body: `${BRAND_NAME} reserves the right to suspend, restrict, or terminate any account that violates these Terms & Conditions or applicable regulations.` },
      { n: '11.2', body: `Upon termination, clients must immediately cease using ${BRAND_NAME} services.` },
    ],
  },
  {
    h: '12. Amendments',
    clauses: [
      { n: '12.1', body: `${BRAND_NAME} reserves the right to modify, update, or replace these Terms & Conditions at any time.` },
      { n: '12.2', body: `Continued use of ${BRAND_NAME} services after updates become effective constitutes acceptance of the revised Terms & Conditions.` },
    ],
  },
  {
    h: '13. Governing Law',
    clauses: [
      { n: '13.1', body: `These Terms & Conditions shall be governed by and interpreted in accordance with the laws applicable to the jurisdiction under which ${BRAND_NAME} operates.` },
      { n: '13.2', body: 'Any disputes arising from these Terms & Conditions shall be subject to the exclusive jurisdiction of the relevant courts or arbitration authorities.' },
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
        title="Terms and Conditions"
        lead={`The rules that govern your use of ${BRAND_NAME}. Read carefully before you trade.`}
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
              For any questions, support requests, or concerns regarding these Terms &amp; Conditions, please contact:
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
              By registering for an account and using {BRAND_NAME} services, you confirm that you have read, understood, and agreed to these Terms &amp; Conditions.
            </LegalP>
          </LegalSection>

          {/* Risk Disclaimer — kept as the platform's standard trader-facing warning */}
          <LegalSection id={legalAnchor(RISK_HEADING)} heading={RISK_HEADING}>
            <LegalCallout tone="warn">
              Trading foreign exchange (forex) and other leveraged financial products carries a high level of risk and may not be suitable for all investors. Leverage can work both for and against you — while it amplifies potential profits, it equally amplifies potential losses. You could sustain a loss of some or all of your initial investment and should not invest money that you cannot afford to lose. You should be aware of all the risks associated with leveraged trading and seek independent financial advice if you have any doubts. Past performance is not indicative of future results.
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
        title="Ready to Begin?"
        lead={`By opening a ${BRAND_NAME} account, you confirm you have read and accepted these Terms.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Contact Support', href: `mailto:${BRAND_SUPPORT_EMAIL}` }}
      />
    </main>
  );
}
