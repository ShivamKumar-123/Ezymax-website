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
    body: `${BRAND_NAME} ("${BRAND_NAME}", "Company", "we", "our", or "us") is a software development company that builds and licenses trading technology to licensed operators. We assess every client engagement individually and comply with applicable export-control and sanctions laws. As a result, we do not provide software or services in connection with certain jurisdictions.`,
  },
  {
    h: '2. Sanctioned and High-Risk Jurisdictions',
    body: `${BRAND_NAME} does not enter into software licensing or service engagements connected with jurisdictions subject to comprehensive sanctions or export restrictions, which currently include:`,
    list: RESTRICTED,
    trailing: `${BRAND_NAME} software and services are not intended for supply to, or use by, any person or entity in any country or jurisdiction where such supply or use would be contrary to applicable law, regulation, or sanctions.`,
  },
  {
    h: '3. Client Responsibility',
    body: `It is the responsibility of each client to ensure that its licensing of ${BRAND_NAME} software, and the operation of any platform built with it, is lawful in every jurisdiction in which the client and its own customers are located. By engaging ${BRAND_NAME}, you confirm that you are not located in, and are not acting on behalf of any person in, a restricted jurisdiction.`,
  },
  {
    h: '4. Misrepresentation',
    body: `Any attempt to obtain ${BRAND_NAME} software or services from a restricted jurisdiction — including through misrepresentation of location, identity, or ownership — constitutes a breach of these Terms and may result in:`,
    list: [
      'Immediate suspension or termination of access and licences',
      'Suspension of any engagement pending a compliance review',
      'Reporting of activity to relevant authorities where required',
      'Termination of any related agreements or commercial arrangements',
    ],
  },
  {
    h: '5. Updates to the Restricted List',
    body: `${BRAND_NAME} reserves the right to add, remove, or modify the jurisdictions and restrictions described here at any time without prior notice. Updates will become effective immediately upon publication on the ${BRAND_NAME} website. Continued use of ${BRAND_NAME} services following any update constitutes acceptance of the revised terms.`,
  },
  {
    h: '6. Sanctions & Compliance',
    body: `In addition to the jurisdictions above, ${BRAND_NAME} maintains sanctions-screening procedures that may restrict, suspend, or terminate engagements with individuals or entities listed on any applicable sanctions list (including, without limitation, OFAC, UN, EU, and UK lists), regardless of country of residence.`,
  },
  {
    h: '7. Contact',
    body: `Questions about engagement eligibility or sanctions compliance can be sent to ${BRAND_SUPPORT_EMAIL}. We aim to respond within five business days.`,
  },
];

const TOC = SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h }));

export default function RestrictedCountriesPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Restricted Countries"
        lead={`How ${BRAND_NAME} approaches jurisdictional, export-control, and sanctions compliance.`}
      />

      <Section raised>
        <LegalDoc toc={TOC} updated="June 2026">
          {/* Headline callout — quick-glance list of restricted countries */}
          <LegalCallout tone="warn">
            <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>
              Not available in connection with:
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
        title="Ready to see the platform?"
        lead={`If ${BRAND_NAME} can engage in your jurisdiction, book a walkthrough of the platform under your own brand.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Contact Compliance', href: `mailto:${BRAND_SUPPORT_EMAIL}` }}
      />
    </main>
  );
}
