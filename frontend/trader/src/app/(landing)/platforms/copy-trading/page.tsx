import Link from 'next/link';
import { Copy, Users, TrendingUp, Shield, BarChart2, Settings, Check } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Platforms → Copy Trading. Restyled onto the shared marketing design
 * system; copy carried over from the previous landing component and the
 * old react-router links replaced with real Next links.
 */

const STEPS = [
  { step: '01', title: 'Client Signs Up', desc: `Clients register on your branded ${BRAND_NAME} platform in minutes.` },
  { step: '02', title: 'Browse Traders',  desc: 'They explore the leaderboard and filter by performance, risk, and strategy.' },
  { step: '03', title: 'Allocate & Copy', desc: 'They set an allocation and start copying trades automatically.' },
  { step: '04', title: 'Monitor & Adjust', desc: 'They track performance in real time. Pause, stop, or switch traders anytime.' },
];

const WHY_POINTS = [
  'Configurable fees — you set the terms',
  'Transparent trader statistics',
  'Full risk-setting controls',
  'Real-time trade replication',
  'Works across all account tiers',
  'No lock-in — clients adjust anytime',
];

export default function CopyTradingPage() {
  return (
    <main>
      <PageHero
        kicker="Platforms"
        title="Copy Trading"
        lead="A copy-trading module we build into your platform. Your clients follow expert traders and automatically replicate their strategies — no experience needed."
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View platforms', href: '/platforms/web' }}
      />

      <Section raised>
        <SectionHeading kicker="How It Works" title="How It Works" lead="Get started in four simple steps." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {STEPS.map((s) => (
            <article key={s.step} className="mk-card mk-card--hover flex flex-col gap-3">
              <span
                className="font-extrabold"
                style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1 }}
              >
                {s.step}
              </span>
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body">{s.desc}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="Features" title="Features" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Users,      title: 'Follow Top Traders',         body: 'Clients browse verified traders ranked by performance, risk score, and consistency, and choose who to follow with full transparency.' },
            { icon: Copy,       title: 'Auto-Copy Trades',           body: 'Trades from expert traders replicate in real time. Every position they open or close is mirrored in the follower’s account.' },
            { icon: Shield,     title: 'Risk Controls',              body: 'Maximum drawdown limits, stop-loss per trade, and daily loss caps keep clients in control even while copying others.' },
            { icon: BarChart2,  title: 'Performance Analytics',      body: 'Detailed performance metrics including win rate, profit factor, average return, and risk-adjusted returns.' },
            { icon: Settings,   title: 'Custom Allocation',          body: 'Clients choose how much capital to allocate per trader and scale up or down anytime without interrupting active copies.' },
            { icon: TrendingUp, title: 'Signal Provider Program',    body: 'Let clients share strategies and earn commissions when others copy their trades, with built-in leaderboards and reputation.' },
          ]}
        />
      </Section>

      <Section raised>
        <div className="mk-card">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="flex flex-col gap-4">
              <h2 className="mk-h2">Why the {BRAND_NAME} Copy-Trading Module?</h2>
              <ul className="flex flex-col gap-2.5">
                {WHY_POINTS.map((item) => (
                  <li key={item} className="flex items-center gap-3 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                    <Check size={16} className="shrink-0" style={{ color: 'var(--mk-accent)' }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center flex flex-col items-center gap-5">
              <p className="mk-lead">
                Clients browse verified signal providers, filter by strategy and risk, and start
                copying in a single click.
              </p>
              <Link href="/company/contact" className="mk-btn mk-btn--primary">Book a demo</Link>
            </div>
          </div>
        </div>
      </Section>

      <CtaBanner
        title="Add Copy Trading to Your Platform"
        lead="Give your clients a copy-trading module that replicates expert strategies automatically — built and delivered under your brand."
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View platforms', href: '/platforms/web' }}
      />
    </main>
  );
}
