import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalSubheading, LegalP, LegalList, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Privacy Policy — public legal page.
 *
 * Section copy is preserved verbatim from the client-supplied PDF
 * "privcy policy.pdf" (delivered 2026-06-09). The 15-section structure
 * is preserved; only the visual chrome follows the shared marketing
 * design system. Nothing has been reworded, reordered or dropped.
 */

/**
 * Each section has a heading + body. `body` can mix prose paragraphs,
 * sub-sections (sub-heading + bullets), and plain bullet lists. This
 * is the minimum structure needed to reproduce the PDF wording 1:1.
 */
type Subsection = { title: string; lead?: string; bullets?: string[]; trailing?: string };
type PolicySection = {
  h: string;
  lead?: string[];          // top-level prose paragraphs
  bullets?: string[];        // top-level bullets
  subs?: Subsection[];       // sub-sections like "Identity Information"
  trailing?: string[];       // closing paragraphs after bullets / subs
};

const INTRO: PolicySection = {
  h: `Privacy Policy of ${BRAND_NAME}`,
  lead: [
    `At ${BRAND_NAME} ("${BRAND_NAME}", "Company", "we", "our", or "us"), protecting your privacy and personal information is one of our highest priorities. We are committed to collecting, processing, storing, and protecting your personal data responsibly and in accordance with applicable data protection laws and industry best practices.`,
    `By accessing our website, opening an account, or using any ${BRAND_NAME} products and services, you consent to the collection and processing of your personal information as described in this Privacy Policy.`,
  ],
};

