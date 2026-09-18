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

const SIGNUP_HREF = '/company/contact';

export default function MarketResearchPage() {
  return (
    <main>
      <PageHero
        kicker="Research Tooling"
        title="Market Research Tooling"
        lead="A research-desk module the platform can ship with — deliver daily technical and fundamental briefs, trade ideas, and calendars to your clients, under your own brand."
        primary={{ label: 'Book a demo', href: SIGNUP_HREF }}
        secondary={{ label: 'See coverage', href: '#coverage' }}
      />

      {/* Intro */}
      <Section raised>
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">Delivered Daily</span>
            <h2 className="mk-h2">
              Sharper decisions. <span style={{ color: 'var(--mk-accent)' }}>Backed by data.</span>
            </h2>
            <p className="mk-lead">
              The {BRAND_NAME} research module can publish a pre-market brief at 06:00 GMT, intraday updates on
              major catalysts, and a weekly outlook — each report with specific levels and a defined
              risk/reward, delivered to your clients inside your platform.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">Book a demo</Link>
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
                q: 'How is the research delivered?',
                a: <>Reports are delivered inside the platform — to the client&apos;s dashboard, by email, and as in-platform push notifications. Desks can be split by asset class (FX, Crypto, Metals, Indices).</>,
              },
              {
                q: 'How is the research packaged commercially?',
                a: <>That is up to you. The {BRAND_NAME} module lets you bundle research with your accounts or offer it as a paid add-on — pricing and packaging are yours to set.</>,
              },
              {
                q: 'Are these recommendations to trade?',
                a: <>No. The reports are analyst commentary and educational content, not personal advice. Each trader is responsible for their own decisions and should size positions to their own risk tolerance.</>,
              },
              {
                q: 'Is there a historical track record?',
                a: <>Yes. The module archives every published idea with its outcome (target hit, stop hit, manually closed) so performance can be reviewed transparently.</>,
              },
            ]}
          />
        </div>
      </Section>

      <CtaBanner
        title="See the Research Module"
        lead="Book a demo to see how the research desk is built, branded, and delivered to your clients."
        primary={{ label: 'Book a demo', href: SIGNUP_HREF }}
      />
    </main>
  );
}
