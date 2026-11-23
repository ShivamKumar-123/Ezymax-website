import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '../_legal/components';
import { LegalDoc, LegalSection, LegalP, LegalList, LegalCallout, legalAnchor } from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Security',
  description: 'How Ezymex protects your account, your money and your records.',
  alternates: { canonical: '/security' },
};

/**
 * Security â€” public page.
 *
 * Every statement here describes something the platform actually does, and each one was checked against the
 * code that does it before it was written down: argon2id hashing and one-time codes in the gateway, read-only
 * access and staff-session records in the Client Area, the four-eyes threshold on balance adjustments in the
 * wallet service, and the engine's ledger replay in the trading service.
 *
 * Two things are deliberately absent. There is no claim of an external audit or certification, because there
 * has not been one. And there is no withdrawal address whitelist, because the platform does not have one yet -
 * naming it here would be the easiest sentence to write and the worst one to be caught on.
 */

const SECTIONS: { h: string; body: string; list?: string[]; trailing?: string }[] = [
  {
    h: '1. Signing in',
    body: `Your password is never stored. ${BRAND_NAME} keeps only an argon2id hash of it, a form designed to be slow and expensive to attack, so a stolen database does not hand anyone your password. Signing in also takes a one-time code sent to your e-mail, which means a password on its own is not enough to reach your account.`,
    list: [
      'Passwords stored as argon2id hashes, never as text',
      'A one-time code on sign-in, in addition to your password',
      'Repeated code requests are rate-limited, by account and by network address',
      'You can see your active sessions and end any of them',
    ],
  },
  {
    h: '2. Letting someone look without letting them act',
    body: `You can grant read-only access to your account - to a mentor, an accountant, or anyone you choose - and withdraw it whenever you like. A read-only visitor sees what you allow and can do nothing else: no trading, no transfers, no withdrawals, no changes to your details.`,
  },
  {
    h: '3. When our staff open your account',
    body: `Support sometimes needs to see your account to answer you. When that happens you are told while it is happening: a banner across the Client Area names the member of staff who opened the session and counts down the time left on it, and the session expires on its own. Every such session is recorded.`,
  },
  {
    h: '4. Two people, not one, for money that moves by hand',
    body: `Balance adjustments made by staff are capped by a threshold the broker sets. Above it, an adjustment does nothing until a second member of staff with a separate permission approves it. The same rule governs Ezymex SIP: a month's returns are settled once, and a settlement has to be approved by someone other than the person who prepared it before a single payout leaves.`,
  },
  {
    h: '5. Books that check themselves',
    body: `The trading engine is event-sourced. Every fill, every balance change and every ledger entry is written as one event inside one database transaction, so a half-finished operation cannot exist. On every restart the engine replays all of those events, rebuilds the balances from them, and checks that the ledger balances - and refuses to start if it does not. Your balance is a consequence of recorded events, not a number anyone types in.`,
  },
  {
    h: '6. A record of what happened',
    body: `Account changes, staff actions, approvals and sign-ins are written to an audit record with who did what and when. Operations that move money carry an idempotency key, so a double-click, a retried request or a flaky connection books the movement once rather than twice.`,
  },
  {
    h: '7. How the platform is exposed',
    body: `The services behind ${BRAND_NAME} do not face the internet. They listen only on the machine they run on, and public traffic reaches them through a reverse proxy behind Cloudflare, over HTTPS. Database credentials and payment keys live in server-side configuration and are never sent to a browser or an app.`,
  },
  {
    h: '8. What we do not claim',
    body: `${BRAND_NAME} has not been through an external security audit or certification, and this page does not pretend otherwise. Trading involves risk to your capital regardless of how well an account is protected, and security measures do not reduce market risk. If you believe you have found a vulnerability, write to us and we will reply.`,
    trailing: `Report anything you find to ${BRAND_SUPPORT_EMAIL}.`,
  },
];

const TOC = SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h }));

export default function SecurityPage() {
  return (
    <div className="legal-page">
      <PageHero
        kicker="Security"
        title="How your account is protected"
        lead={`What ${BRAND_NAME} does to keep your account, your money and your records safe - and what it does not claim.`}
      />

      <Section raised>
        <LegalDoc toc={TOC} updated="October 2026">
          <LegalCallout tone="warn">
            <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>No security measure removes market risk.</span>{' '}
            Everything on this page is about protecting your account and your records. Your capital is still at risk when you trade.
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
            <Link href="/deposit-withdrawal" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Deposit &amp; Withdrawal Policy
            </Link>{' '}
            and{' '}
            <Link href="/risk-warning" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Risk Warning
            </Link>
            .
          </LegalP>
        </LegalDoc>
      </Section>

      <CtaBanner
        title="Questions about security?"
        lead="Write to us and a person will answer - we would rather explain how something works than have you guess."
        primary={{ label: 'Contact us', href: '/contact' }}
        secondary={{ label: 'Read the risk warning', href: '/risk-warning' }}
      />
    </div>
  );
}
