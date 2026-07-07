import { Link } from 'react-router-dom'
import { Check, Globe, Zap, BarChart3, Bell } from 'lucide-react'
import Button from '../components/Button'
import SectionHeader from '../components/SectionHeader'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const WebPlatform = () => {
  const features = [
    {
      icon: Globe,
      title: 'Browser-Based Trading',
      description: 'No downloads required. Access your account from any device with a web browser.'
    },
    {
      icon: BarChart3,
      title: 'TradingView Integration',
      description: 'Full TradingView chart integration with 100+ indicators and drawing tools.'
    },
    {
      icon: Zap,
      title: 'One-Click Execution',
      description: 'Execute trades instantly with our lightning-fast order execution system.'
    },
    {
      icon: Bell,
      title: 'Real-Time Alerts',
      description: 'Set price alerts and get instant notifications on market movements.'
    }
  ]

  const highlights = [
    'Full TradingView chart integration',
    'One-click order execution',
    'Real-time news feed',
    'Portfolio & margin tracker',
    'Mobile-optimized interface',
    'Advanced order types',
    'Watchlist management',
    'Trade history & analytics',
    'Multi-language support',
    'Secure SSL encryption'
  ]

  return (
    <div className="min-h-screen pt-20">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="fx-eyebrow mb-6">Platform</span>
                <h1 className="fx-headline text-4xl md:text-5xl lg:text-6xl mt-5 mb-6">
                  FXArtha Web Platform — Trade Instantly, Anywhere
                </h1>
                <p className="text-lg md:text-xl max-w-xl mb-9" style={{ color: 'var(--fx-text-2)' }}>
                  No download required. Launch the platform from any browser and start trading in seconds.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button variant="primary" icon>Launch Platform</Button>
                  <Link to="/accounts/demo">
                    <Button variant="ghost">Try Demo Account</Button>
                  </Link>
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.12}>
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Platform Preview</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <SectionHeader title="Everything You Need in One Platform" highlight="One Platform" />
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 md:mt-16">
            {features.map((feature, index) => {
              const Icon = feature.icon
              const isAccent = index === 0
              return (
                <ScrollRevealItem key={index}>
                  <div className={`${isAccent ? 'fx-card-gold' : 'fx-card'} h-full p-7 md:p-8`}>
                    <div className="feature-icon mb-6" style={{ width: 56, height: 56 }}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                    <p style={{ color: 'var(--fx-text-2)' }}>{feature.description}</p>
                  </div>
                </ScrollRevealItem>
              )
            })}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── Professional Trading / Overview ──────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="fx-eyebrow mb-6">Overview</span>
                <h2 className="fx-headline text-3xl md:text-4xl mt-5 mb-6">
                  Professional Trading, Simplified
                </h2>
                <p className="text-lg mb-8" style={{ color: 'var(--fx-text-2)' }}>
                  Our web platform combines powerful features with an intuitive interface. Whether you're a beginner or experienced trader, you'll find everything you need to succeed.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {highlights.map((highlight, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--fx-gold-light)' }} />
                      <span style={{ color: 'var(--fx-text-2)' }}>{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.15}>
              <div className="fx-card p-7 md:p-8">
                <div className="fx-image-slot fx-image-slot-16x9 mb-8">
                  <span className="fx-image-slot-label">Platform Visual</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Access Anywhere</h3>
                <p className="mb-6" style={{ color: 'var(--fx-text-2)' }}>
                  Trade from your desktop, laptop, tablet, or smartphone. Your account syncs seamlessly across all devices.
                </p>
                <Button variant="primary" className="w-full" icon>Launch Web Platform</Button>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-section-frame text-center">
              <div className="fx-glow-gold" />
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mb-6">Start Trading in Seconds</h2>
              <p className="text-lg md:text-xl mb-9 max-w-2xl mx-auto" style={{ color: 'var(--fx-text-2)' }}>
                No downloads, no installations. Just open your browser and start trading.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/accounts/demo">
                  <Button variant="primary">Open Account Now</Button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default WebPlatform
