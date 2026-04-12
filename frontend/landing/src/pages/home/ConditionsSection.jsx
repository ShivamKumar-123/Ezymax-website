import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'
import { tradingConditions } from '../HomeData'

export default function ConditionsSection() {
  return (
    <section className="section-padding relative overflow-hidden bg-primary-secondary">
      <div className="container-custom relative z-10">
        <SectionHeader
          badge="Trading Conditions"
          title="Professional Trading Conditions"
          highlight="Trading Conditions"
          subtitle="We follow a No Dealing Desk (NDD) execution model to ensure transparent and conflict-free trading."
        />

        <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
          {tradingConditions.map((item) => (
            <ScrollRevealItem key={item.title}>
              <div className="glass-card p-6 group h-full text-center">
                <div className={`feature-icon ${item.bg} ${item.color} mb-4 mx-auto`}>{item.icon}</div>
                <h3 className="text-white font-semibold mb-2 group-hover:text-primary-accent transition-colors">{item.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{item.desc}</p>
              </div>
            </ScrollRevealItem>
          ))}
        </ScrollRevealGroup>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <div className="mt-10 p-6 rounded-lg border border-white/[0.06] bg-[#0D1117]">
            <h4 className="text-white font-semibold mb-4 text-center uppercase tracking-wider">
              Built-in Risk Management Tools
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['Stop Loss & Take Profit', 'Trailing Stop', 'Negative Balance Protection', 'Margin Call Alerts'].map((tool) => (
                <div
                  key={tool}
                  className="flex items-center gap-2 p-3 rounded-lg border border-white/5 hover:border-primary-purple/20 transition-all duration-200 bg-white/[0.02]"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 bg-primary-purple"
                  />
                  <span className="text-text-secondary text-xs">{tool}</span>
                </div>
              ))}
            </div>

            <div className="text-center mt-6">
              <Link to="/trading/forex" className="btn-primary inline-flex items-center gap-2">
                View Trading Conditions <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
