import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalP, LegalList, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Restricted Countries — public legal page.
 *
 * The list of restricted jurisdictions is the same one already shown in
 * the canonical landing footer (Footer.jsx 'Restricted Regions' callout),
 * surfaced as a dedicated page so the footer 'Restricted Countries' link
 * lands on its own document instead of a PDF download. Restyled onto the
 * shared marketing design system; the copy is carried over verbatim.
 */

const RESTRICTED = [
  'United States of America (USA)',
  'Cuba',
  'Iraq',
  'Myanmar',
  'North Korea',
  'Sudan',
];

const SECTIONS: { h: string; body: string; list?: string[]; trailing?: string }[] = [
  {
    h: '1. Overview',
    body: `${BRAND_NAME} ("${BRAND_NAME}", "Company", "we", "our", or "us") operates a regulated multi-asset trading platform. Due to local laws, sanctions regimes, regulatory requirements, and risk-management policies, our services are not available to citizens or residents of certain jurisdictions.`,
  },
  {
    h: '2. Restricted Jurisdictions',
    body: `${BRAND_NAME} does not provide services to citizens, residents, or persons located in the following jurisdictions:`,
    list: RESTRICTED,
    trailing: `The services of ${BRAND_NAME} are not intended for distribution to, or use by, any person in any country or jurisdiction where such distribution or use would be contrary to local law or regulation.`,
  },
  {
    h: '3. Client Responsibility',
    body: `It is your responsibility to ensure that opening a trading account with ${BRAND_NAME} and using our services is lawful in the jurisdiction in which you are a citizen, resident, or physically located. By opening an account you confirm that you are not a citizen, resident, or person physically located in any restricted jurisdiction.`,
  },
  {
    h: '4. Misrepresentation',
    body: 'Any attempt to register an account from a restricted jurisdiction — including the use of a VPN, a false address, false identity documents, or any other method to misrepresent residency — constitutes a breach of these Terms and may result in:',
    list: [
      'Immediate account suspension or closure',
      'Withholding of pending deposits, withdrawals, or balances pending compliance review',
      'Reporting of activity to relevant authorities where required',
      'Forfeiture of any bonuses, promotional credits, or referral commissions',
    ],
  },
  {
    h: '5. Updates to the Restricted List',
    body: `${BRAND_NAME} reserves the right to add, remove, or modify the list of restricted jurisdictions at any time without prior notice. Updates will become effective immediately upon publication on the ${BRAND_NAME} website. Continued use of ${BRAND_NAME} services following any update constitutes acceptance of the revised list.`,
  },
  {
    h: '6. Sanctions & Compliance',
    body: `In addition to the country list above, ${BRAND_NAME} maintains AML and sanctions-screening procedures that may restrict, suspend, or terminate services for individuals or entities listed on any applicable sanctions list (including, without limitation, OFAC, UN, EU, and UK lists), regardless of country of residence.`,
  },
  {
    h: '7. Contact',
    body: `Questions about jurisdiction eligibility or sanctions compliance can be sent to ${BRAND_SUPPORT_EMAIL}. We aim to respond within five business days.`,
  },
];

const TOC = SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h }));

export default function RestrictedCountriesPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Restricted Countries"
        lead={`Jurisdictions where ${BRAND_NAME} services are not offered.`}
      />

      <Section raised>
        <LegalDoc toc={TOC} updated="June 2026">
          {/* Headline callout — quick-glance list of restricted countries */}
          <LegalCallout tone="warn">
            <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>
              Services not available in:
            </span>{' '}
            {RESTRICTED.join(' · ')}.
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
            <Link href="/terms" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/risk" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Risk Disclaimer
            </Link>
            .
          </LegalP>
        </LegalDoc>
      </Section>

      <CtaBanner
        title="Eligible to Trade?"
        lead={`If your jurisdiction isn't on the restricted list, open a ${BRAND_NAME} account in minutes.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Contact Compliance', href: `mailto:${BRAND_SUPPORT_EMAIL}` }}
      />
    </main>
  );
}