const SECTIONS: PolicySection[] = [
  {
    h: '1. Privacy Protection',
    lead: [
      `${BRAND_NAME} maintains appropriate administrative, technical, and organizational measures designed to protect personal information from unauthorized access, misuse, loss, alteration, or disclosure.`,
      'Client information is stored securely and accessed only by authorized personnel who require such information for legitimate business, compliance, or support purposes.',
      'While we implement reasonable security safeguards, no method of transmission over the internet or electronic storage system can be guaranteed to be completely secure.',
      'Clients are responsible for maintaining the confidentiality of their account credentials, passwords, and authentication devices.',
    ],
  },
  {
    h: '2. Personal Information We Collect',
    lead: [`When opening an account or using ${BRAND_NAME} services, we may collect the following information:`],
    subs: [
      { title: 'Identity Information', bullets: ['Full Name', 'Date of Birth', 'Nationality', 'Government Identification Details', 'Passport or National ID Copies', 'Selfie Verification Images'] },
      { title: 'Contact Information', bullets: ['Email Address', 'Telephone Number', 'Residential Address'] },
      { title: 'Financial Information', bullets: ['Source of Funds Information', 'Cryptocurrency Wallet Information', 'Deposit and Withdrawal Records', 'Transaction History'] },
      { title: 'Technical Information', bullets: ['IP Address', 'Browser Information', 'Device Information', 'Operating System Information', 'Website Usage Data'] },
      { title: 'Trading Information', bullets: ['Trading Activity', 'Trading Preferences', 'Account Performance', 'Trading History'] },
    ],
  },
  {
    h: '3. How We Use Your Personal Information',
    lead: [`${BRAND_NAME} may process your personal information for the following purposes:`],
    subs: [
      { title: 'Account Registration and Management', lead: 'To:', bullets: ['Open and maintain trading accounts', 'Verify identity', 'Provide customer support', 'Manage account security'] },
      { title: 'Compliance and Regulatory Requirements', lead: 'To:', bullets: ['Perform KYC verification', 'Conduct AML screening', 'Prevent fraud and financial crime', 'Comply with legal obligations'] },
      { title: 'Service Delivery', lead: 'To:', bullets: ['Process deposits and withdrawals', 'Facilitate trading activities', 'Operate client accounts', 'Provide platform functionality'] },
      { title: 'Risk Management', lead: 'To:', bullets: ['Monitor suspicious activity', 'Protect account security', 'Prevent abuse of promotions and bonuses', 'Detect unauthorized transactions'] },
      { title: 'Communication', lead: 'To:', bullets: ['Respond to inquiries', 'Send service-related notifications', 'Deliver security alerts', 'Provide account updates'] },
      { title: 'Marketing Communications', lead: `Subject to applicable laws and your preferences, ${BRAND_NAME} may send information regarding:`, bullets: ['New products', 'Platform updates', 'Promotions', 'Educational content', 'Market insights'], trailing: 'Clients may opt out of marketing communications at any time.' },
    ],
  },
  {
    h: '4. Legal Basis for Processing',
    lead: ['We process personal information based on one or more of the following legal grounds:'],
    subs: [
      { title: 'Contract Performance', lead: 'Processing necessary to provide services requested by the client.' },
      { title: 'Legal and Regulatory Obligations', lead: 'Processing required to comply with applicable laws, AML regulations, sanctions requirements, and compliance obligations.' },
      { title: 'Legitimate Business Interests', lead: 'Processing necessary for:', bullets: ['Risk management', 'Fraud prevention', 'Service improvement', 'Security monitoring', 'Internal administration'] },
      { title: 'Client Consent', lead: 'Where required by law, processing may be based on the client\'s consent, which may be withdrawn at any time.' },
    ],
  },
  {
    h: '5. KYC and AML Compliance',
    lead: [
      `${BRAND_NAME} is committed to maintaining robust Know Your Customer (KYC) and Anti-Money Laundering (AML) procedures.`,
      'Clients may be required to provide:',
    ],
    bullets: ['Government-issued identification', 'Proof of address', 'Selfie verification', 'Source of funds documentation', 'Additional compliance information'],
    trailing: ['Failure to complete verification requirements may result in account restrictions, deposit delays, or withdrawal limitations.'],
  },
  {
    h: '6. Disclosure of Personal Information',
    lead: [
      `${BRAND_NAME} does not sell client personal information.`,
      'Personal information may be shared only when necessary with:',
    ],
    subs: [
      { title: 'Service Providers', lead: 'Including:', bullets: ['Technology providers', 'Hosting providers', 'Payment and crypto infrastructure providers', 'Security service providers'] },
      { title: 'Compliance and Regulatory Authorities', lead: 'Where disclosure is required by law, regulation, court order, or government request.' },
      { title: 'Professional Advisors', lead: 'Including:', bullets: ['Legal advisors', 'Auditors', 'Compliance consultants', 'Risk management providers'] },
      { title: 'Business Partners', lead: 'Only where necessary for providing services or fulfilling contractual obligations.' },
    ],
    trailing: ['All third parties receiving personal information are expected to maintain appropriate confidentiality and security standards.'],
  },
  {
    h: '7. Cryptocurrency Transactions',
    lead: [`As ${BRAND_NAME} operates a crypto-funded trading environment:`],
    bullets: [
      'Deposit and withdrawal transactions may be recorded on public blockchain networks.',
      'Blockchain transactions are transparent and may be publicly visible.',
      `${BRAND_NAME} cannot control information recorded on public blockchains.`,
    ],
    trailing: ['Clients are responsible for protecting the privacy of their own cryptocurrency wallets and addresses.'],
  },
  {
    h: '8. Cookies and Website Analytics',
    lead: [`${BRAND_NAME} may use:`],
    bullets: ['Cookies', 'Analytics tools', 'Pixel tags', 'Session tracking technologies'],
    trailing: [
      'These technologies help us:',
      'Improve website performance · Enhance user experience · Analyze traffic patterns · Detect fraud and security risks',
      'Clients may adjust browser settings to limit cookie usage, although some website functions may be affected.',
    ],
  },
  {
    h: '9. International Data Transfers',
    lead: [
      'Personal information may be processed or stored in countries outside the client\'s country of residence.',
      `Where international transfers occur, ${BRAND_NAME} will take reasonable measures to ensure that personal information receives an appropriate level of protection consistent with applicable privacy requirements.`,
    ],
  },
  {
    h: '10. Data Retention',
    lead: [`${BRAND_NAME} retains personal information only for as long as necessary to:`],
    bullets: ['Provide services', 'Comply with legal obligations', 'Resolve disputes', 'Prevent fraud', 'Meet regulatory requirements'],
    trailing: ['Client records, communications, transaction histories, and verification documents may be retained for a minimum period required by applicable AML and compliance regulations.'],
  },
  {
    h: '11. Your Rights',
    lead: ['Depending on applicable laws, clients may have the right to:'],
    subs: [
      { title: 'Access', lead: `Request a copy of personal information held by ${BRAND_NAME}.` },
      { title: 'Correction', lead: 'Request correction of inaccurate or incomplete information.' },
      { title: 'Deletion', lead: 'Request deletion of personal information where legally permitted.' },
      { title: 'Restriction', lead: 'Request limitations on certain processing activities.' },
      { title: 'Objection', lead: 'Object to specific processing activities.' },
      { title: 'Data Portability', lead: 'Request transfer of personal information in a structured format where applicable.' },
    ],
    trailing: ['Requests may be submitted through our support team.'],
  },
  {
    h: '12. Security Measures',
    lead: [`${BRAND_NAME} implements security controls designed to protect personal information, including:`],
    bullets: ['Secure data storage', 'Access control procedures', 'Encryption technologies where appropriate', 'Internal compliance monitoring', 'Security audits and reviews'],
    trailing: ['Despite these measures, clients should understand that no electronic system is completely immune from security risks.'],
  },
  {
    h: '13. Legal Disclosure',
    lead: [`${BRAND_NAME} may disclose personal information when required to:`],
    bullets: ['Comply with legal obligations', 'Respond to lawful requests', 'Protect company rights', 'Prevent fraud', 'Investigate suspicious activity', 'Enforce contractual agreements'],
    trailing: ['Such disclosures will only occur when legally justified.'],
  },
  {
    h: '14. Changes to This Privacy Policy',
    lead: [
      `${BRAND_NAME} reserves the right to modify this Privacy Policy at any time.`,
      `Updated versions will become effective upon publication on the ${BRAND_NAME} website.`,
      `Continued use of ${BRAND_NAME} services following any update constitutes acceptance of the revised Privacy Policy.`,
    ],
  },
];

