'use client';

/**
 * Trade Insurance — public marketing surface, restyled onto the shared
 * marketing design system.
 *
 * The IB Account Tiers grid that briefly lived here has been moved to
 * the IB referral page (/products/ib-referral) where it belongs. This
 * page pitches Insurance: hero, value props, the two coverage
 * tiers (50% Standard / 70% Premium promo — both share the same bullet
 * list, only the cover % and promo flag differ), and a CTA. Exact
 * premiums/caps are still confirmed on the order ticket at activation.
 */
import Link from 'next/link';
import { ShieldCheck, Zap, Lock, ScrollText, Check } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

// Two coverage tiers shown on the order ticket. Per the client, both cards
// carry the SAME bullet list — only the headline cover % and the promo flag
// differ between Standard (50%) and Premium (70%).
const COVER_BULLETS = [
  'Higher policy caps for verified accounts',
  'Same one-click activation, no paperwork',
  'Cover applies from your very first funded trade',
];
const COVER_TIERS = [
  {
    pct: '50%',
    label: 'Standard Cover',
    sub: 'From 2% of trade size',
    promo: false,
    bullets: ['Refunds up to 50% of any covered losing trade', ...COVER_BULLETS],
  },
  {
    pct: '70%',
    label: 'Premium Cover (Promo)',
    sub: 'Limited-time offer',
    promo: true,
    bullets: ['Refunds up to 70% of any covered losing trade', ...COVER_BULLETS],
  },
];

/** Gold flag reserved for the limited promo tier — carried over from the
 *  previous design so the promo card keeps reading as the promo card. */
const PROMO_TONE = '#e8b923';

export default function InsurancePage() {
  return (
    <main>
      <PageHero
        kicker="Trade Insurance"
        title={<>Protect every <span style={{ color: 'var(--mk-accent)' }}>position</span>.</>}
        lead="Activate Insurance on the order ticket and, if your covered trade closes at a loss within the policy terms, file a claim — once approved, the payout is credited to your account as tradable funds. On-chain, transparent, and live the moment you fund the premium."
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'See Coverage Tiers', href: '#coverage' }}
      />

      {/* Hero banner. The previous image came from the cloned site and was
          deleted with its other assets; this reserves the same footprint
          until Bullza artwork replaces it. */}
      <Section>
        <div className="mk-media mk-media--ratio-21x9">
          Trade insurance — 2560×1100
        </div>
      </Section>

      {/* Features */}
      <Section raised>
        <SectionHeading kicker="How It Works" title="Cover that lives on the order ticket" />
        <FeatureGrid
          className="mt-12"
          columns={4}
          items={[
            {
              icon: ShieldCheck,
              title: 'On-Chain Policy Backing',
              body: 'Every covered position is backed by an on-chain insurance contract. Eligible losses are claimable — once approved, the payout is credited to your account as tradable funds.',
            },
            {
              icon: Zap,
              title: 'One-Click Activation',
              body: 'Toggle Insurance on the order ticket as you place the trade. Premium is deducted at fill, cover is live the same second.',
            },
            {
              icon: Lock,
              title: 'Claimable Tradable Credit',
              body: 'If your covered trade closes at a loss within the policy terms, file a claim from your account. Once approved the payout is issued as a credit — tradable only (usable on new positions), not directly withdrawable as cash.',
            },
            {
              icon: ScrollText,
              title: 'Transparent Terms',
              body: 'Cover percentage, premium, cap, and minimum trade duration are all shown on the order ticket before you opt in.',
            },
          ]}
        />

        <p
          className="mt-8 text-center mx-auto max-w-2xl"
          style={{ fontSize: 'var(--mk-text-xs)', lineHeight: 'var(--mk-leading-body)', color: 'var(--mk-text-faint)' }}
        >
          Insurance premiums apply per trade and are non-refundable. Coverage percentages, caps, and
          minimum trade durations are shown on the order ticket at activation time and may change
          without notice.
        </p>
      </Section>

      {/* Coverage tiers */}
      <Section id="coverage">
        <SectionHeading
          kicker="Coverage"
          title="Coverage Tiers"
          lead="Activate insurance on the order ticket and get a refund if your trade closes at a loss. Two coverage tiers — pick the one that fits your risk."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto mt-12">
          {COVER_TIERS.map((t) => {
            const tone = t.promo ? PROMO_TONE : 'var(--mk-accent)';
            return (
              <article
                key={t.label}
                className="mk-card mk-card--hover relative flex flex-col gap-3"
                style={{ borderColor: t.promo ? `${PROMO_TONE}66` : 'var(--mk-accent-line)' }}
              >
                {t.promo && (
                  <span
                    className="absolute top-5 right-5 inline-flex items-center rounded-full px-2.5 py-1 font-bold uppercase"
                    style={{
                      background: `${PROMO_TONE}26`,
                      color: PROMO_TONE,
                      fontSize: '10px',
                      letterSpacing: '0.12em',
                    }}
                  >
                    Limited Promo
                  </span>
                )}
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-extrabold"
                    style={{ fontSize: 'var(--mk-text-h1)', color: tone, lineHeight: 1 }}
                  >
                    {t.pct}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--mk-text-label)',
                      letterSpacing: 'var(--mk-tracking-label)',
                      textTransform: 'uppercase',
                      color: 'var(--mk-text-faint)',
                    }}
                  >
                    loss cover
                  </span>
                </div>
                <div>
                  <h3 className="mk-h3">{t.label}</h3>
                  <p
                    style={{
                      fontSize: 'var(--mk-text-label)',
                      letterSpacing: 'var(--mk-tracking-label)',
                      textTransform: 'uppercase',
                      color: 'var(--mk-text-faint)',
                    }}
                  >
                    {t.sub}
                  </p>
                </div>
                <ul className="flex flex-col gap-2.5 flex-1 mt-2">
                  {t.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                      <Check size={16} className="mt-1 shrink-0" style={{ color: tone }} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/register"
                  className={t.promo ? 'mk-btn mt-4' : 'mk-btn mk-btn--primary mt-4'}
                  style={t.promo ? { background: PROMO_TONE, color: '#0a0a0a' } : undefined}
                >
                  Activate Now
                </Link>
              </article>
            );
          })}
        </div>

        <p
          className="mt-6 text-center mx-auto max-w-2xl"
          style={{ fontSize: 'var(--mk-text-xs)', lineHeight: 'var(--mk-leading-body)', color: 'var(--mk-text-faint)' }}
        >
          Insurance fees apply per trade and are non-refundable. Coverage payouts are subject to
          minimum trade duration and the policy terms shown on the order ticket at activation time.
        </p>
      </Section>

      <CtaBanner
        title="Trade With Built-In Protection"
        lead={`Open a ${BRAND_NAME} account and tap Insurance on any order to lock in cover for that trade.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
      />
    </main>
  );
}
