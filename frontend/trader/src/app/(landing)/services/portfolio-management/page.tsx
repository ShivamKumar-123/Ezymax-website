'use client';

import {
  Users, BarChart3, Wallet, ShieldCheck, Award, Layers, Headphones, FileText, Target,
} from 'lucide-react';
import {
  Section, SectionHeading, PageHero, FeatureGrid, CtaBanner, FaqAccordion,
} from '@/marketing/components';
import { QuoteSection } from '@/home/components/QuoteSection';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Services → Portfolio Management. Restyled onto the shared marketing
 * design system. The MAM/PAMM copy, fee table and FAQ are carried over
 * verbatim; the investor quote band is reused as-is.
 */

const SIGNUP_HREF = '/auth/register';

const MAM_POINTS = [
  'Best for: investors who want a hands-off managed account',
  'Allocation: by lot size (configurable per sub-account)',
  'Minimum: $5,000',
  'Performance fee: 25% high-water mark',
  'Monthly statement + live dashboard',
];

const PAMM_POINTS = [
  'Best for: investors who want exposure to a top strategy at lower entry',
  'Allocation: by % of pooled equity',
  'Minimum: $1,000',
  'Performance fee: 20% high-water mark',
  'Daily NAV + transparent fee ledger',
];

const FEE_ROWS = [
  { label: 'Minimum deposit',      a: '$1,000',    b: '$5,000' },
  { label: 'Management fee',       a: '0%',        b: '0%' },
  { label: 'Performance fee',      a: '20%',       b: '25%' },
  { label: 'High-water mark',      a: '✓',         b: '✓' },
  { label: 'Withdrawal frequency', a: 'Monthly',   b: 'Anytime' },
  { label: 'Lock-up period',       a: '30 days',   b: 'None' },
  { label: 'Reporting',            a: 'Daily NAV', b: 'Live + Monthly statement' },
];

