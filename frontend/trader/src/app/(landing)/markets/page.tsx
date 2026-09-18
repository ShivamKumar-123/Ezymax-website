'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowUpRight,
  BookOpen,
  CandlestickChart,
  Check,
  Copy,
  Gauge,
  GraduationCap,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { LiveChartSection } from '@/home/components/LiveChartSection';
import { MarketsGrid } from '@/home/components/MarketsGrid';
import { Section, SectionHeading, PageHero } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const SIGNUP_HREF = '/company/contact';
const DEMO_HREF = '/platforms/web';

/* ── Content ─────────────────────────────────────────────────────────
   Every list below maps one-for-one onto a band in the layout, so the
   page reads as data + four small presentational components rather than
   several hundred lines of hand-rolled JSX. The analysis cards used to
   carry a `media` caption naming the footprint their artwork should fill;
   that artwork has landed, so they carry an `image` path instead. */

type Card = {
  title: string;
  body: string;
  href: string;
  /** Artwork for the 16:9 slot. Sources are 1672×941 — the slot's exact
      ratio — so they dropped into the reserved boxes without reflow. */
  image: string;
};

/** News and analysis, split 3 + 2 exactly as the reference does. */
const ANALYSIS_PRIMARY: Card[] = [
  {
    title: 'Market news',
    body: 'Follow the headlines moving currencies, indices and commodities, updated through the trading week.',
    href: '/education/news',
    image: '/images/News1.png',
  },
  {
    title: 'Technical analysis',
    body: 'Read price action with live charts, drawing tools and over 100 indicators on every instrument the platform supports.',
    href: '/platforms/web',
    image: '/images/News2.png',
  },
  {
    title: 'Trading strategy',
    body: 'Understand how traders approach ranges, breakouts and trends across different market conditions.',
    href: '/education/tutorials',
    image: '/images/News3.png',
  },
];

const ANALYSIS_SECONDARY: Card[] = [
  {
    title: 'Economic calendar',
    body: 'Track the releases that move the market — rate decisions, inflation prints and employment data.',
    href: '/education/news',
    image: '/images/News4.png',
  },
  {
    title: 'Market hours',
    body: 'Know when each session opens and closes, and which pairs stay active at each point of the day.',
    href: '/how-it-works',
    image: '/images/News5.png',
  },
];

/** Band 5 — the checklist inside the red panel beside the product shot. */
const ACCOUNT_POINTS = [
  {
    title: 'Offer a wide range of markets',
    body: 'Over 50 currency pairs plus indices, commodities and digital assets, all reachable from one client login.',
  },
  {
    title: 'One experience across every device',
    body: 'The same account on web, mobile and desktop browser, with positions kept in sync across all three.',
  },
  {
    title: 'Cost shown before the client confirms',
    body: 'Spread, leverage and margin appear on the order ticket, with the execution model your desk configures.',
  },
];

/** Band 6 — trading conditions, three icon columns over a shared button. */
const CONDITIONS: { Icon: LucideIcon; title: string; body: string }[] = [
  {
    Icon: Gauge,
    title: 'Transparent spreads',
    body: 'Spreads your desk sets per account tier, shown on the ticket before the client confirms the order.',
  },
  {
    Icon: SlidersHorizontal,
    title: 'Adjustable leverage',
    body: 'Leverage limits you define by account type and instrument, applied before each trade is placed.',
  },
  {
    Icon: Zap,
    title: 'Flexible execution',
    body: 'Route orders through the execution model you choose, with pricing wired to your liquidity providers.',
  },
];

/** Band 7 — supporting tools, split 3 + 2 like the reference's lower grid. */
type ToolItem = { Icon: LucideIcon; title: string; body: string; href: string };

const TOOLS_PRIMARY: ToolItem[] = [
  {
    Icon: CandlestickChart,
    title: 'Live charts',
    body: 'Full charting on every instrument the platform supports, with the drawing tools and indicators traders expect.',
    href: '/platforms/web',
  },
  {
    Icon: ShieldCheck,
    title: 'Risk controls',
    body: 'Stops, limits and position sizing built into the ticket so exposure is set before an order goes in.',
    href: '/risk',
  },
  {
    Icon: GraduationCap,
    title: 'Education modules',
    body: 'Ready-made walkthroughs covering order types, margin and the mechanics of each market the platform supports.',
    href: '/education/tutorials',
  },
];

const TOOLS_SECONDARY: ToolItem[] = [
  {
    Icon: Copy,
    title: 'Copy trading',
    body: 'A built-in module that lets clients follow and mirror the positions of traders they choose.',
    href: '/platforms/copy-trading',
  },
  {
    Icon: BookOpen,
    title: 'Trading glossary',
    body: 'Plain definitions for the terms that appear on the ticket, the statement and the market news.',
    href: '/faq',
  },
];

