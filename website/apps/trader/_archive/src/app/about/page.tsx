import LandingHeader from '@/components/landing/LandingHeader'
import LandingFooter from '@/components/landing/LandingFooter'
import { Users, Target, Shield, Globe } from 'lucide-react'
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components'
import { BRAND_NAME } from '@/lib/brand'
import '@/marketing/tokens.css'

/**
 * Standalone /about. Restyled onto the shared marketing design system —
 * the page body is wrapped in `.mk` so it picks up the marketing tokens
 * (this route sits outside the (landing) group, which normally applies
 * them). Every line of copy is carried over unchanged.
 *
 * LandingHeader / LandingFooter keep their own existing styling; they are
 * shared chrome outside this restyle's scope.
 */

export const metadata = { title: `About Us — ${BRAND_NAME}` }

const STATS = [
  { value: '150+', label: 'Countries Served' },
  { value: '50,000+', label: 'Active Traders' },
  { value: '$500M+', label: 'Daily Volume' },
  { value: '99.9%', label: 'Uptime' },
]

const TEAM = [
  { name: 'Alex Chen', role: 'CEO & Co-Founder', desc: 'Former Goldman Sachs trader with 15+ years in institutional trading.' },
  { name: 'Sarah Johnson', role: 'CTO & Co-Founder', desc: 'Tech lead at Bloomberg, expert in low-latency trading systems.' },
  { name: 'Michael Roberts', role: 'Head of Compliance', desc: 'Former SEC regulator, ensures full regulatory compliance globally.' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <LandingHeader />

      <div className="mk">
        <PageHero
          kicker={`About ${BRAND_NAME}`}
          title={<>About {BRAND_NAME}<br /><span style={{ color: 'var(--mk-accent)' }}>Revolutionizing Global Trading</span></>}
          lead={`${BRAND_NAME} is a decentralized exchange paired with a regulated broker — combining on-chain insured trades, non-custodial wallets, institutional-grade tools, and transparent pricing for complete financial freedom.`}
          primary={{ label: 'Open Account', href: '/auth/register' }}
          secondary={{ label: 'Contact Us', href: '/contact' }}
        />

        {/* Our Story */}
        <Section raised>
          <SectionHeading kicker="Our Story" title="Our Story" />
          <div className="flex flex-col gap-5 mx-auto max-w-4xl mt-12">
            <p className="mk-lead">
              {BRAND_NAME} was founded with a simple belief: trading should be accessible, transparent, and fair for everyone. We saw traders struggling with high fees, slow withdrawals, and limited access to global markets. We decided to change that.
            </p>
            <p className="mk-lead">
              Today, {BRAND_NAME} serves thousands of traders across 150+ countries, providing them with the tools and freedom they deserve. We&apos;re not just a broker—we&apos;re a movement toward financial independence.
            </p>
            <p className="mk-lead">
              Our commitment is simple: provide the best trading experience with zero compromises on security, speed, or transparency.
            </p>
          </div>
        </Section>

        {/* Our Vision */}
        <Section>
          <SectionHeading
            kicker="Our Vision"
            title="Our Vision"
            lead="To become the world's most trusted trading platform by putting traders first."
          />
          <FeatureGrid
            className="mt-12"
            columns={4}
            items={[
              { icon: Users,  title: 'Trader-First',  body: "Every decision we make starts with what's best for our traders." },
              { icon: Target, title: 'Innovation',    body: 'Continuously pushing boundaries with cutting-edge technology.' },
              { icon: Shield, title: 'Trust',         body: 'Building long-term relationships through transparency and reliability.' },
              { icon: Globe,  title: 'Global Access', body: 'Making institutional-grade trading available to everyone, everywhere.' },
            ]}
          />
        </Section>

        {/* Stats */}
        <Section raised>
          <SectionHeading kicker="By the Numbers" title="By the Numbers" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
            {STATS.map(({ value, label }) => (
              <div key={label} className="mk-card text-center">
                <div
                  className="font-extrabold"
                  style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1.1 }}
                >
                  {value}
                </div>
                <div
                  className="mt-2"
                  style={{
                    fontSize: 'var(--mk-text-label)',
                    letterSpacing: 'var(--mk-tracking-label)',
                    textTransform: 'uppercase',
                    color: 'var(--mk-text-faint)',
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Team */}
        <Section>
          <SectionHeading
            kicker="Leadership"
            title="Leadership Team"
            lead="Led by industry veterans from top financial institutions and technology companies."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
            {TEAM.map(({ name, role, desc }) => (
              <article key={name} className="mk-card mk-card--hover text-center flex flex-col items-center gap-3">
                <div
                  className="h-16 w-16 rounded-full"
                  style={{ background: 'var(--mk-surface-2)', border: '1px solid var(--mk-line)' }}
                />
                <h3 className="mk-h3">{name}</h3>
                <p
                  className="font-bold"
                  style={{ color: 'var(--mk-accent)', fontSize: 'var(--mk-text-sm)' }}
                >
                  {role}
                </p>
                <p className="mk-body">{desc}</p>
              </article>
            ))}
          </div>
        </Section>

        <CtaBanner
          title={`Trade With ${BRAND_NAME}`}
          lead="Open an account and get the tools and freedom you deserve — transparent pricing, fast withdrawals, global market access."
          primary={{ label: 'Open Account', href: '/auth/register' }}
          secondary={{ label: 'Contact Us', href: '/contact' }}
        />
      </div>

      <LandingFooter />
    </div>
  )
}
