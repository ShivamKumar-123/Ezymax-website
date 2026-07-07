import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import Button from '../components/Button'
import SectionHeader from '../components/SectionHeader'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const StandardAccount = () => {
  const features = [
    'Free educational content',
    '24/5 customer support',
    'Negative balance protection',
    'Access to all trading platforms',
    'No hidden fees',
    'Free deposits & withdrawals',
    'Real-time market data',
    'Mobile trading apps'
  ]

  const stats = [
    { label: 'Min Deposit', value: '$100' },
    { label: 'Spreads From', value: '1.2 pips' },
    { label: 'Leverage', value: '1:500' },
    { label: 'Commission', value: 'None' }
  ]

  const comparison = [
    { feature: 'Minimum Deposit', standard: '$100', pro: '$5,000', demo: '$0' },
    { feature: 'Spreads From', standard: '1.2 pips', pro: '0.0 pips', demo: 'Live spreads' },
    { feature: 'Leverage', standard: 'Up to 1:500', pro: 'Up to 1:200', demo: 'Up to 1:500' },
    { feature: 'Commission', standard: 'None', pro: '$3.5/lot', demo: 'None' },
    { feature: 'Platforms', standard: 'Web, Copy Trading', pro: 'Web, Copy Trading', demo: 'Web, Copy Trading' },
    { feature: 'Support', standard: '24/5', pro: 'Priority 24/7', demo: '24/5' }
  ]

  return (
    <div className="min-h-screen pt-20">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="badge mb-6">For Beginners &amp; Retail Traders</span>
                <h1 className="fx-headline text-4xl md:text-5xl lg:text-6xl mt-5 mb-6">Standard Account</h1>
                <p className="text-lg md:text-xl max-w-xl mb-9" style={{ color: 'var(--fx-text-2)' }}>
                  Start your trading journey with our beginner-friendly Standard Account. Low minimum deposit, competitive spreads, and no commission.
                </p>
                <Link to="/accounts/demo">
                  <Button variant="primary" icon>Open Standard Account</Button>
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

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="fx-eyebrow mb-6">Account Features</span>
                <h2 className="fx-headline text-3xl md:text-4xl mt-5 mb-8">Everything you need to start</h2>
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

      {/* ── Comparison table ─────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <SectionHeader badge="Compare" title="Compare Account Types" highlight="Account Types" />
          <ScrollReveal variant="fadeUp" delay={0.2}>
            <div className="fx-section-frame mt-12 md:mt-16">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--fx-line-strong)' }}>
                      <th className="text-left py-4 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--fx-text-3)' }}>Feature</th>
                      <th className="text-center py-4 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--fx-gold-light)' }}>Standard</th>
                      <th className="text-center py-4 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--fx-text-3)' }}>Pro</th>
                      <th className="text-center py-4 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--fx-text-3)' }}>Demo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((row, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid var(--fx-line)' }}>
                        <td className="py-4" style={{ color: 'var(--fx-text-2)' }}>{row.feature}</td>
                        <td className="py-4 text-center font-semibold text-white">{row.standard}</td>
                        <td className="py-4 text-center" style={{ color: 'var(--fx-text-2)' }}>{row.pro}</td>
                        <td className="py-4 text-center" style={{ color: 'var(--fx-text-2)' }}>{row.demo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-section-frame text-center">
              <div className="fx-glow-gold" />
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mb-6">Ready to Start Trading?</h2>
              <p className="text-lg md:text-xl mb-9 max-w-2xl mx-auto" style={{ color: 'var(--fx-text-2)' }}>
                Open your Standard Account today with just $100 and start trading global markets.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/accounts/demo">
                  <Button variant="primary" icon>Open Standard Account</Button>
                </Link>
                <Link to="/accounts/demo">
                  <Button variant="ghost">Try Demo First</Button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default StandardAccount