const CONTACT_HEADING = '15. Contact Information';

const TOC = [
  { id: legalAnchor(INTRO.h), label: INTRO.h },
  ...SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h })),
  { id: legalAnchor(CONTACT_HEADING), label: CONTACT_HEADING },
];

/** Renders one policy section body — prose, bullets, sub-sections, trailing prose. */
function SectionBody({ sec }: { sec: PolicySection }) {
  return (
    <>
      {sec.lead?.map((p, i) => <LegalP key={`lead-${i}`}>{p}</LegalP>)}
      {sec.bullets && <LegalList items={sec.bullets} />}
      {sec.subs?.map((sub) => (
        <div key={sub.title} className="flex flex-col gap-3">
          <LegalSubheading>{sub.title}</LegalSubheading>
          {sub.lead && <LegalP>{sub.lead}</LegalP>}
          {sub.bullets && <LegalList items={sub.bullets} />}
          {sub.trailing && <LegalP>{sub.trailing}</LegalP>}
        </div>
      ))}
      {sec.trailing?.map((p, i) => <LegalP key={`tail-${i}`}>{p}</LegalP>)}
    </>
  );
}

export default function PrivacyPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Privacy Policy"
        lead="What personal data we collect, why we collect it, and how we keep it safe."
      />

      <Section raised>
        <LegalDoc toc={TOC} updated="June 2026">
          <LegalSection id={legalAnchor(INTRO.h)} heading={INTRO.h}>
            <SectionBody sec={INTRO} />
          </LegalSection>

          {SECTIONS.map((sec) => (
            <LegalSection key={sec.h} id={legalAnchor(sec.h)} heading={sec.h}>
              <SectionBody sec={sec} />
            </LegalSection>
          ))}

          {/* Section 15 — Contact (special handling) */}
          <LegalSection id={legalAnchor(CONTACT_HEADING)} heading={CONTACT_HEADING}>
            <LegalP>
              For questions, concerns, requests, or complaints regarding this Privacy Policy, please contact:
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
              {BRAND_NAME} is committed to protecting client privacy and maintaining the highest standards of data security and confidentiality.
            </LegalP>
            <LegalP>
              Read this alongside our{' '}
              <Link href="/terms" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Terms of Service
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
        title="Your Data, Your Control"
        lead={`Open a ${BRAND_NAME} account confident that we treat your personal data with the same care we apply to your trading capital.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Delete My Account', href: '/delete-account' }}
      />
    </main>
  );
}
