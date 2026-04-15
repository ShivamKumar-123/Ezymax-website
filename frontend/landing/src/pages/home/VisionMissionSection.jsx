import { Shield, TrendingUp, Heart, Eye, Rocket } from 'lucide-react'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'

const values = [
  { icon: <Shield size={22} />, title: 'Transparency', desc: 'We believe in fair trading conditions and clear pricing with no hidden charges.', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
  { icon: <TrendingUp size={22} />, title: 'Innovation', desc: 'We continuously improve our trading technology to deliver the best performance.', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { icon: <Heart size={22} />, title: 'Integrity', desc: 'We operate with honesty, professionalism, and strong ethical standards.', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
]

export default function VisionMissionSection() {
  return (
    <section className="section-padding bg-primary-bg">
      <div className="container-custom">
        <SectionHeader
          badge="Our Foundation"
          title="Vision, Mission & Values"
          highlight="Mission & Values"
          subtitle="The principles that guide everything we do"
        />

        <div className="grid md:grid-cols-2 gap-6 mt-12 mb-16">
          <ScrollReveal variant="fadeLeft">
            <div className="p-8 rounded-lg bg-gradient-to-br from-primary-accent/10 to-primary-secondary border border-primary-accent/20 h-full">
              <div className="feature-icon bg-primary-accent/10 text-primary-accent mb-4"><Eye size={24} /></div>
              <h3 className="text-xl font-bold text-white mb-3">Our Vision</h3>
              <p className="text-text-secondary leading-relaxed">
                To become a globally trusted trading partner providing traders with access to professional technology and fair market conditions.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal variant="fadeRight" delay={0.1}>
            <div className="p-8 rounded-lg bg-gradient-to-br from-primary-purple/10 to-primary-secondary border border-primary-purple/20 h-full">
              <div className="feature-icon bg-primary-purple/10 text-primary-purple mb-4"><Rocket size={24} /></div>
              <h3 className="text-xl font-bold text-white mb-3">Our Mission</h3>
              <p className="text-text-secondary leading-relaxed">
                To empower traders worldwide by delivering transparent pricing, reliable execution, and innovative trading solutions.
              </p>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <h3 className="text-2xl font-bold text-white text-center mb-8">Core Values</h3>
        </ScrollReveal>

        <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {values.map((value) => (
            <ScrollRevealItem key={value.title}>
              <div className="glass-card p-6 group h-full text-center">
                <div className={`feature-icon ${value.bg} ${value.color} mb-4 mx-auto`}>
                  {value.icon}
                </div>
                <h4 className="text-white font-semibold text-lg mb-3 group-hover:text-primary-accent transition-colors">
                  {value.title}
                </h4>
                <p className="text-text-secondary text-sm leading-relaxed">{value.desc}</p>
              </div>
            </ScrollRevealItem>
          ))}
        </ScrollRevealGroup>
      </div>
    </section>
  )
}
