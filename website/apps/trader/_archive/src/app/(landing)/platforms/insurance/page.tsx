import Link from 'next/link';
import { Check } from 'lucide-react';
import { Section, SectionHeading, PageHero, CtaBanner } from '@/marketing/components';

/**
 * Public marketing page — Trade Insurance.
 * Adapted from FINAL_TRADE_INSURANCE_PAGE.docx + UI_trade_insurance.docx.
 * Note: per-trade tier model (not plan-based) — matches what's actually
 * shipped in the trader app. Restyled onto the shared marketing design
 * system; tier data, rules and copy carried over unchanged.
 */

const TIERS = [
  { tier: 'Basic',    cover: '20%', cap: '$100' },
  { tier: 'Advanced', cover: '30%', cap: '$300' },
  { tier: 'Pro',      cover: '40%', cap: '$600' },
  { tier: 'Elite',    cover: '50%', cap: '$1,000', featured: true },
];

const RULES = [
  'Trade must run a minimum 5 minutes',
  'Activate protection before placing the trade',
  'No hedging on the same instrument',
  'Valid only on losses (winners pay no claim)',
  'Max 2 insured claims / day, 12h cooldown',
  'Daily payout cap protects the fund',
];

export default function InsuranceMarketingPage() {
  return (
    <main>
      <PageHero
        kicker="Trade Insurance"
        title={<>Trade With <span style={{ color: 'var(--mk-accent)' }}>Built-In Protection.</span></>}
        lead="Activate insurance on the order ticket and get part of your loss back if a covered trade closes in the red. Flexible coverage. Controlled risk. Smarter trading."
        primary={{ label: 'Activate Protection', href: '/auth/register' }}
        secondary={{ label: 'View My Policies', href: '/insurance' }}
      />

      <Section raised>
        <SectionHeading
          kicker="Coverage"
          title="Choose Your Coverage Level"
          lead="A small fee applies per trade — fee scales with risk; coverage scales with the tier you pick."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {TIERS.map((t) => (
            <article
              key={t.tier}
              className="mk-card mk-card--hover flex flex-col gap-2"
              style={t.featured ? { borderColor: 'var(--mk-accent-line)' } : undefined}
            >
              <p
                style={{
                  fontSize: 'var(--mk-text-label)',
                  letterSpacing: 'var(--mk-tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--mk-accent)',
                  fontWeight: 700,
                }}
              >
                {t.tier}
              </p>
              <p
                className="font-extrabold tabular-nums"
                style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-text)', lineHeight: 1.1 }}
              >
                {t.cover}
              </p>
              <p
                style={{
                  fontSize: 'var(--mk-text-label)',
                  letterSpacing: 'var(--mk-tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--mk-text-faint)',
                }}
              >
                loss cover
              </p>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                Up to <span className="font-bold" style={{ color: 'var(--mk-text)' }}>{t.cap}</span> per trade
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          kicker="Policy Rules"
          title="Simple rules to keep it fair"
          lead="Clear rules. No hidden tricks."
        />
        <ul className="grid md:grid-cols-2 gap-3 max-w-3xl mx-auto mt-12">
          {RULES.map((r) => (
            <li key={r} className="flex items-start gap-2 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
              <Check size={16} className="mt-1 shrink-0" style={{ color: 'var(--mk-accent)' }} />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <div className="text-center mt-10">
          <Link href="/auth/register" className="mk-btn mk-btn--primary">Start Trading</Link>
        </div>
      </Section>

      <CtaBanner
        title="Trade With Confidence and Control"
        lead="Flexible protection designed to support your trading decisions."
        primary={{ label: 'Start Trading', href: '/auth/register' }}
      />
    </main>
  );
}
