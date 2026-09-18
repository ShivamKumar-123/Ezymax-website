import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalP, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Risk Disclaimer — public legal page.
 * Linked from footer. Boilerplate adapted to the platform's product mix
 * (forex, CFDs, crypto). Restyled onto the shared marketing design
 * system; every clause is carried over verbatim.
 */

const SECTIONS = [
  {
    h: '1. General Risk Warning',
    p: `Trading forex, contracts-for-difference (CFDs), and crypto-assets carries a high level of risk and can result in losses that exceed your initial
    deposit. These products may not be suitable for every investor. You should only trade with
    capital you can afford to lose, and seek independent advice if you do not fully understand
    the risks involved.`,
  },
  {
    h: '2. Leverage',
    p: `Leverage allows you to control a position size larger than your account balance — and
    amplifies both gains and losses. A relatively small adverse market move can wipe out your
    margin and trigger a stop-out. ${BRAND_NAME} offers leverage up to 1:1000 across most pairs;
    leverage is a tool, not free capital. Size positions to your stop-loss, not to the maximum
    leverage available.`,
  },
  {
    h: '3. Volatility & Liquidity',
    p: `Crypto markets are open 24/7 and can move several percent in minutes during news or
    liquidations. Forex majors, indices, and energies have well-defined session hours; outside
    those hours spreads widen and liquidity thins. Order execution at the published market price
    is NOT guaranteed during gaps, slippage, or low-liquidity windows.`,
  },
  {
    h: '4. CFD-Specific Risks',
    p: `CFDs are derivative products — you do not own the underlying asset. P&L mirrors the price
    movement of the underlying but is settled in cash. Holding CFDs overnight incurs swap charges
    that compound. A negative-balance protection mechanism applies to retail accounts where
    available, but slippage during extreme moves can still wipe out the entire margin.`,
  },
  {
    h: '5. Crypto-Asset Risks',
    p: `Crypto-assets are subject to regulatory uncertainty, smart-contract risk, exchange-rate
    risk, and operational risk from custodians and bridges. On-chain transactions are
    irreversible. ${BRAND_NAME} DEX trades settle through smart-contracts that have been audited but
    are not guaranteed to be free of exploits. Do not deposit crypto you cannot afford to lose.`,
  },
  {
    h: '6. Bonus Credit',
    p: `${BRAND_NAME} does not currently run a deposit-bonus promotion. Where bonus credit does reach
    an account — through a partner arrangement, for example — it is credited as tradeable balance
    and is absorbed by losing trades before your deposited capital. Its terms and unlock conditions
    are disclosed in your dashboard at the time it is granted, and bonus credit is not in itself
    withdrawable.`,
  },
  {
    h: '7. Trade Insurance',
    p: `Trade Insurance, where activated on the order ticket, refunds a stated percentage of any
    covered losing trade up to the policy cap disclosed at the time of opt-in. The fee is
    deducted on trade open and is non-refundable. Insurance payouts are subject to minimum trade
    duration and the policy conditions visible at activation.`,
  },
  {
    h: '8. AI & Algo Trading',
    p: `Our AI-driven auto-trading and algorithmic strategies analyse historical and live market
    data but cannot anticipate every market condition. Past back-tested or live performance is
    not indicative of future results. You are responsible for monitoring positions, setting
    risk limits, and pausing strategies during high-impact news.`,
  },
  {
    h: '9. Tax Treatment',
    p: `The tax treatment of trading profits, swap interest, and bonus equity varies by
    jurisdiction. You are responsible for declaring and paying any applicable tax. ${BRAND_NAME} does
    not provide tax advice — consult a qualified tax adviser for your situation.`,
  },
  {
    h: '10. No Investment Advice',
    p: `Information published on our website, in market commentary, and inside the platform is
    general in nature and does not constitute personalised investment advice. We do not consider
    your individual objectives, financial situation, or needs.`,
  },
  {
    h: '11. Jurisdictional Restrictions',
    p: `${BRAND_NAME} Services are not available to residents of jurisdictions where the offering of
    CFD, forex, or crypto-derivative trading is prohibited under local law. You are responsible
    for ensuring your use of the Services complies with the laws of your jurisdiction.`,
  },
  {
    h: '12. Acknowledgement',
    p: `By opening a ${BRAND_NAME} account you confirm you have read, understood, and accepted this Risk
    Disclaimer alongside our Terms of Service and Privacy Policy. You trade at your own risk.`,
  },
];

const TOC = SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h }));

export default function RiskPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Risk Disclaimer"
        lead="Plain-English warnings about the risks of trading forex, CFDs, and crypto."
      />

      <Section raised>
        <LegalDoc toc={TOC}>
          <LegalCallout tone="warn">
            <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>Important:</span> Trading
            carries significant risk. Past performance is not indicative of future results. You may
            lose some or all of your invested capital — only trade with money you can afford to lose.
          </LegalCallout>

          {SECTIONS.map(({ h, p }) => (
            <LegalSection key={h} id={legalAnchor(h)} heading={h}>
              <LegalP>{p}</LegalP>
            </LegalSection>
          ))}

          <LegalP>
            Cross-read with our{' '}
            <Link href="/terms" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Privacy Policy
            </Link>
            . Risk queries can be sent to{' '}
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
        secondary={{ label: 'Read the Risk Warning', href: '/risk-warning' }}
      />
    </main>
  );
}
