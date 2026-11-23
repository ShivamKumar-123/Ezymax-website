import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'
import { platforms, platformFeatures } from '../HomeData'

export default function PlatformSection() {
  return (
    <section className="section-padding relative overflow-hidden bg-primary-secondary">
      <div className="container-custom relative z-10">
        <SectionHeader
          badge="Platform"
          title="Next-Generation Trading Platform"
          highlight="Next-Generation"
          subtitle="A trading environment designed for performance and reliability."
        />

        <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-14">
          {platforms.map((p) => (
            <ScrollRevealItem key={p.name}>
              <div className={`glass-card p-6 group h-full border ${p.border} hover:shadow-lg`}>
                <div className={`feature-icon ${p.bg} ${p.color} mb-4`}>{p.icon}</div>
                <span className={`badge ${p.bg} ${p.color} text-xs mb-3 inline-block`}>{p.tag}</span>
                <h3 className="text-white font-semibold text-lg mb-3 group-hover:text-primary-accent transition-colors">{p.name}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{p.desc}</p>
              </div>
            </ScrollRevealItem>
          ))}
        </ScrollRevealGroup>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <div className="mt-12 p-6 md:p-8 rounded-lg border border-white/[0.06] bg-[#0D1117] relative overflow-hidden">
            <h4 className="text-white font-semibold text-center mb-6 text-lg uppercase tracking-wider">
              Platform Features
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {platformFeatures.map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:border-primary-accent/20 transition-all duration-200 bg-white/[0.02]"
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-primary-accent/15">
                    <Check size={11} className="text-primary-accent" />
                  </div>
                  <span className="text-text-secondary text-sm">{f}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <Link to="/platforms/web" className="btn-primary inline-flex items-center gap-2">Explore Platform <ArrowRight size={16} /></Link>
              <Link to="/accounts/demo" className="btn-outline gap-2">Try Demo</Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
