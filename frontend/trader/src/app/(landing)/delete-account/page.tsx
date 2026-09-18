import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalP, LegalList, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Account & Data Deletion — public page.
 *
 * Required by Google Play (Data safety → "Account deletion" URL) and Apple.
 * Must be reachable WITHOUT login, so it lives under (landing). Explains how
 * a user requests deletion, what is erased, and what we are legally required
 * to retain (financial/AML records). Linked from the Play Console listing.
 *
 * Restyled onto the shared marketing design system; every line of copy is
 * carried over verbatim from the previous version of this page.
 */

const SUPPORT_EMAIL = `${BRAND_SUPPORT_EMAIL}`;
const SUBJECT = 'Account Deletion Request';

const HEADINGS = {
  request: 'How to request deletion',
  deleted: 'What is deleted',
  retained: 'What we must retain (and for how long)',
  timeline: 'Timeline & conditions',
  questions: 'Questions about your data?',
};

const TOC = Object.values(HEADINGS).map((h) => ({ id: legalAnchor(h), label: h }));

const DELETED = [
  'Profile & contact details (name, email, phone, address)',
  'KYC documents & verification images',
  'Login credentials & active sessions',
  'Trading accounts & preferences',
  'Watchlists, settings, and app data',
  'Marketing / communication preferences',
];

const RETAINED = [
  'Transaction, deposit & withdrawal records (financial/AML compliance) — typically up to 5–7 years.',
  'Identity-verification records required by KYC/AML law for the mandated retention period.',
  'Records needed to resolve disputes, prevent fraud, or comply with a legal/regulatory order.',
];

export default function DeleteAccountPage() {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(
    `I would like to permanently delete my ${BRAND_NAME} account and associated data.\n\nRegistered email: \nRegistered phone (if any): \nReason (optional): `,
  )}`;

  return (
    <main>
      <PageHero
        kicker="Your Data"
        title="Delete Your Account"
        lead={`Request permanent deletion of your ${BRAND_NAME} account and personal data. This page explains how, what is removed, and what we are required to keep.`}
      />

      <Section raised>
        <LegalDoc toc={TOC}>
          <LegalSection id={legalAnchor(HEADINGS.request)} heading={HEADINGS.request}>
            <LegalP>
              You can request deletion of your {BRAND_NAME} account and associated personal data in
              either of these ways:
            </LegalP>
            <ol className="flex flex-col gap-3">
              <li className="mk-body flex items-start gap-3">
                <span
                  className="shrink-0 inline-flex items-center justify-center rounded-full"
                  style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    marginTop: '0.15em',
                    background: 'var(--mk-accent-soft)',
                    color: 'var(--mk-accent)',
                    fontSize: 'var(--mk-text-xs)',
                    fontWeight: 700,
                  }}
                >
                  1
                </span>
                <span>
                  <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>
                    In the app / website:
                  </span>{' '}
                  Go to <span style={{ color: 'var(--mk-text)' }}>Settings → Account → Delete account</span>{' '}
                  and follow the prompts, or contact 24/7 support from the help menu.
                </span>
              </li>
              <li className="mk-body flex items-start gap-3">
                <span
                  className="shrink-0 inline-flex items-center justify-center rounded-full"
                  style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    marginTop: '0.15em',
                    background: 'var(--mk-accent-soft)',
                    color: 'var(--mk-accent)',
                    fontSize: 'var(--mk-text-xs)',
                    fontWeight: 700,
                  }}
                >
                  2
                </span>
                <span>
                  <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>By email:</span> Send a
                  deletion request from your registered email address to{' '}
                  <a href={mailto} className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                    {SUPPORT_EMAIL}
                  </a>{' '}
                  with the subject &quot;{SUBJECT}&quot;.
                </span>
              </li>
            </ol>
            <div>
              <a href={mailto} className="mk-btn mk-btn--primary">
                Request account deletion
              </a>
            </div>
          </LegalSection>

          <LegalSection id={legalAnchor(HEADINGS.deleted)} heading={HEADINGS.deleted}>
            <LegalP>
              Once your request is verified and any open positions / pending balances are settled, we
              permanently remove:
            </LegalP>
            <LegalList items={DELETED} />
          </LegalSection>

          <LegalSection id={legalAnchor(HEADINGS.retained)} heading={HEADINGS.retained}>
            <LegalP>
              As a financial services provider, we are legally required (anti-money-laundering, tax,
              and audit regulations) to retain certain records even after account deletion. These are
              kept only as long as the law requires, stored securely, and are not used for any other
              purpose:
            </LegalP>
            <LegalList items={RETAINED} />
            <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-faint)' }}>
              After the mandated retention period expires, this residual data is permanently deleted
              as well.
            </p>
          </LegalSection>

          <LegalSection id={legalAnchor(HEADINGS.timeline)} heading={HEADINGS.timeline}>
            <ul className="flex flex-col gap-2">
              <li className="mk-body flex items-start gap-3">
                <span className="shrink-0 rounded-full" style={{ width: '5px', height: '5px', marginTop: '0.62em', background: 'var(--mk-accent)' }} />
                <span>
                  Requests are verified against your registered identity to protect your account from
                  fraudulent deletion.
                </span>
              </li>
              <li className="mk-body flex items-start gap-3">
                <span className="shrink-0 rounded-full" style={{ width: '5px', height: '5px', marginTop: '0.62em', background: 'var(--mk-accent)' }} />
                <span>
                  Before deletion, please{' '}
                  <span style={{ color: 'var(--mk-text)' }}>withdraw any remaining balance</span> and
                  close all open positions. We will contact you if action is needed.
                </span>
              </li>
              <li className="mk-body flex items-start gap-3">
                <span className="shrink-0 rounded-full" style={{ width: '5px', height: '5px', marginTop: '0.62em', background: 'var(--mk-accent)' }} />
                <span>
                  Deletion is normally completed within{' '}
                  <span style={{ color: 'var(--mk-text)' }}>30 days</span> of a verified request.
                </span>
              </li>
              <li className="mk-body flex items-start gap-3">
                <span className="shrink-0 rounded-full" style={{ width: '5px', height: '5px', marginTop: '0.62em', background: 'var(--mk-accent)' }} />
                <span>Account deletion is permanent and cannot be undone.</span>
              </li>
            </ul>
          </LegalSection>

          <LegalSection id={legalAnchor(HEADINGS.questions)} heading={HEADINGS.questions}>
            <LegalCallout>
              Contact our team at{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="hover:underline"
                style={{ color: 'var(--mk-accent)' }}
              >
                {SUPPORT_EMAIL}
              </a>{' '}
              or see our{' '}
              <Link href="/privacy" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Privacy Policy
              </Link>
              .
            </LegalCallout>
          </LegalSection>
        </LegalDoc>
      </Section>

      <CtaBanner
        title="Questions about your data?"
        lead={`Our support team can walk you through what ${BRAND_NAME} stores, why, and how to have it removed.`}
        primary={{ label: 'Email us', href: mailto }}
        secondary={{ label: 'Privacy Policy', href: '/privacy' }}
      />
    </main>
  );
}
