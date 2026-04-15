import { Check, Moon } from 'lucide-react'
import { Link } from 'react-router-dom'
import ScrollReveal from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'

const features = [
  'Zero overnight swap fees',
  'No interest charges',
  'All instruments available',
  'Same execution speed and spreads',
]

export default function IslamicAccountSection() {
  return (
    <section className="section-padding bg-primary-bg">
      <div className="container-custom">
        <SectionHeader
          badge="Shariah Compliant"
          title="Swap-Free Islamic Account"
          highlight="Islamic Account"
          subtitle="Fully Shariah-compliant trading account designed for traders who require swap-free trading"
        />

        <ScrollReveal variant="fadeUp" delay={0.2} className="mt-12">
          <div className="max-w-4xl mx-auto">
            <div className="glass-card p-8 border-primary-purple/20">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <p className="text-text-secondary leading-relaxed mb-6">
                    TrustEdgeFX offers a fully Shariah-compliant trading account designed for traders who require swap-free trading.
                  </p>

                  <div className="space-y-3 mb-6">
                    {features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-primary-purple/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check size={12} className="text-primary-purple" />
                        </div>
                        <span className="text-text-secondary text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-purple/10 border border-primary-purple/20">
                    <span className="text-primary-purple text-sm font-semibold">Minimum Deposit: $100</span>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-lg bg-primary-purple/10 text-primary-purple flex items-center justify-center mx-auto mb-4"><Moon size={36} /></div>
                    <h3 className="text-white font-bold text-xl mb-4">Shariah Compliant</h3>
                    <Link to="/accounts/standard" className="btn-primary">
                      Open Islamic Account
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