/** Band 9 — the closing "you might be interested in" link list. */
const INTERESTED = [
  { title: 'What are CFDs?', body: 'Discover the main features of trading on margin with contracts for difference.', href: '/how-it-works' },
  { title: 'Risk management', body: 'See the risk-control tools the platform gives your desk to manage leveraged exposure.', href: '/risk' },
  { title: `Learn about ${BRAND_NAME}`, body: 'Find out who we are and how the platform we build is put together.', href: '/company/about' },
  { title: 'Account types', body: 'Compare the account tiers a broker can configure in the platform we build.', href: '/account-types' },
  { title: 'Payment integrations', body: 'See the deposit and withdrawal methods the platform can wire in for your clients.', href: '/deposit-withdrawal' },
  { title: 'Frequently asked questions', body: 'Answers to what operators ask most often before booking a demo.', href: '/faq' },
];

/* ── Presentational pieces ───────────────────────────────────────────
   Local to this page rather than promoted into src/marketing/components
   — nothing else uses these shapes yet, and a shared component that has
   exactly one caller is harder to change than an inline one. */

/** Artwork on top, then title, copy and a ghost "Learn more".
    `sizes` differs per row — the primary grid is three-up at desktop, the
    secondary one two-up — so it is passed in rather than hard-coded. */
function MediaCard({ title, body, href, image, sizes }: Card & { sizes: string }) {
  return (
    <article className="mk-card mk-card--hover flex h-full flex-col gap-4">
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '16 / 9', borderRadius: 'var(--mk-radius)' }}
      >
        {/* Decorative — the heading right below carries the meaning. */}
        <Image src={image} alt="" aria-hidden fill sizes={sizes} className="object-cover" />
      </div>
      <h3 className="mk-h3">{title}</h3>
      <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
      {/* Pushed to the card floor so buttons line up across a row of
          cards whose copy runs to different lengths. */}
      <div className="mt-auto pt-2">
        <Link href={href} className="mk-btn mk-btn--ghost mk-btn--sm">
          Learn more
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </article>
  );
}

