'use client';

/**
 * Public marketing page — How It Works.
 * Copy adapted from DETAILED_CONTENT_HOW_IT_WORKS_PAGE.docx (May 2026 client deck).
 * Restyled onto the shared marketing design system; every line of copy is
 * carried over from the previous version of this page.
 */
import { Wallet, ShieldCheck, Cpu, Check, Zap, Headphones, Users, Target, BarChart3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const STEPS = [
  { eyebrow: 'Step', title: 'Connect Wallet', body: 'Securely connect your wallet to access the platform.' },
  { eyebrow: 'Step', title: 'Access Your Dashboard', body: 'Manage your profile, settings, and activity through your CRM.' },
  { eyebrow: 'Step', title: 'Create Trading Account', body: `Choose ${BRAND_NAME} native or an external integration.` },
  { eyebrow: 'Step', title: 'Allocate Funds to Contract', body: 'Funds move into a secure smart contract layer, not a broker.' },
  { eyebrow: 'Step', title: 'Execute Trades', body: 'Trade normally using your selected account.' },
  { eyebrow: 'Step', title: 'Automatic P&L Settlement', body: 'Profits credit, losses deduct — automatically.' },
  { eyebrow: 'Step', title: 'Withdraw Anytime', body: 'Funds settle directly back to your wallet.' },
];

const COMPARE: Array<[string, string, string]> = [
  ['Fund Custody', 'Smart Contract Layer', 'Broker Holds Funds'],
  ['Withdrawals', 'System-Based', 'Approval-Based'],
  ['Execution', 'Automated Logic', 'Broker-Controlled'],
  ['Transparency', 'Structured Flow', 'Limited Visibility'],
  ['User Control', 'High', 'Limited'],
];

const WHY: Array<{ icon: LucideIcon; title: string; sub: string }> = [
  { icon: Zap,        title: 'Deep Liquidity, Fast Execution',   sub: 'sub-millisecond order fills' },
  { icon: Headphones, title: '24/7 Dedicated Support',           sub: 'live chat, phone & e-mail' },
  { icon: Users,      title: 'Copy Successful Traders',          sub: 'with our Social Trading products' },
  { icon: Target,     title: 'Raw, Institutional-Grade Spreads', sub: 'from 0.0 pips' },
  { icon: BarChart3,  title: 'Advanced Order Types',             sub: 'limit, stop-limit, one-click trading' },
];

export default function HowItWorksPage() {
  return (
    <main>
      <PageHero
        kicker={`How ${BRAND_NAME} Works`}
        title={<>Not a Broker.<br /><span style={{ color: 'var(--mk-accent)' }}>A Trading Protocol.</span></>}
        lead={`${BRAND_NAME} does not hold your funds. Your trades operate through a structured smart contract system. Execution is automated. Control stays with you.`}
        primary={{ label: 'See the Flow', href: '#flow' }}
        secondary={{ label: 'Start Trading', href: '/auth/register' }}
      />

      {/* Broker vs Protocol */}
      <Section raised>
        <SectionHeading
          align="left"
          kicker="The Difference"
          title={`Traditional Broker vs ${BRAND_NAME}`}
          lead={'We don’t hold your money. The system manages execution.'}
        />
        <div className="grid md:grid-cols-2 gap-5 mt-12">
          <ComparisonCard
            title="Traditional Brokers"
            tone="warn"
            items={[
              'Funds deposited into broker accounts',
              'Withdrawal depends on approvals',
              'Execution lacks transparency',
              'Manual intervention possible',
            ]}
          />
          <ComparisonCard
            title={`${BRAND_NAME} Protocol`}
            tone="ok"
            items={[
              'Funds interact with smart contract layer',
              'No custody held by platform',
              'Trades execute via system logic',
              'Automatic P&L settlement',
            ]}
          />
        </div>
      </Section>

      {/* 7-step flow */}
      <Section id="flow">
        <SectionHeading
          align="left"
          kicker="The Flow"
          title="From Wallet to Trade — Step by Step"
          lead="Every step is system-driven. No manual control involved."
        />
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-12">
          {STEPS.map((s, i) => (
            <li key={s.title} className="mk-card mk-card--hover flex flex-col gap-2">
              <div className="mk-kicker">
                <span style={{ fontFamily: 'var(--mk-font-mono)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span>{s.eyebrow}</span>
              </div>
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Security pillars */}
      <Section raised>
        <SectionHeading
          align="left"
          kicker="Principles"
          title="Built for Transparency and Control"
          lead="Designed to minimize trust dependency and maximize system-based execution."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Wallet, title: 'No Custody', body: 'Funds never sit in a broker account. They interact with the contract layer only when you trade.' },
            { icon: Cpu, title: 'Automated Execution', body: 'Trades are settled by the system on outcome — no manual approvals, no withdrawal delays.' },
            { icon: ShieldCheck, title: 'Transparent Flow', body: 'Every step is observable: wallet → contract → engine → outcome → wallet.' },
          ]}
        />
      </Section>

      {/* Comparison table */}
      <Section>
        <SectionHeading align="left" kicker="Side by Side" title={`${BRAND_NAME} vs Traditional Brokers`} />
        <div
          className="mt-12 overflow-x-auto"
          style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius-lg)' }}
        >
          <table className="w-full min-w-[560px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Feature', BRAND_NAME, 'Traditional Broker'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-4"
                    style={{
                      background: 'var(--mk-surface)',
                      color: 'var(--mk-accent)',
                      fontSize: 'var(--mk-text-label)',
                      letterSpacing: 'var(--mk-tracking-label)',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r[0]} style={{ borderTop: '1px solid var(--mk-line)' }}>
                  <td className="px-5 py-4 font-semibold" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}>{r[0]}</td>
                  <td className="px-5 py-4" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' }}>{r[1]}</td>
                  <td className="px-5 py-4" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' }}>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Why Trade section */}
      <Section raised>
        <SectionHeading kicker="Why Us" title={`Why Trade with ${BRAND_NAME}?`} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {WHY.map(({ icon: Icon, title, sub }) => (
            <div key={title} className="mk-card mk-card--hover flex items-center gap-4">
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Icon size={22} />
              </span>
              <div className="min-w-0">
                <h3 className="mk-h3" style={{ fontSize: 'var(--mk-text-body)' }}>{title}</h3>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-faint)' }}>{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <CtaBanner
        title="Experience System-Driven Trading"
        lead="No custody. No hidden control. Just structured execution."
        primary={{ label: 'Start Trading', href: '/auth/register' }}
        secondary={{ label: 'Connect Wallet', href: '/auth/login' }}
      />
    </main>
  );
}

function ComparisonCard({
  title, items, tone,
}: { title: string; items: string[]; tone: 'ok' | 'warn' }) {
  const accent = tone === 'ok' ? 'var(--mk-up)' : 'var(--mk-down)';
  return (
    <div className="mk-card flex flex-col gap-4">
      <h3 className="mk-h3" style={{ color: accent }}>{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
            <Check size={15} className="mt-1 shrink-0" style={{ color: accent }} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
