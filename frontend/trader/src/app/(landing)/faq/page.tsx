import type { Metadata } from 'next';
import { Section, SectionHeading, PageHero, CtaBanner, FaqAccordion, type FaqItem } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Standalone FAQ.
 *
 * Every answer below is lifted from copy that already exists on the
 * platform — nothing here is newly invented. Provenance per group:
 *
 *   • src/home/data.ts → FAQ[]            (the homepage accordion)
 *   • src/app/(landing)/how-it-works      (STEPS + broker-vs-protocol cards)
 *   • src/app/(landing)/deposit-withdrawal (the signed Deposit & Withdrawal
 *     Policy — authoritative where it conflicts with older marketing copy,
 *     e.g. supported payment methods)
 *   • src/app/(landing)/restricted-countries and /delete-account
 *
 * Questions we could NOT source an answer for were left out.
 */

export const metadata: Metadata = {
  title: `Frequently Asked Questions | ${BRAND_NAME}`,
  description: `Answers to the most common questions about opening, funding, and trading a ${BRAND_NAME} account — minimum deposit, supported payment methods, withdrawals, KYC, and account security.`,
};

/* ── Getting started ───────────────────────────────────────────────────
   Sources: home/data.ts FAQ[0]; how-it-works hero + broker-vs-protocol
   cards; how-it-works STEPS. */