export default function PortfolioManagementPage() {
  return (
    <main>
      <PageHero
        kicker="Managed Accounts"
        title="Portfolio Management"
        lead="Professional asset allocation managed by verified strategists. Choose MAM for a fully managed account, or PAMM for proportional exposure to a master strategy."
        primary={{ label: 'Open Account', href: SIGNUP_HREF }}
        secondary={{ label: 'Compare MAM & PAMM', href: '#mam-pam' }}
      />

      {/* MAM vs PAMM comparison */}
      <Section raised id="mam-pam">
        <SectionHeading
          kicker="Two Allocation Models"
          title="MAM vs PAMM"
          lead="Same expert managers, two ways to participate. Pick the model that fits your capital and control preferences."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
          <article className="mk-card mk-card--hover flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Users size={22} />
              </span>
              <div>
                <h3 className="mk-h3">MAM</h3>
                <div
                  style={{
                    fontSize: 'var(--mk-text-label)',
                    letterSpacing: 'var(--mk-tracking-label)',
                    textTransform: 'uppercase',
                    color: 'var(--mk-text-faint)',
                  }}
                >
                  Multi-Account Manager
                </div>
              </div>
            </div>
            <p className="mk-body">
              A master manager trades a block account; trades are mirrored to your individual sub-account by
              lot allocation. You retain full ownership of your account — deposit, withdraw, or close any time.
            </p>
            <ul className="flex flex-col gap-2.5">
              {MAM_POINTS.map((b) => (
                <li key={b} className="flex items-start gap-2 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                  <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--mk-accent)' }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="mk-card mk-card--hover flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <BarChart3 size={22} />
              </span>
              <div>
                <h3 className="mk-h3">PAMM</h3>
                <div
                  style={{
                    fontSize: 'var(--mk-text-label)',
                    letterSpacing: 'var(--mk-tracking-label)',
                    textTransform: 'uppercase',
                    color: 'var(--mk-text-faint)',
                  }}
                >
                  Percentage Allocation Manager
                </div>
              </div>
            </div>
            <p className="mk-body">
              Capital is pooled with other investors into a master strategy; gains and losses are credited to
              your sub-account proportionally to your equity share. Simpler operations, lower entry minimum.
            </p>
            <ul className="flex flex-col gap-2.5">
              {PAMM_POINTS.map((b) => (
                <li key={b} className="flex items-start gap-2 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                  <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--mk-accent)' }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </Section>

      {/* Investor quote — Warren Buffett "make money while you sleep" */}
      <QuoteSection
        eyebrow="Why Managed Accounts"
        quote={
          <>
            &ldquo;If you don&rsquo;t find a way to{' '}
            <span className="text-primary font-bold">make money while you sleep</span>,
            you will <span className="text-primary font-bold">work until you die</span>.&rdquo;
          </>
        }
      />

      {/* Fee table */}
      <Section raised>
        <SectionHeading
          kicker="Fees"
          title="Transparent Fees"
          lead="No hidden costs. Performance-only fees with a high-water mark — you only pay when your account hits a new equity peak."
        />
        <div className="overflow-x-auto mt-12">
          <div
            className="min-w-[620px] overflow-hidden"
            style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius)' }}
          >
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    className="px-5 py-4 text-left"
                    style={{
                      background: 'var(--mk-surface)',
                      borderRight: '1px solid var(--mk-line)',
                      fontSize: 'var(--mk-text-label)',
                      letterSpacing: 'var(--mk-tracking-label)',
                      textTransform: 'uppercase',
                      color: 'var(--mk-text-faint)',
                    }}
                  >
                    Fee Type
                  </th>
                  <th
                    className="px-5 py-4 text-center font-bold"
                    style={{
                      background: 'var(--mk-surface-2)',
                      color: 'var(--mk-text)',
                      borderRight: '1px solid var(--mk-line)',
                      fontSize: 'var(--mk-text-sm)',
                      letterSpacing: 'var(--mk-tracking-label)',
                      textTransform: 'uppercase',
                    }}
                  >
                    PAMM
                  </th>
                  <th
                    className="px-5 py-4 text-center font-bold"
                    style={{
                      background: 'var(--mk-accent)',
                      color: '#fff',
                      fontSize: 'var(--mk-text-sm)',
                      letterSpacing: 'var(--mk-tracking-label)',
                      textTransform: 'uppercase',
                    }}
                  >
                    MAM
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEE_ROWS.map((row) => (
                  <tr key={row.label} style={{ borderTop: '1px solid var(--mk-line)' }}>
                    <td
                      className="px-5 py-4"
                      style={{
                        background: 'var(--mk-surface)',
                        borderRight: '1px solid var(--mk-line)',
                        fontSize: 'var(--mk-text-sm)',
                        color: 'var(--mk-text-muted)',
                      }}
                    >
                      {row.label}
                    </td>
                    <td
                      className="px-5 py-4 text-center"
                      style={{
                        background: 'var(--mk-bg-raised)',
                        borderRight: '1px solid var(--mk-line)',
                        fontSize: 'var(--mk-text-sm)',
                        color: 'var(--mk-text)',
                      }}
                    >
                      {row.a}
                    </td>
                    <td
                      className="px-5 py-4 text-center"
                      style={{
                        background: 'var(--mk-accent-soft)',
                        fontSize: 'var(--mk-text-sm)',
                        color: 'var(--mk-text)',
                      }}
                    >
                      {row.b}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Benefits grid */}
      <Section>
        <SectionHeading kicker="Benefits" title="Why Choose Managed Portfolios" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Award,       title: 'Verified Track Record', body: 'Every manager publishes audited live performance for at least 24 months before being listed.' },
            { icon: ShieldCheck, title: 'Segregated Funds',      body: 'Your capital stays in your own sub-account. Managers can trade — they cannot withdraw.' },
            { icon: Layers,      title: 'Multi-Strategy Mix',    body: 'Allocate across several managers to diversify across style, asset class, and volatility regime.' },
            { icon: BarChart3,   title: 'Daily NAV & Reports',   body: 'Track equity, drawdown, fees, and attribution in real time. Export to CSV for your accountant.' },
            { icon: Headphones,  title: 'Dedicated Onboarding',  body: 'A relationship manager walks you through manager selection, risk profiling, and allocation.' },
            { icon: Target,      title: 'Performance-Aligned',   body: 'Managers earn only on profit above prior peak. No fee on flat or losing months — period.' },
          ]}
        />
      </Section>

      {/* How to start */}
      <Section raised>
        <SectionHeading kicker="Getting Started" title="How to Start" />
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {[
            { n: '01', icon: Wallet,    title: 'Fund Your Account',  body: 'Deposit via crypto, wire, or card. Minimum $1,000 for PAMM, $5,000 for MAM.' },
            { n: '02', icon: Users,     title: 'Choose a Manager',   body: 'Filter by style, AUM, drawdown, and CAGR. Read the prospectus, then allocate.' },
            { n: '03', icon: FileText,  title: 'Sign the Agreement', body: 'E-sign the limited-power-of-attorney granting trading-only rights to the manager.' },
            { n: '04', icon: BarChart3, title: 'Watch & Withdraw',   body: 'Track performance daily. Withdraw any time — anytime for MAM, monthly for PAMM.' },
          ].map(({ n, icon: Icon, title, body }) => (
            <li key={n} className="mk-card mk-card--hover flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span
                  className="font-extrabold"
                  style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1 }}
                >
                  {n}
                </span>
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                >
                  <Icon size={20} />
                </span>
              </div>
              <h3 className="mk-h3">{title}</h3>
              <p className="mk-body">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <SectionHeading kicker="Questions" title="FAQ" />
        <div className="mt-12 mx-auto max-w-3xl">
          <FaqAccordion
            items={[
              {
                q: 'Can the manager withdraw my funds?',
                a: <>No. The Limited Power of Attorney grants trading rights only. Deposits and withdrawals can only be initiated by you — managers can place trades but never move money out of your account.</>,
              },
              {
                q: 'What happens if my manager underperforms?',
                a: <>You can re-allocate at any time. PAMM allows monthly re-allocation; MAM is anytime. There are no penalties for changing or removing a manager.</>,
              },
              {
                q: 'How is the performance fee calculated?',
                a: <>On profits above the high-water mark only. If your account is at a new equity peak, the fee is charged on the gain above the prior peak. Drawdown periods carry no fee.</>,
              },
              {
                q: 'Is my capital insured?',
                a: <>Funds in segregated client accounts are held with tier-one banking partners. Each position is also covered by on-chain trade insurance up to the policy limit.</>,
              },
            ]}
          />
        </div>
      </Section>

      <CtaBanner
        title="Get a Managed Account"
        lead={`Open your ${BRAND_NAME} account, choose MAM or PAMM, and allocate to a verified manager in under 24 hours.`}
        primary={{ label: 'Open Account', href: SIGNUP_HREF }}
      />
    </main>
  );
}
