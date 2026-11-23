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
  { step: '01', title: 'Open an Account', desc: `Register and fund your ${BRAND_NAME} trading account.` },
  { step: '02', title: 'Browse Traders',  desc: 'Explore the leaderboard and filter by performance, risk, and strategy.' },
  { step: '03', title: 'Allocate & Copy', desc: 'Set your investment amount and start copying trades automatically.' },
  { step: '04', title: 'Monitor & Adjust', desc: 'Track performance in real time. Pause, stop, or switch traders anytime.' },
];

const WHY_POINTS = [
  'No hidden fees on copy trading',
  'Transparent trader statistics',
  'Full control over risk settings',
  'Real-time trade replication',
  'Works on all account types',
  'Withdraw anytime — no lock-in',
];

export default function CopyTradingPage() {
  return (
    <main>
      <PageHero
        kicker="Platforms"
        title="Copy Trading"
        lead="Follow expert traders and automatically replicate their strategies. No experience needed — let the professionals trade for you."
        primary={{ label: 'Start Copying', href: '/accounts/standard' }}
        secondary={{ label: 'Try on Demo', href: '/accounts/demo' }}
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
            { icon: Users,      title: 'Follow Top Traders',         body: 'Browse verified traders ranked by performance, risk score, and consistency. Choose who to follow with full transparency.' },
            { icon: Copy,       title: 'Auto-Copy Trades',           body: 'Automatically replicate trades from expert traders in real time. Every position they open or close is mirrored in your account.' },
            { icon: Shield,     title: 'Risk Controls',              body: 'Set maximum drawdown limits, stop-loss per trade, and daily loss caps. Stay in control even while copying others.' },
            { icon: BarChart2,  title: 'Performance Analytics',      body: 'Track detailed performance metrics including win rate, profit factor, average return, and risk-adjusted returns.' },
            { icon: Settings,   title: 'Custom Allocation',          body: 'Choose how much capital to allocate per trader. Scale up or down anytime without interrupting active copies.' },
            { icon: TrendingUp, title: 'Become a Signal Provider',   body: 'Share your strategy and earn commissions when others copy your trades. Build your reputation on the leaderboard.' },
          ]}
        />
      </Section>

      <Section raised>
        <div className="mk-card">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="flex flex-col gap-4">
              <h2 className="mk-h2">Why Copy Trade with {BRAND_NAME}?</h2>
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
                Browse verified signal providers, filter by strategy and risk, and start copying in a
                single click.
              </p>
              <Link href="/accounts/standard" className="mk-btn mk-btn--primary">Get Started</Link>
            </div>
          </div>
        </div>
      </Section>

      <CtaBanner
        title="Start Copying Today"
        lead="Follow expert traders and automatically replicate their strategies — no experience needed."
        primary={{ label: 'Start Copying', href: '/accounts/standard' }}
        secondary={{ label: 'Try on Demo', href: '/accounts/demo' }}
      />
    </main>
  );
}
