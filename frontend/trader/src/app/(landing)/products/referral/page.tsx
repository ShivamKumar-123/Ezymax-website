'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Zap, Wallet, CheckCircle2 } from 'lucide-react';
import {
  Section, SectionHeading, PageHero, FeatureGrid, CtaBanner, FaqAccordion,
} from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Products → Referral. Restyled onto the shared marketing design system.
 * Copy, links and the admin-driven tier/qualification wiring are carried
 * over from the previous page untouched — only the presentation changed.
 */

const SIGNUP_HREF = '/auth/register';

/** Wire shape from /api/v1/referral/tiers — kept lean: only the fields
 *  the marketing page actually renders. Admin owns the data in
 *  /config/referral-tiers (system_settings.referral_tiers).
 *
 *  These names must match the API exactly. The referral ladder used to share
 *  the IB key and shipped `per_lot` / `min_activations`; when it moved to its
 *  own key those became `per_referral_bounty` / `min_referrals`, but this type
 *  wasn't updated — every field read `undefined`, so the table rendered "$0"
 *  and a "1-1" range regardless of what admin configured. (fixed 2026-07-20) */
type ApiTier = {
  label: string;
  per_referral_bounty: number;
  min_referrals: number;
  max_referrals: number | null;
  instant_payout: boolean;
};

type DisplayTier = {
  label: string;        // "Bronze"
  perLot: string;       // commission shown in the table, e.g. "$5"
  requirement: string;  // "5+ activations"
  range: string;        // activation count range shown in the header, e.g. "1-20", "101+"
};

/** Admin-driven qualification conditions surfaced under the table.
 *  Server enforces these in referral_service.maybe_pay_referral_after_trades —
 *  this object is just what the marketing page renders so trader copy
 *  always matches the live engine. */
type Qualification = {
  requires_kyc: boolean;
  requires_funded_account: boolean;
  required_trades: number;
};

const DEFAULT_QUALIFICATION: Qualification = {
  requires_kyc: true,
  requires_funded_account: true,
  required_trades: 3,
};

/** Fallback shown while the API is loading or empty. Mirrors the visual
 *  design the client signed off on, so a fresh install still renders the
 *  ladder rather than going blank. */
const FALLBACK_TIERS: DisplayTier[] = [
  { label: 'Bronze', perLot: '$5',  requirement: '5+ activations',  range: '1-20' },
  { label: 'Silver', perLot: '$7',  requirement: '20+ activations', range: '21-100' },
  { label: 'Gold',   perLot: '$10', requirement: '50+ activations', range: '101+' },
];

