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
  'Priority support channel',
];

export default function IBManagementPage() {
  return (
    <main>
      <PageHero
        kicker="Partners"
        title="IB Management Program"
        lead={`Partner with ${BRAND_NAME} and earn competitive commissions by introducing new clients. Build your brokerage business with our support.`}
        primary={{ label: 'Become an IB', href: '/company/contact' }}
        secondary={{ label: 'Learn More', href: '/accounts/demo' }}
      />

      <Section raised>
        <SectionHeading
          kicker="Why Partner"
          title="Why Partner With Us"
          lead="Everything you need to build a successful introducing broker business."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: DollarSign, title: 'Competitive Commissions', body: 'Earn up to $12 per lot with our tiered rebate structure. The more clients you refer, the higher your earnings.' },
            { icon: Users,      title: 'Multi-Level Referrals',   body: 'Earn from sub-IBs under your network. Build a team and generate passive income from multiple levels.' },
            { icon: BarChart2,  title: 'Real-Time Dashboard',     body: 'Track referrals, commissions, client activity, and payouts in real time through your dedicated IB portal.' },
            { icon: Globe,      title: 'Marketing Materials',     body: 'Access banners, landing pages, tracking links, and promotional content to grow your client base.' },
            { icon: Award,      title: 'Performance Bonuses',     body: 'Unlock bonus tiers based on monthly volume. Top-performing IBs receive additional rewards and incentives.' },
            { icon: Headphones, title: 'Dedicated IB Manager',    body: 'Get a personal account manager to help you optimize your strategy, resolve issues, and scale your business.' },
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
            { step: '01', title: 'Apply',            desc: 'Fill out the IB application form with your details.' },
            { step: '02', title: 'Get Approved',     desc: 'Our team reviews and approves your application.' },
            { step: '03', title: 'Share Your Link',  desc: 'Use your unique referral link to invite clients.' },
            { step: '04', title: 'Earn Commissions', desc: 'Get paid for every trade your referred clients make.' },
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
              <h3 className="mk-h3">Unlimited Earning Potential</h3>
              <p className="mk-body">
                No caps on commissions. The more clients you bring, the more you earn — every month,
                for life.
              </p>
              <Link href="/company/contact" className="mk-btn mk-btn--primary">Apply Now</Link>
            </div>
          </div>
        </div>
      </Section>

      <CtaBanner
        title="Build Your Brokerage Business"
        lead={`Partner with ${BRAND_NAME} and earn competitive commissions by introducing new clients.`}
        primary={{ label: 'Become an IB', href: '/company/contact' }}
        secondary={{ label: 'Open Account', href: '/auth/register' }}
      />
    </main>
  );
}
