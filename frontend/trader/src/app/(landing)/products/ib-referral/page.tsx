'use client';

import Link from 'next/link';
import {
  Users, BarChart3, Wallet, Zap, Headphones, Award, Layers, Share2,
  Crown, Gem, Sparkles,
} from 'lucide-react';
import {
  Section, SectionHeading, PageHero, FeatureGrid, CtaBanner, FaqAccordion,
} from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Products → IB Referral. Restyled onto the shared marketing design system;
 * all copy, tier data and links carried over from the previous page.
 */

/**
 * IB Account Type tier grid — per the client spec sheet delivered 2026-06.
 * Was briefly hosted on the Insurance page; moved here where it belongs.
 * Each tier is gated by an "active traders" threshold and carries a
 * per-lot commission + tier reward "amount". Platinum is the entry
 * point for the custom-deal program (up to $15 / lot) called out in
 * the callout below the grid.
 */
const IB_TIERS = [
  { tier: 'Bronze',   traders: '+5',   commission: '$5',  amount: '$500',    tone: '#cd7f32', Icon: Award },
  { tier: 'Silver',   traders: '+20',  commission: '$7',  amount: '$5,000',  tone: '#c0c0c0', Icon: Award },
  { tier: 'Gold',     traders: '+50',  commission: '$10', amount: '$20,000', tone: '#e8b923', Icon: Crown, featured: true },
  { tier: 'Platinum', traders: '+100', commission: '$12', amount: '$50,000', tone: '#e5e4e2', Icon: Gem },
];

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        style={{
          fontSize: 'var(--mk-text-label)',
          letterSpacing: 'var(--mk-tracking-label)',
          textTransform: 'uppercase',
          color: 'var(--mk-text-faint)',
        }}
      >
        {label}
      </span>
      <span className="font-bold tabular-nums" style={{ color: accent || 'var(--mk-text)' }}>
        {value}
      </span>
    </div>
  );
}

