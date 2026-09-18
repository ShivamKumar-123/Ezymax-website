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
    body: 'Scope, timeline and pricing are agreed before any work starts — no surprises once the platform is under way.',
  },
  {
    icon: RefreshCw,
    title: 'Reliability',
    body: 'The platforms we build run server-side and keep working through volatile sessions, so your clients never miss a fill.',
  },
  {
    icon: Sparkles,
    title: 'Focus',
    body: 'One engine across web, mobile and desktop — built in-house for trading, not a resold template.',
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
  { role: 'Platform Engineering', body: 'Web, mobile and desktop terminals, plus the admin back office.', image: '/images/about_card1.png' },
  { role: 'Delivery & Support',   body: 'Integrations, onboarding and support after you go live.',        image: '/images/about_card2.png' },
  { role: 'Technology',           body: 'Infrastructure, market data and platform reliability.',          image: '/images/about_card3.png' },
];

export default function AboutUsPage() {
  return (
    <main>
      {/* ── Hero: inset dark card with the title over it ──────────────── */}
      <section style={{ paddingTop: 'clamp(5.5rem, 4rem + 5vw, 7.5rem)' }}>
        <div className="mk-container">
          {/* Text hero on a dark inset card. (The previous version used a
              pre-baked banner image that carried another brand's wordmark,
              so it was replaced with a real, on-brand headline.) */}
          <div
            className="relative overflow-hidden flex flex-col items-center justify-center text-center"
            style={{
              background: 'var(--mk-ink)',
              borderRadius: 'var(--mk-radius-lg)',
              minHeight: 'clamp(18rem, 12rem + 22vw, 30rem)',
              padding: 'clamp(2rem, 1rem + 5vw, 5rem)',
            }}
          >
            <span
              className="mk-badge"
              style={{ color: 'rgba(255,255,255,0.72)', borderColor: 'rgba(255,255,255,0.22)' }}
            >
              Who we are
            </span>
            <h1
              className="mk-display"
              style={{ color: '#ffffff', marginTop: '1rem', maxWidth: '18ch' }}
            >
              An in-house team. Not a reseller.
            </h1>
            <p
              className="mk-lead"
              style={{ color: 'rgba(255,255,255,0.7)', marginTop: '1rem', maxWidth: '52ch' }}
            >
              {BRAND_NAME} is a software development company. We build and license
              trading platforms, back offices and risk engines for brokers and prop
              firms — delivered white-label, under your own brand.
            </p>
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
            your brand, our engine.{' '}
            <span style={{ color: 'var(--mk-text)' }}>
              We build and license the trading technology; you run the brokerage under your own licence.
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
            The people behind your platform
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
        title="Your brand, our engine"
        lead="Book a demo and see the white-label trading platform we can launch under your brand."
        primary={{ label: 'Book a demo', href: '/company/contact' }}
      />
    </main>
  );
}
