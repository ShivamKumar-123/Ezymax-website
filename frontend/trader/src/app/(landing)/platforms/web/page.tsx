import Link from 'next/link';
import { Check, Globe, Zap, BarChart3, Bell } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME, BRAND_LOGO } from '@/lib/brand';

/**
 * Platforms → Web. Restyled onto the shared marketing design system.
 * Copy carried over from the previous landing component; the old
 * react-router links are now real Next links.
 */

const HIGHLIGHTS = [
  'Full TradingView chart integration',
  'One-click order execution',
  'Real-time news feed',
  'Portfolio & margin tracker',
  'Mobile-optimized interface',
  'Advanced order types',
  'Watchlist management',
  'Trade history & analytics',
  'Multi-language support',
  'Secure SSL encryption',
];

export default function WebPlatformPage() {
  return (
    <main>
      <PageHero
        kicker="Web Platform"
        title={`${BRAND_NAME} Web Platform — Trade Instantly, Anywhere`}
        lead="No download required. Launch the platform from any browser and start trading in seconds."
        primary={{ label: 'Launch Platform', href: '/auth/register' }}
        secondary={{ label: 'Try Demo Account', href: '/accounts/demo' }}
      />

      <Section raised>
        <SectionHeading kicker="Features" title="Everything You Need in One Platform" />
        <FeatureGrid
          className="mt-12"
          columns={4}
          items={[
            { icon: Globe,     title: 'Browser-Based Trading',  body: 'No downloads required. Access your account from any device with a web browser.' },
            { icon: BarChart3, title: 'TradingView Integration', body: 'Full TradingView chart integration with 100+ indicators and drawing tools.' },
            { icon: Zap,       title: 'One-Click Execution',    body: 'Execute trades instantly with our lightning-fast order execution system.' },
            { icon: Bell,      title: 'Real-Time Alerts',       body: 'Set price alerts and get instant notifications on market movements.' },
          ]}
        />
      </Section>

      <Section>
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">Simplified</span>
            <h2 className="mk-h2">Professional Trading, Simplified</h2>
            <p className="mk-lead">
              Our web platform combines powerful features with an intuitive interface. Whether
              you&apos;re a beginner or experienced trader, you&apos;ll find everything you need to
              succeed.
            </p>
            <ul className="flex flex-col gap-2.5 mt-2">
              {HIGHLIGHTS.map((highlight) => (
                <li key={highlight} className="flex items-start gap-3 mk-body">
                  <Check size={18} className="shrink-0 mt-1" style={{ color: 'var(--mk-accent)' }} />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>

          <article className="mk-card overflow-hidden" style={{ padding: 0 }}>
            <div className="aspect-video overflow-hidden">
              {BRAND_LOGO ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={BRAND_LOGO}
                  alt={`${BRAND_NAME} Web Platform`}
                  className="w-full h-full object-contain p-16"
                  style={{ background: 'var(--mk-surface-2)' }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center p-10 text-center"
                  style={{ background: 'var(--mk-surface-2)' }}
                >
                  <span className="mk-h1">{BRAND_NAME}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-4" style={{ padding: 'var(--mk-space-6)' }}>
              <h3 className="mk-h3">Access Anywhere</h3>
              <p className="mk-body">
                Trade from your desktop, laptop, tablet, or smartphone. Your account syncs seamlessly
                across all devices.
              </p>
              <Link href="/auth/register" className="mk-btn mk-btn--primary w-full">
                Launch Web Platform
              </Link>
            </div>
          </article>
        </div>
      </Section>

      <CtaBanner
        title="Start Trading in Seconds"
        lead="No downloads, no installations. Just open your browser and start trading."
        primary={{ label: 'Open Account Now', href: '/auth/register' }}
        secondary={{ label: 'Try Demo Account', href: '/accounts/demo' }}
      />
    </main>
  );
}
