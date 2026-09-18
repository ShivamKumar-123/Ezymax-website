import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalP, LegalList, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Risk Warning — public legal page.
 *
 * Surfaces the same core warning copy already shown in the Footer
 * Risk Warning callout, expanded into a full document. This sits
 * alongside /risk (the deeper Risk Disclaimer) and is linked from
 * the footer 'Legal documents' row. Restyled onto the shared marketing
 * design system; every clause is carried over verbatim.
 */

const SECTIONS: { h: string; body: string; list?: string[]; trailing?: string }[] = [
  {
    h: '1. General Risk Warning',
    body: `Please note that forex trading and trading in other leveraged products involves a significant level of risk and is not suitable for all investors. Trading in financial instruments may result in losses as well as profits, and your losses can be greater than your initial invested capital. Before undertaking any such transactions, you should ensure that you fully understand the risks involved and seek independent advice if necessary. ${BRAND_NAME} does not provide investment advice.`,
  },
  {
    h: '2. Leverage Risk',
    body: 'Leverage allows a trader to control a position larger than the deposited margin and can magnify both profits and losses. A small adverse market move can result in losses that exceed the deposited margin. Clients are advised to size positions appropriately and use stop-loss orders.',
  },
  {
    h: '3. Market Volatility',
    body: 'Forex, CFD, indices, commodity, and cryptocurrency markets can move sharply due to economic releases, geopolitical events, central-bank actions, or sudden liquidity changes. Slippage, requotes, gapping, and price spikes may occur, particularly during low-liquidity hours and around scheduled news events.',
  },
  {
    h: '4. Cryptocurrency-Specific Risks',
    body: 'Cryptocurrency trading carries additional risks including but not limited to:',
    list: [
      'Extreme intraday volatility',
      'Regulatory uncertainty in many jurisdictions',
      'Blockchain network congestion, fee spikes, or temporary outages',
      'Smart-contract, custody, and exchange-platform risk',
      'Irreversibility of on-chain transactions',
    ],
    trailing: 'Past price performance is not indicative of future results.',
  },
  {
    h: '5. Liquidity Risk',
    body: 'During periods of low liquidity, some instruments may be difficult to enter or exit at the displayed price. Spreads may widen materially, and orders may be filled at prices significantly different from the price shown at the time of order placement.',
  },
  {
    h: '6. Counterparty & Platform Risk',
    body: `Trades placed on the ${BRAND_NAME} platform are subject to the operational performance of the platform and its third-party liquidity providers. Internet connectivity, platform outages, hardware faults, and force-majeure events may temporarily prevent the execution or modification of orders.`,
  },
  {
    h: '7. Bonus & Promotion Risks',
    body: 'Promotional bonuses, deposit matches, referral rewards, and similar offers are subject to their own terms. Bonus equity is absorbed by losing trades before deposited capital and is generally non-withdrawable in isolation. Misuse of bonuses may result in bonus revocation, account restrictions, or closure.',
  },
  {
    h: '8. Regulatory & Jurisdictional Risk',
    body: `Services may be restricted, modified, or withdrawn in your jurisdiction at any time due to changes in local laws or regulatory guidance. See our Restricted Countries page for the current list of jurisdictions where ${BRAND_NAME} services are not available.`,
  },
  {
    h: '9. No Investment Advice',
    body: `Information provided on the ${BRAND_NAME} website, the trading platform, or through any ${BRAND_NAME} communication channel is for general informational purposes only and does not constitute investment, financial, tax, or legal advice. Clients should consult independent professional advisers before making any trading decision.`,
  },
  {
    h: '10. Acknowledgement',
    body: `By opening and funding a ${BRAND_NAME} account you confirm that you have read, understood, and accept this Risk Warning, alongside our Terms & Conditions, Privacy Policy, and Risk Disclaimer. You acknowledge that you are trading at your own risk.`,
  },
];

const TOC = SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h }));

export default function RiskWarningPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Risk Warning"
        lead="Trading carries a high level of risk. Read carefully before you fund an account."
      />

      <Section raised>
        <LegalDoc toc={TOC}>
          {/* Top alert — highlighted warning above the section list */}
          <LegalCallout tone="warn">
            <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>Important:</span> Trading
            forex, CFDs, cryptocurrencies, and other leveraged products is high-risk and may not be
            suitable for every investor. You may lose some or all of your invested capital — only
            trade with money you can afford to lose.
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
            <Link href="/risk" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Risk Disclaimer
            </Link>{' '}
            and{' '}
            <Link href="/terms" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Terms of Service
            </Link>
            . Questions can be sent to{' '}
            <a
              href={`mailto:${BRAND_SUPPORT_EMAIL}`}
              className="hover:underline"
              style={{ color: 'var(--mk-accent)' }}
            >
              {BRAND_SUPPORT_EMAIL}
            </a>
            .
          </LegalP>
        </LegalDoc>
      </Section>

      <CtaBanner
        title="Trade Responsibly"
        lead="Open an account only after reading and accepting all our risk disclosures."
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Restricted Countries', href: '/restricted-countries' }}
      />
    </main>
  );
}
