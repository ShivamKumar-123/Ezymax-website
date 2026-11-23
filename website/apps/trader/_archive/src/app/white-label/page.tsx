import LandingHeader from '@/components/landing/LandingHeader'
import LandingFooter from '@/components/landing/LandingFooter'
import { Building2, Zap, Users, Shield, TrendingUp, Clock } from 'lucide-react'
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components'
import { BRAND_NAME } from '@/lib/brand'
import '@/marketing/tokens.css'

/**
 * Standalone /white-label. Restyled onto the shared marketing design
 * system — the body is wrapped in `.mk` so it picks up the marketing
 * tokens (this route sits outside the (landing) group, which normally
 * applies them). All copy and links carried over unchanged.
 *
 * LandingHeader / LandingFooter keep their own existing styling; they are
 * shared chrome outside this restyle's scope.
 */

export const metadata = { title: `White Label Solutions — ${BRAND_NAME}` }

const TECH_STACK = [
  'Trading Platform (Web, Desktop, Mobile)',
  'CRM & Client Management',
  'Payment Processing Gateway',
  'Risk Management System',
  'Reporting & Analytics Dashboard',
  'Admin Back Office',
]

const BUSINESS_SERVICES = [
  'Tier-1 Liquidity Access',
  'Multi-Bank Payment Processing',
  'Regulatory Documentation',
  'Marketing Materials',
  'Training & Onboarding',
  'Ongoing Technical Support',
]

const PROCESS = [
  { step: '1', title: 'Consultation',  desc: 'We discuss your requirements and business goals.' },
  { step: '2', title: 'Customization', desc: 'Brand customization and feature configuration.' },
  { step: '3', title: 'Integration',   desc: 'Technical setup and testing.' },
  { step: '4', title: 'Launch',        desc: 'Go live with training and support.' },
]

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-3 mk-body">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--mk-accent)' }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function WhiteLabelPage() {
  return (
    <div className="min-h-screen">
      <LandingHeader />

      <div className="mk">
        <PageHero
          kicker="Enterprise Solutions"
          title={<>Launch Your Brand<br /><span style={{ color: 'var(--mk-accent)' }}>in 72 Hours</span></>}
          lead={`Build your own branded brokerage with ${BRAND_NAME}'s institutional-grade white-label solution. Full technology stack, liquidity, and 24/7 support included.`}
          primary={{ label: 'Request Demo', href: '/auth/register' }}
          secondary={{ label: 'Contact Sales', href: '/contact' }}
        />

        {/* Features */}
        <Section raised>
          <SectionHeading
            kicker="What You Get"
            title="Complete White-Label Solution"
            lead="Everything you need to launch and scale your brokerage business."
          />
          <FeatureGrid
            className="mt-12"
            columns={3}
            items={[
              { icon: Building2,  title: 'Custom Branding',        body: 'Your logo, colors, and domain. Fully customized client experience.' },
              { icon: Zap,        title: 'Fast Launch',            body: 'Go live in 72 hours with our streamlined setup process.' },
              { icon: Users,      title: 'Dedicated Support',      body: '24/7 technical support and account management for your business.' },
              { icon: Shield,     title: 'Regulatory Compliance',  body: 'Built-in compliance tools and documentation for major jurisdictions.' },
              { icon: TrendingUp, title: 'Revenue Sharing',        body: 'Competitive revenue split with transparent reporting.' },
              { icon: Clock,      title: 'Real-time Reporting',    body: 'Comprehensive analytics and reporting dashboard.' },
            ]}
          />
        </Section>

        {/* What's Included */}
        <Section>
          <SectionHeading kicker="Included" title="What's Included" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
            <article className="mk-card flex flex-col gap-5">
              <h3 className="mk-h3">Technology Stack</h3>
              <BulletList items={TECH_STACK} />
            </article>
            <article className="mk-card flex flex-col gap-5">
              <h3 className="mk-h3">Business Services</h3>
              <BulletList items={BUSINESS_SERVICES} />
            </article>
          </div>
        </Section>

        {/* Process */}
        <Section raised>
          <SectionHeading kicker="Process" title="Launch Process" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12 max-w-4xl mx-auto">
            {PROCESS.map(({ step, title, desc }) => (
              <article key={title} className="mk-card mk-card--hover text-center flex flex-col items-center gap-3">
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full font-extrabold"
                  style={{ background: 'var(--mk-accent)', color: '#fff', fontSize: 'var(--mk-text-lead)' }}
                >
                  {step}
                </span>
                <h3 className="mk-h3">{title}</h3>
                <p className="mk-body">{desc}</p>
              </article>
            ))}
          </div>
        </Section>

        <CtaBanner
          title="Ready to Launch Your Brokerage?"
          lead="Join successful brokers using our white-label solution. Schedule a consultation today."
          primary={{ label: 'Schedule Consultation', href: '/auth/register' }}
          secondary={{ label: 'Learn More', href: '/contact' }}
        />
      </div>

      <LandingFooter />
    </div>
  )
}
