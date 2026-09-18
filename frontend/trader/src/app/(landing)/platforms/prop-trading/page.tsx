'use client';

import { Bell, ShieldCheck, Target, TrendingUp, Award, Layers } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Platforms → Prop Trading (coming soon). Restyled onto the shared
 * marketing design system. The early-access form keeps its original
 * submit behaviour and every line of copy is carried over.
 */

export default function PropTradingPage() {
  return (
    <main>
      <PageHero
        kicker="Coming Soon"
        title={<>Prop Trading <span style={{ color: 'var(--mk-accent)' }}>Program</span></>}
        lead={
          <>
            Prove your skills, get funded, and trade with our capital — keep up to 90% of the profits with
            zero personal risk. The {BRAND_NAME} Prop Program is launching in{' '}
            <span style={{ color: 'var(--mk-accent)', fontWeight: 700 }}>Q3 2026</span>. Join the
            early-access list to be the first to take the challenge.
          </>
        }
      >
        <form
          className="w-full max-w-xl mt-4"
          onSubmit={(e) => { e.preventDefault(); alert('You are on the early-access list.'); }}
        >
          <div
            className="flex items-center gap-2"
            style={{
              background: 'var(--mk-surface)',
              border: '1px solid var(--mk-line)',
              borderRadius: 'var(--mk-radius-pill)',
              padding: '0.35rem',
            }}
          >
            <input
              type="email"
              required
              placeholder="you@email.com"
              aria-label="Email address for Prop Program launch notification"
              className="flex-1 min-w-0 bg-transparent px-4 py-2 outline-none"
              style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}
            />
            <button type="submit" className="mk-btn mk-btn--primary shrink-0">
              Notify Me <Bell size={16} />
            </button>
          </div>
          <p className="mt-3" style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>
            One email at launch. Unsubscribe in one click.
          </p>
        </form>
      </PageHero>

      {/* What to expect */}
      <Section raised>
        <SectionHeading
          kicker="At Launch"
          title="What to Expect at Launch"
          lead="A modern evaluation, fair rules, and an industry-leading 90% profit split when you get funded."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Target,      title: 'Realistic Profit Targets',  body: 'Reach achievable profit targets without aggressive deadlines or hidden disqualification rules.' },
            { icon: ShieldCheck, title: 'Transparent Risk Rules',    body: 'Clear daily and total drawdown limits — every rule visible on your dashboard at all times.' },
            { icon: TrendingUp,  title: 'Up to 90% Profit Split',    body: 'Keep up to 90% of the profits you generate on your funded account. Withdraw weekly.' },
            { icon: Award,       title: 'Scaling Plan',              body: 'Consistently profitable traders can scale their account up to $500,000 in funded capital.' },
            { icon: Layers,      title: 'No Time Pressure (Funded)', body: 'Once funded there is no evaluation clock. Trade at your own pace, your own way.' },
            { icon: Bell,        title: 'Early-Access Pricing',      body: 'Subscribers on the launch list receive a discounted challenge fee for the first 30 days.' },
          ]}
        />
      </Section>

      <CtaBanner
        title="Be First in Line"
        lead={`Open a ${BRAND_NAME} account today — your trading history counts toward your early-access tier when the Prop Program goes live.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
      />
    </main>
  );
}
