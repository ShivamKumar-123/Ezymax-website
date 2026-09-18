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
        kicker="Partner Management"
        title="IB & Partner Management, Built In"
        lead={`A full introducing-broker and partner-management module ships with the ${BRAND_NAME} platform — so your brokerage can run its own IB program, set per-lot commissions, and pay partners automatically.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'See how tiers work', href: '#tiers' }}
      />

      {/* How it works */}
      <Section raised id="how-it-works">
        <SectionHeading
          kicker="How It Works"
          title={<>Three steps. <span style={{ color: 'var(--mk-accent)' }}>Your IB program, live.</span></>}
        />
        <ol className="grid sm:grid-cols-3 gap-5 mt-12" aria-label="How the IB program works">
          {[
            { n: '01', icon: Users,  title: 'Configure Your Tiers', body: 'Set commission rates, qualification thresholds, and tier rewards from the admin back office — no code, live in minutes.' },
            { n: '02', icon: Share2, title: 'Onboard Partners',     body: 'Your partners get unique referral links, banner kits, and QR codes. Every signup is automatically attributed to the right partner.' },
            { n: '03', icon: Wallet, title: 'Pay Automatically',    body: 'The module tracks every lot traded by the clients your partners refer — across the asset classes your platform offers — and settles commissions automatically.' },
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
          kicker="Commission Tiers"
          title={<>Bronze. Silver. <span style={{ color: 'var(--mk-accent)' }}>Gold.</span> Platinum.</>}
          lead={
            <>
              Set per-lot commission tiers that scale with each partner&apos;s active-trader count.
              Partners move up automatically — no manual upgrade. Top partners can unlock custom
              deals up to <span style={{ color: 'var(--mk-accent)', fontWeight: 700 }}>$15 per lot</span>.
              The figures below are an example ladder — you configure your own.
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
                    Commission Tier
                  </div>
                </div>

                <div
                  className="flex flex-col gap-3 flex-1 pt-4 mt-1"
                  style={{ borderTop: '1px solid var(--mk-line)' }}
                >
                  <StatRow label="Active Traders"       value={traders} />
                  <StatRow label="Commission (per lot)" value={commission} accent={tone} />
                  <StatRow label="Tier Reward"          value={amount} />
                </div>

                <Link
                  href="/company/contact"
                  className="mk-btn mt-4"
                  style={{ background: tone, color: '#0a0a0a' }}
                >
                  Book a demo
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
            <span style={{ color: 'var(--mk-accent)', fontWeight: 700 }}>Custom deals up to $15 per lot.</span>{' '}
            The module lets you offer your top partners — those with consistent volume above your
            highest tier — bespoke commission, marketing budgets, and bonus structures.
          </p>
        </div>

        <p
          className="mt-6 text-center mx-auto max-w-2xl"
          style={{ fontSize: 'var(--mk-text-xs)', lineHeight: 'var(--mk-leading-body)', color: 'var(--mk-text-faint)' }}
        >
          Tier qualification, review windows, and payout timing are all configurable in the module.
          Commissions can settle automatically to each partner&apos;s balance.
        </p>
      </Section>

      {/* Benefits grid */}
      <Section raised id="benefits">
        <SectionHeading kicker="Benefits" title={`What the ${BRAND_NAME} IB Module Gives You`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Wallet,     title: 'Flexible Payout Rules', body: 'Configure per-lot rates, caps, and claw-back rules to fit your commercial model — no hard-coded limits.' },
            { icon: Layers,     title: 'Multi-Tier Partner Trees', body: 'Support sub-IB structures out of the box — partners earn from their own referrals and from the IBs they introduce.' },
            { icon: Zap,        title: 'Automated Settlement', body: 'Commissions are calculated and credited automatically the moment a qualifying lot closes — no manual reconciliation.' },
            { icon: BarChart3,  title: 'Real-Time Dashboards', body: 'Give partners live earnings, trader activity, conversion funnels, and lot volume in one panel.' },
            { icon: Headphones, title: 'Account-Manager Tools', body: 'Assign named account managers to your top partner tiers and route their requests through the built-in support workflow.' },
            { icon: Award,      title: 'Marketing Kit',        body: 'Ships with banners, landing pages, and co-branded assets your partners can deploy in multiple languages.' },
            { icon: Users,      title: 'No Referral Caps',     body: 'Whether a partner brings five clients or fifty thousand, the module scales — commissions only grow with volume.' },
          ]}
        />
      </Section>

      {/* Apply form removed per client request — IB application now
          handled via the /auth/register flow + partner outreach by email. */}

      {/* Testimonials */}
      <Section id="testimonials">
        <SectionHeading kicker="Operators" title="What operators say" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {[
            { name: 'Karan A.', region: 'India',   quote: 'We launched our IB program on the platform in days. Partners get their own dashboards and payouts run automatically — no more spreadsheets.' },
            { name: 'Maria L.', region: 'Spain',   quote: 'The co-branded marketing kit saved our partner team weeks of design work, and everything ships under our own brand.' },
            { name: 'Tunde O.', region: 'Nigeria', quote: 'Multi-tier partner trees were the deciding feature for us — our top IBs build and earn from their own networks inside our platform.' },
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
                q: 'Is the IB module included with the platform?',
                a: <>Yes. Introducing-broker and partner management ship with the {BRAND_NAME} platform — you configure commission rates, tiers, and payout rules from the admin back office. There is nothing extra to install.</>,
              },
              {
                q: 'How are commissions paid out?',
                a: <>You decide. The module can settle commissions automatically the moment a qualifying lot closes, or on a schedule you set, to each partner&apos;s balance.</>,
              },
              {
                q: 'Which asset classes does it track?',
                a: <>Any the platform offers. Commissions can be tracked on every lot across the asset classes you enable — forex, metals, energies, indices, and crypto.</>,
              },
              {
                q: 'How is partner attribution handled?',
                a: <>Attribution is persistent. Each client stays linked to the partner who introduced them, and the module keeps that link intact across the client&apos;s lifecycle.</>,
              },
            ]}
          />
        </div>
      </Section>

      <CtaBanner
        title="See the IB Module in Action"
        lead="Book a demo and we'll walk you through configuring tiers, onboarding partners, and automating payouts on your platform."
        primary={{ label: 'Book a demo', href: '/company/contact' }}
      />
    </main>
  );
}
