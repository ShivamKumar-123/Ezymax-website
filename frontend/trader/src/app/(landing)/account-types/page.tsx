'use client';

/**
 * Trading — the destination of the primary `Trading` nav item.
 *
 * Laid out to the 2026-09-02 reference: hero + wide product shot, own
 * platforms, account types, a tabbed "key features" block, trading
 * conditions, a compare band over the full specification table, FAQs, and
 * a "try these next" row.
 *
 * Content note: the reference devotes a whole band to THIRD-PARTY
 * platforms (MetaTrader, TradingView, L2 Dealer). We ship none of those —
 * the product is a single web application — so that slot carries the
 * account types instead rather than advertising integrations that do not
 * exist. Every figure below already appeared on this page.
 */
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Section, SectionHeading, PageHero, CtaBanner, FaqAccordion } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/** Our own platform surfaces — all browser-based, no installer.
 *  The slot below is 3:2 rather than the 16:9 the placeholders used: the
 *  two sources are 1.50 and 1.56, so 3:2 fits the first exactly and takes
 *  ~3% off the second, where 16:9 would have cropped 15% off both. */
const PLATFORMS = [
  {
    name: 'Web platform',
    href: '/platforms/web',
    body: 'The full trading platform in any modern browser. Nothing to install and nothing to update.',
    image: '/images/web img.png',
  },
  {
    name: 'Mobile trading',
    href: '/download',
    body: 'Installs to the phone home screen and reaches the same account, with positions and watchlists in sync.',
    image: '/images/mobile img.png',
  },
];

/* ── Key features, as a tab set (reference's tabbed band) ───────────── */
/* Each tab's artwork is 1672×941 — exactly the 16:9 the placeholder
   reserved — so the images dropped into the slot without reflow. */
const FEATURE_TABS: { label: string; lead: string; points: string[]; image: string }[] = [
  {
    label: 'Charts',
    lead: 'Professional charting with real-time pricing.',
    points: [
      'Live bid/ask streaming over a persistent connection',
      'Multiple timeframes from one minute to one day',
      'Server-side candle aggregation, so charts match the fills',
      'Full instrument directory across forex, indices, metals and crypto',
    ],
    image: '/images/hero banner 4.png',
  },
  {
    label: 'Orders and alerts',
    lead: 'Your orders keep working when your browser is closed.',
    points: [
      'Pending orders held and triggered server-side',
      'Stop-loss and take-profit monitored continuously',
      'Margin-call and stop-out alerts as levels are reached',
      'Trade notifications by email and in-platform',
    ],
    image: '/images/features2.png',
  },
  {
    label: 'Accounts',
    lead: 'Clients can run more than one account from a single login.',
    points: [
      'Live and demo accounts side by side',
      'Standard, ECN, IB and swap-free account tiers you configure',
      'Demo accounts funded with a virtual balance',
      'Instant transfers between a client’s own accounts',
    ],
    image: '/images/features3.png',
  },
];

/* ── Trading conditions (reference's "integration options" accordion) ── */
const CONDITIONS = [
  { q: 'Spreads and commission', a: 'Spreads and commission are configured per account tier by the operator and shown on the order ticket before the client confirms. The platform wires pricing to your liquidity providers with no forced markup.' },
  { q: 'Leverage and margin',    a: 'Leverage limits are set by the operator per account tier and instrument. Required margin is calculated per position and shown before the client confirms. Higher leverage increases both potential gains and potential losses for the end client.' },
  { q: 'Execution',              a: 'The platform supports the execution models you choose, with orders filled against your configured pricing. Pending orders, stop-loss and take-profit levels are held server-side so they stay active whether or not the client is signed in.' },
  { q: 'Market hours',           a: 'Forex can be quoted 24 hours a day, five days a week. Indices, metals and digital assets follow their own sessions, shown on each instrument in the platform.' },
];

const TRADING_FAQ = [
  { q: 'Can we set our own minimum deposits?', a: 'Yes. Deposit thresholds are configured per account tier by the operator. The example tiers in the platform show a Standard tier from $50 and an ECN tier from $200, with a virtual-funds demo tier that needs no deposit — all adjustable to your rules.' },
  { q: 'Which account tiers can we offer?', a: 'The platform ships with configurable tiers such as Standard (no commission, slightly wider spread), ECN (tightest raw spread with a per-lot commission), IB partner accounts, and swap-free accounts for clients who cannot pay or receive rollover interest. You decide which to enable.' },
  { q: 'Can we see the platform before committing?', a: 'Yes. Book a demo and we will walk you through the platform, the instrument coverage and the execution logic running against live prices, with a virtual balance.' },
  { q: 'Do clients need to install anything?', a: `No. ${BRAND_NAME} is fully web-based and runs in any modern browser on desktop, tablet or phone. Clients can install it to the phone home screen for an app-like experience, but there is no download and nothing to update.` },
];