export default function IbReferralPage() {
  return (
    <main>
      <PageHero
        kicker="Partners"
        title="Become an Introducing Broker"
        lead={`Refer traders to ${BRAND_NAME} and earn lifetime per-lot commissions — up to $15 per standard lot, paid instantly.`}
        primary={{ label: 'Apply Now', href: '/auth/register' }}
        secondary={{ label: 'See Tiers', href: '#tiers' }}
      />

      {/* How it works */}
      <Section raised id="how-it-works">
        <SectionHeading
          kicker="How It Works"
          title={<>Three steps. <span style={{ color: 'var(--mk-accent)' }}>Lifetime commissions.</span></>}
        />
        <ol className="grid sm:grid-cols-3 gap-5 mt-12" aria-label="How the IB program works">
          {[
            { n: '01', icon: Users,  title: 'Apply & Get Approved', body: 'Submit the IB application. Our partner team reviews and activates your account, typically within 24 hours.' },
            { n: '02', icon: Share2, title: 'Share Your Link',      body: 'Use your unique referral link, banner kit, or QR code. Every signup is automatically tagged to you for life.' },
            { n: '03', icon: Wallet, title: 'Earn on Every Lot',    body: 'Get paid on every standard lot your referrals trade — across forex, crypto, indices, and commodities.' },
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

      {/* IB Account Tiers — moved here from /products/insurance per client. */}
      <Section id="tiers">
        <SectionHeading
          kicker="IB Account Tiers"
          title={<>Bronze. Silver. <span style={{ color: 'var(--mk-accent)' }}>Gold.</span> Platinum.</>}
          lead={
            <>
              Per-lot commission scales with the number of active traders you bring on.
              Move up automatically — no manual upgrade. Top earners qualify for custom
              deals up to <span style={{ color: 'var(--mk-accent)', fontWeight: 700 }}>$15 per lot</span>.
            </>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {IB_TIERS.map(({ tier, traders, commission, amount, tone, Icon, featured }) => (
            <div key={tier} className={`relative ${featured ? 'mt-3 lg:mt-0' : ''}`}>
              {featured && (
                <div
                  className="absolute -top-3 right-6 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold uppercase whitespace-nowrap"
                  style={{ background: tone, color: '#0a0a0a', fontSize: '10px', letterSpacing: '0.12em' }}
                >
                  <Sparkles size={12} /> Most Popular
                </div>
              )}
              <article
                className="mk-card mk-card--hover flex flex-col h-full gap-3"
                style={{ borderColor: `${tone}55` }}
              >
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                  style={{ background: `${tone}22`, border: `1px solid ${tone}55`, color: tone }}
                >
                  <Icon size={20} />
                </span>

                <div>
                  <h3 className="mk-h3" style={{ color: tone }}>{tier}</h3>
                  <div
                    style={{
                      fontSize: 'var(--mk-text-label)',
                      letterSpacing: 'var(--mk-tracking-label)',
                      textTransform: 'uppercase',
                      color: 'var(--mk-text-faint)',
                    }}
                  >
                    IB Account Type
                  </div>
                </div>

                <div
                  className="flex flex-col gap-3 flex-1 pt-4 mt-1"
                  style={{ borderTop: '1px solid var(--mk-line)' }}
                >
                  <StatRow label="Active Traders"       value={traders} />
                  <StatRow label="Commission (per lot)" value={commission} accent={tone} />
                  <StatRow label="Amount"               value={amount} />
                </div>

                <Link
                  href="/auth/register"
                  className="mk-btn mt-4"
                  style={{ background: tone, color: '#0a0a0a' }}
                >
                  Apply for IB
                </Link>
              </article>
            </div>
          ))}
        </div>

        {/* Top custom-deals callout */}
        <div
          className="mt-8 mx-auto max-w-3xl flex items-start gap-4"
          style={{
            background: 'var(--mk-accent-soft)',
            border: '1px solid var(--mk-accent-line)',
            borderRadius: 'var(--mk-radius)',
            padding: 'var(--mk-space-5)',
          }}
        >
          <Sparkles size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--mk-accent)' }} />
          <p className="mk-body" style={{ color: 'var(--mk-text)' }}>
            <span style={{ color: 'var(--mk-accent)', fontWeight: 700 }}>Top custom deals up to $15 per lot.</span>{' '}
            Partners with consistent volume above the Platinum threshold can negotiate
            bespoke commission, marketing budget, and bonus structures with our partner team.
          </p>
        </div>

        <p
          className="mt-6 text-center mx-auto max-w-2xl"
          style={{ fontSize: 'var(--mk-text-xs)', lineHeight: 'var(--mk-leading-body)', color: 'var(--mk-text-faint)' }}
        >
          Tier qualification is reviewed monthly based on the active-trader count maintained
          across the prior 30 days. Commissions settle instantly to your IB wallet.
        </p>
      </Section>

      {/* Benefits grid */}
      <Section raised id="benefits">
        <SectionHeading kicker="Benefits" title={`Why Partner With ${BRAND_NAME}`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Wallet,     title: 'High Per-Lot Payouts', body: 'Up to $15 per standard lot — among the highest in the industry. No volume claw-back.' },
            { icon: Layers,     title: 'Multi-Tier Earnings',  body: 'Earn from your direct referrals AND from IBs you bring in. Build a network, not a sales job.' },
            { icon: Zap,        title: 'Instant Payouts',      body: 'Commissions hit your wallet the moment your referral closes a lot — no Monday queue, no holding period.' },
            { icon: BarChart3,  title: 'Real-Time Dashboard',  body: 'Live earnings, trader activity, conversion funnel, lot volume — all in one panel.' },
            { icon: Headphones, title: 'Dedicated Manager',    body: 'Gold + Platinum partners get a named account manager and direct WhatsApp support.' },
            { icon: Award,      title: 'Marketing Kit',        body: 'Banners, landing pages, video assets, and email copy in 12 languages — ready to deploy.' },
            { icon: Users,      title: 'No Cap on Referrals',  body: 'Refer 5 traders or 50,000 — your commission per lot only goes up as you grow.' },
          ]}
        />
      </Section>

      {/* Apply form removed per client request — IB application now
          handled via the /auth/register flow + partner outreach by email. */}

      {/* Testimonials */}
      <Section id="testimonials">
        <SectionHeading kicker="Partners" title="What our partners say" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {[
            { name: 'Karan A.', region: 'India',   quote: 'The dashboard is exactly what I needed — I see every lot my network trades, payouts hit on Monday like clockwork.' },
            { name: 'Maria L.', region: 'Spain',   quote: 'The co-branded marketing kit saved me weeks. Conversion from my Telegram group jumped 3x within a month.' },
            { name: 'Tunde O.', region: 'Nigeria', quote: 'Multi-tier is what changed it for me. I bring in IBs, they bring in traders, and I earn from the whole tree.' },
          ].map((t) => (
            <article key={t.name} className="mk-card mk-card--hover flex flex-col gap-4">
              {/* Real partner-style photo via pravatar.cc. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.pravatar.cc/120?u=partner-${t.name.toLowerCase().replace(/\W+/g, '-')}`}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
                aria-hidden
                style={{ border: '1px solid var(--mk-accent-line)' }}
              />
              <p className="mk-body italic" style={{ color: 'var(--mk-text)' }}>&ldquo;{t.quote}&rdquo;</p>
              <div className="pt-4 mt-auto" style={{ borderTop: '1px solid var(--mk-line)' }}>
                <div className="font-bold" style={{ fontSize: 'var(--mk-text-sm)' }}>{t.name}</div>
                <div style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>{t.region}</div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section raised id="faq">
        <SectionHeading kicker="Questions" title="FAQ" />
        <div className="mt-12 mx-auto max-w-3xl">
          <FaqAccordion
            items={[
              {
                q: 'Do I need a trading account to become an IB?',
                a: <>Yes. You need a {BRAND_NAME} account to join the IB program — that&apos;s how your unique referral link, commissions, and payouts are tied to you. Opening the account is free and you don&apos;t have to place a trade; we still recommend funding a small demo so you understand the product you are recommending.</>,
              },
              {
                q: 'When are commissions paid?',
                a: <>Commissions are paid instantly — the moment your referral closes a lot, the rebate hits your wallet. Payouts go to your preferred method — crypto, bank wire, or local rails.</>,
              },
              {
                q: 'Can my referrals trade any product?',
                a: <>Yes. You earn rebates on every lot your referrals trade across forex, metals, energies, indices, and crypto.</>,
              },
              {
                q: 'What happens if my referral closes their account?',
                a: <>Your reattribution is permanent. If the same person re-opens an account later under your link, you continue to earn.</>,
              },
            ]}
          />
        </div>
      </Section>

      <CtaBanner
        title="Start Earning This Week"
        lead="Apply now, get approved within 24 hours, and share your first referral link today."
        primary={{ label: 'Apply Now', href: '/auth/register' }}
      />
    </main>
  );
}
