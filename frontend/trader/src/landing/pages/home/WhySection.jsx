import { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'
import { whyFeatures } from '../HomeData'

export default function WhySection() {
  return (
    <section className="section-padding relative overflow-hidden bg-primary-secondary">
      <div className="container-custom relative z-10">
        <SectionHeader
          badge="Why Choose Us"
          title="Why Choose TrustEdgeFX"
          highlight="TrustEdgeFX"
          subtitle="We combine institutional-grade technology with trader-friendly conditions to give you the edge in global markets."
        />

        <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
          {whyFeatures.map((f) => (
            <ScrollRevealItem key={f.title}>
              <div className="glass-card p-6 group h-full">
                <div className={`feature-icon ${f.bg} ${f.color} mb-4`}>{f.icon}</div>
                <h3 className="text-white font-semibold text-lg mb-2 group-hover:text-primary-accent transition-colors">
                  {f.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
              </div>
            </ScrollRevealItem>
          ))}
        </ScrollRevealGroup>
      </div>
    </section>
  )
}
