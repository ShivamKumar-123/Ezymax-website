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

const SIGNUP_HREF = '/company/contact';

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
        kicker="Referral Module"
        title="Referral & Loyalty, Built In"
        lead="A configurable referral and loyalty module ships with the platform — so your brokerage can reward clients for bringing in new traders, with per-referral bounties that pay out automatically when your rules are met."
        primary={{ label: 'Book a demo', href: SIGNUP_HREF }}
        secondary={{ label: 'See how payouts work', href: '#tiers' }}
      />

      {/* Intro */}
      <Section raised>
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">Automated Per-Referral Bounties</span>
            <h2 className="mk-h2">
              Refer. Activate. <span style={{ color: 'var(--mk-accent)' }}>Rewarded automatically.</span>
            </h2>
            <p className="mk-lead">
              When a referred client signs up, activates, and meets the trade threshold you set, the module credits
              a one-time bounty to the referring client automatically. You define the rules, the tiers, and the
              payout — the platform handles the rest.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">Book a demo</Link>
              <Link href="#tiers" className="mk-btn mk-btn--ghost">See how payouts work</Link>
            </div>
          </div>
          {/* Reserved illustration area. The previous artwork came from the
              cloned site and was deleted with the rest of its images, so
              this holds the exact footprint until SwissCresta artwork exists. */}
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
          lead="Reward your most active referrers with higher bounties. The module moves clients up the ladder automatically as their active referrals grow — the example figures below are yours to configure."
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
          Each referrer earns the reward of the highest tier they reach; a tier unlocks once their
          activations cross its threshold. An activation is a referred client who completes the
          qualification you configure — for example KYC plus a minimum number of trades.
          Top referrers can be set a custom rate.
        </p>
      </Section>

      {/* Terms & Conditions */}
      <Section raised>
        <SectionHeading
          kicker="Terms & Conditions"
          title="How a Referral Qualifies"
          lead="Qualification is fully configurable. In this example, two conditions must be met before a referral counts and a bounty is released."
        />
        <ol className="grid sm:grid-cols-2 gap-5 mt-12 mx-auto max-w-3xl">
          {[
            { n: '1', title: 'Referral activation',  body: activationSentence },
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
        <SectionHeading kicker="Benefits" title={`What the ${BRAND_NAME} Referral Module Gives You`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Zap,    title: 'Automated Payouts',   body: 'No manual batching. Bounties are credited automatically the moment a referral meets the trade threshold you set.' },
            { icon: Users,  title: 'No Referral Caps',    body: 'Whether a client refers five people or five thousand, the module scales — the per-referral payout only grows with volume.' },
            { icon: Wallet, title: 'Works Alongside IB',  body: 'Runs side by side with the IB module, so referrals stay credited even when a client graduates to a full introducing-broker role.' },
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
                q: 'How do clients get their referral link?',
                a: <>Once the module is enabled, each client finds a unique link in their dashboard under the Referrals tab, ready to copy and share. They can also generate QR codes and tracked landing pages from the same screen.</>,
              },
              {
                q: 'When are bounties paid out?',
                a: <>As soon as a referred client meets the qualification you configure — for example completing a set number of trades — the module credits the bounty automatically to the referrer&apos;s balance.</>,
              },
              {
                q: 'What counts as an active referral for the tier ladder?',
                a: <>Any referral that clears the conditions you set — for example an activated account plus a minimum number of trades. Thresholds and rewards are configurable; in the example ladder, crossing 21+ actives lifts the per-referral payout to $7, and 100+ takes it to $10.</>,
              },
              {
                q: "What's the difference between the Referral and IB modules?",
                a: <>The referral module pays a one-time bounty per qualifying client. The IB module pays a recurring per-lot commission on every trade a partner&apos;s network places. Both ship with the platform and can run side by side.</>,
              },
            ]}
          />
        </div>
      </Section>

      <CtaBanner
        title="See the Referral Module in Action"
        lead="Book a demo and we'll show you how to configure tiers, set qualification rules, and automate bounty payouts on your platform."
        primary={{ label: 'Book a demo', href: SIGNUP_HREF }}
      />
    </main>
  );
}