const GETTING_STARTED: FaqItem[] = [
  {
    q: 'What is the minimum deposit required to start trading?',
    a: 'Only $50. A $50 first deposit unlocks the Standard live account or the IB partner account; ECN starts at $200. A free Demo account with $100,000 in virtual funds is also available — no commitment.',
  },
  {
    q: `How is ${BRAND_NAME} different from a traditional broker?`,
    a: (
      <>
        <p>
          {BRAND_NAME} does not hold your funds. Your trades operate through a structured smart
          contract system. Execution is automated. Control stays with you.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {[
            'Funds interact with smart contract layer',
            'No custody held by platform',
            'Trades execute via system logic',
            'Automatic P&L settlement',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span
                className="shrink-0 rounded-full"
                style={{ width: '5px', height: '5px', marginTop: '0.62em', background: 'var(--mk-accent)' }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    q: 'What are the steps from wallet to trade?',
    a: (
      <>
        <p>Every step is system-driven. No manual control involved.</p>
        <ol className="mt-3 flex flex-col gap-1.5">
          {[
            'Connect Wallet — securely connect your wallet to access the platform.',
            'Access Your Dashboard — manage your profile, settings, and activity through your CRM.',
            `Create Trading Account — choose ${BRAND_NAME} native or an external integration.`,
            'Allocate Funds to Contract — funds move into a secure smart contract layer, not a broker.',
            'Execute Trades — trade normally using your selected account.',
            'Automatic P&L Settlement — profits credit, losses deduct, automatically.',
            'Withdraw Anytime — funds settle directly back to your wallet.',
          ].map((item, i) => (
            <li key={item} className="flex items-start gap-3">
              <span
                className="shrink-0 font-mono"
                style={{ color: 'var(--mk-accent)', fontSize: 'var(--mk-text-sm)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </>
    ),
  },
];

/* ── Funding ───────────────────────────────────────────────────────────
   Sources: deposit-withdrawal policy §2, §4.3, §7, §8, §10. */
const FUNDING: FaqItem[] = [
  {
    q: 'Which deposit and withdrawal methods are supported?',
    a: (
      <>
        <p>{BRAND_NAME} currently supports Cryptocurrency Deposits and Withdrawals Only.</p>
        <p className="mt-3">Supported cryptocurrencies may include, but are not limited to:</p>
        <p className="mt-1">
          Bitcoin (BTC) · Ethereum (ETH) · Tether (USDT) · USD Coin (USDC) · Other cryptocurrencies
          approved by {BRAND_NAME}.
        </p>
        <p className="mt-3">
          {BRAND_NAME} does not currently support bank transfers, credit cards, debit cards, or
          third-party payment processors not approved by {BRAND_NAME}. The list of supported
          cryptocurrencies may be updated at any time without prior notice.
        </p>
      </>
    ),
  },
  {
    q: 'How long do withdrawals take?',
    a: (
      <>
        <p>Approved withdrawal requests are generally processed within 24 business hours.</p>
        <p className="mt-3">
          Actual receipt times depend on blockchain network conditions, the cryptocurrency selected,
          and the required network confirmations.
        </p>
      </>
    ),
  },
  {
    q: 'Why might a withdrawal be delayed or declined?',
    a: (
      <>
        <p>
          {BRAND_NAME} reserves the right to decline or delay withdrawals in the following
          circumstances: incomplete KYC verification, ongoing AML review, security concerns,
          suspected fraud, violation of Terms &amp; Conditions, account disputes, or technical issues
          beyond the Company&apos;s control.
        </p>
      </>
    ),
  },
  {
    q: 'Can someone else deposit or withdraw on my behalf?',
    a: (
      <>
        <p>
          No. {BRAND_NAME} does not permit third-party deposits or withdrawals. The registered account
          holder must be the beneficial owner of all funds transferred to and from the trading
          account.
        </p>
        <p className="mt-3">
          Any suspected third-party transaction may result in transaction rejection, account
          suspension, compliance review, or account closure.
        </p>
      </>
    ),
  },
  {
    q: 'Can I get a refund on a deposit?',
    a: (
      <>
        <p>
          Clients who have deposited funds but have not engaged in any trading activity may request a
          refund within 24 hours of the original deposit. Refund requests are reviewed on a
          case-by-case basis and may require identity verification.
        </p>
        <p className="mt-3">
          Refunds will not be available where trading activity has occurred, positions have been
          opened or closed, bonus abuse is suspected, or AML concerns exist. Approved refunds will be
          returned only to the original cryptocurrency wallet used for the deposit whenever
          technically possible.
        </p>
      </>
    ),
  },
];

/* ── Trading ───────────────────────────────────────────────────────────
   Sources: home/data.ts FAQ[4], FAQ[5], FAQ[6]. */
const TRADING: FaqItem[] = [
  {
    q: 'Which currency pairs can I trade?',
    a: `${BRAND_NAME} quotes major pairs such as EUR/USD, GBP/USD and USD/JPY, minor crosses including EUR/GBP and AUD/JPY, and exotic pairs across emerging markets. Stock indices, gold and silver, and major digital assets are available from the same account.`,
  },
  {
    q: 'What spreads and leverage are available?',
    a: 'Spreads start from 0.0 pips on ECN accounts and from 1.0 pip on Standard, with commission shown on the order ticket before you confirm. Leverage is adjustable up to 1:500 depending on account type and instrument. Higher leverage increases both potential gains and potential losses.',
  },
  {
    q: 'How is my order executed?',
    a: 'Market orders are filled at the live quote with no dealing-desk intervention. Pending orders, stop-loss and take-profit levels are held server-side, so they stay active even when your browser is closed.',
  },
  {
    q: 'How do I apply for the IB programme?',
    a: 'Open the IB Referral page from the footer and complete the short partner application (name, country, email, phone, and a brief note about your audience). Our partner team reviews and activates accounts within 24 hours. Once approved you receive a unique referral link plus a marketing kit, and you earn weekly per-lot commissions on every trade your referrals place.',
  },
];

/* ── Account & security ────────────────────────────────────────────────
   Sources: deposit-withdrawal policy §5 and §6; restricted-countries §2;
   delete-account page. */
const ACCOUNT: FaqItem[] = [
  {
    q: 'What verification (KYC) do I need to complete?',
    a: (
      <>
        <p>
          Before deposits are available for trading and before withdrawals are approved, clients may
          be required to complete identity verification procedures. Required documents may include a
          government-issued photo ID, proof of address, selfie verification, and additional documents
          requested by Compliance.
        </p>
        <p className="mt-3">
          {BRAND_NAME} reserves the right to restrict account functionality until verification
          requirements are completed.
        </p>
      </>
    ),
  },
  {
    q: 'Why might my account be reviewed or frozen?',
    a: (
      <>
        <p>
          {BRAND_NAME} maintains strict AML and Counter-Terrorist Financing procedures. The Company
          reserves the right to request proof of source of funds, request blockchain transaction
          evidence, delay transactions pending compliance review, reject suspicious transactions,
          freeze accounts involved in unlawful activities, and report suspicious activity to relevant
          authorities where required.
        </p>
      </>
    ),
  },
  {
    q: 'Which countries are restricted?',
    a: (
      <>
        <p>
          {BRAND_NAME} does not provide services to citizens, residents, or persons located in the
          United States of America (USA), Cuba, Iraq, Myanmar, North Korea, and Sudan.
        </p>
        <p className="mt-3">
          The services of {BRAND_NAME} are not intended for distribution to, or use by, any person in
          any country or jurisdiction where such distribution or use would be contrary to local law
          or regulation. See the Restricted Countries page for the full policy.
        </p>
      </>
    ),
  },
  {
    q: 'How do I delete my account and my data?',
    a: (
      <>
        <p>
          Go to Settings → Account → Delete account and follow the prompts, or send a deletion request
          from your registered email address to our support team with the subject &quot;Account
          Deletion Request&quot;.
        </p>
        <p className="mt-3">
          Deletion is normally completed within 30 days of a verified request and is permanent. As a
          financial services provider we are legally required to retain certain transaction and
          identity-verification records after deletion — see the Delete Your Account page for the
          full breakdown.
        </p>
      </>
    ),
  },
];

const GROUPS: { id: string; kicker: string; title: string; items: FaqItem[] }[] = [
  { id: 'getting-started', kicker: 'Getting started', title: 'Opening an account', items: GETTING_STARTED },
  { id: 'funding', kicker: 'Funding', title: 'Deposits & withdrawals', items: FUNDING },
  { id: 'trading', kicker: 'Trading', title: 'Trading on the platform', items: TRADING },
  { id: 'account-security', kicker: 'Account & security', title: 'Verification, compliance & your data', items: ACCOUNT },
];

export default function FaqPage() {
  return (
    <main>
      <PageHero
        kicker="Support"
        title="Frequently Asked Questions"
        lead={`Everything you need to know before your first deposit. Still have questions? Our team is live 24/7.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Contact Support', href: '/company/contact' }}
      />

      {GROUPS.map((group, i) => (
        <Section key={group.id} id={group.id} raised={i % 2 === 0}>
          <SectionHeading align="left" kicker={group.kicker} title={group.title} />
          <div className="mt-8 max-w-3xl">
            <FaqAccordion items={group.items} />
          </div>
        </Section>
      ))}

      <CtaBanner
        title="Still have a question?"
        lead={`Our support team answers around the clock — or open a ${BRAND_NAME} account and try the platform for yourself.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Contact Support', href: '/company/contact' }}
      />
    </main>
  );
}