/** Icon, title, copy — with an optional "Find out more" underneath. */
function IconColumn({ Icon, title, body, href, cta }: {
  Icon: LucideIcon;
  title: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center gap-3 text-center">
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
      >
        <Icon size={20} />
      </span>
      <h3 className="mk-h3">{title}</h3>
      <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
      {href && cta && (
        <div className="mt-auto pt-3">
          <Link href={href} className="mk-btn mk-btn--ghost mk-btn--sm">
            {cta}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}


export default function MarketsPage() {
  return (
    <main>
      {/* ── 1. Hero ─────────────────────────────────────────────────── */}
      <PageHero
        title="Market coverage for your platform"
        lead={`Over 50 currency pairs alongside indices, commodities and digital assets — the instrument coverage ${BRAND_NAME} can build into the platform we deliver under your brand.`}
        primary={{ label: 'Book a demo', href: SIGNUP_HREF }}
        secondary={{ label: 'View platforms', href: DEMO_HREF }}
        image={{
          src: '/images/web img.png',
          alt: 'The trading platform open on a laptop, showing the watchlist and an order ticket',
          width: 1536,
          height: 900,
          priority: true,
        }}
      >
        <p className="mk-meta" style={{ marginTop: 'var(--mk-space-2)' }}>
          Got questions? Chat with us anytime via{' '}
          <Link href="/company/contact" className="underline underline-offset-2">live chat</Link>
          {' '}or{' '}
          <Link href="/company/contact" className="underline underline-offset-2">WhatsApp</Link>
          {' '}to get started.
        </p>
      </PageHero>

      {/* ── 2. News and analysis (3 + 2) ────────────────────────────── */}
      <Section id="analysis" raised>
        <SectionHeading title="News and analysis" />
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ANALYSIS_PRIMARY.map((card) => (
            <MediaCard
              key={card.title}
              {...card}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ))}
        </div>
        {/* Second row is two-up and centred, matching the reference's
            deliberately unbalanced grid rather than stretching to three. */}
        <div className="mx-auto mt-6 grid max-w-[820px] grid-cols-1 gap-6 sm:grid-cols-2">
          {ANALYSIS_SECONDARY.map((card) => (
            <MediaCard
              key={card.title}
              {...card}
              sizes="(max-width: 640px) 100vw, 410px"
            />
          ))}
        </div>
      </Section>

      {/* ── 4. The market directory ─────────────────────────── */}
      {/* The home page's own markets band, reused verbatim rather than a
          second hand-built grid — it already carries the real artwork, and
          one component means the two pages cannot drift apart. */}
      <MarketsGrid />

      {/* Live pricing, straight from the tape — the one band that is not
          in the reference. A markets page that shows no prices is worse
          than one that deviates by a section. */}
      <LiveChartSection />

      {/* ── 5. Split conversion panel ───────────────────────────────── */}
      <section className="mk-surface--accent">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Flush to the band edge — the reference runs the photo to the
              left margin with no card radius. `fill` + object-cover so the
              image matches whatever height the copy column settles at
              rather than dictating its own; the source is 1409×1116 and
              the slot is wider than that, so cover crops top/bottom
              slightly rather than letterboxing. */}
          <div className="relative" style={{ minHeight: 'clamp(260px, 30vw, 480px)' }}>
            <Image
              src="/images/openac-banner.png"
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          <div
            className="flex flex-col justify-center"
            style={{
              padding: 'clamp(2rem, 1rem + 3.5vw, 4rem) clamp(1.5rem, 0.5rem + 3vw, 3.5rem)',
              gap: 'var(--mk-space-5)',
            }}
          >
            <h2 className="mk-h2">Account tiers you can offer</h2>

            <ul className="flex flex-col" style={{ gap: 'var(--mk-space-4)' }}>
              {ACCOUNT_POINTS.map(({ title, body }) => (
                <li key={title} className="flex items-start" style={{ gap: 'var(--mk-space-3)' }}>
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold" style={{ fontSize: 'var(--mk-text-body)' }}>
                      {title}
                    </span>
                    <span
                      className="block"
                      style={{
                        fontSize: 'var(--mk-text-sm)',
                        lineHeight: 'var(--mk-leading-body)',
                        color: 'rgba(255, 255, 255, 0.82)',
                        marginTop: 2,
                      }}
                    >
                      {body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center" style={{ gap: 'var(--mk-space-3)' }}>
              <Link href={DEMO_HREF} className="mk-btn mk-btn--ghost">View platforms</Link>
              <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">Book a demo</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Trading conditions ───────────────────────────────────── */}
      <Section raised>
        <SectionHeading
          title="Trading conditions your desk controls"
          lead="Pricing, leverage and execution are configured by the operator — and shown on the order ticket before the client confirms."
        />
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {CONDITIONS.map((item) => (
            <IconColumn key={item.title} {...item} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/account-types" className="mk-btn mk-btn--ghost">
            Compare account types
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </Section>

      {/* ── 7. Supporting tools (3 + 2) ─────────────────────────────── */}
      <Section>
        <SectionHeading title="Tools the platform ships with" />
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {TOOLS_PRIMARY.map((item) => (
            <IconColumn key={item.title} {...item} cta="Find out more" />
          ))}
        </div>
        <div className="mx-auto mt-10 grid max-w-[760px] grid-cols-1 gap-8 sm:grid-cols-2">
          {TOOLS_SECONDARY.map((item) => (
            <IconColumn key={item.title} {...item} cta="Find out more" />
          ))}
        </div>
      </Section>

      {/* ── 8. Full-width conversion band ───────────────────────────── */}
      <section className="mk-surface--accent mk-section">
        <div className="mk-container flex flex-col items-center gap-6 text-center">
          <h2 className="mk-h2">See the platform under your brand</h2>

          <div className="grid max-w-3xl grid-cols-1 gap-6 text-left sm:grid-cols-2">
            {[
              'Instrument coverage spanning 50+ currency pairs plus indices, commodities and digital assets.',
              'One synced experience for your clients across web, mobile and desktop browser.',
            ].map((line) => (
              <p key={line} className="flex items-start" style={{ gap: 'var(--mk-space-3)' }}>
                <span
                  aria-hidden
                  className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
                <span
                  style={{
                    fontSize: 'var(--mk-text-sm)',
                    lineHeight: 'var(--mk-leading-body)',
                    color: 'rgba(255, 255, 255, 0.9)',
                  }}
                >
                  {line}
                </span>
              </p>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center" style={{ gap: 'var(--mk-space-3)' }}>
            <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary mk-btn--lg">Book a demo</Link>
          </div>
        </div>
      </section>

      {/* ── 9. Related reading ──────────────────────────────────────── */}
      <Section raised>
        <SectionHeading title="You might be interested in…" align="left" />
        <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {INTERESTED.map(({ title, body, href }) => (
            <div key={title} className="flex flex-col gap-2">
              <Link href={href} className="mk-link">
                {title}
                <ArrowUpRight size={15} />
              </Link>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
