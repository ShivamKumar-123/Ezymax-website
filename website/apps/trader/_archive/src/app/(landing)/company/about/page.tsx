import Image from 'next/image';
import { Crosshair, RefreshCw, Sparkles } from 'lucide-react';
import { CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Company → About Us.
 *
 * Laid out to the 2026-09-02 reference: an inset dark hero card with the
 * page title over it, a "Principles" band (two-tone statement + three
 * cards with dark icon tiles), a team grid, and the shared closing CTA.
 * Four sections total, as requested.
 *
 * The previous version also carried a stats row and a full account-tier
 * ladder. Both are dropped here: the ladder duplicated /account-types
 * verbatim, and About is not where a visitor compares deposits.
 */

const PRINCIPLES = [
  {
    icon: Crosshair,
    title: 'Transparency',
    body: 'Spreads, commission and required margin are shown on the order ticket before you confirm.',
  },
  {
    icon: RefreshCw,
    title: 'Reliability',
    body: 'Orders are held server-side and keep working through volatile sessions, whether or not you are signed in.',
  },
  {
    icon: Sparkles,
    title: 'Focus',
    body: 'One platform, one account, every device — built for currency trading rather than bolted together.',
  },
];

/**
 * Team grid. Deliberately role-only: we have no roster to publish, and
 * inventing names and headshots for a brokerage's "our team" section
 * would be fabricating credibility. Swap in real people and portraits
 * when they exist — the layout is already sized for them.
 */
/* Sources are 1254×1254 — square, exactly the ratio the slot reserved. */
const TEAM = [
  { role: 'Trading Operations', body: 'Execution, pricing and market coverage.',           image: '/images/about_card1.png' },
  { role: 'Client Support',     body: 'Account opening, funding and day-to-day questions.', image: '/images/about_card2.png' },
  { role: 'Technology',         body: 'Platform, infrastructure and market data.',          image: '/images/about_card3.png' },
];

export default function AboutUsPage() {
  return (
    <main>
      {/* ── Hero: inset dark card with the title over it ──────────────── */}
      <section style={{ paddingTop: 'clamp(5.5rem, 4rem + 5vw, 7.5rem)' }}>
        <div className="mk-container">
          {/* The banner alone — no overlaid title. The artwork already
              carries the bullza wordmark across the middle of the frame,
              so a headline on top of it read as the brand stated twice.
              The scrim that used to sit here existed only to keep that
              headline legible, so it went with it.

              The <h1> stays for screen readers and search engines: a page
              with no level-one heading is a real accessibility defect, and
              this is the only h1 on the page — everything below is h2. */}
          <h1 className="sr-only">About {BRAND_NAME}</h1>
          <div
            className="relative overflow-hidden"
            style={{
              background: 'var(--mk-ink)',
              borderRadius: 'var(--mk-radius-lg)',
              minHeight: 'clamp(18rem, 12rem + 22vw, 30rem)',
            }}
          >
            <Image
              src="/images/about banner.png"
              alt={`${BRAND_NAME} brand banner`}
              fill
              priority
              sizes="(max-width: 1360px) 100vw, 1280px"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Principles ────────────────────────────────────────────────── */}
      <section className="mk-section">
        <div className="mk-container">
          <span className="mk-badge">Principles</span>

          {/* Two-tone statement: the emphasis carries in ink, the
              connective copy drops to muted — as in the reference. */}
          <p
            className="mk-display"
            style={{
              marginTop: 'var(--mk-space-5)',
              maxWidth: '24ch',
              fontSize: 'clamp(1.6rem, 1.1rem + 2.2vw, 2.75rem)',
              lineHeight: 1.18,
              letterSpacing: '-0.028em',
              color: 'var(--mk-text-muted)',
            }}
          >
            <span style={{ color: 'var(--mk-text)' }}>{BRAND_NAME} is built on a simple idea:</span>{' '}
            trading should feel clear, not complicated.{' '}
            <span style={{ color: 'var(--mk-text)' }}>
              We focus on execution, pricing and the conditions that decide a trade.
            </span>
          </p>

          <div
            className="grid grid-cols-1 sm:grid-cols-3"
            style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-8)' }}
          >
            {PRINCIPLES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="mk-card flex flex-col" style={{ gap: 'var(--mk-space-5)' }}>
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center"
                  style={{
                    background: 'var(--mk-ink)',
                    color: 'var(--mk-text-invert)',
                    borderRadius: 'var(--mk-radius-sm)',
                  }}
                  aria-hidden
                >
                  <Icon size={19} />
                </span>
                <div className="flex flex-col" style={{ gap: 'var(--mk-space-2)' }}>
                  <h3 className="mk-h3">{title}</h3>
                  <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Our team ──────────────────────────────────────────────────── */}
      <section className="mk-section mk-section--raised">
        <div className="mk-container">
          <span className="mk-badge">Our Team</span>

          <h2
            className="mk-h2"
            style={{ marginTop: 'var(--mk-space-5)', maxWidth: '20ch' }}
          >
            The people behind your trading environment
          </h2>

          <div
            className="grid grid-cols-1 sm:grid-cols-3"
            style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
          >
            {TEAM.map(({ role, body, image }) => (
              <div key={role} className="flex flex-col" style={{ gap: 'var(--mk-space-4)' }}>
                {/* Decorative — the role heading right below names the card. */}
                <div
                  className="relative w-full overflow-hidden"
                  style={{ aspectRatio: '1 / 1', borderRadius: 'var(--mk-radius)' }}
                >
                  <Image
                    src={image}
                    alt=""
                    aria-hidden
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col" style={{ gap: 'var(--mk-space-1)' }}>
                  <h3 className="mk-h3">{role}</h3>
                  <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner
        title="Trade Global Markets with Confidence"
        lead="Open an account and access the currency markets on a platform built for professional trading."
        primary={{ label: 'Start Trading', href: '/auth/register' }}
      />
    </main>
  );
}
