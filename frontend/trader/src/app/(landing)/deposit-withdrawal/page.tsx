'use client';

/**
 * Payment & Wallet Integrations — describes the funding/withdrawal
 * integrations the platform supports for operators to offer their own
 * clients. 14 numbered sections with 2.x / 3.x style sub-clauses,
 * mirroring the original document's hierarchy. Linked from the footer.
 */
import Link from 'next/link';
import { Wallet, ShieldCheck, Mail } from 'lucide-react';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/** Section shape — supports flat prose paragraphs, bullet lists, and
 *  numbered sub-clauses (3.1, 3.2, etc.) so the layout can mirror the
 *  PDF's hierarchy without bespoke markup. */
type Block =
  | { kind: 'p'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'sub'; n: string; title: string; blocks: Block[] };

type PolicySection = { h: string; blocks: Block[] };

const SECTIONS: PolicySection[] = [
  {
    h: '1. Introduction',
    blocks: [
      { kind: 'p', text: `This page describes the payment and wallet integrations the ${BRAND_NAME} platform supports, so operators can offer funding and withdrawal options to their own clients under their own licence.` },
      { kind: 'p', text: `${BRAND_NAME} is a technology provider: we build and wire in these integrations. The operator running the platform is responsible for onboarding clients and for any handling of client funds under their own regulatory permissions.` },
    ],
  },
  {
    h: '2. Supported Payment Integrations',
    blocks: [
      { kind: 'p', text: `The ${BRAND_NAME} platform ships with cryptocurrency payment and wallet integrations, and can extend to further methods during delivery.` },
      { kind: 'p', text: 'Supported cryptocurrency integrations may include, but are not limited to:' },
      { kind: 'bullets', items: ['Bitcoin (BTC)', 'Ethereum (ETH)', 'Tether (USDT)', 'USD Coin (USDC)', 'Other cryptocurrencies configured for the operator'] },
      { kind: 'p', text: 'Integrations that can be added on request include:' },
      { kind: 'bullets', items: ['Bank Transfers', 'Credit Cards', 'Debit Cards', 'Third-party payment processors the operator works with'] },
      { kind: 'p', text: 'The set of available payment integrations can be updated as the platform evolves.' },
    ],
  },
  {
    h: '3. Deposit Flow Integration',
    blocks: [
      { kind: 'sub', n: '3.1', title: 'Deposit Wallet Address', blocks: [
        { kind: 'p', text: `The platform can generate a deposit wallet address for each client inside the operator's branded client portal built on ${BRAND_NAME}.` },
      ] },
      { kind: 'sub', n: '3.2', title: 'Deposit Confirmation', blocks: [
        { kind: 'p', text: 'Deposits are credited after the required blockchain network confirmations are completed.' },
        { kind: 'p', text: 'Confirmation times depend on:' },
        { kind: 'bullets', items: ['Blockchain network congestion', 'Cryptocurrency type', 'Network transaction fees'] },
      ] },
      { kind: 'sub', n: '3.3', title: 'Correct Network Usage', blocks: [
        { kind: 'p', text: 'The flow surfaces the correct blockchain network for each transfer so clients select the right one.' },
        { kind: 'p', text: 'Examples:' },
        { kind: 'bullets', items: ['USDT (TRC20)', 'USDT (ERC20)', 'USDT (BEP20)'] },
        { kind: 'p', text: 'Sending funds through an unsupported network may result in permanent loss, so the integration flags the required network clearly.' },
      ] },
      { kind: 'sub', n: '3.4', title: 'Minimum Amounts', blocks: [
        { kind: 'p', text: 'Minimum amounts are configurable by the operator and displayed in the client portal.' },
      ] },
    ],
  },
  {
    h: '4. Withdrawal Flow Integration',
    blocks: [
      { kind: 'sub', n: '4.1', title: 'Withdrawal Requests', blocks: [
        { kind: 'p', text: `Clients submit withdrawal requests through the operator's branded client portal built on the ${BRAND_NAME} platform.` },
      ] },
      { kind: 'sub', n: '4.2', title: 'Security Verification', blocks: [
        { kind: 'p', text: 'The withdrawal flow can require, via integrated checks:' },
        { kind: 'bullets', items: ['KYC Verification', 'Identity Verification', 'Security Confirmation', 'Additional compliance checks'] },
        { kind: 'p', text: 'before a request is released for the operator to process.' },
      ] },
      { kind: 'sub', n: '4.3', title: 'Processing Time', blocks: [
        { kind: 'p', text: 'Operators configure processing windows; the platform can flag approved requests for same-day handling.' },
        { kind: 'p', text: 'Actual receipt times depend on:' },
        { kind: 'bullets', items: ['Blockchain network conditions', 'Cryptocurrency selected', 'Required network confirmations'] },
      ] },
      { kind: 'sub', n: '4.4', title: 'Withdrawal Wallet Ownership', blocks: [
        { kind: 'p', text: 'The integration validates that a destination wallet address is provided before a request proceeds.' },
        { kind: 'p', text: 'Common causes of irreversible transfer errors, which the flow warns against, include:' },
        { kind: 'bullets', items: ['Incorrect wallet addresses', 'Unsupported wallets', 'Wrong blockchain networks', 'User input errors'] },
        { kind: 'p', text: 'Transactions confirmed on the blockchain cannot be reversed.' },
      ] },
    ],
  },
  {
    h: '5. KYC/AML Integration',
    blocks: [
      { kind: 'p', text: 'The platform integrates identity-verification providers so operators can require verification before funding is enabled or withdrawals are released.' },
      { kind: 'p', text: 'Documents an operator can require through the integration include:' },
      { kind: 'bullets', items: ['Government-issued Photo ID', 'Proof of Address', 'Selfie Verification', 'Additional documents requested by the operator'] },
      { kind: 'p', text: 'Operators can restrict account functionality until verification is completed; the platform enforces the rules they set.' },
    ],
  },
  {
    h: '6. AML & Compliance Tooling',
    blocks: [
      { kind: 'p', text: 'The platform provides AML and monitoring tooling operators can use to meet their own regulatory obligations.' },
      { kind: 'p', text: 'The tooling can support operators who need to:' },
      { kind: 'bullets', items: ['Request proof of source of funds', 'Request blockchain transaction evidence', 'Delay transactions pending compliance review', 'Reject suspicious transactions', 'Freeze accounts involved in unlawful activity', 'Report suspicious activity to relevant authorities where required'] },
    ],
  },
  {
    h: '7. Third-Party Payments',
    blocks: [
      { kind: 'p', text: 'The platform can enforce a rule that only the account holder funds and withdraws from their account, when the operator chooses.' },
      { kind: 'p', text: 'When enabled, the registered account holder must be the beneficial owner of all funds moving through the account.' },
      { kind: 'p', text: 'Any suspected third-party transaction can trigger:' },
      { kind: 'bullets', items: ['Transaction rejection', 'Account suspension', 'Compliance review', 'Account closure'] },
    ],
  },
  {
    h: '8. Withdrawal Restrictions',
    blocks: [
      { kind: 'p', text: 'The platform lets operators decline or delay withdrawals in circumstances such as:' },
      { kind: 'bullets', items: ['Incomplete KYC verification', 'Ongoing AML review', 'Security concerns', 'Suspected fraud', "Violation of the operator's terms", 'Account disputes', "Technical issues beyond the operator's control"] },
    ],
  },
  {
    h: '9. Internal Transfers',
    blocks: [
      { kind: 'p', text: "The platform can allow transfers between client accounts subject to the operator's approval workflow." },
      { kind: 'p', text: 'Additional verification can be required before approval.' },
    ],
  },
  {
    h: '10. Refund Handling',
    blocks: [
      { kind: 'sub', n: '10.1', title: 'Refund Eligibility', blocks: [
        { kind: 'p', text: 'Operators can configure a refund window — for example, allowing a refund request within 24 hours of a deposit where no trading activity has occurred.' },
      ] },
      { kind: 'sub', n: '10.2', title: 'Review Process', blocks: [
        { kind: 'p', text: 'Refund requests can be routed for case-by-case review and may require identity verification.' },
      ] },
      { kind: 'sub', n: '10.3', title: 'Non-Refundable Situations', blocks: [
        { kind: 'p', text: 'Operators can define situations where refunds are not offered, such as where:' },
        { kind: 'bullets', items: ['Trading activity has occurred', 'Positions have been opened or closed', 'Bonus abuse is suspected', 'AML concerns exist'] },
      ] },
      { kind: 'sub', n: '10.4', title: 'Refund Destination', blocks: [
        { kind: 'p', text: 'The flow can return approved refunds to the original cryptocurrency wallet used for the deposit whenever technically possible.' },
      ] },
    ],
  },
  {
    h: '11. Fees',
    blocks: [
      { kind: 'p', text: 'The platform lets operators configure withdrawal fees, blockchain network fees, or processing fees where applicable.' },
      { kind: 'p', text: 'Current fees are displayed within the client portal and are set by the operator.' },
    ],
  },
  {
    h: '12. Support and Escalation',
    blocks: [
      { kind: 'p', text: 'Questions about the payment and wallet integrations can be submitted in writing to:' },
      { kind: 'p', text: `Email: ${BRAND_SUPPORT_EMAIL}` },
      { kind: 'p', text: 'Subject: Payment Integrations' },
      { kind: 'p', text: `We will route the enquiry to the ${BRAND_NAME} team responsible for the integration.` },
    ],
  },
  {
    h: '13. Risk Warning',
    blocks: [
      { kind: 'p', text: 'Cryptocurrency transactions are irreversible and subject to blockchain network risks, volatility, and technical limitations.' },
      { kind: 'p', text: 'Clients are responsible for verifying wallet addresses, network selections, and transaction details before submitting any transfer.' },
      { kind: 'p', text: `${BRAND_NAME} provides the software and is not liable for losses resulting from client errors, blockchain failures, or third-party wallet service disruptions.` },
    ],
  },
  {
    h: '14. Updates',
    blocks: [
      { kind: 'p', text: `${BRAND_NAME} may update the payment and wallet integrations described here at any time.` },
      { kind: 'p', text: `Any updates take effect when published on the ${BRAND_NAME} website.` },
      { kind: 'p', text: `Continued use of the ${BRAND_NAME} platform constitutes acceptance of the current integration set.` },
    ],
  },
];

