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
    role: 'Professional Trader',
    rating: 5,
    text: `Best execution speeds I've experienced. ${BRAND_NAME} has transformed my trading with their reliable platform and tight spreads.`,
  },
  {
    name: 'Sophie Anderson',
    role: 'Retail Trader',
    rating: 5,
    text: 'The customer support is outstanding. They helped me every step of the way as a beginner trader. Highly recommended!',
  },
  {
    name: 'James Chen',
    role: 'Algorithmic Trader',
    rating: 5,
    text: 'Perfect for automated trading. The copy trading integration is seamless and the VPS hosting is a game-changer for my strategies.',
  },
];

export default function WhyUsPage() {
  return (
    <main>
      <PageHero
        kicker="Why Us"
        title={`Why Thousands Choose ${BRAND_NAME}`}
        lead={`Discover what makes ${BRAND_NAME} the preferred choice for traders worldwide.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Contact Us', href: '/company/contact' }}
      />

      {/* Six pillars */}
      <Section raised>
        <SectionHeading kicker="Our Pillars" title="Our Six Pillars of Excellence" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Shield,     title: 'Regulated & Licensed',        body: 'Fully licensed and regulated by FCA (UK) and CySEC (Cyprus), ensuring the highest standards of financial conduct and client protection.' },
            { icon: Lock,       title: 'Segregated Client Funds',     body: 'Your funds are held in segregated accounts with tier-1 banks, completely separate from company operational funds.' },
            { icon: TrendingUp, title: 'Negative Balance Protection', body: 'Trade with confidence knowing you can never lose more than your account balance, even in volatile markets.' },
            { icon: Zap,        title: 'Lightning Execution',         body: 'Orders executed in under 30ms with our institutional-grade infrastructure and zero requotes guarantee.' },
            { icon: Award,      title: 'Award-Winning Support',       body: '24/7 multilingual support team ready to assist you via live chat, email, and phone in your language.' },
            { icon: Users,      title: 'Transparent Pricing',         body: 'No hidden fees, no surprises. Clear, competitive spreads and commissions with full cost transparency.' },
          ]}
        />
      </Section>

      {/* Testimonials */}
      <Section>
        <SectionHeading
          kicker="Testimonials"
          title="What Our Traders Say"
          lead={`Don't just take our word for it. Here's what our clients have to say about their experience with ${BRAND_NAME}.`}
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
          <h2 className="mk-h2">Regulatory Compliance</h2>
          <p className="mk-lead">
            {BRAND_NAME} is authorized and regulated by the Financial Conduct Authority (FCA) in the UK
            (License No. 123456) and the Cyprus Securities and Exchange Commission (CySEC)
            (License No. 789/12).
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
              <h3 className="mk-h3">FCA Regulated</h3>
              <p className="mk-body">United Kingdom</p>
            </div>
            <div
              style={{
                background: 'var(--mk-surface-2)',
                border: '1px solid var(--mk-line)',
                borderRadius: 'var(--mk-radius)',
                padding: 'var(--mk-space-5)',
              }}
            >
              <h3 className="mk-h3">CySEC Licensed</h3>
              <p className="mk-body">European Union</p>
            </div>
          </div>
        </div>
      </Section>

      <CtaBanner
        title={`Experience the ${BRAND_NAME} Difference`}
        lead="Join over 500,000 traders who trust us with their trading journey."
        primary={{ label: 'Open Account Now', href: '/accounts/demo' }}
        secondary={{ label: 'Contact Us', href: '/company/contact' }}
      />
    </main>
  );
}
