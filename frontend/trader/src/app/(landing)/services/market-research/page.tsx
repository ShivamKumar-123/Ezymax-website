'use client';

import Link from 'next/link';
import {
  TrendingUp, Newspaper, LineChart, Bell, Globe2, Calendar,
} from 'lucide-react';
import {
  Section, SectionHeading, PageHero, FeatureGrid, CtaBanner, FaqAccordion,
} from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Services → Market Research. Restyled onto the shared marketing design
 * system; every report, level and FAQ answer carried over from the
 * previous page unchanged.
 */

const SIGNUP_HREF = '/auth/register';

export default function MarketResearchPage() {
  return (
    <main>
      <PageHero
        kicker="Research Desk"
        title="Market Research & Analysis"
        lead="Daily technical and fundamental briefs from senior analysts — written for traders who actually have to put on the position."
        primary={{ label: 'Get Daily Reports', href: SIGNUP_HREF }}
        secondary={{ label: 'See Coverage', href: '#coverage' }}
      />

      {/* Intro */}
      <Section raised>
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">Updated Daily</span>
            <h2 className="mk-h2">
              Sharper decisions. <span style={{ color: 'var(--mk-accent)' }}>Backed by data.</span>
            </h2>
            <p className="mk-lead">
              The {BRAND_NAME} research desk publishes a pre-market brief at 06:00 GMT, intraday updates on
              major catalysts, and a weekly outlook every Sunday. Every report includes specific
              entries, invalidation levels, and a defined risk/reward.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">Get Daily Reports</Link>
            </div>
          </div>
          {/* Research / chart-analysis stock photo. Swap for a branded
              report mockup once available. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1554260570-9140fd3b7614?auto=format&fit=crop&w=900&q=80"
            alt="Trading charts and market analysis"
            className="w-full min-h-[260px] max-h-[340px] object-cover"
            style={{ borderRadius: 'var(--mk-radius-lg)', border: '1px solid var(--mk-accent-line)' }}
          />
        </div>
      </Section>

      {/* What you get */}
      <Section id="coverage">
        <SectionHeading kicker="Coverage" title="Research Coverage" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Newspaper,  title: 'Pre-Market Brief',     body: 'Daily 06:00 GMT — overnight moves, key levels, economic calendar, and the trade ideas being watched into the session.' },
            { icon: TrendingUp, title: 'Technical Setups',     body: 'Chart-based trade ideas with entry, stop, target, and risk/reward across forex, metals, indices, and crypto.' },
            { icon: Globe2,     title: 'Macro & Fundamentals', body: 'Central bank decisions, geopolitical risk, inflation prints, and how positioning shifts impact pricing.' },
            { icon: Bell,       title: 'Catalyst Alerts',      body: 'Real-time pushes when a major catalyst hits — non-farm payrolls, CPI, FOMC, BTC ETF flows.' },
            { icon: LineChart,  title: 'Weekly Outlook',       body: 'Sunday-evening recap and the week-ahead playbook. Big-picture themes, levels to defend, ideas to fade.' },
            { icon: Calendar,   title: 'Earnings & Events',    body: 'Curated event calendar for index and single-stock CFDs — earnings dates, ex-dividend, contract rolls.' },
          ]}
        />
      </Section>

      {/* Sample report preview */}
      <Section raised>
        <SectionHeading
          kicker="Sample"
          title="Sample Trade Idea"
          lead="Every published idea includes the levels and the reasoning — copy-paste ready into your platform."
        />
        <div className="mk-card max-w-[860px] mx-auto mt-12">
          <div
            className="flex flex-wrap items-center justify-between gap-3 pb-5"
            style={{ borderBottom: '1px solid var(--mk-line)' }}
          >
            <div>
              <div className="mk-h3">EUR/USD — Range Fade</div>
              <div
                className="mt-1"
                style={{
                  fontSize: 'var(--mk-text-label)',
                  letterSpacing: 'var(--mk-tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--mk-text-faint)',
                }}
              >
                Published 06:00 GMT · Bias: Short
              </div>
            </div>
            <span className="mk-kicker">Active</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {[
              { label: 'Entry',  value: '1.0865' },
              { label: 'Stop',   value: '1.0905' },
              { label: 'Target', value: '1.0780' },
              { label: 'R/R',    value: '2.1 : 1' },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: 'var(--mk-surface-2)',
                  border: '1px solid var(--mk-line)',
                  borderRadius: 'var(--mk-radius-sm)',
                  padding: 'var(--mk-space-4)',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--mk-text-label)',
                    letterSpacing: 'var(--mk-tracking-label)',
                    textTransform: 'uppercase',
                    color: 'var(--mk-text-faint)',
                  }}
                >
                  {m.label}
                </div>
                <div
                  className="mt-1 font-bold tabular-nums"
                  style={{ fontSize: 'var(--mk-text-h3)', color: 'var(--mk-text)' }}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>
          <p className="mk-body mt-6">
            Pair has rejected the 1.0900 supply zone twice this week with declining momentum on the 4H RSI.
            Short bias holds while price stays under 1.0905. First target is the prior swing low at 1.0780;
            stretch target 1.0735 if EU CPI surprises soft.
          </p>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <SectionHeading kicker="Questions" title="FAQ" />
        <div className="mt-12 mx-auto max-w-3xl">
          <FaqAccordion
            items={[
              {
                q: 'How do I receive the research?',
                a: <>Reports are delivered to your dashboard, via email, and as in-platform push notifications. You can subscribe to any combination of desks (FX, Crypto, Metals, Indices).</>,
              },
              {
                q: 'Is the research free?',
                a: <>Yes — daily briefs, weekly outlooks, and catalyst alerts are included with every funded {BRAND_NAME} account. There is no separate subscription fee.</>,
              },
              {
                q: 'Are these recommendations to trade?',
                a: <>No. The reports are analyst commentary and educational content. You are solely responsible for your own trading decisions. Always size positions to your own risk tolerance.</>,
              },
              {
                q: 'Can I see the historical track record?',
                a: <>Yes. Every published idea is archived with outcome (target hit, stop hit, manually closed) so you can review the desk&apos;s historical performance before subscribing.</>,
              },
            ]}
          />
        </div>
      </Section>

      <CtaBanner
        title="Start Reading the Desk"
        lead="Open a free account to receive tomorrow morning's pre-market brief and the rest of the week's coverage."
        primary={{ label: 'Subscribe Free', href: SIGNUP_HREF }}
      />
    </main>
  );
}
