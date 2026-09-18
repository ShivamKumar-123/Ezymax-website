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
  { eyebrow: 'Step', title: 'Book a Demo', body: 'See the platform and tell us what your brokerage needs.' },
  { eyebrow: 'Step', title: 'Scope & Plan', body: 'We agree modules, integrations, branding and a launch timeline.' },
  { eyebrow: 'Step', title: 'Brand & Configure', body: `Your logo, domain and colours across web, mobile and desktop.` },
  { eyebrow: 'Step', title: 'Wire Integrations', body: 'Payments, KYC/AML, liquidity and CRM connected to your setup.' },
  { eyebrow: 'Step', title: 'Test & Review', body: 'You review the platform end to end before anything goes live.' },
  { eyebrow: 'Step', title: 'Go Live', body: 'We launch on your domain, under your brand — typically in weeks.' },
  { eyebrow: 'Step', title: 'Ongoing Support', body: 'The same team keeps the platform running and evolving after launch.' },
];

const COMPARE: Array<[string, string, string]> = [
  ['Branding', 'Fully white-label', 'Their brand, not yours'],
  ['Delivery', 'Live in weeks', 'Months of integration'],
  ['Codebase', 'Built in-house', 'Resold template'],
  ['Back Office', 'CRM, risk & reporting', 'Bolt-on add-ons'],
  ['Support', 'From the build team', 'Ticket queue'],
];

const WHY: Array<{ icon: LucideIcon; title: string; sub: string }> = [
  { icon: Zap,        title: 'Fast, Reliable Engine',   sub: 'built to stay responsive under load' },
  { icon: Headphones, title: 'Support After Launch',    sub: 'live chat, phone & e-mail' },
  { icon: Users,      title: 'Copy & Social Trading',   sub: 'built into the platform you launch' },
  { icon: Target,     title: 'Multi-Asset Ready',       sub: 'forex, CFDs, crypto and more' },
  { icon: BarChart3,  title: 'Advanced Order Types',    sub: 'limit, stop-limit, one-click trading' },
];

export default function HowItWorksPage() {
  return (
    <main>
      <PageHero
        kicker={`How ${BRAND_NAME} Works`}
        title={<>Your Brand.<br /><span style={{ color: 'var(--mk-accent)' }}>Our Engine.</span></>}
        lead={`${BRAND_NAME} builds white-label trading platforms for brokers and prop firms. Your brand, your domain, our engine — typically live in weeks.`}
        primary={{ label: 'See the Process', href: '#flow' }}
        secondary={{ label: 'Book a demo', href: '/company/contact' }}
      />

      {/* Broker vs Protocol */}
      <Section raised>
        <SectionHeading
          align="left"
          kicker="The Difference"
          title={`Off-the-Shelf vs ${BRAND_NAME}`}
          lead={'You bring the licence and the clients. We bring the platform.'}
        />
        <div className="grid md:grid-cols-2 gap-5 mt-12">
          <ComparisonCard
            title="Off-the-Shelf Platforms"
            tone="warn"
            items={[
              'Generic template under a vendor’s brand',
              'Slow, costly integration work',
              'Limited control over the roadmap',
              'Support through a ticket queue',
            ]}
          />
          <ComparisonCard
            title={`The ${BRAND_NAME} Platform`}
            tone="ok"
            items={[
              'Your brand, your domain, end to end',
              'Built in-house since 2010',
              'Web, mobile, desktop and back office',
              'Typically live in weeks',
            ]}
          />
        </div>
      </Section>

      {/* 7-step flow */}
      <Section id="flow">
        <SectionHeading
          align="left"
          kicker="The Flow"
          title="From Demo to Launch — Step by Step"
          lead="A clear path from first demo to a platform live under your brand."
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
          title="Built In-House, Delivered White-Label"
          lead="Engineered by our own team and shipped under your brand."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Wallet, title: 'Your Brand', body: 'Your logo, domain and design across every screen — web, mobile and desktop.' },
            { icon: Cpu, title: 'One Engine', body: 'A single platform powering the trading terminals, admin back office and integrations.' },
            { icon: ShieldCheck, title: 'Supported After Launch', body: 'The team that builds your platform keeps it running and secure after go-live.' },
          ]}
        />
      </Section>

      {/* Comparison table */}
      <Section>
        <SectionHeading align="left" kicker="Side by Side" title={`${BRAND_NAME} vs Off-the-Shelf`} />
        <div
          className="mt-12 overflow-x-auto"
          style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius-lg)' }}
        >
          <table className="w-full min-w-[560px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Feature', BRAND_NAME, 'Off-the-Shelf Template'].map((h) => (
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
        <SectionHeading kicker="Why Us" title={`Why Build with ${BRAND_NAME}?`} />
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
        title="Launch on Your Own Brand"
        lead="Your brand, your domain, our engine. Book a demo to see it live."
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View platforms', href: '/platforms/web' }}
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
