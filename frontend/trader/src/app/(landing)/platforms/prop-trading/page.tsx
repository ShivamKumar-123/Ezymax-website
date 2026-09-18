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
        title={<>Prop Trading <span style={{ color: 'var(--mk-accent)' }}>Module</span></>}
        lead={
          <>
            Run funded-trader challenges under your brand. Our prop-trading module handles
            evaluations, risk rules, profit splits, and scaling. The {BRAND_NAME} Prop module is
            launching in{' '}
            <span style={{ color: 'var(--mk-accent)', fontWeight: 700 }}>Q3 2026</span>. Join the
            early-access list to be the first to add it to your platform.
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
          title="What the Module Delivers"
          lead="A modern evaluation engine, configurable rules, and flexible profit splits you control."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Target,      title: 'Configurable Profit Targets', body: 'Set achievable profit targets without aggressive deadlines or hidden disqualification rules.' },
            { icon: ShieldCheck, title: 'Transparent Risk Rules',    body: 'Clear daily and total drawdown limits — every rule visible on the trader dashboard at all times.' },
            { icon: TrendingUp,  title: 'Flexible Profit Splits',    body: 'Set the profit split traders keep on funded accounts, with automated payout scheduling.' },
            { icon: Award,       title: 'Scaling Plans',             body: 'Built-in scaling lets consistent traders grow their funded capital on the terms you define.' },
            { icon: Layers,      title: 'Optional Evaluation Clocks', body: 'Offer funded traders no time limits, or set your own — the rules are yours to configure.' },
            { icon: Bell,        title: 'Early Access',              body: 'Operators on the launch list get first access to the module and preferred onboarding terms.' },
          ]}
        />
      </Section>

      <CtaBanner
        title="Be First in Line"
        lead={`Join the early-access list and be first to add a white-label prop-trading module to your ${BRAND_NAME} platform when it goes live.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
      />
    </main>
  );
}
