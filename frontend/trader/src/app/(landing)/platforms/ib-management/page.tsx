import Link from 'next/link';
import {
  Users, DollarSign, BarChart2, Award, Globe, Headphones, Check, TrendingUp,
} from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Platforms → IB Management. Restyled onto the shared marketing design
 * system; commission tiers, portal features and copy carried over from
 * the previous landing component.
 */

const TIERS = [
  { name: 'Silver',   volume: '0 – 100 lots/month',   rebate: '$5 / lot' },
  { name: 'Gold',     volume: '100 – 500 lots/month', rebate: '$8 / lot', featured: true },
  { name: 'Platinum', volume: '500+ lots/month',      rebate: '$12 / lot' },
];

const PORTAL_FEATURES = [
  'Real-time commission tracking',
  'Client activity monitoring',
  'Sub-IB management tools',
  'Automated payout system',
  'Custom referral links',
  'Detailed reporting & analytics',
  'Marketing resource library',
  'Built-in support channel',
];

export default function IBManagementPage() {
  return (
    <main>
      <PageHero
        kicker="Partners"
        title="IB & Partner Management"
        lead={`An IB and partner-management module we build into your ${BRAND_NAME} platform. Onboard introducing brokers, track referrals, and automate payouts — under your brand.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View platforms', href: '/platforms/web' }}
      />

      <Section raised>
        <SectionHeading
          kicker="Capabilities"
          title="What the IB Module Delivers"
          lead="Everything your operation needs to run an introducing-broker network."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: DollarSign, title: 'Tiered Commissions',     body: 'Configure tiered rebate structures and set the rates your partners earn as their referred volume grows.' },
            { icon: Users,      title: 'Multi-Level Referrals',   body: 'Support sub-IB networks. Partners build teams and earn across multiple levels, all tracked automatically.' },
            { icon: BarChart2,  title: 'Real-Time Dashboard',     body: 'Partners track referrals, commissions, client activity, and payouts in real time through a dedicated IB portal.' },
            { icon: Globe,      title: 'Marketing Materials',     body: 'Built-in banners, landing pages, tracking links, and promotional content for partners to grow their client base.' },
            { icon: Award,      title: 'Performance Bonuses',     body: 'Bonus tiers based on monthly volume reward top-performing partners with configurable incentives.' },
            { icon: Headphones, title: 'Account Manager Tools',   body: 'Assign account managers to partners inside the portal to help them optimize strategy, resolve issues, and scale.' },
          ]}
        />
      </Section>

      <Section>
        <SectionHeading kicker="Rebates" title="Commission Tiers" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto mt-12">
          {TIERS.map((t) => (
            <article
              key={t.name}
              className="mk-card mk-card--hover text-center flex flex-col gap-2"
              style={t.featured ? { borderColor: 'var(--mk-accent-line)' } : undefined}
            >
              <h3 className="mk-h3" style={t.featured ? { color: 'var(--mk-accent)' } : undefined}>{t.name}</h3>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{t.volume}</p>
              <div
                className="font-extrabold mt-2"
                style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-text)', lineHeight: 1.1 }}
              >
                {t.rebate}
              </div>
              <p style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>
                Commission per lot
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section raised>
        <SectionHeading kicker="Onboarding" title="How to Get Started" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {[
            { step: '01', title: 'Apply',            desc: 'Partners submit an application through your branded portal.' },
            { step: '02', title: 'Get Approved',     desc: 'Your team reviews and approves applications in the admin console.' },
            { step: '03', title: 'Share the Link',   desc: 'Approved partners share unique referral links to invite clients.' },
            { step: '04', title: 'Earn Commissions', desc: 'Partners earn commissions on referred-client activity, with payouts automated.' },
          ].map((s) => (
            <article key={s.step} className="mk-card mk-card--hover text-center flex flex-col gap-3">
              <span
                className="font-extrabold"
                style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1 }}
              >
                {s.step}
              </span>
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body">{s.desc}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mk-card">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="flex flex-col gap-4">
              <h2 className="mk-h2">IB Portal Features</h2>
              <ul className="flex flex-col gap-2.5">
                {PORTAL_FEATURES.map((item) => (
                  <li key={item} className="flex items-center gap-3 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                    <Check size={16} className="shrink-0" style={{ color: 'var(--mk-accent)' }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center flex flex-col items-center gap-4">
              <span
                className="inline-flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <TrendingUp size={28} />
              </span>
              <h3 className="mk-h3">No Commission Caps</h3>
              <p className="mk-body">
                Configure commissions with no ceiling in the module, so partners keep earning as
                their networks grow.
              </p>
              <Link href="/company/contact" className="mk-btn mk-btn--primary">Book a demo</Link>
            </div>
          </div>
        </div>
      </Section>

      <CtaBanner
        title="Run Your Own IB Network"
        lead={`An IB and partner-management module, built into your ${BRAND_NAME} platform under your brand.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View platforms', href: '/platforms/web' }}
      />
    </main>
  );
}
