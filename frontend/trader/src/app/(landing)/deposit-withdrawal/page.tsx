'use client';

/**
 * Deposit & Withdrawal Policy — verbatim from the client-supplied PDF
 * "deposit and withdrawal.pdf". 14 numbered sections with 2.x / 3.x
 * style sub-clauses. Linked from the footer "Legal documents" row.
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
      { kind: 'p', text: `This Deposit & Withdrawal Policy governs all funding and withdrawal transactions conducted through ${BRAND_NAME} ("${BRAND_NAME}", "Company", "we", "our", or "us").` },
      { kind: 'p', text: `By opening an account and using ${BRAND_NAME} services, clients agree to comply with this Deposit & Withdrawal Policy, as well as the Company's Terms & Conditions, AML Policy, and KYC requirements.` },
    ],
  },
  {
    h: '2. Supported Payment Methods',
    blocks: [
      { kind: 'p', text: `${BRAND_NAME} currently supports Cryptocurrency Deposits and Withdrawals Only.` },
      { kind: 'p', text: 'Supported cryptocurrencies may include, but are not limited to:' },
      { kind: 'bullets', items: ['Bitcoin (BTC)', 'Ethereum (ETH)', 'Tether (USDT)', 'USD Coin (USDC)', `Other cryptocurrencies approved by ${BRAND_NAME}`] },
      { kind: 'p', text: `${BRAND_NAME} does not currently support:` },
      { kind: 'bullets', items: ['Bank Transfers', 'Credit Cards', 'Debit Cards', `Third-Party Payment Processors not approved by ${BRAND_NAME}`] },
      { kind: 'p', text: 'The list of supported cryptocurrencies may be updated at any time without prior notice.' },
    ],
  },
  {
    h: '3. Cryptocurrency Deposits',
    blocks: [
      { kind: 'sub', n: '3.1', title: 'Deposit Wallet Address', blocks: [
        { kind: 'p', text: `Clients must send cryptocurrency only to the wallet address generated inside their ${BRAND_NAME} Client Portal.` },
      ] },
      { kind: 'sub', n: '3.2', title: 'Deposit Confirmation', blocks: [
        { kind: 'p', text: 'Deposits are credited after the required blockchain network confirmations are completed.' },
        { kind: 'p', text: 'Confirmation times depend on:' },
        { kind: 'bullets', items: ['Blockchain network congestion', 'Cryptocurrency type', 'Network transaction fees'] },
      ] },
      { kind: 'sub', n: '3.3', title: 'Correct Network Usage', blocks: [
        { kind: 'p', text: 'Clients are solely responsible for selecting the correct blockchain network when sending funds.' },
        { kind: 'p', text: 'Examples:' },
        { kind: 'bullets', items: ['USDT (TRC20)', 'USDT (ERC20)', 'USDT (BEP20)'] },
        { kind: 'p', text: 'Sending funds through an unsupported network may result in permanent loss of funds.' },
      ] },
      { kind: 'sub', n: '3.4', title: 'Minimum Deposit', blocks: [
        { kind: 'p', text: 'Minimum deposit requirements are displayed in the Client Portal and may change without notice.' },
      ] },
    ],
  },
  {
    h: '4. Cryptocurrency Withdrawals',
    blocks: [
      { kind: 'sub', n: '4.1', title: 'Withdrawal Requests', blocks: [
        { kind: 'p', text: `Withdrawal requests must be submitted through the official ${BRAND_NAME} Client Portal.` },
      ] },
      { kind: 'sub', n: '4.2', title: 'Security Verification', blocks: [
        { kind: 'p', text: `${BRAND_NAME} may require:` },
        { kind: 'bullets', items: ['KYC Verification', 'Identity Verification', 'Security Confirmation', 'Additional compliance checks'] },
        { kind: 'p', text: 'before processing withdrawals.' },
      ] },
      { kind: 'sub', n: '4.3', title: 'Processing Time', blocks: [
        { kind: 'p', text: 'Approved withdrawal requests are generally processed within 24 business hours.' },
        { kind: 'p', text: 'Actual receipt times depend on:' },
        { kind: 'bullets', items: ['Blockchain network conditions', 'Cryptocurrency selected', 'Required network confirmations'] },
      ] },
      { kind: 'sub', n: '4.4', title: 'Withdrawal Wallet Ownership', blocks: [
        { kind: 'p', text: 'Clients are responsible for providing the correct wallet address.' },
        { kind: 'p', text: `${BRAND_NAME} is not responsible for losses resulting from:` },
        { kind: 'bullets', items: ['Incorrect wallet addresses', 'Unsupported wallets', 'Wrong blockchain networks', 'User input errors'] },
        { kind: 'p', text: 'Transactions confirmed on the blockchain cannot be reversed.' },
      ] },
    ],
  },
  {
    h: '5. Account Verification (KYC)',
    blocks: [
      { kind: 'p', text: 'Before deposits are available for trading and before withdrawals are approved, clients may be required to complete identity verification procedures.' },
      { kind: 'p', text: 'Required documents may include:' },
      { kind: 'bullets', items: ['Government-issued Photo ID', 'Proof of Address', 'Selfie Verification', 'Additional documents requested by Compliance'] },
      { kind: 'p', text: `${BRAND_NAME} reserves the right to restrict account functionality until verification requirements are completed.` },
    ],
  },
  {
    h: '6. Anti-Money Laundering (AML)',
    blocks: [
      { kind: 'p', text: `${BRAND_NAME} maintains strict AML and Counter-Terrorist Financing procedures.` },
      { kind: 'p', text: 'The Company reserves the right to:' },
      { kind: 'bullets', items: ['Request proof of source of funds', 'Request blockchain transaction evidence', 'Delay transactions pending compliance review', 'Reject suspicious transactions', 'Freeze accounts involved in unlawful activities', 'Report suspicious activity to relevant authorities where required'] },
    ],
  },
  {
    h: '7. Third-Party Payments',
    blocks: [
      { kind: 'p', text: `${BRAND_NAME} does not permit third-party deposits or withdrawals.` },
      { kind: 'p', text: 'The registered account holder must be the beneficial owner of all funds transferred to and from the trading account.' },
      { kind: 'p', text: 'Any suspected third-party transaction may result in:' },
      { kind: 'bullets', items: ['Transaction rejection', 'Account suspension', 'Compliance review', 'Account closure'] },
    ],
  },
  {
    h: '8. Withdrawal Restrictions',
    blocks: [
      { kind: 'p', text: `${BRAND_NAME} reserves the right to decline or delay withdrawals in the following circumstances:` },
      { kind: 'bullets', items: ['Incomplete KYC verification', 'Ongoing AML review', 'Security concerns', 'Suspected fraud', 'Violation of Terms & Conditions', 'Account disputes', "Technical issues beyond the Company's control"] },
    ],
  },
  {
    h: '9. Internal Transfers',
    blocks: [
      { kind: 'p', text: `Transfers between client accounts may be permitted only upon approval by ${BRAND_NAME} Compliance and Operations Departments.` },
      { kind: 'p', text: 'Additional verification may be required before approval.' },
    ],
  },
  {
    h: '10. Refund Policy',
    blocks: [
      { kind: 'sub', n: '10.1', title: 'Refund Eligibility', blocks: [
        { kind: 'p', text: 'Clients who have deposited funds but have not engaged in any trading activity may request a refund within 24 hours of the original deposit.' },
      ] },
      { kind: 'sub', n: '10.2', title: 'Review Process', blocks: [
        { kind: 'p', text: 'Refund requests are reviewed on a case-by-case basis and may require identity verification.' },
      ] },
      { kind: 'sub', n: '10.3', title: 'Non-Refundable Situations', blocks: [
        { kind: 'p', text: 'Refunds will not be available where:' },
        { kind: 'bullets', items: ['Trading activity has occurred', 'Positions have been opened or closed', 'Bonus abuse is suspected', 'AML concerns exist'] },
      ] },
      { kind: 'sub', n: '10.4', title: 'Refund Destination', blocks: [
        { kind: 'p', text: 'Approved refunds will be returned only to the original cryptocurrency wallet used for the deposit whenever technically possible.' },
      ] },
    ],
  },
  {
    h: '11. Fees',
    blocks: [
      { kind: 'p', text: `${BRAND_NAME} may charge withdrawal fees, blockchain network fees, or processing fees where applicable.` },
      { kind: 'p', text: 'Current fees are displayed within the Client Portal and may change without prior notice.' },
    ],
  },
  {
    h: '12. Disputes and Complaints',
    blocks: [
      { kind: 'p', text: 'Any dispute relating to deposits, withdrawals, refunds, or payment processing must be submitted in writing to:' },
      { kind: 'p', text: `Email: ${BRAND_SUPPORT_EMAIL}` },
      { kind: 'p', text: 'Subject: Deposit & Withdrawal Complaint' },
      { kind: 'p', text: `Complaints will be handled according to the ${BRAND_NAME} Complaints and Dispute Resolution Policy.` },
    ],
  },
  {
    h: '13. Risk Warning',
    blocks: [
      { kind: 'p', text: 'Cryptocurrency transactions are irreversible and subject to blockchain network risks, volatility, and technical limitations.' },
      { kind: 'p', text: 'Clients are responsible for verifying wallet addresses, network selections, and transaction details before submitting any transfer.' },
      { kind: 'p', text: `${BRAND_NAME} shall not be liable for losses resulting from client errors, blockchain failures, or third-party wallet service disruptions.` },
    ],
  },
  {
    h: '14. Policy Updates',
    blocks: [
      { kind: 'p', text: `${BRAND_NAME} reserves the right to amend, modify, or replace this Deposit & Withdrawal Policy at any time.` },
      { kind: 'p', text: `Any updates will become effective immediately upon publication on the ${BRAND_NAME} website.` },
      { kind: 'p', text: `Continued use of ${BRAND_NAME} services constitutes acceptance of any revised policy.` },
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
        kicker="Legal"
        title="Deposit & Withdrawal Policy"
        lead={`The rules for funding and withdrawing from your ${BRAND_NAME} account.`}
      />

      <Section raised>
        <div className="mx-auto max-w-[840px] flex flex-col gap-7">
          <div className="mk-card flex items-center gap-3" style={{ padding: 'var(--mk-space-4) var(--mk-space-5)' }}>
            <Wallet size={16} className="shrink-0" style={{ color: 'var(--mk-accent)' }} />
            <span className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
              <span className="font-bold" style={{ color: 'var(--mk-text)' }}>
                {BRAND_NAME} — Deposit &amp; Withdrawal Policy
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
        title="Fund Your Account"
        lead={`Open a ${BRAND_NAME} account and deposit via supported cryptocurrencies in minutes.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Contact Support', href: '/company/contact' }}
      />
    </main>
  );
}
