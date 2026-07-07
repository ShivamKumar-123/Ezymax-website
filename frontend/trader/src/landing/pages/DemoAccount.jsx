import { Link } from 'react-router-dom'
import { Check, Play } from 'lucide-react'
import Button from '../components/Button'
import SectionHeader from '../components/SectionHeader'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const DemoAccount = () => {
  const features = [
    'Identical to live trading environment',
    'Unlimited demo resets',
    'Access to all platforms (Web, Copy Trading)',
    'No credit card required',
    'Real-time market data',
    'Practice with $100,000 virtual funds',
    'Test trading strategies risk-free',
    'Learn platform features'
  ]

  const stats = [
    { label: 'Virtual Funds', value: '$100,000' },
    { label: 'Cost', value: 'Free' },
    { label: 'Duration', value: 'Unlimited' },
    { label: 'Platforms', value: 'All' }
  ]

  const benefits = [
    {
      icon: '🎓',
      title: 'Learn Risk-Free',
      description: 'Practice trading strategies and test your skills without risking real money.'
    },
    {
      icon: '📊',
      title: 'Real Market Conditions',
      description: 'Experience live market prices and conditions identical to a real trading account.'
    },
    {
      icon: '🔄',
      title: 'Unlimited Resets',
      description: 'Reset your demo account anytime and start fresh with $100,000 virtual funds.'
    }
  ]

  const steps = [
    { n: '1', title: 'Sign Up', desc: 'Create your free demo account in seconds' },
    { n: '2', title: 'Choose Platform', desc: 'Select Web Platform or Copy Trading' },
    { n: '3', title: 'Start Trading', desc: 'Practice with $100,000 virtual funds' }
  ]

  return (
    <div className="min-h-screen pt-20">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="badge mb-6">
                  <Play className="w-3.5 h-3.5" />
                  Risk-Free Practice Account
                </span>
                <h1 className="fx-headline text-4xl md:text-5xl lg:text-6xl mt-5 mb-6">
                  Practice Risk-Free with $100,000 Virtual Funds
                </h1>
                <p className="text-lg md:text-xl max-w-xl mb-9" style={{ color: 'var(--fx-text-2)' }}>
                  Test your strategy on real market conditions without risking a cent. No credit card required.
                </p>
                <Button variant="primary" icon>Open Demo Account Now</Button>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.12}>
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Demo Preview</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Stat strip ───────────────────────────────────────── */}
      <section className="fx-section" style={{ paddingTop: 0, background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-section-frame fx-section-frame-tight p-0 overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
                {stats.map((stat, index) => (
                  <div key={index} className="fx-stats-cell">
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] mb-3" style={{ color: 'var(--fx-text-3)' }}>
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">{stat.value}</div>
                    <div className="text-sm" style={{ color: 'var(--fx-text-2)' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <ScrollReveal variant="fadeUp">
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Platform Visual</span>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.1}>
              <div>
                <span className="fx-eyebrow mb-6">Demo Account Features</span>
                <h2 className="fx-headline text-3xl md:text-4xl mt-5 mb-8">Demo Account Features</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Check className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--fx-gold-light)' }} />
                      <span style={{ color: 'var(--fx-text-2)' }}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Why use a demo (benefits) ────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <SectionHeader badge="Benefits" title="Why Use a Demo Account?" highlight="Demo Account" />
          <ScrollRevealGroup className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <ScrollRevealItem key={index}>
                <div className="fx-card h-full p-7 md:p-8">
                  <div className="feature-icon text-2xl mb-6" style={{ width: 56, height: 56 }}>
                    <span>{benefit.icon}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{benefit.title}</h3>
                  <p style={{ color: 'var(--fx-text-2)' }}>{benefit.description}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── How to get started ───────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-section-frame text-center">
              <h2 className="fx-headline text-3xl md:text-4xl mb-10">How to Get Started</h2>
              <div className="grid md:grid-cols-3 gap-8 mb-10">
                {steps.map((step) => (
                  <div key={step.n}>
                    <div className="feature-icon mx-auto mb-5 text-lg font-bold" style={{ width: 48, height: 48 }}>
                      {step.n}
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                    <p style={{ color: 'var(--fx-text-2)' }}>{step.desc}</p>
                  </div>
                ))}
              </div>
              <Button variant="primary" icon>Open Demo Account</Button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-section-frame text-center">
              <div className="fx-glow-gold" />
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mb-6">Ready When You Are</h2>
              <p className="text-lg md:text-xl mb-9 max-w-2xl mx-auto" style={{ color: 'var(--fx-text-2)' }}>
                When you're confident with your demo account, upgrade to a live account and start trading for real.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="primary">Open Demo Account</Button>
                <Link to="/accounts/standard">
                  <Button variant="ghost">View Live Accounts</Button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default DemoAccount
