import { Link } from 'react-router-dom'
import { Check, Crown } from 'lucide-react'
import Button from '../components/Button'
import SectionHeader from '../components/SectionHeader'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const ProAccount = () => {
  const features = [
    'Priority 24/7 support',
    'Raw spreads from 0.0 pips',
    'Free VPS hosting',
    'Dedicated account manager',
    'Advanced trading tools',
    'Institutional-grade execution',
    'Premium market research',
    'Exclusive trading signals'
  ]

  const stats = [
    { label: 'Min Deposit', value: '$5,000' },
    { label: 'Spreads From', value: '0.0 pips' },
    { label: 'Leverage', value: '1:200' },
    { label: 'Commission', value: '$3.5/lot' }
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
                  <Crown className="w-3.5 h-3.5" />
                  For Experienced &amp; Professional Traders
                </span>
                <h1 className="fx-headline text-4xl md:text-5xl lg:text-6xl mt-5 mb-6">Pro Account</h1>
                <p className="text-lg md:text-xl max-w-xl mb-9" style={{ color: 'var(--fx-text-2)' }}>
                  Experience professional-grade trading with raw spreads, priority support, and exclusive benefits designed for serious traders.
                </p>
                <Link to="/accounts/demo">
                  <Button variant="primary" icon>Open Pro Account</Button>
                </Link>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.12}>
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Account Preview</span>
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

      {/* ── Premium features ─────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="fx-eyebrow mb-6">Premium Features</span>
                <h2 className="fx-headline text-3xl md:text-4xl mt-5 mb-8">Premium Features</h2>
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
            <ScrollReveal variant="fadeUp" delay={0.1}>
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Platform Visual</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Pro perks (bento) ────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ScrollRevealItem>
              <div className="fx-card-gold h-full p-7 md:p-8">
                <div className="feature-icon mb-6" style={{ width: 56, height: 56 }}>
                  <Crown className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Dedicated Manager</h3>
                <p style={{ color: 'var(--fx-text-2)' }}>
                  Get a personal account manager who understands your trading needs and provides tailored support.
                </p>
              </div>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <div className="fx-card h-full p-7 md:p-8">
                <div className="feature-icon text-2xl mb-6" style={{ width: 56, height: 56 }}>
                  <span>🖥️</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Free VPS Hosting</h3>
                <p style={{ color: 'var(--fx-text-2)' }}>
                  Run your Expert Advisors 24/7 with our complimentary VPS hosting service.
                </p>
              </div>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <div className="fx-card h-full p-7 md:p-8">
                <div className="feature-icon text-2xl mb-6" style={{ width: 56, height: 56 }}>
                  <span>⚡</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Raw Spreads</h3>
                <p style={{ color: 'var(--fx-text-2)' }}>
                  Access institutional-grade pricing with spreads from 0.0 pips on major pairs.
                </p>
              </div>
            </ScrollRevealItem>
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-section-frame text-center">
              <div className="fx-glow-gold" />
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mb-6">Elevate Your Trading</h2>
              <p className="text-lg md:text-xl mb-9 max-w-2xl mx-auto" style={{ color: 'var(--fx-text-2)' }}>
                Join the elite. Open a Pro Account and experience professional-grade trading.
              </p>
              <div className="flex justify-center">
                <Link to="/accounts/demo">
                  <Button variant="primary" icon>Open Pro Account</Button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default ProAccount
