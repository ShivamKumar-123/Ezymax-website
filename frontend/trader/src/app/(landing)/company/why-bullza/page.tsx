import { Shield, Lock, Zap, Award, Users, TrendingUp } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Company → Why Us. Restyled onto the shared marketing design system.
 * Pillars, testimonials and the regulatory block are carried over from
 * the previous landing component verbatim.
 */

const TESTIMONIALS = [
  {
    name: 'David Martinez',
    role: 'Founder, Retail Brokerage',
    rating: 5,
    text: `${BRAND_NAME} launched our platform under our own brand in weeks. The web and mobile terminals feel built for us, not bolted together.`,
  },
  {
    name: 'Sophie Anderson',
    role: 'COO, Prop Trading Firm',
    rating: 5,
    text: 'The admin back office and risk controls gave our team everything to run from day one. Support after launch has been excellent.',
  },
  {
    name: 'James Chen',
    role: 'Head of Partnerships',
    rating: 5,
    text: 'Copy trading and IB management shipped as part of the platform. We run our whole partner programme from a single dashboard.',
  },
];

export default function WhyUsPage() {
  return (
    <main>
      <PageHero
        kicker="Why SwissCresta"
        title={`Why Brokers Choose ${BRAND_NAME}`}
        lead={`The white-label trading technology brokers and prop firms launch under their own brand.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View platforms', href: '/platforms/web' }}
      />

      {/* Six pillars */}
      <Section raised>
        <SectionHeading kicker="Our Pillars" title="Six Reasons Operators Build With Us" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Shield,     title: 'Built In-House',        body: 'Every platform is engineered by our own team since 2010 — not a resold template you have to grow out of.' },
            { icon: Lock,       title: 'Your Brand, Your Domain', body: 'Everything ships white-label: your name, your branding, your domain, top to bottom.' },
            { icon: TrendingUp, title: 'Admin & Risk Controls', body: 'A full back office with CRM, risk controls, liquidity routing and reporting for your team.' },
            { icon: Zap,        title: 'Fast, Reliable Engine', body: 'A high-performance matching and pricing engine that stays responsive through volatile sessions.' },
            { icon: Award,      title: 'Supported After Launch', body: 'The same team that builds your platform supports it after go-live — by live chat, email and phone.' },
            { icon: Users,      title: 'Clear Scope & Pricing', body: 'Scope, timeline and pricing agreed up front. No hidden fees, no surprises.' },
          ]}
        />
      </Section>

      {/* Testimonials */}
      <Section>
        <SectionHeading
          kicker="Testimonials"
          title="What Operators Say"
          lead={`Here's what brokers and prop firms say about building their platform with ${BRAND_NAME}.`}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {TESTIMONIALS.map((t) => (
            <article key={t.name} className="mk-card mk-card--hover flex flex-col gap-4">
              <div className="flex gap-1" aria-label={`${t.rating} out of 5`}>
                {Array.from({ length: t.rating }).map((_, i) => (
                  <span key={i} aria-hidden style={{ color: '#e8b923' }}>★</span>
                ))}
              </div>
              <p className="mk-body italic flex-1">&ldquo;{t.text}&rdquo;</p>
              <div>
                <div className="font-bold">{t.name}</div>
                <div style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-faint)' }}>{t.role}</div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* Regulatory compliance */}
      <Section raised>
        <div className="mk-card max-w-4xl mx-auto text-center flex flex-col gap-5">
          <h2 className="mk-h2">Built for Regulated Operators</h2>
          <p className="mk-lead">
            {BRAND_NAME} is a technology provider, not a broker. We build platforms that fit the
            compliance workflows your licence requires — KYC/AML, reporting and audit trails wired
            into the back office, configured to the jurisdictions you operate in.
          </p>
          <div className="grid md:grid-cols-2 gap-5 mt-2">
            <div
              style={{
                background: 'var(--mk-surface-2)',
                border: '1px solid var(--mk-line)',
                borderRadius: 'var(--mk-radius)',
                padding: 'var(--mk-space-5)',
              }}
            >
              <h3 className="mk-h3">Compliance-Ready</h3>
              <p className="mk-body">KYC, AML and audit workflows built in</p>
            </div>
            <div
              style={{
                background: 'var(--mk-surface-2)',
                border: '1px solid var(--mk-line)',
                borderRadius: 'var(--mk-radius)',
                padding: 'var(--mk-space-5)',
              }}
            >
              <h3 className="mk-h3">Your Licence, Your Rules</h3>
              <p className="mk-body">Configured to the jurisdictions you operate in</p>
            </div>
          </div>
        </div>
      </Section>

      <CtaBanner
        title={`See the ${BRAND_NAME} platform in action`}
        lead="Book a demo and see the white-label platform we can launch under your brand."
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View platforms', href: '/platforms/web' }}
      />
    </main>
  );
}