const NEXT_STEPS = [
  { title: 'Explore markets',      body: 'See the instrument coverage the platform can offer your clients.',   href: '/markets' },
  { title: 'Book a demo',          body: 'See the platform in action against live prices with a virtual balance.', href: '/company/contact' },
  { title: 'Copy trading',         body: 'A module that lets clients follow and mirror experienced traders.',  href: '/platforms/copy-trading' },
];

const INSTRUMENTS = ['Forex', 'Metal', 'Crypto', 'Energies', 'Stocks', 'Indices'];

const COLUMN_HEADERS = ['Standard', 'ECN', 'IB', 'Swap'];

const FEATURE_ROWS: Array<{ label: string; values: React.ReactNode[] }> = [
  { label: 'Minimum Deposit',  values: ['$50', '$200', '$50', '$200'] },
  { label: 'Spread',           values: ['From 1.1 pips', 'From 0.0 pips', 'From 0.8 pips', 'From 0.8 pips'] },
  { label: 'Commission',       values: ['No Commission', 'Ultra-low per lot', 'Lifetime per-lot earnings', 'No swap charges'] },
  { label: 'Maximum Leverage', values: ['1:1000', '1:1000', '1:1000', '1:1000'] },
  {
    label: 'Instruments',
    values: [0, 1, 2, 3].map((i) => (
      <div key={i} className="flex flex-wrap justify-center gap-1.5 max-w-[220px] mx-auto">
        {INSTRUMENTS.map((inst) => (
          <span
            key={inst}
            className="px-2.5 py-0.5"
            style={{
              fontSize: 'var(--mk-text-xs)',
              borderRadius: 'var(--mk-radius-pill)',
              border: '1px solid var(--mk-line)',
              background: 'var(--mk-surface-2)',
              color: 'var(--mk-text-muted)',
            }}
          >
            {inst}
          </span>
        ))}
      </div>
    )),
  },
  { label: 'Minimum lot size',            values: ['0.01', '0.01', '0.01', '0.01'] },
  { label: 'Maximum Number of positions', values: ['Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Hedged Margin',               values: ['0%', '0%', '0%', '0%'] },
  { label: 'Margin call',                 values: ['30%', '30%', '30%', '30%'] },
  { label: 'Stop out',                    values: ['0% (See details about stocks)', '0% (See details about stocks)', '0% (See details about stocks)', '0% (See details about stocks)'] },
  { label: 'Order execution',             values: ['Instant', 'Instant', 'Instant', 'Instant'] },
  // Swap is the dedicated swap-free / Sharia-compliant account.
  { label: 'Swap-Free',                   values: ['Optional', 'Optional', 'Optional', 'Always-on'] },
  { label: 'Customer Support',            values: ['24/7', '24/7', '24/7', '24/7'] },
];

export default function AccountTypesPage() {
  const [tab, setTab] = useState(0);
  const active = FEATURE_TABS[tab] ?? FEATURE_TABS[0]!;

  return (
    <main>
      <PageHero
        kicker="Platform"
        title="Platforms and account tiers"
        lead={`Every platform surface and account tier ${BRAND_NAME} can build into the trading system we deliver under your brand.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View platforms', href: '/platforms/web' }}
        image={{
          src: '/images/trading page banner.png',
          alt: 'SwissCresta brand banner',
          width: 2400,
          height: 1000,
          priority: true,
        }}
      />

      {/* ── Our platforms ─────────────────────────────────────────────── */}
      <Section>
        <SectionHeading title={`${BRAND_NAME} trading platforms`} />
        <div
          className="grid grid-cols-1 md:grid-cols-2"
          style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
        >
          {PLATFORMS.map((p) => (
            <Link key={p.name} href={p.href} className="mk-card mk-card--hover flex flex-col gap-5">
              {/* Decorative — the card heading right below names the surface. */}
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: '3 / 2', borderRadius: 'var(--mk-radius)' }}
              >
                <Image
                  src={p.image}
                  alt=""
                  aria-hidden
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="mk-h3">{p.name}</h3>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{p.body}</p>
                <span className="mk-link" style={{ marginTop: 'var(--mk-space-2)' }}>
                  Explore {p.name.toLowerCase()}
                  <ArrowUpRight size={15} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* An "Account types" band of four cards sat here — Standard / ECN /
          IB / Swap, each over a 640×480 placeholder box. Removed: the same
          four accounts are compared row-by-row in the conditions table
          further down this page, so the cards restated it, and their
          artwork never landed. The routes they linked to are still reached
          from the footer's Trading column. */}

      {/* ── Key features (tabbed) ─────────────────────────────────────── */}
      <Section>
        <SectionHeading title={`Key features of the ${BRAND_NAME} platform`} />

        {/* Tab bar */}
        <div
          className="flex flex-wrap justify-center"
          style={{ gap: 'var(--mk-space-2)', marginTop: 'var(--mk-space-6)' }}
          role="tablist"
          aria-label="Platform features"
        >
          {FEATURE_TABS.map((t, i) => {
            const isActive = i === tab;
            return (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(i)}
                className="mk-btn"
                style={
                  isActive
                    ? { background: 'var(--mk-ink)', color: '#fff' }
                    : {
                        background: '#fff',
                        color: 'var(--mk-text-muted)',
                        border: '1px solid var(--mk-line-strong)',
                      }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 'var(--mk-space-7)' }}>
          <p className="mk-lead" style={{ maxWidth: '68ch' }}>{active.lead}</p>
          <ul className="flex flex-col" style={{ gap: 'var(--mk-space-3)', marginTop: 'var(--mk-space-5)' }}>
            {active.points.map((point) => (
              <li key={point} className="flex items-start" style={{ gap: 'var(--mk-space-3)' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--mk-accent)', flexShrink: 0, marginTop: 2 }} />
                <span className="mk-body" style={{ color: 'var(--mk-text)' }}>{point}</span>
              </li>
            ))}
          </ul>
          <div
            className="relative w-full overflow-hidden"
            style={{
              aspectRatio: '16 / 9',
              borderRadius: 'var(--mk-radius)',
              marginTop: 'var(--mk-space-7)',
            }}
          >
            {/* Decorative — the tab label and bullets above carry the
                meaning, so alt stays empty. `key` forces a fresh <img>
                per tab so switching tabs cannot show the previous
                image while the next one decodes. */}
            <Image
              key={active.image}
              src={active.image}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 1200px) 100vw, 1140px"
              className="object-cover"
            />
          </div>
        </div>
      </Section>

      {/* ── Trading conditions ────────────────────────────────────────── */}
      <Section raised>
        <SectionHeading
          title="Trading conditions"
          lead="Spreads, leverage and execution — the terms your desk configures for every position a client opens."
        />
        <div
          className="grid grid-cols-1 items-start lg:grid-cols-2"
          style={{ gap: 'var(--mk-space-8)', marginTop: 'var(--mk-space-7)' }}
        >
          <FaqAccordion items={CONDITIONS} />
          {/* Artwork replaces the reserved box. The source is 1448×1086 —
              4:3, the exact ratio the slot was built at — so the accordion
              beside it keeps its alignment. Decorative: the accordion
              carries the actual conditions. */}
          <div
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: '4 / 3', borderRadius: 'var(--mk-radius)' }}
          >
            <Image
              src="/images/condition.png"
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </Section>

      {/* ── Full specification table ──────────────────────────────────── */}
      <Section id="comparison" raised>
        <SectionHeading kicker="Specifications" title="Feature comparison" />
        <div className="overflow-x-auto" style={{ marginTop: 'var(--mk-space-7)' }}>
          <table className="w-full min-w-[760px] border-collapse text-center">
            <thead>
              <tr>
                <th
                  className="text-left"
                  style={{
                    padding: 'var(--mk-space-3) var(--mk-space-4)',
                    borderBottom: '1px solid var(--mk-line)',
                    fontSize: 'var(--mk-text-sm)',
                    color: 'var(--mk-text-faint)',
                    fontWeight: 600,
                  }}
                >
                  Feature
                </th>
                {COLUMN_HEADERS.map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: 'var(--mk-space-3) var(--mk-space-4)',
                      borderBottom: '1px solid var(--mk-line)',
                      fontSize: 'var(--mk-text-body)',
                      fontWeight: 700,
                      color: 'var(--mk-text)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.label}>
                  <td
                    className="text-left"
                    style={{
                      padding: 'var(--mk-space-4)',
                      borderBottom: '1px solid var(--mk-line)',
                      fontSize: 'var(--mk-text-sm)',
                      color: 'var(--mk-text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.label}
                  </td>
                  {row.values.map((v, i) => (
                    <td
                      key={i}
                      style={{
                        padding: 'var(--mk-space-4)',
                        borderBottom: '1px solid var(--mk-line)',
                        fontSize: 'var(--mk-text-sm)',
                        color: 'var(--mk-text)',
                      }}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── FAQs ──────────────────────────────────────────────────────── */}
      <Section>
        <SectionHeading title="Platform FAQs" />
        <div className="mx-auto" style={{ maxWidth: 820, marginTop: 'var(--mk-space-7)' }}>
          <FaqAccordion items={TRADING_FAQ} />
        </div>
      </Section>

      {/* ── Try these next ────────────────────────────────────────────── */}
      <Section raised>
        <SectionHeading title="Try these next" />
        <div
          className="grid grid-cols-1 sm:grid-cols-3"
          style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
        >
          {NEXT_STEPS.map((s) => (
            <Link key={s.title} href={s.href} className="mk-card mk-card--hover flex flex-col gap-2">
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{s.body}</p>
              <span className="mk-link" style={{ marginTop: 'var(--mk-space-2)' }}>
                Learn more
                <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <CtaBanner
        title="Your brand, our engine"
        lead={`Every ${BRAND_NAME} account tier runs on the same platform and the same execution — configure the conditions that suit your business.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View platforms', href: '/platforms/web' }}
      />
    </main>
  );
}