function renderBlocks(blocks: Block[], keyPrefix = ''): React.ReactNode {
  return blocks.map((b, i) => {
    const k = `${keyPrefix}-${i}`;
    if (b.kind === 'p') return <p key={k}>{b.text}</p>;
    if (b.kind === 'bullets') return (
      <ul key={k} className="list-disc list-inside space-y-1.5 mt-1 ml-1">
        {b.items.map((it) => <li key={it}>{it}</li>)}
      </ul>
    );
    return (
      <div key={k} className="mt-3">
        <h3 className="font-bold mb-2" style={{ color: 'var(--mk-text)' }}>
          <span className="mr-2" style={{ color: 'var(--mk-accent)' }}>{b.n}</span> {b.title}
        </h3>
        <div className="space-y-3">{renderBlocks(b.blocks, k)}</div>
      </div>
    );
  });
}

export default function DepositWithdrawalPage() {
  return (
    <main>
      <PageHero
        kicker="Platform"
        title="Payment & Wallet Integrations"
        lead={`The payment and wallet integrations the ${BRAND_NAME} platform supports, so operators can offer funding and withdrawals to their own clients.`}
      />

      <Section raised>
        <div className="mx-auto max-w-[840px] flex flex-col gap-7">
          <div className="mk-card flex items-center gap-3" style={{ padding: 'var(--mk-space-4) var(--mk-space-5)' }}>
            <Wallet size={16} className="shrink-0" style={{ color: 'var(--mk-accent)' }} />
            <span className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
              <span className="font-bold" style={{ color: 'var(--mk-text)' }}>
                {BRAND_NAME} — Payment &amp; Wallet Integrations
              </span>{' '}
              · Last updated: June 2026
            </span>
          </div>

          {SECTIONS.map((sec, idx) => (
            <section key={sec.h} className="mk-card">
              <h2 className="mk-h3" style={{ marginBottom: 'var(--mk-space-4)' }}>{sec.h}</h2>
              <div className="mk-body space-y-3" style={{ fontSize: 'var(--mk-text-sm)' }}>
                {renderBlocks(sec.blocks, String(idx))}
              </div>
            </section>
          ))}

          <div className="mk-card flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--mk-accent)' }} />
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                Read this alongside our{' '}
                <Link href="/terms" className="underline-offset-4 hover:underline" style={{ color: 'var(--mk-accent)' }}>
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="underline-offset-4 hover:underline" style={{ color: 'var(--mk-accent)' }}>
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
            <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="mk-btn mk-btn--primary shrink-0">
              <Mail size={16} /> Contact Support
            </a>
          </div>
        </div>
      </Section>

      <CtaBanner
        title="See the integrations in action"
        lead={`Book a demo and see the payment and wallet integrations ${BRAND_NAME} can wire into your platform.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Contact Support', href: '/company/contact' }}
      />
    </main>
  );
}