const fmtUsd = (n: number) => `$${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

function adaptApi(t: ApiTier): DisplayTier {
  const lo = t.min_referrals > 0 ? t.min_referrals : 1;
  return {
    label: t.label,
    perLot: fmtUsd(t.per_referral_bounty || 0),
    requirement: `${lo}+ activations`,
    range: `${lo}+`, // refined in buildTiers once max / neighbours are known
  };
}

/** Turn a sorted list of API tiers into display rows whose activation header
 *  reads as a range ("1-20", "21-100", … last "+"). Prefer the tier's own
 *  max_referrals (admin sets it explicitly); fall back to one below the next
 *  tier's threshold when max is open-ended but a higher tier exists. */
function buildTiers(apiTiers: ApiTier[]): DisplayTier[] {
  return apiTiers.map((t, i) => {
    const d = adaptApi(t);
    const lo = t.min_referrals > 0 ? t.min_referrals : 1;
    const next = apiTiers[i + 1];
    const hi = t.max_referrals ?? (next ? (next.min_referrals || lo) - 1 : null);
    d.range = hi != null ? `${lo}-${Math.max(lo, hi)}` : `${lo}+`;
    return d;
  });
}

/** Comma-join with " and " before the last element so the activation
 *  sentence reads naturally for 1, 2, or 3 conditions. */
function joinClauses(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export default function ReferralPage() {
  // Admin-managed tiers + qualification gates. Both fall back to the
  // documented defaults if the API is unreachable so the marketing page
  // never goes blank or out-of-sync with backend reality on first deploy.
  const [tiers, setTiers] = useState<DisplayTier[]>(FALLBACK_TIERS);
  const [qual, setQual] = useState<Qualification>(DEFAULT_QUALIFICATION);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/referral/tiers', { credentials: 'omit' });
        if (!res.ok) return;
        const data: {
          tiers?: ApiTier[];
          qualification?: Partial<Qualification>;
        } = await res.json();
        if (cancelled) return;
        const list = buildTiers(data.tiers || []);
        if (list.length > 0) setTiers(list);
        if (data.qualification) {
          setQual({
            requires_kyc: data.qualification.requires_kyc ?? DEFAULT_QUALIFICATION.requires_kyc,
            requires_funded_account:
              data.qualification.requires_funded_account ?? DEFAULT_QUALIFICATION.requires_funded_account,
            required_trades:
              data.qualification.required_trades ?? DEFAULT_QUALIFICATION.required_trades,
          });
        }
      } catch {
        /* keep fallback — public marketing page must never error out */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Compose the activation copy from the admin gates so the card stays
  // accurate when admin flips KYC / funded off for a promo. Always lists
  // "signs up via your referral link" — that's structural, not a toggle.
  const activationBits: string[] = ['signs up via your referral link'];
  if (qual.requires_kyc) activationBits.push('completes KYC verification');
  if (qual.requires_funded_account) activationBits.push('funds their account');
  const activationSentence = `Your friend ${joinClauses(activationBits)}.`;
  const tradesTitle = `Minimum ${qual.required_trades} trade${qual.required_trades === 1 ? '' : 's'}`;
  const tradesBody = `Your friend places at least ${qual.required_trades} trade${qual.required_trades === 1 ? '' : 's'} after activation. The moment the ${ordinal(qual.required_trades)} trade closes, your bounty is paid instantly.`;

  return (
    <main>
      <PageHero
        kicker="Referral Program"
        title="Referral Program"
        lead="Share your link, earn instantly. Per-referral payouts that scale with your volume — paid the moment your friend qualifies."
        primary={{ label: 'Get Your Link', href: SIGNUP_HREF }}
        secondary={{ label: 'See Payouts', href: '#tiers' }}
      />

      {/* Intro */}
      <Section raised>
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">Instant Per-Referral Bounty</span>
            <h2 className="mk-h2">
              Refer. Activate. <span style={{ color: 'var(--mk-accent)' }}>Get Paid Instantly.</span>
            </h2>
            <p className="mk-lead">
              Every time a friend signs up with your link, activates their account, and places their first 3 trades,
              you receive a one-time referral bounty straight to your wallet. No waiting. No claw-back. The more
              referrals you bring, the higher the per-referral payout.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">Get Your Link</Link>
              <Link href="#tiers" className="mk-btn mk-btn--ghost">See Payouts</Link>
            </div>
          </div>
          {/* Reserved illustration area. The previous artwork came from the
              cloned site and was deleted with the rest of its images, so
              this holds the exact footprint until Bullza artwork exists. */}
          <div className="mk-media mk-media--ratio-3x2">
            Referral programme — 1120×740
          </div>
        </div>
      </Section>

      {/* Referral payout tiers */}
      <Section id="tiers">
        <SectionHeading
          kicker="Payouts"
          title="Referral Payouts"
          lead="Move up the ladder automatically as your active referrals grow — no manual upgrade."
        />

        <div className="overflow-x-auto mt-12">
          <div
            className="min-w-[560px] overflow-hidden"
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
                    Activation
                  </th>
                  {tiers.map((t, i) => {
                    const top = i === tiers.length - 1;
                    return (
                      <th
                        key={`${t.label}-${i}`}
                        className="px-5 py-4 text-center font-bold"
                        style={{
                          background: top ? 'var(--mk-accent)' : 'var(--mk-surface-2)',
                          color: top ? '#fff' : 'var(--mk-text)',
                          borderRight: i < tiers.length - 1 ? '1px solid var(--mk-line)' : undefined,
                          fontSize: 'var(--mk-text-sm)',
                          letterSpacing: 'var(--mk-tracking-label)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {t.range}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Reward row */}
                <tr style={{ borderTop: '1px solid var(--mk-line)' }}>
                  <td
                    className="px-5 py-4"
                    style={{
                      background: 'var(--mk-surface)',
                      borderRight: '1px solid var(--mk-line)',
                      fontSize: 'var(--mk-text-sm)',
                      color: 'var(--mk-text-muted)',
                    }}
                  >
                    Reward
                  </td>
                  {tiers.map((t, i) => {
                    const top = i === tiers.length - 1;
                    return (
                      <td
                        key={`perlot-${i}`}
                        className="px-5 py-4 text-center font-bold"
                        style={{
                          background: top ? 'var(--mk-accent-soft)' : 'var(--mk-bg-raised)',
                          color: top ? 'var(--mk-accent)' : 'var(--mk-text)',
                          borderRight: i < tiers.length - 1 ? '1px solid var(--mk-line)' : undefined,
                          fontSize: 'var(--mk-text-sm)',
                        }}
                      >
                        {t.perLot}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p
          className="mt-6 text-center mx-auto max-w-2xl"
          style={{ fontSize: 'var(--mk-text-xs)', lineHeight: 'var(--mk-leading-body)', color: 'var(--mk-text-faint)' }}
        >
          You earn the reward of the highest tier you reach. A tier unlocks once your activations
          cross its threshold. An activation = a referred client who completes KYC and at least 3 trades.
          Top partners can be set a custom rate.
        </p>
      </Section>

      {/* Terms & Conditions */}
      <Section raised>
        <SectionHeading
          kicker="Terms & Conditions"
          title="How a Referral Qualifies"
          lead="Two simple requirements — both must be met for a referral to count and trigger your payout."
        />
        <ol className="grid sm:grid-cols-2 gap-5 mt-12 mx-auto max-w-3xl">
          {[
            { n: '1', title: 'Activation of user',  body: activationSentence },
            { n: '2', title: tradesTitle,           body: tradesBody },
          ].map((t) => (
            <li key={t.n} className="mk-card mk-card--hover flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span
                  className="font-extrabold"
                  style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1 }}
                >
                  {t.n}
                </span>
                <CheckCircle2 size={20} style={{ color: 'var(--mk-accent)' }} aria-hidden />
              </div>
              <h3 className="mk-h3">{t.title}</h3>
              <p className="mk-body">{t.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Why refer */}
      <Section>
        <SectionHeading kicker="Benefits" title={`Why Refer Friends to ${BRAND_NAME}`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Zap,    title: 'Instant Payout',      body: 'No weekly batching, no holding period. The bounty hits your wallet the moment your referral completes 3 trades.' },
            { icon: Users,  title: 'No Cap on Referrals', body: 'Refer 5 or 5,000 friends — your per-referral payout only goes up as you grow.' },
            { icon: Wallet, title: 'Stacks With IB',      body: 'If you upgrade to the IB partner programme later, your existing referrals stay credited to you for life.' },
          ]}
        />
      </Section>

      {/* FAQ */}
      <Section raised id="faq">
        <SectionHeading kicker="Questions" title="FAQ" />
        <div className="mt-12 mx-auto max-w-3xl">
          <FaqAccordion
            items={[
              {
                q: 'How do I get my referral link?',
                a: <>Open a {BRAND_NAME} account, head to the Dashboard → Referrals tab, and your unique link is ready to copy and share. You can also generate QR codes and tracked landing pages from the same screen.</>,
              },
              {
                q: 'When do I get paid?',
                a: <>The moment your referred friend completes their 3rd trade after activation, the bounty for that referral is paid instantly to your {BRAND_NAME} wallet. You can withdraw it immediately or use it as trading equity.</>,
              },
              {
                q: 'What counts as an active referral for the tier ladder?',
                a: <>Any referral that has cleared both T&amp;C conditions (activated account + minimum 3 trades). Once you have 21+ active referrals, every subsequent referral pays $7 instead of $5. At 100+ actives, the per-referral payout jumps to $10.</>,
              },
              {
                q: "What's the difference between Referral and IB?",
                a: <>Referral pays a one-time bounty per qualifying friend. IB (Introducing Broker) pays a recurring per-lot commission on every trade your network places, for life. You can run both side-by-side.</>,
              },
            ]}
          />
        </div>
      </Section>

      <CtaBanner
        title="Start Earning From Day One"
        lead={`Open a ${BRAND_NAME} account, grab your referral link, and share it with one friend today. Their first $5 bounty could land in your wallet by the end of the week.`}
        primary={{ label: 'Open Account', href: SIGNUP_HREF }}
      />
    </main>
  );
}
