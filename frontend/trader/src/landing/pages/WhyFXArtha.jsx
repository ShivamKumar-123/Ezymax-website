import { Link } from 'react-router-dom'
import { Shield, Lock, Zap, Award, Users, TrendingUp } from 'lucide-react'
import Button from '../components/Button'
import SectionHeader from '../components/SectionHeader'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const WhyFXArtha = () => {
  const pillars = [
    {
      icon: Shield,
      title: 'Regulated & Licensed',
      description: 'Fully licensed and regulated by FCA (UK) and CySEC (Cyprus), ensuring the highest standards of financial conduct and client protection.'
    },
    {
      icon: Lock,
      title: 'Segregated Client Funds',
      description: 'Your funds are held in segregated accounts with tier-1 banks, completely separate from company operational funds.'
    },
    {
      icon: TrendingUp,
      title: 'Negative Balance Protection',
      description: 'Trade with confidence knowing you can never lose more than your account balance, even in volatile markets.'
    },
    {
      icon: Zap,
      title: 'Lightning Execution',
      description: 'Orders executed in under 30ms with our institutional-grade infrastructure and zero requotes guarantee.'
    },
    {
      icon: Award,
      title: 'Award-Winning Support',
      description: '24/5 multilingual support team ready to assist you via live chat, email, and phone in your language.'
    },
    {
      icon: Users,
      title: 'Transparent Pricing',
      description: 'No hidden fees, no surprises. Clear, competitive spreads and commissions with full cost transparency.'
    }
  ]

  const testimonials = [
    {
      name: 'David Martinez',
      role: 'Professional Trader',
      rating: 5,
      text: 'Best execution speeds I\'ve experienced. FXArtha has transformed my trading with their reliable platform and tight spreads.'
    },
    {
      name: 'Sophie Anderson',
      role: 'Retail Trader',
      rating: 5,
      text: 'The customer support is outstanding. They helped me every step of the way as a beginner trader. Highly recommended!'
    },
    {
      name: 'James Chen',
      role: 'Algorithmic Trader',
      rating: 5,
      text: 'Perfect for automated trading. The copy trading integration is seamless and the VPS hosting is a game-changer for my strategies.'
    }
  ]

  return (
    <div className="min-h-screen pt-20">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="fx-eyebrow mb-6">Why FXArtha</span>
                <h1 className="fx-headline text-4xl md:text-5xl lg:text-6xl mt-5 mb-6">
                  Why Thousands Choose FXArtha
                </h1>
                <p className="text-lg md:text-xl max-w-xl mb-9" style={{ color: 'var(--fx-text-2)' }}>
                  Discover what makes FXArtha the preferred choice for traders worldwide.
                </p>
                <Link to="/accounts/demo">
                  <Button variant="primary" icon>Open Account Now</Button>
                </Link>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.12}>
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Why FXArtha</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Six Pillars ──────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <SectionHeader badge="Our Pillars" title="Our Six Pillars of Excellence" highlight="Six Pillars" />
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12 md:mt-16">
            {pillars.map((pillar, index) => (
              <ScrollRevealItem key={index}>
                <div className="fx-card p-7 md:p-8 h-full">
                  <div className="feature-icon mb-5">
                    <pillar.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{pillar.title}</h3>
                  <p style={{ color: 'var(--fx-text-2)' }}>{pillar.description}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <SectionHeader
            badge="Testimonials"
            title="What Our Traders Say"
            highlight="Traders Say"
            subtitle="Don't just take our word for it. Here's what our clients have to say about their experience with FXArtha."
          />
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 md:mt-16">
            {testimonials.map((testimonial, index) => (
              <ScrollRevealItem key={index}>
                <div className="fx-card p-7 md:p-8 h-full">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <span key={i} className="text-xl">⭐</span>
                    ))}
                  </div>
                  <p className="mb-6 italic" style={{ color: 'var(--fx-text-2)' }}>"{testimonial.text}"</p>
                  <div>
                    <div className="text-white font-semibold">{testimonial.name}</div>
                    <div className="text-sm" style={{ color: 'var(--fx-text-2)' }}>{testimonial.role}</div>
                  </div>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── Regulatory Compliance ────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="fx-eyebrow mb-6">Compliance</span>
                <h2 className="fx-headline text-3xl md:text-4xl mt-5 mb-6">
                  Regulatory Compliance
                </h2>
                <p className="text-lg mb-8" style={{ color: 'var(--fx-text-2)' }}>
                  FXArtha Ltd is authorized and regulated by the Cyprus Securities and Exchange Commission (CySEC) (License No. 789/12).
                </p>
                <div className="grid sm:grid-cols-1 max-w-sm gap-6">
                  <div className="fx-card-gold p-6">
                    <h3 className="text-xl font-semibold text-white mb-2">CySEC Licensed</h3>
                    <p style={{ color: 'var(--fx-text-2)' }}>European Union</p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.1}>
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Regulatory Compliance</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-section-frame text-center">
              <div className="fx-glow-gold" />
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mb-6">Experience the FXArtha Difference</h2>
              <p className="text-lg md:text-xl mb-9 max-w-2xl mx-auto" style={{ color: 'var(--fx-text-2)' }}>
                Join over 500,000 traders who trust us with their trading journey.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/accounts/demo">
                  <Button variant="primary" icon>Open Account Now</Button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default WhyFXArtha
